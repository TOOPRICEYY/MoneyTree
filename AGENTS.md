# AGENTS.md - Guide for AI Agents Working with MoneyTree

Conventions here are adapted from [actualbudget/actual](https://github.com/actualbudget/actual)'s
`AGENTS.md`, trimmed to what applies to a Node-only data pipeline.

## Project Overview

**MoneyTree** aggregates itemized purchases from retailers and receipts
(Amazon, Costco, eBay, Apple, Meijer, receipt photos), dedups them, matches
each purchase to the bank charge it explains, and writes the line items into
[Actual Budget](https://actualbudget.org) as split transactions.

Actual is the app for viewing and editing data; MoneyTree never replaces it.
Bank transactions (Chase, LMCU) are imported into Actual directly. MoneyTree
only enriches those existing transactions with splits.

- **Primary Language**: TypeScript (strict), run directly by Node's type stripping
- **Build System**: Yarn 4 workspaces (monorepo), lage for tasks
- **Actual server**: local sync server, see `../Accountable/actual-budget`

## Quick Start Commands

### Essential Commands (Run from Root)

```bash
# Type checking (ALWAYS run before committing)
yarn typecheck

# Linting and formatting (with auto-fix)
yarn lint:fix

# Run all tests
yarn test

# CLI
yarn moneytree sources
yarn moneytree parse costco path/to/costco_receipts.json
yarn moneytree sync costco path/to/costco_receipts.json          # dry run
yarn moneytree sync costco path/to/costco_receipts.json --apply  # writes splits
```

### Important Rules

- **ALWAYS run yarn commands from the root directory** - never run them in child workspaces
- Use `yarn workspace <workspace-name> run <command>` for workspace-specific tasks
- Tests run once and exit by default (using `vitest --run`)
- **Never commit financial data.** Raw exports, receipts and the Actual cache
  live in `data/` (gitignored). Test fixtures must be synthetic or scrubbed:
  no real card numbers, order ids, addresses or barcodes.
- `sync` is a dry run unless `--apply` is passed. Don't run `--apply` against
  the real budget unless the user asks.

### Task Orchestration with Lage

`yarn test` runs `lage test --continue`: parallel across workspaces, cached in
`.lage/`. Use `yarn test:debug` to bypass the cache. Clear with `rm -rf .lage`
if results look stale.

## Architecture & Package Structure

Data flows one way: **importers → core (dedup, match, split) → actual-sync**.

#### 1. **core** (`packages/core/` - `@moneytree/core`)

Pure, dependency-free logic. No I/O.

- `types.ts` - `Purchase`, `LineItem`, `Adjustment`, `BankTransaction`, `PurchaseMatch`
- `money.ts` - integer-cents helpers and `allocate()` (largest-remainder split)
- `dedup.ts` - `purchaseKey()`, `dedupePurchases()`, `matchPurchasesToBank()`
- `split.ts` - `toSplits()`: line items plus spread tax/shipping/discounts, always summing to the total

#### 2. **importers** (`packages/importers/` - `@moneytree/importers`)

One folder per source under `src/<source>/`, each exporting an `Importer`
(`{ source, description, parseFile(path) }`) registered in `src/index.ts`.

- `costco` - implemented: receipts-endpoint JSON, folds instant savings into items
- `amazon`, `apple`, `ebay`, `meijer`, `receipt` - stubs with the planned approach in comments

#### 3. **actual-sync** (`packages/actual-sync/` - `@moneytree/actual-sync`)

The only package that talks to Actual, through `@actual-app/api`.

- `toActual.ts` - pure mapping from a `PurchaseMatch` to an `updateTransaction` payload (unit tested)
- `client.ts` - `withBudget()`, `getUnitemizedTransactions()`, `applyMatches()`

#### 4. **cli** (`packages/cli/` - `@moneytree/cli`)

`src/main.ts`, run with `yarn moneytree <command>`.

### Adding an importer

1. Create `packages/importers/src/<source>/index.ts` exporting an `Importer`.
2. Add the source to `SourceId` in `packages/core/src/types.ts` if it is new.
3. Register it in `packages/importers/src/index.ts`.
4. Add `index.test.ts` next to it with a synthetic fixture covering discounts,
   tax, refunds and multi-payment receipts.

## Domain Conventions

- **Amounts are integer cents, outflows negative** - the same as Actual's
  storage format, so values pass to `@actual-app/api` unconverted. Convert
  with `toCents()` at the importer boundary and never use floats after that.
- **Dates are `YYYY-MM-DD` strings** (`IsoDate`).
- **Splits must sum exactly to the bank amount.** Use `allocate()` for any
  proportional spreading; never round each part independently.
- **Idempotency**: `purchaseKey()` (`moneytree:<source>:<externalId>`) is
  written into the parent transaction's notes. Re-runs skip anything already
  tagged, so every importer must produce a stable `externalId`.
- **Retailer data beats receipt photos** when both describe one purchase.
- Reference implementation for matching heuristics (Amazon descriptor codes,
  ship-date vs order-date, Whole Foods): `../Accountable/Itteration 1/backend/accountable/merge/dedup.py`.

## Code Style & Conventions

### TypeScript Guidelines

- Use TypeScript for all code, `strict` everywhere. Look for existing type definitions before adding new ones
- Prefer `satisfies` over type assertions (`as`, `!`) for narrowing
- Use `type`, not `interface` (enforced by lint)
- Only erasable syntax (no `enum`, `namespace`, parameter properties) so Node can run `.ts` directly
- Relative imports include the `.ts` extension
- Use `import type` for type-only imports, as separate statements
- No default exports (except config files)

**Naming:**

- Use descriptive variable names with auxiliary verbs (e.g., `isLoaded`, `hasError`)

**Code Structure:**

- Functional and declarative programming patterns - avoid classes
- Use the `function` keyword for pure functions
- Prefer iteration and modularization over code duplication
- Structure files: exported functions, helpers, static content, types
- Keep I/O at the edges: parsing in importers, Actual calls in actual-sync, pure logic in core

## Testing

- Vitest, with globals (`describe`, `it`, `expect`) enabled
- Tests live next to source as `*.test.ts`
- Minimize mocking - prefer real implementations and pure functions
- `actual-sync` tests cover the pure mapping; don't hit a real Actual server in unit tests
- Use descriptive test names

## Configuration Files

- `/package.json` - Root workspace configuration, scripts
- `/lage.config.js` - Lage task runner configuration
- `/.oxlintrc.json` - Lint rules (oxlint); `/.oxfmtrc.json` - formatting (oxfmt, copied from Actual)
- `/.nano-staged.json` - pre-commit format/lint config (run via Husky)
- `/tsconfig.base.json` - shared compiler options; `/tsconfig.json` - project references
- `/.claude/settings.json` - agent hooks; scripts in `/scripts/agent-hooks/` require `jq`
- `/.env.example` - Actual server settings; copy to `.env`

## Code Quality Checklist

Before committing changes, ensure:

- [ ] `yarn typecheck`, `yarn lint` and `yarn test` pass
- [ ] No real financial data in fixtures or committed files
- [ ] New amounts are integer cents and splits balance

## Environment Requirements

- **Node.js**: >=22.18 (type stripping); `.nvmrc` pins v24
- **Yarn**: ^4.9.1 (managed by `packageManager` field; `corepack enable`)

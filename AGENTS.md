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

# Web UI on http://127.0.0.1:5007 (builds the UI, then serves it with the API)
yarn ui

# UI development: API server + Vite dev server with HMR on :5173
yarn start

# CLI
yarn moneytree sources                              # sources and their channels
yarn moneytree auth gmail                           # one-time Gmail OAuth
yarn moneytree fetch costco --via scrape            # raw docs into data/raw/
yarn moneytree fetch apple --via email --since 2026-01-01
yarn moneytree fetch amazon --via knot
yarn moneytree import costco data/costco_receipts.json  # register a local file
yarn moneytree parse costco                         # parse everything in data/raw/costco
yarn moneytree parse costco path/to/costco_receipts.json
yarn moneytree sync costco                          # dry run
yarn moneytree sync costco --apply                  # writes splits
```

### Important Rules

- **ALWAYS run yarn commands from the root directory** - never run them in child workspaces
- Use `yarn workspace <workspace-name> run <command>` for workspace-specific tasks
- Tests run once and exit by default (using `vitest --run`)
- **Never commit financial data or credentials.** Raw exports, fetched
  documents, OAuth tokens, the browser profile and the Actual cache all live
  in `data/` (gitignored). Test fixtures must be synthetic or scrubbed:
  no real card numbers, order ids, addresses or barcodes.
- `sync` is a dry run unless `--apply` is passed. Don't run `--apply` against
  the real budget unless the user asks.

### Task Orchestration with Lage

`yarn test` runs `lage test --continue`: parallel across workspaces, cached in
`.lage/`. Use `yarn test:debug` to bypass the cache. Clear with `rm -rf .lage`
if results look stale.

## Architecture & Package Structure

Data flows one way:

```
fetchers (email | scrapers | aggregators | files)
   → RawDocument, saved to data/raw/<source>/<channel>/
   → importers (parse)  → core (dedup, match, split)  → actual-sync

pipeline (orchestration) ← cli
                         ← server (local HTTP API) ← ui (views) ← web (standalone shell)
                                                                ← Actual extension (planned)
```

Fetchers only acquire data and importers only parse it, joined by the
`RawDocument` type in core. Any channel can feed any parser, and raw data can
be re-parsed offline after a parser fix without fetching again.

#### 1. **core** (`packages/core/` - `@moneytree/core`)

Pure, dependency-free logic. No I/O.

- `types.ts` - `Purchase`, `LineItem`, `Adjustment`, `BankTransaction`, `PurchaseMatch`, `RawDocument`, `EmailQuery`
- `money.ts` - integer-cents helpers and `allocate()` (largest-remainder split)
- `dedup.ts` - `purchaseKey()`, `dedupePurchases()`, `matchPurchasesToBank()`
- `split.ts` - `toSplits()`: line items plus spread tax/shipping/discounts, always summing to the total

#### 2. **email** (`packages/email/` - `@moneytree/email`)

Fetches receipt emails. Providers (`EmailProvider`) only search and download
RFC 822 messages; `fetchEmails()` parses them (mailparser) and re-checks each
against the source's `EmailQuery`, so every provider yields identical documents.

- `gmail.ts` - Gmail REST API, read-only scope, refresh-token auth
- `gmailAuth.ts` - loopback OAuth flow behind `yarn moneytree auth gmail`
- `imap.ts` - any IMAP mailbox (Gmail, iCloud, Zoho, Outlook) with an app password

#### 3. **scrapers** (`packages/scrapers/` - `@moneytree/scrapers`)

Logged-in web sessions. `withBrowser()` drives the user's installed Chrome
through playwright-core with a persistent profile in `data/browser-profile/`,
headed so the user can log in. No bundled browser is downloaded.

- `costco.ts` - implemented: captures the receipts page's API token, then calls Costco's receipts GraphQL API (ported from Accountable's extraction tools)
- `amazon`, `apple`, `ebay`, `meijer` - stubs

#### 4. **aggregators** (`packages/aggregators/` - `@moneytree/aggregators`)

Third-party APIs for itemized merchant data.

- `knot.ts` - Knot TransactionLink: SKU-level orders for linked merchant accounts (Amazon 44, Costco 165), cursor-based sync; cursors persist in `data/state/`
- Bank-feed aggregators (SimpleFIN, GoCardless) are intentionally absent: Actual's built-in bank sync covers them

#### 5. **importers** (`packages/importers/` - `@moneytree/importers`)

Parsers. One folder per source under `src/<source>/`, each exporting an
`Importer` (`{ source, description, emailQuery?, parse(doc) }`) registered in
`src/index.ts`. `parseDocument()` routes Knot payloads to `src/knot/` (one
format for all merchants) and everything else to the source's importer.

- `costco` - implemented: receipts JSON from the scraper or a saved file, folds instant savings into items
- `knot` - implemented: Knot transactions for any merchant
- `amazon`, `apple`, `ebay`, `meijer`, `receipt` - stubs with the planned approach in comments; their `emailQuery` is already used by `fetch --via email`

#### 6. **actual-sync** (`packages/actual-sync/` - `@moneytree/actual-sync`)

The only package that talks to Actual, through `@actual-app/api`.

- `toActual.ts` - pure mapping from a `PurchaseMatch` to an `updateTransaction` payload (unit tested)
- `client.ts` - `withBudget()`, `getUnitemizedTransactions()`, `applyMatches()`

#### 7. **pipeline** (`packages/pipeline/` - `@moneytree/pipeline`)

Orchestration shared by the CLI and the server: builds providers from
`.env` (`fetch.ts`), stores raw documents and state (`store.ts`), lists
sources and channel status (`sources.ts`), parses purchases
(`purchases.ts`), and previews/applies matches (`review.ts`). All
`@actual-app/api` use goes through one queue, because the API holds a single
open budget per process.

#### 8. **cli** (`packages/cli/` - `@moneytree/cli`)

`src/main.ts`, run with `yarn moneytree <command>`. Thin wrapper over pipeline.

#### 9. **server** (`packages/server/` - `@moneytree/server`)

Local HTTP API for the UI (Hono on `127.0.0.1:5007`, never exposed beyond
localhost because it can read mail and write the budget). `createApp(pipeline)`
takes the pipeline as an argument so routes are tested with fakes
(`app.test.ts`). Fetches run as in-memory jobs (`jobs.ts`) that the UI polls.
In production it also serves `packages/web/dist`.

#### 10. **ui** (`packages/ui/` - `@moneytree/ui`)

The views, written to run in any host: the standalone app today, Actual
later. React 19, compiled by the host's React Compiler setup (see
`packages/web/vite.config.ts`, same as Actual's desktop-client).

- `MoneyTreeProvider` takes a `client` (`MoneyTreeClient`) and a `linkTo`
  function, owns its own TanStack Query cache, and renders `.mt-root`
- Views: `SourcesView`, `PurchasesView`, `ReviewView`, `ActivityPanel`
  (`placement="floating" | "inline"`)
- `createHttpClient(baseUrl)` talks to the MoneyTree server
- `styles.css` is scoped under `.mt-root`; its `--mt-*` tokens resolve to
  Actual's `--color-*` theme variables when present, with MoneyTree's own
  palette as the fallback

Rules that keep it embeddable:

- No global CSS (no `:root`, `body`, or unscoped selectors) and no layout chrome
- No `window.location`, routers or hrefs built by hand: links come from `linkTo`
- No direct `fetch`: all data goes through the injected `MoneyTreeClient`
- React is a peer dependency; never import Node packages
- API types come from `@moneytree/core`'s `api.ts`

#### 11. **web** (`packages/web/` - `@moneytree/web`)

The standalone shell: sidebar, hash routing (`route.ts` is its `linkTo`),
page chrome (`shell.css`), and `createHttpClient('/api')`. Built by Vite and
served by the server under `yarn ui`.

### Embedding in Actual

MoneyTree stays a separately hosted service; Actual (branch
`moneytree-extension` in `../actual`) frames it. Contract:

- `GET /health` returns `{ ok, version }`; Actual checks it before showing the frame
- `/embed/*` serves the same bundle as `EmbedApp` (`packages/web/src/EmbedApp.tsx`):
  no sidebar, paths `/embed/sources`, `/embed/purchases/:source`, `/embed/review/:source`
- Allowed host origins: `MONEYTREE_ALLOWED_ORIGINS` (default `http://localhost:5006,http://localhost:3001`).
  They get CORS on `/api` and `/health`, and are the only `frame-ancestors` for `/embed`
- `/embed` sends `Cross-Origin-Embedder-Policy: require-corp` and assets send
  `Cross-Origin-Resource-Policy: cross-origin`, because Actual's page is cross-origin isolated
- postMessage (`packages/web/src/bridge.ts`), all `{ source: 'moneytree' | 'actual', type, ... }`,
  origin-checked: child sends `ready`, `navigate { path }`, `budget-changed`;
  host sends `init`/`theme { vars }` (Actual's `--color-*`, applied on `:root`) and `navigate { path }`

### Adding an importer

1. Create `packages/importers/src/<source>/index.ts` exporting an `Importer`.
2. Add the source to `SourceId` in `packages/core/src/types.ts` if it is new.
3. Register it in `packages/importers/src/index.ts`.
4. Add `index.test.ts` next to it with a synthetic fixture covering discounts,
   tax, refunds and multi-payment receipts.
5. If the source sends receipt emails, set `emailQuery`. If it needs a
   logged-in session, add a scraper in `packages/scrapers/` that yields
   `RawDocument`s your parser understands.

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
- **Match per charge, not per order.** Amazon bills once per shipment, so one
  order can explain several bank charges; matching must allow a purchase to
  split across charges rather than assume one-to-one.
- **Refunds and gift cards need explicit handling.** Refunds are positive
  purchases that should match bank credits; the gift-card portion of an order
  never reaches the bank, so splits must cover only the card-paid amount.
- Reference implementation for matching heuristics (Amazon descriptor codes,
  ship-date vs order-date, Whole Foods): `../Accountable/Itteration 1/backend/accountable/merge/dedup.py`.
- Prior art to check before writing a stub:
  [taylorcjensen/actual-amazon](https://github.com/taylorcjensen/actual-amazon)
  (Amazon to Actual splits via amazon-orders, proportional tax/discounts),
  [thehesiod/costco-mcp](https://github.com/thehesiod/costco-mcp) (itemized
  Costco receipts API), and [jbms/beancount-import](https://github.com/jbms/beancount-import)
  (closest design for cross-source matching and dedup: 5-day window, learns
  from confirmations). Also maintained: amazon-orders, azad, Receipt
  Wrangler, actual-ai.
  Full notes: [docs/research/similar-projects.md](docs/research/similar-projects.md).
- **Prefer email over scraping.** Scrapers break and hit CAPTCHAs; use a
  source's emails as the primary channel and scraping as the fallback.

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

**React (web package), following Actual:**

- React Compiler auto-memoizes, so skip manual `useCallback`/`useMemo`/`memo`
- Functional components with named exports and typed props, one component per file
- Import from `react` by name (no `React.*` default import)
- Wrap standalone financial numbers in `Money` (tabular figures), Actual's `FinancialText` equivalent
- Actions that write to Actual need an explicit confirm step

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
- Network code takes an injectable `fetch` (see `knot.test.ts`, `email.test.ts`); unit tests never hit Gmail, Knot, Costco or a real Actual server
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

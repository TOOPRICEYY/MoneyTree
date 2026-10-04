import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  applyMatches,
  configFromEnv,
  getUnitemizedTransactions,
  withBudget,
} from '@moneytree/actual-sync';
import { dedupePurchases, matchPurchasesToBank } from '@moneytree/core';
import type { Purchase, SourceId } from '@moneytree/core';
import { importers } from '@moneytree/importers';

// Resolve file arguments from where the user ran `yarn moneytree`, and
// config from the repo root.
const ROOT = resolve(import.meta.dirname, '../../..');
const INVOKED_FROM = process.env.INIT_CWD ?? process.cwd();

const USAGE = `Usage:
  moneytree sources
  moneytree parse <source> <file>...      Print parsed purchases as JSON
  moneytree sync <source> <file>... [--apply] [--since YYYY-MM-DD]
      Match purchases to bank charges in Actual. Dry run unless --apply.`;

function isSourceId(value: string): value is SourceId {
  return Object.hasOwn(importers, value);
}

async function parseAll(source: string, files: string[]): Promise<Purchase[]> {
  if (!isSourceId(source)) {
    throw new Error(`Unknown source "${source}". Run: moneytree sources`);
  }
  const results = await Promise.all(
    files.map(file => importers[source].parseFile(resolve(INVOKED_FROM, file))),
  );
  return dedupePurchases(results.flat());
}

async function main(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      apply: { type: 'boolean', default: false },
      since: { type: 'string' },
    },
  });
  const [command, source = '', ...files] = positionals;

  switch (command) {
    case 'sources':
      for (const importer of Object.values(importers)) {
        console.log(`${importer.source.padEnd(8)} ${importer.description}`);
      }
      return;
    case 'parse':
      console.log(JSON.stringify(await parseAll(source, files), null, 2));
      return;
    case 'sync': {
      const envFile = resolve(ROOT, '.env');
      if (existsSync(envFile)) process.loadEnvFile(envFile);
      process.env.ACTUAL_DATA_DIR = resolve(
        ROOT,
        process.env.ACTUAL_DATA_DIR ?? 'data/actual-cache',
      );
      const purchases = await parseAll(source, files);
      const dates = purchases.map(p => p.date).sort();
      const since = values.since ?? dates[0] ?? '1970-01-01';
      const until = new Date().toISOString().slice(0, 10);

      await withBudget(configFromEnv(), async () => {
        const bank = await getUnitemizedTransactions(since, until);
        const matches = matchPurchasesToBank(purchases, bank);
        for (const m of matches) {
          console.log(
            `${m.bankTransaction.date} ${(m.bankTransaction.amount / 100).toFixed(2)} ` +
              `${m.bankTransaction.payee} <- ${m.purchase.merchant} ` +
              `(${m.purchase.items.length} items, score ${m.score.toFixed(2)})`,
          );
        }
        console.log(
          `${matches.length} of ${purchases.length} purchases matched.`,
        );
        if (values.apply) {
          await applyMatches(matches);
          console.log('Splits written to Actual.');
        } else {
          console.log('Dry run. Re-run with --apply to write splits.');
        }
      });
      return;
    }
    default:
      console.log(USAGE);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  applyMatches,
  configFromEnv,
  getUnitemizedTransactions,
  withBudget,
} from '@moneytree/actual-sync';
import { dedupePurchases, matchPurchasesToBank } from '@moneytree/core';
import type { Purchase, RawDocument, SourceId } from '@moneytree/core';
import { importers, parseDocument } from '@moneytree/importers';
import { scrapers } from '@moneytree/scrapers';

import { authGmail, CHANNELS, fetchSource } from './fetch.ts';
import type { Via } from './fetch.ts';
import { INVOKED_FROM, loadEnv, ROOT } from './paths.ts';
import { loadRawDocuments } from './store.ts';

const USAGE = `Usage:
  moneytree sources                       List sources and how each can be fetched
  moneytree auth gmail                    Authorize read-only Gmail access
  moneytree fetch <source> --via <email|scrape|knot> [--since YYYY-MM-DD]
      Download raw receipts into data/raw/<source>/
  moneytree parse <source> [file...]      Print purchases as JSON (default: data/raw)
  moneytree sync <source> [file...] [--apply] [--since YYYY-MM-DD]
      Match purchases to bank charges in Actual. Dry run unless --apply.`;

function isSourceId(value: string): value is SourceId {
  return Object.hasOwn(importers, value);
}

function isVia(value: string): value is Via {
  return CHANNELS.some(channel => channel === value);
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Explicit files win; otherwise everything fetched into data/raw. */
async function loadPurchases(
  source: SourceId,
  files: string[],
): Promise<Purchase[]> {
  const docs: RawDocument[] =
    files.length > 0
      ? files.map(file => ({
          source,
          channel: 'file',
          kind: 'file',
          id: file,
          fetchedAt: new Date().toISOString(),
          path: resolve(INVOKED_FROM, file),
        }))
      : await loadRawDocuments(source);
  const results = await Promise.all(docs.map(parseDocument));
  return dedupePurchases(results.flat());
}

async function main(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      apply: { type: 'boolean', default: false },
      since: { type: 'string' },
      via: { type: 'string' },
    },
  });
  const [command, arg = '', ...files] = positionals;
  loadEnv();

  if (command === 'sources') {
    for (const importer of Object.values(importers)) {
      const scraper = scrapers[importer.source];
      const planned = (isPlanned: boolean | undefined) =>
        isPlanned ? ' (planned)' : '';
      const channels = [
        importer.emailQuery && `email${planned(importer.isPlanned)}`,
        scraper && `scrape${planned(scraper.isPlanned || importer.isPlanned)}`,
        ['amazon', 'costco'].includes(importer.source) && 'knot',
        `file${planned(importer.isPlanned)}`,
      ].filter(Boolean);
      console.log(
        `${importer.source.padEnd(8)} ${importer.description}\n         via: ${channels.join(', ')}`,
      );
    }
    return;
  }

  if (command === 'auth') {
    if (arg !== 'gmail') throw new Error('Only `auth gmail` is supported.');
    await authGmail();
    return;
  }

  if (!command || !['fetch', 'parse', 'sync'].includes(command)) {
    console.log(USAGE);
    return;
  }
  if (!isSourceId(arg)) {
    throw new Error(`Unknown source "${arg}". Run: moneytree sources`);
  }

  switch (command) {
    case 'fetch': {
      const via = values.via ?? '';
      if (!isVia(via)) {
        throw new Error(`--via must be one of: ${CHANNELS.join(', ')}`);
      }
      const count = await fetchSource(arg, via, values.since ?? daysAgo(365));
      console.log(`Saved ${count} ${arg} documents to data/raw/${arg}/.`);
      return;
    }
    case 'parse':
      console.log(JSON.stringify(await loadPurchases(arg, files), null, 2));
      return;
    case 'sync': {
      const purchases = await loadPurchases(arg, files);
      const dates = purchases.map(p => p.date).sort();
      const since = values.since ?? dates[0] ?? '1970-01-01';
      const until = new Date().toISOString().slice(0, 10);
      process.env.ACTUAL_DATA_DIR = resolve(
        ROOT,
        process.env.ACTUAL_DATA_DIR ?? 'data/actual-cache',
      );

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

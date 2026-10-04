import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { SourceId } from '@moneytree/core';
import { importers } from '@moneytree/importers';
import {
  applySelectedMatches,
  authGmail,
  FETCH_CHANNELS,
  fetchSource,
  importFiles,
  INVOKED_FROM,
  isFetchChannel,
  listSources,
  loadEnv,
  loadPurchases,
  previewMatches,
} from '@moneytree/pipeline';

const USAGE = `Usage:
  moneytree sources                       List sources and how each can be fetched
  moneytree auth gmail                    Authorize read-only Gmail access
  moneytree fetch <source> --via <email|scrape|knot> [--since YYYY-MM-DD]
      Download raw receipts into data/raw/<source>/
  moneytree import <source> <file>...     Add local files (exports, saved JSON) to data/raw
  moneytree parse <source> [file...]      Print purchases as JSON (default: data/raw)
  moneytree sync <source> [file...] [--apply] [--since YYYY-MM-DD]
      Match purchases to bank charges in Actual. Dry run unless --apply.

Run \`yarn ui\` for the web interface.`;

const log = (message: string) => console.log(message);

function isSourceId(value: string): value is SourceId {
  return Object.hasOwn(importers, value);
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
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
    for (const info of await listSources()) {
      const channels = info.channels.map(c =>
        c.canParse ? c.channel : `${c.channel} (parser planned)`,
      );
      console.log(
        `${info.source.padEnd(8)} ${info.description}\n` +
          `         via: ${channels.join(', ')}; ${info.rawDocumentCount} fetched`,
      );
    }
    return;
  }

  if (command === 'auth') {
    if (arg !== 'gmail') throw new Error('Only `auth gmail` is supported.');
    await authGmail(log);
    return;
  }

  if (!command || !['fetch', 'import', 'parse', 'sync'].includes(command)) {
    console.log(USAGE);
    return;
  }
  if (!isSourceId(arg)) {
    throw new Error(`Unknown source "${arg}". Run: moneytree sources`);
  }

  const options = { since: values.since, files, baseDir: INVOKED_FROM };
  switch (command) {
    case 'fetch': {
      const via = values.via ?? '';
      if (!isFetchChannel(via)) {
        throw new Error(`--via must be one of: ${FETCH_CHANNELS.join(', ')}`);
      }
      await fetchSource(arg, via, values.since ?? daysAgo(365), log);
      return;
    }
    case 'import': {
      const paths = files.map(file => resolve(INVOKED_FROM, file));
      console.log(
        `Added ${await importFiles(arg, paths)} files to data/raw/${arg}/.`,
      );
      return;
    }
    case 'parse':
      console.log(
        JSON.stringify(await loadPurchases(arg, files, INVOKED_FROM), null, 2),
      );
      return;
    case 'sync': {
      const review = await previewMatches(arg, options);
      for (const m of review.matches) {
        console.log(
          `${m.bankTransaction.date} ${formatCents(m.bankTransaction.amount)} ` +
            `${m.bankTransaction.payee} <- ${m.purchase.merchant} ` +
            `(${m.purchase.items.length} items, score ${m.score.toFixed(2)})`,
        );
      }
      const total = review.matches.length + review.unmatched.length;
      console.log(`${review.matches.length} of ${total} purchases matched.`);
      if (values.apply) {
        const written = await applySelectedMatches(arg, 'all', options);
        console.log(`Splits written to Actual for ${written} transactions.`);
      } else {
        console.log('Dry run. Re-run with --apply to write splits.');
      }
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

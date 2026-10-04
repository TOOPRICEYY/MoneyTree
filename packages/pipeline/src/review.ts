import { resolve } from 'node:path';

import {
  applyMatches,
  configFromEnv,
  getUnitemizedTransactions,
  toSplitUpdate,
  withBudget,
} from '@moneytree/actual-sync';
import { matchPurchasesToBank, purchaseKey } from '@moneytree/core';
import type {
  IsoDate,
  MatchPreview,
  PurchaseMatch,
  ReviewResult,
  SourceId,
} from '@moneytree/core';

import { ROOT } from './paths.ts';
import { loadPurchases } from './purchases.ts';

// @actual-app/api holds one open budget per process, so every use of it
// goes through this queue.
let actualQueue: Promise<unknown> = Promise.resolve();

function withActual<T>(fn: () => Promise<T>): Promise<T> {
  const config = configFromEnv();
  const run = actualQueue.then(() =>
    withBudget({ ...config, dataDir: resolve(ROOT, config.dataDir) }, fn),
  );
  actualQueue = run.catch(() => undefined);
  return run;
}

export type ReviewOptions = {
  since?: IsoDate;
  files?: string[];
  baseDir?: string;
};

async function computeMatches(
  source: SourceId,
  options: ReviewOptions,
): Promise<{
  since: IsoDate;
  matches: PurchaseMatch[];
  purchases: Awaited<ReturnType<typeof loadPurchases>>;
}> {
  const purchases = await loadPurchases(source, options.files, options.baseDir);
  const oldest = purchases.map(p => p.date).sort()[0];
  const since =
    options.since ?? oldest ?? new Date().toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  const bank = await getUnitemizedTransactions(since, until);
  return { since, purchases, matches: matchPurchasesToBank(purchases, bank) };
}

function toPreview(match: PurchaseMatch): MatchPreview {
  return {
    bankTransaction: match.bankTransaction,
    purchase: match.purchase,
    score: match.score,
    dayDelta: match.dayDelta,
    amountDelta: match.amountDelta,
    splits: toSplitUpdate(match).subtransactions.map(sub => ({
      amount: sub.amount,
      memo: sub.notes,
    })),
  };
}

/** Dry run: which bank charges each purchase would itemize. Writes nothing. */
export function previewMatches(
  source: SourceId,
  options: ReviewOptions = {},
): Promise<ReviewResult> {
  return withActual(async () => {
    const { since, purchases, matches } = await computeMatches(source, options);
    const matched = new Set(matches.map(m => purchaseKey(m.purchase)));
    return {
      since,
      matches: matches.map(toPreview),
      unmatched: purchases.filter(p => !matched.has(purchaseKey(p))),
    };
  });
}

/**
 * Writes splits for the chosen bank transactions only. Matches are
 * recomputed inside the same budget session, so nothing stale is applied.
 */
export function applySelectedMatches(
  source: SourceId,
  bankTransactionIds: string[] | 'all',
  options: ReviewOptions = {},
): Promise<number> {
  return withActual(async () => {
    const { matches } = await computeMatches(source, options);
    const selected =
      bankTransactionIds === 'all'
        ? matches
        : matches.filter(m =>
            bankTransactionIds.includes(m.bankTransaction.id),
          );
    await applyMatches(selected);
    return selected.length;
  });
}

import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

import * as api from '@actual-app/api';
import type { BankTransaction, IsoDate, PurchaseMatch } from '@moneytree/core';

import { isAlreadyItemized, toSplitUpdate } from './toActual.ts';

export type ActualConfig = {
  serverURL: string;
  password: string;
  syncId: string;
  dataDir: string;
};

export function configFromEnv(env = process.env): ActualConfig {
  const required = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`${name} is not set (see .env.example)`);
    return value;
  };
  return {
    serverURL: required('ACTUAL_SERVER_URL'),
    password: required('ACTUAL_PASSWORD'),
    syncId: required('ACTUAL_SYNC_ID'),
    dataDir: env.ACTUAL_DATA_DIR ?? './data/actual-cache',
  };
}

/** Opens the budget, runs `fn`, and always syncs and closes afterwards. */
export async function withBudget<T>(
  config: ActualConfig,
  fn: () => Promise<T>,
): Promise<T> {
  await mkdir(config.dataDir, { recursive: true });
  await api.init({
    serverURL: config.serverURL,
    password: config.password,
    dataDir: config.dataDir,
  });
  try {
    await api.downloadBudget(config.syncId);
    return await fn();
  } finally {
    await api.shutdown();
  }
}

/** Reads on-budget bank transactions that have not been itemized yet. */
export async function getUnitemizedTransactions(
  since: IsoDate,
  until: IsoDate,
): Promise<BankTransaction[]> {
  const accounts = await api.getAccounts();
  const result: BankTransaction[] = [];
  for (const account of accounts) {
    if (account.closed) continue;
    const transactions = await api.getTransactions(account.id, since, until);
    for (const transaction of transactions) {
      if (transaction.is_parent || transaction.is_child) continue;
      if (isAlreadyItemized(transaction.notes ?? undefined)) continue;
      result.push({
        id: transaction.id,
        accountId: account.id,
        date: transaction.date,
        amount: transaction.amount,
        payee: transaction.imported_payee ?? '',
        notes: transaction.notes ?? undefined,
        importedId: transaction.imported_id ?? undefined,
      });
    }
  }
  return result;
}

export async function applyMatches(matches: PurchaseMatch[]): Promise<void> {
  const categories = await api.getCategories();
  const categoryIdByName = new Map(categories.map(c => [c.name, c.id]));
  for (const match of matches) {
    const { accountId, date, id } = match.bankTransaction;
    const update = toSplitUpdate(match, categoryIdByName);
    await api.updateTransaction(id, {
      notes: update.notes,
      // Actual fills child fields from the parent at runtime, but its public
      // type wants complete entities, so pass the parent's account and date.
      subtransactions: update.subtransactions.map(sub => ({
        ...sub,
        id: randomUUID(),
        account: accountId,
        date,
      })),
    });
  }
}

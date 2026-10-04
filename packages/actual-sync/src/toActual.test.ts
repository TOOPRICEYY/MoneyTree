import type { PurchaseMatch } from '@moneytree/core';

import { isAlreadyItemized, toSplitUpdate } from './toActual.ts';

const match: PurchaseMatch = {
  purchase: {
    source: 'amazon',
    externalId: '111-2',
    date: '2026-03-01',
    merchant: 'Amazon',
    total: -2599,
    items: [
      { description: 'USB cable', amount: -999, category: 'Electronics' },
      { description: 'Coffee', amount: -1600 },
    ],
    adjustments: [],
    payments: [],
  },
  bankTransaction: {
    id: 'b1',
    accountId: 'chase',
    date: '2026-03-03',
    amount: -2600,
    payee: 'Amazon',
  },
  score: 0.9,
  dayDelta: 2,
  amountDelta: 1,
};

describe('toSplitUpdate', () => {
  it('balances splits to the bank amount, not the order total', () => {
    const update = toSplitUpdate(match);
    expect(update.subtransactions.reduce((sum, s) => sum + s.amount, 0)).toBe(
      -2600,
    );
  });

  it('maps category names to Actual ids and tags the parent', () => {
    const update = toSplitUpdate(
      match,
      new Map([['Electronics', 'cat-electronics']]),
    );
    expect(update.subtransactions[0]?.category).toBe('cat-electronics');
    expect(update.subtransactions[1]?.category).toBeUndefined();
    expect(isAlreadyItemized(update.notes)).toBe(true);
  });
});

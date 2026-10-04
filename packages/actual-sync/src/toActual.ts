import { purchaseKey, toSplits } from '@moneytree/core';
import type { Cents, PurchaseMatch } from '@moneytree/core';

/** The subset of Actual's transaction fields MoneyTree writes. */
export type ActualSplitUpdate = {
  notes: string;
  subtransactions: {
    amount: Cents;
    notes: string;
    category?: string;
  }[];
};

/**
 * Builds the `api.updateTransaction` payload that turns a matched bank charge
 * into an itemized split. The purchase key goes in the parent's notes so a
 * re-run can tell the charge was already itemized.
 */
export function toSplitUpdate(
  match: PurchaseMatch,
  categoryIdByName: Map<string, string> = new Map(),
): ActualSplitUpdate {
  const { purchase, bankTransaction } = match;
  const splits = toSplits({ ...purchase, total: bankTransaction.amount });

  return {
    notes: [bankTransaction.notes, `#${purchaseKey(purchase)}`]
      .filter(Boolean)
      .join(' '),
    subtransactions: splits.map(split => ({
      amount: split.amount,
      notes: split.memo,
      category: split.category
        ? categoryIdByName.get(split.category)
        : undefined,
    })),
  };
}

export function isAlreadyItemized(notes: string | undefined): boolean {
  return notes?.includes('#moneytree:') ?? false;
}

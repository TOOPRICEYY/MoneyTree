import { allocate } from './money.ts';
import type { Cents, Purchase } from './types.ts';

export type Split = {
  amount: Cents;
  memo: string;
  category?: string;
};

/**
 * Turns a purchase into split lines whose amounts sum exactly to
 * `purchase.total`. Order-level adjustments (tax, shipping, discounts) are
 * spread across items by item value; tax only lands on taxable items when the
 * source says which items are taxable.
 */
export function toSplits(purchase: Purchase): Split[] {
  const { items } = purchase;
  if (items.length === 0) {
    return [{ amount: purchase.total, memo: purchase.merchant }];
  }

  const amounts = items.map(item => item.amount);
  const hasTaxFlags = items.some(item => item.isTaxable !== undefined);

  for (const adjustment of purchase.adjustments) {
    const weights =
      adjustment.kind === 'tax' && hasTaxFlags
        ? items.map(item => (item.isTaxable ? item.amount : 0))
        : amounts;
    const parts = allocate(adjustment.amount, weights);
    parts.forEach((part, index) => {
      amounts[index] = (amounts[index] ?? 0) + part;
    });
  }

  // Whatever the source's own arithmetic leaves over (rounding, unlisted
  // fees) goes on the largest line so the splits always balance.
  const drift = purchase.total - amounts.reduce((sum, a) => sum + a, 0);
  if (drift !== 0) {
    const largest = amounts.reduce(
      (best, amount, index) =>
        Math.abs(amount) > Math.abs(amounts[best] ?? 0) ? index : best,
      0,
    );
    amounts[largest] = (amounts[largest] ?? 0) + drift;
  }

  return items.map((item, index) => ({
    amount: amounts[index] ?? 0,
    memo:
      item.quantity && item.quantity > 1
        ? `${item.description} x${item.quantity}`
        : item.description,
    category: item.category,
  }));
}

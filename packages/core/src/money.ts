import type { Cents } from './types.ts';

/** Converts a decimal amount like `12.34` or `"-5.00"` to integer cents. */
export function toCents(amount: number | string): Cents {
  const value = typeof amount === 'string' ? Number(amount.trim()) : amount;
  if (!Number.isFinite(value)) {
    throw new Error(`Not a finite amount: ${String(amount)}`);
  }
  return Math.round(value * 100);
}

export function fromCents(cents: Cents): number {
  return cents / 100;
}

/**
 * Splits `total` across `weights` proportionally, using the largest remainder
 * method so the parts always sum exactly to `total`. Used to spread tax,
 * shipping and order discounts across line items.
 */
export function allocate(total: Cents, weights: Cents[]): Cents[] {
  if (weights.length === 0) return [];

  const absWeights = weights.map(w => Math.abs(w));
  const weightSum = absWeights.reduce((sum, w) => sum + w, 0);
  if (weightSum === 0) {
    return allocate(
      total,
      weights.map(() => 1),
    );
  }

  const sign = total < 0 ? -1 : 1;
  const magnitude = Math.abs(total);
  const exact = absWeights.map(w => (magnitude * w) / weightSum);
  const parts = exact.map(x => Math.floor(x));
  let remainder = magnitude - parts.reduce((sum, p) => sum + p, 0);

  const byFraction = exact
    .map((x, index) => ({ index, fraction: x - Math.floor(x) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of byFraction) {
    if (remainder === 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    remainder--;
  }

  return parts.map(p => p * sign);
}

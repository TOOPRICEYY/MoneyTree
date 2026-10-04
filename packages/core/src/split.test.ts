import { toSplits } from './split.ts';
import type { Purchase } from './types.ts';

function purchase(overrides: Partial<Purchase>): Purchase {
  return {
    source: 'costco',
    externalId: '1',
    date: '2026-02-09',
    merchant: 'Costco',
    total: 0,
    items: [],
    adjustments: [],
    payments: [],
    ...overrides,
  };
}

describe('toSplits', () => {
  it('puts tax only on taxable items when the source flags them', () => {
    const splits = toSplits(
      purchase({
        total: -2060,
        items: [
          { description: 'ORANGES', amount: -1000, isTaxable: false },
          { description: 'PAPER TOWELS', amount: -1000, isTaxable: true },
        ],
        adjustments: [{ kind: 'tax', amount: -60 }],
      }),
    );
    expect(splits.map(s => s.amount)).toEqual([-1000, -1060]);
  });

  it('balances to the purchase total even when the source does not', () => {
    const splits = toSplits(
      purchase({
        total: -1001,
        items: [
          { description: 'A', amount: -500 },
          { description: 'B', amount: -500 },
        ],
      }),
    );
    expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(-1001);
  });

  it('returns a single line for purchases without items', () => {
    expect(toSplits(purchase({ total: -2060 }))).toEqual([
      { amount: -2060, memo: 'Costco' },
    ]);
  });
});

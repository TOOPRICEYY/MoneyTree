import { toSplits } from '@moneytree/core';

import { parseCostcoReceipts } from './index.ts';

const receipt = {
  barcode: '210000000000000000001',
  date: '2026-02-09T16:46:00',
  warehouse: 'GRAND RAPIDS',
  type: 'In-Warehouse',
  total: 31.48,
  subtotal: 30.88,
  taxes: 0.6,
  items: [
    {
      item_number: '67072',
      description: 'ORANGES',
      amount: 7.89,
      tax_flag: 'N' as const,
      unit: 1,
    },
    {
      item_number: '1971606',
      description: 'GODIVA DARK',
      amount: 14.99,
      tax_flag: 'N' as const,
      unit: 1,
    },
    {
      item_number: '371839',
      description: '/1971606',
      amount: -5,
      tax_flag: null,
      unit: -1,
    },
    {
      item_number: '555',
      description: 'PAPER TOWEL',
      amount: 13,
      tax_flag: 'Y' as const,
      unit: 1,
    },
  ],
  payment: [{ type: 'VISA', amount: 31.48, last4: '1444' }],
};

describe('parseCostcoReceipts', () => {
  it('folds instant savings into the discounted item', () => {
    const [purchase] = parseCostcoReceipts([receipt]);
    expect(purchase?.items.map(i => [i.description, i.amount])).toEqual([
      ['ORANGES', -789],
      ['GODIVA DARK', -999],
      ['PAPER TOWEL', -1300],
    ]);
  });

  it('produces splits that balance to the charged total', () => {
    const [purchase] = parseCostcoReceipts([receipt]);
    if (!purchase) throw new Error('expected a purchase');
    const splits = toSplits(purchase);
    expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(-3148);
    expect(splits.find(s => s.memo === 'PAPER TOWEL')?.amount).toBe(-1360);
  });

  it('handles gas station receipts with no items', () => {
    const [purchase] = parseCostcoReceipts([
      {
        barcode: '2',
        date: '2025-12-14T11:27:00',
        warehouse: 'Grand Rapids',
        type: 'Gas Station',
        total: 20.6,
      },
    ]);
    expect(purchase).toMatchObject({
      merchant: 'Costco Gas',
      total: -2060,
      items: [],
    });
  });
});

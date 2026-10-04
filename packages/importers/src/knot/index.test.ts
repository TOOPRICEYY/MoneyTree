import { toSplits } from '@moneytree/core';

import { parseKnotTransaction } from './index.ts';
import type { KnotTransaction } from './index.ts';

const transaction: KnotTransaction = {
  id: 'knot-1',
  external_id: '111-0000000-0000000',
  datetime: '2026-03-01T10:30:00Z',
  order_status: 'DELIVERED',
  price: {
    sub_total: '30.00',
    total: '29.40',
    adjustments: [
      { type: 'TAX', label: 'Sales Tax', amount: '1.40' },
      { type: 'DISCOUNT', label: 'Coupon', amount: '2.00' },
    ],
  },
  products: [
    { name: 'USB cable', quantity: 2, price: { total: '10.00' } },
    { name: 'Coffee', quantity: 1, price: { total: '20.00' } },
  ],
  payment_methods: [
    {
      type: 'CARD',
      brand: 'VISA',
      last_four: '0000',
      transaction_amount: '29.40',
    },
  ],
};

describe('parseKnotTransaction', () => {
  it('maps products, tax and discounts into a balanced purchase', () => {
    const purchase = parseKnotTransaction(transaction, 'amazon', 'Amazon');
    expect(purchase).toMatchObject({
      externalId: '111-0000000-0000000',
      date: '2026-03-01',
      total: -2940,
      adjustments: [
        { kind: 'tax', amount: -140 },
        { kind: 'discount', amount: 200 },
      ],
    });
    if (!purchase) throw new Error('expected a purchase');
    expect(toSplits(purchase).reduce((sum, s) => sum + s.amount, 0)).toBe(
      -2940,
    );
  });

  it('skips cancelled orders', () => {
    expect(
      parseKnotTransaction(
        { ...transaction, order_status: 'CANCELLED' },
        'amazon',
        'Amazon',
      ),
    ).toBeUndefined();
  });
});

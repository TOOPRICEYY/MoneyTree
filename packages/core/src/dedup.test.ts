import { dedupePurchases, matchPurchasesToBank } from './dedup.ts';
import type { BankTransaction, Purchase } from './types.ts';

function purchase(overrides: Partial<Purchase>): Purchase {
  return {
    source: 'amazon',
    externalId: '111-1',
    date: '2026-03-01',
    merchant: 'Amazon',
    total: -2599,
    items: [],
    adjustments: [],
    payments: [],
    ...overrides,
  };
}

function bank(overrides: Partial<BankTransaction>): BankTransaction {
  return {
    id: 'b1',
    accountId: 'chase',
    date: '2026-03-03',
    amount: -2599,
    payee: 'AMAZON MKTPL*0J35Z0253',
    ...overrides,
  };
}

describe('dedupePurchases', () => {
  it('keeps one copy of a purchase imported twice', () => {
    expect(dedupePurchases([purchase({}), purchase({})])).toHaveLength(1);
  });

  it('drops a receipt photo that duplicates retailer data', () => {
    const result = dedupePurchases([
      purchase({ source: 'costco', merchant: 'Costco Grand Rapids' }),
      purchase({ source: 'receipt', externalId: 'img-1', merchant: 'COSTCO' }),
    ]);
    expect(result.map(p => p.source)).toEqual(['costco']);
  });

  it('keeps receipts that match nothing', () => {
    const result = dedupePurchases([
      purchase({ source: 'receipt', externalId: 'img-1', merchant: 'Meijer' }),
    ]);
    expect(result).toHaveLength(1);
  });
});

describe('matchPurchasesToBank', () => {
  it('matches a charge a few days after the order', () => {
    const [match] = matchPurchasesToBank([purchase({})], [bank({})]);
    expect(match?.bankTransaction.id).toBe('b1');
    expect(match?.dayDelta).toBe(2);
  });

  it('gives each bank charge to the closest purchase only', () => {
    const matches = matchPurchasesToBank(
      [
        purchase({ externalId: 'far', date: '2026-02-26' }),
        purchase({ externalId: 'near', date: '2026-03-03' }),
      ],
      [bank({})],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.purchase.externalId).toBe('near');
  });

  it('scores a payee that names the merchant brand higher', () => {
    const [named] = matchPurchasesToBank(
      [purchase({ merchant: 'Amazon Marketplace' })],
      [bank({})],
    );
    const [unnamed] = matchPurchasesToBank(
      [purchase({ merchant: 'Amazon Marketplace' })],
      [bank({ payee: 'CARD PURCHASE 0J35Z0253' })],
    );
    expect(named?.score).toBeGreaterThan(unnamed?.score ?? 1);
  });

  it('ignores charges outside the amount tolerance', () => {
    expect(
      matchPurchasesToBank([purchase({})], [bank({ amount: -2700 })]),
    ).toEqual([]);
  });
});

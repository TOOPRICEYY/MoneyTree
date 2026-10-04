import { importers } from '@moneytree/importers';

import { quarterWindows, toCostcoReceipt } from './costco.ts';
import type { CostcoApiReceipt } from './costco.ts';

const apiReceipt: CostcoApiReceipt = {
  warehouseName: 'GRAND RAPIDS',
  receiptType: 'In-Warehouse',
  transactionDateTime: '2026-02-09T16:46:00',
  transactionBarcode: '210000000000000000001',
  total: 22.88,
  subTotal: 22.88,
  taxes: 0,
  instantSavings: 5,
  itemArray: [
    {
      itemNumber: '1971606',
      itemDescription01: 'GODIVA DARK',
      amount: 14.99,
      taxFlag: 'N',
      unit: 1,
    },
    {
      itemNumber: '371839',
      itemDescription01: '/1971606',
      amount: -5,
      taxFlag: null,
      unit: -1,
    },
    {
      itemNumber: '67072',
      itemDescription01: 'ORANGES',
      amount: 12.89,
      taxFlag: 'N',
      unit: 1,
    },
  ],
  tenderArray: [
    {
      tenderTypeName: 'VISA',
      amountTender: 22.88,
      displayAccountNumber: '0000',
    },
  ],
};

describe('toCostcoReceipt', () => {
  it('produces the shape the Costco importer parses', async () => {
    const purchases = await importers.costco.parse({
      source: 'costco',
      channel: 'scraper',
      kind: 'json',
      format: 'costco-receipt',
      id: apiReceipt.transactionBarcode,
      fetchedAt: '2026-02-10T00:00:00Z',
      data: toCostcoReceipt(apiReceipt),
    });
    expect(purchases).toHaveLength(1);
    expect(purchases[0]?.total).toBe(-2288);
    expect(purchases[0]?.items.map(i => i.amount)).toEqual([-999, -1289]);
  });
});

describe('quarterWindows', () => {
  it('covers since..today in 3-month windows', () => {
    expect(
      quarterWindows('2026-01-15', new Date('2026-05-10T00:00:00Z')),
    ).toEqual([
      { startDate: '1/15/2026', endDate: '3/31/2026' },
      { startDate: '4/1/2026', endDate: '5/10/2026' },
    ]);
  });
});

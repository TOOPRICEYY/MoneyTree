import { readFile } from 'node:fs/promises';

import { toCents } from '@moneytree/core';
import type { LineItem, Purchase } from '@moneytree/core';

import type { Importer } from '../types.ts';

type CostcoItem = {
  item_number: string;
  description: string;
  amount: number;
  tax_flag: 'Y' | 'N' | null;
  unit: number;
};

type CostcoReceipt = {
  barcode: string;
  date: string;
  warehouse: string;
  type: string;
  total: number;
  taxes?: number;
  items?: CostcoItem[];
  payment?: { type: string; amount: number; last4?: string }[];
};

/**
 * Costco lists instant savings as their own line, described as `/<item
 * number>` of the item they discount. Fold each one into that item so splits
 * show what was actually paid.
 */
function toLineItems(items: CostcoItem[]): LineItem[] {
  const lines = new Map<string, LineItem>();
  const orphanDiscounts: LineItem[] = [];

  for (const item of items) {
    if (item.description.startsWith('/')) continue;
    lines.set(item.item_number, {
      description: item.description,
      amount: -toCents(item.amount),
      quantity: item.unit > 1 ? item.unit : undefined,
      sku: item.item_number,
      isTaxable: item.tax_flag === 'Y',
    });
  }

  for (const item of items) {
    if (!item.description.startsWith('/')) continue;
    const target = lines.get(item.description.slice(1));
    if (target) {
      target.amount -= toCents(item.amount);
    } else {
      orphanDiscounts.push({
        description: `Instant savings ${item.description}`,
        amount: -toCents(item.amount),
        sku: item.item_number,
        isTaxable: false,
      });
    }
  }

  return [...lines.values(), ...orphanDiscounts];
}

export function parseCostcoReceipts(receipts: CostcoReceipt[]): Purchase[] {
  return receipts.map(receipt => ({
    source: 'costco',
    externalId: receipt.barcode,
    date: receipt.date.slice(0, 10),
    merchant: `Costco ${receipt.type === 'Gas Station' ? 'Gas' : receipt.warehouse}`,
    total: -toCents(receipt.total),
    items: toLineItems(receipt.items ?? []),
    adjustments: receipt.taxes
      ? [{ kind: 'tax', amount: -toCents(receipt.taxes) }]
      : [],
    payments: (receipt.payment ?? []).map(payment => ({
      method: payment.type,
      last4: payment.last4,
      amount: -toCents(payment.amount),
    })),
  }));
}

export const costcoImporter: Importer = {
  source: 'costco',
  description:
    'Receipt JSON from the costco.com receipts endpoint (see Accountable extraction tools)',
  parseFile: async path => {
    const json: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(json)) {
      throw new Error(`${path} is not a Costco receipts array`);
    }
    // The endpoint's shape is validated by the fixture tests, not at runtime.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return parseCostcoReceipts(json as CostcoReceipt[]);
  },
};

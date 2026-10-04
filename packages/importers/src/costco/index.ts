import { readFile } from 'node:fs/promises';

import { toCents } from '@moneytree/core';
import type { LineItem, Purchase } from '@moneytree/core';

import type { Importer } from '../types.ts';

export type CostcoItem = {
  item_number: string;
  description: string;
  amount: number;
  tax_flag: 'Y' | 'N' | null;
  unit: number;
};

export type CostcoReceipt = {
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

function asReceipts(data: unknown, origin: string): CostcoReceipt[] {
  const receipts = Array.isArray(data) ? data : [data];
  if (!receipts.every(r => typeof r === 'object' && r && 'barcode' in r)) {
    throw new Error(`${origin} does not contain Costco receipts`);
  }
  // Shape beyond `barcode` is covered by the fixture tests, not at runtime.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return receipts as CostcoReceipt[];
}

export const costcoImporter: Importer = {
  source: 'costco',
  description:
    'Warehouse and gas receipts from the costco.com receipts API (scraper or saved JSON)',
  parse: async doc => {
    switch (doc.kind) {
      case 'file': {
        const json: unknown = JSON.parse(await readFile(doc.path, 'utf8'));
        return parseCostcoReceipts(asReceipts(json, doc.path));
      }
      case 'json':
        return parseCostcoReceipts(asReceipts(doc.data, doc.id));
      case 'email':
        // Costco's emails are marketing and online orders, not warehouse
        // receipts, so the scraper is the only source of itemized data.
        return [];
      default:
        throw new Error('Unknown document kind');
    }
  },
};

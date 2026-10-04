import type { Purchase, RawDocument, SourceId } from '@moneytree/core';

import { amazonImporter } from './amazon/index.ts';
import { appleImporter } from './apple/index.ts';
import { costcoImporter } from './costco/index.ts';
import { ebayImporter } from './ebay/index.ts';
import { parseKnotDocument } from './knot/index.ts';
import { meijerImporter } from './meijer/index.ts';
import { receiptImporter } from './receipt/index.ts';
import type { Importer } from './types.ts';

export const importers: Record<SourceId, Importer> = {
  amazon: amazonImporter,
  apple: appleImporter,
  costco: costcoImporter,
  ebay: ebayImporter,
  meijer: meijerImporter,
  receipt: receiptImporter,
};

/**
 * Parses a raw document from any channel. Aggregator payloads share one
 * format across merchants, so they have their own parser; everything else
 * goes to the source's importer.
 */
export function parseDocument(doc: RawDocument): Promise<Purchase[]> {
  if (doc.kind === 'json' && doc.format === 'knot') {
    return Promise.resolve(parseKnotDocument(doc));
  }
  return importers[doc.source].parse(doc);
}

export { parseCostcoReceipts } from './costco/index.ts';
export type { CostcoItem, CostcoReceipt } from './costco/index.ts';
export type { KnotTransaction } from './knot/index.ts';
export type { Importer } from './types.ts';

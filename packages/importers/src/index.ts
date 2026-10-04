import type { SourceId } from '@moneytree/core';

import { amazonImporter } from './amazon/index.ts';
import { appleImporter } from './apple/index.ts';
import { costcoImporter } from './costco/index.ts';
import { ebayImporter } from './ebay/index.ts';
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

export { parseCostcoReceipts } from './costco/index.ts';
export type { Importer } from './types.ts';

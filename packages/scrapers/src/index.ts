import type { SourceId } from '@moneytree/core';

import { costcoScraper } from './costco.ts';
import { notImplemented } from './notImplemented.ts';
import type { Scraper } from './types.ts';

/**
 * Sources that can be scraped from a logged-in browser session. Planned:
 * - amazon: Your Orders pages and per-order invoices
 * - apple: reportaproblem.apple.com purchase history
 * - meijer: digital receipts on meijer.com
 * - ebay: Purchase history pages
 */
export const scrapers: Partial<Record<SourceId, Scraper>> = {
  costco: costcoScraper,
  amazon: notImplemented('amazon'),
  apple: notImplemented('apple'),
  ebay: notImplemented('ebay'),
  meijer: notImplemented('meijer'),
};

export { withBrowser } from './browser.ts';
export type { BrowserOptions } from './browser.ts';
export { quarterWindows, toCostcoReceipt } from './costco.ts';
export type { ScrapeOptions, Scraper } from './types.ts';

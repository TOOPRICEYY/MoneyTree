import type { IsoDate, RawDocument, SourceId } from '@moneytree/core';

import type { BrowserOptions } from './browser.ts';

export type ScrapeOptions = BrowserOptions & {
  since: IsoDate;
  /** Progress lines for the CLI. */
  log?: (message: string) => void;
};

export type Scraper = {
  source: SourceId;
  /** True while the scraper is a stub. */
  isPlanned?: boolean;
  scrape: (options: ScrapeOptions) => AsyncIterable<RawDocument>;
};

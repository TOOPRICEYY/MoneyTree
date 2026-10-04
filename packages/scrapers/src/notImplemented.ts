import type { SourceId } from '@moneytree/core';

import type { Scraper } from './types.ts';

export function notImplemented(source: SourceId): Scraper {
  return {
    source,
    isPlanned: true,
    // oxlint-disable-next-line require-yield
    async *scrape() {
      throw new Error(`The ${source} scraper is not built yet.`);
    },
  };
}

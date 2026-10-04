import type { ChannelStatus, SourceInfo } from '@moneytree/core';
import { importers } from '@moneytree/importers';

import { canFetch, FETCH_CHANNELS } from './fetch.ts';
import { loadRawDocuments } from './store.ts';

export async function listSources(): Promise<SourceInfo[]> {
  return Promise.all(
    Object.values(importers).map(async importer => {
      const canParse = !importer.isPlanned;
      const channels: ChannelStatus[] = [
        ...FETCH_CHANNELS.filter(channel =>
          canFetch(importer.source, channel),
        ).map(channel => ({
          channel,
          canFetch: true,
          // Knot payloads have their own parser, shared by every merchant.
          canParse: channel === 'knot' || canParse,
        })),
        { channel: 'file', canFetch: false, canParse },
      ];
      const docs = await loadRawDocuments(importer.source);
      const lastFetchedAt = docs
        .map(doc => doc.fetchedAt)
        .sort()
        .at(-1);
      return {
        source: importer.source,
        description: importer.description,
        channels,
        rawDocumentCount: docs.length,
        lastFetchedAt,
      };
    }),
  );
}

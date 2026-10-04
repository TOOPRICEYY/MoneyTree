import { resolve } from 'node:path';

import { dedupePurchases } from '@moneytree/core';
import type { Purchase, RawDocument, SourceId } from '@moneytree/core';
import { parseDocument } from '@moneytree/importers';

import { loadRawDocuments } from './store.ts';

/**
 * Parses a source's purchases. Explicit files win; otherwise everything
 * fetched into data/raw. Documents whose parser isn't built yet are skipped
 * so one stub doesn't hide the purchases other channels produced.
 */
export async function loadPurchases(
  source: SourceId,
  files: string[] = [],
  baseDir = process.cwd(),
): Promise<Purchase[]> {
  const docs: RawDocument[] =
    files.length > 0
      ? files.map(file => ({
          source,
          channel: 'file',
          kind: 'file',
          id: file,
          fetchedAt: new Date().toISOString(),
          path: resolve(baseDir, file),
        }))
      : await loadRawDocuments(source);

  const results = await Promise.allSettled(docs.map(parseDocument));
  const purchases = results.flatMap(result =>
    result.status === 'fulfilled' ? result.value : [],
  );
  if (files.length > 0) {
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }
  return dedupePurchases(purchases).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

import type {
  EmailQuery,
  IsoDate,
  RawDocument,
  SourceId,
} from '@moneytree/core';

import { matchesQuery, toEmailDocument } from './parse.ts';
import type { EmailProvider } from './types.ts';

/** Finds and parses one source's receipt emails from any provider. */
export async function* fetchEmails(
  provider: EmailProvider,
  source: SourceId,
  query: EmailQuery,
  since: IsoDate,
): AsyncGenerator<RawDocument> {
  for await (const email of provider.search(query, since)) {
    const doc = await toEmailDocument(source, email);
    if (doc.kind === 'email' && matchesQuery(doc, query)) yield doc;
  }
}

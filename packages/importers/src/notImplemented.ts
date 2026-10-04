import type { EmailQuery, SourceId } from '@moneytree/core';

import type { Importer } from './types.ts';

/** Placeholder for importers that are planned but not written yet. */
export function notImplemented(
  source: SourceId,
  description: string,
  emailQuery?: EmailQuery,
): Importer {
  return {
    source,
    description,
    emailQuery,
    isPlanned: true,
    parse: doc =>
      Promise.reject(
        new Error(
          `The ${source} parser for ${doc.kind} documents is not built yet.`,
        ),
      ),
  };
}

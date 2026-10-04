import type { SourceId } from '@moneytree/core';

import type { Importer } from './types.ts';

/** Placeholder for importers that are planned but not written yet. */
export function notImplemented(
  source: SourceId,
  description: string,
): Importer {
  return {
    source,
    description,
    parseFile: () =>
      Promise.reject(new Error(`The ${source} importer is not built yet.`)),
  };
}

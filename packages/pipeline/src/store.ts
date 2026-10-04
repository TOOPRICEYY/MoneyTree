import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type { RawDocument, SourceId } from '@moneytree/core';

import { RAW_DIR, STATE_DIR } from './paths.ts';

async function readJson<T>(path: string): Promise<T> {
  const text = await readFile(path, 'utf8');
  // Only reads files this module wrote itself.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return JSON.parse(text) as T;
}

function safeName(id: string): string {
  return id.replace(/[^\w.-]+/g, '_').slice(0, 120);
}

/**
 * Raw documents are kept on disk (gitignored) so parsers can be fixed and
 * re-run without fetching again: data/raw/<source>/<channel>/<id>.json
 */
export async function saveRawDocument(doc: RawDocument): Promise<void> {
  const dir = join(RAW_DIR, doc.source, doc.channel);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, `${safeName(doc.id)}.json`),
    JSON.stringify(doc, null, 2),
  );
}

export async function loadRawDocuments(
  source: SourceId,
): Promise<RawDocument[]> {
  const root = join(RAW_DIR, source);
  const files = await readdir(root, { recursive: true }).catch(() => []);
  const docs = await Promise.all(
    files
      .filter(file => file.endsWith('.json'))
      .map(file => readJson<RawDocument>(join(root, file))),
  );
  return docs;
}

/** Registers local files (exports, saved JSON, photos) as raw documents. */
export async function importFiles(
  source: SourceId,
  paths: string[],
): Promise<number> {
  for (const path of paths) {
    await saveRawDocument({
      source,
      channel: 'file',
      kind: 'file',
      id: basename(path),
      fetchedAt: new Date().toISOString(),
      path,
    });
  }
  return paths.length;
}

/** Small JSON state between runs, e.g. aggregator cursors. */
export async function readState<T>(name: string): Promise<T | undefined> {
  try {
    return await readJson<T>(join(STATE_DIR, `${name}.json`));
  } catch {
    return undefined;
  }
}

export async function writeState(name: string, value: unknown): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(
    join(STATE_DIR, `${name}.json`),
    JSON.stringify(value, null, 2),
  );
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  KNOT_MERCHANT_IDS,
  syncKnotTransactions,
} from '@moneytree/aggregators';
import type { KnotConfig } from '@moneytree/aggregators';
import type {
  FetchChannel,
  IsoDate,
  RawDocument,
  SourceId,
} from '@moneytree/core';
import {
  authorizeGmail,
  fetchEmails,
  gmailProvider,
  imapProvider,
} from '@moneytree/email';
import type { EmailProvider } from '@moneytree/email';
import { importers } from '@moneytree/importers';
import { scrapers } from '@moneytree/scrapers';

import { BROWSER_PROFILE_DIR, CREDENTIALS_DIR } from './paths.ts';
import { readState, saveRawDocument, writeState } from './store.ts';

export const FETCH_CHANNELS: readonly FetchChannel[] = [
  'email',
  'scrape',
  'knot',
];

export type Log = (message: string) => void;

export function isFetchChannel(value: string): value is FetchChannel {
  return FETCH_CHANNELS.some(channel => channel === value);
}

/** Whether `channel` can download data for `source` today. */
export function canFetch(source: SourceId, channel: FetchChannel): boolean {
  switch (channel) {
    case 'email':
      return importers[source].emailQuery !== undefined;
    case 'scrape': {
      const scraper = scrapers[source];
      return scraper !== undefined && !scraper.isPlanned;
    }
    case 'knot':
      return KNOT_MERCHANT_IDS[source] !== undefined;
    default:
      return false;
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

const GMAIL_TOKEN_FILE = join(CREDENTIALS_DIR, 'gmail.json');

export async function authGmail(log: Log): Promise<void> {
  const client = {
    clientId: required('GMAIL_CLIENT_ID'),
    clientSecret: required('GMAIL_CLIENT_SECRET'),
  };
  const refreshToken = await authorizeGmail(client, url => {
    log('Open this URL to let MoneyTree read your Gmail:');
    log(url);
  });
  await mkdir(CREDENTIALS_DIR, { recursive: true });
  await writeFile(GMAIL_TOKEN_FILE, JSON.stringify({ refreshToken }), {
    mode: 0o600,
  });
  log(`Saved Gmail access to ${GMAIL_TOKEN_FILE}`);
}

async function emailProviderFromEnv(): Promise<EmailProvider> {
  const provider = process.env.EMAIL_PROVIDER ?? 'gmail';
  if (provider === 'imap') {
    return imapProvider({
      host: required('IMAP_HOST'),
      port: process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : undefined,
      user: required('IMAP_USER'),
      password: required('IMAP_PASSWORD'),
      mailbox: process.env.IMAP_MAILBOX,
    });
  }
  const saved = await readFile(GMAIL_TOKEN_FILE, 'utf8').catch(() => {
    throw new Error(
      'Gmail is not authorized yet. Use Connect Gmail, or run: yarn moneytree auth gmail',
    );
  });
  // Written by authGmail above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const { refreshToken } = JSON.parse(saved) as { refreshToken: string };
  return gmailProvider({
    clientId: required('GMAIL_CLIENT_ID'),
    clientSecret: required('GMAIL_CLIENT_SECRET'),
    refreshToken,
  });
}

function knotConfigFromEnv(): KnotConfig {
  return {
    clientId: required('KNOT_CLIENT_ID'),
    secret: required('KNOT_SECRET'),
    environment:
      process.env.KNOT_ENV === 'production' ? 'production' : 'development',
    externalUserId: process.env.KNOT_EXTERNAL_USER_ID ?? 'moneytree',
  };
}

async function* documentsFor(
  source: SourceId,
  via: FetchChannel,
  since: IsoDate,
  log: Log,
): AsyncGenerator<RawDocument> {
  if (!canFetch(source, via)) {
    throw new Error(`${source} can't be fetched via ${via} yet`);
  }
  switch (via) {
    case 'email': {
      const { emailQuery } = importers[source];
      if (!emailQuery) return;
      log(`Searching email for ${source} receipts since ${since}`);
      yield* fetchEmails(
        await emailProviderFromEnv(),
        source,
        emailQuery,
        since,
      );
      return;
    }
    case 'scrape': {
      const scraper = scrapers[source];
      if (!scraper) return;
      yield* scraper.scrape({ since, profileDir: BROWSER_PROFILE_DIR, log });
      return;
    }
    case 'knot': {
      const stateKey = `knot-${source}`;
      const state = await readState<{ cursor?: string }>(stateKey);
      log(
        state?.cursor ? 'Syncing new Knot orders' : 'Syncing all Knot orders',
      );
      const result = await syncKnotTransactions(
        knotConfigFromEnv(),
        source,
        state?.cursor,
      );
      yield* result.documents;
      await writeState(stateKey, { cursor: result.cursor });
      return;
    }
    default:
      throw new Error(`Unknown channel ${String(via)}`);
  }
}

/** Fetches raw documents for one source over one channel and saves them. */
export async function fetchSource(
  source: SourceId,
  via: FetchChannel,
  since: IsoDate,
  log: Log = () => undefined,
): Promise<number> {
  let count = 0;
  for await (const doc of documentsFor(source, via, since, log)) {
    await saveRawDocument(doc);
    count++;
    if (count % 25 === 0) log(`Saved ${count} documents so far`);
  }
  log(`Saved ${count} ${source} documents to data/raw/${source}/.`);
  return count;
}

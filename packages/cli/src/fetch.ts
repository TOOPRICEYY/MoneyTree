import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { syncKnotTransactions } from '@moneytree/aggregators';
import type { KnotConfig } from '@moneytree/aggregators';
import type { IsoDate, RawDocument, SourceId } from '@moneytree/core';
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

export const CHANNELS = ['email', 'scrape', 'knot'] as const;
export type Via = (typeof CHANNELS)[number];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

const GMAIL_TOKEN_FILE = join(CREDENTIALS_DIR, 'gmail.json');

export async function authGmail(): Promise<void> {
  const client = {
    clientId: required('GMAIL_CLIENT_ID'),
    clientSecret: required('GMAIL_CLIENT_SECRET'),
  };
  const refreshToken = await authorizeGmail(client, url => {
    console.log(`Open this URL to let MoneyTree read your Gmail:\n\n${url}\n`);
  });
  await mkdir(CREDENTIALS_DIR, { recursive: true });
  await writeFile(GMAIL_TOKEN_FILE, JSON.stringify({ refreshToken }), {
    mode: 0o600,
  });
  console.log(`Saved Gmail access to ${GMAIL_TOKEN_FILE}`);
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
      'Gmail is not authorized yet. Run: yarn moneytree auth gmail',
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
  via: Via,
  since: IsoDate,
): AsyncGenerator<RawDocument> {
  switch (via) {
    case 'email': {
      const { emailQuery } = importers[source];
      if (!emailQuery) throw new Error(`${source} has no email query`);
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
      if (!scraper) throw new Error(`${source} has no scraper`);
      yield* scraper.scrape({
        since,
        profileDir: BROWSER_PROFILE_DIR,
        log: message => console.log(message),
      });
      return;
    }
    case 'knot': {
      const stateKey = `knot-${source}`;
      const state = await readState<{ cursor?: string }>(stateKey);
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
  via: Via,
  since: IsoDate,
): Promise<number> {
  let count = 0;
  for await (const doc of documentsFor(source, via, since)) {
    await saveRawDocument(doc);
    count++;
  }
  return count;
}

import type { EmailQuery, IsoDate } from '@moneytree/core';
import { ImapFlow } from 'imapflow';
import type { SearchObject } from 'imapflow';

import type { EmailProvider } from './types.ts';

export type ImapConfig = {
  host: string;
  port?: number;
  user: string;
  /** For Gmail, iCloud and Zoho, an app password rather than the login. */
  password: string;
  /** Gmail keeps archived mail in `[Gmail]/All Mail`, not `INBOX`. */
  mailbox?: string;
};

/**
 * IMAP can only match one subject string, so this filters on the first
 * subject word; `matchesQuery` applies the rest after download.
 */
export function buildImapSearch(
  query: EmailQuery,
  since: IsoDate,
): SearchObject {
  const senders = query.from.map(from => ({ from }));
  return {
    since: new Date(`${since}T00:00:00Z`),
    ...(senders.length > 1 ? { or: senders } : senders[0]),
    ...(query.subject?.[0] ? { subject: query.subject[0] } : {}),
  };
}

/** Works with any IMAP mailbox: Gmail, iCloud, Zoho, Outlook. */
export function imapProvider(config: ImapConfig): EmailProvider {
  return {
    name: 'imap',
    async *search(query, since) {
      const client = new ImapFlow({
        host: config.host,
        port: config.port ?? 993,
        secure: true,
        auth: { user: config.user, pass: config.password },
        logger: false,
      });
      await client.connect();
      const lock = await client.getMailboxLock(config.mailbox ?? 'INBOX');
      try {
        const uids = await client.search(buildImapSearch(query, since), {
          uid: true,
        });
        if (!uids || uids.length === 0) return;
        for await (const message of client.fetch(
          uids,
          { source: true },
          { uid: true },
        )) {
          if (message.source) {
            yield { providerId: String(message.uid), source: message.source };
          }
        }
      } finally {
        lock.release();
        await client.logout();
      }
    },
  };
}

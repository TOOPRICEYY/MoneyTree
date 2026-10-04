import type { EmailQuery, IsoDate } from '@moneytree/core';

export type RawEmail = {
  /** Provider-specific id, used only when the message has no Message-ID. */
  providerId: string;
  /** The full RFC 822 message. */
  source: Buffer;
};

/**
 * A mailbox MoneyTree can search. Providers only find and download messages;
 * parsing is shared, so Gmail and IMAP produce identical documents.
 */
export type EmailProvider = {
  name: string;
  search: (query: EmailQuery, since: IsoDate) => AsyncIterable<RawEmail>;
};

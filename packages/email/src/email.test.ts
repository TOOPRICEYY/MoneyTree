import type { EmailQuery } from '@moneytree/core';

import { fetchEmails } from './fetchEmails.ts';
import { buildGmailQuery } from './gmail.ts';
import { buildImapSearch } from './imap.ts';
import { matchesQuery } from './parse.ts';
import type { EmailProvider } from './types.ts';

const appleQuery: EmailQuery = {
  from: ['no_reply@email.apple.com'],
  subject: ['receipt'],
};

function rfc822(from: string, subject: string, body: string) {
  return Buffer.from(
    [
      `From: Sender <${from}>`,
      'To: me@example.com',
      `Subject: ${subject}`,
      'Date: Fri, 02 Oct 2026 23:08:05 +0000',
      `Message-ID: <${subject.replaceAll(' ', '-')}@example.com>`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n'),
  );
}

describe('buildGmailQuery', () => {
  it('combines senders, subject words and the start date', () => {
    expect(
      buildGmailQuery(
        {
          from: ['auto-confirm@amazon.com', 'shipment-tracking@amazon.com'],
          subject: ['order'],
        },
        '2026-01-31',
      ),
    ).toBe(
      'from:(auto-confirm@amazon.com OR shipment-tracking@amazon.com) subject:(order) after:2026/01/31',
    );
  });
});

describe('buildImapSearch', () => {
  it('uses OR only when there are several senders', () => {
    expect(buildImapSearch(appleQuery, '2026-01-31')).toEqual({
      since: new Date('2026-01-31T00:00:00Z'),
      from: 'no_reply@email.apple.com',
      subject: 'receipt',
    });
    expect(
      buildImapSearch({ from: ['a@x.com', 'b@x.com'] }, '2026-01-31'),
    ).toMatchObject({ or: [{ from: 'a@x.com' }, { from: 'b@x.com' }] });
  });
});

describe('matchesQuery', () => {
  it('matches exact addresses and whole domains', () => {
    expect(
      matchesQuery(
        {
          from: 'no_reply@email.apple.com',
          subject: 'Your receipt from Apple',
        },
        appleQuery,
      ),
    ).toBe(true);
    expect(
      matchesQuery(
        { from: 'receipts@email.meijer.com', subject: 'Receipt' },
        { from: ['meijer.com'] },
      ),
    ).toBe(true);
    expect(
      matchesQuery(
        { from: 'seller@members.ebay.com.hk', subject: 'Order' },
        { from: ['ebay@ebay.com'] },
      ),
    ).toBe(false);
  });

  it('requires every subject word', () => {
    expect(
      matchesQuery(
        { from: 'no_reply@email.apple.com', subject: 'Your Apple Account' },
        appleQuery,
      ),
    ).toBe(false);
  });
});

describe('fetchEmails', () => {
  it('parses provider messages and drops ones that miss the query', async () => {
    const provider: EmailProvider = {
      name: 'fake',
      async *search() {
        yield {
          providerId: '1',
          source: rfc822(
            'no_reply@email.apple.com',
            'Your receipt from Apple',
            'iCloud+ $2.99',
          ),
        };
        yield {
          providerId: '2',
          source: rfc822(
            'no_reply@email.apple.com',
            'Your Apple Account',
            'Sign-in',
          ),
        };
      },
    };
    const docs = [];
    for await (const doc of fetchEmails(
      provider,
      'apple',
      appleQuery,
      '2026-01-01',
    )) {
      docs.push(doc);
    }
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      source: 'apple',
      channel: 'email',
      kind: 'email',
      id: '<Your-receipt-from-Apple@example.com>',
      subject: 'Your receipt from Apple',
    });
  });
});

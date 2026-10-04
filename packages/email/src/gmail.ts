import type { EmailQuery, IsoDate } from '@moneytree/core';

import type { EmailProvider } from './types.ts';

export type GmailCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type Fetch = typeof fetch;

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** `from:(a OR b) subject:(x y) after:2026/01/31` */
export function buildGmailQuery(query: EmailQuery, since: IsoDate): string {
  const parts = [`from:(${query.from.join(' OR ')})`];
  if (query.subject?.length) parts.push(`subject:(${query.subject.join(' ')})`);
  parts.push(`after:${since.replaceAll('-', '/')}`);
  return parts.join(' ');
}

async function getJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(
      `Gmail API ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  // Response shapes come from the Gmail API reference.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await response.json()) as T;
}

export async function getGmailAccessToken(
  credentials: GmailCredentials,
  fetchFn: Fetch = fetch,
): Promise<string> {
  const response = await fetchFn('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const { access_token } = await getJson<{ access_token: string }>(response);
  return access_token;
}

/** Read-only Gmail access through the REST API (scope `gmail.readonly`). */
export function gmailProvider(
  credentials: GmailCredentials,
  fetchFn: Fetch = fetch,
): EmailProvider {
  return {
    name: 'gmail',
    async *search(query, since) {
      const token = await getGmailAccessToken(credentials, fetchFn);
      const headers = { Authorization: `Bearer ${token}` };
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          q: buildGmailQuery(query, since),
          maxResults: '100',
        });
        if (pageToken) params.set('pageToken', pageToken);
        const page = await getJson<{
          messages?: { id: string }[];
          nextPageToken?: string;
        }>(await fetchFn(`${API}/messages?${params.toString()}`, { headers }));

        for (const { id } of page.messages ?? []) {
          const message = await getJson<{ raw: string }>(
            await fetchFn(`${API}/messages/${id}?format=raw`, { headers }),
          );
          yield {
            providerId: id,
            source: Buffer.from(message.raw, 'base64url'),
          };
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
    },
  };
}

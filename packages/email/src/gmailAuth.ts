import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export type GmailClient = { clientId: string; clientSecret: string };

/**
 * Runs Google's installed-app OAuth flow on a loopback port and returns a
 * refresh token. `showUrl` gets the consent URL to open in a browser.
 */
export async function authorizeGmail(
  client: GmailClient,
  showUrl: (url: string) => void,
): Promise<string> {
  const state = randomBytes(16).toString('hex');
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  // listen() on a TCP port always reports an AddressInfo.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const { port } = server.address() as AddressInfo;
  const redirectUri = `http://127.0.0.1:${port}`;

  const code = await new Promise<string>((resolve, reject) => {
    server.on('request', (request, response) => {
      const url = new URL(request.url ?? '/', redirectUri);
      const returned = url.searchParams.get('code');
      if (url.searchParams.get('state') !== state || !returned) {
        response.end('Authorization failed. You can close this tab.');
        reject(
          new Error(url.searchParams.get('error') ?? 'Authorization failed'),
        );
        return;
      }
      response.end(
        'MoneyTree can now read your Gmail. You can close this tab.',
      );
      resolve(returned);
    });
    const params = new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    showUrl(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    );
  }).finally(() => server.close());

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${await response.text()}`);
  }
  // Shape from Google's OAuth token endpoint reference.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const { refresh_token } = (await response.json()) as {
    refresh_token?: string;
  };
  if (!refresh_token) throw new Error('Google did not return a refresh token');
  return refresh_token;
}

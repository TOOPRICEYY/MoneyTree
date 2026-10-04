import type {
  FetchChannel,
  IsoDate,
  Job,
  Purchase,
  ReviewResult,
  SourceId,
  SourceInfo,
} from '@moneytree/core';

/**
 * Everything the UI needs from a backend. The standalone app uses
 * `createHttpClient` against the MoneyTree server; an Actual extension can
 * supply its own, e.g. doing review/apply through Actual's in-app API while
 * still sending fetches (which need Node) to the MoneyTree server.
 */
export type MoneyTreeClient = {
  sources: () => Promise<SourceInfo[]>;
  purchases: (source: SourceId) => Promise<Purchase[]>;
  review: (source: SourceId, since?: IsoDate) => Promise<ReviewResult>;
  apply: (
    source: SourceId,
    bankTransactionIds: string[],
    since?: IsoDate,
  ) => Promise<{ written: number }>;
  fetch: (source: SourceId, via: FetchChannel, since?: IsoDate) => Promise<Job>;
  connectGmail: () => Promise<Job>;
  jobs: () => Promise<Job[]>;
};

function errorMessage(body: unknown): string | undefined {
  if (typeof body === 'object' && body && 'error' in body) {
    return typeof body.error === 'string' ? body.error : undefined;
  }
  return undefined;
}

/** Talks to the MoneyTree server's JSON API (see packages/server). */
export function createHttpClient(
  baseUrl = '/api',
  fetchFn: typeof fetch = (...args) => fetch(...args),
): MoneyTreeClient {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    const response = await fetchFn(`${baseUrl}${path}`, { ...init, headers });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new Error(
        errorMessage(body) ?? `Request failed (${response.status})`,
      );
    }
    // Response shapes are defined by the server in @moneytree/core's api.ts.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return body as T;
  }

  function post<T>(path: string, body: object = {}): Promise<T> {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  return {
    sources: () => request('/sources'),
    purchases: source => request(`/sources/${source}/purchases`),
    review: (source, since) =>
      request(`/sources/${source}/review${since ? `?since=${since}` : ''}`),
    apply: (source, bankTransactionIds, since) =>
      post(`/sources/${source}/apply`, { bankTransactionIds, since }),
    fetch: (source, via, since) =>
      post(`/sources/${source}/fetch`, { via, since }),
    connectGmail: () => post('/auth/gmail'),
    jobs: () => request('/jobs'),
  };
}

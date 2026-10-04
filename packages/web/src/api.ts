import type {
  FetchChannel,
  IsoDate,
  Job,
  Purchase,
  ReviewResult,
  SourceId,
  SourceInfo,
} from '@moneytree/core';

function errorMessage(body: unknown): string | undefined {
  if (typeof body === 'object' && body && 'error' in body) {
    return typeof body.error === 'string' ? body.error : undefined;
  }
  return undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...init, headers });
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

export const api = {
  sources: () => request<SourceInfo[]>('/sources'),
  purchases: (source: SourceId) =>
    request<Purchase[]>(`/sources/${source}/purchases`),
  review: (source: SourceId, since?: IsoDate) =>
    request<ReviewResult>(
      `/sources/${source}/review${since ? `?since=${since}` : ''}`,
    ),
  apply: (source: SourceId, bankTransactionIds: string[], since?: IsoDate) =>
    post<{ written: number }>(`/sources/${source}/apply`, {
      bankTransactionIds,
      since,
    }),
  fetch: (source: SourceId, via: FetchChannel, since?: IsoDate) =>
    post<Job>(`/sources/${source}/fetch`, { via, since }),
  connectGmail: () => post<Job>('/auth/gmail'),
  jobs: () => request<Job[]>('/jobs'),
};

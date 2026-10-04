import type { Purchase, ReviewResult } from '@moneytree/core';

import { createApp } from './app.ts';
import type { Pipeline } from './app.ts';

const purchase: Purchase = {
  source: 'costco',
  externalId: '1',
  date: '2026-02-09',
  merchant: 'Costco',
  total: -1000,
  items: [],
  adjustments: [],
  payments: [],
};

async function json<T>(response: Response): Promise<T> {
  // Test-only: the shapes are asserted right after.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await response.json()) as T;
}

function fakePipeline(overrides: Partial<Pipeline> = {}): Pipeline {
  return {
    listSources: () => Promise.resolve([]),
    loadPurchases: () => Promise.resolve([purchase]),
    previewMatches: (): Promise<ReviewResult> =>
      Promise.resolve({
        since: '2026-01-01',
        matches: [],
        unmatched: [purchase],
      }),
    applySelectedMatches: (_source, ids) => Promise.resolve(ids.length),
    fetchSource: () => Promise.resolve(0),
    authGmail: () => Promise.resolve(),
    ...overrides,
  };
}

describe('API', () => {
  it('lists purchases for a known source', async () => {
    const res = await createApp(fakePipeline()).request(
      '/api/sources/costco/purchases',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([purchase]);
  });

  it('404s unknown sources', async () => {
    const res = await createApp(fakePipeline()).request(
      '/api/sources/target/purchases',
    );
    expect(res.status).toBe(404);
  });

  it('applies only the selected bank transactions', async () => {
    const res = await createApp(fakePipeline()).request(
      '/api/sources/costco/apply',
      {
        method: 'POST',
        body: JSON.stringify({ bankTransactionIds: ['a', 'b'] }),
      },
    );
    expect(await res.json()).toEqual({ written: 2 });
  });

  it('rejects an apply without ids', async () => {
    const res = await createApp(fakePipeline()).request(
      '/api/sources/costco/apply',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(400);
  });

  it('runs fetches as jobs and reports their log', async () => {
    const app = createApp(
      fakePipeline({
        fetchSource: (_source, _via, _since, log) => {
          log('Saved 3 documents');
          return Promise.resolve(3);
        },
      }),
    );
    const started = await app.request('/api/sources/costco/fetch', {
      method: 'POST',
      body: JSON.stringify({ via: 'scrape' }),
    });
    expect(started.status).toBe(202);
    const { id } = await json<{ id: string }>(started);
    await new Promise(resolve => setTimeout(resolve, 0));
    const job = await json<{ status: string; log: string[] }>(
      await app.request(`/api/jobs/${id}`),
    );
    expect(job).toMatchObject({ status: 'done', log: ['Saved 3 documents'] });
  });

  it('surfaces pipeline errors as JSON', async () => {
    const app = createApp(
      fakePipeline({
        previewMatches: () =>
          Promise.reject(new Error('ACTUAL_PASSWORD is not set')),
      }),
    );
    const res = await app.request('/api/sources/costco/review');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'ACTUAL_PASSWORD is not set' });
  });
});

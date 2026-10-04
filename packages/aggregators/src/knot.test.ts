import { syncKnotTransactions } from './knot.ts';
import type { KnotConfig } from './knot.ts';

const config: KnotConfig = {
  clientId: 'id',
  secret: 'secret',
  environment: 'development',
  externalUserId: 'me',
};

function fakeKnot(
  pages: { transactions: { id: string }[]; next_cursor: string | null }[],
) {
  const bodies: unknown[] = [];
  const fetchFn = (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(typeof init?.body === 'string' ? init.body : ''));
    const page = pages.shift();
    return Promise.resolve(new Response(JSON.stringify(page)));
  };
  return { bodies, fetchFn: fetchFn as typeof fetch };
}

describe('syncKnotTransactions', () => {
  it('follows cursors until the last page and returns the final cursor', async () => {
    const { bodies, fetchFn } = fakeKnot([
      { transactions: [{ id: 'a' }, { id: 'b' }], next_cursor: 'c1' },
      { transactions: [{ id: 'c' }], next_cursor: 'c2' },
      { transactions: [], next_cursor: 'c2' },
    ]);
    const result = await syncKnotTransactions(
      config,
      'amazon',
      undefined,
      fetchFn,
    );
    expect(result.documents.map(d => d.id)).toEqual(['a', 'b', 'c']);
    expect(result.cursor).toBe('c2');
    expect(bodies[0]).toEqual({
      merchant_id: 44,
      external_user_id: 'me',
      limit: 100,
    });
    expect(bodies[1]).toMatchObject({ cursor: 'c1' });
  });

  it('rejects sources Knot does not cover', async () => {
    await expect(
      syncKnotTransactions(config, 'meijer', undefined),
    ).rejects.toThrow(/no merchant id/);
  });
});

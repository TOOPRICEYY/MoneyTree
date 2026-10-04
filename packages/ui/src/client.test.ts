import { createHttpClient } from './client.ts';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url:
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      init,
    });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

describe('createHttpClient', () => {
  it('prefixes the base URL so hosts can mount the API anywhere', async () => {
    const { calls, fetchFn } = fakeFetch(200, { written: 2 });
    const client = createHttpClient('http://127.0.0.1:5007/api', fetchFn);
    await client.apply('costco', ['a', 'b']);
    expect(calls[0]?.url).toBe(
      'http://127.0.0.1:5007/api/sources/costco/apply',
    );
    expect(calls[0]?.init?.method).toBe('POST');
  });

  it('surfaces server error messages', async () => {
    const { fetchFn } = fakeFetch(500, { error: 'ACTUAL_PASSWORD is not set' });
    await expect(createHttpClient('/api', fetchFn).sources()).rejects.toThrow(
      'ACTUAL_PASSWORD is not set',
    );
  });
});

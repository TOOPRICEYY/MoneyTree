import { parseHostMessage, postToHost } from './bridge.ts';
import { embedHref, parseEmbedPath } from './embedRoute.ts';

const allowed = ['http://localhost:5006'];

describe('parseHostMessage', () => {
  it('accepts theme vars from an allowed origin and drops non-variables', () => {
    expect(
      parseHostMessage(
        {
          origin: 'http://localhost:5006',
          data: {
            source: 'actual',
            type: 'theme',
            vars: { '--color-pageText': '#111', color: 'red', '--n': 3 },
          },
        },
        allowed,
      ),
    ).toEqual({
      source: 'actual',
      type: 'theme',
      vars: { '--color-pageText': '#111' },
    });
  });

  it('ignores other origins and other senders', () => {
    const data = { source: 'actual', type: 'navigate', path: '/sources' };
    expect(
      parseHostMessage({ origin: 'https://evil.example', data }, allowed),
    ).toBeUndefined();
    expect(
      parseHostMessage(
        {
          origin: 'http://localhost:5006',
          data: { ...data, source: 'moneytree' },
        },
        allowed,
      ),
    ).toBeUndefined();
  });
});

describe('postToHost', () => {
  it('targets only the known host once it has spoken', () => {
    const sent: string[] = [];
    const target = {
      postMessage: (_m: unknown, origin: string) => {
        sent.push(origin);
      },
    };
    postToHost(
      { source: 'moneytree', type: 'ready' },
      undefined,
      ['a', 'b'],
      target,
    );
    postToHost(
      { source: 'moneytree', type: 'budget-changed' },
      'a',
      ['a', 'b'],
      target,
    );
    expect(sent).toEqual(['a', 'b', 'a']);
  });
});

describe('embed paths', () => {
  it('round-trips routes under /embed', () => {
    expect(embedHref({ page: 'review', source: 'costco' })).toBe(
      '/embed/review/costco',
    );
    expect(parseEmbedPath('/embed/purchases/apple')).toEqual({
      page: 'purchases',
      source: 'apple',
    });
    expect(parseEmbedPath('/embed/')).toEqual({ page: 'sources' });
  });
});

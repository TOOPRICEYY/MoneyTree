import { parseRoute, routeHref } from './route.ts';

describe('parseRoute', () => {
  it('round-trips routes through the hash', () => {
    for (const route of [
      { page: 'sources' as const },
      { page: 'purchases' as const, source: 'apple' as const },
      { page: 'review' as const, source: 'costco' as const },
    ]) {
      expect(parseRoute(routeHref(route))).toEqual(route);
    }
  });

  it('falls back to safe defaults', () => {
    expect(parseRoute('')).toEqual({ page: 'sources' });
    expect(parseRoute('#/review/target')).toEqual({
      page: 'review',
      source: 'costco',
    });
  });
});

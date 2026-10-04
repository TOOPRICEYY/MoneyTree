import { useSyncExternalStore } from 'react';

import { isSourceId } from '@moneytree/core';
import type { SourceId } from '@moneytree/core';

export type Route =
  | { page: 'sources' }
  | { page: 'purchases'; source: SourceId }
  | { page: 'review'; source: SourceId };

export function parseRoute(hash: string): Route {
  const [page, source = ''] = hash.replace(/^#\/?/, '').split('/');
  const validSource = isSourceId(source) ? source : 'costco';
  if (page === 'purchases') return { page, source: validSource };
  if (page === 'review') return { page, source: validSource };
  return { page: 'sources' };
}

export function routeHref(route: Route): string {
  return route.page === 'sources'
    ? '#/sources'
    : `#/${route.page}/${route.source}`;
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** Hash routing keeps the server's static fallback trivial. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseRoute(hash);
}

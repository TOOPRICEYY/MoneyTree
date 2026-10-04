import { useSyncExternalStore } from 'react';

import { isSourceId } from '@moneytree/core';
import type { MoneyTreeRoute } from '@moneytree/ui';

export function parseRoute(hash: string): MoneyTreeRoute {
  const [page, source = ''] = hash.replace(/^#\/?/, '').split('/');
  const validSource = isSourceId(source) ? source : 'costco';
  if (page === 'purchases') return { page, source: validSource };
  if (page === 'review') return { page, source: validSource };
  return { page: 'sources' };
}

/** The standalone app's `linkTo`: hash URLs keep the server fallback trivial. */
export function routeHref(route: MoneyTreeRoute): string {
  return route.page === 'sources'
    ? '#/sources'
    : `#/${route.page}/${route.source}`;
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): MoneyTreeRoute {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseRoute(hash);
}

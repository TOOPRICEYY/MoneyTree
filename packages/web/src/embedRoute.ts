import { useSyncExternalStore } from 'react';

import type { MoneyTreeRoute } from '@moneytree/ui';

import { parseRoute } from './route.ts';

export const EMBED_PREFIX = '/embed';

/** Path relative to /embed, as exchanged with the host: `/review/costco`. */
export function embedPath(route: MoneyTreeRoute): string {
  return route.page === 'sources'
    ? '/sources'
    : `/${route.page}/${route.source}`;
}

export function embedHref(route: MoneyTreeRoute): string {
  return EMBED_PREFIX + embedPath(route);
}

export function parseEmbedPath(pathname: string): MoneyTreeRoute {
  const relative = pathname.startsWith(EMBED_PREFIX)
    ? pathname.slice(EMBED_PREFIX.length)
    : pathname;
  return parseRoute(`#${relative}`);
}

const CHANGE = 'moneytree:navigate';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

export function useEmbedRoute(): MoneyTreeRoute {
  const pathname = useSyncExternalStore(
    subscribe,
    () => window.location.pathname,
  );
  return parseEmbedPath(pathname);
}

/** Client-side navigation inside the frame; returns false if unchanged. */
export function navigateEmbed(path: string): boolean {
  const target = EMBED_PREFIX + (path.startsWith('/') ? path : `/${path}`);
  if (target === window.location.pathname) return false;
  window.history.pushState(null, '', target);
  window.dispatchEvent(new Event(CHANGE));
  return true;
}

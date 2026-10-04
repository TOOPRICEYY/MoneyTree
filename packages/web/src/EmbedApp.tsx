import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';

import {
  ActivityPanel,
  createHttpClient,
  MoneyTreeProvider,
  PurchasesView,
  ReviewView,
  SourcesView,
} from '@moneytree/ui';

import {
  applyThemeVars,
  parseHostMessage,
  postToHost,
  readAllowedOrigins,
} from './bridge.ts';
import {
  EMBED_PREFIX,
  embedHref,
  navigateEmbed,
  useEmbedRoute,
} from './embedRoute.ts';

const client = createHttpClient('/api');
const allowedOrigins = readAllowedOrigins();

/**
 * The UI as Actual hosts it: no sidebar, paths under /embed, Actual's theme
 * variables applied on :root, and navigation mirrored to the host.
 */
export function EmbedApp() {
  const route = useEmbedRoute();
  const hostOrigin = useRef<string | undefined>(undefined);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const message = parseHostMessage(event, allowedOrigins);
      if (!message) return;
      hostOrigin.current = event.origin;
      if (message.type === 'navigate') {
        navigateEmbed(message.path);
      } else {
        applyThemeVars(message.vars);
      }
    }
    window.addEventListener('message', onMessage);
    postToHost(
      { source: 'moneytree', type: 'ready' },
      undefined,
      allowedOrigins,
    );
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Keep links inside the frame and tell the host the new path.
  function onClickCapture(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const target = event.target;
    const anchor = target instanceof Element ? target.closest('a') : null;
    const href = anchor?.getAttribute('href');
    if (!href?.startsWith(`${EMBED_PREFIX}/`) || anchor?.target) return;
    event.preventDefault();
    const path = href.slice(EMBED_PREFIX.length);
    if (navigateEmbed(path)) {
      postToHost(
        { source: 'moneytree', type: 'navigate', path },
        hostOrigin.current,
        allowedOrigins,
      );
    }
  }

  return (
    <MoneyTreeProvider
      client={client}
      linkTo={embedHref}
      onBudgetChanged={() =>
        postToHost(
          { source: 'moneytree', type: 'budget-changed' },
          hostOrigin.current,
          allowedOrigins,
        )
      }
    >
      {/* Click handling only intercepts links; keyboard users activate the same anchors. */}
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className="embed-content" onClickCapture={onClickCapture}>
        {route.page === 'sources' && <SourcesView />}
        {route.page === 'purchases' && <PurchasesView source={route.source} />}
        {route.page === 'review' && <ReviewView source={route.source} />}
      </div>
      <ActivityPanel />
    </MoneyTreeProvider>
  );
}

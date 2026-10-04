import type { SourceId } from '@moneytree/core';

/** Screens the UI links between. The host decides what URLs they map to. */
export type MoneyTreeRoute =
  | { page: 'sources' }
  | { page: 'purchases'; source: SourceId }
  | { page: 'review'; source: SourceId };

/** Returns the href for a route in the host's router. */
export type LinkTo = (route: MoneyTreeRoute) => string;

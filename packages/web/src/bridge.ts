// postMessage bridge between the embedded MoneyTree UI and its host (Actual).
// Every message is { source: 'moneytree' | 'actual', type, ... }; messages
// are accepted only from the origins the server lists as allowed.

export type HostMessage =
  | { source: 'actual'; type: 'init' | 'theme'; vars: Record<string, string> }
  | { source: 'actual'; type: 'navigate'; path: string };

export type ChildMessage =
  | { source: 'moneytree'; type: 'ready' }
  | { source: 'moneytree'; type: 'navigate'; path: string }
  | { source: 'moneytree'; type: 'budget-changed' };

/** Origins the server allows to embed this UI, from a meta tag it injects. */
export function readAllowedOrigins(doc: Document = document): string[] {
  const content =
    doc
      .querySelector('meta[name="moneytree-allowed-origins"]')
      ?.getAttribute('content') ?? '';
  return content
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

export function parseHostMessage(
  event: Pick<MessageEvent, 'origin' | 'data'>,
  allowedOrigins: readonly string[],
): HostMessage | undefined {
  if (!allowedOrigins.includes(event.origin)) return undefined;
  const data: unknown = event.data;
  if (typeof data !== 'object' || data === null) return undefined;
  if (!('source' in data) || data.source !== 'actual' || !('type' in data)) {
    return undefined;
  }
  if ((data.type === 'init' || data.type === 'theme') && 'vars' in data) {
    const vars = data.vars;
    if (typeof vars !== 'object' || vars === null) return undefined;
    // Only CSS custom properties with string values are applied.
    const safe = Object.fromEntries(
      Object.entries(vars).filter(
        (entry): entry is [string, string] =>
          entry[0].startsWith('--') && typeof entry[1] === 'string',
      ),
    );
    return { source: 'actual', type: data.type, vars: safe };
  }
  if (
    data.type === 'navigate' &&
    'path' in data &&
    typeof data.path === 'string'
  ) {
    return { source: 'actual', type: 'navigate', path: data.path };
  }
  return undefined;
}

export function applyThemeVars(
  vars: Record<string, string>,
  root: HTMLElement = document.documentElement,
) {
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

/**
 * Sends to the host. Until the host has spoken, the message goes to every
 * allowed origin; the browser drops copies whose origin doesn't match.
 */
export function postToHost(
  message: ChildMessage,
  hostOrigin: string | undefined,
  allowedOrigins: readonly string[],
  target: {
    postMessage: (message: unknown, targetOrigin: string) => void;
  } = window.parent,
) {
  for (const origin of hostOrigin ? [hostOrigin] : allowedOrigins) {
    target.postMessage(message, origin);
  }
}

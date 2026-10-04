import type { RawDocument, SourceId } from '@moneytree/core';

// Knot (knotapi.com) TransactionLink returns SKU-level order history from
// merchant accounts the user links: products, quantities, prices, tax,
// discounts and the card used. Requires a Knot client id and secret.
// Docs: https://docs.knotapi.com/api-reference/products/transaction-link/sync

export type KnotConfig = {
  clientId: string;
  secret: string;
  environment: 'development' | 'production';
  /** Your id for the user in Knot; any stable string for a personal setup. */
  externalUserId: string;
};

export const KNOT_MERCHANT_IDS: Partial<Record<SourceId, number>> = {
  amazon: 44,
  costco: 165,
};

type Fetch = typeof fetch;

type KnotSyncResponse = {
  transactions: { id: string; external_id?: string }[];
  next_cursor: string | null;
};

async function knotPost<T>(
  config: KnotConfig,
  path: string,
  body: object,
  fetchFn: Fetch,
): Promise<T> {
  const auth = Buffer.from(`${config.clientId}:${config.secret}`).toString(
    'base64',
  );
  const response = await fetchFn(
    `https://${config.environment}.knotapi.com${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Knot-Version': '2.0',
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Knot ${path} ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }
  // Shapes from the Knot API reference.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await response.json()) as T;
}

export type KnotSyncResult = {
  documents: RawDocument[];
  /** Store this and pass it next time to receive only new orders. */
  cursor: string | undefined;
};

/** Pages through `POST /transactions/sync` from `cursor` to the end. */
export async function syncKnotTransactions(
  config: KnotConfig,
  source: SourceId,
  cursor: string | undefined,
  fetchFn: Fetch = fetch,
): Promise<KnotSyncResult> {
  const merchantId = KNOT_MERCHANT_IDS[source];
  if (merchantId === undefined) {
    throw new Error(`Knot has no merchant id configured for ${source}`);
  }

  const documents: RawDocument[] = [];
  let next = cursor;
  for (;;) {
    const page = await knotPost<KnotSyncResponse>(
      config,
      '/transactions/sync',
      {
        merchant_id: merchantId,
        external_user_id: config.externalUserId,
        limit: 100,
        ...(next ? { cursor: next } : {}),
      },
      fetchFn,
    );
    for (const transaction of page.transactions) {
      documents.push({
        source,
        channel: 'aggregator',
        kind: 'json',
        format: 'knot',
        id: transaction.external_id ?? transaction.id,
        fetchedAt: new Date().toISOString(),
        data: transaction,
      });
    }
    if (!page.next_cursor || page.transactions.length === 0) {
      return { documents, cursor: page.next_cursor ?? next };
    }
    next = page.next_cursor;
  }
}

/**
 * Creates a TransactionLink session. Linking a merchant account happens in
 * Knot's client SDK with this session; a small local page hosting the web
 * SDK is the planned way to do that from the CLI.
 */
export async function createKnotSession(
  config: KnotConfig,
  fetchFn: Fetch = fetch,
): Promise<string> {
  const { session } = await knotPost<{ session: string }>(
    config,
    '/session/create',
    { type: 'transaction_link', external_user_id: config.externalUserId },
    fetchFn,
  );
  return session;
}

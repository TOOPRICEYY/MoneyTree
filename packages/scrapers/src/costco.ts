import type { IsoDate, RawDocument } from '@moneytree/core';

import { withBrowser } from './browser.ts';
import type { Scraper } from './types.ts';

// Ported from Accountable's extraction tools (costco.py): log in through a
// real browser, capture the API token the receipts page sends, then call
// Costco's receipts GraphQL API directly.

const API_URL = 'https://ecom-api.costco.com/ebusiness/order/v1/orders/graphql';
const HOME_PAGE = 'https://www.costco.com/';
// Static web-app identifiers, not personal.
const CLIENT_ID = '4900eb1f-0c10-4bd9-99c3-c59e6c1ecebf';
const CLIENT_IDENTIFIER = '481b1aec-aa3b-454b-b81b-48187e28f205';

const LIST_QUERY = `query receiptsWithCounts($startDate: String!, $endDate: String!, $documentType: String!, $documentSubType: String!) {
  receiptsWithCounts(startDate: $startDate, endDate: $endDate, documentType: $documentType, documentSubType: $documentSubType) {
    receipts { transactionBarcode receiptType transactionType documentType }
  }
}`;

const DETAIL_QUERY = `query receiptsWithCounts($barcode: String!, $documentType: String!) {
  receiptsWithCounts(barcode: $barcode, documentType: $documentType) {
    receipts {
      warehouseName receiptType transactionType transactionDateTime transactionBarcode
      total subTotal taxes instantSavings totalItemCount
      warehouseAddress1 warehouseCity warehouseState
      itemArray { itemNumber itemDescription01 amount taxFlag unit }
      tenderArray { tenderTypeName tenderDescription amountTender displayAccountNumber }
    }
  }
}`;

export type CostcoApiReceipt = {
  warehouseName: string;
  receiptType?: string;
  transactionType?: string;
  transactionDateTime: string;
  transactionBarcode: string;
  total: number;
  subTotal?: number;
  taxes?: number;
  instantSavings?: number;
  totalItemCount?: number;
  warehouseAddress1?: string;
  warehouseCity?: string;
  warehouseState?: string;
  itemArray?: {
    itemNumber: string;
    itemDescription01: string;
    amount: number;
    taxFlag: 'Y' | 'N' | null;
    unit: number;
  }[];
  tenderArray?: {
    tenderTypeName?: string;
    tenderDescription?: string;
    amountTender: number;
    displayAccountNumber?: string;
  }[];
};

/**
 * Maps the API's receipt to the JSON shape the Costco importer reads (the
 * same shape Accountable's costco_receipts.json uses).
 */
export function toCostcoReceipt(receipt: CostcoApiReceipt) {
  return {
    barcode: receipt.transactionBarcode,
    date: receipt.transactionDateTime,
    warehouse: receipt.warehouseName,
    type: receipt.receiptType ?? receipt.transactionType ?? '',
    total: receipt.total,
    item_count: receipt.totalItemCount,
    store_address: [
      receipt.warehouseAddress1,
      receipt.warehouseCity,
      receipt.warehouseState,
    ]
      .filter(Boolean)
      .join(', '),
    subtotal: receipt.subTotal,
    taxes: receipt.taxes,
    instant_savings: receipt.instantSavings,
    items: (receipt.itemArray ?? []).map(item => ({
      item_number: item.itemNumber,
      description: item.itemDescription01,
      amount: item.amount,
      tax_flag: item.taxFlag,
      unit: item.unit,
    })),
    payment: (receipt.tenderArray ?? []).map(tender => ({
      type: tender.tenderTypeName ?? tender.tenderDescription ?? '',
      amount: tender.amountTender,
      last4: tender.displayAccountNumber,
    })),
  };
}

/** Costco's API takes `M/D/YYYY` ranges; walk from `since` in 3-month windows. */
export function quarterWindows(since: IsoDate, today = new Date()) {
  const format = (d: Date) =>
    `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  const windows: { startDate: string; endDate: string }[] = [];
  let start = new Date(`${since}T00:00:00Z`);
  while (start <= today) {
    const end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0),
    );
    windows.push({
      startDate: format(start),
      endDate: format(end < today ? end : today),
    });
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1));
  }
  return windows;
}

async function captureToken(
  options: Parameters<Scraper['scrape']>[0],
): Promise<string> {
  return withBrowser(options, async context => {
    const page = context.pages()[0] ?? (await context.newPage());
    const token = new Promise<string>(resolve => {
      page.on('request', request => {
        const header = request.headers()['costco-x-authorization'];
        if (request.url().includes('ecom-api.costco.com') && header) {
          resolve(header);
        }
      });
    });
    options.log?.(
      'Opening costco.com. Log in if asked, then open Orders & Purchases > Warehouse and change the date range.',
    );
    await page.goto(HOME_PAGE);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Timed out waiting for Costco login')),
        5 * 60_000,
      ),
    );
    return Promise.race([token, timeout]);
  });
}

async function graphql<T>(
  token: string,
  query: string,
  variables: object,
): Promise<T> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json-patch+json',
      Origin: 'https://www.costco.com',
      Referer: 'https://www.costco.com/',
      'costco.service': 'restOrders',
      'costco.env': 'ecom',
      'costco-x-authorization': token,
      'costco-x-wcs-clientId': CLIENT_ID,
      'client-identifier': CLIENT_IDENTIFIER,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Costco API ${response.status}`);
  // Shape from the receipts GraphQL schema queried above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const body = (await response.json()) as { data?: T; errors?: unknown[] };
  if (!body.data) {
    throw new Error(`Costco API errors: ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}

type ReceiptsResponse<R> = { receiptsWithCounts: { receipts: R[] | null } };

export const costcoScraper: Scraper = {
  source: 'costco',
  async *scrape(options) {
    const token = await captureToken(options);
    const seen = new Set<string>();
    for (const window of quarterWindows(options.since)) {
      const list = await graphql<
        ReceiptsResponse<{ transactionBarcode: string; receiptType?: string }>
      >(token, LIST_QUERY, {
        ...window,
        documentType: 'all',
        documentSubType: 'all',
      });
      const summaries = list.receiptsWithCounts.receipts ?? [];
      options.log?.(
        `${window.startDate}-${window.endDate}: ${summaries.length} receipts`,
      );

      for (const summary of summaries) {
        if (seen.has(summary.transactionBarcode)) continue;
        seen.add(summary.transactionBarcode);
        const documentType = summary.receiptType?.toLowerCase().includes('gas')
          ? 'gasstation'
          : 'warehouse';
        const detail = await graphql<ReceiptsResponse<CostcoApiReceipt>>(
          token,
          DETAIL_QUERY,
          { barcode: summary.transactionBarcode, documentType },
        );
        const receipt = detail.receiptsWithCounts.receipts?.[0];
        if (!receipt) continue;
        yield {
          source: 'costco',
          channel: 'scraper',
          kind: 'json',
          format: 'costco-receipt',
          id: receipt.transactionBarcode,
          fetchedAt: new Date().toISOString(),
          data: toCostcoReceipt(receipt),
        } satisfies RawDocument;
      }
    }
  },
};

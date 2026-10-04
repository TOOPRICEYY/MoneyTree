/**
 * Integer cents. Matches Actual's storage format (amounts are integers, and
 * outflows are negative), so values can be handed to `@actual-app/api`
 * without conversion.
 */
export type Cents = number;

/** Calendar date as `YYYY-MM-DD`, the format Actual's API expects. */
export type IsoDate = string;

export type SourceId =
  | 'amazon'
  | 'apple'
  | 'costco'
  | 'ebay'
  | 'meijer'
  | 'receipt';

export type LineItem = {
  description: string;
  /** Item total after item-level discounts, as an outflow (negative). */
  amount: Cents;
  quantity?: number;
  /** Retailer identifier: ASIN, Costco item number, UPC, etc. */
  sku?: string;
  isTaxable?: boolean;
  /** Category name in Actual, when the importer or classifier knows it. */
  category?: string;
};

export type AdjustmentKind = 'tax' | 'shipping' | 'discount' | 'fee' | 'tip';

/** Order-level amount that gets spread across line items when splitting. */
export type Adjustment = {
  kind: AdjustmentKind;
  amount: Cents;
};

export type PaymentHint = {
  /** Last four digits of the card used, when the source exposes it. */
  last4?: string;
  method?: string;
  amount?: Cents;
};

/**
 * One itemized purchase from a retailer or receipt: the thing MoneyTree adds
 * that bank feeds don't have.
 */
export type Purchase = {
  source: SourceId;
  /** Stable id from the source (order number, receipt barcode, ...). */
  externalId: string;
  date: IsoDate;
  merchant: string;
  /** Grand total charged, as an outflow (negative); refunds are positive. */
  total: Cents;
  items: LineItem[];
  adjustments: Adjustment[];
  payments: PaymentHint[];
};

/** A transaction as it exists in Actual (imported from the bank). */
export type BankTransaction = {
  id: string;
  accountId: string;
  date: IsoDate;
  amount: Cents;
  payee: string;
  notes?: string;
  importedId?: string;
};

export type PurchaseMatch = {
  purchase: Purchase;
  bankTransaction: BankTransaction;
  /** 0..1, higher is more certain. */
  score: number;
  dayDelta: number;
  amountDelta: Cents;
};

/** How a raw document was acquired. */
export type Channel = 'email' | 'scraper' | 'aggregator' | 'file';

/** Finds a source's receipt emails. Shared by every email provider. */
export type EmailQuery = {
  /** Sender addresses or domains. */
  from: string[];
  /** Words that must all appear in the subject. */
  subject?: string[];
};

export type Attachment = {
  filename: string;
  mimeType: string;
  /** Base64, so raw documents stay JSON-serializable. */
  contentBase64: string;
};

type RawDocumentBase = {
  source: SourceId;
  channel: Channel;
  /** Stable within a source: message id, receipt barcode, order id. */
  id: string;
  fetchedAt: string;
};

/**
 * Unparsed data as a fetcher (email, scraper, aggregator) acquired it.
 * Fetchers only produce these and importers only consume them, so any
 * channel can feed any parser, and raw data can be re-parsed offline.
 */
export type RawDocument = RawDocumentBase &
  (
    | {
        kind: 'email';
        receivedAt: string;
        from: string;
        subject: string;
        html?: string;
        text?: string;
        attachments: Attachment[];
      }
    | {
        kind: 'json';
        /** Names the payload shape, e.g. `costco-receipt` or `knot`. */
        format: string;
        data: unknown;
      }
    | {
        kind: 'file';
        path: string;
      }
  );

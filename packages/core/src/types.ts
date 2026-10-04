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

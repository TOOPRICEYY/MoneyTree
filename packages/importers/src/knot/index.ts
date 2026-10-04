import { toCents } from '@moneytree/core';
import type {
  Adjustment,
  AdjustmentKind,
  Purchase,
  RawDocument,
  SourceId,
} from '@moneytree/core';

/** One order from Knot's `POST /transactions/sync` (Knot-Version 2.0). */
export type KnotTransaction = {
  id: string;
  external_id?: string;
  datetime: string;
  order_status?: string;
  price: {
    sub_total?: string;
    total: string;
    currency?: string;
    adjustments?: { type: string; label?: string; amount: string }[];
  };
  products?: {
    external_id?: string;
    name: string;
    quantity?: number;
    price?: { sub_total?: string; total?: string; unit_price?: string };
  }[];
  payment_methods?: {
    type?: string;
    brand?: string;
    last_four?: string;
    transaction_amount?: string;
  }[];
};

const ADJUSTMENT_KINDS: Record<string, AdjustmentKind> = {
  TAX: 'tax',
  SHIPPING: 'shipping',
  DISCOUNT: 'discount',
  TIP: 'tip',
};

function toAdjustment(adjustment: {
  type: string;
  amount: string;
}): Adjustment {
  const kind = ADJUSTMENT_KINDS[adjustment.type] ?? 'fee';
  const cents = Math.abs(toCents(adjustment.amount));
  // Discounts reduce what was paid; everything else adds to it.
  return { kind, amount: kind === 'discount' ? cents : -cents };
}

export function parseKnotTransaction(
  transaction: KnotTransaction,
  source: SourceId,
  merchant: string,
): Purchase | undefined {
  if (transaction.order_status === 'CANCELLED') return undefined;

  return {
    source,
    externalId: transaction.external_id ?? transaction.id,
    date: transaction.datetime.slice(0, 10),
    merchant,
    total: -toCents(transaction.price.total),
    items: (transaction.products ?? []).map(product => ({
      description: product.name,
      amount: -toCents(product.price?.total ?? product.price?.sub_total ?? 0),
      quantity: product.quantity,
      sku: product.external_id,
    })),
    adjustments: (transaction.price.adjustments ?? []).map(toAdjustment),
    payments: (transaction.payment_methods ?? []).map(payment => ({
      method: payment.brand ?? payment.type,
      last4: payment.last_four,
      amount: payment.transaction_amount
        ? -toCents(payment.transaction_amount)
        : undefined,
    })),
  };
}

const MERCHANT_NAMES: Partial<Record<SourceId, string>> = {
  amazon: 'Amazon',
  costco: 'Costco',
};

export function parseKnotDocument(doc: RawDocument): Purchase[] {
  if (doc.kind !== 'json' || doc.format !== 'knot') return [];
  // The aggregator stores Knot's transaction objects verbatim.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const transaction = doc.data as KnotTransaction;
  const purchase = parseKnotTransaction(
    transaction,
    doc.source,
    MERCHANT_NAMES[doc.source] ?? doc.source,
  );
  return purchase ? [purchase] : [];
}

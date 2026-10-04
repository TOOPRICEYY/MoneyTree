import type {
  BankTransaction,
  Cents,
  IsoDate,
  Purchase,
  PurchaseMatch,
} from './types.ts';

/**
 * Stable idempotency key for a purchase. Used as Actual's `imported_id`, so
 * re-running an import never creates the same purchase twice.
 */
export function purchaseKey(purchase: Purchase): string {
  return `moneytree:${purchase.source}:${purchase.externalId}`;
}

function normalizeMerchant(merchant: string): string {
  return merchant.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** "Costco GRAND RAPIDS" -> "costco", for comparing against bank payees. */
function merchantBrand(merchant: string): string {
  return normalizeMerchant(merchant.trim().split(/\s+/)[0] ?? '');
}

export function daysBetween(a: IsoDate, b: IsoDate): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Collapses the same purchase seen through more than one channel: the same
 * order imported twice, or a photographed receipt for a purchase a retailer
 * importer already produced. Retailer data wins over receipt photos because
 * it is itemized more reliably.
 */
export function dedupePurchases(purchases: Purchase[]): Purchase[] {
  const byKey = new Map<string, Purchase>();
  for (const purchase of purchases) {
    byKey.set(purchaseKey(purchase), purchase);
  }

  const retailer = [...byKey.values()].filter(p => p.source !== 'receipt');
  const receipts = [...byKey.values()].filter(p => p.source === 'receipt');
  const unmatchedReceipts = receipts.filter(
    receipt =>
      !retailer.some(
        p =>
          p.total === receipt.total &&
          Math.abs(daysBetween(p.date, receipt.date)) <= 1 &&
          normalizeMerchant(p.merchant).includes(
            normalizeMerchant(receipt.merchant),
          ),
      ),
  );

  return [...retailer, ...unmatchedReceipts];
}

export type MatchOptions = {
  /** Retailers often charge on ship date, days after the order date. */
  maxDayDelta?: number;
  maxAmountDelta?: Cents;
};

/**
 * Pairs each purchase with the bank charge it explains, one to one. Every
 * candidate pair within tolerance is scored and the best pairs win, so a
 * close match is never stolen by an earlier, worse one.
 */
export function matchPurchasesToBank(
  purchases: Purchase[],
  bankTransactions: BankTransaction[],
  { maxDayDelta = 7, maxAmountDelta = 2 }: MatchOptions = {},
): PurchaseMatch[] {
  const candidates: PurchaseMatch[] = [];
  for (const purchase of purchases) {
    for (const bankTransaction of bankTransactions) {
      const amountDelta = Math.abs(bankTransaction.amount - purchase.total);
      const dayDelta = daysBetween(bankTransaction.date, purchase.date);
      if (amountDelta > maxAmountDelta) continue;
      if (dayDelta < -1 || dayDelta > maxDayDelta) continue;

      const merchantBonus = normalizeMerchant(bankTransaction.payee).includes(
        merchantBrand(purchase.merchant),
      )
        ? 0.2
        : 0;
      const score =
        0.5 * (1 - Math.abs(dayDelta) / (maxDayDelta + 1)) +
        0.3 * (1 - amountDelta / (maxAmountDelta + 1)) +
        merchantBonus;
      candidates.push({
        purchase,
        bankTransaction,
        score,
        dayDelta,
        amountDelta,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const usedPurchases = new Set<string>();
  const usedBank = new Set<string>();
  const matches: PurchaseMatch[] = [];
  for (const candidate of candidates) {
    const key = purchaseKey(candidate.purchase);
    if (usedPurchases.has(key) || usedBank.has(candidate.bankTransaction.id)) {
      continue;
    }
    usedPurchases.add(key);
    usedBank.add(candidate.bankTransaction.id);
    matches.push(candidate);
  }
  return matches;
}

import { notImplemented } from '../notImplemented.ts';

// Plan: parse eBay order confirmation emails or the purchase history CSV.
// eBay charges usually arrive through PayPal or a card with an "EBAY O*"
// descriptor that carries part of the order number.
export const ebayImporter = notImplemented(
  'ebay',
  'eBay order emails or purchase history export',
);

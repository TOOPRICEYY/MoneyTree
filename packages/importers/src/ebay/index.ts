import { notImplemented } from '../notImplemented.ts';

// Plan: parse eBay "Order confirmed" emails (item, price, shipping, tax).
// Seller messages come from members.ebay.com addresses and are skipped by
// the sender filter. eBay charges arrive with an "EBAY O*" descriptor that
// carries part of the order number, which can tighten bank matching.
export const ebayImporter = notImplemented(
  'ebay',
  'eBay order confirmation emails',
  { from: ['ebay@ebay.com'], subject: ['order'] },
);

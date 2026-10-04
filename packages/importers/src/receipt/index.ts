import { notImplemented } from '../notImplemented.ts';

// Plan: extract line items, totals, merchant and date from receipt photos
// with a vision LLM, returning a Purchase with source 'receipt'. Core's
// dedupePurchases drops a photo when a retailer importer already has the
// same purchase.
export const receiptImporter = notImplemented(
  'receipt',
  'Receipt photos, parsed with a vision model',
);

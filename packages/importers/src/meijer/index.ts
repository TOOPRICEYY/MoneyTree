import { notImplemented } from '../notImplemented.ts';

// Plan: parse Meijer digital receipts (item prices, mPerks discounts, tax),
// either from receipt emails or by scraping the receipts page of a logged-in
// meijer.com session. The sender address below is a guess at the domain and
// should be confirmed against a real receipt email.
export const meijerImporter = notImplemented(
  'meijer',
  'Meijer digital receipts (mPerks)',
  { from: ['meijer.com'], subject: ['receipt'] },
);

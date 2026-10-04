import { notImplemented } from '../notImplemented.ts';

// Plan: parse "Your receipt from Apple" emails, which list each app,
// subscription and in-app purchase with tax. Apple batches several purchases
// into one card charge, so one receipt can cover one bank line.
export const appleImporter = notImplemented(
  'apple',
  'Apple receipt emails (App Store, iCloud, subscriptions)',
  { from: ['no_reply@email.apple.com'], subject: ['receipt'] },
);

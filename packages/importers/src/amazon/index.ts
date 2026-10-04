import { notImplemented } from '../notImplemented.ts';

// Plan:
// - file: the "Your Orders" export zip from Amazon's Request My Data (Order
//   History.csv and Digital Content Orders.csv), grouped by order id.
// - email: order confirmations and shipment emails, for orders newer than
//   the last export.
// - aggregator: Knot (merchant 44) returns SKU-level orders and is parsed by
//   the shared Knot parser, not here.
// Amazon often charges per shipment, so one order can map to several bank
// charges; matching needs to handle that (see Accountable merge/dedup.py).
export const amazonImporter = notImplemented(
  'amazon',
  'Amazon order export zip and order emails (or Knot)',
  {
    from: ['auto-confirm@amazon.com', 'shipment-tracking@amazon.com'],
    subject: ['order'],
  },
);

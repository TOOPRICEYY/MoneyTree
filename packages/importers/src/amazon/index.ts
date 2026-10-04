import { notImplemented } from '../notImplemented.ts';

// Plan: parse the "Your Orders" export zip from Amazon's Request My Data
// (Retail.OrderHistory and Digital order CSVs), grouping rows by order id.
// The Python `amazon-orders` library is an alternative for incremental pulls.
// Amazon often charges per shipment, so one order can map to several bank
// charges; matching needs to handle that (see Accountable merge/dedup.py).
export const amazonImporter = notImplemented(
  'amazon',
  'Amazon "Your Orders" data export zip',
);

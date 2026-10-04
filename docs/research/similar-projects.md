# Projects similar to MoneyTree (2026-10-04)

Research notes from the project's similar-projects thread. Reference only.

Bottom line: nothing found matches the full scope. What exists falls into
three groups: (a) Amazon-only splitters, mostly for YNAB, (b) one
multi-source matching engine built for Beancount, and (c) reusable building
blocks.

## Closest analogues

- **taylorcjensen/actual-amazon** (fork: schrauger/actual-amazon) targets
  Actual. Pulls orders via amazon-orders (Python), matches unmatched Actual
  transactions within ±200¢ and a 7-day lookback. Multi-item charges become
  splits, with tax, fees and discounts allocated proportionally. Groups
  charges by order and expands quantities into units so no item is reused.
  Has a dry-run report. Node + Python, tiny. Read it for the allocation logic.
- **rmsppu/actual-amazon-noter** targets Actual. Matches Amazon CSV rows to
  transactions and writes details into Notes, without splitting. Linked from
  actualbudget/actual issue #4616.
- **jbms/beancount-import** (470 stars) is the most architecturally similar.
  One match/merge engine covers OFX, Amazon invoices, Gmail-extracted Google
  purchases, Venmo, PayPal and receipt scans. Links records to their source
  data for dedup, matches postings up to 5 days apart, and learns from
  confirmations. Study its design.
- **jparavisini/amazon-exporter-for-ynab**: TS Chrome extension. Item memos
  and per-item splits, attributes refunds back to the original purchase,
  matches within ±7 days, dry run. Author calls the invoice parser "fragile".
- **esterhui/ynab-tui**: amazon-orders, matches within ±$0.10 over a 7-24
  day window, interactive splits.
- **GraysonCAdams/amazon-ynab-sync**: reads Amazon confirmation emails over
  IMAP, avoiding CAPTCHAs. Archived Aug 2026, but the pattern is useful.
- **iloveitaly/lunchmoney-amazon**: Lunch Money, adds LLM categorization and
  gift detection (TS/Bun).
- Not inspected: TheFern2/ynab-amazon, aelzeiny/YNAB_AMAZON,
  hjhart/ynab-amazon-importer, rkortsmit/ynab-amazon-helper,
  ynab-amazon-categorizer, krin-san/firefly-iii-amazon-scraper.

## Commercial

Amazon and sometimes Target only; none cover Costco, Meijer, eBay, Apple or
receipt photos.

- **Monarch Retail Sync**: per-item splits, tax spread proportionally, fees
  evenly. Matches on merchant, amount and date. Fails on gift-card-paid
  orders and pending charges.
- **Quicken**: Amazon only, rated 2.0/5.
- **Copilot**: needs an exact amount within 2 days; frequent reconnects.
- **lineitem**: Firefox add-on for YNAB (Amazon, Target). MIT, runs locally.

## Building blocks

- **alexdlaird/amazon-orders**: active, v4.6.1 released 2026-10-03.
- **philipmulcahy/azad**: active, last commit 2026-08-18.
- **thehesiod/costco-mcp**: Costco warehouse receipts with line items plus
  online orders. Undocumented API with a browser-extracted OAuth refresh
  token and a SQLite cache. Compare with `packages/scrapers/src/costco.ts`.
- **Receipt Wrangler**: self-hosted receipt photo and email ingest with
  OCR/LLM line items. Active, last commit 2026-10-01.
- **vas3k/TaxHacker** (6.7k stars): LLM receipt extraction with item
  splitting, no matching.
- **1oannis/budget-lens**: small Django + OpenAI receipt scanner.
- **sakowicz/actual-ai**: LLM categorization for Actual. Active, v2.4.2.
- **Knot TransactionLink**: SKU-level data through a business API. Pricing
  and individual sign-up aren't stated, so likely not for personal use.
- **Paperless-ngx**: document archive only.

## Lessons

- Amazon bills per shipment, not per order, so matching must work per charge.
- Allocate tax proportionally. Fees can be split evenly or proportionally.
- Use a 2-7 day match window with a small amount tolerance, and always dry
  run before writing.
- Match refunds back to the original item.
- Orders paid by gift card or credit have no bank charge; handle explicitly.
- Scrapers break, so make email the primary source and scraping the fallback.

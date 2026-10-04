# MoneyTree

Turns retailer orders and receipts into itemized split transactions in
[Actual Budget](https://actualbudget.org).

Sources: Costco (working), Amazon, eBay, Apple, Meijer, receipt photos (planned).

```bash
corepack enable
yarn install
cp .env.example .env   # fill in the Actual server password and sync id
yarn moneytree sources
yarn moneytree sync costco data/costco_receipts.json   # dry run
```

See [AGENTS.md](AGENTS.md) for architecture and conventions.

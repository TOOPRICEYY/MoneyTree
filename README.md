# MoneyTree

Turns retailer orders and receipts into itemized split transactions in
[Actual Budget](https://actualbudget.org).

Sources: Costco (working), Amazon, eBay, Apple, Meijer, receipt photos (planned).

```bash
corepack enable
yarn install
cp .env.example .env   # fill in the Actual server password and sync id
yarn ui                # web UI on http://127.0.0.1:5007
```

Or from the command line:

```bash
yarn moneytree sources
yarn moneytree import costco data/costco_receipts.json
yarn moneytree sync costco   # dry run; add --apply to write splits
```

See [AGENTS.md](AGENTS.md) for architecture and conventions.

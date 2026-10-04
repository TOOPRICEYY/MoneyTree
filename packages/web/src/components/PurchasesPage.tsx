import type { SourceId } from '@moneytree/core';
import { useQuery } from '@tanstack/react-query';

import { api } from '../api.ts';
import { sourceLabel } from '../format.ts';
import { routeHref } from '../route.ts';

import { Money } from './Money.tsx';
import { Notice } from './Notice.tsx';
import { PurchaseRow } from './PurchaseRow.tsx';
import { SourceTabs } from './SourceTabs.tsx';

type PurchasesPageProps = {
  source: SourceId;
};

export function PurchasesPage({ source }: PurchasesPageProps) {
  const purchases = useQuery({
    queryKey: ['purchases', source],
    queryFn: () => api.purchases(source),
  });
  const total = purchases.data?.reduce((sum, p) => sum + p.total, 0) ?? 0;
  const itemCount =
    purchases.data?.reduce((sum, p) => sum + p.items.length, 0) ?? 0;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Purchases</h1>
          <p className="lede">
            Itemized purchases parsed from everything fetched for a source.
          </p>
        </div>
      </header>
      <SourceTabs page="purchases" current={source} />

      {purchases.error && (
        <Notice tone="error">{purchases.error.message}</Notice>
      )}
      {purchases.isPending && (
        <p className="muted">Parsing {sourceLabel(source)} data…</p>
      )}

      {purchases.data && purchases.data.length === 0 && (
        <div className="empty">
          <p>No {sourceLabel(source)} purchases yet.</p>
          <a className="button" href={routeHref({ page: 'sources' })}>
            Fetch {sourceLabel(source)} data
          </a>
        </div>
      )}

      {purchases.data && purchases.data.length > 0 && (
        <>
          <dl className="stats">
            <div>
              <dt>Purchases</dt>
              <dd>{purchases.data.length}</dd>
            </div>
            <div>
              <dt>Line items</dt>
              <dd>{itemCount}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                <Money cents={total} />
              </dd>
            </div>
          </dl>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Merchant</th>
                  <th scope="col" className="num hide-narrow">
                    Items
                  </th>
                  <th scope="col" className="num">
                    Total
                  </th>
                  <th scope="col">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchases.data.map(purchase => (
                  <PurchaseRow
                    key={`${purchase.source}:${purchase.externalId}`}
                    purchase={purchase}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

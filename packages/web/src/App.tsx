import {
  ActivityPanel,
  createHttpClient,
  MoneyTreeProvider,
  PurchasesView,
  ReviewView,
  SourcesView,
} from '@moneytree/ui';
import type { MoneyTreeRoute } from '@moneytree/ui';

import { routeHref, useRoute } from './route.ts';

// The standalone shell: sidebar navigation and hash routing around the
// shared views. An Actual extension would replace only this file's role.
const client = createHttpClient('/api');

const NAV: { page: MoneyTreeRoute['page']; label: string; hint: string }[] = [
  { page: 'sources', label: 'Sources', hint: 'Fetch receipts' },
  { page: 'purchases', label: 'Purchases', hint: 'What was bought' },
  { page: 'review', label: 'Review', hint: 'Match and split' },
];

export function App() {
  const route = useRoute();
  const source = route.page === 'sources' ? 'costco' : route.source;

  return (
    <MoneyTreeProvider client={client} linkTo={routeHref}>
      <div className="app">
        <nav className="sidebar" aria-label="Main">
          <a className="brand" href={routeHref({ page: 'sources' })}>
            <img src="/icon.svg" alt="" width={28} height={28} />
            <span>MoneyTree</span>
          </a>
          <ul>
            {NAV.map(item => {
              const target: MoneyTreeRoute =
                item.page === 'sources'
                  ? { page: 'sources' }
                  : { page: item.page, source };
              return (
                <li key={item.page}>
                  <a
                    href={routeHref(target)}
                    aria-current={route.page === item.page ? 'page' : undefined}
                  >
                    <span>{item.label}</span>
                    <small>{item.hint}</small>
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="sidebar-note">
            Splits are written to your local Actual budget.
          </p>
        </nav>
        <main className="content">
          {route.page === 'sources' && <SourcesView />}
          {route.page === 'purchases' && (
            <PurchasesView source={route.source} />
          )}
          {route.page === 'review' && <ReviewView source={route.source} />}
        </main>
        <ActivityPanel />
      </div>
    </MoneyTreeProvider>
  );
}

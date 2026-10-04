import { JobsPanel } from './components/JobsPanel.tsx';
import { PurchasesPage } from './components/PurchasesPage.tsx';
import { ReviewPage } from './components/ReviewPage.tsx';
import { SourcesPage } from './components/SourcesPage.tsx';
import { routeHref, useRoute } from './route.ts';
import type { Route } from './route.ts';

const NAV: { page: Route['page']; label: string; hint: string }[] = [
  { page: 'sources', label: 'Sources', hint: 'Fetch receipts' },
  { page: 'purchases', label: 'Purchases', hint: 'What was bought' },
  { page: 'review', label: 'Review', hint: 'Match and split' },
];

export function App() {
  const route = useRoute();
  const source = route.page === 'sources' ? 'costco' : route.source;

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Main">
        <a className="brand" href="#/sources">
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span>MoneyTree</span>
        </a>
        <ul>
          {NAV.map(item => {
            const target: Route =
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
        {route.page === 'sources' && <SourcesPage />}
        {route.page === 'purchases' && <PurchasesPage source={route.source} />}
        {route.page === 'review' && <ReviewPage source={route.source} />}
      </main>
      <JobsPanel />
    </div>
  );
}

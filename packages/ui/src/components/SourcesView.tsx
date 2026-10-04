import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { todayMinusDays } from '../format.ts';
import { useMoneyTree } from '../MoneyTreeProvider.tsx';

import { Notice } from './Notice.tsx';
import { SourceCard } from './SourceCard.tsx';
import { useStartJob } from './useStartJob.ts';

export function SourcesView() {
  const { client } = useMoneyTree();
  const sources = useQuery({
    queryKey: ['sources'],
    queryFn: () => client.sources(),
  });
  const [since, setSince] = useState(() => todayMinusDays(365));
  const connectGmail = useStartJob(() => client.connectGmail());

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Sources</h1>
          <p className="lede">
            Download receipts by email, from a logged-in browser, or from Knot.
            Raw data is kept in <code>data/raw</code> so it can be re-parsed
            anytime.
          </p>
        </div>
        <div className="page-actions">
          <label className="field">
            <span>Fetch since</span>
            <input
              type="date"
              value={since}
              onChange={e => setSince(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="button"
            onClick={() => connectGmail.mutate(undefined)}
            disabled={connectGmail.isPending}
          >
            Connect Gmail
          </button>
        </div>
      </header>

      {connectGmail.error && (
        <Notice tone="error">{connectGmail.error.message}</Notice>
      )}
      {sources.error && <Notice tone="error">{sources.error.message}</Notice>}
      {sources.isPending && <p className="muted">Loading sources…</p>}

      <div className="card-grid">
        {sources.data?.map(info => (
          <SourceCard key={info.source} info={info} since={since} />
        ))}
      </div>
    </section>
  );
}

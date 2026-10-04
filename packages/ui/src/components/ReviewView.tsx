import { useState } from 'react';

import type { ReviewResult, SourceId } from '@moneytree/core';
import { useMutation } from '@tanstack/react-query';

import { sourceLabel } from '../format.ts';
import { useMoneyTree } from '../MoneyTreeProvider.tsx';

import { MatchRow } from './MatchRow.tsx';
import { Notice } from './Notice.tsx';
import { PurchaseRow } from './PurchaseRow.tsx';
import { SourceTabs } from './SourceTabs.tsx';

/** Matches at or above this score start out selected. */
const AUTO_SELECT_SCORE = 0.6;

type ReviewViewProps = {
  source: SourceId;
};

export function ReviewView({ source }: ReviewViewProps) {
  // Keyed by source so switching tabs starts a fresh review.
  return <Review key={source} source={source} />;
}

function Review({ source }: ReviewViewProps) {
  const { client } = useMoneyTree();
  const [since, setSince] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [written, setWritten] = useState<number | undefined>();

  const review = useMutation({
    mutationFn: () => client.review(source, since || undefined),
    onSuccess: (result: ReviewResult) => {
      setSelected(
        new Set(
          result.matches
            .filter(m => m.score >= AUTO_SELECT_SCORE)
            .map(m => m.bankTransaction.id),
        ),
      );
    },
  });

  const apply = useMutation({
    mutationFn: () => client.apply(source, [...selected], since || undefined),
    onSuccess: result => {
      setWritten(result.written);
      setIsConfirming(false);
      review.mutate();
    },
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const result = review.data;
  const allIds = result?.matches.map(m => m.bankTransaction.id) ?? [];
  const isAllSelected =
    allIds.length > 0 && allIds.every(id => selected.has(id));

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Review</h1>
          <p className="lede">
            Match {sourceLabel(source)} purchases to bank charges in Actual,
            then write the line items as splits. Nothing is written until you
            confirm.
          </p>
        </div>
        <div className="page-actions">
          <label className="field">
            <span>Bank charges since</span>
            <input
              type="date"
              value={since}
              onChange={e => setSince(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="button button-primary"
            onClick={() => review.mutate()}
            disabled={review.isPending}
          >
            {review.isPending ? 'Checking Actual…' : 'Check against Actual'}
          </button>
        </div>
      </header>
      <SourceTabs page="review" current={source} />

      {review.error && <Notice tone="error">{review.error.message}</Notice>}
      {apply.error && <Notice tone="error">{apply.error.message}</Notice>}
      {written !== undefined && (
        <Notice tone="success">
          Wrote splits for {written}{' '}
          {written === 1 ? 'transaction' : 'transactions'} to Actual.
        </Notice>
      )}

      {!result && !review.isPending && (
        <div className="empty">
          <p>Run a check to see which bank charges these purchases explain.</p>
        </div>
      )}

      {result && (
        <>
          <div className="toolbar">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() =>
                  setSelected(isAllSelected ? new Set() : new Set(allIds))
                }
                disabled={allIds.length === 0}
              />
              <span>
                {result.matches.length} matches, {selected.size} selected
              </span>
            </label>
            <div className="toolbar-actions">
              {isConfirming ? (
                <>
                  <span className="muted">
                    Write {selected.size} splits to your Actual budget?
                  </span>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setIsConfirming(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => apply.mutate()}
                    disabled={apply.isPending}
                  >
                    {apply.isPending ? 'Writing…' : 'Confirm'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => setIsConfirming(true)}
                  disabled={selected.size === 0}
                >
                  Write {selected.size} splits
                </button>
              )}
            </div>
          </div>

          <ul className="matches">
            {result.matches.map(match => (
              <MatchRow
                key={match.bankTransaction.id}
                match={match}
                isSelected={selected.has(match.bankTransaction.id)}
                onToggle={() => toggle(match.bankTransaction.id)}
              />
            ))}
          </ul>

          {result.unmatched.length > 0 && (
            <details className="unmatched">
              <summary>
                {result.unmatched.length} purchases with no matching bank charge
                since {result.since}
              </summary>
              <table className="table">
                <tbody>
                  {result.unmatched.map(purchase => (
                    <PurchaseRow
                      key={`${purchase.source}:${purchase.externalId}`}
                      purchase={purchase}
                    />
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </>
      )}
    </section>
  );
}

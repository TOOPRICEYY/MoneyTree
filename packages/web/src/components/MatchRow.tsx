import { useState } from 'react';

import type { MatchPreview } from '@moneytree/core';

import { formatDate } from '../format.ts';

import { Money } from './Money.tsx';

type MatchRowProps = {
  match: MatchPreview;
  isSelected: boolean;
  onToggle: () => void;
};

function scoreTone(score: number): string {
  if (score >= 0.8) return 'score-high';
  if (score >= 0.6) return 'score-medium';
  return 'score-low';
}

export function MatchRow({ match, isSelected, onToggle }: MatchRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { bankTransaction, purchase } = match;
  const splitsId = `splits-${bankTransaction.id}`;

  return (
    <li className={isSelected ? 'match match-selected' : 'match'}>
      <div className="match-main">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          aria-label={`Select ${bankTransaction.payee} on ${bankTransaction.date}`}
        />
        <div className="match-side">
          <span className="match-label">Bank charge</span>
          <strong>{bankTransaction.payee || 'Unknown payee'}</strong>
          <span className="muted">{formatDate(bankTransaction.date)}</span>
        </div>
        <Money cents={bankTransaction.amount} />
        <span className="match-arrow" aria-hidden="true">
          ←
        </span>
        <div className="match-side">
          <span className="match-label">Purchase</span>
          <strong>{purchase.merchant}</strong>
          <span className="muted">
            {formatDate(purchase.date)} · {purchase.items.length} items
            {match.dayDelta !== 0 && ` · ${Math.abs(match.dayDelta)}d apart`}
          </span>
        </div>
        <span
          className={`score ${scoreTone(match.score)}`}
          title="Match confidence"
        >
          {Math.round(match.score * 100)}%
        </span>
        <button
          type="button"
          className="link-button"
          aria-expanded={isOpen}
          aria-controls={splitsId}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen
            ? 'Hide splits'
            : `${match.splits.length} ${match.splits.length === 1 ? 'split' : 'splits'}`}
        </button>
      </div>
      {isOpen && (
        <ul id={splitsId} className="line-items">
          {match.splits.map((split, index) => (
            <li key={`${split.memo}-${index}`}>
              <span>{split.memo}</span>
              <Money cents={split.amount} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

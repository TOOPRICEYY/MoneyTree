import type { Cents } from '@moneytree/core';

import { formatCents } from '../format.ts';

type MoneyProps = {
  cents: Cents;
};

/** Financial numbers use tabular figures so columns line up (as in Actual). */
export function Money({ cents }: MoneyProps) {
  return (
    <span className={cents > 0 ? 'money money-inflow' : 'money'}>
      {formatCents(cents)}
    </span>
  );
}

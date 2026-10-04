import { SOURCE_IDS } from '@moneytree/core';
import type { SourceId } from '@moneytree/core';

import { sourceLabel } from '../format.ts';
import { useMoneyTree } from '../MoneyTreeProvider.tsx';

type SourceTabsProps = {
  page: 'purchases' | 'review';
  current: SourceId;
};

export function SourceTabs({ page, current }: SourceTabsProps) {
  const { linkTo } = useMoneyTree();
  return (
    <div className="tabs" role="tablist" aria-label="Source">
      {SOURCE_IDS.map(source => (
        <a
          key={source}
          role="tab"
          aria-selected={source === current}
          href={linkTo({ page, source })}
        >
          {sourceLabel(source)}
        </a>
      ))}
    </div>
  );
}

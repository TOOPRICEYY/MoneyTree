import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { MoneyTreeClient } from './client.ts';
import type { LinkTo } from './routes.ts';

type MoneyTreeContextValue = {
  client: MoneyTreeClient;
  linkTo: LinkTo;
  /** Called after splits are written, so a host like Actual can resync. */
  onBudgetChanged?: () => void;
};

const MoneyTreeContext = createContext<MoneyTreeContextValue | undefined>(
  undefined,
);

type MoneyTreeProviderProps = {
  client: MoneyTreeClient;
  linkTo: LinkTo;
  onBudgetChanged?: () => void;
  children: ReactNode;
};

/**
 * Root of every MoneyTree view, in the standalone app or inside a host such
 * as Actual. It owns its own query cache, so hosts need no data library,
 * and scopes all styles under `.mt-root` so nothing leaks into the host.
 */
export function MoneyTreeProvider({
  client,
  linkTo,
  onBudgetChanged,
  children,
}: MoneyTreeProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <MoneyTreeContext value={{ client, linkTo, onBudgetChanged }}>
      <QueryClientProvider client={queryClient}>
        <div className="mt-root">{children}</div>
      </QueryClientProvider>
    </MoneyTreeContext>
  );
}

export function useMoneyTree(): MoneyTreeContextValue {
  const value = useContext(MoneyTreeContext);
  if (!value) throw new Error('MoneyTree views need a <MoneyTreeProvider>');
  return value;
}

import type { Job } from '@moneytree/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/** Starts a server job and makes the jobs panel pick it up right away. */
export function useStartJob<TArgs>(start: (args: TArgs) => Promise<Job>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: start,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

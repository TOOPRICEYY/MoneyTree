import { randomUUID } from 'node:crypto';

import type { Job } from '@moneytree/core';

export type JobRunner = {
  start: (
    label: string,
    run: (log: (message: string) => void) => Promise<unknown>,
  ) => Job;
  get: (id: string) => Job | undefined;
  list: () => Job[];
};

/**
 * Long-running work (scrapes wait for a login, email searches page through
 * a mailbox) runs as an in-memory job the UI polls for progress.
 */
export function createJobRunner(maxJobs = 50): JobRunner {
  const jobs = new Map<string, Job>();

  return {
    start(label, run) {
      const job: Job = {
        id: randomUUID(),
        label,
        status: 'running',
        startedAt: new Date().toISOString(),
        log: [],
      };
      jobs.set(job.id, job);
      for (const id of [...jobs.keys()].slice(
        0,
        Math.max(0, jobs.size - maxJobs),
      )) {
        jobs.delete(id);
      }

      run(message => job.log.push(message)).then(
        () => {
          job.status = 'done';
          job.finishedAt = new Date().toISOString();
        },
        (error: unknown) => {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : String(error);
          job.finishedAt = new Date().toISOString();
        },
      );
      return job;
    },
    get: id => jobs.get(id),
    list: () => [...jobs.values()].reverse(),
  };
}

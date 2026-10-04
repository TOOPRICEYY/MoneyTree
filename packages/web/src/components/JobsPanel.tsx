import { useEffect, useRef, useState } from 'react';

import type { Job } from '@moneytree/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../api.ts';
import { formatRelative } from '../format.ts';

function LogLine({ line }: { line: string }) {
  if (/^https?:\/\//.test(line)) {
    return (
      <a href={line} target="_blank" rel="noreferrer">
        {line}
      </a>
    );
  }
  return <span>{line}</span>;
}

function JobItem({ job }: { job: Job }) {
  const [isOpen, setIsOpen] = useState(job.status === 'running');
  const lastLine = job.error ?? job.log.at(-1) ?? 'Starting…';

  return (
    <li className={`job job-${job.status}`}>
      <button
        type="button"
        className="job-summary"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="job-dot" aria-hidden="true" />
        <span className="job-label">{job.label}</span>
        <span className="job-time">{formatRelative(job.startedAt)}</span>
      </button>
      {isOpen ? (
        <pre className="job-log">
          {job.log.map((line, index) => (
            <div key={index}>
              <LogLine line={line} />
            </div>
          ))}
          {job.error && <div className="job-error">{job.error}</div>}
        </pre>
      ) : (
        <p className="job-last">
          <LogLine line={lastLine} />
        </p>
      )}
    </li>
  );
}

/** Recent fetch and auth jobs; polls only while something is running. */
export function JobsPanel() {
  const queryClient = useQueryClient();
  const jobs = useQuery({
    queryKey: ['jobs'],
    queryFn: api.jobs,
    refetchInterval: query =>
      query.state.data?.some(job => job.status === 'running') ? 1500 : false,
  });
  const runningIds = useRef(new Set<string>());

  // When a job finishes, refresh document counts and parsed purchases.
  useEffect(() => {
    const running = new Set(
      (jobs.data ?? [])
        .filter(job => job.status === 'running')
        .map(job => job.id),
    );
    const hasFinished = [...runningIds.current].some(id => !running.has(id));
    runningIds.current = running;
    if (hasFinished) {
      void queryClient.invalidateQueries({ queryKey: ['sources'] });
      void queryClient.invalidateQueries({ queryKey: ['purchases'] });
    }
  }, [jobs.data, queryClient]);

  const recent = jobs.data?.slice(0, 5) ?? [];
  if (recent.length === 0) return null;

  return (
    <aside className="jobs" aria-label="Activity">
      <h2>Activity</h2>
      <ul>
        {recent.map(job => (
          <JobItem key={job.id} job={job} />
        ))}
      </ul>
    </aside>
  );
}

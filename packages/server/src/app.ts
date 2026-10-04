import { isSourceId } from '@moneytree/core';
import type {
  FetchChannel,
  IsoDate,
  Purchase,
  ReviewResult,
  SourceId,
  SourceInfo,
} from '@moneytree/core';
import { Hono } from 'hono';

import { createJobRunner } from './jobs.ts';
import type { JobRunner } from './jobs.ts';

/** What the API needs from the pipeline; injected so tests can fake it. */
export type Pipeline = {
  listSources: () => Promise<SourceInfo[]>;
  loadPurchases: (source: SourceId) => Promise<Purchase[]>;
  previewMatches: (
    source: SourceId,
    options: { since?: IsoDate },
  ) => Promise<ReviewResult>;
  applySelectedMatches: (
    source: SourceId,
    bankTransactionIds: string[],
    options: { since?: IsoDate },
  ) => Promise<number>;
  fetchSource: (
    source: SourceId,
    via: FetchChannel,
    since: IsoDate,
    log: (message: string) => void,
  ) => Promise<number>;
  authGmail: (log: (message: string) => void) => Promise<void>;
};

const FETCH_CHANNELS: readonly string[] = ['email', 'scrape', 'knot'];

function isFetchChannel(value: unknown): value is FetchChannel {
  return typeof value === 'string' && FETCH_CHANNELS.includes(value);
}

function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function oneYearAgo(): IsoDate {
  return new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
}

class HttpError extends Error {
  status: 400 | 404;
  constructor(status: 400 | 404, message: string) {
    super(message);
    this.status = status;
  }
}

function sourceParam(value: string): SourceId {
  if (!isSourceId(value)) throw new HttpError(404, `Unknown source ${value}`);
  return value;
}

export function createApp(
  pipeline: Pipeline,
  jobs: JobRunner = createJobRunner(),
) {
  const app = new Hono().basePath('/api');

  app.onError((error, c) => {
    const status = error instanceof HttpError ? error.status : 500;
    return c.json({ error: error.message }, status);
  });

  app.get('/sources', async c => c.json(await pipeline.listSources()));

  app.get('/sources/:source/purchases', async c =>
    c.json(await pipeline.loadPurchases(sourceParam(c.req.param('source')))),
  );

  app.get('/sources/:source/review', async c => {
    const since = c.req.query('since');
    return c.json(
      await pipeline.previewMatches(sourceParam(c.req.param('source')), {
        since: isIsoDate(since) ? since : undefined,
      }),
    );
  });

  app.post('/sources/:source/apply', async c => {
    const source = sourceParam(c.req.param('source'));
    const body: { bankTransactionIds?: unknown; since?: unknown } =
      await c.req.json();
    const ids = body.bankTransactionIds;
    if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) {
      throw new HttpError(400, 'bankTransactionIds must be a list of ids');
    }
    const written = await pipeline.applySelectedMatches(source, ids, {
      since: isIsoDate(body.since) ? body.since : undefined,
    });
    return c.json({ written });
  });

  app.post('/sources/:source/fetch', async c => {
    const source = sourceParam(c.req.param('source'));
    const body: { via?: unknown; since?: unknown } = await c.req.json();
    if (!isFetchChannel(body.via)) {
      throw new HttpError(
        400,
        `via must be one of ${FETCH_CHANNELS.join(', ')}`,
      );
    }
    const via = body.via;
    const since = isIsoDate(body.since) ? body.since : oneYearAgo();
    const job = jobs.start(`Fetch ${source} via ${via}`, log =>
      pipeline.fetchSource(source, via, since, log),
    );
    return c.json(job, 202);
  });

  app.post('/auth/gmail', c => {
    const job = jobs.start('Connect Gmail', log => pipeline.authGmail(log));
    return c.json(job, 202);
  });

  app.get('/jobs', c => c.json(jobs.list()));

  app.get('/jobs/:id', c => {
    const job = jobs.get(c.req.param('id'));
    if (!job) throw new HttpError(404, 'Unknown job');
    return c.json(job);
  });

  return app;
}

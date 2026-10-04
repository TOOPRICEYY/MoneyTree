import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { serve } from '@hono/node-server';
import {
  applySelectedMatches,
  authGmail,
  fetchSource,
  listSources,
  loadEnv,
  loadPurchases,
  previewMatches,
  ROOT,
} from '@moneytree/pipeline';

import { createApp } from './app.ts';
import { allowedOriginsFromEnv, createServerApp } from './web.ts';

loadEnv();

const PORT = Number(process.env.MONEYTREE_PORT ?? 5007);
const pkg: unknown = JSON.parse(
  readFileSync(join(ROOT, 'package.json'), 'utf8'),
);
const version =
  typeof pkg === 'object' &&
  pkg &&
  'version' in pkg &&
  typeof pkg.version === 'string'
    ? pkg.version
    : '0.0.0';

const app = createServerApp({
  api: createApp({
    listSources,
    loadPurchases: source => loadPurchases(source),
    previewMatches,
    applySelectedMatches,
    fetchSource,
    authGmail,
  }),
  distDir: join(ROOT, 'packages/web/dist'),
  allowedOrigins: allowedOriginsFromEnv(),
  version,
});

// Local only: this server can read your mail and write to your budget.
serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, info => {
  console.log(`MoneyTree UI on http://127.0.0.1:${info.port}`);
});

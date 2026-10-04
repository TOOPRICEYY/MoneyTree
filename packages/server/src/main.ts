import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

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
import { Hono } from 'hono';

import { createApp } from './app.ts';

const PORT = Number(process.env.MONEYTREE_PORT ?? 5007);
const WEB_DIST = join(ROOT, 'packages/web/dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

loadEnv();

const api = createApp({
  listSources,
  loadPurchases: source => loadPurchases(source),
  previewMatches,
  applySelectedMatches,
  fetchSource,
  authGmail,
});

const app = new Hono();
app.route('/', api);

// Serve the built UI; unknown paths fall back to index.html.
app.get('*', async c => {
  const path = normalize(c.req.path).replace(/^(\.\.[/\\])+/, '');
  for (const file of [join(WEB_DIST, path), join(WEB_DIST, 'index.html')]) {
    try {
      const body = await readFile(file);
      return c.body(body, 200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      });
    } catch {
      // try the next candidate
    }
  }
  return c.text('UI not built. Run: yarn ui', 404);
});

// Local only: this server can read your mail and write to your budget.
serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, info => {
  console.log(`MoneyTree UI on http://127.0.0.1:${info.port}`);
});

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Hono } from 'hono';

import { allowedOriginsFromEnv, createServerApp } from './web.ts';

const distDir = mkdtempSync(join(tmpdir(), 'moneytree-dist-'));
writeFileSync(
  join(distDir, 'index.html'),
  '<html><head></head><body></body></html>',
);
mkdirSync(join(distDir, 'assets'));
writeFileSync(join(distDir, 'assets', 'app.js'), 'console.log(1)');

const api = new Hono().basePath('/api');
api.get('/sources', c => c.json([]));

const app = createServerApp({
  api,
  distDir,
  allowedOrigins: ['http://localhost:5006'],
  version: '1.2.3',
});

describe('server app', () => {
  it('reports health', async () => {
    const res = await app.request('/health');
    expect(await res.json()).toEqual({ ok: true, version: '1.2.3' });
  });

  it('allows CORS only for allowed origins', async () => {
    const allowed = await app.request('/api/sources', {
      headers: { Origin: 'http://localhost:5006' },
    });
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5006',
    );
    const other = await app.request('/api/sources', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('serves /embed with framing and isolation headers', async () => {
    const res = await app.request('/embed/review/costco');
    expect(res.headers.get('Content-Security-Policy')).toBe(
      "frame-ancestors 'self' http://localhost:5006",
    );
    expect(res.headers.get('Cross-Origin-Embedder-Policy')).toBe(
      'require-corp',
    );
    expect(await res.text()).toContain(
      '<meta name="moneytree-allowed-origins" content="http://localhost:5006" />',
    );
  });

  it('keeps the standalone app unframeable by other sites', async () => {
    const res = await app.request('/');
    expect(res.headers.get('Content-Security-Policy')).toBe(
      "frame-ancestors 'self'",
    );
    expect(res.headers.get('Cross-Origin-Embedder-Policy')).toBeNull();
  });

  it('marks assets loadable from cross-origin-isolated hosts', async () => {
    const res = await app.request('/assets/app.js');
    expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe(
      'cross-origin',
    );
  });
});

describe('allowedOriginsFromEnv', () => {
  it('defaults to local Actual and reads a comma list', () => {
    expect(allowedOriginsFromEnv({})).toEqual([
      'http://localhost:5006',
      'http://localhost:3001',
    ]);
    expect(
      allowedOriginsFromEnv({
        MONEYTREE_ALLOWED_ORIGINS: 'https://a.test, https://b.test',
      }),
    ).toEqual(['https://a.test', 'https://b.test']);
  });
});

import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import { Hono } from 'hono';
import { cors } from 'hono/cors';

export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5006',
  'http://localhost:3001',
];

/** Origins allowed to embed the UI and call the API (Actual, by default). */
export function allowedOriginsFromEnv(env = process.env): string[] {
  const configured = env.MONEYTREE_ALLOWED_ORIGINS?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

type ServerAppOptions = {
  api: Hono;
  distDir: string;
  allowedOrigins: string[];
  version: string;
};

/**
 * The whole HTTP surface: JSON API (with CORS for allowed hosts), /health,
 * and the built UI. /embed serves the same bundle with headers that let
 * only the allowed origins frame it, and that satisfy Actual's
 * cross-origin isolation (COEP require-corp).
 */
export function createServerApp({
  api,
  distDir,
  allowedOrigins,
  version,
}: ServerAppOptions) {
  const app = new Hono();

  app.use('/api/*', cors({ origin: allowedOrigins }));
  app.use('/health', cors({ origin: allowedOrigins }));
  app.get('/health', c => c.json({ ok: true, version }));
  app.route('/', api);

  app.get('*', async c => {
    const isEmbed = c.req.path === '/embed' || c.req.path.startsWith('/embed/');
    const path = normalize(c.req.path).replace(/^(\.\.[/\\])+/, '');
    const candidates = isEmbed
      ? [join(distDir, 'index.html')]
      : [join(distDir, path), join(distDir, 'index.html')];

    for (const file of candidates) {
      let body: Buffer;
      try {
        body = await readFile(file);
      } catch {
        continue;
      }
      const headers: Record<string, string> = {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        // Assets load inside Actual's cross-origin-isolated page.
        'Cross-Origin-Resource-Policy': 'cross-origin',
      };
      if (extname(file) === '.html') {
        const html = body
          .toString('utf8')
          .replace(
            '</head>',
            `<meta name="moneytree-allowed-origins" content="${allowedOrigins.join(',')}" /></head>`,
          );
        headers['Content-Security-Policy'] = isEmbed
          ? `frame-ancestors 'self' ${allowedOrigins.join(' ')}`
          : "frame-ancestors 'self'";
        if (isEmbed) headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
        return c.body(html, 200, headers);
      }
      return c.body(new Uint8Array(body), 200, headers);
    }
    return c.text('UI not built. Run: yarn ui', 404);
  });

  return app;
}

/**
 * Beatavo — tiny dependency-free static preview server.
 * Serves the repository root over HTTP so ES modules, fetch() and the
 * service worker all work locally.
 *
 * Usage:  npm start        (or: node scripts/serve.mjs)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    let filePath = normalize(join(root, pathname));
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    let info = await stat(filePath).catch(() => null);
    if (info && info.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }

    if (!info) {
      // Serve the friendly 404 page for browser navigations (GitHub Pages does
      // the same), and a plain 404 for everything else.
      const wantsHtml = (req.headers.accept || '').includes('text/html');
      const notFound = join(root, '404.html');
      const notFoundInfo = wantsHtml ? await stat(notFound).catch(() => null) : null;
      if (notFoundInfo) {
        const body = await readFile(notFound);
        res.writeHead(404, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        res.end(body);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Service-Worker-Allowed': '/',
    });
    res.end(body);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Server Error');
  }
});

server.listen(port, () => {
  console.log(`\n  Beatavo is running at http://localhost:${port}/\n`);
});

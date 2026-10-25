import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const privateFile = fileURLToPath(new URL('./.local/snapshot.json', import.meta.url));
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export default defineConfig({
  base: '/checker.dashboard/',
  publicDir: 'public',
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true, cors: false,
    fs: { deny: ['**/.local/**', '**/*.xlsx', '**/*.csv', '**/.env*', '**/.git/**'] },
  },
  preview: { host: '127.0.0.1' },
  plugins: [{
    name: 'private-local-snapshot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!['/__local_snapshot', '/checker.dashboard/__local_snapshot'].includes(req.url?.split('?')[0])) return next();
        const host = req.headers.host || '';
        const origin = req.headers.origin;
        if (req.method !== 'GET' || !loopback.has(req.socket.remoteAddress) || !/^127\.0\.0\.1:\d+$/.test(host) || (origin && origin !== `http://${host}`) || req.headers['x-local-preview'] !== 'snapshot' || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) {
          res.writeHead(403).end(); return;
        }
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        try {
          const content = await readFile(privateFile);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(content);
        } catch {
          res.writeHead(404).end('Local snapshot unavailable. Run the local import first.');
        }
      });
    },
  }],
});

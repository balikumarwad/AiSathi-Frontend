import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = new Set(['index.html', 'styles.css', 'app.js', 'favicon.svg', 'galaxy.png', 'astral.css', 'astral.js']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png':'image/png' };
const port = Number(process.env.PORT || 3010);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!files.has(file)) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const content = await readFile(resolve(root, file));
    response.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(content);
  } catch {
    response.writeHead(500); response.end('Unable to read local asset');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));

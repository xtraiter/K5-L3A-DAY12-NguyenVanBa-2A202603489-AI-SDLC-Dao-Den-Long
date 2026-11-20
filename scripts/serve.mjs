// Zero-dependency static server for the web build. Usage: npm start  (PORT env optional)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};
// Only these top-level folders are served.
const ALLOWED = new Set(['index.html', 'src', 'vendor', 'nhac']);

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    const file = normalize(join(ROOT, path));
    const top = file.slice(ROOT.length + 1).split(sep)[0];
    if (!file.startsWith(ROOT + sep) || !ALLOWED.has(top)) throw Object.assign(new Error(), { code: 'ENOENT' });
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 500);
    res.end('not found');
  }
}).listen(PORT, () => console.log(`Đảo Đèn Lồng: http://localhost:${PORT}`));

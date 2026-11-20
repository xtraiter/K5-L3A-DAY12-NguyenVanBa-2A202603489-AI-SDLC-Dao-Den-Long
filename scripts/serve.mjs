// Zero-dependency local server for the web game + local leaderboard storage.
//   node scripts/serve.mjs                                  -> http://localhost:8080 (PORT env optional)
//   node scripts/serve.mjs --export-leaderboard out.json    -> writes {"entries": [...]} and exits
// Leaderboard file: data/leaderboard.json (LEADERBOARD_FILE env to override). It survives restarts.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, normalize, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { makeEntry, addEntry, sortEntries } from '../src/leaderboard.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const LB_FILE = process.env.LEADERBOARD_FILE || join(ROOT, 'data', 'leaderboard.json');
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
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};
// Only these top-level folders are served.
const ALLOWED = new Set(['index.html', 'src', 'vendor', 'nhac', 'video']);

function loadBoard() {
  try {
    return sortEntries(JSON.parse(readFileSync(LB_FILE, 'utf8')).entries || []);
  } catch {
    return [];
  }
}

// --export-leaderboard out.json
const exp = process.argv.indexOf('--export-leaderboard');
if (exp !== -1) {
  const out = process.argv[exp + 1];
  if (!out) {
    process.stderr.write('error: --export-leaderboard needs an output file\n');
    process.exit(1);
  }
  writeFileSync(out, JSON.stringify({ entries: loadBoard() }, null, 2) + '\n');
  console.log(`exported ${loadBoard().length} entries to ${out}${existsSync(LB_FILE) ? '' : ' (no leaderboard yet)'}`);
  process.exit(0);
}

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

async function api(req, res) {
  if (req.method === 'GET') return json(res, 200, { entries: loadBoard() });
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10000) return json(res, 413, { error: 'too large' });
  }
  try {
    const entry = makeEntry(JSON.parse(body));
    const entries = addEntry(loadBoard(), entry);
    await mkdir(dirname(LB_FILE), { recursive: true });
    await writeFile(LB_FILE, JSON.stringify({ entries }, null, 2) + '\n');
    return json(res, 200, { entries });
  } catch (e) {
    return json(res, 400, { error: e.message });
  }
}

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/api/leaderboard') return await api(req, res);
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
}).listen(PORT, () => {
  console.log(`Đảo Đèn Lồng: http://localhost:${PORT}`);
  // other devices on the same Wi-Fi/LAN can join and share this machine's leaderboard
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${PORT}`);
  if (lan.length) console.log(`Cùng mạng LAN: ${lan.join('  ')}`);
  console.log(`Bảng xếp hạng lưu tại: ${LB_FILE}`);
});

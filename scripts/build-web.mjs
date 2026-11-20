// Build the static web version into dist/ (for Cloudflare Pages or any static host).
// Usage: npm run build:web   ->  dist/{index.html, src/, vendor/, nhac/}
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const p of ['index.html', 'src', 'vendor', 'nhac', 'video']) {
  if (existsSync(join(ROOT, p))) cpSync(join(ROOT, p), join(OUT, p), { recursive: true, filter: (f) => !f.endsWith('headless.mjs') && !f.endsWith('.md') });
}
console.log('built', OUT);

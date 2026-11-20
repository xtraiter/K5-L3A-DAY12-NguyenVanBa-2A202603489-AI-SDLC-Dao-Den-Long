// Visual proof: open the web game in headless Chrome/Edge, press keys, capture console errors
// and screenshots. Needs Node >= 22 (global WebSocket) and a Chromium browser.
// Usage: node scripts/browser-proof.mjs [outDir]   (CHROME=/path/to/chrome to override)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'docs', 'proof', 'phase-1', 'screens');
const PORT = 8123;
const DBG = 9333;
const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browserPath = CANDIDATES.find((p) => existsSync(p));
if (!browserPath) throw new Error('No Chromium browser found; set CHROME=...');
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [join(ROOT, 'scripts', 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) } });
const browser = spawn(browserPath, [
  '--headless=new', `--remote-debugging-port=${DBG}`, '--window-size=1280,720',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-chrome-'))}`, 'about:blank',
]);
const cleanup = () => { browser.kill(); server.kill(); };

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await wait(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${DBG}/json`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {}
  }
  if (!target) throw new Error('browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const key = async (k, code, down = true) => send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: k, code, windowsVirtualKeyCode: k === 'Enter' ? 13 : k.toUpperCase().charCodeAt(0) });
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'));
    console.log('saved', join(OUT, name));
  };
  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: `http://localhost:${PORT}/` });
  await wait(2500);
  await shot('01-title.png');
  await key('Enter', 'Enter'); await key('Enter', 'Enter', false);
  await wait(1000);
  await shot('02-start.png');
  await key('w', 'KeyW');
  await wait(2500);
  await key('w', 'KeyW', false);
  await shot('03-moved.png');
  const hud = await evalJs(`[...document.querySelectorAll('#hud .box')].map(e => e.textContent).join(' | ')`);
  console.log('HUD:', hud);
  writeFileSync(join(OUT, 'console.txt'), `HUD: ${hud}\nerrors: ${errors.length}\n${errors.join('\n')}\n`);
  console.log('console errors:', errors.length ? errors : 'none');
  ws.close();
  cleanup();
  process.exit(errors.length ? 1 : 0);
} catch (e) {
  cleanup();
  console.error(e);
  process.exit(1);
}

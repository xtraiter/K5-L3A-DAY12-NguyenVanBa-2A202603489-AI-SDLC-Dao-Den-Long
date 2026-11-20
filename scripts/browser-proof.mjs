// Visual proof: open the web game in headless Chrome/Edge, play each night briefly, capture
// screenshots, average FPS at 1280x720 and console errors. Needs Node >= 22 (global WebSocket).
// Usage: node scripts/browser-proof.mjs [outDir]   (CHROME=/path/to/chrome, GPU=1 to use the real GPU)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'docs', 'proof', 'phase-2', 'screens');
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
const gpuFlags = process.env.GPU ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = spawn(browserPath, [
  '--headless=new', `--remote-debugging-port=${DBG}`, '--window-size=1280,720', ...gpuFlags,
  '--no-first-run', '--autoplay-policy=no-user-gesture-required',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-chrome-'))}`, 'about:blank',
]);
const cleanup = () => {
  browser.kill();
  server.kill();
};

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
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const VK = { Enter: 13, Escape: 27, Shift: 16, ' ': 32 };
  const key = (k, code, down = true) =>
    send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: k, code, windowsVirtualKeyCode: VK[k] ?? k.toUpperCase().charCodeAt(0) });
  const tap = async (k, code) => {
    await key(k, code);
    await wait(80);
    await key(k, code, false);
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, name), Buffer.from(r.result.data, 'base64'));
    console.log('saved', join(OUT, name));
  };
  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;
  const go = async (q) => {
    await send('Page.navigate', { url: `http://localhost:${PORT}/${q}` });
    await wait(2500);
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await go('');
  await shot('01-menu.png');
  await go('?night=2');
  await shot('02-intro.png');

  const report = [];
  for (const n of [1, 2, 3]) {
    await go(`?night=${n}&play`);
    await evalJs('window.__ddl.fps.samples.length = 0');
    await key('w', 'KeyW');
    await wait(1500);
    await tap('Shift', 'ShiftLeft');
    await wait(1000);
    await key('w', 'KeyW', false);
    await tap(' ', 'Space');
    await wait(2500);
    await shot(`0${n + 2}-night${n}.png`);
    const fps = await evalJs('window.__ddl.fps.samples.slice(1)');
    const hud = await evalJs(
      `[...document.querySelectorAll('#hud > *')].filter(e => !e.classList.contains('hidden')).map(e => e.textContent.trim()).filter(Boolean).join(' | ')`,
    );
    const avg = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
    report.push(`night ${n}: avg FPS ${avg.toFixed(1)} over ${fps.length}s (samples ${fps.map((f) => f.toFixed(0)).join(',')})\n  HUD: ${hud}`);
  }
  await go('?night=1&play');
  await tap('Escape', 'Escape');
  await wait(500);
  await shot('06-pause.png');

  const text = `browser: ${browserPath} (${process.env.GPU ? 'GPU' : 'SwiftShader software rendering'})\nviewport 1280x720\n${report.join('\n')}\nconsole errors: ${errors.length}\n${errors.join('\n')}\n`;
  writeFileSync(join(OUT, 'console.txt'), text);
  console.log(text);
  ws.close();
  cleanup();
  process.exit(errors.length ? 1 : 0);
} catch (e) {
  cleanup();
  console.error(e);
  process.exit(1);
}

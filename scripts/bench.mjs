#!/usr/bin/env node
// Benchmark (Ticket-04 §1): node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
// Opens the web build in a 1280x720 Chrome/Edge window (not fullscreen) with vsync and the frame-rate
// limiter disabled, runs the standard bench scene (?bench), waits 3 s warm-up + duration, writes bench.json.
// Needs Node >= 22 and Chrome/Chromium/Edge (CHROME=/path to override). HEADLESS=1 runs without a window.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const T0 = Date.now(); // "process start" for load_ms
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = { seed: 42, duration: 30, out: 'bench.json' };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  const k = argv[i].replace(/^--/, '');
  if (!(k in args) || argv[i + 1] === undefined) {
    process.stderr.write(`error: bad argument ${argv[i]}\n`);
    process.exit(1);
  }
  args[k] = k === 'out' ? argv[i + 1] : Number(argv[i + 1]);
}
const PORT = 8124;
const DBG = 9334;
const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const browserPath = CANDIDATES.find((p) => existsSync(p));
if (!browserPath) {
  process.stderr.write('error: Chrome/Chromium/Edge not found; set CHROME=/path/to/browser\n');
  process.exit(1);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(os.tmpdir(), 'ddl-bench-'));
const server = spawn(process.execPath, [join(ROOT, 'scripts', 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const url = `http://localhost:${PORT}/?bench&seed=${args.seed}&duration=${args.duration}`;
const browser = spawn(
  browserPath,
  [
    ...(process.env.HEADLESS ? ['--headless=new'] : [`--app=${url}`]),
    `--remote-debugging-port=${DBG}`,
    '--window-size=1280,760', // 1280x720 page area + window title bar; the canvas is fixed at 1280x720
    '--window-position=40,40',
    '--disable-gpu-vsync',
    '--disable-frame-rate-limit',
    '--ignore-gpu-blocklist',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    `--user-data-dir=${profile}`,
    ...(process.env.HEADLESS ? [url] : []),
  ],
  { stdio: 'ignore' },
);

// RSS of every browser process that uses our private profile (sum), in MB; null if not measurable.
function browserRssMb() {
  try {
    if (process.platform === 'win32') {
      const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${profile.replace(/'/g, "''")}*' } | Measure-Object -Property WorkingSetSize -Sum | ForEach-Object { $_.Sum }`;
      const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 8000 }).trim();
      return out ? Number(out) / 1048576 : null;
    }
    const out = execFileSync('ps', ['-axo', 'rss=,command='], { encoding: 'utf8', maxBuffer: 1 << 24 });
    const kb = out
      .split('\n')
      .filter((l) => l.includes(profile))
      .reduce((s, l) => s + Number(l.trim().split(/\s+/)[0] || 0), 0);
    return kb ? kb / 1024 : null;
  } catch {
    return null;
  }
}

const cleanup = () => {
  try {
    browser.kill();
  } catch {}
  try {
    server.kill();
  } catch {}
};

try {
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    await wait(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${DBG}/json`)).json();
      target = list.find((t) => t.type === 'page' && t.url.includes('bench'));
    } catch {}
  }
  if (!target) throw new Error('browser did not open the bench page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r, { once: true });
    ws.addEventListener('error', j, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const evalJs = (expression) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, (msg) => r(msg.result?.result?.value));
      ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });

  let peak = null;
  let result = null;
  const deadline = Date.now() + (args.duration + 90) * 1000;
  while (!result && Date.now() < deadline) {
    await wait(1000);
    const started = await evalJs('!!(window.__ddl && window.__ddl.mode === "bench")');
    if (started) {
      const rss = browserRssMb();
      if (rss !== null) peak = Math.max(peak ?? 0, rss);
    }
    result = await evalJs('window.__benchResult || null');
  }
  if (!result) throw new Error('bench did not finish in time');
  const cpu = os.cpus()[0]?.model?.trim() || 'unknown CPU';
  const report = {
    contract_version: '1.3',
    avg_fps: result.avg_fps,
    p1_low_fps: result.p1_low_fps,
    frame_ms_p95: result.frame_ms_p95,
    frames: result.frames,
    load_ms: Math.round(result.first_frame_epoch_ms - T0),
    peak_mem_mb: peak === null ? null : Math.round(peak),
    vsync_off: true,
    renderer: `${result.renderer}; ${browserPath.split(/[\\/]/).pop()} (${process.env.HEADLESS ? 'headless' : 'window'} 1280x720, --disable-gpu-vsync --disable-frame-rate-limit)`,
    os: `${os.type()} ${os.release()} ${os.arch()}; ${cpu}; ${Math.round(os.totalmem() / 1073741824)} GB RAM`,
    seed: args.seed,
    duration_s: args.duration,
    notes: 'peak_mem_mb = summed RSS of all browser processes of this run (sampled every 1 s); js_heap_peak_mb = JS heap of the page',
    js_heap_peak_mb: result.js_heap_peak_mb,
  };
  writeFileSync(args.out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  ws.close();
  cleanup();
  await wait(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
  process.exit(0);
} catch (e) {
  cleanup();
  process.stderr.write(`error: ${e.message}\n`);
  process.exit(1);
}

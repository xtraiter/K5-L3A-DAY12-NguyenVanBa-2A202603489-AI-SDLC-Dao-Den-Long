// Records the menu background video: a flyover of the three islands (?flyover) with the demo bot playing.
//   node scripts/record-menu-video.mjs [out=video/menu.mp4]
// Needs Chrome/Edge and ffmpeg on PATH (FFMPEG=/path to override). Output: 1280x720 H.264, no audio, ~27 s loop.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'video', 'menu.mp4');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PORT = 8125;
const DBG = 9335;
const browserPath = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean).find((p) => existsSync(p));
if (!browserPath) throw new Error('Chrome/Edge not found (set CHROME=...)');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frames = mkdtempSync(join(tmpdir(), 'ddl-frames-'));
const server = spawn(process.execPath, [join(ROOT, 'scripts', 'serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const browser = spawn(browserPath, [
  '--headless=new', `--remote-debugging-port=${DBG}`, '--window-size=1280,720', '--ignore-gpu-blocklist', '--enable-gpu',
  '--hide-scrollbars', '--no-first-run', '--mute-audio', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-rec-'))}`, 'about:blank',
], { stdio: 'ignore' });
const cleanup = () => {
  browser.kill();
  server.kill();
};

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await wait(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${DBG}/json`)).json()).find((t) => t.type === 'page');
    } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const shots = [];
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Page.screencastFrame') {
      const { data, metadata, sessionId } = msg.params;
      const file = join(frames, `f${String(shots.length).padStart(5, '0')}.jpg`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      shots.push({ file, t: metadata.timestamp });
      ws.send(JSON.stringify({ id: ++id, method: 'Page.screencastFrameAck', params: { sessionId } }));
    }
  });
  await send('Page.enable');
  await send('Page.navigate', { url: `http://localhost:${PORT}/?flyover` });
  await wait(2500);
  await send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
  const deadline = Date.now() + 60000;
  for (;;) {
    await wait(500);
    const r = await send('Runtime.evaluate', { expression: '!!window.__flyoverDone', returnByValue: true });
    if (r.result.result.value || Date.now() > deadline) break;
  }
  await send('Page.stopScreencast');
  ws.close();
  cleanup();
  if (shots.length < 30) throw new Error(`only ${shots.length} frames captured`);
  // concat list with real per-frame durations (screencast frames are not evenly spaced)
  const list = shots
    .map((s, i) => `file '${s.file.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, ((shots[i + 1]?.t ?? s.t + 1 / 30) - s.t)).toFixed(4)}`)
    .join('\n');
  writeFileSync(join(frames, 'list.txt'), `${list}\nfile '${shots.at(-1).file.replace(/\\/g, '/')}'\n`);
  mkdirSync(dirname(OUT), { recursive: true });
  const ff = spawnSync(
    FFMPEG,
    ['-y', '-f', 'concat', '-safe', '0', '-i', join(frames, 'list.txt'), '-vf', 'fps=30,scale=1280:720,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-movflags', '+faststart', '-an', OUT],
    { encoding: 'utf8' },
  );
  if (ff.status !== 0) throw new Error(`ffmpeg failed: ${ff.stderr.split('\n').slice(-5).join('\n')}`);
  rmSync(frames, { recursive: true, force: true });
  console.log(`wrote ${OUT} from ${shots.length} frames`);
  process.exit(0);
} catch (e) {
  cleanup();
  console.error(e);
  process.exit(1);
}

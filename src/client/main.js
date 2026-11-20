// Browser client: screens, input, HUD, rendering of the shared Sim. Gameplay rules live in src/sim only.
import * as THREE from 'three';
import { Sim, distXZ } from '../sim/sim.js';
import { TUNING, RULES, TICK_RATE } from '../sim/config.js';
import { NIGHTS } from '../sim/maps.js';
import { mulberry32 } from '../sim/rng.js';
import { GameAudio } from './audio.js';
import { C, buildTerrain, makeLantern, makePlayer, makeMote, makeShade, makeDrifter, makeCharm, setShadePalette } from './world.js';
import { DemoBot } from './demo-bot.js';
import { validName, makeEntry, addEntry, sortEntries } from '../leaderboard.js';
import { ACTIONS, DEFAULT_KEYS, keyLabel, mountKeybinds, Captions } from './a11y.js';
import { makeBenchSim, frameStats, BENCH } from '../sim/bench-scene.js';
import { NEUTRAL_INPUT } from '../sim/sim.js';
import { Particles, Fireflies, makeSky } from './fx.js';

const $ = (id) => document.getElementById(id);
const DT = 1 / TICK_RATE;
const params = new URLSearchParams(location.search);

const STORY = {
  1: 'Mây à, sương đen đã nuốt hết đèn của Đảo Bến rồi. Con gom đom đóm, thắp lại năm ngọn Đèn Lồng Lớn trước khi trời sáng nhé. Bóng Mực sợ đèn đã sáng, cứ đứng gần đèn mà thở.',
  2: 'Đảo Cau có hai nửa, nối nhau bằng cây cầu tre không lan can. Bục gió vàng sẽ hất con qua biển mây. Coi chừng Gió Lạc: nó thấy ai mang nhiều ánh sáng là bám theo cướp đó.',
  3: 'Đêm cuối rồi con. Đảo Chuông có ba tầng, dốc gỗ dẫn lên tầng giữa, bục gió đưa lên đỉnh. Gió mạnh thổi từng cơn, nghe lá bay là bám chắc chân. Thắp đủ bảy ngọn, chuông sẽ gọi bình minh về.',
};

// ---------- settings ----------
// fpsCap: 0 = unlimited (vsync); scale: render resolution multiplier; cb: colour-blind palette
const settings = { volume: 0.7, sens: 0.15, fpsCap: 60, showFps: false, scale: 1, cb: false };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}'));
} catch {}
const saveSettings = () => {
  try {
    localStorage.setItem('ddl-settings', JSON.stringify(settings));
  } catch {}
};

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.FogExp2(C.fog, 0.022);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
// Any aspect ratio: keep at least the horizontal view of a 16:10 screen on tall/portrait screens
// (vertical FOV grows), keep 60° vertical on wide/ultrawide screens.
const BENCH_MODE = params.has('bench'); // Ticket-04 benchmark scene (scripts/bench.mjs)
function fitView() {
  if (BENCH_MODE) {
    // fixed 1280x720 drawing buffer, pixel ratio 1, 60° vertical FOV, whatever the window chrome is
    renderer.setPixelRatio(1);
    renderer.setSize(1280, 720);
    camera.aspect = 1280 / 720;
    camera.fov = 60;
    camera.updateProjectionMatrix();
    return;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  const minAspect = 1.6;
  camera.aspect = aspect;
  camera.fov = aspect >= minAspect ? 60 : (2 * Math.atan((Math.tan(Math.PI / 6) * minAspect) / aspect) * 180) / Math.PI;
  camera.fov = Math.min(camera.fov, 100);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * settings.scale);
  renderer.setSize(w, h);
  document.body.classList.toggle('portrait', aspect < 1);
  document.body.classList.toggle('short', h < 600);
}
window.addEventListener('resize', fitView);
fitView();
const ambient = new THREE.AmbientLight(0xc9c2ff, 0.15);
const moon = new THREE.DirectionalLight(0x8f9ad6, 0.35);
moon.position.set(-30, 60, -20);
scene.add(ambient, moon);
makeSky(scene);
const particles = new Particles(scene);
const fireflies = new Fireflies(scene);
let shake = 0;

const audio = new GameAudio();
audio.setVolume(settings.volume);

// ---------- world state ----------
let sim = null;
let demoBot = null; // menu attract mode
let shadeRimColor = C.shadeRim;
function applyColorBlind() {
  shadeRimColor = setShadePalette(settings.cb);
  document.body.classList.toggle('cb', !!settings.cb);
}
applyColorBlind();
// Optional menu background video: drop video/menu.mp4 to use it instead of the live demo.
let menuVideo = null;
{
  const v = document.getElementById('menu-video');
  v.addEventListener('loadeddata', () => {
    menuVideo = v;
    v.classList.remove('hidden');
  }, { once: true });
  v.addEventListener('error', () => v.remove(), { once: true });
  fetch('./video/menu.mp4', { method: 'HEAD' })
    .then((r) => {
      if (r.ok && (r.headers.get('content-type') || '').startsWith('video')) v.src = './video/menu.mp4';
      else v.remove();
    })
    .catch(() => v.remove());
}
let night = 1;
let totalScore = 0;
let mode = 'menu';
let terrain = null;
let lanternMeshes = [];
const moteMeshes = new Map();
const shadeMeshes = new Map();
const drifterMeshes = new Map();
const charmMeshes = new Map();
const player = makePlayer();
scene.add(player);
const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.92, 1, 64),
  new THREE.MeshBasicMaterial({ color: C.core, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseFx = 1;
const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.25, 0.15), new THREE.MeshBasicMaterial({ color: 0x7fa65a, side: THREE.DoubleSide }), 60);
leaves.visible = false;
scene.add(leaves);
const leafRng = mulberry32(99);
const leafSeeds = Array.from({ length: 60 }, () => [leafRng() * 30 - 15, leafRng() * 6, leafRng() * 30 - 15, leafRng() * 6]);

function clearMap(map) {
  for (const m of map.values()) scene.remove(m);
  map.clear();
}

function loadNight(n, seed = (Date.now() & 0x7fffffff) >>> 0) {
  night = n;
  sim = new Sim({ seed, night: n });
  demoBot = new DemoBot();
  sim.drainEvents();
  if (terrain) scene.remove(terrain);
  terrain = buildTerrain(sim.map, mulberry32(n * 1000 + 7));
  scene.add(terrain);
  for (const m of lanternMeshes) scene.remove(m.group);
  lanternMeshes = sim.lanterns.map((l) => {
    const m = makeLantern(l);
    scene.add(m.group);
    return m;
  });
  [moteMeshes, shadeMeshes, drifterMeshes, charmMeshes].forEach(clearMap);
  camYaw = 0;
  lastCountdown = -1;
  for (const k of Object.keys(hudCache)) delete hudCache[k];
}

// ---------- progress (unlocked nights, best scores) ----------
const progress = { unlocked: 1, best: {} };
try {
  Object.assign(progress, JSON.parse(localStorage.getItem('ddl-progress') || '{}'));
} catch {}
const saveProgress = () => {
  try {
    localStorage.setItem('ddl-progress', JSON.stringify(progress));
  } catch {}
};
function renderNightCards() {
  $('night-cards').innerHTML = [1, 2, 3]
    .map((n) => {
      const open = n <= progress.unlocked;
      const best = progress.best[n];
      return `<button class="night" data-act="night" data-night="${n}" ${open ? '' : 'disabled'}>
        <small>Đêm ${n}</small><b>${NIGHTS[n].name}</b>
        <small class="${best ? 'best' : ''}">${open ? (best ? `Kỷ lục ${best}` : 'Chưa thắp') : 'Chưa mở'}</small></button>`;
    })
    .join('');
}

// ---------- screens ----------
const SCREENS = ['scr-menu', 'scr-intro', 'scr-result', 'scr-dawn', 'scr-pause', 'scr-settings', 'scr-board'];

// ---------- run tracking + leaderboard (Ticket-04 §3) ----------
let runSeed = 0;
let nightsWon = 0;
const newRun = () => {
  runSeed = (Date.now() & 0xfffffff) >>> 0;
  nightsWon = 0;
  totalScore = 0;
};
const LOCAL_LB = 'ddl-leaderboard';
const localBoard = () => {
  try {
    return sortEntries(JSON.parse(localStorage.getItem(LOCAL_LB) || '{"entries":[]}').entries);
  } catch {
    return [];
  }
};
// The local server stores the board on disk (data/leaderboard.json); a static host (Cloudflare) falls back to localStorage.
async function fetchBoard() {
  try {
    const r = await fetch('./api/leaderboard', { cache: 'no-store' });
    if (r.ok) return { entries: (await r.json()).entries, where: 'tệp data/leaderboard.json trên máy' };
  } catch {}
  return { entries: localBoard(), where: 'bộ nhớ trình duyệt' };
}
async function saveScore(name) {
  const payload = { name, score: totalScore, nights_won: nightsWon, seed: runSeed };
  const entry = makeEntry(payload); // validates
  try {
    const r = await fetch('./api/leaderboard', { method: 'POST', body: JSON.stringify(payload) });
    if (r.ok) return { entries: (await r.json()).entries, entry };
    if (r.status === 400) throw new Error((await r.json()).error);
  } catch (e) {
    if (e.message && !/fetch|network|JSON/i.test(e.message)) throw e;
  }
  const entries = addEntry(localBoard(), entry);
  try {
    localStorage.setItem(LOCAL_LB, JSON.stringify({ entries }));
  } catch {}
  return { entries, entry };
}
async function showBoard(highlight) {
  mode = 'board';
  show('scr-board');
  const { entries, where } = await fetchBoard();
  $('board-rows').innerHTML = entries.length
    ? entries
        .map((e, i) => {
          const me = highlight && e.name === highlight.name && e.achieved_at === highlight.achieved_at && e.score === highlight.score;
          const date = e.achieved_at.slice(0, 16).replace('T', ' ');
          return `<tr class="${me ? 'me' : ''}"><td>${i + 1}</td><td>${e.name.replace(/[<>&]/g, '')}</td><td>${e.score}</td><td>${e.nights_won}</td><td>${date}</td></tr>`;
        })
        .join('')
    : '<tr><td colspan="5">Chưa có ai. Hãy là người đầu tiên!</td></tr>';
  $('board-note').textContent = `Lưu tại: ${where}.`;
}
function resetSaveForms() {
  for (const f of document.querySelectorAll('[data-save]')) {
    f.querySelector('input').value = '';
    f.querySelector('input').disabled = false;
    f.querySelector('button').disabled = false;
    f.querySelector('.savemsg').textContent = '';
    f.querySelector('.savemsg').classList.remove('err');
  }
}
for (const f of document.querySelectorAll('[data-save]')) {
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = f.querySelector('.savemsg');
    const name = f.querySelector('input').value.trim();
    if (!validName(name)) {
      msg.textContent = `${settings.cb ? '⚠ ' : ''}Tên phải dài 3–12 ký tự, chỉ gồm chữ, số hoặc _`;
      msg.classList.add('err');
      return;
    }
    try {
      f.querySelector('button').disabled = true;
      const { entry } = await saveScore(name);
      f.querySelector('input').disabled = true;
      showBoard(entry);
    } catch (err) {
      f.querySelector('button').disabled = false;
      msg.textContent = err.message;
      msg.classList.add('err');
    }
  });
}
// Menu music (nhac/maintheme.mp3): browsers only allow audio after a user gesture.
const menuMusic = () => {
  if (mode === 'menu' || mode === 'board' || (mode === 'settings-menu')) {
    audio.unlock();
    audio.playBgm();
  }
};
window.addEventListener('pointerdown', menuMusic);
window.addEventListener('keydown', menuMusic);
let settingsReturn = 'scr-menu';
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', mode !== 'playing');
  if (menuVideo) {
    const on = id === 'scr-menu';
    menuVideo.classList.toggle('hidden', !on);
    if (on) menuVideo.play().catch(() => {});
    else menuVideo.pause();
  }
  if (id) {
    releaseMouse();
    $(id).querySelector('button:not(:disabled)')?.focus();
  }
}

function goMenu() {
  mode = 'menu';
  loadNight(1);
  renderNightCards();
  show('scr-menu');
  audio.playBgm(); // menu theme (keeps playing if already on)
}
let typer = 0;
function goIntro(n) {
  loadNight(n, (runSeed + n) >>> 0);
  resetSaveForms();
  mode = 'intro';
  $('intro-num').textContent = String(n).padStart(2, '0');
  $('intro-night').textContent = `Đêm ${n} / 3`;
  $('intro-name').textContent = NIGHTS[n].name;
  const text = `“${STORY[n]}”`;
  let i = 0;
  clearInterval(typer);
  $('intro-quote').textContent = '';
  typer = setInterval(() => {
    i += 2;
    $('intro-quote').textContent = text.slice(0, i);
    if (i >= text.length) clearInterval(typer);
  }, 18);
  show('scr-intro');
}
function startPlay() {
  clearInterval(typer);
  audio.unlock();
  mode = 'playing';
  show(null);
  lockMouse();
  audio.stopBgm(); // the theme plays in the menu only
}
function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  audio.play('paused');
  show('scr-pause');
}
function resume() {
  mode = 'playing';
  show(null);
  lockMouse();
}
function finishNight(result, reason) {
  mode = 'result';
  audio.stopBgm();
  audio.play(result);
  const won = result === 'won';
  const p = sim.player;
  $('scr-result').querySelector('[data-save]').classList.toggle('hidden', won); // save after a loss, or at dawn
  if (won) {
    nightsWon += 1;
    totalScore += sim.score;
    progress.unlocked = Math.max(progress.unlocked, Math.min(3, night + 1));
    progress.best[night] = Math.max(progress.best[night] || 0, sim.score);
    saveProgress();
  }
  if (won && night === 3) {
    mode = 'dawn';
    $('dawn-score').textContent = totalScore;
    show('scr-dawn');
    return;
  }
  const why = {
    dawn_survived: 'Bình minh đã tới, đảo vẫn sáng.',
    dawn: `Bình minh tới mà chưa đủ ${sim.litNeeded()} đèn sáng…`,
    no_flames: 'Ngọn lửa của Mây đã tắt…',
  };
  const t = Math.floor(sim.timeLeft());
  const lit = sim.lanterns.filter((l) => l.lit).length;
  $('res-eyebrow').textContent = `Đêm ${night} · ${NIGHTS[night].name}`;
  $('res-title').textContent = won ? 'Đảo đã sáng lại!' : 'Đêm chưa qua…';
  $('res-text').textContent = why[reason];
  $('res-stats').innerHTML = [
    ['Đèn đang sáng', `${lit}/${sim.lanterns.length} (cần ${sim.litNeeded()})`],
    ['Ngọn Lửa còn', p.flames],
    ['Thời gian còn', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`],
    ['Điểm đêm này', won ? sim.score : 0],
  ]
    .map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`)
    .join('') + `<div class="stat total"><small>Tổng điểm hành trình</small><b>${totalScore}</b></div>`;
  $('res-next').classList.toggle('hidden', !won);
  $('res-retry').classList.toggle('primary', !won);
  show('scr-result');
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  const act = b?.dataset.act;
  if (!act) {
    if (mode === 'playing' && !document.pointerLockElement) lockMouse();
    return;
  }
  audio.unlock();
  audio.play('ui');
  if (act === 'new') {
    newRun();
    goIntro(1);
  } else if (act === 'night') {
    newRun();
    goIntro(Number(b.dataset.night));
  } else if (act === 'leaderboard') showBoard();
  else if (act === 'play') startPlay();
  else if (act === 'next') goIntro(night + 1);
  else if (act === 'retry') goIntro(night);
  else if (act === 'menu') goMenu();
  else if (act === 'resume') resume();
  else if (act === 'settings') {
    settingsReturn = mode === 'paused' ? 'scr-pause' : 'scr-menu';
    show('scr-settings');
  } else if (act === 'back') show(settingsReturn);
});
settings.sens = Math.min(0.5, Math.max(0.02, settings.sens > 0.5 ? 0.15 : settings.sens));
const syncSettingsUi = () => {
  $('set-volume').value = settings.volume;
  $('set-sens').value = settings.sens;
  $('out-volume').textContent = `${Math.round(settings.volume * 100)}%`;
  $('out-sens').textContent = settings.sens.toFixed(2);
  $('set-fps').value = String(settings.fpsCap);
  $('set-showfps').checked = !!settings.showFps;
  $('set-scale').value = settings.scale;
  $('out-scale').textContent = `${Math.round(settings.scale * 100)}%`;
  $('set-cb').checked = !!settings.cb;
  $('fps').classList.toggle('hidden', !settings.showFps);
};
syncSettingsUi();
$('set-volume').addEventListener('input', (e) => {
  settings.volume = Number(e.target.value);
  audio.setVolume(settings.volume);
  syncSettingsUi();
  saveSettings();
});
$('set-sens').addEventListener('input', (e) => {
  settings.sens = Number(e.target.value);
  syncSettingsUi();
  saveSettings();
});
const onSetting = (id, key, read, after) =>
  $(id).addEventListener(id === 'set-scale' ? 'input' : 'change', (e) => {
    settings[key] = read(e.target);
    after?.();
    syncSettingsUi();
    saveSettings();
  });
onSetting('set-fps', 'fpsCap', (t) => Number(t.value));
onSetting('set-showfps', 'showFps', (t) => t.checked);
onSetting('set-scale', 'scale', (t) => Number(t.value), fitView);
onSetting('set-cb', 'cb', (t) => t.checked, () => {
  applyColorBlind();
  for (const k of Object.keys(hudCache)) delete hudCache[k];
});

// ---------- input ----------
const held = new Set();
const latched = new Set();
let camYaw = 0;
let camPitch = 0.42; // client-only camera tilt (radians); not part of the contract input
// Key bindings (Ticket-04 §4): physical key codes, rebindable in Settings, saved with the settings.
settings.keys = { ...DEFAULT_KEYS, ...(settings.keys || {}) };
const kb = mountKeybinds($('keybinds'), settings.keys, () => {
  saveSettings();
  renderKeyHints();
});
function renderKeyHints() {
  const k = settings.keys;
  $('cd-dash').querySelector('kbd').textContent = keyLabel(k.dash);
  $('cd-pulse').querySelector('kbd').textContent = keyLabel(k.pulse);
  $('scr-menu').querySelector('.keys').innerHTML =
    `<span><kbd>${keyLabel(k.up)}</kbd><kbd>${keyLabel(k.left)}</kbd><kbd>${keyLabel(k.down)}</kbd><kbd>${keyLabel(k.right)}</kbd> đi</span>` +
    `<span>Chuột: camera</span><span><kbd>${keyLabel(k.jump)}</kbd> nhảy</span><span><kbd>${keyLabel(k.dash)}</kbd> lướt</span>` +
    `<span><kbd>${keyLabel(k.interact)}</kbd> nạp đèn</span><span><kbd>${keyLabel(k.pulse)}</kbd> tỏa sáng</span><span><kbd>${keyLabel(k.pause)}</kbd> tạm dừng</span>`;
}
const isKey = (action, code) => settings.keys[action] === code;
onSetting('set-motion', 'reduceMotion', (t) => t.checked);
onSetting('set-bigtext', 'bigText', (t) => t.checked, () => document.body.classList.toggle('bigtext', !!settings.bigText));
document.body.classList.toggle('bigtext', !!settings.bigText);
$('set-motion').checked = !!settings.reduceMotion;
$('set-bigtext').checked = !!settings.bigText;
const captions = new Captions($('captions'));

// Pointer lock: hide the cursor while playing; mouse movement turns the camera.
let lockedOnce = false;
function lockMouse() {
  const el = renderer.domElement;
  if (document.pointerLockElement === el || !el.requestPointerLock) return;
  try {
    const r = el.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch {}
}
function releaseMouse() {
  if (document.pointerLockElement) document.exitPointerLock();
}
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  document.body.classList.toggle('locked', locked);
  if (locked) lockedOnce = true;
  else if (mode === 'playing' && lockedOnce) pause(); // Esc releases the lock -> pause
});
window.addEventListener('mousemove', (e) => {
  if (mode !== 'playing' || document.pointerLockElement !== renderer.domElement) return;
  camYaw -= e.movementX * settings.sens;
  camPitch = Math.min(1.1, Math.max(0.05, camPitch + e.movementY * settings.sens * 0.01));
});

const visibleButtons = () => [...document.querySelectorAll('.screen:not(.hidden) button:not(:disabled):not(.hidden)')];
window.addEventListener('keydown', (e) => {
  if (kb.isCapturing() || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const code = e.code;
  const settingsOpen = !$('scr-settings').classList.contains('hidden');
  if ((isKey('pause', code) || code === 'Escape') && !e.repeat) {
    if (mode === 'playing') return pause();
    if (settingsOpen) return show(settingsReturn);
    if (mode === 'paused') return resume();
  }
  if (code === 'Enter' && mode === 'intro') {
    e.preventDefault();
    return startPlay();
  }
  if (mode !== 'playing' && (code === 'ArrowDown' || code === 'ArrowUp')) {
    const bs = visibleButtons();
    const i = bs.indexOf(document.activeElement);
    bs[(i + (code === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]?.focus();
    e.preventDefault();
    return;
  }
  if (mode === 'playing') e.preventDefault();
  held.add(code);
  latched.add(code);
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => {
  held.clear();
  pause();
});
const down = (action) => held.has(settings.keys[action]);
const pressed = (action) => held.has(settings.keys[action]) || latched.has(settings.keys[action]);
function buildInput() {
  const bound = new Set(Object.values(settings.keys));
  if (held.has('ArrowLeft') && !bound.has('ArrowLeft')) camYaw += 120 * DT;
  if (held.has('ArrowRight') && !bound.has('ArrowRight')) camYaw -= 120 * DT;
  const kx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
  const kz = (down('up') ? 1 : 0) - (down('down') ? 1 : 0);
  // Camera looks along +Z at yaw 0, so screen-right is world -X.
  return { move: [-kx, kz], cam_yaw_deg: camYaw, jump: pressed('jump'), interact: pressed('interact'), pulse: pressed('pulse'), dash: pressed('dash'), pause: false };
}

// ---------- events -> sound/fx ----------
let lastCountdown = -1;
const toScreen = (pos, dy = 0) => {
  v3.set(pos[0], pos[1] + dy, pos[2]).project(camera);
  return [((v3.x + 1) / 2) * window.innerWidth, ((1 - v3.y) / 2) * window.innerHeight, v3.z < 1];
};
function floater(text, pos, color = '#F2C14E', dy = 2) {
  const [x, y, vis] = toScreen(pos, dy);
  if (!vis) return;
  const el = document.createElement('div');
  el.className = 'floater';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color;
  $('floaters').append(el);
  setTimeout(() => el.remove(), 1200);
}
let toastTimer = 0;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}
function vignette(kind) {
  if (settings.reduceMotion) return; // reduced motion: no screen flashes
  const v = $('vignette');
  v.className = kind;
  requestAnimationFrame(() => requestAnimationFrame(() => (v.className = '')));
}
const lanternById = (id) => sim.lanterns.find((l) => l.id === id);
function handleEvents(events, demo = false) {
  const p = sim.player;
  const at = [p.pos[0], p.pos[1] + 1, p.pos[2]];
  for (const ev of events) {
    const d = ev.data;
    if (demo) {
      // menu attract mode: visuals only, no sound, no HUD text
      if (ev.name === 'lantern_lit') {
        const l = lanternById(d.lantern_id);
        particles.emit([l.pos[0], l.pos[1] + 4.3, l.pos[2]], { n: 140, color: C.lit, speed: 9, up: 3, life: 1.4, gravity: 4 });
      } else if (ev.name === 'pulse') pulseFx = 0;
      continue;
    }
    switch (ev.name) {
      case 'game_over':
        if (d.result === 'won') audio.play('bell');
        finishNight(d.result, d.reason);
        continue;
      case 'refuel': {
        const l = lanternById(d.lantern_id);
        floater(`+${d.amount * TUNING.score.per_mote}`, l.pos, '#F2C14E', 5.5);
        particles.emit([l.pos[0], l.pos[1] + 4.3, l.pos[2]], { n: 10 * d.amount, color: C.lit, speed: 3, up: 1, life: 0.8, gravity: 0 });
        toast(`Châm dầu ${d.lantern_id}: ${Math.round(d.fuel)}%`);
        break;
      }
      case 'lantern_out': {
        const l = lanternById(d.lantern_id);
        particles.emit([l.pos[0], l.pos[1] + 4.3, l.pos[2]], { n: 50, color: 0x5b5f6e, speed: 2, up: 2, life: 1.2, gravity: -1 });
        toast(`${settings.cb ? '⚠ ' : ''}Đèn ${d.lantern_id} đã tắt!`);
        audio.play('lantern_out');
        continue;
      }
      case 'fuel_drain':
        continue;
      case 'mote_picked':
        particles.emit(at, { n: 10, color: C.moteHalo, speed: 2, up: 2, life: 0.5, gravity: 1 });
        break;
      case 'deposit': {
        const l = lanternById(d.lantern_id);
        floater(`+${d.amount * TUNING.score.per_mote}`, l.pos, '#F2C14E', 5.5);
        particles.emit([l.pos[0], l.pos[1] + 4.3, l.pos[2]], { n: 8 * d.amount, color: C.moteCore, speed: 2.5, up: 1, life: 0.7, gravity: 0 });
        break;
      }
      case 'lantern_lit': {
        const l = lanternById(d.lantern_id);
        const c = [l.pos[0], l.pos[1] + 4.3, l.pos[2]];
        particles.emit(c, { n: 140, color: C.lit, speed: 9, up: 3, life: 1.4, gravity: 4 });
        particles.emit(c, { n: 60, color: C.core, speed: 4, up: 5, life: 1.8, gravity: 2 });
        floater(`+${d.relight ? TUNING.score.per_relight : TUNING.score.per_lantern}`, l.pos, '#FFE9B0', 6.5);
        toast(d.relight ? `Đèn ${d.lantern_id} sáng lại!` : `Đèn ${d.lantern_id} đã sáng!`);
        vignette('warm');
        if (night === 3) audio.play('bell');
        break;
      }
      case 'pulse':
        pulseFx = 0;
        particles.emit([p.pos[0], p.pos[1] + 0.8, p.pos[2]], { n: 120, color: C.core, speed: 10, up: 0, life: 0.5, gravity: 0 });
        if (d.stunned_ids.length) floater(`+${d.stunned_ids.length * TUNING.score.per_stun}`, p.pos, '#d9b3ff', 2.4);
        for (const id of d.stunned_ids) {
          const s = sim.shades.find((x) => x.id === id);
          if (s) particles.emit(s.pos, { n: 25, color: C.shadeRim, speed: 3, up: 1, life: 0.6 });
        }
        break;
      case 'player_hit':
        if (!settings.reduceMotion) shake = 0.5;
        vignette('hit');
        captions.say(d.by === 'fall' ? `${settings.cb ? '⚠ ' : ''}Rơi khỏi đảo (−1 Ngọn Lửa)` : `${settings.cb ? '⚠ ' : ''}Bị Bóng Mực chạm (−1 Ngọn Lửa)`, 'danger');
        toast(d.by === 'fall' ? `Rơi xuống biển mây! Mất ${d.lost} đom đóm` : d.dropped ? `Bị Bóng Mực chạm! Rơi ${d.dropped} đom đóm` : 'Bị Bóng Mực chạm!');
        particles.emit(at, { n: 40, color: C.shadeRim, speed: 5, up: 2, life: 0.7 });
        break;
      case 'shade_spawned': {
        const s = sim.shades.find((x) => x.id === d.id);
        if (s) particles.emit(s.pos, { n: 50, color: C.shadeRim, speed: 2, up: 2, life: 1.2, gravity: -1 });
        captions.say('Bóng Mực xuất hiện', 'shade');
        spawnCues.push({ id: d.id, until: performance.now() + 4000 });
        break;
      }
      case 'charm_picked':
        particles.emit(at, { n: 60, color: C.scarf, speed: 5, up: 3, life: 0.9 });
        particles.emit(at, { n: 40, color: C.gold, speed: 4, up: 4, life: 1 });
        toast('Bùa Gió! Chạy nhanh hơn, lướt không cần chờ');
        break;
      case 'drifter_steal':
        toast(`Gió Lạc cướp ${d.amount} đom đóm!`);
        particles.emit(at, { n: 30, color: C.drifter, speed: 4, up: 2, life: 0.7 });
        break;
      case 'drifter_drop': {
        const dr = sim.drifters.find((x) => x.id === d.drifter_id);
        if (dr) particles.emit(dr.pos, { n: 30, color: C.moteHalo, speed: 3, up: 2, life: 0.8 });
        toast(`Gió Lạc đánh rơi ${d.amount} đom đóm!`);
        break;
      }
      case 'dash':
        particles.emit(at, { n: 25, color: 0xdfe6ff, speed: 3, up: 0.5, life: 0.35, gravity: 0 });
        break;
    }
    audio.play(ev.name === 'player_hit' && d.by === 'fall' ? 'fall' : ev.name);
  }
}

// ---------- HUD ----------
const moteSlots = [];
for (let i = 0; i < TUNING.capacity_max; i++) {
  const s = document.createElement('i');
  $('hud-motes').append(s);
  moteSlots.push(s);
}
const v3 = new THREE.Vector3();
const hudCache = {};
// edge-of-screen arrows towards newly spawned shades (visual cue for the spawn sound)
const spawnCues = [];
function drawSpawnCues() {
  const root = $('spawn-arrows');
  const now = performance.now();
  for (let i = spawnCues.length - 1; i >= 0; i--) if (spawnCues[i].until < now) spawnCues.splice(i, 1);
  root.innerHTML = '';
  for (const cue of spawnCues) {
    const s = sim.shades.find((x) => x.id === cue.id);
    if (!s) continue;
    v3.set(s.pos[0], s.pos[1], s.pos[2]).project(camera);
    const behind = v3.z > 1;
    let x = behind ? -v3.x : v3.x;
    let y = behind ? -v3.y : v3.y;
    if (!behind && Math.abs(x) <= 0.9 && Math.abs(y) <= 0.9) continue; // on screen: no arrow needed
    if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) y = -1;
    const k = 1 / Math.hypot(x / 0.88, y / 0.8);
    x *= k;
    y *= k;
    const el = document.createElement('div');
    el.className = 'spawn-arrow';
    el.style.left = `${((x + 1) / 2) * window.innerWidth - 13}px`;
    el.style.top = `${((1 - y) / 2) * window.innerHeight - 14}px`;
    el.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
    root.append(el);
  }
}
const changed = (k, v) => (hudCache[k] === v ? false : ((hudCache[k] = v), true));
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const p = sim.player;
  const N = sim.map;
  const cx = N.id === 2 ? 35 : 0;
  const R = N.id === 2 ? 72 : N.id === 3 ? 47 : 42;
  const k = 70 / R;
  const X = (x) => 75 + (x - cx) * k;
  const Y = (z) => 75 + z * k; // screen-down = +Z, mirrored like the camera at yaw 0
  const tx = (x) => 150 - X(x);
  mm.clearRect(0, 0, 150, 150);
  mm.fillStyle = '#2F5D50';
  mm.beginPath();
  if (N.id === 2) {
    for (const [ix, iz, r] of N.islands) {
      mm.moveTo(tx(ix) + r * k, Y(iz));
      mm.arc(tx(ix), Y(iz), r * k, 0, Math.PI * 2);
    }
    mm.fill();
    mm.fillStyle = '#6B4A2F';
    mm.fillRect(tx(N.bridge.x[1]), Y(-2), 18 * k, 4 * k);
  } else {
    mm.arc(75, 75, (N.id === 3 ? 45 : 40) * k, 0, Math.PI * 2);
    mm.fill();
    if (N.id === 3) {
      mm.fillStyle = '#3d7262';
      mm.beginPath();
      mm.arc(75, 75, 24 * k, 0, Math.PI);
      mm.arc(75, 75, 12 * k, Math.PI, 0, true);
      mm.fill();
      mm.fillStyle = '#4f8a78';
      mm.beginPath();
      mm.arc(75, 75, 8 * k, 0, Math.PI * 2);
      mm.fill();
    }
  }
  const dot = (x, z, r, c) => {
    mm.fillStyle = c;
    mm.beginPath();
    mm.arc(tx(x), Y(z), r, 0, Math.PI * 2);
    mm.fill();
  };
  for (const m of sim.motes) dot(m.pos[0], m.pos[2], 1.3, '#FFF6C2');
  for (const l of sim.lanterns) dot(l.pos[0], l.pos[2], 4, l.lit ? '#FFB347' : '#5B5F6E');
  for (const c of sim.charms) if (c.available) dot(c.pos[0], c.pos[2], 3, '#C8102E');
  for (const s of sim.shades) dot(s.pos[0], s.pos[2], 3, s.state === 'stunned' ? '#3A3450' : '#7A3CFF');
  for (const d of sim.drifters) if (d.state !== 'removed') dot(d.pos[0], d.pos[2], 3, '#8FA3B8');
  // player arrow
  const yaw = (camYaw * Math.PI) / 180;
  mm.save();
  mm.translate(tx(p.pos[0]), Y(p.pos[2]));
  mm.rotate(yaw);
  mm.fillStyle = '#F5F1E6';
  mm.beginPath();
  mm.moveTo(0, 6);
  mm.lineTo(-4, -4);
  mm.lineTo(4, -4);
  mm.fill();
  mm.restore();
}
function updateHud() {
  const p = sim.player;
  if (changed('flames', p.flames)) {
    const prev = hudCache.prevFlames ?? p.flames;
    $('hud-flames').innerHTML = Array.from({ length: TUNING.flames }, (_, i) => `<div class="flame ${i < p.flames ? '' : 'off'} ${i === p.flames && prev > p.flames ? 'lost' : ''}"></div>`).join('');
    hudCache.prevFlames = p.flames;
  }
  const t = Math.ceil(sim.timeLeft());
  if (changed('t', t)) {
    $('clock-time').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    $('clock-night').textContent = `Đêm ${night} · ${sim.map.name}`;
    $('clock-bar').style.setProperty('--w', `${(100 * sim.timeLeft()) / sim.duration}%`);
    $('hud-clock').classList.toggle('danger', t <= 30);
    if (t <= 10 && t > 0) audio.play('countdown');
  }
  const lit = sim.lanterns.filter((l) => l.lit).length;
  const low = (l) => l.lit && l.fuel < TUNING.low_fuel_threshold * RULES.fuel_units;
  const pipKey = sim.lanterns.map((l) => (l.lit ? (low(l) ? 'w' : 'o') : l.everLit ? 'x' : '-')).join('');
  if (changed('pips', pipKey)) {
    $('hud-lanterns').innerHTML = sim.lanterns
      .map((l) => `<i class="${l.lit ? 'on' : ''} ${low(l) ? 'low' : ''} ${!l.lit && l.everLit ? 'out' : ''}" title="${l.id}"></i>`)
      .join('');
    const need = sim.litNeeded();
    $('hud-need').innerHTML = `${lit < need ? (settings.cb ? '⚠ ' : '') : ''}Giữ sáng <b>${lit}</b>/${need} tới bình minh`;
    $('hud-need').classList.toggle('bad', lit < need);
  }
  if (changed('score', totalScore + sim.score)) {
    const el = $('hud-score');
    el.textContent = `${totalScore + sim.score}`;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
  drawMinimap();
  const capNow = sim.capacity();
  if (changed('carried', `${p.carried}/${capNow}`)) {
    moteSlots.forEach((s, i) => {
      s.classList.toggle('on', i < p.carried);
      s.classList.toggle('hidden', i >= capNow);
    });
    $('motes-label').textContent = `Đom đóm ${p.carried}/${capNow}`;
  }
  const cd = (el, ticks, max) => el.style.setProperty('--rem', `${(100 * ticks) / max}%`);
  cd($('cd-dash'), p.charm > 0 ? 0 : p.dashCd, RULES.dash_cd_ticks);
  $('cd-dash').classList.toggle('charm', p.charm > 0);
  cd($('cd-pulse'), p.pulseCd, RULES.pulse_cd_ticks);
  $('cd-pulse').classList.toggle('dim', p.carried < TUNING.pulse_cost);
  $('lock-hint').classList.toggle('hidden', !!document.pointerLockElement || params.has('play'));

  const full = TUNING.fuel_max * RULES.fuel_units;
  const near = sim.lanterns
    .filter((l) => (!l.lit || l.fuel < full) && distXZ(l.pos, p.pos) <= TUNING.interact_radius)
    .sort((a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos) || (a.id < b.id ? -1 : 1))[0];
  $('hud-prompt').classList.toggle('hidden', !near);
  if (near) {
    const cost = near.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
    const txt = near.lit
      ? `<kbd>${keyLabel(settings.keys.interact)}</kbd> — Châm dầu (${Math.floor(near.fuel / RULES.fuel_units)}/100)`
      : `<kbd>${keyLabel(settings.keys.interact)}</kbd> — ${near.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${near.deposited}/${cost})`;
    if (changed('prompt', txt)) $('hud-prompt').innerHTML = txt;
  }

  const windSoon = sim.windEnabled && sim.windTicks === 0 && sim.simTick % RULES.wind_every_ticks >= RULES.wind_every_ticks - RULES.wind_warn_ticks;
  $('hud-wind').classList.toggle('hidden', !(windSoon || sim.windTicks > 0));
  $('hud-wind').textContent = sim.windTicks > 0 ? 'Gió mạnh!' : 'Gió sắp nổi…';

  // captions / visual cues (Ticket-04 §4)
  const warn = settings.cb ? '⚠ ' : '';
  if (windSoon && changed('windCue', Math.floor(sim.simTick / RULES.wind_every_ticks))) captions.say('Gió sắp thổi!', '');
  if (t <= 10 && t > 0 && changed('last10', night)) captions.say(`${warn}10 giây cuối tới bình minh!`, 'danger');
  for (const l of sim.lanterns) {
    const isLow = l.lit && l.fuel < TUNING.low_fuel_threshold * RULES.fuel_units;
    if (changed(`low-${l.id}`, isLow) && isLow) captions.say(`${warn}Đèn ${l.id} sắp hết dầu`, 'danger');
  }
  drawSpawnCues();

  // arrow to the nearest unlit lantern when off-screen
  const target = sim.lanterns.filter((l) => !l.lit).sort((a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos))[0];
  const arrow = $('hud-arrow');
  const dist = $('hud-arrow-dist');
  if (!target) {
    arrow.classList.add('hidden');
    dist.classList.add('hidden');
    return;
  }
  v3.set(target.pos[0], target.pos[1] + 4.3, target.pos[2]).project(camera);
  const behind = v3.z > 1;
  const onScreen = !behind && Math.abs(v3.x) <= 0.95 && Math.abs(v3.y) <= 0.95;
  arrow.classList.toggle('hidden', onScreen);
  dist.classList.toggle('hidden', onScreen);
  if (onScreen) return;
  let x = behind ? -v3.x : v3.x;
  let y = behind ? -v3.y : v3.y;
  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) y = -1;
  // keep the arrow on an ellipse inside the HUD frame (clear of the clock and the bars)
  const k = 1 / Math.hypot(x / 0.8, y / 0.62);
  x *= k;
  y *= k;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const sx = ((x + 1) / 2) * W;
  const sy = ((1 - y) / 2) * H;
  arrow.style.left = `${sx - 14}px`;
  arrow.style.top = `${sy - 15}px`;
  arrow.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
  dist.style.left = `${sx}px`;
  dist.style.top = `${sy + 20}px`;
  dist.textContent = `${target.id} · ${Math.round(distXZ(target.pos, p.pos))} m`;
}

// ---------- render sync ----------
function sync(map, list, make) {
  const alive = new Set();
  for (const e of list) {
    alive.add(e.id);
    if (!map.has(e.id)) {
      const m = make(e);
      map.set(e.id, m);
      scene.add(m);
    }
  }
  for (const [id, m] of map) if (!alive.has(id)) {
    scene.remove(m);
    map.delete(id);
  }
}

let facing = 0;
let wasGrounded = true;
let stepTimer = 0;
function renderWorld(time, dt) {
  const p = sim.player;
  const prev = player.position.clone();
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const mv = player.position.clone().sub(prev);
  if (mv.x * mv.x + mv.z * mv.z > 1e-6) facing = Math.atan2(mv.x, mv.z);
  player.rotation.y = facing;
  player.visible = !p.dead && (p.invuln === 0 || Math.floor(time * 12) % 2 === 0);
  const hspeed = Math.hypot(p.vel[0], p.vel[2]);
  player.userData.animate(dt, mode === 'playing' ? hspeed : 0, p.grounded, time);
  if (mode === 'playing') {
    const feet = [p.pos[0], p.pos[1] + 0.1, p.pos[2]];
    if (wasGrounded && !p.grounded) {
      if (p.vel[1] > 6.5 && p.vel[1] < 7.5) audio.play('jump');
      else if (p.vel[1] > 10) {
        audio.play('launch');
        particles.emit(feet, { n: 50, color: C.gold, speed: 5, up: 4, life: 0.8 });
      }
    }
    if (!wasGrounded && p.grounded) {
      audio.play('land');
      particles.emit(feet, { n: 14, color: C.sand, speed: 2.5, up: 1, life: 0.4, gravity: 6 });
    }
    if (p.grounded && hspeed > 1) {
      stepTimer -= dt * hspeed;
      if (stepTimer <= 0) {
        stepTimer = 2.2;
        audio.play('step');
      }
    }
    if (p.dashTicks > 0) particles.emit([p.pos[0], p.pos[1] + 0.8, p.pos[2]], { n: 4, color: p.charm > 0 ? C.scarf : 0xdfe6ff, speed: 0.5, up: 0, life: 0.4, gravity: 0, spread: 0.6 });
    if (p.charm > 0 && Math.random() < 0.3) particles.emit([p.pos[0], p.pos[1] + 0.3, p.pos[2]], { n: 1, color: C.scarf, speed: 0.5, up: 0.5, life: 0.5, gravity: 0, spread: 0.6 });
  }
  wasGrounded = p.grounded;

  let lit = 0;
  const lowUnits = TUNING.low_fuel_threshold * RULES.fuel_units;
  const blinkOff = Math.floor(time * 2) % 2 === 1; // 1 Hz slow blink
  sim.lanterns.forEach((l, i) => {
    const m = lanternMeshes[i];
    if (l.lit) lit++;
    const cost = l.everLit ? TUNING.relight_cost : TUNING.lantern_cost;
    const fill = l.deposited / cost;
    const low = l.lit && l.fuel < lowUnits;
    const dim = low && blinkOff ? 0.35 : 1;
    m.shellMat.color.setHex(l.lit ? C.lit : C.off);
    m.shellMat.emissiveIntensity = l.lit ? (1.6 + 0.2 * Math.sin(time * 3 + i)) * dim : fill * 0.7;
    m.core.visible = l.lit && !(low && blinkOff);
    m.light.intensity = l.lit ? 70 * dim : fill * 8;
    m.ring.visible = l.lit && l.fuel >= lowUnits; // safe zone only while fuel >= 30
    // out/unlit lanterns are squashed by 20% and torn (readable without colour)
    m.body.scale.set(l.lit ? 1 : 0.92, l.lit ? 1 : 0.8, l.lit ? 1 : 0.92);
    m.body.position.y = l.lit ? 0 : 4.3 * 0.2 * 0.5;
    m.tears.visible = !l.lit;
    m.fuelBar.visible = l.lit;
    if (l.lit) {
      const f = l.fuel / (TUNING.fuel_max * RULES.fuel_units);
      m.fill.scale.x = Math.max(0.001, f);
      m.fill.position.x = -0.7 * (1 - f);
      m.fillMat.color.setHex(low ? (settings.cb ? 0xffffff : 0xff5a5f) : C.lit);
      m.fuelBar.visible = !(low && blinkOff);
      m.fuelBar.quaternion.copy(camera.quaternion);
    }
  });
  // drain: a thin stream of light flows from the lantern into the shade
  for (const s of sim.shades) {
    if (s.state !== 'drain' || Math.random() > 0.5) continue;
    const l = lanternById(s.targetId);
    if (!l) continue;
    const k = Math.random();
    particles.emit(
      [l.pos[0] + (s.pos[0] - l.pos[0]) * k, l.pos[1] + 4.3 + (s.pos[1] - l.pos[1] - 4.3) * k, l.pos[2] + (s.pos[2] - l.pos[2]) * k],
      { n: 1, color: C.lit, speed: 0.4, up: 0, life: 0.5, gravity: 0, spread: 0.2 },
    );
  }
  ambient.intensity = 0.15 + 0.55 * (lit / sim.lanterns.length);
  scene.fog.density = 0.022 - 0.01 * (lit / sim.lanterns.length);
  if (mode === 'flyover') {
    // wide establishing shots for the menu video: thinner mist so the whole island reads
    ambient.intensity = 0.8;
    scene.fog.density = 0.005;
  }

  sync(moteMeshes, sim.motes, makeMote);
  for (const m of sim.motes) {
    const g = moteMeshes.get(m.id);
    g.position.set(m.pos[0], m.pos[1] + 0.8 + 0.2 * Math.sin(time * 2 + m.pos[0] + m.pos[2]), m.pos[2]);
    if (m.kind === 'dropped') g.visible = m.ttl > 120 || Math.floor(time * 8) % 2 === 0;
  }

  sync(shadeMeshes, sim.shades, makeShade);
  for (const s of sim.shades) {
    const g = shadeMeshes.get(s.id);
    g.position.set(s.pos[0], s.pos[1] + 0.15 * Math.sin(time * 3 + s.pos[0]), s.pos[2]);
    g.lookAt(p.pos[0], g.position.y, p.pos[2]);
    const mat = g.userData.bodyMat;
    mat.color.setHex(s.state === 'stunned' ? C.shadeStun : C.shade);
    const sc = s.state === 'spawning' ? 1 - s.ticks / RULES.shade_spawning_ticks : s.state === 'stunned' ? 0.85 + 0.05 * Math.sin(time * 20) : 1;
    g.scale.setScalar(Math.max(0.05, sc));
    mat.opacity = s.state === 'recoil' ? 0.6 : 0.95;
    g.userData.animate(time, s.pos[0] * 0.37);
    if (s.state === 'chase' && Math.random() < 0.08) particles.emit([s.pos[0], s.pos[1] - 0.6, s.pos[2]], { n: 1, color: shadeRimColor, speed: 0.3, up: 0.6, life: 0.8, gravity: 0, spread: 0.8 });
  }

  sync(drifterMeshes, sim.drifters.filter((d) => d.state !== 'removed'), makeDrifter);
  for (const d of sim.drifters) {
    const g = drifterMeshes.get(d.id);
    if (!g) continue;
    g.position.set(d.pos[0], d.pos[1], d.pos[2]);
    const { geo, base } = g.userData;
    const arr = geo.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) arr[i + 2] = base[i + 2] + 0.35 * Math.sin(time * 6 + base[i + 1] * 2);
    geo.attributes.position.needsUpdate = true;
    g.rotation.y = time * (d.state === 'chase' ? 3 : 1);
  }

  sync(charmMeshes, sim.charms, makeCharm);
  for (const c of sim.charms) {
    const g = charmMeshes.get(c.id);
    g.visible = c.available;
    g.position.set(c.pos[0], c.pos[1] + 1 + 0.2 * Math.sin(time * 2), c.pos[2]);
    g.rotation.y = time * 1.5;
  }

  if (pulseFx < 1) {
    pulseFx = Math.min(1, pulseFx + dt * 2.5);
    pulseRing.position.set(p.pos[0], p.pos[1] + 0.1, p.pos[2]);
    pulseRing.scale.setScalar(TUNING.pulse_radius * pulseFx);
    pulseRing.material.opacity = 0.8 * (1 - pulseFx);
  }

  // wind leaves (warning + gust)
  const windOn = sim.windTicks > 0;
  const windSoon = sim.windEnabled && !windOn && sim.simTick % RULES.wind_every_ticks >= RULES.wind_every_ticks - RULES.wind_warn_ticks;
  leaves.visible = windOn || windSoon;
  if (leaves.visible) {
    const a = (sim.windDir * Math.PI) / 180;
    const m4 = new THREE.Matrix4();
    leafSeeds.forEach(([x, y, z, ph], i) => {
      const t = (time * (windOn ? 6 : 1.5) + ph * 5) % 30;
      const lx = windOn ? x + Math.cos(a) * (t - 15) : x + Math.sin(time + ph) * 2;
      const lz = windOn ? z + Math.sin(a) * (t - 15) : z + Math.cos(time + ph) * 2;
      m4.makeRotationFromEuler(new THREE.Euler(time * 3 + ph, time * 2 + ph, 0));
      m4.setPosition(p.pos[0] + lx, p.pos[1] + 0.5 + y, p.pos[2] + lz);
      leaves.setMatrixAt(i, m4);
    });
    leaves.instanceMatrix.needsUpdate = true;
  }
  if (mode === 'playing' && windSoon && sim.simTick % RULES.wind_every_ticks === RULES.wind_every_ticks - RULES.wind_warn_ticks) audio.play('wind');

  const frac = lit / sim.lanterns.length;
  fireflies.update(time, [sim.map.id === 2 ? 35 : 0, 0, 0], sim.map.id === 2 ? 65 : 42, frac);
  particles.update(dt);

  const yaw = (camYaw * Math.PI) / 180;
  const target = new THREE.Vector3(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
  const horiz = 10 * Math.cos(camPitch);
  const camPos = new THREE.Vector3(target.x - Math.sin(yaw) * horiz, target.y + 0.5 + 10 * Math.sin(camPitch), target.z - Math.cos(yaw) * horiz);
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    camPos.x += (Math.random() - 0.5) * shake * 1.2;
    camPos.y += (Math.random() - 0.5) * shake * 1.2;
  }
  if (mode === 'flyover') {
    // menu-video capture: wide orbit around the whole island, slowly descending
    const cx = night === 2 ? 35 : 0;
    const R = night === 2 ? 72 : night === 3 ? 58 : 52;
    const tt = time - flyStart;
    const a = 0.9 + tt * 0.11;
    camPos.set(cx + Math.cos(a) * R, 30 - tt * 1.1, Math.sin(a) * R);
    target.set(cx, night === 3 ? 4 : 0, 0);
    camera.position.copy(camPos);
  } else if (mode === 'menu' && !menuVideo) {
    // cinematic orbit around the demo bot; framed to the right of the menu text
    const a = time * 0.12;
    const R = 13 + 3 * Math.sin(time * 0.05);
    camPos.set(p.pos[0] + Math.sin(a) * R, p.pos[1] + 6 + 2 * Math.sin(time * 0.07), p.pos[2] + Math.cos(a) * R);
    target.set(p.pos[0] - Math.cos(a) * 4, p.pos[1] + 1.5, p.pos[2] + Math.sin(a) * 4);
    camera.position.lerp(camPos, 0.05);
  } else if (mode === 'menu' || mode === 'intro') {
    const R = night === 2 ? 70 : 55;
    const cx = night === 2 ? 35 : 0;
    camPos.set(cx + Math.sin(time * 0.08) * R, 28, Math.cos(time * 0.08) * R);
    target.set(cx, 0, 0);
    camera.position.copy(camPos);
  } else camera.position.lerp(camPos, 0.15);
  camera.lookAt(target);
  fadeOccluders(target);
}

// trees between the camera and Mây become see-through
const ray = new THREE.Raycaster();
const fadedMat = new THREE.MeshStandardMaterial({ color: 0x24493d, transparent: true, opacity: 0.18, depthWrite: false });
let faded = [];
function fadeOccluders(target) {
  for (const [mesh, mat] of faded) mesh.material = mat;
  faded = [];
  if (!terrain || mode === 'menu' || mode === 'intro' || BENCH_MODE) return;
  const dir = target.clone().sub(camera.position);
  const len = dir.length();
  ray.set(camera.position, dir.normalize());
  ray.far = len;
  for (const hit of ray.intersectObjects(terrain.children, false)) {
    if (!hit.object.userData.tree) continue;
    faded.push([hit.object, hit.object.material]);
    hit.object.material = fadedMat;
  }
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let acc = 0;
const fps = { frames: 0, t0: performance.now(), last: 0, samples: [] };
window.__ddl = { fps, get mode() { return mode; }, get sim() { return sim; } }; // for scripts/browser-proof.mjs
let prevTs = 0;
let budget = 0;
// ---------- benchmark (Ticket-04 §1) ----------
const bench = { first: 0, prev: 0, simPrev: 0, acc: 0, dts: [], heapPeak: 0, done: false };
function startBench() {
  const seed = Number(params.get('seed') ?? 42);
  mode = 'bench';
  night = 1;
  sim = makeBenchSim(seed);
  terrain = buildTerrain(sim.map, mulberry32(1007), { decor: false });
  scene.add(terrain);
  lanternMeshes = sim.lanterns.map((l) => {
    const m = makeLantern(l);
    scene.add(m.group);
    return m;
  });
  // creative extras off in the standard bench scene
  fireflies.points.visible = false;
  particles.points.visible = false;
  particles.emit = () => {};
  for (const s of SCREENS) $(s).classList.add('hidden');
  $('hud').classList.add('hidden');
  bench.duration = Number(params.get('duration') ?? 30);
}
function benchFrame(ts) {
  if (bench.done) return;
  if (!bench.first) {
    bench.first = ts;
    bench.firstEpoch = performance.timeOrigin + ts; // first frame of the bench scene
  }
  const t = (ts - bench.first) / 1000;
  if (bench.prev && t > BENCH.warmupS) bench.dts.push(ts - bench.prev);
  bench.prev = ts;
  bench.acc += bench.simPrev ? Math.min(0.25, (ts - bench.simPrev) / 1000) : 0;
  bench.simPrev = ts;
  while (bench.acc >= DT) {
    sim.step(NEUTRAL_INPUT);
    sim.drainEvents();
    bench.acc -= DT;
  }
  renderWorld(t, Math.min(0.25, (ts - (bench.prevRender || ts)) / 1000));
  bench.prevRender = ts;
  // camera: circle r 30 around (0,0,0) at Y 15, starts at 0° = (30,15,0), CCW seen from above, 15 s per lap
  const a = (2 * Math.PI * t) / BENCH.lapS;
  camera.position.set(BENCH.camRadius * Math.cos(a), BENCH.camY, BENCH.camRadius * Math.sin(a));
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  if (performance.memory) bench.heapPeak = Math.max(bench.heapPeak, performance.memory.usedJSHeapSize);
  if (t >= BENCH.warmupS + bench.duration) {
    bench.done = true;
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    window.__benchResult = {
      ...frameStats(bench.dts),
      first_frame_epoch_ms: bench.firstEpoch,
      js_heap_peak_mb: bench.heapPeak ? Math.round(bench.heapPeak / 1048576) : null,
      renderer: `three.js r${THREE.REVISION} WebGL2 — ${gpu}`,
      user_agent: navigator.userAgent,
    };
    document.title = 'BENCH DONE';
  }
}

function frame(ts) {
  requestAnimationFrame(frame);
  if (mode === 'bench') return benchFrame(ts);
  // FPS cap (settings): time budget accumulates across display frames, so the average rate
  // matches the cap even when the display refresh is not a multiple of it (e.g. 66 Hz vs 60).
  const elapsed = prevTs ? ts - prevTs : 0;
  prevTs = ts;
  if (settings.fpsCap > 0) {
    const interval = 1000 / settings.fpsCap;
    budget += elapsed;
    if (budget < interval * 0.95) return;
    budget = Math.min(budget - interval, interval);
  }
  const dt = Math.min(clock.getDelta(), 0.25);
  const time = clock.elapsedTime;
  if (mode === 'flyover' && time - flyStart > FLY_SECONDS) {
    if (night === 3) window.__flyoverDone = true;
    else {
      loadNight(night + 1, 11 + night);
      lightForShow();
      flyStart = time;
    }
  }
  if ((mode === 'menu' && !menuVideo) || mode === 'flyover') {
    // attract mode: the bot plays a night behind the menu
    acc += dt;
    while (acc >= DT) {
      sim.step(demoBot.input(sim));
      handleEvents(sim.drainEvents(), true);
      acc -= DT;
      if (sim.state === 'won' || sim.state === 'lost' || sim.simTick > 60 * 90) {
        loadNight(1 + ((night) % 3), 7 + night);
        break;
      }
    }
  } else if (mode === 'playing') {
    acc += dt;
    while (acc >= DT && mode === 'playing') {
      sim.step(buildInput());
      latched.clear();
      handleEvents(sim.drainEvents());
      acc -= DT;
    }
    if (mode === 'playing') updateHud();
  } else acc = 0;
  renderWorld(time, dt);
  renderer.render(scene, camera);
  fps.frames++;
  const now = performance.now();
  if (now - fps.t0 >= 1000) {
    fps.last = (fps.frames * 1000) / (now - fps.t0);
    fps.samples.push(fps.last);
    fps.frames = 0;
    fps.t0 = now;
    $('fps').textContent = `${Math.round(fps.last)} FPS`;
  }
}

renderKeyHints();
// ?flyover: scripted island flyover used by scripts/record-menu-video.mjs to make video/menu.mp4
const FLY_SECONDS = 9;
let flyStart = 0;
// video only: most lanterns already burning so the islands glow (display-only, never in gameplay)
function lightForShow() {
  sim.lanterns.forEach((l, i) => {
    if (i % 3 !== 2) {
      l.lit = true;
      l.everLit = true;
      l.fuel = TUNING.fuel_max * RULES.fuel_units;
    }
  });
}
if (BENCH_MODE) startBench();
else if (params.has('flyover')) {
  loadNight(1, 11);
  lightForShow();
  mode = 'flyover';
  for (const s of SCREENS) $(s).classList.add('hidden');
  $('hud').classList.add('hidden');
  document.getElementById('menu-video')?.remove();
  menuVideo = null;
} else {
  loadNight(Number(params.get('night')) || 1);
  renderNightCards();
  show('scr-menu');
  if (params.has('night')) {
    goIntro(Number(params.get('night')));
    if (params.has('play')) startPlay();
  }
}
requestAnimationFrame(frame);

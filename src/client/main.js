// Browser client: screens, input, HUD, rendering of the shared Sim. Gameplay rules live in src/sim only.
import * as THREE from 'three';
import { Sim, distXZ } from '../sim/sim.js';
import { TUNING, RULES, TICK_RATE } from '../sim/config.js';
import { NIGHTS } from '../sim/maps.js';
import { mulberry32 } from '../sim/rng.js';
import { GameAudio } from './audio.js';
import { C, buildTerrain, makeLantern, makePlayer, makeMote, makeShade, makeDrifter, makeCharm } from './world.js';
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
const settings = { volume: 0.7, sens: 0.3 };
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.FogExp2(C.fog, 0.022);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
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

function loadNight(n) {
  night = n;
  sim = new Sim({ seed: (Date.now() & 0x7fffffff) >>> 0, night: n });
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
const SCREENS = ['scr-menu', 'scr-intro', 'scr-result', 'scr-dawn', 'scr-pause', 'scr-settings'];
let settingsReturn = 'scr-menu';
function show(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', mode !== 'playing');
  if (id) {
    releaseMouse();
    $(id).querySelector('button:not(:disabled)')?.focus();
  }
}

function goMenu() {
  mode = 'menu';
  audio.stopBgm();
  loadNight(1);
  renderNightCards();
  show('scr-menu');
}
let typer = 0;
function goIntro(n) {
  loadNight(n);
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
  audio.playBgm();
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
  if (won) {
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
  const why = { all_lit: 'Mọi ngọn Đèn Lồng Lớn đã sáng.', dawn: 'Trời đã sáng mà đảo vẫn chìm trong sương…', no_flames: 'Ngọn lửa của Mây đã tắt…' };
  const t = Math.floor(sim.timeLeft());
  const lit = sim.lanterns.filter((l) => l.lit).length;
  $('res-eyebrow').textContent = `Đêm ${night} · ${NIGHTS[night].name}`;
  $('res-title').textContent = won ? 'Đảo đã sáng lại!' : 'Đêm chưa qua…';
  $('res-text').textContent = why[reason];
  $('res-stats').innerHTML = [
    ['Đèn đã thắp', `${lit}/${sim.lanterns.length}`],
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
    totalScore = 0;
    goIntro(1);
  } else if (act === 'night') {
    totalScore = 0;
    goIntro(Number(b.dataset.night));
  } else if (act === 'play') startPlay();
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

// ---------- input ----------
const held = new Set();
const latched = new Set();
let camYaw = 0;
let camPitch = 0.42; // client-only camera tilt (radians); not part of the contract input
const keyName = (e) => (e.code === 'Space' ? ' ' : e.code.startsWith('Shift') ? 'shift' : e.key.toLowerCase());

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
  const k = keyName(e);
  if ((k === 'escape' || k === 'p') && !e.repeat) {
    if (mode === 'playing') return pause();
    if (mode === 'paused' && $('scr-settings').classList.contains('hidden')) return resume();
    if (!$('scr-settings').classList.contains('hidden')) return show(settingsReturn);
  }
  if (k === 'enter' && mode === 'intro') {
    e.preventDefault();
    return startPlay();
  }
  if (mode !== 'playing' && (k === 'arrowdown' || k === 'arrowup')) {
    const bs = visibleButtons();
    const i = bs.indexOf(document.activeElement);
    bs[(i + (k === 'arrowdown' ? 1 : -1) + bs.length) % bs.length]?.focus();
    e.preventDefault();
    return;
  }
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  held.add(k);
  latched.add(k);
});
window.addEventListener('keyup', (e) => held.delete(keyName(e)));
window.addEventListener('blur', () => {
  held.clear();
  pause();
});
const pressed = (k) => held.has(k) || latched.has(k);
function buildInput() {
  if (held.has('arrowleft')) camYaw += 120 * DT;
  if (held.has('arrowright')) camYaw -= 120 * DT;
  const kx = (held.has('d') ? 1 : 0) - (held.has('a') ? 1 : 0);
  const kz = (held.has('w') || held.has('arrowup') ? 1 : 0) - (held.has('s') || held.has('arrowdown') ? 1 : 0);
  // Camera looks along +Z at yaw 0, so screen-right is world -X.
  return { move: [-kx, kz], cam_yaw_deg: camYaw, jump: pressed(' '), interact: pressed('e'), pulse: pressed('f'), dash: pressed('shift'), pause: false };
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
  const v = $('vignette');
  v.className = kind;
  requestAnimationFrame(() => requestAnimationFrame(() => (v.className = '')));
}
const lanternById = (id) => sim.lanterns.find((l) => l.id === id);
function handleEvents(events) {
  const p = sim.player;
  const at = [p.pos[0], p.pos[1] + 1, p.pos[2]];
  for (const ev of events) {
    const d = ev.data;
    switch (ev.name) {
      case 'game_over':
        if (d.result === 'won') audio.play('bell');
        finishNight(d.result, d.reason);
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
        floater(`+${TUNING.score.per_lantern}`, l.pos, '#FFE9B0', 6.5);
        toast(`Đèn ${d.lantern_id} đã sáng!`);
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
        shake = 0.5;
        vignette('hit');
        toast(d.by === 'fall' ? `Rơi xuống biển mây! Mất ${d.lost} đom đóm` : d.dropped ? `Bị Bóng Mực chạm! Rơi ${d.dropped} đom đóm` : 'Bị Bóng Mực chạm!');
        particles.emit(at, { n: 40, color: C.shadeRim, speed: 5, up: 2, life: 0.7 });
        break;
      case 'shade_spawned': {
        const s = sim.shades.find((x) => x.id === d.id);
        if (s) particles.emit(s.pos, { n: 50, color: C.shadeRim, speed: 2, up: 2, life: 1.2, gravity: -1 });
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
for (let i = 0; i < TUNING.carry_capacity; i++) {
  const s = document.createElement('i');
  $('hud-motes').append(s);
  moteSlots.push(s);
}
const v3 = new THREE.Vector3();
const hudCache = {};
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
  if (changed('lit', `${lit}/${sim.lanterns.length}`)) {
    $('hud-lanterns').innerHTML = sim.lanterns.map((l) => `<i class="${l.lit ? 'on' : ''}" title="${l.id}"></i>`).join('');
  }
  if (changed('score', totalScore + sim.score)) {
    const el = $('hud-score');
    el.textContent = `${totalScore + sim.score}`;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
  drawMinimap();
  if (changed('carried', p.carried)) {
    moteSlots.forEach((s, i) => s.classList.toggle('on', i < p.carried));
    $('motes-label').textContent = `Đom đóm ${p.carried}/${TUNING.carry_capacity}`;
  }
  const cd = (el, ticks, max) => el.style.setProperty('--rem', `${(100 * ticks) / max}%`);
  cd($('cd-dash'), p.charm > 0 ? 0 : p.dashCd, RULES.dash_cd_ticks);
  $('cd-dash').classList.toggle('charm', p.charm > 0);
  cd($('cd-pulse'), p.pulseCd, RULES.pulse_cd_ticks);
  $('cd-pulse').classList.toggle('dim', p.carried < TUNING.pulse_cost);
  $('lock-hint').classList.toggle('hidden', !!document.pointerLockElement || params.has('play'));

  const near = sim.lanterns.filter((l) => !l.lit && distXZ(l.pos, p.pos) <= TUNING.interact_radius).sort((a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos))[0];
  $('hud-prompt').classList.toggle('hidden', !near);
  if (near && changed('prompt', `${near.id}${near.deposited}`)) $('hud-prompt').innerHTML = `<kbd>E</kbd> — Nạp ánh sáng (${near.deposited}/${TUNING.lantern_cost})`;

  const windSoon = sim.windEnabled && sim.windTicks === 0 && sim.simTick % RULES.wind_every_ticks >= RULES.wind_every_ticks - RULES.wind_warn_ticks;
  $('hud-wind').classList.toggle('hidden', !(windSoon || sim.windTicks > 0));
  $('hud-wind').textContent = sim.windTicks > 0 ? 'Gió mạnh!' : 'Gió sắp nổi…';

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
  sim.lanterns.forEach((l, i) => {
    const m = lanternMeshes[i];
    if (l.lit) lit++;
    const fill = l.deposited / TUNING.lantern_cost;
    m.shellMat.color.setHex(l.lit ? C.lit : C.off);
    m.shellMat.emissiveIntensity = l.lit ? 1.6 + 0.2 * Math.sin(time * 3 + i) : fill * 0.7;
    m.core.visible = l.lit;
    m.light.intensity = l.lit ? 70 : fill * 8;
    m.ring.visible = l.lit;
  });
  ambient.intensity = 0.15 + 0.55 * (lit / sim.lanterns.length);
  scene.fog.density = 0.022 - 0.01 * (lit / sim.lanterns.length);

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
    if (s.state === 'chase' && Math.random() < 0.08) particles.emit([s.pos[0], s.pos[1] - 0.6, s.pos[2]], { n: 1, color: C.shadeRim, speed: 0.3, up: 0.6, life: 0.8, gravity: 0, spread: 0.8 });
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
  if (windSoon && sim.simTick % RULES.wind_every_ticks === RULES.wind_every_ticks - RULES.wind_warn_ticks) audio.play('wind');

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
  if (mode === 'menu' || mode === 'intro') {
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
  if (!terrain || mode === 'menu' || mode === 'intro') return;
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
function frame() {
  const dt = Math.min(clock.getDelta(), 0.25);
  const time = clock.elapsedTime;
  if (mode === 'playing') {
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
  }
  requestAnimationFrame(frame);
}

loadNight(Number(params.get('night')) || 1);
renderNightCards();
show('scr-menu');
if (params.has('night')) {
  goIntro(Number(params.get('night')));
  if (params.has('play')) startPlay();
}
requestAnimationFrame(frame);

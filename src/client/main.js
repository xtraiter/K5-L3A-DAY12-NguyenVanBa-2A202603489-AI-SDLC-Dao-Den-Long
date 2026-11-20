// Browser client: renders the shared Sim (src/sim) with Three.js. The client never
// changes gameplay rules — it only builds an input per tick and draws the state.
import * as THREE from 'three';
import { Sim, distXZ } from '../sim/sim.js';
import { TUNING, WORLD, TICK_RATE } from '../sim/config.js';
import { mulberry32 } from '../sim/rng.js';
import { GameAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const DT = 1 / TICK_RATE;
const WARM = 0xffb347;
const INK = 0x1a0b2e;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0716);
scene.fog = new THREE.FogExp2(0x140a26, 0.03);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const hemi = new THREE.HemisphereLight(0x6a5a9a, 0x1a1030, 0.6);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8f86d6, 0.5);
moon.position.set(-30, 50, -20);
scene.add(moon);

// ---------- static world ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 6, 6, 72), mat(0x2c3b33));
island.position.y = -3;
scene.add(island);
const sea = new THREE.Mesh(new THREE.CircleGeometry(300, 48), mat(0x2a1f4a, { roughness: 1 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -8;
scene.add(sea);

const deco = mulberry32(2024); // decoration only, never affects gameplay
const lanternPos = () => sim.lanterns.map((l) => l.pos);
function addDecor() {
  const treeMat = mat(0x1f3a2c);
  const trunkMat = mat(0x4a3424);
  for (let i = 0; i < 40; i++) {
    const r = 6 + Math.sqrt(deco()) * (WORLD.island_radius - 8);
    const a = deco() * Math.PI * 2;
    const p = [r * Math.sin(a), 0, r * Math.cos(a)];
    if (lanternPos().some((lp) => distXZ(lp, p) < 6)) continue;
    const h = 2 + deco() * 2.5;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1), trunkMat);
    trunk.position.y = 0.5;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.9, h, 7), treeMat);
    top.position.y = 1 + h / 2;
    tree.add(trunk, top);
    tree.position.set(p[0], 0, p[2]);
    scene.add(tree);
  }
  const cloudMat = mat(0x3b2d63, { transparent: true, opacity: 0.85 });
  for (let i = 0; i < 60; i++) {
    const r = WORLD.island_radius + 8 + deco() * 70;
    const a = deco() * Math.PI * 2;
    const c = new THREE.Mesh(new THREE.SphereGeometry(3 + deco() * 5, 12, 8), cloudMat);
    c.position.set(r * Math.sin(a), -7 + deco() * 2, r * Math.cos(a));
    c.scale.y = 0.4;
    scene.add(c);
  }
}

// ---------- player (Mây: nón lá + đèn lồng nhỏ) ----------
const player = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.0, 16), mat(0x3f6fb0));
  body.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat(0xf2d2b0));
  head.position.y = 1.25;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.42, 24), mat(0xe9d39b));
  hat.position.y = 1.62;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35), mat(0x8a6a3a));
  string.position.set(0.6, 1.28, 0);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 8),
    new THREE.MeshStandardMaterial({ color: WARM, emissive: WARM, emissiveIntensity: 2 }),
  );
  lamp.position.set(0.6, 1.05, 0);
  const glow = new THREE.PointLight(WARM, 8, 10, 1.5);
  glow.position.copy(lamp.position);
  player.add(body, head, hat, string, lamp, glow);
}
scene.add(player);

// ---------- dynamic entities ----------
let lanternMeshes = [];
const moteMeshes = new Map();
const shadeMeshes = new Map();
const moteGeo = new THREE.SphereGeometry(0.14, 10, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xfff1a0 });
const shadeGeo = new THREE.SphereGeometry(0.8, 18, 14);
const eyeGeo = new THREE.SphereGeometry(0.11, 8, 6);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9b3ff });

function buildLanterns() {
  for (const m of lanternMeshes) scene.remove(m.group);
  lanternMeshes = sim.lanterns.map((l) => {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.2, 10), mat(0x5a4030));
    pole.position.y = 1.6;
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a2f4a, emissive: WARM, emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), lampMat);
    lamp.scale.y = 1.25;
    lamp.position.y = 3.9;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.4, 12), mat(0x7a2a1a));
    cap.position.y = 4.9;
    const light = new THREE.PointLight(WARM, 0, 26, 1.2);
    light.position.y = 3.9;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 48),
      new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(pole, lamp, cap, light, ring);
    group.position.set(l.pos[0], 0, l.pos[2]);
    scene.add(group);
    return { group, lampMat, light };
  });
}

function syncMap(map, list, create) {
  const alive = new Set();
  for (const e of list) {
    alive.add(e.id);
    if (!map.has(e.id)) {
      const m = create(e);
      map.set(e.id, m);
      scene.add(m);
    }
  }
  for (const [id, m] of map) {
    if (!alive.has(id)) {
      scene.remove(m);
      map.delete(id);
    }
  }
}

function makeShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: INK, emissive: 0x3d1466, emissiveIntensity: 0.6, transparent: true, opacity: 0.92 });
  const body = new THREE.Mesh(shadeGeo, bodyMat);
  const e1 = new THREE.Mesh(eyeGeo, eyeMat);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(-0.25, 0.15, 0.7);
  e2.position.set(0.25, 0.15, 0.7);
  g.add(body, e1, e2);
  g.userData.bodyMat = bodyMat;
  return g;
}

// pulse ring effect
const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1, 64),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseFx = 1;

// ---------- input ----------
const held = new Set();
const latched = new Set();
let camYaw = 0;
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'enter' && mode !== 'playing') return startGame();
  if (k === 'r') return startGame();
  if (k === ' ') e.preventDefault();
  held.add(k);
  latched.add(k);
});
window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => held.clear());
let dragging = false;
renderer.domElement.addEventListener('mousedown', () => (dragging = true));
window.addEventListener('mouseup', () => (dragging = false));
window.addEventListener('mousemove', (e) => {
  if (dragging) camYaw -= e.movementX * 0.3;
});

const pressed = (...keys) => keys.some((k) => held.has(k) || latched.has(k));
function buildInput() {
  if (held.has('arrowleft')) camYaw += 120 * DT;
  if (held.has('arrowright')) camYaw -= 120 * DT;
  const kx = (held.has('d') ? 1 : 0) - (held.has('a') ? 1 : 0);
  const kz = (held.has('w') || held.has('arrowup') ? 1 : 0) - (held.has('s') || held.has('arrowdown') ? 1 : 0);
  // Camera looks along +Z at yaw 0, so screen-right is world -X: flip x for the contract's move vector.
  return {
    move: [-kx, kz],
    cam_yaw_deg: camYaw,
    jump: pressed(' '),
    interact: pressed('e'),
    pulse: pressed('f'),
  };
}

// ---------- game flow ----------
const audio = new GameAudio();
let sim = new Sim({ seed: 1 });
let mode = 'title';
addDecor();
buildLanterns();

function startGame() {
  sim = new Sim({ seed: Date.now() & 0x7fffffff });
  for (const m of [...moteMeshes.values(), ...shadeMeshes.values()]) scene.remove(m);
  moteMeshes.clear();
  shadeMeshes.clear();
  buildLanterns();
  camYaw = 0;
  mode = 'playing';
  $('overlay').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hint').classList.remove('hidden');
  audio.play('bgm');
}

function handleEvents(events) {
  for (const ev of events) {
    if (ev.name === 'pulse') pulseFx = 0;
    if (ev.name === 'game_over') {
      mode = 'over';
      audio.stopBgm();
      audio.play(ev.data.result);
      const won = ev.data.result === 'won';
      const reason = { all_lit: 'Cả 5 Đèn Lồng Lớn đã sáng!', dawn: 'Trời đã sáng mà đảo vẫn chìm trong sương…', no_flames: 'Ngọn lửa của Mây đã tắt…' };
      $('ov-title').textContent = won ? 'Đảo đã sáng lại!' : 'Đêm chưa qua…';
      $('ov-text').textContent = `${reason[ev.data.reason]} Điểm: ${sim.score}`;
      $('overlay').querySelector('p:last-child').innerHTML = 'Nhấn <span class="key">Enter</span> hoặc <span class="key">R</span> để chơi lại';
      $('overlay').classList.remove('hidden');
    } else {
      audio.play(ev.name);
    }
  }
}

function updateHud() {
  const p = sim.player;
  const lit = sim.lanterns.filter((l) => l.lit).length;
  const t = Math.ceil(sim.timeLeft());
  $('hud-flames').textContent = `Lửa: ${'●'.repeat(Math.max(0, p.flames))}${'○'.repeat(Math.max(0, TUNING.flames - p.flames))}`;
  $('hud-carried').textContent = `Đom đóm: ${p.carried}/${TUNING.carry_capacity}`;
  $('hud-lanterns').textContent = `Đèn: ${lit}/${sim.lanterns.length}`;
  $('hud-time').textContent = `Bình minh: ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('hud-score').textContent = `Điểm: ${sim.score}`;
  const near = sim.lanterns.find((l) => !l.lit && distXZ(l.pos, p.pos) <= TUNING.interact_radius);
  $('hud-pulse').textContent =
    near && p.carried > 0
      ? `E: nạp đèn ${near.id} (${near.deposited}/${TUNING.lantern_cost})`
      : p.pulseCdTicks > 0
        ? `Tỏa sáng: hồi ${(p.pulseCdTicks / TICK_RATE).toFixed(1)}s`
        : p.carried >= TUNING.pulse_cost
          ? 'F: tỏa sáng sẵn sàng'
          : `Tỏa sáng: cần ${TUNING.pulse_cost} đom đóm`;
}

// ---------- render ----------
const clock = new THREE.Clock();
let acc = 0;
let facing = 0;
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
    updateHud();
  }

  // player
  const p = sim.player;
  const prev = player.position.clone();
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const mv = player.position.clone().sub(prev);
  if (mv.x * mv.x + mv.z * mv.z > 1e-6) facing = Math.atan2(mv.x, mv.z);
  player.rotation.y = facing;
  player.visible = p.invulnTicks === 0 || Math.floor(time * 12) % 2 === 0;

  // lanterns: island brightens as lanterns are lit
  let lit = 0;
  sim.lanterns.forEach((l, i) => {
    const m = lanternMeshes[i];
    if (!m) return;
    if (l.lit) lit++;
    const fill = Math.min(1, l.deposited / TUNING.lantern_cost);
    m.lampMat.emissiveIntensity = l.lit ? 2.2 + 0.2 * Math.sin(time * 3 + i) : fill * 0.8;
    m.light.intensity = l.lit ? 60 : fill * 6;
  });
  const frac = lit / Math.max(1, sim.lanterns.length);
  hemi.intensity = 0.6 + 1.4 * frac;
  scene.fog.density = 0.03 - 0.018 * frac;

  // motes
  syncMap(moteMeshes, sim.motes, () => new THREE.Mesh(moteGeo, moteMat));
  for (const m of sim.motes) {
    const mesh = moteMeshes.get(m.id);
    const ph = m.pos[0] * 1.7 + m.pos[2];
    mesh.position.set(m.pos[0], 0.8 + 0.25 * Math.sin(time * 2 + ph), m.pos[2]);
  }

  // shades
  syncMap(shadeMeshes, sim.shades, makeShade);
  for (const s of sim.shades) {
    const g = shadeMeshes.get(s.id);
    const stunned = s.stunTicks > 0;
    g.position.set(s.pos[0], s.pos[1] + 0.2 * Math.sin(time * 3 + s.pos[0]), s.pos[2]);
    g.lookAt(p.pos[0], g.position.y, p.pos[2]);
    g.userData.bodyMat.opacity = stunned ? 0.45 : 0.92;
    g.userData.bodyMat.emissive.setHex(stunned ? 0x8a6fb0 : 0x3d1466);
    g.scale.setScalar(stunned ? 0.8 + 0.05 * Math.sin(time * 20) : 1);
  }

  // pulse ring
  if (pulseFx < 1) {
    pulseFx = Math.min(1, pulseFx + dt * 2.5);
    pulseRing.position.set(p.pos[0], 0.1, p.pos[2]);
    pulseRing.scale.setScalar(TUNING.pulse_radius * pulseFx);
    pulseRing.material.opacity = 0.8 * (1 - pulseFx);
  }

  // third-person camera behind the player
  const yaw = (camYaw * Math.PI) / 180;
  const target = new THREE.Vector3(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
  const camPos = new THREE.Vector3(target.x - Math.sin(yaw) * 8, target.y + 4, target.z - Math.cos(yaw) * 8);
  if (mode === 'title') {
    camPos.set(Math.sin(time * 0.1) * 45, 22, Math.cos(time * 0.1) * 45);
    target.set(0, 0, 0);
  }
  camera.position.lerp(camPos, mode === 'title' ? 1 : 0.15);
  camera.lookAt(target);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

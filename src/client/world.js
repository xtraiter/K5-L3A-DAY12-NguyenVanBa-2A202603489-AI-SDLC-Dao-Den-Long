// 3D scene building for the three standard maps + entity meshes. Colours = Ticket-02 palette.
import * as THREE from 'three';
import { TUNING } from '../sim/config.js';

export const C = {
  sky: 0x0e1430, fog: 0x1b2350,
  grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, cloudSea: 0x12384a,
  lit: 0xffb347, core: 0xffe9b0, off: 0x5b5f6e,
  moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, shadeRim: 0x7a3cff, shadeStun: 0x3a3450,
  shirt: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
};

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const MAT = {
  grass: std(C.grass), sand: std(C.sand), wood: std(C.wood), stone: std(0x4a4f63),
  cliff: std(0x24413a), off: std(C.off), pad: std(C.gold, { emissive: C.gold, emissiveIntensity: 0.6 }),
};

function islandDisk(r, x = 0, z = 0) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.82, 8, 64), MAT.grass);
  top.position.set(x, -4, z);
  const beach = new THREE.Mesh(new THREE.TorusGeometry(r - 0.4, 0.6, 6, 64), MAT.sand);
  beach.rotation.x = Math.PI / 2;
  beach.position.set(x, -0.35, z);
  g.add(top, beach);
  return g;
}

function pad(p) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.15, 24), MAT.pad);
  m.position.set(p[0], p[1] + 0.08, p[2]);
  return m;
}

function trees(group, ground, rng, count, maxR, cx = 0, cz = 0, avoid = []) {
  const top = std(0x24493d);
  for (let i = 0; i < count; i++) {
    const r = 4 + Math.sqrt(rng()) * maxR;
    const a = rng() * Math.PI * 2;
    const x = cx + r * Math.cos(a);
    const z = cz + r * Math.sin(a);
    const y = ground(x, z);
    if (y === null || avoid.some((p) => Math.hypot(p[0] - x, p[2] - z) < 5)) continue;
    const h = 2 + rng() * 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.8, h, 7), top);
    t.position.set(x, y + 0.9 + h / 2, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 1), MAT.wood);
    trunk.position.set(x, y + 0.5, z);
    t.userData.tree = trunk.userData.tree = true;
    group.add(t, trunk);
  }
}

/** Build static terrain for a night. Returns a Group. */
export function buildTerrain(map, rng) {
  const g = new THREE.Group();
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), std(C.cloudSea, { roughness: 1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -14;
  g.add(sea);
  const cloudMat = std(0x1c4a5e, { transparent: true, opacity: 0.8 });
  for (let i = 0; i < 50; i++) {
    const a = rng() * Math.PI * 2;
    const r = 60 + rng() * 120;
    const c = new THREE.Mesh(new THREE.SphereGeometry(4 + rng() * 6, 10, 8), cloudMat);
    c.scale.y = 0.35;
    c.position.set(35 + r * Math.cos(a), -12 + rng() * 3, r * Math.sin(a));
    g.add(c);
  }
  const avoid = map.lanterns;
  if (map.id === 1) {
    g.add(islandDisk(40));
    trees(g, map.ground, rng, 45, 34, 0, 0, avoid);
  } else if (map.id === 2) {
    for (const [x, z, r] of map.islands) {
      g.add(islandDisk(r, x, z));
      trees(g, map.ground, rng, 22, 22, x, z, [...avoid, ...map.pads.map((p) => p.pos)]);
    }
    const { x, z } = map.bridge;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(x[1] - x[0] + 2, 0.3, z[1] - z[0]), MAT.wood);
    bridge.position.set((x[0] + x[1]) / 2, -0.15, 0);
    g.add(bridge);
    for (let bx = x[0]; bx <= x[1]; bx += 1.5) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, z[1] - z[0] + 0.2), MAT.sand);
      plank.position.set(bx, -0.13, 0);
      g.add(plank);
    }
    for (const p of map.pads) g.add(pad(p.pos));
  } else {
    g.add(islandDisk(45));
    // tier 1: half annulus 12-24 m on the z > 0 side, Y = 3
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false);
    sh.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
    const t1 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 48 }), MAT.cliff);
    t1.rotation.x = -Math.PI / 2;
    const t1top = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48), MAT.grass);
    t1top.rotation.x = -Math.PI / 2;
    t1top.position.y = 3.01;
    // tier 2: disk r 8, Y = 6
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), MAT.cliff);
    t2.position.y = 3;
    const t2top = new THREE.Mesh(new THREE.CircleGeometry(8, 48), MAT.grass);
    t2top.rotation.x = -Math.PI / 2;
    t2top.position.y = 6.01;
    // bell tower r 2, 8 m
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 24), MAT.stone);
    tower.position.y = 10;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.2, 24), std(0x7a2a1a));
    roof.position.y = 15.1;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), std(C.gold, { metalness: 0.6, roughness: 0.4 }));
    bell.position.set(0, 12.5, 2.1);
    g.add(t1, t1top, t2, t2top, tower, roof, bell);
    // ramps at 30° and 150°: r 30 (Y 0) -> r 24 (Y 3), 3 m wide
    for (const r of map.ramps) {
      const holder = new THREE.Group();
      holder.position.set(27 * r.c, 1.5, 27 * r.s);
      holder.rotation.y = Math.PI / 2 - (r.deg * Math.PI) / 180;
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, Math.hypot(6, 3)), MAT.wood);
      ramp.rotation.x = Math.atan2(3, 6);
      holder.add(ramp);
      g.add(holder);
    }
    for (const p of map.pads) g.add(pad(p.pos));
    trees(g, (x, z) => (x * x + z * z > 26 * 26 ? map.ground(x, z) : null), rng, 40, 40, 0, 0, avoid);
  }
  return g;
}

// Lantern body: lathe profile of a classic round paper lantern.
const lanternProfile = (() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(0.18 + 0.62 * Math.sin(Math.PI * t), -0.85 + 1.7 * t));
  }
  return pts;
})();
const lanternGeo = new THREE.LatheGeometry(lanternProfile, 20);
const ribGeo = new THREE.TorusGeometry(0.8, 0.025, 4, 24);

export function makeLantern(l) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 3.4, 10), MAT.wood);
  pole.position.y = 1.7;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.2), MAT.wood);
  arm.position.set(0, 3.35, 0.5);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.35, 12), MAT.stone);
  base.position.y = 0.17;
  const shellMat = std(C.off, { emissive: C.lit, emissiveIntensity: 0, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(lanternGeo, shellMat);
  shell.position.y = 4.3;
  const ribMat = std(C.scarf);
  for (const y of [-0.55, 0, 0.55]) {
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = 4.3 + y;
    rib.scale.setScalar(Math.sin(Math.PI * (0.5 + y / 1.7)) * 0.98 + 0.02);
    group.add(rib);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), new THREE.MeshBasicMaterial({ color: C.core }));
  core.position.y = 4.3;
  core.visible = false;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.18, 12), std(C.gold, { metalness: 0.5 }));
  cap.position.y = 5.2;
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), ribMat);
  tassel.position.y = 3.15;
  tassel.rotation.x = Math.PI;
  group.add(arm, base, tassel);
  const light = new THREE.PointLight(C.lit, 0, 30, 1.2);
  light.position.y = 4.3;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 64),
    new THREE.MeshBasicMaterial({ color: C.lit, transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.visible = false;
  group.add(pole, shell, core, cap, light, ring);
  group.position.set(l.pos[0], l.pos[1], l.pos[2]);
  return { group, shellMat, core, light, ring };
}

// Mây: small lantern keeper with áo bà ba (#E8E2D0), red scarf, nón lá and a hanging lantern.
// userData.animate(time, speed, grounded) drives a simple walk cycle.
export function makePlayer() {
  const p = new THREE.Group();
  const skin = std(0xf2d2b0);
  const shirtM = std(C.shirt);
  const pantsM = std(0x3b4a6b);
  const scarfM = std(C.scarf);
  const limb = (r, h, m) => {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 4, 8), m);
    mesh.position.y = -h / 2 - r;
    g.add(mesh);
    return g;
  };
  const legL = limb(0.09, 0.32, pantsM);
  const legR = limb(0.09, 0.32, pantsM);
  legL.position.set(-0.13, 0.5, 0);
  legR.position.set(0.13, 0.5, 0);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.33, 0.55, 14), shirtM);
  torso.position.y = 0.78;
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 6, 18), std(C.sand));
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.52;
  const armL = limb(0.07, 0.3, shirtM);
  const armR = limb(0.07, 0.3, shirtM);
  armL.position.set(-0.32, 1.0, 0);
  armR.position.set(0.32, 1.0, 0);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 20), scarfM);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.08;
  const tail = new THREE.Group();
  tail.position.set(0.08, 1.06, -0.18);
  const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.5), scarfM);
  tailMesh.position.z = -0.25;
  tail.add(tailMesh);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 14), skin);
  head.position.y = 1.36;
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1420 });
  for (const x of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeM);
    eye.position.set(x, 1.38, 0.23);
    p.add(eye);
  }
  const cheekM = new THREE.MeshBasicMaterial({ color: 0xf29a8a });
  for (const x of [-0.14, 0.14]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), cheekM);
    c.position.set(x, 1.31, 0.21);
    c.scale.z = 0.4;
    p.add(c);
  }
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.44, 28, 1, true), std(C.sand, { side: THREE.DoubleSide }));
  hat.position.y = 1.72;
  const hatRim = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.025, 6, 32), std(0xa8925f));
  hatRim.rotation.x = Math.PI / 2;
  hatRim.position.y = 1.5;
  // lantern hanging from the hat brim on a little stick
  const lampPivot = new THREE.Group();
  lampPivot.position.set(0.7, 1.5, 0.1);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), MAT.wood);
  string.position.y = -0.15;
  const lamp = new THREE.Mesh(lanternGeo, new THREE.MeshBasicMaterial({ color: C.lit }));
  lamp.scale.setScalar(0.16);
  lamp.position.y = -0.42;
  const glow = new THREE.PointLight(C.lit, 12, 14, 1.4);
  glow.position.y = -0.42;
  lampPivot.add(string, lamp, glow);
  p.add(legL, legR, torso, hem, armL, armR, scarf, tail, head, hat, hatRim, lampPivot);
  let phase = 0;
  p.userData.animate = (dt, speed, grounded, time) => {
    phase += dt * speed * 2.2;
    const swing = grounded ? Math.sin(phase) * Math.min(1, speed / 6) * 0.7 : 0.5;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8;
    armR.rotation.x = swing * 0.8;
    armL.rotation.z = grounded ? 0.12 : 0.9;
    armR.rotation.z = grounded ? -0.12 : -0.9;
    torso.position.y = 0.78 + (grounded ? Math.abs(Math.sin(phase)) * 0.04 * Math.min(1, speed / 6) : 0);
    tail.rotation.x = -0.2 - Math.min(1, speed / 8) * 0.9 + Math.sin(time * 9) * 0.12;
    tail.rotation.y = Math.sin(time * 5) * 0.2;
    lampPivot.rotation.z = Math.sin(time * 3) * 0.15 + Math.sin(phase) * 0.1;
    lampPivot.rotation.x = -Math.min(1, speed / 8) * 0.4;
    glow.intensity = 11 + Math.sin(time * 13) * 1.2;
  };
  return p;
}

const moteCoreGeo = new THREE.SphereGeometry(0.12, 10, 8);
const moteCoreMat = new THREE.MeshBasicMaterial({ color: C.moteCore });
const haloTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,229,138,0.9)');
  g.addColorStop(1, 'rgba(255,229,138,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const haloMat = new THREE.SpriteMaterial({ map: haloTex, color: C.moteHalo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

export function makeMote() {
  const g = new THREE.Group();
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(0.9);
  g.add(new THREE.Mesh(moteCoreGeo, moteCoreMat), halo);
  return g;
}

const shadeGeo = new THREE.SphereGeometry(0.8, 18, 14);
const rimMat = new THREE.MeshBasicMaterial({ color: C.shadeRim, side: THREE.BackSide });
const eyeGeo = new THREE.SphereGeometry(0.1, 8, 6);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9b3ff });
const tailGeo = new THREE.ConeGeometry(0.55, 1.4, 12);
const wispGeo = new THREE.ConeGeometry(0.12, 0.9, 6);
export function makeShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ color: C.shade, transparent: true, opacity: 0.95 });
  const body = new THREE.Mesh(shadeGeo, bodyMat);
  body.scale.y = 0.9;
  const rim = new THREE.Mesh(shadeGeo, rimMat);
  rim.scale.set(1.08, 0.98, 1.08);
  const tail = new THREE.Mesh(tailGeo, bodyMat);
  tail.rotation.x = Math.PI;
  tail.position.y = -0.85;
  const tailRim = new THREE.Mesh(tailGeo, rimMat);
  tailRim.rotation.x = Math.PI;
  tailRim.position.y = -0.85;
  tailRim.scale.setScalar(1.08);
  const wisps = [];
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(wispGeo, bodyMat);
    const a = (i / 4) * Math.PI * 2 + 0.4;
    w.position.set(Math.cos(a) * 0.55, -0.5, Math.sin(a) * 0.55);
    w.rotation.set(Math.PI + Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5);
    wisps.push(w);
    g.add(w);
  }
  const e1 = new THREE.Mesh(eyeGeo, eyeMat);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat);
  e1.position.set(-0.25, 0.15, 0.7);
  e2.position.set(0.25, 0.15, 0.7);
  e1.scale.y = e2.scale.y = 1.6;
  g.add(body, rim, tail, tailRim, e1, e2);
  g.userData = {
    bodyMat,
    animate: (time, ph) => {
      tail.rotation.z = Math.sin(time * 4 + ph) * 0.25;
      tailRim.rotation.z = tail.rotation.z;
      wisps.forEach((w, i) => (w.rotation.y = time * 2 + i + ph));
      e1.scale.y = e2.scale.y = Math.sin(time * 1.3 + ph) > 0.97 ? 0.2 : 1.6;
    },
  };
  return g;
}

export function makeDrifter() {
  const geo = new THREE.PlaneGeometry(0.45, 3, 1, 12);
  const mat = new THREE.MeshStandardMaterial({ color: C.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.85, emissive: C.drifter, emissiveIntensity: 0.25 });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = Math.PI / 2;
  const g = new THREE.Group();
  g.add(m);
  g.userData = { geo, base: geo.attributes.position.array.slice() };
  return g;
}

export function makeCharm() {
  const g = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.05), std(C.scarf, { emissive: C.scarf, emissiveIntensity: 0.4 }));
  const rim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.54, 0.79, 0.06)), new THREE.LineBasicMaterial({ color: C.gold }));
  g.add(card, rim);
  return g;
}

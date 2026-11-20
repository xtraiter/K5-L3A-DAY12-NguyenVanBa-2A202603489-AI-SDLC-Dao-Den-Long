// Lightweight particle system (one THREE.Points, additive) + ambient sky/fireflies.
// Purely visual: uses its own RNG, never touches the Sim.
import * as THREE from 'three';
import { mulberry32 } from '../sim/rng.js';

const rng = mulberry32(4242);
const dotTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();

export class Particles {
  constructor(scene, max = 1500) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.35, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.tmp = new THREE.Color();
  }

  emit(at, { n = 20, color = 0xffb347, speed = 4, up = 2, life = 0.8, gravity = 3, spread = 0.2 } = {}) {
    this.tmp.setHex(color);
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const a = rng() * Math.PI * 2;
      const e = rng() * 2 - 1;
      const s = speed * (0.4 + rng() * 0.6);
      this.pos[i * 3] = at[0] + (rng() - 0.5) * spread;
      this.pos[i * 3 + 1] = at[1] + (rng() - 0.5) * spread;
      this.pos[i * 3 + 2] = at[2] + (rng() - 0.5) * spread;
      this.vel[i * 3] = Math.cos(a) * s * Math.sqrt(1 - e * e);
      this.vel[i * 3 + 1] = e * s * 0.5 + up;
      this.vel[i * 3 + 2] = Math.sin(a) * s * Math.sqrt(1 - e * e);
      this.life[i] = this.maxLife[i] = life * (0.6 + rng() * 0.4);
      this.grav[i] = gravity;
      this.base[i * 3] = this.tmp.r;
      this.base[i * 3 + 1] = this.tmp.g;
      this.base[i * 3 + 2] = this.tmp.b;
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
        continue;
      }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      for (let a = 0; a < 3; a++) this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      for (let a = 0; a < 3; a++) this.col[i * 3 + a] = this.base[i * 3 + a] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export function makeSky(scene) {
  const n = 900;
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const e = 0.08 + rng() * 0.9;
    const r = 300;
    p[i * 3] = Math.cos(a) * Math.cos(e) * r;
    p[i * 3 + 1] = Math.sin(e) * r;
    p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, color: 0xdfe6ff, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1cf, fog: false }));
  moon.position.set(-120, 140, -180);
  scene.add(moon);
  return stars;
}

// Decorative fireflies drifting around the island (more as lanterns are lit).
export class Fireflies {
  constructor(scene, n = 160) {
    this.n = n;
    this.seed = Array.from({ length: n }, () => [rng() * 2 - 1, rng() * 2 - 1, rng(), rng() * 10]);
    this.pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.22, map: dotTex, color: 0xffe58a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(time, center, radius, frac) {
    const shown = Math.floor(this.n * (0.25 + 0.75 * frac));
    for (let i = 0; i < this.n; i++) {
      const [x, z, y, ph] = this.seed[i];
      const k = i < shown ? 1 : 0;
      this.pos[i * 3] = center[0] + x * radius + Math.sin(time * 0.5 + ph) * 2;
      this.pos[i * 3 + 1] = (0.5 + y * 5 + Math.sin(time + ph) * 0.5) * k - (1 - k) * 100;
      this.pos[i * 3 + 2] = center[2] + z * radius + Math.cos(time * 0.4 + ph) * 2;
    }
    this.mat.opacity = 0.5 + 0.3 * Math.sin(time * 2);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

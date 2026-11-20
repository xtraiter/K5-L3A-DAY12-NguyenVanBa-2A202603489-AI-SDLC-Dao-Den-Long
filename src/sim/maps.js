// Standard maps (Ticket-02 part 2). Angles are measured from +X towards +Z:
// point(r, deg) = (r·cos, r·sin). This matches the given lantern coordinates.
import { TUNING } from './config.js';

const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
};
const pt = (r, deg, y = 0, cx = 0, cz = 0) => {
  const a = (deg * Math.PI) / 180;
  return [r3(cx + r * Math.cos(a)), y, r3(cz + r * Math.sin(a))];
};
const ring = (r, start, step, n, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => pt(r, start + i * step, y, cx, cz));

// Durations come from TUNING (Ticket-03: 240 / 270 / 300 s).
// ---------- Night 1: Đảo Bến ----------
const night1 = {
  id: 1,
  name: 'Đảo Bến',
  duration: TUNING.night1_duration_s,
  start: [0, 0, 0],
  shadeSpeed: 4,
  shadeEvery: 480,
  shadeMax: 6,
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
  shadePoints: ring(37, 15, 30, 12),
  drifters: false,
  charms: [],
  wind: false,
  pads: [],
  ground(x, z) {
    return x * x + z * z <= 40 * 40 ? 0 : null;
  },
};

// ---------- Night 2: Đảo Cau ----------
const B = 70;
const launch = (from, to, vy, h) => {
  const dx = to[0] - from[0];
  const dz = to[1] - from[2];
  const d = Math.sqrt(dx * dx + dz * dz);
  return { pos: from, vy, vel: [(dx / d) * h, (dz / d) * h] };
};
const night2 = {
  id: 2,
  name: 'Đảo Cau',
  duration: TUNING.night2_duration_s,
  start: [0, 0, 0],
  shadeSpeed: 4,
  shadeEvery: 420,
  shadeMax: 8,
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  motePoints: [...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8), ...ring(10, 0, 90, 4, 0, B), ...ring(22, 0, 45, 8, 0, B)],
  shadePoints: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, 0, B)],
  drifters: true,
  charms: [{ id: 'C1', pos: [35, 0, 0] }],
  wind: false,
  pads: [launch([20, 0, 18], [B, 0], 14, 24), launch([50, 0, -18], [0, 0], 14, 24)],
  islands: [[0, 0, 28], [B, 0, 28]],
  bridge: { x: [26, 44], z: [-2, 2] },
  ground(x, z) {
    if (x * x + z * z <= 28 * 28) return 0;
    if ((x - B) * (x - B) + z * z <= 28 * 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
    return null;
  },
};

// ---------- Night 3: Đảo Chuông ----------
const RAMPS = [30, 150].map((deg) => ({ deg, c: Math.cos((deg * Math.PI) / 180), s: Math.sin((deg * Math.PI) / 180) }));
const night3 = {
  id: 3,
  name: 'Đảo Chuông',
  duration: TUNING.night3_duration_s,
  start: [0, 0, -30], // assumption: (0,0,0) is inside the bell tower
  shadeSpeed: 4.5,
  shadeEvery: 360,
  shadeMax: 10,
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  motePoints: [...ring(34, 0, 20, 18, 0), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
  shadePoints: ring(43, 0, 22.5, 16),
  drifters: true,
  charms: [
    { id: 'C1', pos: [30, 0, 25] },
    { id: 'C2', pos: [-30, 0, 25] },
  ],
  wind: true,
  pads: [{ pos: [0, 3, 13], vy: 12, vel: [0, -8] }],
  ramps: RAMPS,
  tower: { r: 2, h: 8 },
  ground(x, z) {
    const rr = x * x + z * z;
    if (rr > 45 * 45) return null;
    if (rr <= 2 * 2) return 14; // bell tower: 8 m tall on tier 2 => wall
    if (rr <= 8 * 8) return 6;
    if (z > 0 && rr >= 12 * 12 && rr <= 24 * 24) return 3;
    for (const r of RAMPS) {
      const u = x * r.c + z * r.s; // along the ramp axis (radius)
      const v = -x * r.s + z * r.c; // across
      if (u >= 24 && u <= 30 && Math.abs(v) <= 1.5) return (3 * (30 - u)) / 6;
    }
    return 0;
  },
};

export const NIGHTS = { 1: night1, 2: night2, 3: night3 };

// Ticket-04 §1 standard benchmark scene (same for every submission):
// Night 1, 200 wandering shades spread evenly over the island (seed 42), 100 motes,
// L1–L3 lit with fuel 100, Mây standing at (0,0,0). Spawning/damage/pickup/fuel/end disabled.
import { Sim } from './sim.js';
import { mulberry32 } from './rng.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

// Even spread over a disc: golden-angle (sunflower) layout with a small seeded jitter.
function spread(n, radius, rng, y) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = radius * Math.sqrt((i + 0.5) / n);
    const a = i * golden + rng() * 0.3;
    pts.push([r3(r * Math.cos(a)), y, r3(r * Math.sin(a))]);
  }
  return pts;
}

export const BENCH = { shades: 200, motes: 100, radius: 38, camRadius: 30, camY: 15, lapS: 15, warmupS: 3 };

export function makeBenchSim(seed = 42) {
  const rng = mulberry32(seed);
  const scenario = {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    player: { pos: [0, 0, 0] },
    shades: spread(BENCH.shades, BENCH.radius, rng, 1).map((pos, i) => ({ id: `S${i + 1}`, pos, state: 'wander' })),
    motes: spread(BENCH.motes, BENCH.radius - 2, rng, 0),
    lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: 100 })),
  };
  return new Sim({ seed, night: 1, scenario, bench: true });
}

/** Frame-time statistics exactly as defined in Ticket-04 §1. dts in ms. */
export function frameStats(dts) {
  const n = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  return {
    frames: n,
    avg_fps: n ? Math.round(((1000 * n) / sum) * 10) / 10 : 0,
    p1_low_fps: n ? Math.round((1000 / (worst.reduce((a, b) => a + b, 0) / k)) * 10) / 10 : 0,
    frame_ms_p95: n ? Math.round(p95 * 10) / 10 : 0,
  };
}

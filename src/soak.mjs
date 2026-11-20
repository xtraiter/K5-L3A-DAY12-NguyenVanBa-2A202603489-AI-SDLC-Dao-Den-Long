#!/usr/bin/env node
// Soak test (Ticket-04 §2): node --expose-gc src/soak.mjs --seed 7 --nights 10 --out soak.json
// Runs nights 1 -> 2 -> 3 (cycling) in one process; night i uses seed + i. Random inputs from the seed:
// new move direction every 30 ticks; per tick 5% jump, 3% dash, 2% pulse, 10% interact.
import { writeFileSync } from 'node:fs';
import { Sim } from './sim/sim.js';
import { NIGHTS } from './sim/maps.js';
import { TICK_RATE } from './sim/config.js';
import { mulberry32 } from './sim/rng.js';

function args(argv) {
  const out = { seed: 7, nights: 10, out: 'soak.json' };
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, '');
    const v = argv[i + 1];
    if (v === undefined) throw new Error(`missing value for ${argv[i]}`);
    if (k === 'seed' || k === 'nights') {
      if (!/^-?\d+$/.test(v)) throw new Error(`--${k} must be an integer`);
      out[k] = Number(v);
    } else if (k === 'out') out.out = v;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (out.nights < 1) throw new Error('--nights must be >= 1');
  return out;
}

const rssMb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
const gc = () => globalThis.gc?.();

function runNight(night, seed) {
  const sim = new Sim({ seed, night });
  const rng = mulberry32(seed ^ 0x50414b);
  const btn = { jump: false, dash: false, pulse: false, interact: false };
  let move = [0, 0];
  const maxTicks = Math.round(NIGHTS[night].duration * TICK_RATE) + 1;
  for (let t = 0; t < maxTicks && (sim.state === 'playing' || sim.state === 'paused'); t++) {
    if (t % 30 === 0) {
      const a = rng() * Math.PI * 2;
      move = [Math.cos(a), Math.sin(a)];
    }
    // buttons fire on false->true edges, so a "press" this tick needs false the tick before
    const press = (k, p) => (btn[k] = !btn[k] && rng() < p);
    press('jump', 0.05);
    press('dash', 0.03);
    press('pulse', 0.02);
    press('interact', 0.1);
    sim.step({ move, cam_yaw_deg: 0, ...btn, pause: false });
    sim.drainEvents();
  }
  return { sim, result: sim.state === 'won' ? 'won' : 'lost' };
}

try {
  const o = args(process.argv.slice(2));
  const t0 = Date.now();
  const results = [];
  let crashes = 0;
  let memStart = null;
  let current = null;
  for (let i = 0; i < o.nights; i++) {
    const night = 1 + (i % 3);
    try {
      if (i === 0) {
        // RSS after the first night is loaded
        current = new Sim({ seed: o.seed + i, night });
        gc();
        memStart = rssMb();
        current = null;
      }
      const { result } = runNight(night, o.seed + i);
      results.push(result);
    } catch (e) {
      crashes += 1;
      results.push('crash');
      process.stderr.write(`night ${i + 1} crashed: ${e.stack}\n`);
    }
  }
  current = null; // reset after the last night
  gc();
  const report = {
    nights: o.nights,
    crashes,
    results,
    mem_start_mb: memStart,
    mem_end_mb: rssMb(),
    duration_s: Math.round((Date.now() - t0) / 100) / 10,
  };
  writeFileSync(o.out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  process.exit(0);
} catch (e) {
  process.stderr.write(`error: ${e.message}\n`);
  process.exit(1);
}

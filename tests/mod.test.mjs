// Mod mode (web client secret code 787898): off by default, never used by headless/soak/bench.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/sim/sim.js';

const shadeOnMay = { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }] };
const run = (sim, ticks, input = {}) => {
  const ev = [];
  for (let i = 0; i < ticks && sim.state === 'playing'; i++) {
    sim.step({ move: [0, 0], cam_yaw_deg: 0, ...input });
    ev.push(...sim.drainEvents());
  }
  return ev;
};

test('mod is off by default (normal rules: the shade hits)', () => {
  const sim = new Sim({ seed: 1, scenario: shadeOnMay });
  assert.deepEqual(sim.cheats, { god: false, fullLanterns: false });
  assert.ok(run(sim, 5).some((e) => e.name === 'player_hit'));
});

test('god mode: shades never hit, falling has no penalty', () => {
  const sim = new Sim({ seed: 1, scenario: shadeOnMay });
  sim.setCheats({ god: true });
  assert.equal(run(sim, 600).filter((e) => e.name === 'player_hit').length, 0);
  assert.equal(sim.player.flames, 3);
  const fall = new Sim({ seed: 1, scenario: { ...shadeOnMay, shades: [], player: { pos: [39.5, 0, 0], carried: 4 } } });
  fall.setCheats({ god: true });
  const ev = run(fall, 200, { move: [1, 0] });
  assert.equal(ev.filter((e) => e.name === 'player_hit').length, 0);
  assert.equal(fall.player.flames, 3);
  assert.equal(fall.player.carried, 4);
});

test('full lanterns: every lantern lit with full fuel and stays full; no score for it', () => {
  const sim = new Sim({ seed: 1, night: 3, scenario: { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false } });
  sim.setCheats({ fullLanterns: true });
  run(sim, 600);
  assert.ok(sim.lanterns.every((l) => l.lit && l.fuel === 6000));
  assert.equal(sim.score, 0);
});

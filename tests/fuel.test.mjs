// Ticket-03 "Đèn cạn dầu" (contract v1.2): fuel, relight, refuel, drain, dawn win, capacity, scoring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, quiet, xz } from './helpers.mjs';

const ev = (r, name) => r.events.filter((e) => e.name === name);
const snapAt = (r, t) => r.snapshots.find((s) => s.tick === t);
const L = (r, t, id = 'L1') => snapAt(r, t).lanterns.find((l) => l.id === id);
const far = [0, 0, -30]; // keeps the default player away from lanterns

test('fuel decays 1/s while lit, exact over long runs (integer 1/60 units)', () => {
  const r = runHeadless({ scenario: quiet({ player: { pos: far }, lanterns: [{ id: 'L1', lit: true }] }), ticks: 600, every: 60 });
  assert.equal(L(r, 0).fuel, 100);
  assert.equal(L(r, 60).fuel, 99);
  assert.equal(L(r, 600).fuel, 90);
  assert.equal(snapAt(r, 0).lanterns[1].fuel, 0, 'unlit lantern reports fuel 0');
});

test('lantern goes out at fuel <= 0: lantern_out, deposited 0, ever_lit stays true', () => {
  const r = runHeadless({ scenario: quiet({ player: { pos: far }, lanterns: [{ id: 'L1', lit: true, fuel: 1 }] }), ticks: 61, every: 1 });
  assert.deepEqual(ev(r, 'lantern_out'), [{ type: 'event', tick: 60, name: 'lantern_out', data: { lantern_id: 'L1' } }]);
  assert.deepEqual(L(r, 60), { id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0, fuel: 0, ever_lit: true, relit_count: 0 });
});

test('relight: an ever-lit lantern needs only 5 motes, +40, relit_count, capacity grows by 2', () => {
  const r = runHeadless({
    scenario: quiet({ player: { carried: 6 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], ever_lit: true }] }),
    ticks: 2,
    every: 1,
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(ev(r, 'deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(ev(r, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.deepEqual(L(r, 1), { id: 'L1', pos: [0, 0, 1], lit: true, deposited: 5, fuel: 100, ever_lit: true, relit_count: 1 });
  assert.equal(snapAt(r, 1).player.carried, 1);
  assert.equal(snapAt(r, 1).player.capacity, 12);
  assert.equal(r.end.score, 5 * 5 + 40);
});

test('first light still needs 10 motes and gives +100', () => {
  const r = runHeadless({ scenario: quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] }), ticks: 1, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.deepEqual(ev(r, 'lantern_lit')[0].data, { lantern_id: 'L1', relight: false });
  assert.equal(r.end.score, 10 * 5 + 100);
});

test('refuel: used = min(carried, ceil((100-fuel)/10)), fuel += 10*used capped at 100, +5 per mote', () => {
  const partial = runHeadless({
    scenario: quiet({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 55 }] }),
    ticks: 1,
    every: 1,
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  // step 2 decays first: 55 - 1/60, then +20
  assert.deepEqual(ev(partial, 'refuel')[0].data, { lantern_id: 'L1', amount: 2, fuel: 75 });
  assert.equal(partial.end.score, 10);
  const capped = runHeadless({
    scenario: quiet({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 55 }] }),
    ticks: 1,
    every: 1,
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(ev(capped, 'refuel')[0].data, { lantern_id: 'L1', amount: 5, fuel: 100 });
  assert.equal(snapAt(capped, 1).player.carried, 5);
});

test('interact picks the nearest lantern that can take motes (lit-not-full beats a farther unlit one)', () => {
  const r = runHeadless({
    scenario: quiet({ player: { carried: 3 }, lanterns: [{ id: 'L2', pos: [0, 0, 1], lit: true, fuel: 50 }, { id: 'L1', pos: [0, 0, -1.5] }] }),
    ticks: 1,
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(ev(r, 'refuel')[0].data.lantern_id, 'L2');
  assert.equal(ev(r, 'deposit').length, 0);
});

test('a lantern below 30 fuel loses its safe zone; >= 30 keeps it', () => {
  const run = (fuel) =>
    runHeadless({
      scenario: quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel }], shades: [{ id: 'S1', pos: [10, 1, 0], state: 'chase' }] }),
      ticks: 400,
    });
  assert.ok(ev(run(29), 'player_hit').length > 0, 'weak lantern does not protect');
  assert.equal(ev(run(60), 'player_hit').length, 0, 'strong lantern protects');
});

test('wander shade goes to the nearest weak lantern, drains 5/s (+1/s decay), fuel_drain every 60 ticks', () => {
  const r = runHeadless({
    scenario: quiet({ player: { pos: [0, 0, -20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [0, 1, 30], state: 'wander' }] }),
    ticks: 600,
    every: 1,
  });
  const start = r.snapshots.find((s) => s.shades[0].state === 'drain');
  assert.ok(start, 'shade starts draining');
  assert.ok(Math.abs(start.shades[0].pos[2] - 20) <= 2 + 1e-6);
  const drains = ev(r, 'fuel_drain');
  assert.ok(drains.length >= 2);
  assert.deepEqual(Object.keys(drains[0].data), ['lantern_id', 'shade_id', 'fuel']);
  assert.equal(drains[1].tick - drains[0].tick, 60);
  assert.ok(Math.abs(drains[0].data.fuel - drains[1].data.fuel - 6) < 1e-9, '5 drain + 1 decay per second');
  const out = ev(r, 'lantern_out')[0];
  assert.ok(out, 'drained lantern goes out');
  assert.equal(snapAt(r, out.tick).shades[0].state, 'wander');
});

test('drain -> chase when Mây comes within 6 m', () => {
  const r = runHeadless({
    scenario: quiet({
      lanterns: [{ id: 'L1', pos: [0, 0, 10], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 1, 8.5], state: 'drain', target_lantern_id: 'L1' }],
    }),
    ticks: 60,
    every: 1,
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
  });
  assert.equal(snapAt(r, 1).shades[0].state, 'drain');
  const ch = r.snapshots.find((s) => s.shades[0].state === 'chase');
  assert.ok(ch && Math.abs(ch.shades[0].pos[2] - ch.player.pos[2]) <= 6 + 0.1);
});

test('refuel to >= 30 with a drainer nearby: shade stops draining and is pushed out (harmless)', () => {
  const r = runHeadless({
    scenario: quiet({
      player: { pos: [0, 0, 1.5], carried: 5 },
      lanterns: [{ id: 'L1', pos: [0, 0, 3], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 1, 5], state: 'drain', target_lantern_id: 'L1' }],
    }),
    ticks: 40,
    every: 1,
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.equal(ev(r, 'refuel')[0].tick, 1);
  assert.notEqual(snapAt(r, 1).shades[0].state, 'drain');
  const s31 = snapAt(r, 31).shades[0].pos;
  assert.ok(Math.hypot(s31[0], s31[2] - 3) >= 6 - 1e-3);
  assert.equal(ev(r, 'player_hit').length, 0);
});

test('pulse on a draining shade scores 15 (5 otherwise)', () => {
  const r = runHeadless({
    scenario: quiet({
      player: { carried: 3 },
      lanterns: [{ id: 'L1', pos: [0, 0, 5], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 1, 3.5], state: 'drain', target_lantern_id: 'L1' }],
    }),
    ticks: 1,
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.deepEqual(ev(r, 'pulse')[0].data, { stunned_ids: ['S1'] });
  assert.equal(r.end.score, 15);
});

test('dawn win: alive with >= ceil(0.6 x lanterns) lit; bonus 50 + floor(fuel) per lit lantern + 50 per flame', () => {
  const lit = (ids) => ids.map((id) => ({ id, lit: true }));
  const won = runHeadless({ scenario: quiet({ player: { pos: far }, time_left_s: 1, lanterns: lit(['L1', 'L2', 'L3']) }), ticks: 100 });
  assert.deepEqual(ev(won, 'game_over')[0], { type: 'event', tick: 60, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } });
  assert.deepEqual(won.end, { type: 'end', ticks: 60, state: 'won', score: 3 * (50 + 99) + 3 * 50 });
  const lost = runHeadless({ scenario: quiet({ player: { pos: far }, time_left_s: 1, lanterns: lit(['L1', 'L2']) }), ticks: 100 });
  assert.deepEqual(ev(lost, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(lost.end.score, 0);
});

test('dawn thresholds: night 2 needs 4/6, night 3 needs 5/7', () => {
  const lit = (n) => Array.from({ length: n }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
  const res = (night, n) => runHeadless({ night, scenario: quiet({ player: { pos: [0, 0, -40] }, time_left_s: 1, lanterns: lit(n) }), ticks: 100 }).end.state;
  assert.equal(res(2, 4), 'won');
  assert.equal(res(2, 3), 'lost');
  assert.equal(res(3, 5), 'won');
  assert.equal(res(3, 4), 'lost');
});

test('losing the last flame on the dawn tick is a loss (no_flames beats dawn_survived)', () => {
  const r = runHeadless({
    scenario: quiet({
      player: { flames: 1, invuln_ticks: 60 },
      time_left_s: 1,
      lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true })),
      shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }],
    }),
    ticks: 100,
  });
  assert.deepEqual(ev(r, 'game_over')[0], { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } });
});

test('capacity = 10 + 2 x successful_lights, max 20', () => {
  const cap = (n) => runHeadless({ scenario: quiet({ player: { successful_lights: n } }), ticks: 0 }).snapshots[0].player.capacity;
  assert.equal(cap(0), 10);
  assert.equal(cap(3), 16);
  assert.equal(cap(9), 20);
  const r = runHeadless({ scenario: quiet({ player: { carried: 11, successful_lights: 1 }, motes: [[0, 0, 0], [0, 0, 0.5]] }), ticks: 1 });
  assert.equal(ev(r, 'mote_picked').length, 1, 'capacity 12 => only one more mote');
});

test('scenario v1.2 fields are validated', () => {
  assert.equal(runHeadless({ scenario: { lanterns: [{ id: 'L1', lit: true, fuel: 150 }] } }).code, 2);
  assert.equal(runHeadless({ scenario: { lanterns: [{ id: 'L1', ever_lit: 'yes' }] } }).code, 2);
  assert.equal(runHeadless({ scenario: { player: { successful_lights: -1 } } }).code, 2);
  assert.equal(runHeadless({ scenario: { shades: [{ pos: [1, 1, 1], state: 'drain', target_lantern_id: 3 }] } }).code, 2);
  const ok = runHeadless({ scenario: { lanterns: [{ id: 'L1', lit: true, fuel: 42.5, ever_lit: true }] }, ticks: 0 });
  assert.equal(ok.code, 0);
  assert.equal(ok.snapshots[0].lanterns[0].fuel, 42.5);
});

// Core contract tests (Phase 1 rules re-checked with Ticket-02 standard numbers, Contract v1.1).
// Changes vs Phase 1 are listed in docs/notes/phase-2.md ("Test thay đổi").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHeadless, quiet, near, xz, ROOT } from './helpers.mjs';
import { TUNING } from '../src/sim/config.js';

const T = TUNING;
const gameEvents = (r) => r.events.filter((e) => e.name !== 'night_start');

test('contract v1.1: tuning matches the code', () => {
  const c = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.1');
  assert.deepEqual(c.tuning, TUNING);
});

test('output format: snapshots every N ticks, night_start at tick 0, end line last', () => {
  const r = runHeadless({ ticks: 25, every: 10 });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.snapshots.map((s) => s.tick), [0, 10, 20]);
  assert.deepEqual(r.lines[1], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
  assert.deepEqual(r.end, { type: 'end', ticks: 25, state: 'playing', score: 0 });
  const s0 = r.snapshots[0];
  assert.equal(s0.night, 1);
  assert.deepEqual(s0.wind, { active: false, dir_deg: 0 });
  assert.deepEqual(s0.player, {
    pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, flames: 3, carried: 0,
    invuln: false, dash_cd_s: 0, pulse_cd_s: 0, charm_s: 0,
  });
  assert.deepEqual(s0.lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.equal(s0.motes_active, 20);
  for (const m of s0.motes) assert.deepEqual(Object.keys(m), ['id', 'pos', 'kind', 'ttl_s']);
  assert.deepEqual(s0.drifters, []);
  assert.deepEqual(s0.charms, []);
  assert.equal(r.snapshots[2].time_left_s, Math.round((300 - 20 / 60) * 1000) / 1000);
});

test('determinism: same seed + inputs => identical bytes, all nights', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, { tick: 300, pulse: true }, { tick: 400, dash: true }] };
  for (const night of [1, 2, 3]) {
    const a = runHeadless({ seed: 7, night, ticks: 3000, inputs });
    const b = runHeadless({ seed: 7, night, ticks: 3000, inputs });
    assert.equal(a.code, 0, a.stderr);
    assert.equal(a.raw, b.raw, `night ${night}`);
  }
  assert.notEqual(runHeadless({ seed: 7, ticks: 600 }).raw, runHeadless({ seed: 8, ticks: 600 }).raw);
});

test('movement: 6 m/s, camera yaw mapping, diagonal normalised', () => {
  const run = (frame) => runHeadless({ scenario: quiet(), ticks: 60, inputs: { frames: [{ tick: 0, ...frame }] } }).snapshots.at(-1).player;
  assert.deepEqual(run({ move: [0, 1] }).pos, [0, 0, 6]);
  assert.deepEqual(run({ move: [0, 1] }).vel, [0, 0, 6]);
  assert.deepEqual(run({ move: [0, 1], cam_yaw_deg: 90 }).pos, [6, 0, 0]);
  assert.ok(near(xz(run({ move: [1, 1] }).pos), 6, 0.01));
});

test('tick model: snapshot 0 before input; event of step k has tick k+1', () => {
  const r = runHeadless({ scenario: quiet({ motes: [[0, 0, 0]] }), ticks: 5 });
  assert.equal(r.snapshots[0].motes_active, 1);
  assert.deepEqual(gameEvents(r)[0], { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } });
});

test('pickup: XZ radius inclusive, height difference <= 1.5, capacity 10', () => {
  const r = runHeadless({ scenario: quiet({ motes: [[0, 0, 1], [0, 0, -1.01]] }), ticks: 1 });
  assert.equal(gameEvents(r).filter((e) => e.name === 'mote_picked').length, 1);
  const full = runHeadless({ scenario: quiet({ motes: [[0, 0, 0]], player: { carried: 10 } }), ticks: 5 });
  assert.equal(gameEvents(full).length, 0);
  // mote on a higher tier (night 3, 3 m above feet) cannot be picked
  const hi = runHeadless({ night: 3, scenario: quiet({ player: { pos: [0, 0, -20] }, motes: [[0, 3, -20], [0, 1.5, -20]] }), ticks: 1 });
  assert.deepEqual(gameEvents(hi).map((e) => e.data.carried), [1]);
});

test('deposit: +10 per mote deposited, +100 when lit; scenario setup gives nothing', () => {
  const scenario = quiet({
    player: { carried: 3 },
    lanterns: [{ id: 'L1', pos: [0, 0, 2], deposited: 8 }, { id: 'L2', lit: true }],
  });
  const r = runHeadless({ scenario, ticks: 3, inputs: { frames: [{ tick: 1, interact: true }] } });
  assert.equal(r.snapshots[0].score, 0);
  assert.deepEqual(gameEvents(r).map((e) => [e.tick, e.name, e.data]), [
    [2, 'deposit', { lantern_id: 'L1', amount: 2, deposited: 10 }],
    [2, 'lantern_lit', { lantern_id: 'L1' }],
  ]);
  assert.equal(r.end.score, 2 * 10 + 100);
});

test('interact: radius 2, edge-triggered, nearest unlit lantern, tie -> smaller id', () => {
  const scenario = quiet({ player: { carried: 2 }, lanterns: [{ id: 'L2', pos: [0, 0, 2] }, { id: 'L1', pos: [0, 0, -2] }] });
  const r = runHeadless({ scenario, ticks: 10, inputs: { frames: [{ tick: 0, interact: true }] } });
  const dep = gameEvents(r).filter((e) => e.name === 'deposit');
  assert.deepEqual(dep.map((e) => e.data), [{ lantern_id: 'L1', amount: 2, deposited: 2 }]);
  const far = runHeadless({ scenario: quiet({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 2.01] }] }), ticks: 2, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(gameEvents(far).length, 0);
});

test('win: last lantern lit => won, bonus floor(t)*2 + 50*flames', () => {
  const lanterns = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  lanterns.push({ id: 'L1', pos: [0, 0, 1], deposited: 9 });
  const r = runHeadless({
    scenario: quiet({ player: { carried: 1 }, lanterns, time_left_s: 100 }),
    ticks: 600,
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.deepEqual(gameEvents(r).at(-1), { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  assert.deepEqual(r.end, { type: 'end', ticks: 1, state: 'won', score: 10 + 100 + 99 * 2 + 3 * 50 });
});

test('pulse: cost 3, 3D radius 5 from feet+0.8, stun, push 4 m over 15 ticks, cooldown 3 s', () => {
  const scenario = quiet({
    player: { carried: 5 },
    shades: [{ id: 'A', pos: [5, 0.8, 0], state: 'wander' }, { id: 'B', pos: [0, 0.8, -5.01], state: 'wander' }],
  });
  const inputs = { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }] };
  const r = runHeadless({ scenario, ticks: 16, inputs, every: 1 });
  const pulses = gameEvents(r).filter((e) => e.name === 'pulse');
  assert.deepEqual(pulses, [{ type: 'event', tick: 1, name: 'pulse', data: { stunned_ids: ['A'] } }]);
  const at = (t) => r.snapshots.find((s) => s.tick === t);
  assert.equal(at(1).player.carried, 2);
  assert.equal(at(1).player.pulse_cd_s, 3);
  assert.deepEqual(at(1).shades[0], { id: 'A', pos: [r3(5 + 4 / 15), 0.8, 0], state: 'stunned' });
  assert.deepEqual(at(15).shades[0].pos, [9, 0.8, 0]);
  assert.deepEqual(at(16).shades[0].pos, [9, 0.8, 0]);
  assert.equal(r.end.score, T.score.per_stun);
});
const r3 = (v) => Math.round(v * 1000) / 1000;

test('pulse needs 3 motes', () => {
  const r = runHeadless({ scenario: quiet({ player: { carried: 2 }, shades: [{ pos: [2, 1, 0] }] }), ticks: 1, inputs: { frames: [{ tick: 0, pulse: true }] } });
  assert.equal(gameEvents(r).filter((e) => e.name === 'pulse').length, 0);
});

test('stun lasts 120 ticks, then the shade resumes chasing', () => {
  const r = runHeadless({
    scenario: quiet({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 1, 0], state: 'chase' }] }),
    ticks: 121,
    every: 1,
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  const at = (t) => r.snapshots.find((s) => s.tick === t).shades[0];
  assert.equal(at(120).state, 'stunned');
  assert.equal(at(121).state, 'chase');
  assert.ok(at(121).pos[0] < at(120).pos[0]);
});

test('shade hit: -1 flame, drop floor(carried/2) on a 1.5–2.5 m ring, recoil, 90 ticks invuln', () => {
  const scenario = quiet({ player: { carried: 5, flames: 2 }, shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }] });
  const r = runHeadless({ scenario, ticks: 400, every: 1 });
  const hits = gameEvents(r).filter((e) => e.name === 'player_hit');
  assert.deepEqual(hits[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 1, dropped: 2 } });
  const s1 = r.snapshots.find((s) => s.tick === 1);
  assert.equal(s1.player.carried, 3);
  assert.equal(s1.player.invuln, true);
  assert.equal(s1.shades[0].state, 'recoil');
  const dropped = s1.motes.filter((m) => m.kind === 'dropped');
  assert.equal(dropped.length, 2);
  for (const m of dropped) {
    assert.ok(xz(m.pos) >= 1.5 - 1e-3 && xz(m.pos) <= 2.5 + 1e-3);
    assert.equal(m.ttl_s, 8);
  }
  assert.equal(hits[1].tick, 1 + 90);
  assert.deepEqual(gameEvents(r).at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.deepEqual(r.end, { type: 'end', ticks: 91, state: 'lost', score: 0 });
});

test('safe zone: only LIT lanterns block shades at 6 m', () => {
  const blocked = runHeadless({
    scenario: quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [10, 1, 0], state: 'chase' }] }),
    ticks: 600,
    every: 30,
  });
  for (const s of blocked.snapshots) assert.ok(xz(s.shades[0].pos) >= 6 - 1e-3, `tick ${s.tick}`);
  assert.equal(gameEvents(blocked).filter((e) => e.name === 'player_hit').length, 0);
  const open = runHeadless({
    scenario: quiet({ lanterns: [{ id: 'L1', pos: [0, 0, 0] }], shades: [{ id: 'S1', pos: [10, 1, 0], state: 'chase' }] }),
    ticks: 600,
  });
  assert.ok(gameEvents(open).some((e) => e.name === 'player_hit'));
});

test('safe zone: a shade inside a newly lit lantern is pushed out within 30 ticks, harmless', () => {
  const r = runHeadless({
    scenario: quiet({
      player: { carried: 1 },
      lanterns: [{ id: 'L1', pos: [0, 0, 1], deposited: 9 }],
      shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'chase' }],
    }),
    ticks: 200,
    every: 1,
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  assert.ok(gameEvents(r).some((e) => e.name === 'lantern_lit' && e.tick === 1));
  const d = (t) => Math.hypot(r.snapshots[t].shades[0].pos[0], r.snapshots[t].shades[0].pos[2] - 1);
  assert.ok(d(31) >= 6 - 1e-3, `after 30 ticks shade is ${d(31)} m from lantern`);
  assert.equal(gameEvents(r).filter((e) => e.name === 'player_hit').length, 0);
});

test('dawn: time runs out => lost/dawn', () => {
  const r = runHeadless({ scenario: quiet({ time_left_s: 1 }), ticks: 1000 });
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
  assert.deepEqual(gameEvents(r).at(-1).data, { result: 'lost', reason: 'dawn' });
});

test('bad inputs/scenario => exit 2; bad CLI => non-zero', () => {
  assert.equal(runHeadless({ inputs: '{not json' }).code, 2);
  assert.equal(runHeadless({ inputs: { frames: [{ tick: 5 }, { tick: 5 }] } }).code, 2);
  assert.equal(runHeadless({ inputs: { frames: [{ tick: 0, move: [2, 0] }] } }).code, 2);
  assert.equal(runHeadless({ inputs: { frames: [{ tick: 0, dash: 'yes' }] } }).code, 2);
  assert.equal(runHeadless({ scenario: { shades: [{ pos: [1, 2] }] } }).code, 2);
  assert.equal(runHeadless({ scenario: { shades: [{ pos: [1, 2, 3], state: 'angry' }] } }).code, 2);
  assert.equal(runHeadless({ scenario: { drifters: [{ pos: [1, 2, 3], state: 'x' }] } }).code, 2);
  assert.equal(runHeadless({ scenario: '[]' }).code, 2);
  assert.notEqual(runHeadless({ extraArgs: ['--bogus'] }).code, 0);
  const n4 = runHeadless({ night: 4 });
  assert.notEqual(n4.code, 0);
  assert.match(n4.stderr, /night/);
});

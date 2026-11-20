import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runHeadless, quiet, ROOT } from './helpers.mjs';
import { TUNING } from '../src/sim/config.js';

const T = TUNING;

test('contract tuning matches the code', () => {
  const c = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.0');
  assert.deepEqual(c.tuning, TUNING);
});

test('output format: snapshot at tick 0, every N ticks, end line last', () => {
  const r = runHeadless({ ticks: 25, every: 10 });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.snapshots.map((s) => s.tick), [0, 10, 20]);
  assert.deepEqual(r.end, { type: 'end', ticks: 25, state: 'playing', score: r.end.score });
  const s0 = r.snapshots[0];
  assert.deepEqual(s0.player, { pos: [0, 0, 0], flames: T.flames, carried: 0 });
  assert.equal(s0.lanterns.length, 5);
  assert.equal(s0.time_left_s, T.night1_duration_s);
  assert.equal(r.snapshots[2].time_left_s, Math.round((T.night1_duration_s - 20 / 60) * 1000) / 1000);
});

test('determinism: same seed + inputs => identical bytes (incl. random spawns)', () => {
  const inputs = { frames: [{ tick: 0, move: [0.3, 1], cam_yaw_deg: 30 }, { tick: 300, pulse: true }] };
  const a = runHeadless({ seed: 7, ticks: 2400, inputs });
  const b = runHeadless({ seed: 7, ticks: 2400, inputs });
  assert.equal(a.code, 0, a.stderr);
  assert.equal(a.raw, b.raw);
  const c = runHeadless({ seed: 8, ticks: 2400, inputs });
  assert.notEqual(a.raw, c.raw);
});

test('movement: move [0,1] at yaw 0 goes +Z at player_speed; yaw 90 maps to +X', () => {
  const r = runHeadless({ scenario: quiet(), ticks: 60, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.deepEqual(r.snapshots.at(-1).player.pos, [0, 0, T.player_speed]);
  const r2 = runHeadless({
    scenario: quiet(),
    ticks: 60,
    inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] },
  });
  assert.deepEqual(r2.snapshots.at(-1).player.pos, [T.player_speed, 0, 0]);
  // diagonal is normalised
  const r3 = runHeadless({ scenario: quiet(), ticks: 60, inputs: { frames: [{ tick: 0, move: [1, 1] }] } });
  const [x, , z] = r3.snapshots.at(-1).player.pos;
  assert.ok(Math.abs(Math.hypot(x, z) - T.player_speed) < 0.01);
});

test('tick model: snapshot 0 is before input; event of step k has tick k+1', () => {
  const r = runHeadless({ scenario: quiet({ motes: [[0, 0, 0]] }), ticks: 5 });
  assert.equal(r.snapshots[0].motes_active, 1);
  assert.deepEqual(r.events[0], { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } });
});

test('pickup radius is inclusive and capacity is respected', () => {
  const motes = [[0, 0, T.pickup_radius], [0, 0, -T.pickup_radius - 0.01]];
  const r = runHeadless({ scenario: quiet({ motes }), ticks: 1 });
  assert.equal(r.events.filter((e) => e.name === 'mote_picked').length, 1);
  const full = runHeadless({ scenario: quiet({ motes: [[0, 0, 0]], player: { carried: T.carry_capacity } }), ticks: 5 });
  assert.equal(full.events.length, 0);
  assert.equal(full.end.score, 0);
});

test('deposit + lantern_lit + score; scenario setup gives no score/events', () => {
  const scenario = quiet({
    player: { carried: 3 },
    lanterns: [
      { id: 'L1', pos: [0, 0, T.interact_radius], deposited: T.lantern_cost - 2 },
      { id: 'L2', lit: true },
    ],
  });
  const r = runHeadless({ scenario, ticks: 3, inputs: { frames: [{ tick: 1, interact: true }] } });
  assert.equal(r.snapshots[0].score, 0);
  assert.deepEqual(
    r.events.map((e) => [e.tick, e.name, e.data]),
    [
      [2, 'deposit', { lantern_id: 'L1', amount: 2, deposited: T.lantern_cost }],
      [2, 'lantern_lit', { lantern_id: 'L1' }],
    ],
  );
  assert.equal(r.end.score, T.score.per_lantern);
});

test('interact only triggers on false->true edge', () => {
  const scenario = quiet({ player: { carried: 2 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] });
  const r = runHeadless({ scenario, ticks: 10, inputs: { frames: [{ tick: 0, interact: true }] } });
  assert.equal(r.events.filter((e) => e.name === 'deposit').length, 1);
});

test('win: lighting the last lantern ends the game with bonus', () => {
  const lanterns = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  lanterns.push({ id: 'L1', pos: [0, 0, 1], deposited: T.lantern_cost - 1 });
  const r = runHeadless({
    scenario: quiet({ player: { carried: 1 }, lanterns, time_left_s: 100 }),
    ticks: 600,
    inputs: { frames: [{ tick: 0, interact: true }] },
  });
  const over = r.events.find((e) => e.name === 'game_over');
  assert.deepEqual(over, { type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  const timeLeft = Math.floor(100 - 1 / 60);
  assert.deepEqual(r.end, {
    type: 'end',
    ticks: 1,
    state: 'won',
    score: T.score.per_lantern + timeLeft * T.score.per_second_left + T.flames * T.score.per_flame_left,
  });
});

test('pulse: costs light, stuns and pushes shades in radius, respects cooldown', () => {
  const scenario = quiet({
    player: { carried: 3 },
    shades: [
      { id: 'A', pos: [T.pulse_radius, 0, 0] },
      { id: 'B', pos: [0, 0, -(T.pulse_radius + 1)] },
    ],
  });
  const inputs = { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }] };
  const r = runHeadless({ scenario, ticks: 1, inputs, every: 1 });
  const pulse = r.events.find((e) => e.name === 'pulse');
  assert.deepEqual(pulse.data, { stunned_ids: ['A'] });
  const s1 = r.snapshots.find((s) => s.tick === 1);
  assert.equal(s1.player.carried, 3 - T.pulse_cost);
  assert.deepEqual(s1.shades[0], { id: 'A', pos: [T.pulse_radius + T.pulse_push_m, 0, 0], state: 'stunned' });
  assert.equal(r.end.score, T.score.per_stun);
  // second press inside cooldown does nothing
  const r2 = runHeadless({ scenario, ticks: 10, inputs });
  assert.equal(r2.events.filter((e) => e.name === 'pulse').length, 1);
});

test('pulse without enough light does nothing', () => {
  const r = runHeadless({
    scenario: quiet({ shades: [{ pos: [2, 0, 0] }] }),
    ticks: 1,
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.equal(r.events.filter((e) => e.name === 'pulse').length, 0);
});

test('stun lasts pulse_stun_s, then the shade chases again', () => {
  const stunTicks = T.pulse_stun_s * 60;
  const r = runHeadless({
    scenario: quiet({ player: { carried: 1 }, shades: [{ id: 'S1', pos: [3, 0, 0] }] }),
    ticks: stunTicks + 1,
    every: 1,
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  const at = (t) => r.snapshots.find((s) => s.tick === t).shades[0];
  assert.equal(at(stunTicks).state, 'stunned');
  assert.equal(at(stunTicks + 1).state, 'chase');
  assert.ok(at(stunTicks + 1).pos[0] < at(stunTicks).pos[0]);
});

test('shade hit: lose flame, drop motes, invulnerability, then lose on no flames', () => {
  const scenario = quiet({ player: { carried: 4, flames: 2 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] });
  const r = runHeadless({ scenario, ticks: 1000 });
  const hits = r.events.filter((e) => e.name === 'player_hit');
  assert.deepEqual(hits[0], {
    type: 'event',
    tick: 1,
    name: 'player_hit',
    data: { by: 'shade', flames: 1, dropped: Math.floor(4 * T.hit_drop_ratio) },
  });
  assert.equal(hits[1].tick, 1 + T.invuln_s * 60);
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(r.end.state, 'lost');
  assert.equal(r.end.ticks, hits[1].tick);
});

test('shades cannot enter safe_radius around a lantern', () => {
  const scenario = quiet({
    lanterns: [{ id: 'L1', pos: [0, 0, 0] }],
    shades: [{ id: 'S1', pos: [15, 0, 0] }],
  });
  const r = runHeadless({ scenario, ticks: 600, every: 60 });
  for (const s of r.snapshots) {
    const [x, , z] = s.shades[0].pos;
    assert.ok(Math.hypot(x, z) >= T.safe_radius - 0.001, `tick ${s.tick}: shade at ${x},${z}`);
  }
  assert.equal(r.events.filter((e) => e.name === 'player_hit').length, 0);
});

test('dawn: time runs out => lost/dawn', () => {
  const r = runHeadless({ scenario: quiet({ time_left_s: 1 }), ticks: 1000 });
  assert.deepEqual(r.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
  assert.deepEqual(r.events.at(-1).data, { result: 'lost', reason: 'dawn' });
});

test('random shades spawn with shade_spawned events and deterministic ids', () => {
  const r = runHeadless({ seed: 3, ticks: 25 * 60, scenario: { random_motes: false } });
  assert.deepEqual(r.snapshots[0].shades.map((s) => s.id), ['S1', 'S2']);
  const spawned = r.events.filter((e) => e.name === 'shade_spawned');
  if (r.end.state === 'playing') assert.deepEqual(spawned.map((e) => e.data.id), ['S3']);
});

test('bad inputs/scenario => exit 2; bad CLI => non-zero', () => {
  assert.equal(runHeadless({ inputs: '{not json' }).code, 2);
  assert.equal(runHeadless({ inputs: { frames: [{ tick: 5 }, { tick: 5 }] } }).code, 2);
  assert.equal(runHeadless({ inputs: { frames: [{ tick: 0, move: [2, 0] }] } }).code, 2);
  assert.equal(runHeadless({ inputs: { frames: [{ tick: 0, pulse: 'yes' }] } }).code, 2);
  assert.equal(runHeadless({ scenario: { shades: [{ pos: [1, 2] }] } }).code, 2);
  assert.equal(runHeadless({ scenario: '[]' }).code, 2);
  const bad = runHeadless({ extraArgs: ['--bogus'] });
  assert.notEqual(bad.code, 0);
  assert.match(bad.stderr, /error/);
});

// Ticket-02 feature scenarios: at least one headless scenario per new feature.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless, quiet, near, xz } from './helpers.mjs';

const ev = (r, name) => r.events.filter((e) => e.name === name);
const snapAt = (r, t) => r.snapshots.find((s) => s.tick === t);

// ---------- shades: schedule & states ----------
test('shade schedule night 1: 2 at tick 300, then 1 every 480 ticks, state spawning', () => {
  const r = runHeadless({ ticks: 800, every: 100, scenario: { random_motes: false } });
  assert.deepEqual(ev(r, 'shade_spawned').map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3']]);
  const s = snapAt(r, 300).shades;
  assert.deepEqual(s.map((x) => x.state), ['spawning', 'spawning']);
  for (const x of s) assert.ok(xz(x.pos) > 36.9 && xz(x.pos) < 37.1);
});

test('shade spawn points are >= 15 m from the player; max 6 on night 1', () => {
  const r = runHeadless({ ticks: 5000, every: 10, scenario: { random_motes: false, player: { pos: [35, 0, 0] } } });
  for (const e of ev(r, 'shade_spawned')) {
    const snap = snapAt(r, Math.ceil(e.tick / 10) * 10);
    const sh = snap.shades.find((s) => s.id === e.data.id);
    if (snap.tick === e.tick) assert.ok(Math.hypot(sh.pos[0] - 35, sh.pos[2]) >= 15);
  }
  assert.ok(ev(r, 'shade_spawned').length <= 6);
});

test('shade states: wander -> chase within 12 m, chase -> wander beyond 18 m', () => {
  const r = runHeadless({
    scenario: quiet({ shades: [{ id: 'S1', pos: [11, 1, 0], state: 'wander' }] }),
    ticks: 300,
    every: 1,
    inputs: { frames: [{ tick: 0, move: [-1, 0] }] },
  });
  assert.equal(snapAt(r, 1).shades[0].state, 'chase');
  const lost = r.snapshots.find((s) => s.shades[0].state === 'wander' && s.tick > 1);
  assert.ok(lost, 'shade gives up');
  // the 18 m check happens before the shade's own wander step in that tick (<= 1.5/60 m)
  assert.ok(Math.hypot(lost.shades[0].pos[0] - lost.player.pos[0], lost.shades[0].pos[2] - lost.player.pos[2]) > 18 - 1.5 / 60);
});

test('spawning shades are harmless and still for 60 ticks', () => {
  const r = runHeadless({
    scenario: quiet({ shades: [{ id: 'S1', pos: [0.5, 1, 0], state: 'spawning', state_ticks_left: 60 }] }),
    ticks: 70,
    every: 1,
  });
  assert.equal(snapAt(r, 59).shades[0].state, 'spawning');
  assert.deepEqual(snapAt(r, 59).shades[0].pos, [0.5, 1, 0]);
  assert.equal(ev(r, 'player_hit')[0].tick, 60);
});

// ---------- dash ----------
test('dash: 14 m/s for 12 ticks, cooldown 90 ticks from the start of the dash', () => {
  const r = runHeadless({
    scenario: quiet(),
    ticks: 100,
    every: 1,
    inputs: { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 50, dash: true }, { tick: 51, dash: false }, { tick: 90, dash: true }] },
  });
  assert.deepEqual(ev(r, 'dash').map((e) => e.tick), [1, 91]);
  // standing still => dash along facing (+Z)
  assert.deepEqual(snapAt(r, 12).player.pos, [0, 0, 2.8]);
  assert.equal(snapAt(r, 1).player.dash_cd_s, 1.5);
});

test('dash in the air keeps altitude', () => {
  const r = runHeadless({
    scenario: quiet(),
    ticks: 30,
    every: 1,
    inputs: { frames: [{ tick: 0, jump: true }, { tick: 10, dash: true, move: [1, 0] }] },
  });
  const y10 = snapAt(r, 10).player.pos[1];
  assert.ok(y10 > 0);
  for (let t = 11; t <= 22; t++) assert.equal(snapAt(r, t).player.pos[1], y10, `tick ${t}`);
  assert.ok(snapAt(r, 23).player.pos[1] < y10);
  assert.ok(near(snapAt(r, 22).player.pos[0], 12 * 14 / 60 + 0, 0.01));
});

// ---------- jump & fall ----------
test('jump: 7 m/s, gravity 20, only from the ground', () => {
  const r = runHeadless({ scenario: quiet(), ticks: 60, every: 1, inputs: { frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 5, jump: true }] } });
  const ys = r.snapshots.map((s) => s.player.pos[1]);
  assert.ok(Math.max(...ys) > 1.1 && Math.max(...ys) < 1.3);
  assert.equal(snapAt(r, 60).player.grounded, true);
  assert.equal(ys.filter((y, i) => i > 0 && y === 0 && ys[i - 1] > 0).length, 1, 'lands once, no double jump');
});

test('fall off the island: -1 flame, lose all motes, respawn at start after 60 ticks with invuln', () => {
  const r = runHeadless({
    scenario: quiet({ player: { pos: [39, 0, 0], carried: 4 } }),
    ticks: 300,
    every: 1,
    inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 20, move: [0, 0] }] },
  });
  const falls = ev(r, 'player_hit');
  assert.equal(falls.length, 1);
  assert.deepEqual(falls[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 4 });
  const back = snapAt(r, falls[0].tick + 60).player;
  assert.deepEqual(back.pos, [0, 0, 0]);
  assert.equal(back.invuln, true);
  assert.equal(back.carried, 0);
  assert.notDeepEqual(snapAt(r, falls[0].tick + 59).player.pos, [0, 0, 0]);
});

test('falling with the last flame loses immediately', () => {
  const r = runHeadless({ scenario: quiet({ player: { pos: [39.9, 0, 0], flames: 1 } }), ticks: 300, inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  assert.equal(r.end.state, 'lost');
  assert.deepEqual(ev(r, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
});

// ---------- dropped motes ----------
test('dropped motes expire after their TTL', () => {
  const r = runHeadless({ scenario: quiet({ motes: [{ pos: [10, 0, 0], kind: 'dropped', ttl_s: 1 }] }), ticks: 61, every: 1 });
  assert.equal(snapAt(r, 59).motes_active, 1);
  assert.equal(snapAt(r, 59).motes[0].kind, 'dropped');
  assert.equal(snapAt(r, 60).motes_active, 0);
});

test('random motes: 20 at start, +1 every 240 ticks at a free point, up to the free points', () => {
  const r = runHeadless({ ticks: 1300, every: 240, scenario: { random_shades: false } });
  assert.deepEqual(r.snapshots.map((s) => s.motes_active), [20, 21, 22, 23, 24, 24]);
  const pts = new Set(r.snapshots.at(-1).motes.map((m) => m.pos.join()));
  assert.equal(pts.size, 24);
});

// ---------- night 2: islands, bridge, launch pads ----------
test('night 2 map: 6 lanterns, bridge is walkable, gap is not', () => {
  const r = runHeadless({ night: 2, scenario: quiet({ player: { pos: [27, 0, 0] } }), ticks: 180, every: 60, inputs: { frames: [{ tick: 0, move: [1, 0], cam_yaw_deg: 0 }] } });
  assert.deepEqual(r.snapshots[0].lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
  assert.equal(ev(r, 'player_hit').length, 0, 'walking along the bridge is safe');
  assert.ok(r.snapshots.at(-1).player.pos[0] > 44);
  const gap = runHeadless({ night: 2, scenario: quiet({ player: { pos: [35, 0, 1.5] } }), ticks: 200, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  assert.equal(ev(gap, 'player_hit')[0].data.by, 'fall');
});

test('night 2 launch pad flies the player to the other island (~1.4 s)', () => {
  const r = runHeadless({ night: 2, scenario: quiet({ player: { pos: [20, 0, 18] } }), ticks: 120, every: 1 });
  assert.equal(ev(r, 'player_hit').length, 0);
  const landed = r.snapshots.find((s) => s.tick > 1 && s.player.grounded);
  assert.ok(landed.tick >= 80 && landed.tick <= 90, `landed at ${landed.tick}`);
  assert.ok(Math.hypot(landed.player.pos[0] - 70, landed.player.pos[2]) < 28);
  assert.ok(snapAt(r, 40).player.pos[1] > 4);
});

// ---------- night 3: tiers, ramps, pad, tower, wind ----------
test('night 3: ramp at 30° leads to tier 1 (Y=3); tier 2 edge is a wall', () => {
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  const r = runHeadless({
    night: 3,
    scenario: quiet({ player: { pos: [31 * c, 0, 31 * s] } }),
    ticks: 120,
    inputs: { frames: [{ tick: 0, move: [-c, -s] }] },
  });
  const p = r.snapshots.at(-1).player;
  assert.equal(p.pos[1], 3);
  assert.equal(p.grounded, true);
  const wall = runHeadless({ night: 3, scenario: quiet({ player: { pos: [0, 0, -12] } }), ticks: 120, inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const w = wall.snapshots.at(-1).player.pos;
  assert.equal(w[1], 0);
  assert.ok(w[2] <= -8 && w[2] > -8.2, `stopped at z=${w[2]}`);
});

test('night 3 launch pad (0,3,13) lands on tier 2 (Y=6)', () => {
  const r = runHeadless({ night: 3, scenario: quiet({ player: { pos: [0, 3, 13] } }), ticks: 90 });
  const p = r.snapshots.at(-1).player;
  assert.equal(p.pos[1], 6);
  assert.equal(p.grounded, true);
  assert.ok(xz(p.pos) < 8);
});

test('night 3 wind: every 30 s a 5 s gust pushes the player 2 m/s', () => {
  const r = runHeadless({ night: 3, scenario: quiet({ wind_enabled: true }), ticks: 2110, every: 10 });
  assert.equal(snapAt(r, 1790).wind.active, false);
  assert.equal(snapAt(r, 1800).wind.active, true);
  assert.equal(snapAt(r, 2100).wind.active, false);
  const a = snapAt(r, 1790).player.pos;
  const b = snapAt(r, 2100).player.pos;
  assert.ok(near(Math.hypot(b[0] - a[0], b[2] - a[2]), 10, 0.05));
  const calm = runHeadless({ night: 1, ticks: 1900, every: 100, scenario: { random_shades: false } });
  assert.equal(calm.snapshots.every((s) => !s.wind.active), true);
});

// ---------- drifters ----------
test('drifter: chases a player carrying >= 5, steals min(3, carried), flees 240 ticks, removed', () => {
  const r = runHeadless({ night: 2, scenario: quiet({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }), ticks: 400, every: 1 });
  assert.equal(snapAt(r, 1).drifters[0].state, 'chase');
  const steal = ev(r, 'drifter_steal');
  assert.equal(steal.length, 1);
  assert.deepEqual(steal[0].data, { drifter_id: 'D1', amount: 3, carried: 3 });
  assert.deepEqual(snapAt(r, steal[0].tick).drifters[0].state, 'flee');
  assert.equal(snapAt(r, steal[0].tick + 240).drifters[0].state, 'removed');
  assert.equal(snapAt(r, steal[0].tick + 240).drifters[0].stolen, 3);
  assert.equal(snapAt(r, 400).player.flames, 3);
});

test('drifter ignores player invulnerability and does not chase below 5 motes', () => {
  const r = runHeadless({ night: 2, scenario: quiet({ player: { carried: 5, invuln_ticks: 90 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0] }] }), ticks: 60 });
  assert.equal(ev(r, 'drifter_steal').length, 1);
  const calm = runHeadless({ night: 2, scenario: quiet({ player: { carried: 4 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0] }] }), ticks: 30, every: 30 });
  assert.equal(calm.snapshots.at(-1).drifters[0].state, 'idle');
});

test('pulse on a chasing drifter makes it flee without stealing', () => {
  const r = runHeadless({
    night: 2,
    scenario: quiet({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [4, 1.5, 0] }] }),
    ticks: 300,
    every: 1,
    inputs: { frames: [{ tick: 1, pulse: true }] },
  });
  assert.equal(snapAt(r, 2).drifters[0].state, 'flee');
  assert.equal(ev(r, 'drifter_steal').length, 0);
  assert.equal(snapAt(r, 300).player.carried, 3);
});

test('pulse on a fleeing drifter with loot drops it as dropped motes; drifter vanishes after 120 ticks', () => {
  const r = runHeadless({
    night: 2,
    scenario: quiet({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3 }] }),
    ticks: 130,
    every: 1,
    inputs: { frames: [{ tick: 0, pulse: true }] },
  });
  assert.deepEqual(ev(r, 'drifter_drop')[0], { type: 'event', tick: 1, name: 'drifter_drop', data: { drifter_id: 'D1', amount: 3 } });
  assert.equal(snapAt(r, 1).motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(snapAt(r, 120).drifters[0].state, 'flee');
  assert.equal(snapAt(r, 121).drifters[0].state, 'removed');
});

test('drifters spawn on nights 2-3 at tick 1200 (ids D1..), never on night 1', () => {
  const r = runHeadless({ night: 2, ticks: 1200, every: 1200, scenario: { random_shades: false } });
  assert.deepEqual(r.snapshots.at(-1).drifters.map((d) => [d.id, d.state]), [['D1', 'idle']]);
  const n1 = runHeadless({ night: 1, ticks: 1200, every: 1200, scenario: { random_shades: false } });
  assert.deepEqual(n1.snapshots.at(-1).drifters, []);
});

// ---------- charms ----------
test('wind charm: pickup event, 7.2 m/s, dash without cooldown, respawn after 2700 ticks', () => {
  const r = runHeadless({
    night: 2,
    scenario: quiet({ player: { pos: [35, 0, 0] }, charms: [{ id: 'C1', pos: [35, 0, 0] }] }),
    ticks: 61,
    every: 1,
    inputs: { frames: [{ tick: 1, move: [1, 0] }, { tick: 20, dash: true }, { tick: 21, dash: false }, { tick: 33, dash: true }] },
  });
  assert.deepEqual(ev(r, 'charm_picked')[0], { type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } });
  assert.deepEqual(snapAt(r, 1).charms[0], { id: 'C1', pos: [35, 0, 0], available: false, respawn_s: 45 });
  assert.equal(snapAt(r, 1).player.charm_s, 10);
  assert.equal(snapAt(r, 10).player.vel[0], 7.2);
  assert.deepEqual(ev(r, 'dash').map((e) => e.tick), [21, 34]);
  const back = runHeadless({ night: 2, scenario: quiet({ charms: [{ id: 'C1', available: false, respawn_ticks: 10 }] }), ticks: 10, every: 1 });
  assert.equal(snapAt(back, 9).charms[0].available, false);
  assert.equal(snapAt(back, 10).charms[0].available, true);
});

test('default charms: night 2 C1 (35,0,0); night 3 C1/C2', () => {
  assert.deepEqual(runHeadless({ night: 2, ticks: 0 }).snapshots[0].charms.map((c) => [c.id, c.pos]), [['C1', [35, 0, 0]]]);
  assert.deepEqual(runHeadless({ night: 3, ticks: 0 }).snapshots[0].charms.map((c) => [c.id, c.pos]), [['C1', [30, 0, 25]], ['C2', [-30, 0, 25]]]);
});

// ---------- pause ----------
test('pause: tick advances, sim_tick and time freeze, state paused; resume continues', () => {
  const r = runHeadless({
    scenario: quiet(),
    ticks: 50,
    every: 10,
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 40, pause: true }] },
  });
  assert.deepEqual(ev(r, 'paused').map((e) => e.tick), [11]);
  assert.deepEqual(ev(r, 'resumed').map((e) => e.tick), [41]);
  const s20 = snapAt(r, 20);
  assert.equal(s20.state, 'paused');
  assert.equal(s20.sim_tick, 10);
  assert.equal(s20.time_left_s, Math.round((240 - 10 / 60) * 1000) / 1000); // Ticket-03: night 1 = 240 s
  assert.deepEqual(s20.player.pos, [0, 0, 1]);
  const s50 = snapAt(r, 50);
  assert.equal(s50.state, 'playing');
  assert.equal(s50.sim_tick, 20);
  assert.deepEqual(r.end, { type: 'end', ticks: 50, state: 'playing', score: 0 });
});

// ---------- performance ----------
test('a full night (21,600 ticks) runs headless in well under 30 s', () => {
  const t0 = Date.now();
  const r = runHeadless({ night: 3, ticks: 21600, every: 60, inputs: { frames: [{ tick: 0, move: [0.5, 1] }] } });
  assert.equal(r.code, 0);
  assert.ok(Date.now() - t0 < 30000);
});

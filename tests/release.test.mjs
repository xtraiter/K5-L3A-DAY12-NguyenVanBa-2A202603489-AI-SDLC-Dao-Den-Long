// Ticket-04: leaderboard rules, export command, soak command, bench statistics, contract v1.3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';
import { validName, makeEntry, addEntry, isoWithOffset } from '../src/leaderboard.js';
import { frameStats, makeBenchSim, BENCH } from '../src/sim/bench-scene.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'ddl-rel-'));

test('contract v1.3 has bench_cmd and soak_cmd', () => {
  const c = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
  assert.equal(c.contract_version, '1.3');
  assert.match(c.bench_cmd, /bench/);
  assert.match(c.soak_cmd, /soak/);
});

test('leaderboard names: 3-12 of [A-Za-z0-9_], Vietnamese letters accepted', () => {
  for (const ok of ['May', 'Nguyen_Van_A', 'abc', 'A1_b2_C3_d4', 'Mây', 'ĐènLồng']) assert.ok(validName(ok), ok);
  for (const bad of ['ab', 'thirteen_char', 'has space', 'bad-dash', '', 'x!y']) assert.ok(!validName(bad), bad);
});

test('leaderboard order: score desc, ties -> earlier first, top 10, ISO time with offset', () => {
  const t = (s) => new Date(Date.UTC(2026, 10, 20, 9, 0, s));
  let list = [];
  list = addEntry(list, makeEntry({ name: 'late', score: 500, nights_won: 2, seed: 1, at: t(30) }));
  list = addEntry(list, makeEntry({ name: 'early', score: 500, nights_won: 2, seed: 2, at: t(10) }));
  list = addEntry(list, makeEntry({ name: 'top', score: 900, nights_won: 3, seed: 3, at: t(50) }));
  assert.deepEqual(list.map((e) => e.name), ['top', 'early', 'late']);
  for (let i = 0; i < 12; i++) list = addEntry(list, makeEntry({ name: `p${i}xx`, score: 100 + i, nights_won: 0, seed: i, at: t(i) }));
  assert.equal(list.length, 10);
  assert.equal(list.at(-1).score, 105); // 900, 500, 500, then 111..105
  assert.match(isoWithOffset(t(0)), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.deepEqual(Object.keys(list[0]), ['name', 'score', 'nights_won', 'achieved_at', 'seed']);
});

test('--export-leaderboard writes {entries} in order from the local leaderboard file', () => {
  const dir = tmp();
  const file = join(dir, 'lb.json');
  const entries = [
    makeEntry({ name: 'bbb', score: 10, nights_won: 0, seed: 1 }),
    makeEntry({ name: 'aaa', score: 20, nights_won: 1, seed: 2 }),
  ];
  writeFileSync(file, JSON.stringify({ entries }));
  const out = join(dir, 'out.json');
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'serve.mjs'), '--export-leaderboard', out], {
    env: { ...process.env, LEADERBOARD_FILE: file },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).entries.map((e) => e.name), ['aaa', 'bbb']);
});

test('leaderboard API stores entries on disk (survives a server restart)', async () => {
  const dir = tmp();
  const file = join(dir, 'lb.json');
  const port = 18000 + Math.floor(Math.random() * 1000);
  const start = () => spawn(process.execPath, [join(ROOT, 'scripts', 'serve.mjs')], { env: { ...process.env, PORT: String(port), LEADERBOARD_FILE: file } });
  const ready = async () => {
    for (let i = 0; i < 50; i++) {
      try {
        return await fetch(`http://127.0.0.1:${port}/api/leaderboard`);
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    throw new Error('server did not start');
  };
  let srv = start();
  await ready();
  const post = await fetch(`http://127.0.0.1:${port}/api/leaderboard`, { method: 'POST', body: JSON.stringify({ name: 'Mây_01', score: 321, nights_won: 1, seed: 9 }) });
  assert.equal(post.status, 200);
  const bad = await fetch(`http://127.0.0.1:${port}/api/leaderboard`, { method: 'POST', body: JSON.stringify({ name: 'x', score: 1, nights_won: 0, seed: 1 }) });
  assert.equal(bad.status, 400);
  srv.kill();
  await new Promise((r) => srv.on('exit', r));
  srv = start();
  const again = await (await ready()).json();
  srv.kill();
  assert.deepEqual(again.entries.map((e) => [e.name, e.score]), [['Mây_01', 321]]);
});

test('soak: 10 nights in one process, no crash, memory bounded, JSON shape', () => {
  const out = join(tmp(), 'soak.json');
  const r = spawnSync(process.execPath, ['--expose-gc', '--max-semi-space-size=1', join(ROOT, 'src', 'soak.mjs'), '--seed', '7', '--nights', '10', '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(s.nights, 10);
  assert.equal(s.crashes, 0);
  assert.equal(s.results.length, 10);
  for (const x of s.results) assert.ok(x === 'won' || x === 'lost');
  assert.ok(s.mem_end_mb <= 1.2 * s.mem_start_mb, `${s.mem_end_mb} > 1.2 x ${s.mem_start_mb}`);
  const again = spawnSync(process.execPath, ['--expose-gc', join(ROOT, 'src', 'soak.mjs'), '--seed', '7', '--nights', '10', '--out', out], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')).results, s.results, 'results are deterministic per seed');
});

test('bench statistics follow the Ticket-04 definitions', () => {
  const dts = Array.from({ length: 200 }, (_, i) => (i < 2 ? 50 : 10));
  const s = frameStats(dts);
  assert.equal(s.frames, 200);
  assert.equal(s.avg_fps, Math.round(((1000 * 200) / (198 * 10 + 100)) * 10) / 10);
  assert.equal(s.p1_low_fps, 20); // k = 2 worst frames of 50 ms
  assert.equal(s.frame_ms_p95, 10);
});

test('bench scene: 200 wandering shades, 100 motes, L1-L3 lit 100, nothing spawns/ends/decays', () => {
  const sim = makeBenchSim(42);
  assert.equal(sim.shades.length, BENCH.shades);
  assert.equal(sim.motes.length, BENCH.motes);
  assert.deepEqual(sim.lanterns.map((l) => l.lit), [true, true, true, false, false]);
  for (let i = 0; i < 60 * 40; i++) sim.step({ move: [0, 0], cam_yaw_deg: 0 });
  assert.equal(sim.shades.length, 200);
  assert.equal(sim.motes.length, 100);
  assert.equal(sim.state, 'playing');
  assert.equal(sim.player.flames, 3);
  assert.ok(sim.lanterns.slice(0, 3).every((l) => l.lit && l.fuel === 6000));
  assert.equal(makeBenchSim(42).shades[17].pos.join(), sim.shades.length && makeBenchSim(42).shades[17].pos.join(), 'seeded layout');
});

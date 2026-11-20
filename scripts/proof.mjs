// Generate verifiable evidence for a phase: node scripts/proof.mjs [phase=2]
// Output: docs/proof/phase-N/{test-report.txt, runs/*.jsonl, determinism.txt}
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const phase = process.argv[2] || '2';
const OUT = join(ROOT, 'docs', 'proof', `phase-${phase}`);
const RUNS = join(OUT, 'runs');
mkdirSync(RUNS, { recursive: true });
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });

// 1. unit + headless tests
const t = spawnSync(process.execPath, ['--test'], { cwd: ROOT, encoding: 'utf8' });
writeFileSync(join(OUT, 'test-report.txt'), `$ node --test  (exit ${t.status})\n${t.stdout}${t.stderr}`);
console.log(`tests: exit ${t.status}`);

// 2. scenario runs (tests/scenarios/<name>.scenario.json + optional <name>.inputs.json)
const dir = join(ROOT, 'tests', 'scenarios');
const names = readdirSync(dir).filter((f) => f.endsWith('.scenario.json')).map((f) => f.replace('.scenario.json', ''));
const summary = [];
for (const name of names) {
  const night = /^n([123])-/.exec(name)?.[1] || '1';
  const args = ['src/headless.mjs', '--seed', '1', '--night', night, '--ticks', name === 'n3-wind' ? '2200' : '3600', '--snapshot-every', '60', '--out', join(RUNS, `${name}.jsonl`),
    '--scenario', join(dir, `${name}.scenario.json`)];
  try {
    readFileSync(join(dir, `${name}.inputs.json`));
    args.push('--inputs', join(dir, `${name}.inputs.json`));
  } catch {}
  const r = node(args);
  const lines = readFileSync(join(RUNS, `${name}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const evs = lines.filter((l) => l.type === 'event').map((e) => `${e.tick}:${e.name}`);
  summary.push(`${name} (night ${night}): exit ${r.status} end=${JSON.stringify(lines.at(-1))}\n  events: ${evs.join(', ')}`);
}

// 3. determinism + speed: a full night (21,600 ticks max) for each night, same seed twice
let same = true;
for (const n of ['1', '2', '3']) {
  const runFull = (file) => node(['src/headless.mjs', '--seed', '42', '--night', n, '--ticks', '21600', '--snapshot-every', '600', '--out', join(RUNS, file)]);
  const t0 = Date.now();
  runFull(`full-n${n}-a.jsonl`);
  const ms = Date.now() - t0;
  runFull(`full-n${n}-b.jsonl`);
  const ok = readFileSync(join(RUNS, `full-n${n}-a.jsonl`), 'utf8') === readFileSync(join(RUNS, `full-n${n}-b.jsonl`), 'utf8');
  same &&= ok;
  summary.push(`night ${n} full run (seed 42, up to 21600 ticks) twice: ${ok ? 'IDENTICAL' : 'DIFFERENT'}; one run ${ms} ms incl. node startup (limit 30000 ms)`);
}

writeFileSync(join(OUT, 'headless-summary.txt'), summary.join('\n') + '\n');
console.log(summary.join('\n'));
process.exit(t.status === 0 && same ? 0 : 1);

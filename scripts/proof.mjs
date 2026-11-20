// Generate verifiable evidence for a phase: node scripts/proof.mjs [phase=1]
// Output: docs/proof/phase-N/{test-report.txt, runs/*.jsonl, determinism.txt}
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const phase = process.argv[2] || '1';
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
  const args = ['src/headless.mjs', '--seed', '1', '--night', '1', '--ticks', '3600', '--out', join(RUNS, `${name}.jsonl`),
    '--scenario', join(dir, `${name}.scenario.json`)];
  try {
    readFileSync(join(dir, `${name}.inputs.json`));
    args.push('--inputs', join(dir, `${name}.inputs.json`));
  } catch {}
  const r = node(args);
  const lines = readFileSync(join(RUNS, `${name}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const evs = lines.filter((l) => l.type === 'event').map((e) => `${e.tick}:${e.name}`);
  summary.push(`${name}: exit ${r.status} end=${JSON.stringify(lines.at(-1))}\n  events: ${evs.join(', ')}`);
}

// 3. determinism: full random night, same seed twice
const runFull = (seed, file) => node(['src/headless.mjs', '--seed', String(seed), '--night', '1', '--ticks', '18000', '--out', join(RUNS, file)]);
runFull(42, 'seed42-a.jsonl');
runFull(42, 'seed42-b.jsonl');
const same = readFileSync(join(RUNS, 'seed42-a.jsonl'), 'utf8') === readFileSync(join(RUNS, 'seed42-b.jsonl'), 'utf8');
const started = Date.now();
runFull(42, 'seed42-a.jsonl');
const ms = Date.now() - started;
summary.push(`determinism seed 42 full night run twice: ${same ? 'IDENTICAL' : 'DIFFERENT'} (one run ${ms} ms incl. node startup)`);

writeFileSync(join(OUT, 'headless-summary.txt'), summary.join('\n') + '\n');
console.log(summary.join('\n'));
process.exit(t.status === 0 && same ? 0 : 1);

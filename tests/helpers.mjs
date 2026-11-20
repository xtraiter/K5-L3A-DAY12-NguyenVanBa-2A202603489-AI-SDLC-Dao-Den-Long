import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HEADLESS = join(ROOT, 'src', 'headless.mjs');

/** Run the real headless CLI. scenario/inputs may be objects (written to temp files) or raw strings. */
export function runHeadless({ seed = 1, ticks = 60, scenario, inputs, every, extraArgs = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
  const out = join(dir, 'out.jsonl');
  const args = [HEADLESS, '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out];
  const put = (name, v) => {
    const f = join(dir, `${name}.json`);
    writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v));
    args.push(`--${name}`, f);
  };
  if (scenario !== undefined) put('scenario', scenario);
  if (inputs !== undefined) put('inputs', inputs);
  if (every !== undefined) args.push('--snapshot-every', String(every));
  args.push(...extraArgs);
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  let lines = [];
  let raw = '';
  if (r.status === 0) {
    raw = readFileSync(out, 'utf8');
    lines = raw.trim().split('\n').map((l) => JSON.parse(l));
  }
  return {
    code: r.status,
    stderr: r.stderr,
    raw,
    lines,
    events: lines.filter((l) => l.type === 'event'),
    snapshots: lines.filter((l) => l.type === 'snapshot'),
    end: lines[lines.length - 1],
  };
}

// Empty, quiet island: nothing random, so each test controls everything.
export const quiet = (extra = {}) => ({ random_motes: false, random_shades: false, motes: [], shades: [], ...extra });

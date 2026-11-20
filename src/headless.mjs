#!/usr/bin/env node
// Headless runner — Test Contract v1.1.
// node src/headless.mjs --seed <int> --night 1|2|3 [--scenario f] [--inputs f] --ticks <int> --out f [--snapshot-every n]
import { readFileSync, writeFileSync } from 'node:fs';
import { Sim, NEUTRAL_INPUT } from './sim/sim.js';
import { parseInputs, parseScenario, FormatError } from './sim/validate.js';

class UsageError extends Error {}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new UsageError(`unexpected argument: ${a}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new UsageError(`missing value for ${a}`);
    args[a.slice(2)] = v;
    i++;
  }
  const int = (name, { required = false, min = -Infinity, def } = {}) => {
    if (args[name] === undefined) {
      if (required) throw new UsageError(`--${name} is required`);
      return def;
    }
    if (!/^-?\d+$/.test(args[name])) throw new UsageError(`--${name} must be an integer`);
    const n = Number(args[name]);
    if (n < min) throw new UsageError(`--${name} must be >= ${min}`);
    return n;
  };
  const out = {
    seed: int('seed', { required: true }),
    night: int('night', { required: true }),
    ticks: int('ticks', { required: true, min: 0 }),
    every: int('snapshot-every', { min: 1, def: 10 }),
    out: args.out,
    scenario: args.scenario,
    inputs: args.inputs,
  };
  if (!out.out) throw new UsageError('--out is required');
  if (![1, 2, 3].includes(out.night)) throw new UsageError(`--night must be 1, 2 or 3`);
  return out;
}

function readJson(path, what) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new FormatError(`${what}: cannot read ${path}: ${e.message}`);
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    throw new FormatError(`${what}: invalid JSON in ${path}: ${e.message}`);
  }
}

export function run(opts) {
  const scenario = opts.scenario
    ? parseScenario(readJson(opts.scenario, 'scenario'), (m) => process.stderr.write(`warning: ${m}\n`))
    : null;
  const frames = opts.inputs ? parseInputs(readJson(opts.inputs, 'inputs')) : new Map();

  const sim = new Sim({ seed: opts.seed, night: opts.night, scenario });
  const lines = [JSON.stringify(sim.snapshot())];
  for (const ev of sim.drainEvents()) lines.push(JSON.stringify(ev)); // night_start (tick 0)
  const input = { ...NEUTRAL_INPUT, move: [0, 0] };

  for (let k = 0; k < opts.ticks; k++) {
    const f = frames.get(k);
    if (f) Object.assign(input, f);
    sim.step(input);
    for (const ev of sim.drainEvents()) lines.push(JSON.stringify(ev));
    if (sim.tick % opts.every === 0) lines.push(JSON.stringify(sim.snapshot()));
    if (sim.state === 'won' || sim.state === 'lost') break;
  }
  lines.push(JSON.stringify({ type: 'end', ticks: sim.tick, state: sim.state, score: sim.score }));
  writeFileSync(opts.out, lines.join('\n') + '\n');
}

try {
  run(parseArgs(process.argv.slice(2)));
  process.exit(0);
} catch (e) {
  process.stderr.write(`error: ${e.message}\n`);
  process.exit(e instanceof FormatError ? 2 : 1);
}

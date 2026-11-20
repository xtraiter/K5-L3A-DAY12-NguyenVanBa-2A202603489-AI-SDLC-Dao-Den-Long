// Strict validation of Test Contract v1.0 inputs/scenario files.
// Any problem throws FormatError -> headless exits with code 2.

export class FormatError extends Error {}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const fail = (msg) => {
  throw new FormatError(msg);
};
const vec3 = (v, where) => {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) fail(`${where}: expected [x, y, z] numbers`);
  return v;
};
const bool = (v, where) => {
  if (typeof v !== 'boolean') fail(`${where}: expected boolean`);
  return v;
};

export function parseInputs(raw) {
  if (!isObj(raw) || !Array.isArray(raw.frames)) fail('inputs: expected {"frames": [...]}');
  const frames = new Map();
  let lastTick = -1;
  raw.frames.forEach((f, i) => {
    const w = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${w}: expected object`);
    if (!isInt(f.tick) || f.tick < 0) fail(`${w}.tick: expected integer >= 0`);
    if (f.tick <= lastTick) fail(`${w}.tick: ticks must be strictly increasing`);
    lastTick = f.tick;
    const out = {};
    if ('move' in f) {
      const m = f.move;
      if (!Array.isArray(m) || m.length !== 2 || !m.every(isNum) || m.some((x) => x < -1 || x > 1))
        fail(`${w}.move: expected [x, z] with each component in [-1, 1]`);
      out.move = [m[0], m[1]];
    }
    if ('cam_yaw_deg' in f) {
      if (!isNum(f.cam_yaw_deg)) fail(`${w}.cam_yaw_deg: expected number`);
      out.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const k of ['jump', 'interact', 'pulse', 'dash']) if (k in f) out[k] = bool(f[k], `${w}.${k}`);
    frames.set(f.tick, out);
  });
  return frames;
}

export function parseScenario(raw, warn = () => {}) {
  if (!isObj(raw)) fail('scenario: expected object');
  const sc = {};
  if ('player' in raw) {
    const p = raw.player;
    if (!isObj(p)) fail('scenario.player: expected object');
    sc.player = {};
    if ('pos' in p) sc.player.pos = vec3(p.pos, 'scenario.player.pos');
    if ('carried' in p) {
      if (!isInt(p.carried) || p.carried < 0) fail('scenario.player.carried: expected integer >= 0');
      sc.player.carried = p.carried;
    }
    if ('flames' in p) {
      if (!isInt(p.flames) || p.flames < 0) fail('scenario.player.flames: expected integer >= 0');
      sc.player.flames = p.flames;
    }
  }
  for (const k of ['random_motes', 'random_shades']) if (k in raw) sc[k] = bool(raw[k], `scenario.${k}`);
  if ('motes' in raw) {
    if (!Array.isArray(raw.motes)) fail('scenario.motes: expected array');
    sc.motes = raw.motes.map((m, i) => {
      if (Array.isArray(m)) return vec3(m, `scenario.motes[${i}]`);
      if (isObj(m)) {
        if ('id' in m && typeof m.id !== 'string') fail(`scenario.motes[${i}].id: expected string`);
        return { id: m.id, pos: vec3(m.pos, `scenario.motes[${i}].pos`) };
      }
      return fail(`scenario.motes[${i}]: expected [x, y, z]`);
    });
  }
  if ('shades' in raw) {
    if (!Array.isArray(raw.shades)) fail('scenario.shades: expected array');
    const seen = new Set();
    sc.shades = raw.shades.map((s, i) => {
      if (!isObj(s)) fail(`scenario.shades[${i}]: expected object`);
      if ('id' in s) {
        if (typeof s.id !== 'string' || !s.id) fail(`scenario.shades[${i}].id: expected non-empty string`);
        if (seen.has(s.id)) fail(`scenario.shades[${i}].id: duplicate id ${s.id}`);
        seen.add(s.id);
      }
      return { id: s.id, pos: vec3(s.pos, `scenario.shades[${i}].pos`) };
    });
  }
  if ('lanterns' in raw) {
    if (!Array.isArray(raw.lanterns)) fail('scenario.lanterns: expected array');
    sc.lanterns = raw.lanterns.map((l, i) => {
      const w = `scenario.lanterns[${i}]`;
      if (!isObj(l)) fail(`${w}: expected object`);
      if (typeof l.id !== 'string') fail(`${w}.id: expected string`);
      if (!/^L[1-5]$/.test(l.id)) warn(`${w}.id "${l.id}" is not a Night 1 lantern, ignored`);
      const out = { id: l.id };
      if ('pos' in l) out.pos = vec3(l.pos, `${w}.pos`);
      if ('deposited' in l) {
        if (!isInt(l.deposited) || l.deposited < 0) fail(`${w}.deposited: expected integer >= 0`);
        out.deposited = l.deposited;
      }
      if ('lit' in l) out.lit = bool(l.lit, `${w}.lit`);
      return out;
    });
  }
  if ('time_left_s' in raw) {
    if (!isNum(raw.time_left_s) || raw.time_left_s < 0) fail('scenario.time_left_s: expected number >= 0');
    sc.time_left_s = raw.time_left_s;
  }
  return sc;
}

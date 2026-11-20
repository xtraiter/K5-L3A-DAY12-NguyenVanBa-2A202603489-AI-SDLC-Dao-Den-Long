// Strict validation of Test Contract v1.1 inputs/scenario files.
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
const uint = (v, where) => {
  if (!isInt(v) || v < 0) fail(`${where}: expected integer >= 0`);
  return v;
};
const unum = (v, where) => {
  if (!isNum(v) || v < 0) fail(`${where}: expected number >= 0`);
  return v;
};
const str = (v, where) => {
  if (typeof v !== 'string' || !v) fail(`${where}: expected non-empty string`);
  return v;
};
const oneOf = (v, list, where) => {
  if (!list.includes(v)) fail(`${where}: expected one of ${list.join(', ')}`);
  return v;
};
// copy optional keys with a validator
const pick = (src, dst, keys, check, where) => {
  for (const k of keys) if (k in src) dst[k] = check(src[k], `${where}.${k}`);
};
const arr = (v, where) => {
  if (!Array.isArray(v)) fail(`${where}: expected array`);
  return v;
};
const uniqueIds = (list, where) => {
  const seen = new Set();
  for (const e of list) {
    if (e.id === undefined) continue;
    if (seen.has(e.id)) fail(`${where}: duplicate id ${e.id}`);
    seen.add(e.id);
  }
};

export const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
export const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

export function parseInputs(raw) {
  if (!isObj(raw) || !Array.isArray(raw.frames)) fail('inputs: expected {"frames": [...]}');
  const frames = new Map();
  let lastTick = -1;
  raw.frames.forEach((f, i) => {
    const w = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${w}: expected object`);
    uint(f.tick, `${w}.tick`);
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
    pick(f, out, BUTTONS, bool, w);
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
    pick(p, sc.player, ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights'], uint, 'scenario.player');
  }
  pick(raw, sc, ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'], bool, 'scenario');

  if ('motes' in raw) {
    sc.motes = arr(raw.motes, 'scenario.motes').map((m, i) => {
      const w = `scenario.motes[${i}]`;
      if (Array.isArray(m)) return vec3(m, w);
      if (!isObj(m)) fail(`${w}: expected [x, y, z] or object`);
      const out = { pos: vec3(m.pos, `${w}.pos`) };
      if ('id' in m) out.id = str(m.id, `${w}.id`);
      if ('kind' in m) out.kind = oneOf(m.kind, ['random', 'dropped'], `${w}.kind`);
      if ('ttl_s' in m && m.ttl_s !== null) out.ttl_s = unum(m.ttl_s, `${w}.ttl_s`);
      return out;
    });
    uniqueIds(sc.motes.filter((m) => !Array.isArray(m)), 'scenario.motes');
  }
  if ('shades' in raw) {
    sc.shades = arr(raw.shades, 'scenario.shades').map((s, i) => {
      const w = `scenario.shades[${i}]`;
      if (!isObj(s)) fail(`${w}: expected object`);
      const out = { pos: vec3(s.pos, `${w}.pos`) };
      if ('id' in s) out.id = str(s.id, `${w}.id`);
      if ('state' in s) out.state = oneOf(s.state, SHADE_STATES, `${w}.state`);
      if ('state_ticks_left' in s) out.state_ticks_left = uint(s.state_ticks_left, `${w}.state_ticks_left`);
      if ('target_lantern_id' in s && s.target_lantern_id !== null) out.target_lantern_id = str(s.target_lantern_id, `${w}.target_lantern_id`);
      return out;
    });
    uniqueIds(sc.shades, 'scenario.shades');
  }
  if ('drifters' in raw) {
    sc.drifters = arr(raw.drifters, 'scenario.drifters').map((d, i) => {
      const w = `scenario.drifters[${i}]`;
      if (!isObj(d)) fail(`${w}: expected object`);
      const out = { id: 'id' in d ? str(d.id, `${w}.id`) : `D${i + 1}`, pos: vec3(d.pos, `${w}.pos`) };
      if ('state' in d) out.state = oneOf(d.state, DRIFTER_STATES, `${w}.state`);
      if ('stolen' in d) out.stolen = uint(d.stolen, `${w}.stolen`);
      if ('state_ticks_left' in d) out.state_ticks_left = uint(d.state_ticks_left, `${w}.state_ticks_left`);
      return out;
    });
    uniqueIds(sc.drifters, 'scenario.drifters');
  }
  if ('charms' in raw) {
    sc.charms = arr(raw.charms, 'scenario.charms').map((c, i) => {
      const w = `scenario.charms[${i}]`;
      if (!isObj(c)) fail(`${w}: expected object`);
      const out = { id: 'id' in c ? str(c.id, `${w}.id`) : `C${i + 1}` };
      if ('pos' in c) out.pos = vec3(c.pos, `${w}.pos`);
      if ('available' in c) out.available = bool(c.available, `${w}.available`);
      if ('respawn_ticks' in c) out.respawn_ticks = uint(c.respawn_ticks, `${w}.respawn_ticks`);
      if ('respawn_s' in c) out.respawn_s = unum(c.respawn_s, `${w}.respawn_s`);
      return out;
    });
    uniqueIds(sc.charms, 'scenario.charms');
  }
  if ('lanterns' in raw) {
    sc.lanterns = arr(raw.lanterns, 'scenario.lanterns').map((l, i) => {
      const w = `scenario.lanterns[${i}]`;
      if (!isObj(l)) fail(`${w}: expected object`);
      const out = { id: str(l.id, `${w}.id`) };
      if (!/^L\d+$/.test(l.id)) warn(`${w}.id "${l.id}" is not a lantern id, ignored`);
      if ('pos' in l) out.pos = vec3(l.pos, `${w}.pos`);
      if ('deposited' in l) out.deposited = uint(l.deposited, `${w}.deposited`);
      if ('lit' in l) out.lit = bool(l.lit, `${w}.lit`);
      if ('fuel' in l) {
        out.fuel = unum(l.fuel, `${w}.fuel`);
        if (out.fuel > 100) fail(`${w}.fuel: expected 0..100`);
      }
      if ('ever_lit' in l) out.ever_lit = bool(l.ever_lit, `${w}.ever_lit`);
      if ('relit_count' in l) out.relit_count = uint(l.relit_count, `${w}.relit_count`);
      return out;
    });
  }
  if ('time_left_s' in raw) sc.time_left_s = unum(raw.time_left_s, 'scenario.time_left_s');
  return sc;
}

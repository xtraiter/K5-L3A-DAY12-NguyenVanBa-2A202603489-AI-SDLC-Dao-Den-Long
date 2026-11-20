// Pure, deterministic simulation for "Đảo Đèn Lồng" (Contract v1.1).
// No DOM, no Math.random, no wall clock. One step() = one tick = 1/60 s.
// Step order follows Ticket-02 exactly (see comments 1..12).
import { TUNING, RULES, TICK_RATE } from './config.js';
import { NIGHTS } from './maps.js';
import { mulberry32, deriveSeed } from './rng.js';

const T = TUNING;
const R = RULES;
const DT = 1 / TICK_RATE;

export const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
};
export const distXZ = (a, b) => {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
};
const dist3 = (a, b) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};
const idNum = (id) => {
  const n = parseInt(String(id).replace(/^\D+/, ''), 10);
  return Number.isNaN(n) ? Infinity : n;
};
export const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const dirXZ = (from, to) => {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const d = Math.sqrt(dx * dx + dz * dz);
  return d > 1e-9 ? [dx / d, dz / d, d] : [1, 0, 0];
};

export const NEUTRAL_INPUT = Object.freeze({
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false,
});
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

export class Sim {
  /** @param {{seed?: number, night?: 1|2|3, scenario?: object|null}} opts scenario must be validated */
  constructor({ seed = 0, night = 1, scenario = null } = {}) {
    const sc = scenario || {};
    const N = NIGHTS[night];
    if (!N) throw new Error(`unknown night ${night}`);
    this.night = night;
    this.map = N;
    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing';
    this.result = null;
    this.score = 0;
    this.events = [];
    this.rng = {
      motes: mulberry32(deriveSeed(seed, 0x4d4f5445)),
      shades: mulberry32(deriveSeed(seed, 0x53484144)),
      drift: mulberry32(deriveSeed(seed, 0x44524946)),
      wind: mulberry32(deriveSeed(seed, 0x57494e44)),
      drop: mulberry32(deriveSeed(seed, 0x44524f50)),
    };
    this.duration = sc.time_left_s ?? N.duration;

    // player
    const sp = sc.player || {};
    const pos = sp.pos ? [...sp.pos] : [...N.start];
    const g = N.ground(pos[0], pos[2]);
    const grounded = g !== null && pos[1] <= g + 1e-6;
    if (grounded) pos[1] = g;
    this.player = {
      pos,
      vel: [0, 0, 0],
      grounded,
      facing: [0, 1],
      flames: sp.flames ?? T.flames,
      carried: sp.carried ?? 0,
      invuln: sp.invuln_ticks ?? 0,
      dashCd: sp.dash_cd_ticks ?? 0,
      pulseCd: sp.pulse_cd_ticks ?? 0,
      charm: sp.charm_ticks ?? 0,
      dashTicks: 0,
      dashDir: [0, 1],
      launch: null,
      dead: false,
      respawn: 0,
    };
    this.prev = Object.fromEntries(BUTTONS.map((b) => [b, false]));

    // lanterns
    this.lanterns = N.lanterns.map((p, i) => ({ id: `L${i + 1}`, pos: [...p], deposited: 0, lit: false }));
    for (const patch of sc.lanterns || []) {
      const l = this.lanterns.find((x) => x.id === patch.id);
      if (!l) continue;
      if (patch.pos) l.pos = [...patch.pos];
      if (patch.deposited !== undefined) l.deposited = patch.deposited;
      if (patch.lit !== undefined) {
        l.lit = patch.lit;
        if (l.lit && patch.deposited === undefined) l.deposited = T.lantern_cost;
      }
    }

    // motes
    this.randomMotes = sc.random_motes ?? true;
    this.moteSeq = 0;
    this.motes = [];
    if (sc.motes) {
      for (const m of sc.motes) {
        const isArr = Array.isArray(m);
        const mp = isArr ? m : m.pos;
        const kind = (!isArr && m.kind) || 'random';
        const ttl = kind === 'dropped' ? (!isArr && m.ttl_s !== undefined ? Math.round(m.ttl_s * TICK_RATE) : R.dropped_ttl_ticks) : null;
        this.motes.push({ id: (!isArr && m.id) || this.#nextId('M', this.motes), pos: [...mp], kind, ttl });
      }
    } else if (this.randomMotes) {
      const pts = N.motePoints.map((p, i) => i);
      for (let i = 0; i < R.motes_initial && pts.length; i++) {
        const k = Math.floor(this.rng.motes() * pts.length);
        const [idx] = pts.splice(k, 1);
        this.motes.push({ id: this.#nextId('M', this.motes), pos: [...N.motePoints[idx]], kind: 'random', ttl: null });
      }
    }

    // shades
    this.randomShades = sc.random_shades ?? true;
    this.shadeSeq = 0;
    this.shades = [];
    for (const s of sc.shades || []) {
      const id = s.id || this.#nextId('S', [...this.shades, ...(sc.shades || [])]);
      const gy = N.ground(s.pos[0], s.pos[2]) ?? 0;
      const st = s.state || 'wander';
      const ticks = s.state_ticks_left ?? this.#defaultStateTicks(st);
      this.shades.push(this.#makeShade(id, s.pos, s.pos[1] - gy, st, ticks));
    }
    this.shades.sort(byId);

    // drifters
    this.randomDrifters = sc.random_drifters ?? N.drifters;
    this.drifters = (sc.drifters || []).map((d) => ({
      id: d.id,
      pos: [...d.pos],
      state: d.state || 'idle',
      stolen: d.stolen ?? 0,
      ticks: d.state_ticks_left ?? (d.state === 'flee' ? R.drifter_flee_ticks : 0),
      stoleOnce: (d.stolen ?? 0) > 0,
      wp: null,
    }));
    this.drifterSeq = 0;

    // charms
    const charmSrc = sc.charms || N.charms;
    this.charms = charmSrc.map((c) => {
      const def = N.charms.find((x) => x.id === c.id);
      const respawn = c.respawn_ticks ?? (c.respawn_s !== undefined ? Math.round(c.respawn_s * TICK_RATE) : 0);
      return { id: c.id, pos: [...(c.pos || def?.pos || [0, 0, 0])], available: c.available ?? respawn === 0, respawn };
    });

    // wind
    this.windEnabled = sc.wind_enabled ?? N.wind;
    this.windTicks = 0;
    this.windDir = 0;

    this.#emit('night_start', { night });
  }

  // ---------- helpers ----------
  #nextId(prefix, list) {
    let n = prefix === 'M' ? this.moteSeq : prefix === 'S' ? this.shadeSeq : this.drifterSeq;
    let id;
    do id = `${prefix}${++n}`;
    while (list.some((e) => e.id === id));
    if (prefix === 'M') this.moteSeq = n;
    else if (prefix === 'S') this.shadeSeq = n;
    else this.drifterSeq = n;
    return id;
  }

  #defaultStateTicks(st) {
    return { spawning: R.shade_spawning_ticks, recoil: R.shade_recoil_ticks, stunned: R.pulse_stun_ticks }[st] ?? 0;
  }

  #makeShade(id, pos, hover, state, ticks) {
    return { id, pos: [...pos], hover, state, ticks, push: 0, pushDir: [1, 0], evict: 0, home: [...pos], wp: null };
  }

  #emit(name, data) {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  timeLeft() {
    return Math.max(0, this.duration - this.simTick / TICK_RATE);
  }

  ground(x, z) {
    return this.map.ground(x, z);
  }

  #litLanterns() {
    return this.lanterns.filter((l) => l.lit);
  }

  // Shade/walker movement with terrain: blocked by void and by walls higher than step_up.
  #tryMoveWalker(pos, dx, dz, hover) {
    const cur = this.ground(pos[0], pos[2]) ?? pos[1] - hover;
    const ok = (x, z) => {
      const g = this.ground(x, z);
      return g !== null && g <= cur + R.step_up;
    };
    let nx = pos[0] + dx;
    let nz = pos[2] + dz;
    if (!ok(nx, nz)) {
      if (ok(pos[0] + dx, pos[2])) nz = pos[2];
      else if (ok(pos[0], pos[2] + dz)) nx = pos[0];
      else return false;
    }
    pos[0] = nx;
    pos[2] = nz;
    pos[1] = this.ground(nx, nz) + hover;
    return true;
  }

  // Lit lanterns block shades at the safe_radius edge.
  #blockBySafeZones(s) {
    for (const l of this.#litLanterns()) {
      const [nx, nz, d] = dirXZ(l.pos, s.pos);
      if (d < T.safe_radius) {
        s.pos[0] = l.pos[0] + nx * T.safe_radius;
        s.pos[2] = l.pos[2] + nz * T.safe_radius;
        const g = this.ground(s.pos[0], s.pos[2]);
        if (g !== null) s.pos[1] = g + s.hover;
      }
    }
  }

  #insideSafeZone(pos) {
    return this.#litLanterns().some((l) => distXZ(l.pos, pos) < T.safe_radius);
  }

  #dropMotes(at, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.drop() * 2 * Math.PI;
      const r = R.drop_ring[0] + (R.drop_ring[1] - R.drop_ring[0]) * this.rng.drop();
      const x = r3(at[0] + r * Math.cos(a));
      const z = r3(at[2] + r * Math.sin(a));
      const g = this.ground(x, z);
      this.motes.push({ id: this.#nextId('M', this.motes), pos: [x, g ?? at[1], z], kind: 'dropped', ttl: R.dropped_ttl_ticks });
    }
  }

  #canPick(pos) {
    const p = this.player;
    return distXZ(p.pos, pos) <= T.pickup_radius && Math.abs(p.pos[1] - pos[1]) <= R.pickup_dy;
  }

  // ---------- one tick ----------
  step(inp = NEUTRAL_INPUT) {
    if (this.state === 'won' || this.state === 'lost') return;
    this.tick += 1;
    const e = {};
    for (const b of BUTTONS) {
      e[b] = !!inp[b] && !this.prev[b];
      this.prev[b] = !!inp[b];
    }

    // 1. input + pause
    if (e.pause) {
      if (this.state === 'paused') {
        this.state = 'playing';
        this.#emit('resumed', {});
      } else {
        this.state = 'paused';
        this.#emit('paused', {});
        return;
      }
    } else if (this.state === 'paused') return;
    this.simTick += 1;

    const p = this.player;
    const N = this.map;

    // 2. counters
    if (p.dashCd > 0) p.dashCd--;
    if (p.pulseCd > 0) p.pulseCd--;
    if (p.invuln > 0) p.invuln--;
    if (p.charm > 0) p.charm--;
    if (p.respawn > 0) p.respawn--;
    for (const s of this.shades) {
      if (s.ticks > 0 && ['spawning', 'recoil', 'stunned'].includes(s.state)) {
        if (--s.ticks === 0) s.state = 'wander';
      }
      if (s.evict > 0) s.evict--;
    }
    this.motes = this.motes.filter((m) => m.kind !== 'dropped' || --m.ttl > 0);
    for (const d of this.drifters) {
      if (d.state === 'flee' && d.ticks > 0 && --d.ticks === 0) d.state = 'removed';
    }
    for (const c of this.charms) {
      if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    }
    if (this.windTicks > 0) this.windTicks--;
    if (this.windEnabled && this.simTick % R.wind_every_ticks === 0) {
      this.windTicks = R.wind_ticks;
      this.windDir = r3(this.rng.wind() * 360);
    }

    // 3. move Mây (jump, dash, pads, wind) + fall check
    if (p.dead && p.respawn === 0 && p.flames > 0) {
      p.dead = false;
      p.pos = [...N.start];
      const gs = this.ground(p.pos[0], p.pos[2]);
      if (gs !== null) p.pos[1] = gs;
      p.vel = [0, 0, 0];
      p.grounded = true;
      p.launch = null;
      p.dashTicks = 0;
      p.invuln = R.respawn_invuln_ticks;
    }
    if (!p.dead) this.#movePlayer(inp, e);

    const alive = !p.dead;

    // 4. pick up motes and charms
    if (alive) {
      const keep = [];
      for (const m of this.motes) {
        if (p.carried < T.carry_capacity && this.#canPick(m.pos)) {
          p.carried += 1;
          this.#emit('mote_picked', { carried: p.carried });
        } else keep.push(m);
      }
      this.motes = keep;
      for (const c of this.charms) {
        if (c.available && this.#canPick(c.pos)) {
          c.available = false;
          c.respawn = R.charm_respawn_ticks;
          p.charm = R.charm_ticks;
          this.#emit('charm_picked', { charm_id: c.id, charm_ticks: R.charm_ticks });
        }
      }
    }

    // 5. interact with lanterns
    const justLit = [];
    if (alive && e.interact && p.carried > 0) {
      let best = null;
      let bestD = Infinity;
      for (const l of [...this.lanterns].sort(byId)) {
        if (l.lit) continue;
        const d = distXZ(p.pos, l.pos);
        if (d <= T.interact_radius && d < bestD) {
          best = l;
          bestD = d;
        }
      }
      if (best) {
        const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          this.score += T.score.per_mote * amount;
          this.#emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= T.lantern_cost) {
            best.lit = true;
            this.score += T.score.per_lantern;
            this.#emit('lantern_lit', { lantern_id: best.id });
            justLit.push(best);
          }
        }
      }
    }

    // 6. safe zones: shades caught inside a newly lit lantern are evicted (harmless, <= 30 ticks)
    for (const l of justLit) {
      for (const s of this.shades) if (distXZ(l.pos, s.pos) < T.safe_radius) s.evict = R.evict_ticks;
    }
    for (const s of this.shades) {
      if (s.evict <= 0) continue;
      const step = T.safe_radius / R.evict_ticks;
      let inside = false;
      for (const l of this.#litLanterns()) {
        const [nx, nz, d] = dirXZ(l.pos, s.pos);
        if (d < T.safe_radius) {
          inside = true;
          const mv = Math.min(step, T.safe_radius - d);
          s.pos[0] += nx * mv;
          s.pos[2] += nz * mv;
        }
      }
      if (!inside) s.evict = 0;
    }

    // 7. pulse
    if (alive && e.pulse && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
      p.carried -= T.pulse_cost;
      p.pulseCd = R.pulse_cd_ticks;
      const c = [p.pos[0], p.pos[1] + R.pulse_center_dy, p.pos[2]];
      const ids = [];
      for (const s of this.shades) {
        if (dist3(c, s.pos) <= T.pulse_radius) {
          s.state = 'stunned';
          s.ticks = R.pulse_stun_ticks;
          s.push = R.pulse_push_ticks;
          const [nx, nz] = dirXZ(c, s.pos);
          s.pushDir = [nx, nz];
          ids.push(s.id);
        }
      }
      for (const d of this.drifters) {
        if (d.state === 'removed' || dist3(c, d.pos) > T.pulse_radius) continue;
        if (d.state === 'chase') {
          d.state = 'flee';
          d.ticks = R.drifter_flee_ticks;
          d.stoleOnce = true;
        } else if (d.state === 'flee' && d.stolen > 0) {
          const amount = d.stolen;
          for (let i = 0; i < amount; i++) {
            const g = this.ground(d.pos[0], d.pos[2]);
            this.motes.push({ id: this.#nextId('M', this.motes), pos: [r3(d.pos[0]), g ?? 0, r3(d.pos[2])], kind: 'dropped', ttl: R.dropped_ttl_ticks });
          }
          d.stolen = 0;
          d.ticks = R.drifter_vanish_ticks;
          this.#emit('drifter_drop', { drifter_id: d.id, amount });
        }
      }
      this.score += T.score.per_stun * ids.length;
      this.#emit('pulse', { stunned_ids: ids });
    }

    // 8. move shades and drifters
    this.#moveShades();
    this.#moveDrifters();

    // 9. contact: drifters steal first, then shades hit (ascending id)
    if (alive) {
      for (const d of [...this.drifters].sort(byId)) {
        if (d.state !== 'chase' || d.stoleOnce) continue;
        if (distXZ(d.pos, p.pos) <= R.drifter_hit_xz) {
          const amount = Math.min(R.drifter_steal_max, p.carried);
          p.carried -= amount;
          d.stolen = amount;
          d.stoleOnce = true;
          d.state = 'flee';
          d.ticks = R.drifter_flee_ticks;
          this.#emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
        }
      }
      for (const s of this.shades) {
        if (p.invuln > 0) break;
        if (!(s.state === 'wander' || s.state === 'chase') || s.evict > 0) continue;
        if (distXZ(s.pos, p.pos) <= T.shade_hit_radius && Math.abs(s.pos[1] - p.pos[1]) <= R.hit_dy) {
          p.flames -= 1;
          const dropped = Math.floor(p.carried * T.hit_drop_ratio);
          p.carried -= dropped;
          this.#dropMotes(p.pos, dropped);
          p.invuln = R.invuln_ticks;
          s.state = 'recoil';
          s.ticks = R.shade_recoil_ticks;
          this.#emit('player_hit', { by: 'shade', flames: p.flames, dropped });
        }
      }
    }

    // 10. scheduled spawns (new entities act from next tick)
    this.#spawn();

    // 11. win / lose
    if (p.flames <= 0) this.#end('lost', 'no_flames');
    else if (this.lanterns.every((l) => l.lit)) this.#end('won', 'all_lit');
    else if (this.timeLeft() <= 0) this.#end('lost', 'dawn');
    // 12. snapshot is written by the caller
  }

  #movePlayer(inp, e) {
    const p = this.player;
    const N = this.map;
    let [mx, mz] = inp.move || [0, 0];
    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = ((inp.cam_yaw_deg || 0) * Math.PI) / 180;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const wx = mx * c + mz * sn;
    const wz = -mx * sn + mz * c;
    const wl = Math.sqrt(wx * wx + wz * wz);
    if (wl > 1e-9) p.facing = [wx / wl, wz / wl];

    // dash (charm: no cooldown, but pressing during a dash is ignored)
    if (e.dash && p.dashTicks === 0 && (p.dashCd === 0 || p.charm > 0)) {
      p.dashTicks = R.dash_ticks;
      p.dashCd = p.charm > 0 ? 0 : R.dash_cd_ticks;
      p.dashDir = wl > 1e-9 ? [wx / wl, wz / wl] : [...p.facing];
      this.#emit('dash', {});
    }
    const dashing = p.dashTicks > 0;

    let hx;
    let hz;
    if (dashing) {
      hx = p.dashDir[0] * T.dash_speed;
      hz = p.dashDir[1] * T.dash_speed;
      p.dashTicks--;
    } else if (p.launch) {
      [hx, hz] = p.launch;
    } else {
      const sp = p.charm > 0 ? R.charm_speed : T.player_speed;
      hx = wx * sp;
      hz = wz * sp;
    }
    if (this.windTicks > 0) {
      const a = (this.windDir * Math.PI) / 180;
      hx += Math.cos(a) * R.wind_speed;
      hz += Math.sin(a) * R.wind_speed;
    }

    // horizontal move, walls block (feet must clear the wall top)
    const before = [p.pos[0], p.pos[2]];
    const ok = (x, z) => {
      const g = this.ground(x, z);
      return g === null || g <= p.pos[1] + R.step_up;
    };
    const dx = hx * DT;
    const dz = hz * DT;
    if (ok(p.pos[0] + dx, p.pos[2] + dz)) {
      p.pos[0] += dx;
      p.pos[2] += dz;
    } else if (ok(p.pos[0] + dx, p.pos[2])) p.pos[0] += dx;
    else if (ok(p.pos[0], p.pos[2] + dz)) p.pos[2] += dz;

    // launch pads
    if (p.grounded && !dashing) {
      for (const pad of N.pads) {
        if (distXZ(p.pos, pad.pos) <= 1 && Math.abs(p.pos[1] - pad.pos[1]) <= R.step_up) {
          p.launch = [...pad.vel];
          p.vel[1] = pad.vy;
          p.grounded = false;
        }
      }
    }
    // jump
    if (e.jump && p.grounded && !dashing) {
      p.vel[1] = R.jump_speed;
      p.grounded = false;
    }

    // vertical
    const g = this.ground(p.pos[0], p.pos[2]);
    if (p.grounded) {
      if (g === null || g < p.pos[1] - R.step_up) {
        p.grounded = false;
        p.vel[1] = 0;
      } else p.pos[1] = g;
    }
    if (!p.grounded) {
      if (dashing) p.vel[1] = 0; // dash keeps altitude
      else {
        p.vel[1] -= R.gravity * DT;
        p.pos[1] += p.vel[1] * DT;
        if (g !== null && p.pos[1] <= g) {
          p.pos[1] = g;
          p.vel[1] = 0;
          p.grounded = true;
          p.launch = null;
        }
      }
    }
    p.vel[0] = (p.pos[0] - before[0]) / DT;
    p.vel[2] = (p.pos[2] - before[1]) / DT;

    // fall off the island: once, ignores invulnerability
    if (p.pos[1] < R.fall_y) {
      p.flames -= 1;
      const lost = p.carried;
      p.carried = 0;
      p.dead = true;
      p.respawn = p.flames > 0 ? R.respawn_wait_ticks : 0;
      p.vel = [0, 0, 0];
      p.launch = null;
      p.dashTicks = 0;
      this.#emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }

  #moveShades() {
    const p = this.player;
    const speed = this.map.shadeSpeed / TICK_RATE;
    for (const s of this.shades) {
      if (s.state === 'spawning') continue;
      if (s.state === 'stunned') {
        if (s.push > 0) {
          s.push--;
          const step = T.pulse_push_m / R.pulse_push_ticks;
          if (!this.#tryMoveWalker(s.pos, s.pushDir[0] * step, s.pushDir[1] * step, s.hover)) s.push = 0;
          else if (s.evict === 0) this.#blockBySafeZones(s);
        }
        continue;
      }
      if (s.state === 'recoil') {
        const [nx, nz] = dirXZ(p.pos, s.pos);
        const step = R.shade_recoil_m / R.shade_recoil_ticks;
        this.#tryMoveWalker(s.pos, nx * step, nz * step, s.hover);
        if (s.evict === 0) this.#blockBySafeZones(s);
        continue;
      }
      if (s.evict > 0) continue;
      const d = p.dead ? Infinity : distXZ(s.pos, p.pos);
      if (s.state === 'wander' && d <= R.shade_detect_m) s.state = 'chase';
      else if (s.state === 'chase' && d > R.shade_lose_m) s.state = 'wander';
      if (s.state === 'chase') {
        const [nx, nz, dd] = dirXZ(s.pos, p.pos);
        const step = Math.min(speed, dd);
        this.#tryMoveWalker(s.pos, nx * step, nz * step, s.hover);
      } else {
        if (!s.wp || distXZ(s.pos, s.wp) < 0.2) s.wp = this.#wanderPoint(s);
        const [nx, nz, dd] = dirXZ(s.pos, s.wp);
        const step = Math.min(R.shade_wander_speed / TICK_RATE, dd);
        if (!this.#tryMoveWalker(s.pos, nx * step, nz * step, s.hover)) s.wp = null;
      }
      this.#blockBySafeZones(s);
    }
  }

  #wanderPoint(s) {
    for (let i = 0; i < 6; i++) {
      const a = this.rng.shades() * 2 * Math.PI;
      const r = R.shade_wander_radius * this.rng.shades();
      const x = s.home[0] + r * Math.cos(a);
      const z = s.home[2] + r * Math.sin(a);
      if (this.ground(x, z) !== null) return [x, 0, z];
    }
    return [...s.home];
  }

  #moveDrifters() {
    const p = this.player;
    const pts = this.map.shadePoints;
    for (const d of this.drifters) {
      if (d.state === 'removed') continue;
      if (d.state === 'idle' || d.state === 'chase') {
        const want =
          !p.dead && !d.stoleOnce && p.carried >= R.drifter_chase_carry && distXZ(d.pos, p.pos) <= R.drifter_chase_m;
        d.state = want ? 'chase' : 'idle';
      }
      let dir;
      let speed = R.drifter_speed;
      if (d.state === 'chase') dir = dirXZ(d.pos, p.pos);
      else if (d.state === 'flee') dir = dirXZ(p.pos, d.pos);
      else {
        if (!d.wp || distXZ(d.pos, d.wp) < 0.3) d.wp = pts[Math.floor(this.rng.drift() * pts.length)];
        dir = dirXZ(d.pos, d.wp);
        speed = R.drifter_idle_speed;
      }
      const step = d.state === 'flee' ? speed / TICK_RATE : Math.min(speed / TICK_RATE, dir[2]);
      d.pos[0] += dir[0] * step;
      d.pos[2] += dir[1] * step;
    }
  }

  #spawn() {
    const N = this.map;
    const p = this.player;
    const st = this.simTick;
    // motes
    if (this.randomMotes && st % R.mote_spawn_every_ticks === 0) {
      const randoms = this.motes.filter((m) => m.kind === 'random');
      if (randoms.length < R.motes_cap) {
        const free = N.motePoints.filter((pt) => !randoms.some((m) => distXZ(m.pos, pt) < 0.01 && Math.abs(m.pos[1] - pt[1]) < 0.01));
        if (free.length) {
          const pt = free[Math.floor(this.rng.motes() * free.length)];
          this.motes.push({ id: this.#nextId('M', this.motes), pos: [...pt], kind: 'random', ttl: null });
        }
      }
    }
    // shades
    if (this.randomShades) {
      let n = 0;
      if (st === R.shade_first_spawn_tick) n = R.shade_first_count;
      else if (st > R.shade_first_spawn_tick && (st - R.shade_first_spawn_tick) % N.shadeEvery === 0) n = 1;
      for (let i = 0; i < n; i++) {
        if (this.shades.length >= N.shadeMax) break;
        const valid = N.shadePoints.filter(
          (pt) =>
            distXZ(pt, p.pos) >= R.shade_min_spawn_dist &&
            !this.#insideSafeZone(pt) &&
            !this.shades.some((s) => distXZ(s.pos, pt) < 1),
        );
        if (!valid.length) break;
        const pt = valid[Math.floor(this.rng.shades() * valid.length)];
        const id = this.#nextId('S', this.shades);
        const pos = [pt[0], (this.ground(pt[0], pt[2]) ?? 0) + R.shade_hover, pt[2]];
        this.shades.push(this.#makeShade(id, pos, R.shade_hover, 'spawning', R.shade_spawning_ticks));
        this.shades.sort(byId);
        this.#emit('shade_spawned', { id });
      }
    }
    // drifters
    if (this.randomDrifters && st % R.drifter_spawn_every_ticks === 0) {
      const active = this.drifters.filter((d) => d.state !== 'removed').length;
      if (active < R.drifter_max) {
        const pt = N.shadePoints[Math.floor(this.rng.drift() * N.shadePoints.length)];
        const id = this.#nextId('D', this.drifters);
        const y = (this.ground(pt[0], pt[2]) ?? 0) + R.drifter_hover;
        this.drifters.push({ id, pos: [pt[0], y, pt[2]], state: 'idle', stolen: 0, ticks: 0, stoleOnce: false, wp: null });
      }
    }
  }

  #end(result, reason) {
    this.state = result;
    this.result = { result, reason };
    if (result === 'won') {
      this.score += T.score.per_second_left * Math.floor(this.timeLeft() + 1e-9);
      this.score += T.score.per_flame_left * this.player.flames;
    }
    this.#emit('game_over', { result, reason });
  }

  // ---------- output ----------
  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: r3(this.timeLeft()),
      score: this.score,
      wind: { active: this.windTicks > 0, dir_deg: this.windDir },
      player: {
        pos: p.pos.map(r3),
        vel: p.vel.map(r3),
        grounded: p.grounded,
        flames: p.flames,
        carried: p.carried,
        invuln: p.invuln > 0,
        dash_cd_s: r3(p.dashCd / TICK_RATE),
        pulse_cd_s: r3(p.pulseCd / TICK_RATE),
        charm_s: r3(p.charm / TICK_RATE),
      },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / TICK_RATE) })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, pos: c.pos.map(r3), available: c.available, respawn_s: r3(c.respawn / TICK_RATE) })),
    };
  }
}

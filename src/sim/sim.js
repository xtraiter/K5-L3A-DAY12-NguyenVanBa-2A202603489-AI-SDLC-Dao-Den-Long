// Pure, deterministic game simulation for "Đảo Đèn Lồng".
// No DOM, no Math.random, no wall-clock time. One step() = one tick = 1/60 s.
import { TUNING, WORLD, TICK_RATE } from './config.js';
import { mulberry32, deriveSeed } from './rng.js';

export const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r; // no -0 in output
};
const secToTicks = (s) => Math.round(s * TICK_RATE);
export const distXZ = (a, b) => {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
};

export function defaultLanterns() {
  const n = TUNING.lantern_count_night1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    out.push({
      id: `L${i + 1}`,
      pos: [r3(WORLD.lantern_ring_radius * Math.sin(a)), 0, r3(WORLD.lantern_ring_radius * Math.cos(a))],
      deposited: 0,
      lit: false,
    });
  }
  return out;
}

export const NEUTRAL_INPUT = Object.freeze({
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
});

export class Sim {
  /**
   * @param {{seed?: number, scenario?: object|null}} opts scenario must already be validated
   */
  constructor({ seed = 0, scenario = null } = {}) {
    const sc = scenario || {};
    this.t = TUNING;
    this.steps = 0;
    this.state = 'playing';
    this.result = null;
    this.score = 0;
    this.events = [];
    this.rngMotes = mulberry32(deriveSeed(seed, 0x4d4f5445));
    this.rngShades = mulberry32(deriveSeed(seed, 0x53484144));
    this.duration = sc.time_left_s ?? TUNING.night1_duration_s;

    const sp = sc.player || {};
    this.player = {
      pos: sp.pos ? [...sp.pos] : [0, 0, 0],
      vy: 0,
      grounded: true,
      flames: sp.flames ?? TUNING.flames,
      carried: sp.carried ?? 0,
      invulnTicks: 0,
      pulseCdTicks: 0,
    };
    this.player.grounded = this.player.pos[1] <= 0;
    this.prevButtons = { jump: false, interact: false, pulse: false };

    // Lanterns: defaults, then patched by id from scenario.
    this.lanterns = defaultLanterns();
    for (const patch of sc.lanterns || []) {
      const l = this.lanterns.find((x) => x.id === patch.id);
      if (!l) continue; // unknown ids are ignored (warned by the loader)
      if (patch.pos) l.pos = [...patch.pos];
      if (patch.deposited !== undefined) l.deposited = patch.deposited;
      if (patch.lit !== undefined) {
        l.lit = patch.lit;
        if (l.lit && patch.deposited === undefined) l.deposited = TUNING.lantern_cost;
      }
    }

    // Motes
    this.randomMotes = sc.random_motes ?? true;
    this.moteSeq = 0;
    this.motes = [];
    if (sc.motes) {
      for (const m of sc.motes) {
        const pos = Array.isArray(m) ? m : m.pos;
        const id = !Array.isArray(m) && m.id ? m.id : this.#nextMoteId();
        this.motes.push({ id, pos: [pos[0], 0, pos[2]] });
      }
    } else if (this.randomMotes) {
      for (let i = 0; i < WORLD.motes_target; i++) this.motes.push(this.#makeRandomMote());
    }
    this.moteRespawnTicks = secToTicks(WORLD.mote_respawn_s);

    // Shades
    this.randomShades = sc.random_shades ?? true;
    this.shadeSeq = 0;
    this.shades = [];
    if (sc.shades) {
      const used = new Set(sc.shades.filter((s) => s.id).map((s) => s.id));
      for (const s of sc.shades) {
        let id = s.id;
        if (!id) {
          do id = `S${++this.shadeSeq}`;
          while (used.has(id));
        }
        this.shades.push({ id, pos: [...s.pos], stunTicks: 0 });
      }
    } else if (this.randomShades) {
      for (let i = 0; i < WORLD.shades_initial; i++) this.shades.push(this.#makeRandomShade());
    }
    this.shadeSpawnTicks = secToTicks(WORLD.shade_spawn_every_s);
  }

  // ---------- helpers ----------
  #nextMoteId() {
    let id;
    do id = `M${++this.moteSeq}`;
    while (this.motes.some((m) => m.id === id));
    return id;
  }

  #makeRandomMote() {
    const R = WORLD.island_radius - 2;
    let pos;
    for (let tries = 0; tries < 10; tries++) {
      const r = R * Math.sqrt(this.rngMotes());
      const a = this.rngMotes() * 2 * Math.PI;
      pos = [r3(r * Math.sin(a)), 0, r3(r * Math.cos(a))];
      if (distXZ(pos, this.player.pos) >= WORLD.mote_min_spawn_dist) break;
    }
    return { id: this.#nextMoteId(), pos };
  }

  #makeRandomShade() {
    const [rMin, rMax] = WORLD.shade_spawn_ring;
    let pos;
    for (let tries = 0; tries < 10; tries++) {
      const r = rMin + (rMax - rMin) * this.rngShades();
      const a = this.rngShades() * 2 * Math.PI;
      pos = [r3(r * Math.sin(a)), WORLD.shade_y, r3(r * Math.cos(a))];
      if (distXZ(pos, this.player.pos) >= WORLD.shade_min_spawn_dist) break;
    }
    let id;
    do id = `S${++this.shadeSeq}`;
    while (this.shades.some((s) => s.id === id));
    const shade = { id, pos, stunTicks: 0 };
    this.#keepOutOfLanterns(shade);
    return shade;
  }

  // Shades fear lanterns: they cannot be strictly inside safe_radius of any lantern.
  #keepOutOfLanterns(s) {
    for (const l of this.lanterns) {
      const d = distXZ(s.pos, l.pos);
      if (d < this.t.safe_radius) {
        let nx = 1;
        let nz = 0;
        if (d > 0) {
          nx = (s.pos[0] - l.pos[0]) / d;
          nz = (s.pos[2] - l.pos[2]) / d;
        }
        s.pos[0] = l.pos[0] + nx * this.t.safe_radius;
        s.pos[2] = l.pos[2] + nz * this.t.safe_radius;
      }
    }
  }

  #emit(name, data) {
    this.events.push({ type: 'event', tick: this.steps, name, data });
  }

  timeLeft() {
    return Math.max(0, this.duration - this.steps / TICK_RATE);
  }

  #end(result, reason) {
    this.state = result;
    this.result = { result, reason };
    if (result === 'won') {
      const s = this.t.score;
      this.score += s.per_second_left * Math.floor(this.timeLeft() + 1e-9);
      this.score += s.per_flame_left * this.player.flames;
    }
    this.#emit('game_over', { result, reason });
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  // ---------- one tick ----------
  step(inp = NEUTRAL_INPUT) {
    if (this.state !== 'playing') return;
    this.steps += 1;
    const T = this.t;
    const p = this.player;

    // timers
    if (p.invulnTicks > 0) p.invulnTicks--;
    if (p.pulseCdTicks > 0) p.pulseCdTicks--;
    for (const s of this.shades) if (s.stunTicks > 0) s.stunTicks--;

    // button edges (false -> true)
    const jumpEdge = !!inp.jump && !this.prevButtons.jump;
    const interactEdge = !!inp.interact && !this.prevButtons.interact;
    const pulseEdge = !!inp.pulse && !this.prevButtons.pulse;
    this.prevButtons = { jump: !!inp.jump, interact: !!inp.interact, pulse: !!inp.pulse };

    // 1. horizontal movement, relative to camera yaw
    let [mx, mz] = inp.move;
    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = (inp.cam_yaw_deg * Math.PI) / 180;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const v = T.player_speed / TICK_RATE;
    p.pos[0] += (mx * c + mz * sn) * v;
    p.pos[2] += (-mx * sn + mz * c) * v;
    const dc = Math.sqrt(p.pos[0] * p.pos[0] + p.pos[2] * p.pos[2]);
    if (dc > WORLD.island_radius) {
      p.pos[0] *= WORLD.island_radius / dc;
      p.pos[2] *= WORLD.island_radius / dc;
    }

    // 2. jump / gravity (cosmetic for gameplay: all distances are XZ)
    if (jumpEdge && p.grounded) {
      p.vy = WORLD.jump_speed;
      p.grounded = false;
    }
    if (!p.grounded) {
      p.vy -= WORLD.gravity / TICK_RATE;
      p.pos[1] += p.vy / TICK_RATE;
      if (p.pos[1] <= 0) {
        p.pos[1] = 0;
        p.vy = 0;
        p.grounded = true;
      }
    }

    // 3. pick up motes (list order), up to capacity
    if (this.motes.length) {
      const keep = [];
      for (const m of this.motes) {
        if (p.carried < T.carry_capacity && distXZ(p.pos, m.pos) <= T.pickup_radius) {
          p.carried += 1;
          this.score += T.score.per_mote;
          this.#emit('mote_picked', { carried: p.carried });
        } else keep.push(m);
      }
      this.motes = keep;
    }

    // 4. interact: deposit into nearest unlit lantern in range
    if (interactEdge && p.carried > 0) {
      let best = null;
      let bestD = Infinity;
      for (const l of this.lanterns) {
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
          this.#emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= T.lantern_cost) {
            best.lit = true;
            this.score += T.score.per_lantern;
            this.#emit('lantern_lit', { lantern_id: best.id });
            if (this.lanterns.every((l) => l.lit)) {
              this.#end('won', 'all_lit');
              return;
            }
          }
        }
      }
    }

    // 5. pulse: costs light, stuns + pushes shades in radius
    if (pulseEdge && p.pulseCdTicks === 0 && p.carried >= T.pulse_cost) {
      p.carried -= T.pulse_cost;
      p.pulseCdTicks = secToTicks(T.pulse_cooldown_s);
      const ids = [];
      for (const s of this.shades) {
        const d = distXZ(p.pos, s.pos);
        if (d <= T.pulse_radius) {
          s.stunTicks = secToTicks(T.pulse_stun_s);
          let nx = 1;
          let nz = 0;
          if (d > 0) {
            nx = (s.pos[0] - p.pos[0]) / d;
            nz = (s.pos[2] - p.pos[2]) / d;
          }
          s.pos[0] += nx * T.pulse_push_m;
          s.pos[2] += nz * T.pulse_push_m;
          this.#keepOutOfLanterns(s);
          ids.push(s.id);
        }
      }
      this.score += T.score.per_stun * ids.length;
      this.#emit('pulse', { stunned_ids: ids });
    }

    // 6. shades chase the player
    const sv = T.shade_speed / TICK_RATE;
    for (const s of this.shades) {
      if (s.stunTicks > 0) continue;
      const dx = p.pos[0] - s.pos[0];
      const dz = p.pos[2] - s.pos[2];
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0) {
        const stepLen = Math.min(sv, d);
        s.pos[0] += (dx / d) * stepLen;
        s.pos[2] += (dz / d) * stepLen;
      }
      this.#keepOutOfLanterns(s);
    }

    // 7. spawning (only when random_* is on)
    if (this.randomShades && this.shades.length < WORLD.shades_max) {
      if (--this.shadeSpawnTicks <= 0) {
        const s = this.#makeRandomShade();
        this.shades.push(s);
        this.#emit('shade_spawned', { id: s.id });
        this.shadeSpawnTicks = secToTicks(WORLD.shade_spawn_every_s);
      }
    }
    if (this.randomMotes && this.motes.length < WORLD.motes_target) {
      if (--this.moteRespawnTicks <= 0) {
        this.motes.push(this.#makeRandomMote());
        this.moteRespawnTicks = secToTicks(WORLD.mote_respawn_s);
      }
    }

    // 8. shade contact
    if (p.invulnTicks === 0) {
      for (const s of this.shades) {
        if (s.stunTicks > 0) continue;
        if (distXZ(p.pos, s.pos) <= T.shade_hit_radius) {
          p.flames -= 1;
          const dropped = Math.floor(p.carried * T.hit_drop_ratio);
          p.carried -= dropped;
          p.invulnTicks = secToTicks(T.invuln_s);
          this.#emit('player_hit', { by: 'shade', flames: p.flames, dropped });
          if (p.flames <= 0) {
            this.#end('lost', 'no_flames');
            return;
          }
          break;
        }
      }
    }

    // 9. dawn
    if (this.timeLeft() <= 0) this.#end('lost', 'dawn');
  }

  // ---------- output ----------
  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot',
      tick: this.steps,
      sim_tick: this.steps,
      state: this.state,
      time_left_s: r3(this.timeLeft()),
      score: this.score,
      player: { pos: p.pos.map(r3), flames: p.flames, carried: p.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.stunTicks > 0 ? 'stunned' : 'chase' })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
    };
  }
}

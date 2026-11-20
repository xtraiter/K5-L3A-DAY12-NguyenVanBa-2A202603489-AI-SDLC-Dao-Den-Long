// Attract-mode bot for the menu background: reads the Sim state and returns contract-style inputs.
// Client-only; it never changes gameplay rules (it plays through the same Sim.step()).
import { distXZ } from '../sim/sim.js';
import { TUNING } from '../sim/config.js';

export class DemoBot {
  constructor() {
    this.tick = 0;
  }

  input(sim) {
    this.tick++;
    const p = sim.player;
    const pulse = this.tick % 2 === 0;
    const out = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
    if (p.dead) return out;

    // scare off close shades
    const threat = sim.shades.find((s) => (s.state === 'chase' || s.state === 'drain') && distXZ(s.pos, p.pos) < 4);
    if (threat && p.carried >= TUNING.pulse_cost && p.pulseCd === 0) out.pulse = pulse;

    const cap = sim.capacity();
    const takes = (l) => !l.lit || l.fuel < 60 * 60; // relight, light, or top up below 60 fuel
    const lantern = sim.lanterns.filter(takes).sort((a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos))[0];
    const need = lantern ? (lantern.lit ? 3 : (lantern.everLit ? TUNING.relight_cost : TUNING.lantern_cost) - lantern.deposited) : Infinity;
    let target = null;
    if (lantern && (p.carried >= Math.min(need, cap) || (p.carried > 0 && sim.motes.length === 0))) {
      target = lantern.pos;
      if (distXZ(lantern.pos, p.pos) <= TUNING.interact_radius - 0.3) {
        out.interact = this.tick % 2 === 0;
        return out;
      }
    } else {
      const mote = sim.motes
        .filter((m) => Math.abs(m.pos[1] - p.pos[1]) <= 1.5)
        .sort((a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos))[0];
      target = mote ? mote.pos : lantern?.pos;
    }
    if (!target) return out;
    let dx = target[0] - p.pos[0];
    let dz = target[2] - p.pos[2];
    // steer away from a chasing shade
    if (threat && p.carried < TUNING.pulse_cost) {
      dx += (p.pos[0] - threat.pos[0]) * 2;
      dz += (p.pos[2] - threat.pos[2]) * 2;
    }
    const d = Math.hypot(dx, dz) || 1;
    out.move = [dx / d, dz / d]; // cam_yaw 0 => move maps straight to world X/Z
    out.dash = d > 12 && this.tick % 120 === 0;
    out.jump = this.tick % 240 === 30;
    return out;
  }
}

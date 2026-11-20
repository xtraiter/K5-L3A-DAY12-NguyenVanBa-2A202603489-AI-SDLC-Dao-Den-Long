// Single source of truth for gameplay numbers.
// tests/contract.test.mjs checks that game.contract.json "tuning" matches TUNING exactly.

export const TICK_RATE = 60;

export const TUNING = {
  player_speed: 6,
  carry_capacity: 5,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 3,
  pulse_cost: 1,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 2,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 5,
  shade_speed: 3.5,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 20,
    per_second_left: 1,
    per_flame_left: 50,
  },
};

// Internal numbers not covered by the contract.
export const WORLD = {
  island_radius: 40, // player is clamped inside this circle (no falling in Phase 1)
  lantern_ring_radius: 22, // L1..L5 on a regular pentagon, L1 at +Z
  jump_speed: 7, // m/s
  gravity: 20, // m/s^2
  motes_target: 30, // random_motes: keep this many motes on the island
  mote_respawn_s: 2,
  mote_min_spawn_dist: 4, // from player
  shades_initial: 2,
  shades_max: 6,
  shade_spawn_every_s: 25,
  shade_spawn_ring: [30, 38],
  shade_min_spawn_dist: 15, // from player
  shade_y: 1,
};

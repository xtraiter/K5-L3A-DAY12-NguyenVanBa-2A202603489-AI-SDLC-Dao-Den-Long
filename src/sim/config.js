// Single source of truth for gameplay numbers (Ticket-02 standard values, Contract v1.1).
// tests check that game.contract.json "tuning" equals TUNING exactly.

export const TICK_RATE = 60;

export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  score: {
    per_mote: 10, // per mote deposited into a lantern
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

// Other standard numbers from Ticket-02 (not contract keys) + a few marked assumptions.
export const RULES = {
  jump_speed: 7,
  gravity: 20,
  pickup_dy: 1.5, // max |feet - mote ground| for pickup
  hit_dy: 1.5, // max |feet - shade centre| for a hit
  step_up: 0.35, // walkable height change per tick (ramps); higher = vertical wall (assumption)
  fall_y: -10,
  respawn_wait_ticks: 60,
  respawn_invuln_ticks: 90,
  drop_ring: [1.5, 2.5],
  dropped_ttl_ticks: 480,
  motes_initial: 20,
  motes_cap: 30,
  mote_spawn_every_ticks: 240,
  shade_first_spawn_tick: 300,
  shade_first_count: 2,
  shade_detect_m: 12,
  shade_lose_m: 18,
  shade_min_spawn_dist: 15,
  shade_hover: 1, // shade centre above ground (assumption)
  shade_spawning_ticks: 60, // assumption: 1 s materialising, harmless & still
  shade_wander_speed: 1.5, // assumption
  shade_wander_radius: 8, // assumption
  shade_recoil_m: 2,
  shade_recoil_ticks: 60,
  evict_ticks: 30,
  pulse_center_dy: 0.8,
  pulse_stun_ticks: 120,
  pulse_push_ticks: 15,
  invuln_ticks: 90,
  dash_ticks: 12,
  dash_cd_ticks: 90,
  pulse_cd_ticks: 180,
  charm_speed: 7.2,
  charm_ticks: 600,
  charm_respawn_ticks: 2700,
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_max: 2,
  drifter_spawn_every_ticks: 1200,
  drifter_chase_carry: 5,
  drifter_chase_m: 15,
  drifter_hit_xz: 1.2,
  drifter_steal_max: 3,
  drifter_flee_ticks: 240,
  drifter_vanish_ticks: 120,
  drifter_hover: 1.5, // assumption
  wind_every_ticks: 1800,
  wind_ticks: 300,
  wind_speed: 2,
  wind_warn_ticks: 120,
};

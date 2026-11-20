// Music from /nhac (self-made / AI, see CREDITS.md) + small synthesized SFX (Web Audio).
// Never imported by the headless runner.
const FILES = { bgm: 'maintheme.mp3', won: 'win.mp3', lost: 'dead.mp3' };

// [type, startHz, endHz, seconds, gain] — tiny original blips, no samples needed
const SYNTH = {
  mote_picked: [['sine', 880, 1320, 0.09, 0.25]],
  deposit: [['triangle', 523, 659, 0.12, 0.3]],
  lantern_lit: [['triangle', 523, 523, 0.18, 0.3], ['triangle', 659, 659, 0.18, 0.3, 0.12], ['triangle', 784, 784, 0.3, 0.3, 0.24], ['sine', 1047, 1047, 0.5, 0.25, 0.36]],
  pulse: [['sine', 220, 880, 0.35, 0.35]],
  player_hit: [['square', 260, 90, 0.3, 0.2]],
  jump: [['sine', 380, 620, 0.12, 0.2]],
  dash: [['noise', 0, 0, 0.18, 0.25]],
  shade_spawned: [['sawtooth', 110, 70, 0.5, 0.15]],
  countdown: [['square', 1000, 1000, 0.06, 0.12]],
  wind: [['noise', 0, 0, 1.6, 0.18]],
  charm_picked: [['triangle', 660, 990, 0.2, 0.3], ['triangle', 990, 1320, 0.2, 0.25, 0.1]],
  drifter_steal: [['sawtooth', 600, 200, 0.25, 0.15]],
  step: [['noise', 0, 0, 0.05, 0.06]],
  land: [['sine', 160, 70, 0.12, 0.3]],
  launch: [['sine', 200, 900, 0.45, 0.3], ['noise', 0, 0, 0.5, 0.12]],
  fall: [['sine', 700, 120, 0.9, 0.3]],
  bell: [['sine', 392, 392, 2.2, 0.3], ['sine', 784, 784, 1.6, 0.15], ['sine', 1176, 1176, 1.0, 0.08]],
  ui: [['triangle', 880, 880, 0.05, 0.15]],
  drifter_drop: [['triangle', 990, 660, 0.25, 0.2]],
  paused: [['triangle', 500, 400, 0.1, 0.15]],
  lantern_out: [['sine', 440, 110, 1.0, 0.3], ['noise', 0, 0, 0.6, 0.08]],
  refuel: [['triangle', 600, 900, 0.18, 0.25]],
  won: [['triangle', 523, 1047, 0.6, 0.3]],
  lost: [['sine', 392, 196, 0.8, 0.3]],
};

export class GameAudio {
  constructor(base = './nhac/') {
    this.volume = 0.7;
    this.ctx = null;
    this.files = {};
    for (const [key, file] of Object.entries(FILES)) {
      const el = new window.Audio();
      el.preload = 'auto';
      el.addEventListener('error', () => delete this.files[key], { once: true });
      el.src = base + file;
      this.files[key] = el;
    }
    if (this.files.bgm) this.files.bgm.loop = true;
  }

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    this.ctx?.resume?.();
  }

  setVolume(v) {
    this.volume = v;
    if (this.files.bgm) this.files.bgm.volume = v * 0.45;
  }

  playBgm() {
    const b = this.files.bgm;
    if (!b) return;
    b.volume = this.volume * 0.45;
    b.play().catch(() => {});
  }

  stopBgm() {
    this.files.bgm?.pause();
  }

  play(key) {
    if (this.volume <= 0) return;
    const f = key !== 'bgm' && this.files[key];
    if (f) {
      const c = f.cloneNode();
      c.volume = this.volume;
      c.play().catch(() => this.#synth(key));
      return;
    }
    this.#synth(key);
  }

  #synth(key) {
    const parts = SYNTH[key];
    const ctx = this.ctx;
    if (!parts || !ctx) return;
    const now = ctx.currentTime;
    for (const [type, f0, f1, dur, gain, delay = 0] of parts) {
      const t0 = now + delay;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain * this.volume + 0.0001, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      g.connect(ctx.destination);
      let src;
      if (type === 'noise') {
        const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
        const d = buf.getChannelData(0);
        let seed = 1;
        for (let i = 0; i < d.length; i++) {
          seed = (seed * 16807) % 2147483647;
          d[i] = (seed / 2147483647) * 2 - 1;
        }
        src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        src.connect(bp);
        bp.connect(g);
      } else {
        src = ctx.createOscillator();
        src.type = type;
        src.frequency.setValueAtTime(f0, t0);
        src.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        src.connect(g);
      }
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    }
  }
}

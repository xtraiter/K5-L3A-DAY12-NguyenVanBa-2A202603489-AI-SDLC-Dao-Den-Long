// Optional music/SFX loaded from the /nhac folder. Missing files are silently skipped,
// so the game runs fine with an empty folder. Never imported by the headless runner.
const FILES = {
  bgm: 'bgm.mp3', // nhạc nền (loop)
  mote_picked: 'pickup.mp3',
  deposit: 'deposit.mp3',
  lantern_lit: 'lit.mp3',
  pulse: 'pulse.mp3',
  player_hit: 'hit.mp3',
  shade_spawned: 'shade.mp3',
  won: 'win.mp3',
  lost: 'lose.mp3',
};

export class GameAudio {
  constructor(base = './nhac/') {
    this.sounds = {};
    for (const [key, file] of Object.entries(FILES)) {
      const el = new window.Audio();
      el.preload = 'auto';
      el.addEventListener('error', () => delete this.sounds[key], { once: true });
      el.src = base + file;
      this.sounds[key] = el;
    }
    if (this.sounds.bgm) {
      this.sounds.bgm.loop = true;
      this.sounds.bgm.volume = 0.5;
    }
  }

  play(key) {
    const s = this.sounds[key];
    if (!s) return;
    if (key === 'bgm') {
      s.play().catch(() => {});
      return;
    }
    const c = s.cloneNode();
    c.volume = 0.8;
    c.play().catch(() => {});
  }

  stopBgm() {
    this.sounds.bgm?.pause();
  }
}

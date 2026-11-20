// Deterministic PRNG (mulberry32). Never use Math.random inside src/sim.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deriveSeed(seed, salt) {
  return (Math.imul((seed | 0) ^ salt, 0x9e3779b1) + 0x632be5ab) >>> 0;
}

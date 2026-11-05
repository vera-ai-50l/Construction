// Deterministic PRNG + hashing. Integer math only so both players generate identical levels.
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return h >>> 0;
}

export class RNG {
  constructor(seed) { this.s = (typeof seed === 'string' ? hashStr(seed) : seed >>> 0) || 0x9e3779b9; }
  u32() { // mulberry32
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  next() { return this.u32() / 4294967296; }
  int(a, b) { return a + (this.u32() % (b - a + 1)); } // inclusive
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[this.u32() % arr.length]; }
  range(a, b) { return a + (b - a) * this.next(); }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = this.u32() % (i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  fork(tag) { return new RNG((this.u32() ^ hashStr(String(tag))) >>> 0); }
}

const CODE_CHARS = 'ACDEFHJKLMNPRTUVWXY3479'; // no look-alikes (0/O, 1/I, 5/S, 8/B, 2/Z, 6/G)
export function serialCode(rng) {
  const c = () => CODE_CHARS[rng.u32() % CODE_CHARS.length];
  return c() + c() + '-' + c() + c() + c();
}
export function crewCode(rng) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = ''; for (let i = 0; i < 5; i++) s += A[rng.u32() % A.length];
  return s;
}

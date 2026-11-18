// A small seeded random source (xorshift128+ with a splitmix seed): the same seed gives the
// same city, the same traffic and the same screenshot scenes, which is what makes the game
// repeatable. Extra helpers live beside the raw stream so callers read intent, not bit math.

export function createRandom(seed) {
  let s0 = (seed ^ 0x9e3779b9) >>> 0;
  let s1 = (Math.imul(seed ^ 0x85ebca6b, 0xc2b2ae35) ^ 0x27d4eb2f) >>> 0;
  if (s0 === 0 && s1 === 0) s1 = 0x9e3779b9;
  function next() {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= (x << 23) >>> 0;
    x ^= x >>> 17;
    x ^= y ^ (y >>> 26);
    s1 = x >>> 0;
    return ((s1 + y) >>> 0) / 4294967296;
  }
  return {
    /** A float in [0, 1). */
    next,
    /** An integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** One element of `list`, uniformly. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** A shuffled copy of `list` (Fisher-Yates, same seed, same order). */
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    /** True with probability `p`. */
    chance(p) {
      return next() < p;
    },
  };
}

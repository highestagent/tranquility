export type Random = () => number

/** Seeded PRNG (mulberry32), so every run's stimuli can be reproduced. */
export function createRandom(seed: number): Random {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

export function randomInt(min: number, max: number, random: Random) {
  return min + Math.floor(random() * (max - min + 1))
}

export function randomSeed() {
  return crypto.getRandomValues(new Int32Array(1))[0]!
}

import { mean } from "@/lib/stats"
import { createRandom, randomInt, shuffle, type Random } from "@/lib/random"

/** Average ranks, so ties share a rank. */
export function ranks(values: readonly number[]) {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value)
  const result = new Array<number>(values.length)
  let start = 0
  while (start < order.length) {
    let end = start
    while (
      end + 1 < order.length &&
      order[end + 1]!.value === order[start]!.value
    ) {
      end++
    }
    const rank = (start + end) / 2 + 1
    for (let i = start; i <= end; i++) result[order[i]!.index] = rank
    start = end + 1
  }
  return result
}

/** Pearson correlation, or `null` if either side has no variance. */
export function pearson(x: readonly number[], y: readonly number[]) {
  const meanX = mean(x)
  const meanY = mean(y)
  let numerator = 0
  let sumX = 0
  let sumY = 0
  for (let i = 0; i < x.length; i++) {
    const dx = x[i]! - meanX
    const dy = y[i]! - meanY
    numerator += dx * dy
    sumX += dx * dx
    sumY += dy * dy
  }
  // Tolerance for rounding error in values that are constant after residualising.
  if (sumX < 1e-9 || sumY < 1e-9) return null
  return numerator / Math.sqrt(sumX * sumY)
}

export function spearman(x: readonly number[], y: readonly number[]) {
  return pearson(ranks(x), ranks(y))
}

/** Removes the linear trend of `values` over `order`. */
export function residualize(
  values: readonly number[],
  order: readonly number[]
) {
  const meanValues = mean(values)
  const meanOrder = mean(order)
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < values.length; i++) {
    numerator += (order[i]! - meanOrder) * (values[i]! - meanValues)
    denominator += (order[i]! - meanOrder) ** 2
  }
  const slope = denominator === 0 ? 0 : numerator / denominator
  return values.map(
    (value, i) => value - meanValues - slope * (order[i]! - meanOrder)
  )
}

/** Cliff's delta: on a -1 to 1 scale, how often group 1 exceeds group 0. */
export function cliffsDelta(x: readonly number[], y: readonly number[]) {
  let wins = 0
  let pairs = 0
  for (let a = 0; a < x.length; a++) {
    if (x[a] !== 1) continue
    for (let b = 0; b < x.length; b++) {
      if (x[b] !== 0) continue
      pairs++
      const difference = y[a]! - y[b]!
      // Residuals carry rounding noise, so compare with a small tolerance.
      if (difference > 1e-9) wins++
      else if (difference < -1e-9) wins--
    }
  }
  return pairs === 0 ? null : wins / pairs
}

export type Statistic = (
  x: readonly number[],
  y: readonly number[]
) => number | null

/** Two-sided permutation p-value, with the +1 correction so it is never 0. */
export function permutationP(
  x: readonly number[],
  y: readonly number[],
  statistic: Statistic,
  random: Random,
  iterations = 2000
) {
  const observed = statistic(x, y)
  if (observed === null) return null
  let extreme = 0
  for (let i = 0; i < iterations; i++) {
    const value = statistic(shuffle(x, random), y)
    if (value !== null && Math.abs(value) >= Math.abs(observed) - 1e-12) {
      extreme++
    }
  }
  return (extreme + 1) / (iterations + 1)
}

/** Percentile bootstrap interval for a paired statistic. */
export function bootstrapCi(
  x: readonly number[],
  y: readonly number[],
  statistic: Statistic,
  random: Random,
  iterations = 1000,
  level = 0.95
) {
  const estimates: number[] = []
  const n = x.length
  for (let i = 0; i < iterations; i++) {
    const sampleX = new Array<number>(n)
    const sampleY = new Array<number>(n)
    for (let j = 0; j < n; j++) {
      const pick = randomInt(0, n - 1, random)
      sampleX[j] = x[pick]!
      sampleY[j] = y[pick]!
    }
    const value = statistic(sampleX, sampleY)
    if (value !== null) estimates.push(value)
  }
  if (estimates.length < iterations / 2) return null
  estimates.sort((a, b) => a - b)
  const tail = (1 - level) / 2
  return {
    low: estimates[Math.floor(tail * (estimates.length - 1))]!,
    high: estimates[Math.ceil((1 - tail) * (estimates.length - 1))]!,
  }
}

/** Benjamini-Hochberg adjusted p-values, returned in the input's order. */
export function benjaminiHochberg(pValues: readonly number[]) {
  const m = pValues.length
  const order = pValues
    .map((p, index) => ({ p, index }))
    .sort((a, b) => b.p - a.p)
  const adjusted = new Array<number>(m)
  let smallest = 1
  order.forEach(({ p, index }, position) => {
    smallest = Math.min(smallest, (p * m) / (m - position))
    adjusted[index] = smallest
  })
  return adjusted
}

export interface RelationshipResult {
  method: "spearman" | "permutation"
  n: number
  effect: number
  ciLow: number | null
  ciHigh: number | null
  pValue: number
  /** Effect in the earlier and later halves of the data. */
  earlyEffect: number | null
  lateEffect: number | null
}

/**
 * Tests a factor against a metric after removing linear trends over time.
 * Scores usually improve with practice, so any factor that also drifts over
 * time would otherwise look like it caused the improvement.
 */
export function testRelationship(
  observations: readonly { x: number; y: number; order: number }[],
  seed: number
): RelationshipResult | null {
  const x = observations.map((o) => o.x)
  const y = observations.map((o) => o.y)
  const order = observations.map((o) => o.order)
  const random = createRandom(seed)
  const binary = x.every((value) => value === 0 || value === 1)

  const orderRanks = ranks(order)
  const adjustedY = residualize(ranks(y), orderRanks)
  const adjustedX = binary ? x : residualize(ranks(x), orderRanks)
  const statistic: Statistic = binary ? cliffsDelta : pearson

  const effect = statistic(adjustedX, adjustedY)
  if (effect === null) return null
  const pValue = permutationP(adjustedX, adjustedY, statistic, random)
  if (pValue === null) return null
  const ci = bootstrapCi(adjustedX, adjustedY, statistic, random)

  const half = Math.floor(x.length / 2)
  return {
    method: binary ? "permutation" : "spearman",
    n: x.length,
    effect,
    ciLow: ci?.low ?? null,
    ciHigh: ci?.high ?? null,
    pValue,
    earlyEffect: statistic(adjustedX.slice(0, half), adjustedY.slice(0, half)),
    lateEffect: statistic(adjustedX.slice(half), adjustedY.slice(half)),
  }
}

/** Small numeric helpers shared by game scorers and the analytics engine. */

export function mean(values: readonly number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function median(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Sample standard deviation. */
export function standardDeviation(values: readonly number[]) {
  const center = mean(values)
  const squares = values.reduce((sum, value) => sum + (value - center) ** 2, 0)
  return Math.sqrt(squares / (values.length - 1))
}

/** Inverse of the standard normal CDF (Acklam's approximation). */
export function inverseNormal(p: number) {
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269,
    -30.66479806614716, 2.506628277459239,
  ] as const
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866,
    66.80131188771972, -13.28068155288572,
  ] as const
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ] as const
  const d = [
    0.007784695709041462, 0.3224671290700398, 2.445134137142996,
    3.754408661907416,
  ] as const
  const low = 0.02425

  const tail = (q: number) =>
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)

  if (p < low) return tail(Math.sqrt(-2 * Math.log(p)))
  if (p > 1 - low) return -tail(Math.sqrt(-2 * Math.log(1 - p)))
  const q = p - 0.5
  const r = q * q
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  )
}

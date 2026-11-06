const NICE_STEPS = [1, 2, 2.5, 5, 10]

function ticksFor(low: number, high: number, step: number) {
  const ticks: number[] = []
  for (
    let tick = Math.ceil(low / step) * step;
    tick <= high + step * 1e-9;
    tick += step
  ) {
    // Rounding keeps steps like 0.1 from accumulating floating-point error.
    ticks.push(Number(tick.toPrecision(12)))
  }
  return ticks
}

/** Round axis values inside a range, so a chart shows 300 rather than 291. */
export function niceTicks(low: number, high: number, targetCount = 3) {
  const span = high - low
  if (!(span > 0)) return [low]
  const rawStep = span / Math.max(1, targetCount - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = NICE_STEPS.map((nice) => nice * magnitude).reduce((best, next) =>
    Math.abs(next - rawStep) < Math.abs(best - rawStep) ? next : best
  )
  const ticks = ticksFor(low, high, step)
  // A single gridline gives no sense of scale.
  return ticks.length < 2 ? ticksFor(low, high, step / 2) : ticks
}

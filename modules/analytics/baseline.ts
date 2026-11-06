import { median } from "@/lib/stats"

export interface Baseline {
  n: number
  median: number
  /** Median absolute deviation, a spread measure robust to odd runs. */
  mad: number
}

export const MIN_BASELINE_RUNS = 3

/** Scales MAD to be comparable with a standard deviation. */
const MAD_SCALE = 1.4826

export function computeBaseline(values: readonly number[]): Baseline | null {
  if (values.length < MIN_BASELINE_RUNS) return null
  const center = median(values)
  return {
    n: values.length,
    median: center,
    mad: median(values.map((value) => Math.abs(value - center))),
  }
}

/** Distance from baseline in robust standard deviations. */
export function robustZ(value: number, baseline: Baseline) {
  const spread = baseline.mad * MAD_SCALE
  return spread === 0 ? null : (value - baseline.median) / spread
}

import type { MetricDefinition } from "./types"

export function formatMetric(value: number, metric: MetricDefinition) {
  switch (metric.unit) {
    case "ms":
      return `${Math.round(value)} ms`
    case "ms/item":
      return `${value.toFixed(1)} ms/item`
    case "ratio":
      return `${Math.round(value * 100)}%`
    case "count":
      return String(Math.round(value))
    case "index":
      return value.toFixed(2)
  }
}

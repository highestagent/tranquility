// Writes synthetic data with one planted pattern: more sleep, faster reactions.
// Run: node scripts/generate-demo-data.mjs > fixtures/demo-data.json

let state = 20260601
function random() {
  state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const scale = () => 1 + Math.floor(random() * 5)
const round = (value) => Math.round(value * 10) / 10

const SESSIONS = 24
const DAY = 24 * 60 * 60 * 1000
const start = Date.UTC(2026, 5, 1, 9)

const data = {
  sessions: [],
  measurements: [],
  responses: [],
  investigations: [],
  hypotheses: [],
  analyses: [],
  discoveries: [],
  decisions: [],
  kv: [],
}

for (let index = 0; index < SESSIONS; index++) {
  const sessionId = `demo-session-${index}`
  const startedAt = start + index * DAY
  data.sessions.push({ id: sessionId, startedAt })

  const hours = Math.round((4.5 + random() * 4.5) * 2) / 2
  const answers = {
    "sleep.hours": hours,
    "stress.level": scale(),
    "mood.valence": scale(),
  }
  for (const [questionId, value] of Object.entries(answers)) {
    data.responses.push({
      id: `${sessionId}-${questionId}`,
      sessionId,
      questionId,
      bankVersion: 1,
      value,
      answeredAt: startedAt,
    })
  }

  const run = (assessmentId, metrics) =>
    data.measurements.push({
      id: `${sessionId}-${assessmentId}`,
      sessionId,
      assessmentId,
      protocolVersion: 1,
      seed: index,
      startedAt: startedAt + 60_000,
      completedAt: startedAt + 180_000,
      inputType: "keyboard",
      valid: true,
      trials: [],
      metrics,
    })

  // The planted pattern, with noise, on the Go/No-Go's main metric only.
  run("go-no-go", {
    medianRt: round(470 - 18 * hours + (random() - 0.5) * 40),
    rtVariability: round(50 + random() * 20),
    commissionRate: round(random() * 0.3),
    omissionRate: round(random() * 0.1),
    dPrime: round(2 + random()),
  })
  run("visual-search", {
    medianRt: round(1100 + (random() - 0.5) * 200),
    searchSlope: round(25 + random() * 10),
    accuracy: round(0.85 + random() * 0.15),
  })
}

process.stdout.write(
  JSON.stringify(
    {
      format: "tranquility-export",
      version: 1,
      exportedAt: start + SESSIONS * DAY,
      data,
    },
    null,
    2
  ) + "\n"
)

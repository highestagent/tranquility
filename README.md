# Tranquility

A personal cognitive research agent. It investigates how sleep, stress, mood,
habits, and surroundings relate to your own cognitive performance: it forms
hypotheses, collects evidence through short games and questions, and explains
what it found and how far to trust it.

Tranquility is not a medical tool and doesn't diagnose anything.

## Getting started

```bash
pnpm install
```

The agent uses [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). Add your
key to `.env.local`, which stays on the server. The agent's model needs paid AI
Gateway credits on your Vercel account, because the free tier doesn't include it.

```bash
echo 'AI_GATEWAY_API_KEY=your-key' >> .env.local
```

```bash
pnpm dev
```

Games, questionnaires, statistics, and data tools all work without a key.

### Try it with demo data

To skip weeks of data collection, go to **Your data → Import a file** and choose
[`fixtures/demo-data.json`](fixtures/demo-data.json). It's synthetic, with one
planted pattern: more sleep, faster reactions. Importing replaces what's stored
in that browser. Regenerate it with `scripts/generate-demo-data.mjs`.

## How it works

The agent runs in the browser and all data stays in IndexedDB. Each turn it reads
its state through tools, decides what it needs, and either analyzes data or hands
the user a question set or game. Closing the browser loses nothing, because the
investigation and any pending task are stored.

```
app/          Thin routes, plus the stateless AI relay at /api/ai
modules/
  assessments/    The games. Each folder is a self-contained game.
  questionnaire/  Question bank and form
  memory/         IndexedDB storage, export, import, delete
  analytics/      Deterministic statistics
  investigation/  Hypotheses, verdicts, and resumable state
  agent/          ToolLoopAgent, tools, permissions, consent
  relay/          Forwards model requests, keeping the key on the server
  session/        The session UI
  insights/       Findings
```

Dependencies run one way: `agent → investigation → analytics → memory`.

### The agent can't invent results

- **Measurements:** no tool can write a measurement or answer. Only the UI can.
- **Protocols:** the agent picks a game by ID, so it can't change how it runs.
  Protocols are versioned, and results from different versions are never compared.
- **Statistics:** analysis tools take IDs and read the numbers from storage.
- **Verdicts:** code decides whether a hypothesis is supported, from stored
  analyses. The figures on a finding are generated too, and the agent's own
  wording may not contain numerals.
- **Permissions:** the agent must read before acting, and can only record a finding
  after running an analysis in that turn. See `modules/agent/policy.ts`.

Evidence grades are heuristics for comparing a person's data with itself, not
validated clinical cut-offs. See `modules/analytics/grading.ts`.

### Adding a game

1. Create `modules/assessments/<game>/`, following the shape of `go-no-go/`:
   `protocol.ts`, `scoring.ts`, `game.tsx`, `index.ts`, and tests.
2. Export an `AssessmentDefinition` and add it to `modules/assessments/registry.ts`.

The session runner, agent tools, and analysis pick it up from the registry.

### Using a different model

Inference is isolated in `modules/agent/model.ts`. To run a local model, return a
different `LanguageModel` from there.

## Known limits

- **The relay is for personal use.** There are no accounts, so anyone who can reach
  a deployment can use its AI key, within basic same-origin and rate limits. Add
  real abuse protection before deploying publicly.
- **Browser storage can be cleared.** Export regularly. There's no encrypted backup
  or sync yet.
- **Reaction times are browser-based.** They are comparable on one device and input
  method, but not between them.

## Development

```bash
pnpm test
```

```bash
pnpm typecheck && pnpm lint
```

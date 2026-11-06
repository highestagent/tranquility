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
key to `.env.local`, which stays on the server. The agent uses `openai/gpt-5.2`, which is
available on the gateway's free tier once a card is on your Vercel account.

```bash
echo 'AI_GATEWAY_API_KEY=your-key' >> .env.local
```

```bash
pnpm dev
```

Games, questionnaires, statistics, and data tools all work without a key.

### Accounts and memory

Begin signs in with Google through [Privy](https://www.privy.io). The agent's
findings and progress notes then sync to
[Walrus Memory](https://docs.wal.app/walrus-memory) in the background, so it can
pick up where it left off on any device. Add these to `.env.local`:

| Variable | Where it comes from | Exposure |
|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy dashboard | Public |
| `PRIVY_APP_SECRET` | Privy dashboard | Server only |

Each person gets their own Walrus Memory account on mainnet, with nothing to set
up:

1. Their first sync creates a Sui wallet through Privy.
2. Walrus Memory sponsors the transactions that create their account and register
   a signing key, so the wallet never needs funding. Its managed relayer also pays
   for storage.
3. That key is derived from a wallet signature, so it's the same on every device.
   It stays in memory and is never stored or exported.

Raw answers and game trials never leave the device, because the hosted relayer
reads text in plaintext while storing and searching it. Walrus Memory has no
delete, so "forget" moves a person to a new namespace, and old encrypted copies
remain until they expire. See `modules/agent-memory/`.

### Try it with demo data

To skip weeks of data collection, open **You** (the fingerprint icon) → **Import** and choose
[`fixtures/demo-data.json`](fixtures/demo-data.json). It's synthetic, with one
planted pattern: more sleep, faster reactions. Importing replaces what's stored
in that browser. Regenerate it with `scripts/generate-demo-data.mjs`.

## How it works

The agent runs in the browser and all data stays in IndexedDB. There's no start
button: when you open the app, the agent wakes if it has a reason to (first run,
new data, or a long rest), and the screen follows what it's doing.

| Phase | What you see |
|---|---|
| Thinking | The evidence map, with the orb rippling and threads forming live |
| Asking | One tap-to-answer question at a time |
| Playing | A game with an animated preview, then a visual result |
| Reveal | A new finding, with its chart and evidence strength |
| Resting | What the agent said, the map, and a way to ask your own question |

Every screen uses the same layout (`components/screen.tsx`): a quiet reason, one
thing to read, one thing to look at, and one action in thumb reach. The orb is a
WebGL shader (`modules/insights/agent-orb.tsx`) that never renders beside a game.

Closing the browser loses nothing, because the investigation and any pending task
are stored. See `modules/session/use-agent-session.ts`.

```
app/          Thin routes, plus the stateless AI relay at /api/ai
modules/
  assessments/    The games. Each folder is a self-contained game.
  questionnaire/  Question bank and form
  memory/         IndexedDB storage, export, import, delete
  analytics/      Deterministic statistics
  investigation/  Hypotheses, verdicts, and resumable state
  agent/          ToolLoopAgent, tools, permissions, consent
  account/        Sign-in with Google through Privy
  agent-memory/   Background sync to Walrus Memory, and recall
  relay/          Forwards model requests, keeping the key on the server
  session/        The home screen and its phases
  insights/       The evidence map and findings
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

- **Memory requests pass through this app's server.** The managed Walrus Memory
  relayer only accepts browsers from Walrus's own apps, so `/api/walrus` forwards
  them. It stores nothing and can't sign, but memory text and a short-lived
  decryption credential do pass through it, and everyone shares its IP address for
  the relayer's per-IP limits. A self-hosted relayer could accept this app directly.
- **The managed relayer has no uptime guarantee.** It's a free public service with
  usage limits. When it's unavailable, the agent carries on without memory.
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

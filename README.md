# Tranquility

Tranquility pairs science-based cognitive games with check-ins about sleep,
stress, and energy. It compares sessions and uses the findings to decide what
to measure next.

[Try the app](https://www.tranquility.lifestyle/) ·
[Watch the demo](https://youtu.be/4bqIiR0Gbig) ·
[Read the write-up](https://medium.com/@highestlordagent/building-tranquility-a-cognitive-training-app-that-learns-from-your-results-bdde449af656)

Built for [Total Recall](https://tatum.io/hackathon/total-recall).

- **Walrus Memory** stores findings and open investigations so the agent can
  pick up on another device and show the note behind a recalled result. The
  demo account showed 53 saved memories on mainnet.
- **Tatum** provides Sui mainnet RPC for account setup and transaction
  confirmation. Tranquility uses it to verify that the Walrus Memory account
  is active and belongs to the signed-in wallet.

Across 25 comparable sessions, longer sleep was associated with faster
reactions after adjusting for trends over time. The agent suggested pairing
sleep quality and energy ratings with another Go/No-Go run.

## Run locally

Use Node.js 20.9+ and pnpm. Set `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`,
`AI_GATEWAY_API_KEY`, and `TATUM_API_KEY` in `.env.local`. Enable Google sign-in
in Privy and allow `http://localhost:3000`.

```sh
pnpm install
pnpm dev
```

[Apache License 2.0](LICENSE)

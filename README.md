# Blockshift

React/TypeScript Tetris with optional Jev AI play.

## Run

```sh
npm install
npm run dev
```

## Enable Jev AI

A local `.env` is provided (ignored by Git). Set `JEV_API_KEY` to your own key,
then restart Vite. For fresh checkouts, copy `.env.example` to `.env` first.

```dotenv
JEV_API_KEY=your-key
JEV_API_URL=https://jev-ai.org/api/v1/systemone/
JEV_MODEL=jev-1.13
JEV_TIMEOUT_MS=10000
```

Click **Let Jev AI play**. It starts a game if needed. Pause/resume and restart
still work; **Stop Jev AI** returns control to you. Movement keyboard shortcuts
and touch buttons are disabled during AI play. Each AI decision performs a
single action, with gravity suspended in AI mode so network latency cannot
invalidate its view. This is intentionally turn-based, not a real-time agent.

Requests can incur charges, up to roughly five decisions per second. Requests
are serialized and bounded by timeouts. Errors or repeated blocked moves stop
the player; there are no automatic retries of paid requests. AI quality is not
guaranteed. No live provider call is made by the tests.

## Architecture

- `src/ai/TetrisPromptBuilder.ts`: versioned board context, strategy instructions,
  and a typed `choice` question with the available Tetris actions. Modify this
  class to experiment with prompts without changing networking or the engine.
- `src/ai/protocol.ts`: provider interface and runtime action validation.
- `src/ai/JevAiClient.ts`: browser-to-server adapter; contains no API key.
- `src/ai/AiPlayer.ts`: reusable engine controller with a host-supplied clock,
  cancellation, stale-answer checks, subscriptions, and request cadence.
- `server/JevDecisionService.ts`: server-only authenticated Jev REST adapter,
  using `state` + `questions` and reading `answers.move.choice`.
- `server/jevPlugin.ts`: `/api/jev/decision` bridge for Vite dev **and preview**;
  bounded body size, validated state, concurrency limits, and same-origin checks.

To substitute another provider, implement `DecisionProvider.decide(state,
signal)` and inject it into `AiPlayer`. The game engine is independent of AI.

Jev protocol references: [Decisions](https://jev-ai.org/docs/decisions/) and
[Question types](https://jev-ai.org/docs/question-types/).

## Deployment/security

Never prefix credentials with `VITE_`: those variables are exposed to browsers.
Building produces static frontend assets only. Serving `dist/` from a static
host does **not** deploy the bridge. For production, mount the decision service
in your own authenticated backend at `/api/jev/decision`, with per-user quotas,
rate limits, authorization, and secret management. Vite's bridge is for local
use, not a public paid API proxy. Prefer `npm run dev -- --host 127.0.0.1` when
using a real key; the default development command listens on all interfaces.

## Checks

```sh
npm test
npm run lint
npm run build
```

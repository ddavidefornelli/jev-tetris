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
JEV_API_URL=https://api.typesafe.ai/v1/systemone
JEV_MODEL=jev-latest
JEV_TIMEOUT_MS=10000
```

Use a key from the TypeSafe console with the official `api.typesafe.ai` endpoint.
Keys are provider-specific; a valid TypeSafe key will not authenticate on third-party
Jev gateways. You can check credentials without running inference using
`GET https://api.typesafe.ai/v1/models` with a Bearer authorization header.

Click **AI: OFF** to enable AI play. It starts a game if needed. Pause/resume
and restart still work; **AI: ON** returns control to you. Movement keyboard
shortcuts and touch buttons are disabled during AI play.

Each Jev decision now selects a **complete reachable landing**, not an isolated
key. A local planner enumerates collision-checked SRS paths, scores their final
boards (holes, height, wells, and big clears), and evaluates one-piece lookahead
including hold. Jev compares a bounded shortlist with the full game state and
long-term big-wins objective. The player commits to the selected keyboard sequence
and hard drops, with no re-deciding between rotations. This prevents endless
rotation/left-right loops and guarantees each valid plan places a piece.

Gravity is suspended in AI mode so network latency cannot invalidate a plan.
Stopping, pausing, restarting, or unexpected input discards the remaining plan.
Requests can incur charges: one request per placement, at most roughly five per
second, rather than one per key. Requests are serialized and bounded by timeouts.
Errors or blocked planned moves stop the player; there are no automatic retries
of paid requests. AI quality is not guaranteed. No live provider call is made by
the tests.

## Architecture

- `src/ai/TetrisPlacementPlanner.ts`: bounded reachable-placement search with
  shared engine SRS rotations, exact keyboard plans, board metrics, and next-piece
  lookahead. Every plan ends in hard drop; options that immediately top out are
  excluded.
- `src/ai/TetrisPromptBuilder.ts`: versioned board context, strategy instructions,
  and a typed `choice` question with complete placement options. The state includes
  the full board, active/ghost origin and rotation, next/held piece geometry,
  scoring context, and an explicit long-term big-wins objective (not instant
  single-row clears). Modify this
  class to experiment with prompts without changing networking or the engine.
- `src/input/bindings.ts`: shared human/AI gameplay key bindings: left, right,
  soft drop, clockwise/counterclockwise rotation, hard drop, and hold (including
  keyboard aliases). Pause/start remain user controls. The selected placement
  executes these same engine commands as human key presses.
- `src/ai/protocol.ts`: provider interface and runtime action/plan validation;
  plans are bounded to 64 commands, allow hold only first, and end in one drop.
- `src/ai/JevAiClient.ts`: browser-to-server adapter; contains no API key.
- `src/ai/AiPlayer.ts`: reusable engine controller with a host-supplied clock,
  cancellation, stale-answer/plan checks, paced plan execution, and request cadence.
- `server/JevDecisionService.ts`: server-only authenticated Jev REST adapter,
  using `state` + `questions` and reading `answers.move.choice`.
- `server/jevPlugin.ts`: `/api/jev/decision` bridge for Vite dev **and preview**;
  bounded body size, validated state, concurrency limits, and same-origin checks.

To substitute another provider, implement `DecisionProvider.decide(state,
signal)` and inject it into `AiPlayer`. The game engine is independent of AI.

Jev protocol references: [TypeSafe API](https://api.typesafe.ai/redoc) and
[Question types](https://docs.typesafe.ai/primitives).

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

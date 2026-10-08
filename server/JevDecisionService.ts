import type { GameSnapshot } from '../src/game/types.ts';
import { parseDecision } from '../src/ai/protocol.ts';
import { TetrisPromptBuilder } from '../src/ai/TetrisPromptBuilder.ts';

export interface JevConfig { apiKey: string; endpoint: string; model: string; timeoutMs: number }

/** Only safe, locally generated diagnostics may be sent to the browser. */
export class JevRequestError extends Error {
  constructor(status: number) {
    const detail = status === 401 || status === 403
      ? 'Jev authentication failed. Check JEV_API_KEY and JEV_API_URL (TypeSafe keys require https://api.typesafe.ai/v1/systemone), then restart the server.'
      : status === 402
        ? 'Jev balance is insufficient. Check your account quota.'
        : status === 429
          ? 'Jev rate limit reached. Wait before trying again.'
          : 'Jev upstream request failed. Check the provider and connection.';
    super(`${detail} (HTTP ${status})`);
    this.name = 'JevRequestError';
  }
}

export class JevPlanningError extends Error {}

/** Server-only Jev REST adapter. Swap this service without changing the game. */
export class JevDecisionService {
  constructor(private readonly config: JevConfig, private readonly transport: typeof fetch = globalThis.fetch.bind(globalThis), private readonly prompts = new TetrisPromptBuilder()) {}

  async decide(state: GameSnapshot, signal: AbortSignal) {
    if (!this.config.apiKey) throw new Error('Set JEV_API_KEY in .env and restart the server');
    const prompt = this.prompts.build(state);
    if (!prompt.state.placements.length) throw new JevPlanningError('No safe reachable landing remains. Restart the game to try again.');
    const response = await this.transport(this.config.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.config.model, ...prompt }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(this.config.timeoutMs)]),
      redirect: 'error',
    });
    // Do not forward upstream bodies: they can contain account or provider details.
    if (!response.ok) throw new JevRequestError(response.status);
    const body = await response.json() as { answers?: { move?: { type?: string; choice?: unknown } } };
    if (body.answers?.move?.type !== 'choice') throw new Error('Invalid Jev response');
    const placement = prompt.state.placements.find(option => option.id === body.answers?.move?.choice);
    if (!placement) throw new Error('Invalid Jev placement');
    console.log('[Jev placement]', placement.id, '→', placement.keys.join(' '));
    return parseDecision({ actions: placement.actions });
  }
}

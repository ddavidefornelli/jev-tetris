import type { GameSnapshot } from '../game/types';
import { parseDecision } from './protocol';
import type { DecisionProvider } from './protocol';

/** Browser adapter: credentials never enter the browser bundle. */
export class JevAiClient implements DecisionProvider {
  constructor(private readonly endpoint = '/api/jev/decision', private readonly transport: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  async decide(state: GameSnapshot, signal: AbortSignal) {
    const response = await this.transport(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(body?.error ?? `AI connection failed (${response.status})`);
    }
    return parseDecision(await response.json());
  }
}

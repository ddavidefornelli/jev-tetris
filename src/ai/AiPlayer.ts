import type { GameEngine } from '../game/GameEngine';
import type { DecisionProvider } from './protocol';
import { parseDecision } from './protocol';

export interface AiPlayerState {
  readonly enabled: boolean;
  readonly thinking: boolean;
  readonly error: string | null;
}

/** One in-flight decision, cancellation, stale-state protection and bounded cadence. */
export class AiPlayer {
  private state: AiPlayerState = { enabled: false, thinking: false, error: null };
  private request: AbortController | null = null;
  private nextDecisionAt = 0;
  private blockedMoves = 0;
  private readonly listeners = new Set<() => void>();
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  constructor(private readonly engine: GameEngine, private readonly provider: DecisionProvider, private readonly intervalMs = 200) {}

  start() {
    this.stop();
    this.nextDecisionAt = 0;
    this.blockedMoves = 0;
    this.publish({ enabled: true, thinking: false, error: null });
    const phase = this.engine.getSnapshot().phase;
    if (phase === 'ready' || phase === 'over') this.engine.start();
  }

  stop() {
    this.request?.abort();
    this.request = null;
    this.publish({ ...this.state, enabled: false, thinking: false });
  }

  /** Called by any host clock; no browser dependencies or internal timers. */
  update(now: number) {
    if (!this.state.enabled) return;
    const snapshot = this.engine.getSnapshot();
    if (snapshot.phase === 'over') { this.stop(); return; }
    if (snapshot.phase !== 'playing') {
      this.request?.abort();
      this.request = null;
      if (this.state.thinking) this.publish({ ...this.state, thinking: false });
      return;
    }
    if (this.request || now < this.nextDecisionAt) return;
    const controller = new AbortController();
    this.request = controller;
    this.nextDecisionAt = now + this.intervalMs;
    this.publish({ ...this.state, thinking: true });
    void this.provider.decide(snapshot, controller.signal).then(value => {
      if (this.request !== controller || controller.signal.aborted) return;
      const decision = parseDecision(value);
      // Pause, restart or a manual input invalidates the decision, even for identical pieces.
      if (this.engine.getSnapshot() === snapshot) {
        this.engine.command(decision.action);
        this.blockedMoves = this.engine.getSnapshot() === snapshot ? this.blockedMoves + 1 : 0;
        if (this.blockedMoves >= 12) throw new Error('Jev is repeating blocked moves. Stopped to avoid unnecessary API usage.');
      }
    }).catch((error: unknown) => {
      if (this.request !== controller || controller.signal.aborted) return;
      this.publish({ enabled: false, thinking: false, error: error instanceof Error ? error.message : 'AI decision failed' });
    }).finally(() => {
      if (this.request !== controller) return;
      this.request = null;
      this.publish({ ...this.state, thinking: false });
    });
  }

  private publish(state: AiPlayerState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

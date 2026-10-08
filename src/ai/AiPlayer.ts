import type { GameEngine } from '../game/GameEngine';
import type { GameSnapshot } from '../game/types';
import type { AiAction, DecisionProvider } from './protocol';
import { parseDecision } from './protocol';

export interface AiPlayerState {
  readonly enabled: boolean;
  readonly thinking: boolean;
  readonly error: string | null;
}

/** One paid decision per placement; execute its finite plan without re-deciding between keys. */
export class AiPlayer {
  private state: AiPlayerState = { enabled: false, thinking: false, error: null };
  private request: AbortController | null = null;
  private nextDecisionAt = 0;
  private nextActionAt = 0;
  private now = 0;
  private blockedMoves = 0;
  private actions: AiAction[] = [];
  private expectedSnapshot: GameSnapshot | null = null;
  private committedPlan = false;
  private readonly listeners = new Set<() => void>();
  readonly getSnapshot = () => this.state;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  constructor(private readonly engine: GameEngine, private readonly provider: DecisionProvider, private readonly intervalMs = 200, private readonly moveIntervalMs = 60) {}

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
    this.clearPlan();
    this.publish({ ...this.state, enabled: false, thinking: false });
  }

  /** Called by any host clock; no browser dependencies or internal timers. */
  update(now: number) {
    this.now = now;
    if (!this.state.enabled) return;
    const snapshot = this.engine.getSnapshot();
    if (snapshot.phase === 'over') { this.stop(); return; }
    if (snapshot.phase !== 'playing') {
      this.request?.abort();
      this.request = null;
      this.clearPlan();
      if (this.state.thinking) this.publish({ ...this.state, thinking: false });
      return;
    }
    // Pause/resume, restart, or unexpected manual input invalidates the rest of a plan.
    if (this.actions.length && snapshot !== this.expectedSnapshot) this.clearPlan();
    if (this.actions.length) {
      if (now >= this.nextActionAt) {
        try { this.executeNextAction(); }
        catch (error) { this.fail(error); }
      }
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
      if (this.engine.getSnapshot() === snapshot) {
        this.committedPlan = 'actions' in decision;
        this.actions = 'actions' in decision ? [...decision.actions] : [decision.action];
        this.expectedSnapshot = snapshot;
        this.executeNextAction();
      }
    }).catch((error: unknown) => {
      if (this.request !== controller || controller.signal.aborted) return;
      this.fail(error);
    }).finally(() => {
      if (this.request !== controller) return;
      this.request = null;
      this.publish({ ...this.state, thinking: false });
    });
  }

  private executeNextAction() {
    const action = this.actions.shift();
    if (!action) return;
    const before = this.engine.getSnapshot();
    this.engine.command(action);
    const after = this.engine.getSnapshot();
    this.blockedMoves = after === before ? this.blockedMoves + 1 : 0;
    if (after === before && this.committedPlan) throw new Error('AI placement became blocked. Stopped rather than spinning or wasting API calls.');
    if (this.blockedMoves >= 12) throw new Error('Jev is repeating blocked moves. Stopped to avoid unnecessary API usage.');
    this.expectedSnapshot = after;
    this.nextActionAt = this.now + this.moveIntervalMs;
    if (!this.actions.length) {
      this.clearPlan();
      this.nextDecisionAt = this.now + this.intervalMs;
    }
    if (after.phase === 'over') this.stop();
  }

  private clearPlan() {
    this.actions = [];
    this.expectedSnapshot = null;
    this.committedPlan = false;
  }

  private fail(error: unknown) {
    this.stop();
    this.publish({ enabled: false, thinking: false, error: error instanceof Error ? error.message : 'AI decision failed' });
  }

  private publish(state: AiPlayerState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

import type { GameCommand, GameSnapshot } from '../game/types.ts';

export const AI_ACTIONS = ['left', 'right', 'down', 'rotate-cw', 'rotate-ccw', 'drop', 'hold'] as const satisfies readonly GameCommand[];
export const MAX_PLAN_ACTIONS = 64;
export type AiAction = (typeof AI_ACTIONS)[number];
export type AiDecision = { action: AiAction } | { actions: readonly AiAction[] };
export interface DecisionProvider {
  decide(state: GameSnapshot, signal: AbortSignal): Promise<AiDecision>;
}
export function parseDecision(value: unknown): AiDecision {
  if (!value || typeof value !== 'object') throw new Error('Invalid AI action');
  if ('actions' in value) {
    const actions = value.actions;
    if ('action' in value || !Array.isArray(actions) || actions.length === 0 || actions.length > MAX_PLAN_ACTIONS ||
      !actions.every(action => AI_ACTIONS.includes(action)) || actions.at(-1) !== 'drop' ||
      actions.slice(0, -1).includes('drop') || actions.slice(1).includes('hold')) throw new Error('Invalid AI plan');
    return { actions: [...actions] as AiAction[] };
  }
  const action = (value as { action?: unknown }).action;
  if (!AI_ACTIONS.includes(action as AiAction)) throw new Error('Invalid AI action');
  return { action: action as AiAction };
}

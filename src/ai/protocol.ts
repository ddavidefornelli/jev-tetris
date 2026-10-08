import type { GameCommand, GameSnapshot } from '../game/types.ts';

export const AI_ACTIONS = ['left', 'right', 'down', 'rotate-cw', 'rotate-ccw', 'drop', 'hold'] as const satisfies readonly GameCommand[];
export type AiAction = (typeof AI_ACTIONS)[number];
export interface AiDecision { action: AiAction }
export interface DecisionProvider {
  decide(state: GameSnapshot, signal: AbortSignal): Promise<AiDecision>;
}
export function parseDecision(value: unknown): AiDecision {
  const action = (value as Partial<AiDecision> | null)?.action;
  if (!AI_ACTIONS.includes(action as AiAction)) throw new Error('Invalid AI action');
  return { action: action as AiAction };
}

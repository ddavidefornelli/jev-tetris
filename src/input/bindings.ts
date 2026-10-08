import type { GameCommand } from '../game/types.ts';

export type GameplayCommand = Exclude<GameCommand, 'pause' | 'start'>;

/** Canonical gameplay keys, aliases, and semantics shared by human input and AI. */
export const GAMEPLAY_BINDINGS = {
  ArrowLeft: { command: 'left', aliases: ['KeyA'], description: 'Move the active piece one column left if free.' },
  ArrowRight: { command: 'right', aliases: ['KeyD'], description: 'Move the active piece one column right if free.' },
  ArrowDown: { command: 'down', aliases: ['KeyS'], description: 'Soft drop one row if free; earn 1 point. Does not hard drop or lock.' },
  ArrowUp: { command: 'rotate-cw', aliases: ['KeyW', 'KeyX'], description: 'Rotate clockwise 90 degrees using SRS wall kicks. The O piece does not rotate.' },
  KeyZ: { command: 'rotate-ccw', aliases: [], description: 'Rotate counterclockwise 90 degrees using SRS wall kicks. The O piece does not rotate.' },
  Space: { command: 'drop', aliases: [], description: 'Hard drop to the ghost cells, earn 2 points per row, lock immediately, clear full rows, and spawn next[0].' },
  KeyC: { command: 'hold', aliases: ['ShiftLeft', 'ShiftRight'], description: 'Hold/swap the active piece and reset its position/rotation to spawn. With empty hold, spawn next[0]. Only allowed when canHold is true.' },
} as const satisfies Record<string, { command: GameplayCommand; aliases: readonly string[]; description: string }>;

export type GameplayKey = keyof typeof GAMEPLAY_BINDINGS;

export const KEY_MAP: Readonly<Record<string, GameCommand | undefined>> = {
  ...Object.fromEntries(Object.entries(GAMEPLAY_BINDINGS).flatMap(([key, binding]) =>
    [key, ...binding.aliases].map(code => [code, binding.command]),
  )),
  Escape: 'pause', KeyP: 'pause', Enter: 'start',
};

/** Accept gameplay keys (including aliases), never pause/start or arbitrary commands. */
export function gameplayCommandForKey(value: unknown): GameplayCommand {
  const command = typeof value === 'string' && Object.hasOwn(KEY_MAP, value) ? KEY_MAP[value] : undefined;
  if (!command || command === 'pause' || command === 'start') throw new Error('Invalid AI key');
  return command;
}

import type { GameSnapshot } from '../game/types.ts';
import type { AiAction } from './protocol.ts';

const ACTION_DESCRIPTIONS: Record<AiAction, string> = {
  left: 'Move the active piece one column left if space is free.',
  right: 'Move the active piece one column right if space is free.',
  down: 'Move the active piece one row down if space is free.',
  'rotate-cw': 'Rotate clockwise 90 degrees using SRS wall kicks.',
  'rotate-ccw': 'Rotate counterclockwise 90 degrees using SRS wall kicks.',
  drop: 'Hard drop to the ghost position, lock immediately, clear full rows, and spawn the next piece.',
  hold: 'Swap with the held piece, or store this piece and spawn the next. Only allowed when canHold is true.',
};

/** Pure, versioned prompt construction; independent of HTTP and rendering. */
export class TetrisPromptBuilder {
  build(snapshot: GameSnapshot) {
    return {
      state: {
        schemaVersion: 1,
        rules: 'Tetris: fill rows to clear them. Avoid topping out. Coordinates start at the top left: x grows right, y grows down. Board contains locked cells only; dots are empty. Active and ghost cells are separate. Gravity is suspended between decisions. Each decision performs exactly one action. Repeated blocked moves make no progress.',
        width: snapshot.board[0]?.length ?? 0,
        height: snapshot.board.length,
        board: snapshot.board.map(row => row.map(cell => cell ?? '.').join('')),
        active: snapshot.active,
        ghost: snapshot.ghost,
        next: snapshot.next,
        hold: snapshot.hold,
        canHold: snapshot.canHold,
        score: snapshot.score,
        lines: snapshot.lines,
        level: snapshot.level,
      },
      questions: {
        move: {
          type: 'choice' as const,
          instructions: 'Choose the next single action to play Tetris well. The objective is to Maximize total points, so think moves ahead. Plan rotations and horizontal positioning before hard dropping. Maximize cleared lines and survival; minimize holes, stack height, and uneven surfaces. Use the next queue and hold strategically. Do not repeat blocked moves; drop when positioned.',
          criteria: Object.fromEntries(Object.entries(ACTION_DESCRIPTIONS).filter(([action]) => action !== 'hold' || snapshot.canHold)),
        },
      },
    };
  }
}

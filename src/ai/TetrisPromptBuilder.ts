import type { GameSnapshot } from '../game/types.ts';
import { SHAPES } from '../game/constants.ts';
import { Tetromino } from '../game/Tetromino.ts';
import { GAMEPLAY_BINDINGS } from '../input/bindings.ts';
import { TetrisPlacementPlanner } from './TetrisPlacementPlanner.ts';

/** Pure, versioned prompt construction; independent of HTTP and rendering. */
export class TetrisPromptBuilder {
  constructor(private readonly planner = new TetrisPlacementPlanner()) {}

  build(snapshot: GameSnapshot) {
    const placements = this.planner.plan(snapshot);
    const controls = Object.fromEntries(Object.entries(GAMEPLAY_BINDINGS).map(([key, binding]) => [key, {
      ...binding,
      available: binding.command !== 'hold' || snapshot.canHold,
    }]));
    return {
      state: {
        ...snapshot,
        schemaVersion: 3,
        objective: 'Maximize long-term total score through big wins, especially four-line Tetrises, back-to-back Tetrises, and combos. Do not clear a single row as soon as possible just for an immediate reward. Use the next queue and hold to build safe setups for larger clears; preserve useful wells and keep future placements flexible. Take a smaller clear when it prevents topping out or dangerous holes. Survival supports long-term big wins, so never sacrifice the game just to chase a Tetris.',
        rules: 'Tetris. Coordinates are zero-based: x increases right; y increases down. board[y][x] contains locked piece types or null for empty cells; boardRows shows the same board with dots for empty cells. Active and ghost are separate, not locked cells. Piece x/y is the shape-matrix origin; cells are absolute board coordinates. rotation 0/1/2/3 means 0/90/180/270 degrees clockwise. Negative y is above the visible board. Ghost is where Space will lock the current piece. next[0] is the next piece to spawn; nextPieces includes the queue geometry at spawn, not pieces already on the board. Hold also resets a piece to spawn. Gravity and lock timers are suspended in AI mode. Choose a complete placement from placements; its listed keyboard sequence executes once, ending in Space. Do not choose individual rotations or reconsider midway. Every option is collision-checked, reachable with real SRS wall kicks, and ends with a lock. ArrowDown alone does not lock a grounded piece. Topping out ends the game.',
        width: snapshot.board[0]?.length ?? 0,
        height: snapshot.board.length,
        boardRows: snapshot.board.map(row => row.map(cell => cell ?? '.').join('')),
        nextPieces: snapshot.next.map((type, queueIndex) => ({
          queueIndex,
          ...new Tetromino(type).toView(),
          shape: SHAPES[type],
        })),
        holdPiece: snapshot.hold ? { ...new Tetromino(snapshot.hold).toView(), shape: SHAPES[snapshot.hold] } : null,
        scoring: {
          lineClearBasePoints: [0, 100, 300, 500, 800],
          lineClearMultiplier: snapshot.level,
          consecutiveTetrisBonus: '50% of base points when backToBack is true and four lines are cleared.',
          comboBonus: '50 * new combo * level, with combo starting at 0 for the first consecutive clear.',
          softDropPointsPerRow: 1,
          hardDropPointsPerRow: 2,
          linesPerLevel: 10,
        },
        controls,
        placements,
        placementGuide: 'Compare final outcomes, not isolated moves. Lower holes, aggregateHeight, maxHeight, and bumpiness are generally safer; tetrisWellDepth measures a ready single-column well. heuristicScore ranks board safety, big clears, and one-piece lookahead (higher is better). nextPieceBest is a simulated best next placement, including hold when available. The shortlist contains only legal finite plans. Prefer place_0 when alternatives have no clear long-term strategic advantage.',
      },
      questions: {
        move: {
          type: 'choice' as const,
          instructions: 'Choose one complete landing placement from state.placements to pursue state.objective: long-term big wins, not clearing a row as soon as possible. Compare each resulting board, holes, stack height, Tetris well, points, and nextPieceBest lookahead. Prioritize survival and avoiding holes, then safe four-line and back-to-back Tetris setups using nextPieces and hold. Options are ranked by heuristicScore; prefer the highest-ranked option unless another clearly serves the long-term strategy better. The selected keyboard sequence will rotate, move horizontally or down as needed, then hard drop and lock. Do not choose individual keys or endlessly rotate: commit to one final placement.',
          criteria: Object.fromEntries(placements.map(option => [option.id,
            `Lock ${option.landing.type} at cells ${JSON.stringify(option.landing.cells)}${option.usesHold ? ' after hold' : ''}. Clear ${option.linesCleared} lines, gain ${option.points} points. Result: ${option.metrics.holes} holes, max height ${option.metrics.maxHeight}, well depth ${option.metrics.tetrisWellDepth}. Score ${option.heuristicScore.toFixed(2)}. Keys: ${option.keys.join(', ')}.`,
          ])),
        },
      },
    };
  }
}

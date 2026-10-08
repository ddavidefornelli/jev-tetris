import { Board } from '../game/Board.ts';
import { Tetromino } from '../game/Tetromino.ts';
import type { GameSnapshot, Grid, PieceView } from '../game/types.ts';
import { GAMEPLAY_BINDINGS } from '../input/bindings.ts';
import type { GameplayKey } from '../input/bindings.ts';
import { MAX_PLAN_ACTIONS } from './protocol.ts';
import type { AiAction } from './protocol.ts';

const COMMAND_KEYS = Object.fromEntries(Object.entries(GAMEPLAY_BINDINGS).map(([key, binding]) => [binding.command, key])) as Record<AiAction, GameplayKey>;

export interface BoardMetrics {
  holes: number;
  aggregateHeight: number;
  maxHeight: number;
  bumpiness: number;
  tetrisWellDepth: number;
}
export interface PlacementOption {
  id: string;
  landing: PieceView;
  actions: AiAction[];
  keys: GameplayKey[];
  usesHold: boolean;
  linesCleared: number;
  points: number;
  metrics: BoardMetrics;
  heuristicScore: number;
  nextPieceBest: { linesCleared: number; holes: number; maxHeight: number } | null;
  boardRowsAfter: string[];
}
interface Candidate {
  option: PlacementOption;
  after: GameSnapshot;
}

export function measureBoard(grid: Grid): BoardMetrics {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const heights = Array<number>(width).fill(0);
  let holes = 0;
  for (let x = 0; x < width; x++) {
    let occupied = false;
    for (let y = 0; y < height; y++) {
      if (grid[y]![x] !== null) {
        if (!occupied) heights[x] = height - y;
        occupied = true;
      } else if (occupied) holes++;
    }
  }
  let tetrisWellDepth = 0;
  for (let x = 0; x < width; x++) {
    let depth = 0;
    for (let y = height - 1; y >= 0; y--) {
      if (grid[y]![x] !== null || grid[y]!.some((cell, column) => column !== x && cell === null)) break;
      depth++;
    }
    tetrisWellDepth = Math.max(tetrisWellDepth, depth);
  }
  return {
    holes,
    aggregateHeight: heights.reduce((sum, value) => sum + value, 0),
    maxHeight: Math.max(0, ...heights),
    bumpiness: heights.slice(1).reduce((sum, value, index) => sum + Math.abs(value - heights[index]!), 0),
    tetrisWellDepth,
  };
}

function quality(metrics: BoardMetrics, hasUpcomingI: boolean): number {
  return -8 * metrics.holes - 0.4 * metrics.aggregateHeight - 0.6 * metrics.maxHeight - 0.3 * metrics.bumpiness +
    Math.min(4, metrics.tetrisWellDepth) * (hasUpcomingI ? 0.8 : 0.2);
}

/** Enumerates reachable, non-top-out landings. Every option is a finite keyboard plan ending in hard drop. */
export class TetrisPlacementPlanner {
  plan(snapshot: GameSnapshot): PlacementOption[] {
    const candidates = this.enumerate(snapshot).sort((a, b) => b.option.heuristicScore - a.option.heuristicScore || a.option.actions.length - b.option.actions.length);
    // Bound lookahead work and prompt size; retain diverse good placements, not arbitrary single keys.
    const shortlist = candidates.slice(0, 12);
    for (const candidate of shortlist) {
      const next = this.enumerate(candidate.after).sort((a, b) => b.option.heuristicScore - a.option.heuristicScore)[0];
      if (next) {
        candidate.option.nextPieceBest = { linesCleared: next.option.linesCleared, holes: next.option.metrics.holes, maxHeight: next.option.metrics.maxHeight };
        candidate.option.heuristicScore = 0.4 * candidate.option.heuristicScore + 0.6 * next.option.heuristicScore + candidate.option.points / 100;
      } else {
        // A reachable current landing that leaves no safe next landing is a losing setup.
        candidate.option.heuristicScore -= 1000;
      }
    }
    return shortlist.sort((a, b) => b.option.heuristicScore - a.option.heuristicScore || a.option.actions.length - b.option.actions.length)
      .slice(0, 8).map((candidate, index) => ({ ...candidate.option, id: `place_${index}` }));
  }

  private enumerate(snapshot: GameSnapshot): Candidate[] {
    if (snapshot.phase !== 'playing' || !snapshot.active) return [];
    const { active } = snapshot;
    const board = new Board(snapshot.board[0]!.length, snapshot.board.length, snapshot.board);
    const starts = [{ piece: new Tetromino(active.type, active.x, active.y, active.rotation), prefix: [] as AiAction[], consumesQueue: 0 }];
    const heldType = snapshot.hold ?? snapshot.next[0];
    if (snapshot.canHold && heldType) starts.push({ piece: new Tetromino(heldType), prefix: ['hold'], consumesQueue: snapshot.hold ? 0 : 1 });
    const candidates: Candidate[] = [];
    for (const { piece, prefix, consumesQueue } of starts) {
      if (!board.canPlace(piece)) continue;
      const visited = new Set<string>();
      const landings = new Set<string>();
      const queue = [{ piece, actions: prefix }];
      visited.add(`${piece.x},${piece.y},${piece.rotation}`);
      for (let index = 0; index < queue.length; index++) {
        const node = queue[index]!;
        const landing = board.landingPosition(node.piece);
        const landingId = landing.cells.map(({ x, y }) => `${x},${y}`).sort().join(';');
        if (!landings.has(landingId)) {
          landings.add(landingId);
          const result = new Board(board.width, board.height, snapshot.board);
          if (result.place(landing)) {
            const linesCleared = result.clearLines();
            const nextType = snapshot.next[consumesQueue];
            const nextPiece = nextType ? new Tetromino(nextType) : null;
            // The engine checks the next spawn immediately, before hold can rescue it.
            if (!nextPiece || result.canPlace(nextPiece)) {
              const actions: AiAction[] = [...node.actions, 'drop'];
              const grid = result.snapshot();
              const metrics = measureBoard(grid);
              const combo = linesCleared ? snapshot.combo + 1 : -1;
              const base = [0, 100, 300, 500, 800][linesCleared]! * snapshot.level;
              const points = base + (linesCleared === 4 && snapshot.backToBack ? base * 0.5 : 0) +
                (linesCleared ? Math.max(0, combo) * 50 * snapshot.level : 0) +
                2 * (landing.y - node.piece.y) + node.actions.filter(action => action === 'down').length;
              const hold = prefix.length ? active.type : snapshot.hold;
              const lines = snapshot.lines + linesCleared;
              candidates.push({
                option: {
                  id: '', landing: landing.toView(), actions, keys: actions.map(action => COMMAND_KEYS[action]),
                  usesHold: prefix.length > 0, linesCleared, points, metrics,
                  heuristicScore: points / 100 + quality(metrics, snapshot.next.slice(consumesQueue).includes('I') || hold === 'I'),
                  nextPieceBest: null, boardRowsAfter: grid.map(row => row.map(cell => cell ?? '.').join('')),
                },
                after: {
                  ...snapshot, board: grid, active: nextPiece?.toView() ?? null,
                  ghost: nextPiece ? result.landingPosition(nextPiece).toView() : null,
                  next: snapshot.next.slice(consumesQueue + 1), hold, canHold: true,
                  score: snapshot.score + points, lines, level: Math.floor(lines / 10) + 1,
                  combo, backToBack: linesCleared > 0 ? linesCleared === 4 : snapshot.backToBack,
                },
              });
            }
          }
        }
        if (node.actions.length >= MAX_PLAN_ACTIONS - 1) continue;
        const transitions: [AiAction, Tetromino | null][] = [
          ['left', node.piece.move(-1, 0)], ['right', node.piece.move(1, 0)],
          ['rotate-cw', board.rotatedPosition(node.piece, 1)], ['rotate-ccw', board.rotatedPosition(node.piece, -1)],
          ['down', node.piece.move(0, 1)],
        ];
        for (const [action, candidate] of transitions) {
          if (!candidate || candidate.y < -4 || !board.canPlace(candidate)) continue;
          const id = `${candidate.x},${candidate.y},${candidate.rotation}`;
          if (visited.has(id)) continue;
          visited.add(id);
          queue.push({ piece: candidate, actions: [...node.actions, action] });
        }
      }
    }
    return candidates;
  }
}

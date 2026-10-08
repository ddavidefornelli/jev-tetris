import { BOARD_HEIGHT, BOARD_WIDTH, rotationKicks } from './constants.ts';
import type { Tetromino } from './Tetromino.ts';
import type { Cell, Grid } from './types.ts';

/** Owns collision, placement, and row compaction; has no knowledge of UI or scoring. */
export class Board {
  private rows: Cell[][];

  constructor(
    public readonly width = BOARD_WIDTH,
    public readonly height = BOARD_HEIGHT,
    initial?: Grid,
  ) {
    if (initial && (initial.length !== height || initial.some((row) => row.length !== width))) {
      throw new Error('Initial grid dimensions must match the board.');
    }
    this.rows = initial ? initial.map((row) => [...row]) : this.emptyRows(height);
  }

  canPlace(piece: Tetromino): boolean {
    return piece.cells.every(({ x, y }) =>
      x >= 0 && x < this.width && y < this.height && (y < 0 || this.rows[y]?.[x] === null),
    );
  }

  /** Shared SRS rotation resolution for gameplay and reachable-placement search. */
  rotatedPosition(piece: Tetromino, direction: 1 | -1): Tetromino | null {
    if (piece.type === 'O') return null;
    const rotated = piece.rotate(direction);
    for (const [dx, dy] of rotationKicks(piece.type, piece.rotation, rotated.rotation)) {
      const candidate = rotated.move(dx, dy);
      if (this.canPlace(candidate)) return candidate;
    }
    return null;
  }

  /** Returns false on top-out without partially writing an invalid piece. */
  place(piece: Tetromino): boolean {
    if (!this.canPlace(piece) || piece.cells.some(({ y }) => y < 0)) return false;
    for (const { x, y } of piece.cells) this.rows[y]![x] = piece.type;
    return true;
  }

  clearLines(): number {
    const remaining = this.rows.filter((row) => row.some((cell) => cell === null));
    const cleared = this.height - remaining.length;
    this.rows = [...this.emptyRows(cleared), ...remaining];
    return cleared;
  }

  landingPosition(piece: Tetromino): Tetromino {
    let landing = piece;
    while (this.canPlace(landing.move(0, 1))) landing = landing.move(0, 1);
    return landing;
  }

  snapshot(): Grid {
    return this.rows.map((row) => [...row]);
  }

  private emptyRows(count: number): Cell[][] {
    return Array.from({ length: count }, () => Array<Cell>(this.width).fill(null));
  }
}

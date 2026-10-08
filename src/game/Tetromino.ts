import { BOARD_WIDTH, SHAPES } from './constants';
import type { PieceType, PieceView, Point, Rotation } from './types';

/** Immutable piece value object. Transformations create candidates, not mutations. */
export class Tetromino {
  constructor(
    public readonly type: PieceType,
    public readonly x = Math.floor((BOARD_WIDTH - SHAPES[type].length) / 2),
    public readonly y = type === 'I' ? -1 : 0,
    public readonly rotation: Rotation = 0,
  ) {}

  get cells(): readonly Point[] {
    const shape = SHAPES[this.type];
    const size = shape.length;
    const cells: Point[] = [];
    shape.forEach((row, y) => row.forEach((filled, x) => {
      if (!filled) return;
      let rx = x;
      let ry = y;
      if (this.type !== 'O') {
        for (let i = 0; i < this.rotation; i++) {
          [rx, ry] = [size - 1 - ry, rx];
        }
      }
      cells.push({ x: this.x + rx, y: this.y + ry });
    }));
    return cells;
  }

  move(dx: number, dy: number): Tetromino {
    return new Tetromino(this.type, this.x + dx, this.y + dy, this.rotation);
  }

  rotate(direction: 1 | -1): Tetromino {
    return new Tetromino(this.type, this.x, this.y, ((this.rotation + direction + 4) % 4) as Rotation);
  }

  toView(): PieceView {
    return { type: this.type, cells: this.cells };
  }
}

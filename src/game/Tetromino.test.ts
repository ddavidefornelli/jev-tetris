import { describe, expect, it } from 'vitest';
import { Tetromino } from './Tetromino';
import { PIECE_TYPES } from './types';

describe('Tetromino', () => {
  it.each(PIECE_TYPES)('%s has four cells in every orientation', (type) => {
    let piece = new Tetromino(type);
    for (let i = 0; i < 4; i++) {
      expect(piece.cells).toHaveLength(4);
      expect(new Set(piece.cells.map(({ x, y }) => `${x}:${y}`)).size).toBe(4);
      piece = piece.rotate(1);
    }
    expect(piece.cells).toEqual(new Tetromino(type).cells);
  });

  it('moves and rotates without mutating the original', () => {
    const piece = new Tetromino('T', 3, 4);
    const moved = piece.move(-1, 2).rotate(-1);
    expect(piece.x).toBe(3);
    expect(piece.y).toBe(4);
    expect(piece.rotation).toBe(0);
    expect(moved.rotation).toBe(3);
    expect(moved.x).toBe(2);
    expect(moved.y).toBe(6);
  });

  it('exposes the exact origin and rotation alongside absolute cells', () => {
    const piece = new Tetromino('T', 2, 6, 3);
    expect(piece.toView()).toEqual({ type: 'T', x: 2, y: 6, rotation: 3, cells: piece.cells });
  });

  it('does not shift the square piece when rotating', () => {
    const piece = new Tetromino('O');
    expect(piece.rotate(1).cells).toEqual(piece.cells);
  });
});

import { describe, expect, it } from 'vitest';
import { Board } from './Board';
import { Tetromino } from './Tetromino';
import type { Cell } from './types';

const emptyGrid = () => Array.from({ length: 20 }, () => Array<Cell>(10).fill(null));

describe('Board', () => {
  it('rejects walls, floor, and occupied cells but permits cells above the top', () => {
    const board = new Board();
    expect(board.canPlace(new Tetromino('O', -1, 0))).toBe(false);
    expect(board.canPlace(new Tetromino('O', 9, 0))).toBe(false);
    expect(board.canPlace(new Tetromino('O', 0, 19))).toBe(false);
    expect(board.canPlace(new Tetromino('O', 0, -1))).toBe(true);
    board.place(new Tetromino('O', 0, 0));
    expect(board.canPlace(new Tetromino('O', 0, 1))).toBe(false);
  });

  it('rejects a top-out without partially writing cells', () => {
    const board = new Board();
    expect(board.place(new Tetromino('O', 0, -1))).toBe(false);
    expect(board.snapshot().flat().every((cell) => cell === null)).toBe(true);
  });

  it('compacts multiple complete rows without disturbing other blocks', () => {
    const grid = emptyGrid();
    grid[19]!.fill('Z');
    grid[18]!.fill('J');
    grid[17]![2] = 'T';
    const board = new Board(10, 20, grid);
    expect(board.clearLines()).toBe(2);
    expect(board.snapshot()[19]![2]).toBe('T');
    expect(board.snapshot()[0]!.every((cell) => cell === null)).toBe(true);
    expect(board.clearLines()).toBe(0);
  });

  it('finds the landing position and preserves snapshot isolation', () => {
    const board = new Board();
    const landing = board.landingPosition(new Tetromino('I'));
    expect(landing.cells.every(({ y }) => y === 19)).toBe(true);
    const before = board.snapshot();
    board.place(landing);
    expect(before.flat().every((cell) => cell === null)).toBe(true);
    expect(board.snapshot().flat().filter(Boolean)).toHaveLength(4);
  });

  it('validates initial dimensions', () => {
    expect(() => new Board(10, 20, [[null]])).toThrow('dimensions');
  });
});

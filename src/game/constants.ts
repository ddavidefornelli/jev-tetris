import type { PieceType, Rotation } from './types.ts';

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const PREVIEW_COUNT = 5;
export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;
export const LINES_PER_LEVEL = 10;

export const PIECE_COLORS: Record<PieceType, string> = {
  I: '#69d8e8',
  O: '#f4ce69',
  T: '#b39af5',
  S: '#b8eb72',
  Z: '#f17e8c',
  J: '#779ff2',
  L: '#efa36d',
};

export const SHAPES: Record<PieceType, readonly (readonly number[])[]> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

type Kick = readonly [number, number];
type KickTable = Record<string, readonly Kick[]>;

// SRS offsets, converted from Cartesian coordinates to screen coordinates (y down).
const NORMAL_KICKS: KickTable = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

const I_KICKS: KickTable = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export function rotationKicks(type: PieceType, from: Rotation, to: Rotation): readonly Kick[] {
  return (type === 'I' ? I_KICKS : NORMAL_KICKS)[`${from}>${to}`] ?? [[0, 0]];
}

export function gravityInterval(level: number): number {
  return Math.max(70, 1000 * Math.pow(0.8, level - 1));
}

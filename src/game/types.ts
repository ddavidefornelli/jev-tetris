export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type PieceType = (typeof PIECE_TYPES)[number];
export type Rotation = 0 | 1 | 2 | 3;
export type Cell = PieceType | null;
export type Grid = ReadonlyArray<ReadonlyArray<Cell>>;
export type GamePhase = 'ready' | 'playing' | 'paused' | 'over';
export type GameCommand = 'left' | 'right' | 'down' | 'rotate-cw' | 'rotate-ccw' | 'drop' | 'hold' | 'pause' | 'start';
export type GameEvent = 'move' | 'rotate' | 'drop' | 'hold' | 'lock' | 'clear' | 'over' | 'start' | 'pause';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PieceView {
  readonly type: PieceType;
  /** Origin of the piece's shape matrix, not necessarily its leftmost occupied cell. */
  readonly x: number;
  readonly y: number;
  readonly rotation: Rotation;
  readonly cells: readonly Point[];
}

export interface LineClear {
  readonly id: number;
  readonly count: number;
  readonly label: string;
  readonly points: number;
}

/** Immutable public state. Rendering adapters never receive mutable engine objects. */
export interface GameSnapshot {
  readonly phase: GamePhase;
  readonly board: Grid;
  readonly active: PieceView | null;
  readonly ghost: PieceView | null;
  readonly next: readonly PieceType[];
  readonly hold: PieceType | null;
  readonly canHold: boolean;
  readonly score: number;
  readonly lines: number;
  readonly level: number;
  readonly combo: number;
  readonly backToBack: boolean;
  readonly lastClear: LineClear | null;
}

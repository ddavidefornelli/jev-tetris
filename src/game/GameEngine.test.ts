import { describe, expect, it, vi } from 'vitest';
import { BagRandomizer } from './BagRandomizer';
import { Board } from './Board';
import { GameEngine } from './GameEngine';
import type { Cell, PieceType } from './types';

class SequenceRandomizer extends BagRandomizer {
  private index = 0;
  constructor(private readonly sequence: PieceType[] = ['I', 'L', 'T', 'O', 'S', 'Z', 'J']) { super(); }
  override next(): PieceType { return this.sequence[this.index++ % this.sequence.length]!; }
  override reset(): void { this.index = 0; }
}

function engineWithGap(rows: number): GameEngine {
  return new GameEngine(new SequenceRandomizer(['I']), () => {
    const grid = Array.from({ length: 20 }, () => Array<Cell>(10).fill(null));
    for (let y = 20 - rows; y < 20; y++) {
      grid[y]!.fill('Z');
      grid[y]![5] = null;
    }
    return new Board(10, 20, grid);
  });
}

function groundPiece(engine: GameEngine): void {
  for (let i = 0; i < 19; i++) engine.command('down');
}

describe('GameEngine', () => {
  it('starts with stable ready state and five previews', () => {
    const engine = new GameEngine(new SequenceRandomizer());
    const state = engine.getSnapshot();
    expect(state.phase).toBe('ready');
    expect(state.next).toHaveLength(5);
    expect(engine.getSnapshot()).toBe(state);
    engine.command('left');
    expect(engine.getSnapshot()).toBe(state);
    engine.start();
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().active!.type).toBe('I');
    expect(engine.getSnapshot().next[0]).toBe('L');
  });

  it('uses timed gravity and stops time and commands while paused', () => {
    const engine = new GameEngine(new SequenceRandomizer());
    engine.start();
    const initial = engine.getSnapshot();
    engine.tick(999);
    expect(engine.getSnapshot()).toBe(initial);
    engine.tick(1);
    expect(engine.getSnapshot().active!.cells[0]!.y).toBe(initial.active!.cells[0]!.y + 1);
    engine.pause();
    const paused = engine.getSnapshot();
    engine.tick(2000);
    engine.command('drop');
    engine.command('hold');
    expect(engine.getSnapshot()).toBe(paused);
    engine.command('pause');
    expect(engine.getSnapshot().phase).toBe('playing');
  });

  it('scores soft/hard drops and locks at the ghost position', () => {
    const engine = new GameEngine(new SequenceRandomizer());
    engine.start();
    engine.command('down');
    expect(engine.getSnapshot().score).toBe(1);
    const ghost = engine.getSnapshot().ghost!;
    engine.command('drop');
    expect(engine.getSnapshot().score).toBe(37);
    for (const { x, y } of ghost.cells) expect(engine.getSnapshot().board[y]![x]).toBe('I');
    expect(engine.getSnapshot().active!.type).toBe('L');
  });

  it('allows one hold per piece and restores the held piece at spawn', () => {
    const engine = new GameEngine(new SequenceRandomizer());
    engine.start();
    engine.command('hold');
    const held = engine.getSnapshot();
    expect(held.hold).toBe('I');
    expect(held.active!.type).toBe('L');
    expect(held.canHold).toBe(false);
    engine.command('hold');
    expect(engine.getSnapshot()).toBe(held);
    engine.command('drop');
    expect(engine.getSnapshot().canHold).toBe(true);
    const queue = engine.getSnapshot().next;
    engine.command('hold');
    expect(engine.getSnapshot().active!.type).toBe('I');
    expect(engine.getSnapshot().hold).toBe('T');
    expect(engine.getSnapshot().next).toEqual(queue);
    expect(engine.getSnapshot().active!.cells.every(({ y }) => y === 0)).toBe(true);
  });

  it('kicks the I piece away from a wall when rotating', () => {
    const engine = new GameEngine(new SequenceRandomizer());
    engine.start();
    engine.command('rotate-cw');
    for (let i = 0; i < 8; i++) engine.command('left');
    expect(engine.getSnapshot().active!.cells.every(({ x }) => x === 0)).toBe(true);
    engine.command('rotate-ccw');
    expect(engine.getSnapshot().active!.cells.map(({ x }) => x).sort()).toEqual([0, 1, 2, 3]);
  });

  it('waits 500ms before locking a grounded piece', () => {
    const engine = new GameEngine(new SequenceRandomizer());
    engine.start();
    groundPiece(engine);
    engine.tick(499);
    expect(engine.getSnapshot().board.flat().filter(Boolean)).toHaveLength(0);
    engine.tick(1);
    expect(engine.getSnapshot().board.flat().filter(Boolean)).toHaveLength(4);
    expect(engine.getSnapshot().active!.type).toBe('L');
  });

  it('limits grounded lock-delay resets to 15 adjustments', () => {
    const engine = new GameEngine(new SequenceRandomizer());
    engine.start();
    groundPiece(engine);
    for (let i = 0; i < 15; i++) {
      engine.tick(400);
      engine.command(i % 2 === 0 ? 'left' : 'right');
    }
    engine.tick(400);
    engine.command('right');
    engine.tick(100);
    expect(engine.getSnapshot().board.flat().filter(Boolean)).toHaveLength(4);
  });

  it.each([[1, 100], [2, 300], [3, 500], [4, 800]])('scores %i cleared rows with %i base points', (rows, base) => {
    const engine = engineWithGap(rows);
    engine.start();
    engine.command('rotate-cw');
    engine.command('drop');
    expect(engine.getSnapshot().lines).toBe(rows);
    expect(engine.getSnapshot().lastClear!.points).toBe(base);
    expect(engine.getSnapshot().score).toBe(base + 34);
  });

  it('awards back-to-back and combo bonuses, and levels up after ten lines', () => {
    const engine = engineWithGap(12);
    engine.start();
    for (let i = 0; i < 3; i++) {
      engine.command('rotate-cw');
      engine.command('drop');
    }
    expect(engine.getSnapshot().lines).toBe(12);
    expect(engine.getSnapshot().level).toBe(2);
    expect(engine.getSnapshot().combo).toBe(2);
    expect(engine.getSnapshot().score).toBe(3452);
    expect(engine.getSnapshot().lastClear!.points).toBe(1300);
  });

  it('ends on a blocked spawn, ignores commands, and can restart cleanly', () => {
    const engine = new GameEngine(new SequenceRandomizer());
    engine.start();
    for (let i = 0; i < 100 && engine.getSnapshot().phase === 'playing'; i++) engine.command('drop');
    expect(engine.getSnapshot().phase).toBe('over');
    expect(engine.getSnapshot().active).toBeNull();
    const over = engine.getSnapshot();
    engine.command('down');
    expect(engine.getSnapshot()).toBe(over);
    engine.command('start');
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().score).toBe(0);
    expect(engine.getSnapshot().board.flat().filter(Boolean)).toHaveLength(0);
  });

  it('notifies subscribers, emits semantic events, and supports cleanup', () => {
    const engine = new GameEngine(new SequenceRandomizer());
    const listener = vi.fn();
    const eventListener = vi.fn();
    const unsubscribe = engine.subscribe(listener);
    const unsubscribeEvents = engine.subscribeEvents(eventListener);
    engine.start();
    engine.command('left');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(eventListener).toHaveBeenCalledWith('start');
    expect(eventListener).toHaveBeenCalledWith('move');
    unsubscribe();
    unsubscribeEvents();
    engine.command('right');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(eventListener).toHaveBeenCalledTimes(2);
  });

  it('ignores non-finite and negative time inputs', () => {
    const engine = new GameEngine(new SequenceRandomizer());
    engine.start();
    const snapshot = engine.getSnapshot();
    for (const delta of [NaN, Infinity, -1, 0]) engine.tick(delta);
    expect(engine.getSnapshot()).toBe(snapshot);
  });
});

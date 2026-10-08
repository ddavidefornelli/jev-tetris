import { describe, expect, it } from 'vitest';
import { BagRandomizer } from '../game/BagRandomizer';
import { Board } from '../game/Board';
import { GameEngine } from '../game/GameEngine';
import { PIECE_TYPES } from '../game/types';
import type { Cell, PieceType } from '../game/types';
import { parseDecision, MAX_PLAN_ACTIONS } from './protocol';
import { measureBoard, TetrisPlacementPlanner } from './TetrisPlacementPlanner';

class FixedRandomizer extends BagRandomizer {
  constructor(private readonly type: PieceType) { super(); }
  override next(): PieceType { return this.type; }
  override reset() {}
}
const planner = new TetrisPlacementPlanner();

function replay(engine: GameEngine, actions: readonly string[]) {
  for (const action of actions) {
    const before = engine.getSnapshot();
    engine.command(action as Parameters<GameEngine['command']>[0]);
    expect(engine.getSnapshot()).not.toBe(before);
  }
}

describe('reachable placement planner', () => {
  it.each(PIECE_TYPES)('offers finite, executable %s plans with accurate final boards and scores', type => {
    const engine = new GameEngine(new FixedRandomizer(type)); engine.start();
    const options = planner.plan(engine.getSnapshot());
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(8);
    expect(options[0]!.nextPieceBest).not.toBeNull();
    for (const option of options) {
      expect(option.actions.length).toBeLessThanOrEqual(MAX_PLAN_ACTIONS);
      expect(option.keys.at(-1)).toBe('Space');
      expect(parseDecision({ actions: option.actions })).toEqual({ actions: option.actions });
      const simulation = new GameEngine(new FixedRandomizer(type)); simulation.start();
      replay(simulation, option.actions);
      const after = simulation.getSnapshot();
      expect(after.phase).toBe('playing');
      expect(after.board.map(row => row.map(cell => cell ?? '.').join(''))).toEqual(option.boardRowsAfter);
      expect(after.lines).toBe(option.linesCleared);
      expect(after.score).toBe(option.points);
      expect(measureBoard(after.board)).toEqual(option.metrics);
    }
  });

  it('moves and rotates an I piece into a four-row well, then actually clears a Tetris', () => {
    const grid = Array.from({ length: 20 }, () => Array<Cell>(10).fill(null));
    for (let y = 16; y < 20; y++) for (let x = 0; x < 9; x++) grid[y]![x] = 'Z';
    const engine = new GameEngine(new FixedRandomizer('I'), () => new Board(10, 20, grid)); engine.start();
    const option = planner.plan(engine.getSnapshot())[0]!;
    expect(option.linesCleared).toBe(4);
    expect(option.actions.some(action => action.startsWith('rotate'))).toBe(true);
    expect(option.actions.some(action => action === 'left' || action === 'right')).toBe(true);
    replay(engine, option.actions);
    expect(engine.getSnapshot().lines).toBe(4);
    expect(engine.getSnapshot().backToBack).toBe(true);
    expect(engine.getSnapshot().board.flat().filter(Boolean)).toHaveLength(0);
    expect(engine.getSnapshot().lastClear?.label).toBe('TETRIS');
  });

  it('uses exactly the same SRS wall kicks as the real engine', () => {
    const makeEngine = () => {
      const engine = new GameEngine(new FixedRandomizer('I')); engine.start();
      engine.command('rotate-cw');
      for (let n = 0; n < 8; n++) engine.command('left');
      return engine;
    };
    const options = planner.plan(makeEngine().getSnapshot());
    expect(options.some(option => option.actions.includes('rotate-ccw') || option.actions.includes('rotate-cw'))).toBe(true);
    for (const option of options) {
      const engine = makeEngine();
      replay(engine, option.actions);
      expect(engine.getSnapshot().board.map(row => row.map(cell => cell ?? '.').join(''))).toEqual(option.boardRowsAfter);
    }
  });

  it('never offers a second hold or a top-out placement', () => {
    const engine = new GameEngine(new FixedRandomizer('T')); engine.start(); engine.command('hold');
    expect(planner.plan(engine.getSnapshot()).every(option => !option.actions.includes('hold'))).toBe(true);
    const grid = Array.from({ length: 20 }, () => Array<Cell>(10).fill('Z'));
    const over = new GameEngine(new FixedRandomizer('T'), () => new Board(10, 20, grid)); over.start();
    expect(planner.plan(over.getSnapshot())).toEqual([]);
  });
});

describe('bounded plan validation', () => {
  it.each([
    { actions: [] }, { actions: ['rotate-cw'] }, { actions: ['drop', 'left', 'drop'] }, { actions: ['left', 'hold', 'drop'] },
    { actions: ['pause', 'drop'] }, { actions: ['delete', 'drop'] }, { actions: [...Array(65).fill('left'), 'drop'] },
  ])('rejects invalid/non-committing plan %j', ({ actions }) => {
    expect(() => parseDecision({ actions })).toThrow('Invalid AI plan');
  });
  it('rejects an ambiguous action and plan', () => {
    expect(() => parseDecision({ action: 'left', actions: ['drop'] })).toThrow('Invalid AI plan');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../game/GameEngine';
import { BagRandomizer } from '../game/BagRandomizer';
import { AiPlayer } from './AiPlayer';
import type { AiDecision } from './protocol';
import { TetrisPlacementPlanner } from './TetrisPlacementPlanner';

const flush = async () => { for (let n = 0; n < 8; n++) await Promise.resolve(); };

function setup() {
  const engine = new GameEngine(new BagRandomizer(() => 0));
  engine.start();
  let resolve!: (value: AiDecision) => void;
  const pending = new Promise<AiDecision>(yes => { resolve = yes; });
  const decide = vi.fn(() => pending);
  const player = new AiPlayer(engine, { decide });
  player.start(); player.update(0);
  return { engine, player, decide, resolve };
}

describe('committed AI placement execution', () => {
  it('rotates, moves, and locks without requesting another decision between keys', async () => {
    const { engine, player, decide, resolve } = setup();
    resolve({ actions: ['rotate-cw', 'left', 'left', 'drop'] });
    await flush();
    expect(engine.getSnapshot().active?.rotation).toBe(1);
    player.update(60); player.update(120); player.update(180);
    expect(engine.getSnapshot().board.flat().filter(Boolean)).toHaveLength(4);
    expect(decide).toHaveBeenCalledTimes(1);
    expect(player.getSnapshot().error).toBeNull();
    player.update(379); expect(decide).toHaveBeenCalledTimes(1);
    player.update(380); expect(decide).toHaveBeenCalledTimes(2);
    player.stop(); await flush();
  });

  it.each(['stop', 'pause', 'restart', 'manual input'])('discards the remaining plan after %s', async mode => {
    const { engine, player, decide, resolve } = setup();
    resolve({ actions: ['left', 'right', 'drop'] }); await flush();
    decide.mockImplementation(() => new Promise(() => {}));
    if (mode === 'stop') player.stop();
    if (mode === 'pause') engine.pause();
    if (mode === 'restart') engine.start();
    if (mode === 'manual input') engine.command('down');
    const state = engine.getSnapshot();
    player.update(60); player.update(120);
    expect(engine.getSnapshot()).toBe(state);
    expect(state.board.flat().filter(Boolean)).toHaveLength(0);
    player.stop();
  });

  it('stops a blocked plan instead of endlessly spinning', async () => {
    const { engine, player, resolve } = setup();
    for (let n = 0; n < 10; n++) engine.command('left');
    // Request a new decision for the changed state.
    player.update(200);
    player.stop(); player.start(); player.update(200);
    resolve({ actions: ['left', 'drop'] }); await flush();
    expect(player.getSnapshot().enabled).toBe(false);
    expect(player.getSnapshot().error).toContain('became blocked');
    expect(engine.getSnapshot().board.flat().filter(Boolean)).toHaveLength(0);
  });

  it('continues across many pieces, moving, locking, and clearing rows', async () => {
    const engine = new GameEngine(new BagRandomizer(() => 0));
    const planner = new TetrisPlacementPlanner();
    let locked = 0;
    const commands: string[] = [];
    engine.subscribeEvents(event => { commands.push(event); if (event === 'drop') locked++; });
    const decide = vi.fn(async state => ({ actions: planner.plan(state)[0]!.actions }));
    const player = new AiPlayer(engine, { decide });
    player.start();
    for (let step = 0; step < 1500 && locked < 40 && player.getSnapshot().enabled; step++) {
      player.update(step * 200); await flush();
    }
    expect(player.getSnapshot().error).toBeNull();
    expect(locked).toBe(40);
    expect(decide).toHaveBeenCalledTimes(40);
    expect(commands).toContain('move');
    expect(commands).toContain('rotate');
    expect(engine.getSnapshot().lines).toBeGreaterThan(0);
    expect(engine.getSnapshot().phase).toBe('playing');
    player.stop();
  });
});

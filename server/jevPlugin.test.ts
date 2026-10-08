import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JevDecisionService } from './JevDecisionService';
import { jevPlugin, parseState } from './jevPlugin';
import { GameEngine } from '../src/game/GameEngine';

vi.mock('./JevDecisionService', () => ({
  JevDecisionService: vi.fn(class { decide = vi.fn(); }),
  JevRequestError: class extends Error {},
  JevPlanningError: class extends Error {},
}));

describe('game snapshot validation', () => {
  it('preserves every public game field and strips unrelated client fields', () => {
    const engine = new GameEngine(); engine.start(); engine.command('drop');
    const snapshot = engine.getSnapshot();
    const parsed = parseState({ ...snapshot, injected: 'not part of the game', active: { ...snapshot.active, injected: true } });
    expect(parsed).toEqual(snapshot);
    expect(parsed).not.toHaveProperty('injected');
    expect(parsed.active).not.toHaveProperty('injected');
  });

  it('rejects invalid piece geometry and scoring metadata', () => {
    const engine = new GameEngine(); engine.start();
    const snapshot = engine.getSnapshot();
    for (const change of [
      { active: { ...snapshot.active, rotation: 4 } },
      { active: { ...snapshot.active, x: NaN } },
      { combo: -2 }, { backToBack: 'yes' },
      { lastClear: { id: 1, count: 5, label: 'BAD', points: 100 } },
      { lastClear: undefined },
    ]) expect(() => parseState({ ...snapshot, ...change })).toThrow('Invalid game state');
  });
});

describe('Jev bridge configuration', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('defaults to the official TypeSafe endpoint and current model alias', () => {
    jevPlugin({ JEV_API_KEY: 'test-key' });
    expect(JevDecisionService).toHaveBeenCalledWith({
      apiKey: 'test-key',
      endpoint: 'https://api.typesafe.ai/v1/systemone',
      model: 'jev-latest',
      timeoutMs: 10000,
    });
  });

  it('honors explicit provider configuration', () => {
    jevPlugin({ JEV_API_KEY: 'test-key', JEV_API_URL: 'https://example.com/decision', JEV_MODEL: 'custom-model' });
    expect(JevDecisionService).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'https://example.com/decision', model: 'custom-model',
    }));
  });
});

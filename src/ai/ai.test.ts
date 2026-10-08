import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../game/GameEngine';
import { BagRandomizer } from '../game/BagRandomizer';
import { Tetromino } from '../game/Tetromino';
import { GAMEPLAY_BINDINGS, gameplayCommandForKey, KEY_MAP } from '../input/bindings';
import { AiPlayer } from './AiPlayer';
import { JevAiClient } from './JevAiClient';
import { parseDecision } from './protocol';
import type { AiDecision } from './protocol';
import { TetrisPromptBuilder } from './TetrisPromptBuilder';
import { JevDecisionService } from '../../server/JevDecisionService';

function deferred() {
  let resolve!: (value: AiDecision) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AiDecision>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('AI player', () => {
  it.each(Object.entries(GAMEPLAY_BINDINGS))('executes gameplay key %s exactly like human input', async (key, binding) => {
    const engine = new GameEngine(new BagRandomizer(() => 0));
    const humanEngine = new GameEngine(new BagRandomizer(() => 0));
    engine.start(); humanEngine.start();
    engine.command('right'); humanEngine.command('right');
    const player = new AiPlayer(engine, { decide: async () => ({ action: gameplayCommandForKey(key) }) });
    player.start(); player.update(0);
    humanEngine.command(KEY_MAP[key]!);
    await vi.waitFor(() => expect(player.getSnapshot().thinking).toBe(false));
    expect(player.getSnapshot().error).toBeNull();
    expect(engine.getSnapshot()).toEqual(humanEngine.getSnapshot());
    expect(KEY_MAP[key]).toBe(binding.command);
  });

  it('starts a game, serializes requests and applies an action', async () => {
    const engine = new GameEngine();
    const pending = deferred();
    const decide = vi.fn(() => pending.promise);
    const player = new AiPlayer(engine, { decide });
    player.start();
    const original = engine.getSnapshot();
    player.update(0);
    player.update(1000);
    expect(decide).toHaveBeenCalledTimes(1);
    expect(player.getSnapshot().thinking).toBe(true);
    pending.resolve({ action: 'drop' });
    await flush();
    expect(engine.getSnapshot()).not.toBe(original);
    expect(engine.getSnapshot().board.flat().filter(Boolean)).toHaveLength(4);
    expect(player.getSnapshot().thinking).toBe(false);
  });

  it.each(['stop', 'pause', 'restart'] as const)('ignores a stale answer after %s', async mode => {
    const engine = new GameEngine();
    const pending = deferred();
    const player = new AiPlayer(engine, { decide: () => pending.promise });
    player.start();
    player.update(0);
    if (mode === 'stop') player.stop();
    if (mode === 'pause') engine.pause();
    if (mode === 'restart') engine.start();
    const state = engine.getSnapshot();
    pending.resolve({ action: 'drop' });
    await flush();
    expect(engine.getSnapshot()).toBe(state);
  });

  it('aborts on pause and resumes with a new request', async () => {
    const engine = new GameEngine();
    const pending = deferred();
    const decide = vi.fn((_state, signal: AbortSignal) => { expect(signal.aborted).toBe(false); return pending.promise; });
    const player = new AiPlayer(engine, { decide });
    player.start(); player.update(0);
    engine.pause(); player.update(50);
    expect(decide.mock.calls[0]?.[1].aborted).toBe(true);
    engine.command('pause'); player.update(300);
    expect(decide).toHaveBeenCalledTimes(2);
    player.stop();
  });

  it('stops safely on failure without retrying paid requests', async () => {
    const engine = new GameEngine();
    const player = new AiPlayer(engine, { decide: async () => { throw new Error('Offline'); } });
    player.start(); player.update(0);
    await flush();
    expect(player.getSnapshot()).toEqual({ enabled: false, thinking: false, error: 'Offline' });
    expect(engine.getSnapshot().board.flat().every(cell => cell === null)).toBe(true);
  });
});

describe('Jev protocol and prompts', () => {
  it('rejects arbitrary or administrative commands', () => {
    for (const action of ['pause', 'start', 'delete', null, undefined]) {
      expect(() => parseDecision({ action })).toThrow('Invalid AI action');
    }
    expect(parseDecision({ action: 'rotate-cw' })).toEqual({ action: 'rotate-cw' });
  });

  it('sends the complete snapshot and geometry of the ordered next and held pieces', () => {
    const engine = new GameEngine(); engine.start(); engine.command('drop'); engine.command('hold');
    engine.command('right'); engine.command('rotate-cw');
    const snapshot = engine.getSnapshot();
    const prompt = new TetrisPromptBuilder().build(snapshot);
    expect(prompt.state).toMatchObject(snapshot);
    expect(prompt.state.board).toHaveLength(20);
    expect(prompt.state.board[0]).toEqual(Array(10).fill(null));
    expect(prompt.state.board.flat().filter(Boolean)).toHaveLength(4);
    expect(prompt.state.boardRows[0]).toBe('..........');
    expect(prompt.state.active?.cells).toHaveLength(4);
    expect(prompt.state.active).toHaveProperty('rotation');
    expect(prompt.state.active).toHaveProperty('x');
    expect(prompt.state.active).toHaveProperty('y');
    expect(prompt.state.nextPieces.map(piece => piece.type)).toEqual(snapshot.next);
    prompt.state.nextPieces.forEach((piece, index) => {
      expect(piece.queueIndex).toBe(index);
      expect(piece).toMatchObject(new Tetromino(snapshot.next[index]!).toView());
      expect(piece.shape.flat().filter(Boolean)).toHaveLength(4);
    });
    expect(prompt.state.holdPiece).toMatchObject(new Tetromino(snapshot.hold!).toView());
    expect(prompt.state.placements.every(option => !option.usesHold)).toBe(true);
    expect(prompt.state.controls.KeyC?.available).toBe(false);
    expect(prompt.questions.move.instructions.length).toBeLessThan(1000);
  });

  it('makes long-term big wins an explicit state objective', () => {
    const engine = new GameEngine(); engine.start();
    const prompt = new TetrisPromptBuilder().build(engine.getSnapshot());
    expect(prompt.state.objective).toContain('long-term total score');
    expect(prompt.state.objective).toContain('four-line Tetrises');
    expect(prompt.state.objective).toContain('Do not clear a single row as soon as possible');
    expect(prompt.questions.move.instructions).toContain('state.objective');
  });

  it('keeps every gameplay key but offers only complete reachable placements', () => {
    const engine = new GameEngine(); engine.start();
    const prompt = new TetrisPromptBuilder().build(engine.getSnapshot());
    expect(Object.keys(prompt.state.controls)).toEqual(Object.keys(GAMEPLAY_BINDINGS));
    expect(Object.keys(prompt.questions.move.criteria)).toEqual(prompt.state.placements.map(option => option.id));
    expect(prompt.state.placements.length).toBeGreaterThan(0);
    expect(prompt.state.placements.every(option => option.actions.at(-1) === 'drop')).toBe(true);
    for (const [key, binding] of Object.entries(GAMEPLAY_BINDINGS)) {
      expect(gameplayCommandForKey(key)).toBe(binding.command);
      for (const alias of binding.aliases) {
        expect(gameplayCommandForKey(alias)).toBe(binding.command);
        expect(KEY_MAP[alias]).toBe(KEY_MAP[key]);
      }
    }
    for (const invalid of ['Enter', 'Escape', 'KeyP', 'drop', '__proto__', 'delete', null]) {
      expect(() => gameplayCommandForKey(invalid)).toThrow('Invalid AI key');
    }
  });

  it('uses the documented choice API and server-only authorization', async () => {
    const engine = new GameEngine(); engine.start();
    const transport = vi.fn(async () => new Response(JSON.stringify({ answers: { move: { type: 'choice', choice: 'place_0' } } })));
    const service = new JevDecisionService({ apiKey: 'secret-test-key', endpoint: 'https://api.typesafe.ai/v1/systemone', model: 'jev-latest', timeoutMs: 1000 }, transport);
    const decision = await service.decide(engine.getSnapshot(), new AbortController().signal);
    expect(decision).toEqual({ actions: new TetrisPromptBuilder().build(engine.getSnapshot()).state.placements[0]!.actions });
    const args = transport.mock.calls as unknown as [string, RequestInit][];
    expect(args[0]![0]).toBe('https://api.typesafe.ai/v1/systemone');
    const request = args[0]![1];
    expect(request.headers).toHaveProperty('Authorization', 'Bearer secret-test-key');
    expect(JSON.parse(request.body as string)).toMatchObject({
      model: 'jev-latest',
      state: engine.getSnapshot(),
      questions: { move: { type: 'choice', criteria: { place_0: expect.any(String) } } },
    });
  });

  it('logs every valid Jev move in the server and browser consoles', async () => {
    const engine = new GameEngine(); engine.start();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const service = new JevDecisionService(
        { apiKey: 'test-key', endpoint: 'https://api.typesafe.ai/v1/systemone', model: 'jev-latest', timeoutMs: 1000 },
        async () => new Response(JSON.stringify({ answers: { move: { type: 'choice', choice: 'place_0' } } })),
      );
      const client = new JevAiClient('/api/jev/decision', async () => new Response(JSON.stringify({ action: 'drop' })));
      for (let i = 0; i < 2; i++) {
        await service.decide(engine.getSnapshot(), new AbortController().signal);
        await client.decide(engine.getSnapshot(), new AbortController().signal);
      }
      expect(log).toHaveBeenCalledTimes(4);
      expect(log).toHaveBeenNthCalledWith(1, '[Jev placement]', 'place_0', '→', expect.any(String));
      expect(log).toHaveBeenNthCalledWith(2, '[Jev move]', 'drop');
      expect(log).toHaveBeenNthCalledWith(3, '[Jev placement]', 'place_0', '→', expect.any(String));
      expect(log).toHaveBeenNthCalledWith(4, '[Jev move]', 'drop');
    } finally {
      log.mockRestore();
    }
  });

  it.each(['Escape', 'Enter', 'drop', 'not-a-key'])('rejects provider choice %s rather than executing it', async key => {
    const engine = new GameEngine(); engine.start();
    const transport = vi.fn(async () => new Response(JSON.stringify({ answers: { move: { type: 'choice', choice: key } } })));
    const service = new JevDecisionService({ apiKey: 'test-key', endpoint: 'https://api.typesafe.ai/v1/systemone', model: 'jev-latest', timeoutMs: 1000 }, transport);
    await expect(service.decide(engine.getSnapshot(), new AbortController().signal)).rejects.toThrow('Invalid Jev placement');
  });

  it('rejects an isolated hold key instead of accepting a placement', async () => {
    const engine = new GameEngine(); engine.start(); engine.command('hold');
    const transport = vi.fn(async () => new Response(JSON.stringify({ answers: { move: { type: 'choice', choice: 'KeyC' } } })));
    const service = new JevDecisionService({ apiKey: 'test-key', endpoint: 'https://api.typesafe.ai/v1/systemone', model: 'jev-latest', timeoutMs: 1000 }, transport);
    await expect(service.decide(engine.getSnapshot(), new AbortController().signal)).rejects.toThrow('Invalid Jev placement');
  });

  it.each([
    [401, 'Jev authentication failed. Check JEV_API_KEY and JEV_API_URL'],
    [403, 'Jev authentication failed. Check JEV_API_KEY and JEV_API_URL'],
    [402, 'Jev balance is insufficient'],
    [429, 'Jev rate limit reached'],
    [503, 'Jev upstream request failed'],
  ])('reports safe diagnostics for upstream HTTP %s', async (status, message) => {
    const engine = new GameEngine(); engine.start();
    const transport = vi.fn(async () => new Response('private provider details', { status }));
    const service = new JevDecisionService({ apiKey: 'secret-test-key', endpoint: 'https://api.typesafe.ai/v1/systemone', model: 'jev-latest', timeoutMs: 1000 }, transport);
    await expect(service.decide(engine.getSnapshot(), new AbortController().signal)).rejects.toThrow(`${message}`);
  });

  it('binds the default browser fetch to the global receiver', async () => {
    const engine = new GameEngine(); engine.start();
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(async function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return new Response(JSON.stringify({ action: 'drop' }));
    });
    try {
      const client = new JevAiClient();
      expect(await client.decide(engine.getSnapshot(), new AbortController().signal)).toEqual({ action: 'drop' });
      expect(transport).toHaveBeenCalledTimes(1);
    } finally {
      transport.mockRestore();
    }
  });

  it('browser client calls only the local bridge and validates replies', async () => {
    const engine = new GameEngine(); engine.start();
    const transport = vi.fn(async () => new Response(JSON.stringify({ action: 'drop' })));
    const client = new JevAiClient('/api/jev/decision', transport);
    expect(await client.decide(engine.getSnapshot(), new AbortController().signal)).toEqual({ action: 'drop' });
    const args = transport.mock.calls as unknown as [string, RequestInit][];
    expect(args[0]![0]).toBe('/api/jev/decision');
    expect(args[0]![1].headers).not.toHaveProperty('Authorization');
  });
});

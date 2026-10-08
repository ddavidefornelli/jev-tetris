import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../game/GameEngine';
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

  it('encodes locked board separately and excludes unavailable hold', () => {
    const engine = new GameEngine(); engine.start(); engine.command('hold');
    const prompt = new TetrisPromptBuilder().build(engine.getSnapshot());
    expect(prompt.state.board).toHaveLength(20);
    expect(prompt.state.board[0]).toBe('..........');
    expect(prompt.state.active?.cells).toHaveLength(4);
    expect(prompt.questions.move.criteria).not.toHaveProperty('hold');
    expect(prompt.questions.move.instructions.length).toBeLessThan(1000);
  });

  it('uses the documented choice API and server-only authorization', async () => {
    const engine = new GameEngine(); engine.start();
    const transport = vi.fn(async () => new Response(JSON.stringify({ answers: { move: { type: 'choice', choice: 'drop' } } })));
    const service = new JevDecisionService({ apiKey: 'secret-test-key', endpoint: 'https://jev-ai.org/api/v1/systemone/', model: 'jev-1.13', timeoutMs: 1000 }, transport);
    expect(await service.decide(engine.getSnapshot(), new AbortController().signal)).toEqual({ action: 'drop' });
    const args = transport.mock.calls as unknown as [string, RequestInit][];
    const request = args[0]![1];
    expect(request.headers).toHaveProperty('Authorization', 'Bearer secret-test-key');
    expect(JSON.parse(request.body as string)).toMatchObject({ model: 'jev-1.13', questions: { move: { type: 'choice' } } });
  });

  it.each([
    [401, 'Jev rejected the API key'],
    [402, 'Jev balance is insufficient'],
    [429, 'Jev rate limit reached'],
    [503, 'Jev upstream request failed'],
  ])('reports safe diagnostics for upstream HTTP %s', async (status, message) => {
    const engine = new GameEngine(); engine.start();
    const transport = vi.fn(async () => new Response('private provider details', { status }));
    const service = new JevDecisionService({ apiKey: 'secret-test-key', endpoint: 'https://jev-ai.org/api/v1/systemone/', model: 'jev-1.13', timeoutMs: 1000 }, transport);
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

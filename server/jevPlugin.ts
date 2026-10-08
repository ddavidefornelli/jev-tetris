import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { PIECE_TYPES } from '../src/game/types.ts';
import type { GameSnapshot, PieceView } from '../src/game/types.ts';
import { JevDecisionService, JevRequestError, JevPlanningError } from './JevDecisionService.ts';

function validPiece(piece: PieceView | null): boolean {
  return piece === null || (typeof piece === 'object' && PIECE_TYPES.includes(piece.type) &&
    Number.isInteger(piece.x) && piece.x >= -4 && piece.x <= 14 &&
    Number.isInteger(piece.y) && piece.y >= -4 && piece.y <= 24 &&
    Number.isInteger(piece.rotation) && piece.rotation >= 0 && piece.rotation <= 3 &&
    Array.isArray(piece.cells) && piece.cells.length === 4 && piece.cells.every(p => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= -4 && p.x <= 14 && p.y >= -4 && p.y <= 24));
}

export function parseState(value: unknown): GameSnapshot {
  const s = value as GameSnapshot | null;
  if (!s || s.phase !== 'playing' || !Array.isArray(s.board) || s.board.length !== 20 ||
    !s.board.every(row => Array.isArray(row) && row.length === 10 && row.every(cell => cell === null || PIECE_TYPES.includes(cell))) ||
    !s.active || !validPiece(s.active) || !validPiece(s.ghost) ||
    !Array.isArray(s.next) || s.next.length > 10 || !s.next.every(p => PIECE_TYPES.includes(p)) ||
    !(s.hold === null || PIECE_TYPES.includes(s.hold)) || typeof s.canHold !== 'boolean' ||
    ![s.score, s.lines, s.level].every(n => Number.isFinite(n) && n >= 0) ||
    !Number.isInteger(s.combo) || s.combo < -1 || typeof s.backToBack !== 'boolean' ||
    !(s.lastClear === null || (typeof s.lastClear === 'object' &&
      Number.isInteger(s.lastClear.id) && s.lastClear.id > 0 &&
      Number.isInteger(s.lastClear.count) && s.lastClear.count >= 1 && s.lastClear.count <= 4 &&
      typeof s.lastClear.label === 'string' && s.lastClear.label.length <= 32 &&
      Number.isFinite(s.lastClear.points) && s.lastClear.points >= 0))) throw new Error('Invalid game state');
  // Whitelist snapshot fields before spreading state into the provider prompt.
  const piece = (p: PieceView | null): PieceView | null => p && ({
    type: p.type, x: p.x, y: p.y, rotation: p.rotation,
    cells: p.cells.map(({ x, y }) => ({ x, y })),
  });
  return {
    phase: s.phase, board: s.board, active: piece(s.active), ghost: piece(s.ghost),
    next: s.next, hold: s.hold, canHold: s.canHold,
    score: s.score, lines: s.lines, level: s.level, combo: s.combo, backToBack: s.backToBack,
    lastClear: s.lastClear && { id: s.lastClear.id, count: s.lastClear.count, label: s.lastClear.label, points: s.lastClear.points },
  };
}

/** Local dev/preview bridge. Production hosts can reuse the service in an authenticated route. */
export function jevPlugin(env: Record<string, string>): Plugin {
  const timeoutMs = Number(env.JEV_TIMEOUT_MS || 10000);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 12000) throw new Error('JEV_TIMEOUT_MS must be between 1 and 12000');
  const endpoint = env.JEV_API_URL || 'https://api.typesafe.ai/v1/systemone';
  if (new URL(endpoint).protocol !== 'https:') throw new Error('JEV_API_URL must use HTTPS');
  const service = new JevDecisionService({ apiKey: env.JEV_API_KEY || '', endpoint, model: env.JEV_MODEL || 'jev-latest', timeoutMs });
  let inFlight = false;
  let lastRequest = 0;
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split('?')[0] !== '/api/jev/decision') { next(); return; }
    const reply = (status: number, body: unknown) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') { reply(405, { error: 'POST required' }); return; }
    // Reject cross-origin browser calls and bound local paid API usage.
    let sameOrigin = true;
    try { sameOrigin = !req.headers.origin || new URL(req.headers.origin).host === req.headers.host; }
    catch { sameOrigin = false; }
    if (!sameOrigin || req.headers['sec-fetch-site'] === 'cross-site') {
      reply(403, { error: 'Cross-origin requests forbidden' }); return;
    }
    if (inFlight || Date.now() - lastRequest < 100) { reply(429, { error: 'AI request limit reached' }); return; }
    inFlight = true;
    lastRequest = Date.now();
    const controller = new AbortController();
    const onClose = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', onClose);
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 16384) { reply(413, { error: 'Request too large' }); return; }
      }
      let state: GameSnapshot;
      try { state = parseState((JSON.parse(body) as { state?: unknown }).state); }
      catch { reply(400, { error: 'Invalid game state' }); return; }
      reply(200, await service.decide(state, controller.signal));
    } catch (error) {
      const message = error instanceof JevRequestError || error instanceof JevPlanningError || (error instanceof Error && error.message.startsWith('Set JEV_API_KEY'))
        ? error.message
        : error instanceof Error && error.name === 'TimeoutError'
          ? `Jev request timed out after ${timeoutMs} ms. Increase JEV_TIMEOUT_MS in .env (maximum 12000) and restart the server.`
          : 'Jev decision failed. Check credentials, quota, and connection.';
      reply(502, { error: message });
    } finally {
      inFlight = false;
      res.off('close', onClose);
    }
  };
  return {
    name: 'jev-ai-bridge',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

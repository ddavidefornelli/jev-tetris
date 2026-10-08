import { ArrowRight, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import { BOARD_HEIGHT, BOARD_WIDTH, PIECE_COLORS } from '../game/constants';
import type { GameSnapshot, PieceType } from '../game/types';

const DEMO_ROWS = [
  '..........', '..........', '..........', '..........', '..........',
  '..........', '..........', '..........', '..........', '..........',
  '..........', '..........', '..........', '..........', '..........',
  '..........', '.T........', 'TTT....L..', 'JJ..SS.L..', '.J.SS.LL..',
];

interface GameBoardProps {
  state: GameSnapshot;
  onStart: () => void;
  onResume: () => void;
}

export function GameBoard({ state, onStart, onResume }: GameBoardProps) {
  const active = new Map(state.active?.cells.map(({ x, y }) => [`${x}:${y}`, state.active!.type]));
  const ghost = new Map(state.ghost?.cells.map(({ x, y }) => [`${x}:${y}`, state.ghost!.type]));
  const isReady = state.phase === 'ready';
  const phaseLabel = { ready: 'STANDBY', playing: 'LIVE', paused: 'PAUSED', over: 'GAME OVER' }[state.phase];
  const covered = state.phase !== 'playing';

  return (
    <section className="board-column" aria-label="Tetris playfield">
      <div className="board-frame">
        <div className="board-topline"><span className="eyebrow">PLAYFIELD <span className="board-dimensions">10 × 20</span></span><span className={`game-status ${state.phase}`}><i />{phaseLabel}</span></div>
        <div className="playfield-wrap">
          <div className="playfield" role="img" aria-label={`Tetris board. ${phaseLabel.toLowerCase()}. ${state.lines} lines cleared.`}>
            {Array.from({ length: BOARD_HEIGHT * BOARD_WIDTH }, (_, index) => {
              const x = index % BOARD_WIDTH;
              const y = Math.floor(index / BOARD_WIDTH);
              const coordinate = `${x}:${y}`;
              const demo = isReady ? DEMO_ROWS[y]?.[x] : '.';
              const type = active.get(coordinate) ?? state.board[y]?.[x] ?? (demo && demo !== '.' ? demo as PieceType : null);
              const ghostType = !type ? ghost.get(coordinate) : null;
              return (
                <div key={index} className="board-cell">
                  {(type || ghostType) && <span className={type ? 'block-cube' : 'ghost-cube'} style={{ '--piece-color': PIECE_COLORS[(type ?? ghostType)!] } as CSSProperties} />}
                </div>
              );
            })}
          </div>
          {state.lastClear && !covered && (
            <div key={state.lastClear.id} className="clear-toast" aria-live="polite">
              <Sparkles size={16} /><strong>{state.lastClear.label}</strong><span>+{state.lastClear.points}</span>
            </div>
          )}
          {covered && (
            <div className={`board-overlay ${isReady ? 'ready-overlay' : ''}`}>
              <div className="overlay-symbol">{isReady ? <Play size={21} fill="currentColor" /> : state.phase === 'paused' ? <Pause size={23} /> : <RotateCcw size={24} />}</div>
              <span className="overlay-eyebrow">{isReady ? 'A CLASSIC. A FRESH START.' : state.phase === 'paused' ? 'RIGHT WHERE YOU LEFT OFF' : 'THERE’S ALWAYS ANOTHER ROUND'}</span>
              <h2>{isReady ? <>Find your<br />flow.</> : state.phase === 'paused' ? <>Take a<br />breather.</> : <>Nice<br />run.</>}</h2>
              <p>{isReady ? 'One piece at a time.' : state.phase === 'paused' ? 'Your next move can wait.' : `${state.score.toLocaleString('en-US')} points. Ready to beat it?`}</p>
              <button className="primary-button" onClick={state.phase === 'paused' ? onResume : onStart}>
                {isReady ? 'Let’s play' : state.phase === 'paused' ? 'Keep going' : 'Play again'}<ArrowRight size={16} />
              </button>
              <span className="overlay-shortcut">or press <kbd>{state.phase === 'paused' ? 'esc' : 'enter'}</kbd></span>
            </div>
          )}
        </div>
        <div className="board-bottomline"><span className="flex items-center gap-1.5"><span className="ghost-indicator" />Ghost piece enabled</span><span className="font-mono">{state.phase === 'playing' ? 'GOOD LUCK, HAVE FUN' : 'MAKE A LITTLE SPACE'}</span></div>
      </div>
      <p className="board-caption"><span />{state.phase === 'playing' ? 'Clear lines. Find rhythm. Keep going.' : 'A little focus. A lot of falling blocks.'}</p>
    </section>
  );
}

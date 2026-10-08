import { Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import { BOARD_HEIGHT, BOARD_WIDTH, PIECE_COLORS } from '../game/constants';
import type { GameSnapshot } from '../game/types';

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
              const type = active.get(coordinate) ?? state.board[y]?.[x];
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
              <h2>{isReady ? 'TETRIS' : state.phase === 'paused' ? 'PAUSED' : 'GAME OVER'}</h2>
              <button className="primary-button" onClick={state.phase === 'paused' ? onResume : onStart}>
                {isReady ? 'START' : state.phase === 'paused' ? 'RESUME' : 'PLAY AGAIN'}
              </button>
              <span className="overlay-shortcut"><kbd>{state.phase === 'paused' ? 'ESC' : 'ENTER'}</kbd></span>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}

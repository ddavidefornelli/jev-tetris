import { LINES_PER_LEVEL } from '../game/constants';
import type { GameSnapshot } from '../game/types';

export function ScorePanel({ state, best }: { state: GameSnapshot; best: number }) {
  const progress = state.lines % LINES_PER_LEVEL;
  return (
    <aside className="score-column" aria-label="Game statistics">
      <div className="score-card panel">
        <div className="eyebrow">SCORE</div>
        <div className="score-number font-mono tabular-nums">{String(state.score).padStart(6, '0')}</div>
        <div className="best-score"><span>HI-SCORE</span><strong className="font-mono tabular-nums">{best.toLocaleString('en-US')}</strong></div>
      </div>
      <div className="level-card panel">
        <div className="flex items-center justify-between"><span className="eyebrow">LEVEL</span><span className="level-value font-mono">{String(state.level).padStart(2, '0')}</span></div>
        <div className="level-progress" role="progressbar" aria-label="Progress to next level" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={LINES_PER_LEVEL}>
          {Array.from({ length: LINES_PER_LEVEL }, (_, i) => <span key={i} className={i < progress ? 'filled' : ''} />)}
        </div>
        <div className="lines-row"><span className="eyebrow">LINES</span><span className="font-mono text-xl text-foreground">{String(state.lines).padStart(2, '0')}</span></div>
      </div>
    </aside>
  );
}

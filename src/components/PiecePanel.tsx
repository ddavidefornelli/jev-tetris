import type { GameSnapshot } from '../game/types';
import { PiecePreview } from './PiecePreview';

export function PiecePanel({ state }: { state: GameSnapshot }) {
  return (
    <aside className="piece-column" aria-label="Held and upcoming pieces">
      <section className="hold-card panel">
        <div className="flex items-center justify-between"><h2 className="eyebrow">HOLD</h2><kbd>C</kbd></div>
        <div className="hold-preview"><PiecePreview type={state.hold} size={24} muted={!state.canHold} /></div>
      </section>
      <section className="next-card panel">
        <div className="flex justify-between items-center mb-3"><h2 className="eyebrow">NEXT</h2><span className="queue-count">05</span></div>
        <ol className="preview-list">
          {state.next.map((type, index) => (
            <li key={index} className={index === 0 ? 'next-first' : ''}>
              <span className="font-mono queue-index">{String(index + 1).padStart(2, '0')}</span>
              <PiecePreview type={type} size={index === 0 ? 22 : 18} />
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

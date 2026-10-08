import type { CSSProperties } from 'react';
import { PIECE_COLORS } from '../game/constants';
import { Tetromino } from '../game/Tetromino';
import type { PieceType } from '../game/types';

interface PiecePreviewProps {
  type: PieceType | null;
  size?: number;
  muted?: boolean;
}

export function PiecePreview({ type, size = 20, muted = false }: PiecePreviewProps) {
  if (!type) return <div className="empty-hold" aria-label="No held piece"><span>+</span></div>;
  const cells = new Tetromino(type, 0, 0).cells;
  const minX = Math.min(...cells.map(({ x }) => x));
  const minY = Math.min(...cells.map(({ y }) => y));
  const width = Math.max(...cells.map(({ x }) => x)) - minX + 1;
  const height = Math.max(...cells.map(({ y }) => y)) - minY + 1;
  return (
    <div
      role="img"
      aria-label={`${type} piece`}
      className={`piece-preview ${muted ? 'opacity-35' : ''}`}
      style={{ width: width * size, height: height * size }}
    >
      {cells.map(({ x, y }) => (
        <span
          key={`${x}:${y}`}
          className="block-cube absolute"
          style={{
            '--piece-color': PIECE_COLORS[type],
            width: size - 2, height: size - 2,
            left: (x - minX) * size, top: (y - minY) * size,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

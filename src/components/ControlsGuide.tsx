import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';

export function ControlsGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`controls-guide ${compact ? 'controls-compact' : ''}`}>
      <div className="control-row"><span>Move</span><div><kbd><ArrowLeft size={12} /></kbd><kbd><ArrowRight size={12} /></kbd></div></div>
      <div className="control-row"><span>Rotate</span><div><kbd><ArrowUp size={12} /></kbd><kbd>Z</kbd></div></div>
      <div className="control-row"><span>Soft drop</span><div><kbd><ArrowDown size={12} /></kbd></div></div>
      <div className="control-row"><span>Hard drop</span><div><kbd className="wide-key">space</kbd></div></div>
      <div className="control-row"><span>Hold piece</span><div><kbd>C</kbd></div></div>
      <div className="control-row"><span>Pause</span><div><kbd className="wide-key">esc</kbd></div></div>
    </div>
  );
}

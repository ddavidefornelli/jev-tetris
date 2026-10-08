import { ArrowDown, ArrowDownToLine, ArrowLeft, ArrowRight, RotateCw, ScanLine } from 'lucide-react';
import { useRef } from 'react';
import type { GameCommand } from '../game/types';

export function TouchControls({ onCommand, disabled }: { onCommand: (command: GameCommand) => void; disabled: boolean }) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const buttons = [
    { command: 'hold' as const, icon: ScanLine, label: 'Hold' },
    { command: 'left' as const, icon: ArrowLeft, label: 'Left' },
    { command: 'rotate-cw' as const, icon: RotateCw, label: 'Rotate' },
    { command: 'right' as const, icon: ArrowRight, label: 'Right' },
    { command: 'down' as const, icon: ArrowDown, label: 'Down' },
    { command: 'drop' as const, icon: ArrowDownToLine, label: 'Drop' },
  ];
  return (
    <div className="touch-controls" aria-label="Touch controls">
      {buttons.map(({ command, icon: Icon, label }) => (
        <button
          key={command}
          disabled={disabled}
          aria-label={label}
          className={command === 'drop' ? 'touch-drop' : ''}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            stop();
            onCommand(command);
            if (command === 'left' || command === 'right' || command === 'down') {
              timer.current = setInterval(() => onCommand(command), command === 'down' ? 50 : 100);
            }
          }}
          onPointerUp={stop}
          onPointerCancel={stop}
          onLostPointerCapture={stop}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onCommand(command); } }}
        ><Icon size={19} /><span>{label}</span></button>
      ))}
    </div>
  );
}

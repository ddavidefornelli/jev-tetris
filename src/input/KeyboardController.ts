import type { GameEngine } from '../game/GameEngine';
import type { GameCommand } from '../game/types';

const KEY_MAP: Record<string, GameCommand> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  ArrowUp: 'rotate-cw', KeyW: 'rotate-cw', KeyX: 'rotate-cw',
  KeyZ: 'rotate-ccw', Space: 'drop',
  KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
  Escape: 'pause', KeyP: 'pause', Enter: 'start',
};

interface HeldKey {
  command: GameCommand;
  elapsed: number;
  nextRepeat: number;
}

/** Browser input adapter with consistent delayed auto-shift, independent of OS key repeat. */
export class KeyboardController {
  private held = new Map<string, HeldKey>();

  constructor(private readonly engine: GameEngine) {}

  attach(): () => void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.held.clear();
    };
  }

  update(deltaMs: number): void {
    if (this.engine.getSnapshot().phase !== 'playing') {
      this.held.clear();
      return;
    }
    for (const key of this.held.values()) {
      key.elapsed += deltaMs;
      while (key.elapsed >= key.nextRepeat) {
        this.engine.command(key.command);
        key.nextRepeat += key.command === 'down' ? 35 : 45;
      }
    }
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
    // Preserve native activation when keyboard users focus a button or link.
    if ((event.code === 'Space' || event.code === 'Enter') && target instanceof HTMLElement && target.closest('button, a')) return;
    const command = KEY_MAP[event.code];
    if (!command) return;
    event.preventDefault();
    if (event.repeat || this.held.has(event.code)) return;
    this.engine.command(command);
    if (command === 'left' || command === 'right' || command === 'down') {
      // The most recently pressed horizontal direction takes precedence.
      if (command !== 'down') {
        for (const [code, key] of this.held) if (key.command !== 'down') this.held.delete(code);
      }
      this.held.set(event.code, { command, elapsed: 0, nextRepeat: command === 'down' ? 35 : 150 });
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.held.clear();
    this.engine.pause();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.onBlur();
  };
}

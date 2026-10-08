import type { GameEvent } from '../game/types';

/** Optional synthesized effects: no external assets, and audio is created only after interaction. */
export class AudioManager {
  private context: AudioContext | null = null;
  enabled = false;

  play(event: GameEvent): void {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
      const notes: Record<GameEvent, readonly number[]> = {
        move: [180], rotate: [320], drop: [120, 80], hold: [300, 450],
        lock: [150], clear: [440, 554, 659, 880], over: [330, 262, 196],
        start: [330, 440, 660], pause: [240],
      };
      notes[event].forEach((frequency, index) => {
        const context = this.context!;
        const start = context.currentTime + index * 0.065;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = event === 'drop' || event === 'lock' ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.035, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.1);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch {
      // Unsupported or blocked audio must never interrupt gameplay.
    }
  }

  dispose(): void {
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}

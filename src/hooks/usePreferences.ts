import { useEffect, useState } from 'react';
import { AudioManager } from '../audio/AudioManager';
import type { GameEngine } from '../game/GameEngine';

function readNumber(key: string): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch { return 0; }
}

function save(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* Private browsing or full storage. */ }
}

export function useBestScore(score: number): number {
  const [best, setBest] = useState(() => readNumber('blockshift.best'));
  useEffect(() => {
    if (score > best) {
      setBest(score);
      save('blockshift.best', String(score));
    }
  }, [score, best]);
  return Math.max(best, score);
}

export function useSound(engine: GameEngine) {
  const [enabled, setEnabled] = useState(() => readNumber('blockshift.sound') === 1);
  const [audio] = useState(() => new AudioManager());

  useEffect(() => {
    audio.enabled = enabled;
    save('blockshift.sound', enabled ? '1' : '0');
    return engine.subscribeEvents((event) => audio.play(event));
  }, [audio, enabled, engine]);

  useEffect(() => () => audio.dispose(), [audio]);

  return { enabled, toggle: () => setEnabled((current) => !current) };
}

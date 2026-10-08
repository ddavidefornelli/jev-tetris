import { useEffect, useState, useSyncExternalStore } from 'react';
import { GameEngine } from '../game/GameEngine';
import { KeyboardController } from '../input/KeyboardController';

export function useGame() {
  const [engine] = useState(() => new GameEngine());
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  useEffect(() => {
    const keyboard = new KeyboardController(engine);
    const detach = keyboard.attach();
    let frame = 0;
    let previous: number | null = null;
    const loop = (now: number) => {
      const delta = previous === null ? 0 : Math.min(now - previous, 100);
      previous = now;
      keyboard.update(delta);
      engine.tick(delta);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); detach(); };
  }, [engine]);

  return { engine, state };
}

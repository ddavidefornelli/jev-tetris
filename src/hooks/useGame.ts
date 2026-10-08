import { useEffect, useState, useSyncExternalStore } from 'react';
import { GameEngine } from '../game/GameEngine';
import { KeyboardController } from '../input/KeyboardController';
import { AiPlayer } from '../ai/AiPlayer';
import { JevAiClient } from '../ai/JevAiClient';

export function useGame() {
  const [engine] = useState(() => new GameEngine());
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [aiPlayer] = useState(() => new AiPlayer(engine, new JevAiClient()));
  const aiState = useSyncExternalStore(aiPlayer.subscribe, aiPlayer.getSnapshot);

  useEffect(() => {
    const keyboard = new KeyboardController(engine, () => !aiPlayer.getSnapshot().enabled);
    const detach = keyboard.attach();
    let frame = 0;
    let previous: number | null = null;
    const loop = (now: number) => {
      const delta = previous === null ? 0 : Math.min(now - previous, 100);
      previous = now;
      keyboard.update(delta);
      if (aiPlayer.getSnapshot().enabled) aiPlayer.update(now);
      else engine.tick(delta);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); detach(); aiPlayer.stop(); };
  }, [engine, aiPlayer]);

  return { engine, state, aiPlayer, aiState };
}

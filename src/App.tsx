import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { GameBoard } from './components/GameBoard';
import { PiecePanel } from './components/PiecePanel';
import { ScorePanel } from './components/ScorePanel';
import { TouchControls } from './components/TouchControls';
import { useGame } from './hooks/useGame';
import { useBestScore, useSound } from './hooks/usePreferences';

export function App() {
  const { engine, state, aiPlayer, aiState } = useGame();
  const best = useBestScore(state.score);
  const sound = useSound(engine);
  const isRunning = state.phase === 'playing' || state.phase === 'paused';

  const start = () => { engine.start(); (document.activeElement as HTMLElement | null)?.blur(); };
  const resume = () => { engine.command('pause'); (document.activeElement as HTMLElement | null)?.blur(); };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a href="/" className="brand" aria-label="Blockshift home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>block<span className="text-accent">shift</span><span className="brand-period">.</span></span>
        </a>
        <div className="header-actions">
          <button className={`header-button sound-button ${sound.enabled ? 'sound-enabled' : ''}`} onClick={sound.toggle} aria-label={sound.enabled ? 'Mute sound' : 'Enable sound'} aria-pressed={sound.enabled}>
            {sound.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>Sound {sound.enabled ? 'on' : 'off'}</span>
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="session-toolbar">
          <div className="flex items-center gap-4">
            <button className="toolbar-button" disabled={!isRunning} onClick={resume} aria-label={state.phase === 'paused' ? 'Resume game' : 'Pause game'}>{state.phase === 'paused' ? <Play size={13} /> : <Pause size={13} />}<span>{state.phase === 'paused' ? 'Resume' : 'Pause'}</span></button>
            <button className="toolbar-button" disabled={state.phase === 'ready'} onClick={start} aria-label="Restart game"><RotateCcw size={13} /><span>Restart</span></button>
          </div>
        </div>

        <div className="game-layout">
          <ScorePanel state={state} best={best} />
          <GameBoard state={state} onStart={start} onResume={resume} />
          <PiecePanel state={state} />
        </div>
        <TouchControls disabled={state.phase !== 'playing' || aiState.enabled} onCommand={(command) => engine.command(command)} />
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <button className="toolbar-button" aria-pressed={aiState.enabled} onClick={() => { if (aiState.enabled) aiPlayer.stop(); else aiPlayer.start(); }}>
            {aiState.enabled ? 'AI: ON' : 'AI: OFF'}
          </button>
          <span role="status" className="text-xs text-muted">{aiState.error ?? (aiState.enabled ? (state.phase === 'paused' ? 'PAUSED' : aiState.thinking ? 'THINKING…' : 'PLAYING') : '')}</span>
        </div>
      </main>

    </div>
  );
}

import { ArrowUpRight, CircleHelp, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { useRef } from 'react';
import { ControlsGuide } from './components/ControlsGuide';
import { GameBoard } from './components/GameBoard';
import { PiecePanel } from './components/PiecePanel';
import { ScorePanel } from './components/ScorePanel';
import { TouchControls } from './components/TouchControls';
import { useGame } from './hooks/useGame';
import { useBestScore, useSound } from './hooks/usePreferences';

export function App() {
  const { engine, state } = useGame();
  const best = useBestScore(state.score);
  const sound = useSound(engine);
  const help = useRef<HTMLDialogElement>(null);
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
          <span className="header-divider" />
          <button className="header-button" onClick={() => { engine.pause(); help.current?.showModal(); }}><CircleHelp size={16} /><span>How to play</span></button>
        </div>
      </header>

      <main className="main-content">
        <div className="intro">
          <div><div className="eyebrow intro-eyebrow"><span />YOUR FIVE-MINUTE RESET</div><h1>Less noise. <span>More play.</span></h1></div>
          <div className="mode-label"><span className="mode-icon"><ArrowUpRight size={14} /></span><div><strong>Marathon</strong><span>Endless possibilities</span></div></div>
        </div>

        <div className="session-toolbar">
          <span className="eyebrow">THE ORIGINAL FALLING-BLOCK OBSESSION</span>
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
        <TouchControls disabled={state.phase !== 'playing'} onCommand={(command) => engine.command(command)} />
      </main>

      <footer className="site-footer"><span>NO ADS. NO ACCOUNTS. <span className="text-soft">JUST BLOCKS.</span></span><span className="footer-right"><i />BUILT FOR THE JOY OF IT.</span></footer>

      <dialog ref={help} className="help-dialog" aria-labelledby="help-title" onClick={(event) => { if (event.target === event.currentTarget) help.current?.close(); }}>
        <div className="help-content">
          <button className="dialog-close" aria-label="Close instructions" onClick={() => help.current?.close()}><X size={20} /></button>
          <span className="eyebrow text-accent">EASY TO START. HARD TO PUT DOWN.</span>
          <h2 id="help-title">A little block wisdom.</h2>
          <p>Fit falling pieces together. Fill a complete horizontal row to clear it. Keep the stack from reaching the top.</p>
          <ControlsGuide />
          <div className="help-tips"><p><strong>See your next move.</strong> The outline shows where your piece will land. Space drops it there instantly.</p><p><strong>Save a piece.</strong> Press C or Shift to hold. You can swap once per falling piece.</p><p><strong>Find your rhythm.</strong> Every 10 cleared lines speeds things up. Clear four at once for a Tetris and 800 × your level points.</p></div>
          <p className="help-alternatives">Also works with A / D to move, W / X to rotate, S to drop, and P to pause. Enter starts a new game.</p>
          <button className="primary-button w-full" onClick={() => help.current?.close()}>Got it. Let’s play.<ArrowUpRight size={16} /></button>
        </div>
      </dialog>
    </div>
  );
}

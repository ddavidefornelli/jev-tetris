import { BagRandomizer } from './BagRandomizer';
import { Board } from './Board';
import { gravityInterval, LINES_PER_LEVEL, LOCK_DELAY_MS, MAX_LOCK_RESETS, PREVIEW_COUNT, rotationKicks } from './constants';
import { Tetromino } from './Tetromino';
import type { GameCommand, GameEvent, GamePhase, GameSnapshot, LineClear, PieceType } from './types';

type Listener = () => void;
type EventListener = (event: GameEvent) => void;

/**
 * Framework-independent state machine. Time and commands are explicit inputs;
 * snapshots and semantic events are outputs. No DOM, timers, or persistence.
 */
export class GameEngine {
  private board: Board;
  private phase: GamePhase = 'ready';
  private active: Tetromino | null = null;
  private queue: PieceType[] = [];
  private held: PieceType | null = null;
  private holdUsed = false;
  private score = 0;
  private lines = 0;
  private combo = -1;
  private backToBack = false;
  private lastClear: LineClear | null = null;
  private clearId = 0;
  private gravityTime = 0;
  private lockTime = 0;
  private lockResets = 0;
  private readonly listeners = new Set<Listener>();
  private readonly eventListeners = new Set<EventListener>();
  private snapshot: GameSnapshot;

  constructor(
    private readonly randomizer = new BagRandomizer(),
    private readonly boardFactory: () => Board = () => new Board(),
  ) {
    this.board = boardFactory();
    this.fillQueue();
    this.snapshot = this.createSnapshot();
  }

  // Arrow functions are stable, bound adapters for useSyncExternalStore.
  readonly getSnapshot = (): GameSnapshot => this.snapshot;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly subscribeEvents = (listener: EventListener): (() => void) => {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  };

  start(): void {
    this.board = this.boardFactory();
    this.randomizer.reset();
    this.queue = [];
    this.held = null;
    this.score = 0;
    this.lines = 0;
    this.combo = -1;
    this.backToBack = false;
    this.lastClear = null;
    this.holdUsed = false;
    this.phase = 'playing';
    this.fillQueue();
    this.spawn();
    this.emit('start');
    this.publish();
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.emit('pause');
    this.publish();
  }

  command(command: GameCommand): void {
    if (command === 'start') {
      if (this.phase === 'ready' || this.phase === 'over') this.start();
      return;
    }
    if (command === 'pause') {
      if (this.phase === 'paused') {
        this.phase = 'playing';
        this.publish();
      } else this.pause();
      return;
    }
    if (this.phase !== 'playing' || !this.active) return;

    let changed = false;
    switch (command) {
      case 'left': changed = this.move(-1, 0); break;
      case 'right': changed = this.move(1, 0); break;
      case 'down':
        changed = this.move(0, 1);
        if (changed) {
          this.score += 1;
          this.gravityTime = 0;
        }
        break;
      case 'rotate-cw': changed = this.rotate(1); break;
      case 'rotate-ccw': changed = this.rotate(-1); break;
      case 'drop': {
        const landing = this.board.landingPosition(this.active);
        this.score += (landing.y - this.active.y) * 2;
        this.active = landing;
        this.emit('drop');
        this.lock();
        changed = true;
        break;
      }
      case 'hold':
        if (!this.holdUsed) {
          const outgoing = this.active.type;
          if (this.held) this.spawn(this.held);
          else this.spawn();
          this.held = outgoing;
          this.holdUsed = true;
          this.emit('hold');
          changed = true;
        }
        break;
    }
    if (changed) this.publish();
  }

  /** Small simulation steps make gravity and lock delay independent of frame rate. */
  tick(deltaMs: number): void {
    if (this.phase !== 'playing' || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    let remaining = Math.min(deltaMs, 2000);
    let changed = false;
    while (remaining > 0 && this.phase === 'playing' && this.active) {
      const step = Math.min(remaining, 16);
      remaining -= step;
      const wasGrounded = !this.board.canPlace(this.active.move(0, 1));
      this.gravityTime += step;
      const interval = gravityInterval(this.level);
      while (this.gravityTime >= interval && this.active) {
        this.gravityTime -= interval;
        if (this.board.canPlace(this.active.move(0, 1))) {
          this.active = this.active.move(0, 1);
          this.lockTime = 0;
          changed = true;
        } else {
          this.gravityTime = 0;
          break;
        }
      }
      if (this.active && !this.board.canPlace(this.active.move(0, 1))) {
        if (wasGrounded) this.lockTime += step;
        if (this.lockTime >= LOCK_DELAY_MS) {
          this.lock();
          changed = true;
        }
      } else this.lockTime = 0;
    }
    if (changed) this.publish();
  }

  private get level(): number {
    return Math.floor(this.lines / LINES_PER_LEVEL) + 1;
  }

  private move(dx: number, dy: number): boolean {
    if (!this.active) return false;
    const candidate = this.active.move(dx, dy);
    if (!this.board.canPlace(candidate)) return false;
    this.resetLockOnAdjustment();
    this.active = candidate;
    if (dy !== 0) this.lockTime = 0;
    this.emit('move');
    return true;
  }

  private rotate(direction: 1 | -1): boolean {
    if (!this.active || this.active.type === 'O') return false;
    const rotated = this.active.rotate(direction);
    for (const [dx, dy] of rotationKicks(this.active.type, this.active.rotation, rotated.rotation)) {
      const candidate = rotated.move(dx, dy);
      if (this.board.canPlace(candidate)) {
        this.resetLockOnAdjustment();
        this.active = candidate;
        this.emit('rotate');
        return true;
      }
    }
    return false;
  }

  private resetLockOnAdjustment(): void {
    if (this.active && !this.board.canPlace(this.active.move(0, 1)) && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTime = 0;
      this.lockResets += 1;
    }
  }

  private lock(): void {
    if (!this.active) return;
    if (!this.board.place(this.active)) {
      this.endGame();
      return;
    }
    const count = this.board.clearLines();
    if (count > 0) {
      this.combo += 1;
      const base = [0, 100, 300, 500, 800][count]! * this.level;
      const bonus = count === 4 && this.backToBack ? base * 0.5 : 0;
      const points = base + bonus + Math.max(0, this.combo) * 50 * this.level;
      this.score += points;
      this.lastClear = {
        id: ++this.clearId,
        count,
        label: ['','SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'][count]!,
        points,
      };
      this.lines += count;
      this.backToBack = count === 4;
      this.emit('clear');
    } else {
      this.combo = -1;
      this.emit('lock');
    }
    this.holdUsed = false;
    this.spawn();
  }

  private spawn(type?: PieceType): void {
    const nextType = type ?? this.queue.shift()!;
    this.fillQueue();
    this.active = new Tetromino(nextType);
    this.gravityTime = 0;
    this.lockTime = 0;
    this.lockResets = 0;
    if (!this.board.canPlace(this.active)) this.endGame();
  }

  private fillQueue(): void {
    while (this.queue.length < PREVIEW_COUNT) this.queue.push(this.randomizer.next());
  }

  private endGame(): void {
    this.phase = 'over';
    this.active = null;
    this.emit('over');
  }

  private createSnapshot(): GameSnapshot {
    return {
      phase: this.phase,
      board: this.board.snapshot(),
      active: this.active?.toView() ?? null,
      ghost: this.active ? this.board.landingPosition(this.active).toView() : null,
      next: [...this.queue],
      hold: this.held,
      canHold: !this.holdUsed,
      score: this.score,
      lines: this.lines,
      level: this.level,
      combo: this.combo,
      lastClear: this.lastClear,
    };
  }

  private publish(): void {
    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener();
  }

  private emit(event: GameEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }
}

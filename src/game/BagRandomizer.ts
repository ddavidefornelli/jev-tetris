import { PIECE_TYPES, type PieceType } from './types';

/** Every seven draws contain each piece exactly once. RNG injection enables deterministic tests. */
export class BagRandomizer {
  private bag: PieceType[] = [];

  constructor(private readonly random: () => number = Math.random) {}

  next(): PieceType {
    if (this.bag.length === 0) {
      this.bag = [...PIECE_TYPES];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j]!, this.bag[i]!];
      }
    }
    return this.bag.pop()!;
  }

  reset(): void {
    this.bag = [];
  }
}

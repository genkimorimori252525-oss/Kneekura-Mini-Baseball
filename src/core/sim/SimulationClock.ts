export class SimulationClock {
  private currentTick = 0;

  constructor(readonly ticksPerSecond: number) {
    if (!Number.isInteger(ticksPerSecond) || ticksPerSecond <= 0) {
      throw new Error('ticksPerSecond must be a positive integer');
    }
  }

  get tick(): number {
    return this.currentTick;
  }

  get timeSeconds(): number {
    return this.currentTick / this.ticksPerSecond;
  }

  advanceTicks(count = 1): void {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('count must be a non-negative integer');
    }
    this.currentTick += count;
  }
}

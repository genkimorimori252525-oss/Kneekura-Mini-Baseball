import { DeterministicRng, fmix32, fnv1a32 } from './DeterministicRng';

export type CorePhase =
  | 'pitch'
  | 'recognition'
  | 'batting'
  | 'contact'
  | 'batted_ball'
  | 'fielding'
  | 'baserunning'
  | 'perception'
  | 'rules';

export class SeedRoot {
  constructor(readonly matchSeed: number) {}

  playSeed(playId: number): number {
    return fmix32((this.matchSeed ^ Math.imul(playId + 1, 0x9e3779b9)) >>> 0);
  }

  phaseSeed(playId: number, phase: CorePhase): number {
    return fmix32((this.playSeed(playId) ^ fnv1a32(phase)) >>> 0);
  }

  phaseRng(playId: number, phase: CorePhase): DeterministicRng {
    return new DeterministicRng(this.phaseSeed(playId, phase));
  }

  streamSeed(playId: number, phase: CorePhase, streamKey: string): number {
    return fmix32((this.phaseSeed(playId, phase) ^ fnv1a32(streamKey)) >>> 0);
  }

  streamRng(playId: number, phase: CorePhase, streamKey: string): DeterministicRng {
    return new DeterministicRng(this.streamSeed(playId, phase, streamKey));
  }
}

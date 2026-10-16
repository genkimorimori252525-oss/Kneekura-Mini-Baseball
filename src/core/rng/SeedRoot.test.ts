import { describe, expect, it } from 'vitest';
import { DeterministicRng } from './DeterministicRng';
import { SeedRoot } from './SeedRoot';

describe('deterministic RNG', () => {
  it('repeats the same uint32 sequence for the same seed', () => {
    const a = new DeterministicRng(123456789);
    const b = new DeterministicRng(123456789);
    expect([a.nextUint32(), a.nextUint32(), a.nextUint32()]).toEqual([
      b.nextUint32(), b.nextUint32(), b.nextUint32(),
    ]);
  });

  it('keeps one phase independent from draw counts in another phase', () => {
    const root = new SeedRoot(77);
    const fieldingA = root.phaseRng(12, 'fielding');
    const batting = root.phaseRng(12, 'batting');
    batting.nextUint32();
    batting.nextUint32();
    batting.nextUint32();
    const fieldingB = root.phaseRng(12, 'fielding');
    expect(fieldingA.nextUint32()).toBe(fieldingB.nextUint32());
  });

  it('separates play ids', () => {
    const root = new SeedRoot(77);
    expect(root.phaseSeed(1, 'fielding')).not.toBe(root.phaseSeed(2, 'fielding'));
  });
});

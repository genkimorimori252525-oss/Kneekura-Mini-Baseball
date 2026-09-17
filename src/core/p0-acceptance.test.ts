import { describe, expect, it } from 'vitest';
import { SeedRoot, SimulationClock, type CanonicalWorldSnapshot, type DefenderWorldState } from './index';

function defender(index: number): DefenderWorldState {
  return {
    playerId: `fielder-${index}`,
    registeredPosition: index === 7 ? 'CF' : 'SS',
    position: index === 7 ? { x: 1.5, z: 31 } : { x: index, z: 20 + index },
    velocity: { x: 0, z: 0 },
    assignment: { kind: 'hold' },
  };
}

function fixture(matchSeed: number): { snapshot: CanonicalWorldSnapshot; draw: number } {
  const clock = new SimulationClock(120);
  clock.advanceTicks(48);
  const snapshot: CanonicalWorldSnapshot = {
    tick: clock.tick,
    defenders: Array.from({ length: 9 }, (_, index) => defender(index)),
    runners: [],
    ball: null,
  };
  const draw = new SeedRoot(matchSeed).phaseRng(3, 'fielding').nextUint32();
  return { snapshot, draw };
}

describe('P0 shared Core acceptance', () => {
  it('repeats the same Core-visible result for the same seed and input', () => {
    expect(fixture(20260917)).toEqual(fixture(20260917));
  });

  it('keeps all nine defenders and permits a shifted CF', () => {
    const { snapshot } = fixture(20260917);
    expect(snapshot.defenders).toHaveLength(9);
    expect(snapshot.defenders[7]).toMatchObject({ registeredPosition: 'CF', position: { x: 1.5, z: 31 } });
  });
});

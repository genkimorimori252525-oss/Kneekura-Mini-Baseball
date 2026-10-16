import { describe, expect, it } from 'vitest';
import type { CanonicalWorldSnapshot, DefenderWorldState } from './CanonicalWorldSnapshot';

const defender = (playerId: string): DefenderWorldState => ({
  playerId,
  registeredPosition: 'CF',
  position: { x: 0, z: 0 },
  velocity: { x: 0, z: 0 },
  assignment: { kind: 'hold' },
});

describe('canonical world contract', () => {
  it('represents all nine defenders independently from registered positions', () => {
    const defenders = Array.from({ length: 9 }, (_, index) => defender(`p${index}`));
    const snapshot: CanonicalWorldSnapshot = { tick: 0, defenders, runners: [], ball: null };
    expect(snapshot.defenders).toHaveLength(9);
  });

  it('allows a CF to occupy an arbitrary world coordinate', () => {
    const shifted = { ...defender('cf'), position: { x: 2.5, z: 33.0 } };
    expect(shifted.registeredPosition).toBe('CF');
    expect(shifted.position).toEqual({ x: 2.5, z: 33.0 });
  });
});

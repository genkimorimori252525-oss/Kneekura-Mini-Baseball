import { describe, expect, it } from 'vitest';
import {
  createDefensiveAlignment,
} from './DefensiveAlignment';
import {
  createDefenderWorldStatesFromAlignment,
} from './DefensiveAlignmentWorldAdapter';

describe('DefensiveAlignmentWorldAdapter', () => {
  it('projects chosen pre-pitch coordinates into canonical defender world states without changing registration', () => {
    const alignment = createDefensiveAlignment([
      { playerId: 'p', registeredPosition: 'P', start: { x: 0, z: 18 } },
      { playerId: 'c', registeredPosition: 'C', start: { x: 0, z: -2 } },
      { playerId: '1b', registeredPosition: '1B', start: { x: 18, z: 20 } },
      { playerId: '2b', registeredPosition: '2B', start: { x: 5, z: 23 } },
      { playerId: '3b', registeredPosition: '3B', start: { x: -20, z: 20 } },
      { playerId: 'ss', registeredPosition: 'SS', start: { x: -8, z: 24 } },
      { playerId: 'lf', registeredPosition: 'LF', start: { x: -30, z: 55 } },
      { playerId: 'cf', registeredPosition: 'CF', start: { x: 0, z: 21 } },
      { playerId: 'rf', registeredPosition: 'RF', start: { x: 30, z: 55 } },
    ]);

    const states = createDefenderWorldStatesFromAlignment(
      alignment,
    );

    expect(states).toHaveLength(9);
    expect(states.find(
      (state) => state.playerId === 'cf',
    )).toEqual({
      playerId: 'cf',
      registeredPosition: 'CF',
      position: { x: 0, z: 21 },
      velocity: { x: 0, z: 0 },
      assignment: { kind: 'hold' },
    });
  });
});

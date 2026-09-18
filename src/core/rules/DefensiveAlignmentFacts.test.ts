import { describe, expect, it } from 'vitest';
import {
  createDefenderFootPlacementFact,
  createSecondBaseDivisionReference,
} from './DefensiveAlignmentFacts';

describe('DefensiveAlignmentFacts', () => {
  it('creates authoritative left/right foot placement for any defender role', () => {
    expect(createDefenderFootPlacementFact(
      'cf',
      'CF',
      2_000_000,
      { x: 0.2, z: 30 },
      { x: 0.4, z: 30 },
    )).toEqual({
      kind: 'defender_foot_placement',
      playerId: 'cf',
      registeredPosition: 'CF',
      tick: 2_000_000,
      leftFoot: { x: 0.2, z: 30 },
      rightFoot: { x: 0.4, z: 30 },
    });
  });

  it('creates an explicit second-base division reference without assuming world axes', () => {
    expect(createSecondBaseDivisionReference(
      { x: 10, z: 20 },
      { x: 0, z: 1 },
    )).toEqual({
      secondBaseCenter: { x: 10, z: 20 },
      firstBaseSideUnit: { x: 0, z: 1 },
    });
  });

  it('rejects non-unit division normals and invalid physical facts', () => {
    expect(() => createSecondBaseDivisionReference(
      { x: 0, z: 0 },
      { x: 2, z: 0 },
    )).toThrow('firstBaseSideUnit must be a unit vector');

    expect(() => createDefenderFootPlacementFact(
      '',
      'SS',
      2_000_000,
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    )).toThrow('playerId must not be empty');

    expect(() => createDefenderFootPlacementFact(
      'ss',
      'SS',
      -1,
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    )).toThrow('foot-placement tick must be a non-negative safe integer');

    expect(() => createDefenderFootPlacementFact(
      'ss',
      'SS',
      2_000_000,
      { x: Number.NaN, z: 0 },
      { x: 0, z: 0 },
    )).toThrow('foot coordinates must be finite');
  });
});

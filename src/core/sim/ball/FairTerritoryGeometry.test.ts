import { describe, expect, it } from 'vitest';
import {
  classifyBallAgainstFairTerritory,
  classifyPointAgainstFairTerritory,
  createFairTerritoryWedge,
} from './FairTerritoryGeometry';

describe('FairTerritoryGeometry', () => {
  const field = createFairTerritoryWedge({
    homePlate: { x: 0, z: 0 },
    firstBaseLineUnit: {
      x: Math.SQRT1_2,
      z: Math.SQRT1_2,
    },
    thirdBaseLineUnit: {
      x: -Math.SQRT1_2,
      z: Math.SQRT1_2,
    },
  });

  it('classifies points between both foul lines as inside the fair wedge', () => {
    expect(classifyPointAgainstFairTerritory(
      field,
      { x: 0, z: 20 },
    )).toEqual({
      kind: 'inside_fair_wedge',
      firstBaseLineSignedSide: expect.any(Number),
      thirdBaseLineSignedSide: expect.any(Number),
    });
  });

  it('classifies a point outside either foul line as outside the fair wedge', () => {
    expect(classifyPointAgainstFairTerritory(
      field,
      { x: 20, z: 5 },
    ).kind).toBe('outside_fair_wedge');

    expect(classifyPointAgainstFairTerritory(
      field,
      { x: -20, z: 5 },
    ).kind).toBe('outside_fair_wedge');
  });

  it('treats a point exactly on a foul line as inside the wedge', () => {
    expect(classifyPointAgainstFairTerritory(
      field,
      { x: 10, z: 10 },
    ).kind).toBe('inside_fair_wedge');

    expect(classifyPointAgainstFairTerritory(
      field,
      { x: -10, z: 10 },
    ).kind).toBe('inside_fair_wedge');
  });

  it('treats a ball whose physical radius overlaps a foul line as inside fair territory', () => {
    expect(classifyPointAgainstFairTerritory(
      field,
      { x: 1.04, z: 1 },
    ).kind).toBe('outside_fair_wedge');

    expect(classifyBallAgainstFairTerritory(
      field,
      { x: 1.04, z: 1 },
      0.0366,
    ).kind).toBe('inside_fair_wedge');

    expect(classifyBallAgainstFairTerritory(
      field,
      { x: 1.06, z: 1 },
      0.0366,
    ).kind).toBe('outside_fair_wedge');
  });

  it('supports translated field coordinates', () => {
    const translated = createFairTerritoryWedge({
      homePlate: { x: 100, z: -50 },
      firstBaseLineUnit: { x: 1, z: 0 },
      thirdBaseLineUnit: { x: 0, z: 1 },
    });

    expect(classifyPointAgainstFairTerritory(
      translated,
      { x: 110, z: -40 },
    ).kind).toBe('inside_fair_wedge');
    expect(classifyPointAgainstFairTerritory(
      translated,
      { x: 90, z: -40 },
    ).kind).toBe('outside_fair_wedge');
  });

  it('rejects non-unit or incorrectly ordered foul-line axes', () => {
    expect(() => createFairTerritoryWedge({
      homePlate: { x: 0, z: 0 },
      firstBaseLineUnit: { x: 2, z: 0 },
      thirdBaseLineUnit: { x: 0, z: 1 },
    })).toThrow(
      'fair-territory foul-line vectors must be unit length',
    );

    expect(() => createFairTerritoryWedge({
      homePlate: { x: 0, z: 0 },
      firstBaseLineUnit: { x: 0, z: 1 },
      thirdBaseLineUnit: { x: 1, z: 0 },
    })).toThrow(
      'thirdBaseLineUnit must be counterclockwise from firstBaseLineUnit',
    );
  });
});

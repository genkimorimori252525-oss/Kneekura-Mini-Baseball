import { describe, expect, it } from 'vitest';
import {
  createDefenderFootPlacementFact,
} from './DefensiveAlignmentFacts';
import {
  createInfieldBoundaryRegion,
} from './InfieldBoundaryRegion';
import {
  evaluatePitchingMotionInfieldBoundary,
} from './PitchingMotionInfieldBoundaryRule';

const tick = 1_900_000;

const fact = (
  id: string,
  position: '1B' | '2B' | '3B' | 'SS' | 'CF',
  x: number,
  z: number,
) => createDefenderFootPlacementFact(
  id,
  position,
  tick,
  { x: x - 0.08, z },
  { x: x + 0.08, z },
);

const boundary = createInfieldBoundaryRegion([
  { x: -10, z: -10 },
  { x: 10, z: -10 },
  { x: 10, z: 10 },
  { x: -10, z: 10 },
]);

describe('pitching-motion infield boundary rule', () => {
  it('accepts four registered infielders whose complete foot discs are inside the boundary', () => {
    const result = evaluatePitchingMotionInfieldBoundary({
      pitchingRelatedMotionStartTick: tick,
      facts: [
        fact('1b', '1B', 4, 2),
        fact('2b', '2B', 2, 3),
        fact('ss', 'SS', -2, 3),
        fact('3b', '3B', -4, 2),
        fact('cf', 'CF', 0, 15),
      ],
      boundary,
      parameters: {
        requiredInfielderCount: 4,
        footContactRadiusMeters: 0.12,
      },
    });

    expect(result).toMatchObject({
      kind: 'legal',
      pitchingRelatedMotionStartTick: tick,
      invalidInfielders: [],
    });
    expect(result.placements).toHaveLength(4);
  });

  it('identifies the concrete infielder whose foot is not completely inside', () => {
    const result = evaluatePitchingMotionInfieldBoundary({
      pitchingRelatedMotionStartTick: tick,
      facts: [
        fact('1b', '1B', 4, 2),
        fact('2b', '2B', 2, 3),
        fact('ss', 'SS', 10.0, 0),
        fact('3b', '3B', -4, 2),
      ],
      boundary,
      parameters: {
        requiredInfielderCount: 4,
        footContactRadiusMeters: 0.12,
      },
    });

    expect(result.kind).toBe('violation');
    expect(result.invalidInfielders).toEqual(['ss']);
    expect(result.placements.find(
      (placement) => placement.playerId === 'ss',
    )).toMatchObject({
      leftFootFullyInside: false,
      rightFootFullyInside: false,
    });
  });

  it('requires all four registered infield positions at the authoritative tick', () => {
    expect(() => evaluatePitchingMotionInfieldBoundary({
      pitchingRelatedMotionStartTick: tick,
      facts: [
        fact('1b', '1B', 4, 2),
        fact('2b', '2B', 2, 3),
        fact('ss', 'SS', -2, 3),
      ],
      boundary,
      parameters: {
        requiredInfielderCount: 4,
        footContactRadiusMeters: 0.12,
      },
    })).toThrow(
      'infield-boundary alignment requires exactly one 1B, 2B, 3B, and SS',
    );
  });

  it('rejects foot placements sampled at a different tick', () => {
    const mismatched = createDefenderFootPlacementFact(
      'ss',
      'SS',
      tick + 1,
      { x: -2.08, z: 3 },
      { x: -1.92, z: 3 },
    );

    expect(() => evaluatePitchingMotionInfieldBoundary({
      pitchingRelatedMotionStartTick: tick,
      facts: [
        fact('1b', '1B', 4, 2),
        fact('2b', '2B', 2, 3),
        mismatched,
        fact('3b', '3B', -4, 2),
      ],
      boundary,
      parameters: {
        requiredInfielderCount: 4,
        footContactRadiusMeters: 0.12,
      },
    })).toThrow(
      'all infield foot placements must be sampled at pitchingRelatedMotionStartTick',
    );
  });
});

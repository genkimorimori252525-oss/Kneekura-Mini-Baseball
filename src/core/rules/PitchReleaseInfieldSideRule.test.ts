import { describe, expect, it } from 'vitest';
import {
  createDefenderFootPlacementFact,
  createSecondBaseDivisionReference,
} from './DefensiveAlignmentFacts';
import {
  evaluatePitchReleaseInfieldSide,
} from './PitchReleaseInfieldSideRule';
import type { DefensivePosition } from '../model/CanonicalWorldSnapshot';

const tick = 2_000_000;

const foot = (
  playerId: string,
  registeredPosition: DefensivePosition,
  x: number,
  z = 0,
) => createDefenderFootPlacementFact(
  playerId,
  registeredPosition,
  tick,
  { x: x - 0.05, z },
  { x: x + 0.05, z },
);

const reference = createSecondBaseDivisionReference(
  { x: 0, z: 0 },
  { x: 1, z: 0 },
);

const parameters = {
  requiredInfielderCount: 4,
  minimumInfieldersEachSideOfSecondBase: 2,
} as const;

describe('PitchReleaseInfieldSideRule', () => {
  it('accepts exactly two registered infielders on each side of second base', () => {
    const result = evaluatePitchReleaseInfieldSide({
      pitchReleaseTick: tick,
      facts: [
        foot('1b', '1B', 3),
        foot('2b', '2B', 2),
        foot('ss', 'SS', -2),
        foot('3b', '3B', -3),
      ],
      reference,
      parameters,
    });

    expect(result).toMatchObject({
      kind: 'legal',
      pitchReleaseTick: tick,
      firstBaseSideCount: 2,
      thirdBaseSideCount: 2,
      invalidInfielders: [],
    });
  });

  it('rejects a 3+1 alignment', () => {
    const result = evaluatePitchReleaseInfieldSide({
      pitchReleaseTick: tick,
      facts: [
        foot('1b', '1B', 3),
        foot('2b', '2B', 2),
        foot('ss', 'SS', 1),
        foot('3b', '3B', -3),
      ],
      reference,
      parameters,
    });

    expect(result).toMatchObject({
      kind: 'violation',
      firstBaseSideCount: 3,
      thirdBaseSideCount: 1,
      invalidInfielders: [],
    });
  });

  it('rejects an infielder who straddles or touches the dividing line', () => {
    const straddling = createDefenderFootPlacementFact(
      'ss',
      'SS',
      tick,
      { x: -0.1, z: 0 },
      { x: 0.1, z: 0 },
    );

    const result = evaluatePitchReleaseInfieldSide({
      pitchReleaseTick: tick,
      facts: [
        foot('1b', '1B', 3),
        foot('2b', '2B', 2),
        straddling,
        foot('3b', '3B', -3),
      ],
      reference,
      parameters,
    });

    expect(result).toMatchObject({
      kind: 'violation',
      firstBaseSideCount: 2,
      thirdBaseSideCount: 1,
      invalidInfielders: ['ss'],
    });
  });

  it('ignores a CF shifted between the middle infielders for the four-infielder count', () => {
    const result = evaluatePitchReleaseInfieldSide({
      pitchReleaseTick: tick,
      facts: [
        foot('1b', '1B', 3),
        foot('2b', '2B', 2),
        foot('ss', 'SS', -2),
        foot('3b', '3B', -3),
        foot('cf', 'CF', 0.5),
      ],
      reference,
      parameters,
    });

    expect(result.kind).toBe('legal');
    expect(result.placements.map((item) => item.playerId))
      .toEqual(['1b', '2b', 'ss', '3b']);
  });

  it('rejects foot facts from a different authoritative tick', () => {
    const wrongTick = createDefenderFootPlacementFact(
      'ss',
      'SS',
      tick + 1,
      { x: -2.1, z: 0 },
      { x: -1.9, z: 0 },
    );

    expect(() => evaluatePitchReleaseInfieldSide({
      pitchReleaseTick: tick,
      facts: [
        foot('1b', '1B', 3),
        foot('2b', '2B', 2),
        wrongTick,
        foot('3b', '3B', -3),
      ],
      reference,
      parameters,
    })).toThrow(
      'all infield foot placements must be sampled at pitchReleaseTick',
    );
  });

  it('produces the same logical result with a rotated field division axis', () => {
    const rotatedReference = createSecondBaseDivisionReference(
      { x: 10, z: 20 },
      { x: 0, z: 1 },
    );
    const rotatedFoot = (
      playerId: string,
      registeredPosition: DefensivePosition,
      z: number,
    ) => createDefenderFootPlacementFact(
      playerId,
      registeredPosition,
      tick,
      { x: 10, z: z - 0.05 + 20 },
      { x: 10, z: z + 0.05 + 20 },
    );

    const result = evaluatePitchReleaseInfieldSide({
      pitchReleaseTick: tick,
      facts: [
        rotatedFoot('1b', '1B', 3),
        rotatedFoot('2b', '2B', 2),
        rotatedFoot('ss', 'SS', -2),
        rotatedFoot('3b', '3B', -3),
      ],
      reference: rotatedReference,
      parameters,
    });

    expect(result).toMatchObject({
      kind: 'legal',
      firstBaseSideCount: 2,
      thirdBaseSideCount: 2,
    });
  });

  it('rejects malformed canonical infield facts with duplicate registered infield positions', () => {
    expect(() => evaluatePitchReleaseInfieldSide({
      pitchReleaseTick: tick,
      facts: [
        foot('1b', '1B', 3),
        foot('2b-a', '2B', 2),
        foot('2b-b', '2B', -2),
        foot('3b', '3B', -3),
      ],
      reference,
      parameters,
    })).toThrow(
      'pitch-release alignment requires exactly one 1B, 2B, 3B, and SS',
    );
  });
});

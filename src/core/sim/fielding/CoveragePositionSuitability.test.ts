import { describe, expect, it } from 'vitest';
import {
  createDefensiveRatings,
} from '../../model/DefensiveRatings';
import type {
  DefensiveIntentCandidate,
} from './DefensiveDecision';
import {
  applyPositionSuitabilityToCoverageCandidates,
} from './CoveragePositionSuitability';

const candidate = (
  intent: DefensiveIntentCandidate['intent'],
  localPriority: number,
): DefensiveIntentCandidate => ({
  intent,
  localPriority,
  evidenceAvailableAt: 1_000_000,
  evidenceKinds: ['fixture'],
});

const ratings = (
  ssSuitability: number,
) => createDefensiveRatings({
  positionSuitability: {
    P: 0.5,
    C: 0.5,
    '1B': 0.5,
    '2B': 0.5,
    '3B': 0.5,
    SS: ssSuitability,
    LF: 0.5,
    CF: 0.5,
    RF: 0.5,
  },
  firstStep: 0.5,
  acceleration: 0.5,
  battedBallRead: 0.5,
  routeEfficiency: 0.5,
  catching: 0.5,
  transfer: 0.5,
  armStrength: 0.5,
  throwingAccuracy: 0.5,
  situationalAwareness: 0.5,
  tagSkill: 0.5,
});

const calibration = {
  roleSensitivity: {
    ball_handler: 1,
    base_cover: 0.6,
    relay: 0.7,
    backup: 0.4,
    deep_coverage: 0.8,
    hold: 0,
  },
  minimumSuitabilityFactor: 0.5,
} as const;

describe('CoveragePositionSuitability', () => {
  it('reduces demanding-role priority for low position suitability without changing the candidate intent', () => {
    const input = [
      candidate({ kind: 'ball_handler' }, 0.8),
      candidate({ kind: 'hold' }, 0.2),
    ];

    const low = applyPositionSuitabilityToCoverageCandidates(
      input,
      ratings(0),
      'SS',
      calibration,
    );
    const high = applyPositionSuitabilityToCoverageCandidates(
      input,
      ratings(1),
      'SS',
      calibration,
    );

    expect(low[0].intent).toEqual(high[0].intent);
    expect(low[0].localPriority).toBeCloseTo(0.4, 12);
    expect(high[0].localPriority).toBeCloseTo(0.8, 12);
  });

  it('leaves hold priority unchanged because hold has zero suitability sensitivity', () => {
    const low = applyPositionSuitabilityToCoverageCandidates(
      [candidate({ kind: 'hold' }, 0.3)],
      ratings(0),
      'SS',
      calibration,
    );
    const high = applyPositionSuitabilityToCoverageCandidates(
      [candidate({ kind: 'hold' }, 0.3)],
      ratings(1),
      'SS',
      calibration,
    );

    expect(low).toEqual(high);
  });

  it('does not modify any player execution rating', () => {
    const playerRatings = ratings(0.2);
    const before = structuredClone(playerRatings);

    applyPositionSuitabilityToCoverageCandidates(
      [candidate({ kind: 'base_cover', base: 1 }, 0.7)],
      playerRatings,
      'SS',
      calibration,
    );

    expect(playerRatings).toEqual(before);
  });

  it('rejects invalid sensitivity and minimum factor calibration', () => {
    expect(() => applyPositionSuitabilityToCoverageCandidates(
      [candidate({ kind: 'hold' }, 0.3)],
      ratings(0.5),
      'SS',
      {
        ...calibration,
        minimumSuitabilityFactor: 1.1,
      },
    )).toThrow(
      'minimumSuitabilityFactor must be finite and within [0, 1]',
    );

    expect(() => applyPositionSuitabilityToCoverageCandidates(
      [candidate({ kind: 'relay', target: { x: 1, z: 1 } }, 0.3)],
      ratings(0.5),
      'SS',
      {
        ...calibration,
        roleSensitivity: {
          ...calibration.roleSensitivity,
          relay: -0.1,
        },
      },
    )).toThrow(
      'roleSensitivity.relay must be finite and within [0, 1]',
    );
  });
});

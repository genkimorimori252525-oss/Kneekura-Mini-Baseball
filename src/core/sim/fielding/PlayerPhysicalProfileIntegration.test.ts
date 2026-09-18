import { describe, expect, it } from 'vitest';
import {
  createPlayerPhysicalProfile,
} from '../../model/PlayerPhysicalProfile';
import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
import type {
  BaseTouchRegion,
} from '../running/BaseTouch';
import {
  planDefenderBaseFootReachPrimitive,
  type DefenderBaseFootReachParameters,
} from './DefenderBaseFootReach';
import type {
  DefenderBodyKinematicsSegment,
} from './DefenderBodyKinematics';
import {
  deriveDefenderPhysicalReachCalibration,
  type DefenderPhysicalReachBaseline,
} from './DefenderPhysicalProfileCalibration';
import {
  assessPerceivedGloveTarget,
} from './PerceivedGloveTarget';

const baseline: DefenderPhysicalReachBaseline = {
  bodyOriginHeightMeters: 0.95,
  maximumLegReachMeters: 1.5,
  maximumGloveReachMeters: 1.3,
  maximumTagReachMeters: 1.1,
};

const reference = deriveDefenderPhysicalReachCalibration(
  createPlayerPhysicalProfile(1.8),
  baseline,
);
const tall = deriveDefenderPhysicalReachCalibration(
  createPlayerPhysicalProfile(1.98),
  baseline,
);

const body = (
  bodyOriginHeightMeters: number,
): DefenderBodyKinematicsSegment => ({
  startTick: 1_000_000,
  endTick: 2_000_000,
  ticksPerSecond: 1_000_000,
  startPosition: {
    x: 0,
    y: bodyOriginHeightMeters,
    z: 0,
  },
  startVelocity: { x: 0, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
});

const base: BaseTouchRegion = {
  center: { x: 1.2, z: 0 },
  halfSize: { x: 0.2, z: 0.2 },
  rotationRadians: 0,
};

const commonFootDynamics = {
  footRadiusMeters: 0.12,
  maxRelativeReachSpeedMps: 10,
  maxRelativeReachAccelerationMps2: 10,
} as const;

const footParameters = (
  maximumLegReachMeters: number,
): DefenderBaseFootReachParameters => ({
  ...commonFootDynamics,
  maximumLegReachMeters,
});

const perceivedWorld = (): PlayerPerceivedWorldState<null> => ({
  observerId: 'first-baseman',
  observationTime: 1_000_000,
  attention: {
    target: { kind: 'ball' },
    focusedSinceTick: 900_000,
  },
  ball: {
    estimate: {
      position: { x: 1.35, y: 1, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    },
    sourceObservedAt: 950_000,
    predictedAt: 1_000_000,
    confidence: 1,
  },
  players: [],
  communications: [],
  knownContext: null,
});

describe('Player physical profile integration', () => {
  it('can turn the same base-foot target from unreachable to reachable only through physical size calibration', () => {
    const footState = {
      tick: 1_000_000,
      offset: { x: 0, y: -0.9, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    } as const;

    const referenceParameters = footParameters(
      reference.maximumLegReachMeters,
    );
    const tallParameters = footParameters(
      tall.maximumLegReachMeters,
    );

    const referenceReach =
      planDefenderBaseFootReachPrimitive({
        body: body(
          reference.bodyOriginHeightMeters,
        ),
        footState,
        role: 'left_foot',
        targetTick: 2_000_000,
        base,
        baseLocalContactPoint: { x: 0, z: 0 },
        baseSurfaceHeightMeters: 0,
        parameters: referenceParameters,
      });

    const tallReach =
      planDefenderBaseFootReachPrimitive({
        body: body(
          tall.bodyOriginHeightMeters,
        ),
        footState,
        role: 'left_foot',
        targetTick: 2_000_000,
        base,
        baseLocalContactPoint: { x: 0, z: 0 },
        baseSurfaceHeightMeters: 0,
        parameters: tallParameters,
      });

    expect(referenceReach).toBeNull();
    expect(tallReach).not.toBeNull();

    expect(
      referenceParameters.maxRelativeReachSpeedMps,
    ).toBe(tallParameters.maxRelativeReachSpeedMps);
    expect(
      referenceParameters.maxRelativeReachAccelerationMps2,
    ).toBe(
      tallParameters.maxRelativeReachAccelerationMps2,
    );
    expect(referenceParameters.footRadiusMeters)
      .toBe(tallParameters.footRadiusMeters);
  });

  it('can turn the same perceived glove target from outside to inside the reach envelope without changing perception quality', () => {
    const referenceAssessment =
      assessPerceivedGloveTarget(
        perceivedWorld(),
        body(reference.bodyOriginHeightMeters),
        1_200_000,
        {
          minimumBallConfidence: 0.5,
          maximumReachMeters:
            reference.maximumGloveReachMeters,
        },
      );

    const tallAssessment =
      assessPerceivedGloveTarget(
        perceivedWorld(),
        body(tall.bodyOriginHeightMeters),
        1_200_000,
        {
          minimumBallConfidence: 0.5,
          maximumReachMeters:
            tall.maximumGloveReachMeters,
        },
      );

    expect(referenceAssessment?.withinReach)
      .toBe(false);
    expect(tallAssessment?.withinReach)
      .toBe(true);

    expect(referenceAssessment?.sourceBallConfidence)
      .toBe(tallAssessment?.sourceBallConfidence);
    expect(referenceAssessment?.sourceObservedAt)
      .toBe(tallAssessment?.sourceObservedAt);
  });
});

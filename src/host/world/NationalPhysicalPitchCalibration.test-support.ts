import type { AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
/** Existing explicit National physical calibration, shared by the real owners and cheap prospective scene checks. */
export const nationalPhysicalPitchCalibration = () => {
  const baseline = { sourceId: 'workload', sourceVersion: 'fixture-v1', personLinkSourceId: 'link-0', careerId: 'career-a', playerId: 'p0',
    createdAtDay: 10, fatigue: 0, recoveryCapacity: 1, policy: { policyId: 'workload', version: 'v1', availableAtDay: 10,
      workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
  const timingInput = { sourceId: 'timing', sourceVersion: 'fixture-v1', personLinkSourceId: 'link-0', careerId: 'career-a', playerId: 'p0', acceptedAtDay: 10,
    profile: { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000, quickSpeedFactor: 1.8,
      cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.8, naturalVariationUs: 50_000,
      normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } } };
  const releaseInput = { ...timingInput, sourceId: 'release',
    body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1, throwingSide: 'RIGHT' as const },
    profile: { armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const, releaseHeightRatio: 0.9,
      releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 }, tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
  const response = { sourceId: 'response', sourceVersion: 'fixture-v1', policyId: 'response', version: 'v1', availableAtDay: 10,
    motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.5, spinRetentionAtFullFatigue: 0.75 };
  const effort = { sourceId: 'effort', sourceVersion: 'fixture-v1', policyId: 'effort', version: 'v1', availableAtDay: 10, effortUnitsPerPhysicalPitch: 2 };
  return { baseline, timingInput, releaseInput, response, effort };
};

/** Original explicit National fixture recipe, shared by fresh and retained tails. */
export const nationalPhysicalPitchFixtureSource = (gameId: string, gameDay: number,
  effort: AcceptedPhysicalPitchActionSource['effortPolicy'], responseSourceId: string, index: number, readyAtUs: number): AcceptedPhysicalPitchActionSource => {
  const source: AcceptedPhysicalPitchActionSource = { sourceId: `pitch-${index}`, sourceVersion: 'fixture-v1', gameId,
    initialWorldSourceId: 'initial-world', effortPolicy: effort, request: { workloadRevision: 0, policySourceId: responseSourceId,
      delivery: { careerId: 'career-a', playerId: 'p0', gameDay, matchSeed: 19,
        moundReference: { x: 0, y: 0, z: 18 }, outingId: 'outing-1', readyAtUs,
        timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
      flight: { durationUs: 1_500_000, acceleration: { x: 0, y: 0, z: 0 } },
      batter: { action: { kind: 'take' }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 } } };
  return source;
};

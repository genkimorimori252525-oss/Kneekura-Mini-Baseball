import { createCanonicalPlateAppearanceTimeline, type CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { applyStrikeoutPlateAppearanceToMatchState } from '../../core/sim/plateAppearance/PlateAppearanceMatchState';
import type { PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import type { AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';

/** Actual Native owners, explicit synthetic bodies/physics/calibration, no forced count events. */
export const continuousPitchFixture = (databasePath?: string, bothSides = false, fixture?: Parameters<typeof officialPitchWorkloadFixture>[4], profile?: Parameters<typeof officialPitchWorkloadFixture>[5], rehabPlayerIds: readonly string[] = [],
  originalBaseCenters?: ReturnType<typeof worldSetup>['baseCenters']) => {
  const f = officialPitchWorkloadFixture(true, true, databasePath, bothSides, fixture, profile, rehabPlayerIds);
  const setup = { sourceId: 'initial-world', sourceVersion: 'fixture-v1', gameId: 'game-1', fixtureEventId: f.fixtureBinding.fixtureEventId,
    startedAtTick: 0, worldSetup: { ...worldSetup('p2'), ...(originalBaseCenters ? { baseCenters: originalBaseCenters } : {}) } };
  const initialWorlds = f.track(openSqliteOfficialInitialWorldStore(f.path, { matches: f.official, participation: f.participation }, { readAcceptedSetup: () => setup }));
  const initial = initialWorlds.accept(setup.sourceId);
  const baseline = { sourceId: 'workload', sourceVersion: 'fixture-v1', personLinkSourceId: 'intake-p2', careerId: 'career-a', playerId: 'p2',
    createdAtDay: 1, fatigue: 0, recoveryCapacity: 1, policy: { policyId: 'workload', version: 'v1', availableAtDay: 1,
      workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
  const activities = new Map<string, PlayerWorkloadActivity>();
  const workload = f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, { readAcceptedBaseline: () => baseline,
    readAcceptedActivity: (id) => activities.get(id) ?? null }));
  workload.initialize(baseline.sourceId);
  const timingInput = { sourceId: 'timing', sourceVersion: 'fixture-v1', personLinkSourceId: 'intake-p2', careerId: 'career-a', playerId: 'p2', acceptedAtDay: 1,
    profile: { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000, quickSpeedFactor: 1.8,
      cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.8, naturalVariationUs: 50_000,
      normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } } };
  const timing = f.track(openSqlitePlayerPitchTimingStore(f.path, f.links, { readAcceptedBaseline: () => timingInput, readAcceptedLearning: () => null })); timing.initialize('timing');
  const releaseInput = { ...timingInput, sourceId: 'release',
    body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1, throwingSide: 'RIGHT' as const },
    profile: { armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const, releaseHeightRatio: 0.9,
      releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 }, tierBoundaries: [0.65, 0.7, 0.75, 0.8, 0.85, 0.95] };
  const release = f.track(openSqlitePlayerReleaseGeometryStore(f.path, f.links, { readAcceptedBaseline: () => releaseInput, readAcceptedChange: () => null })); release.initialize('release');
  if (bothSides) {
    const away = { playerId: 'p-away', personLinkSourceId: 'intake-p-away' };
    const awayWorkload = { ...baseline, ...away, sourceId: 'workload-away' };
    f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, { readAcceptedBaseline: () => awayWorkload, readAcceptedActivity: () => null })).initialize(awayWorkload.sourceId);
    const awayTiming = { ...timingInput, ...away, sourceId: 'timing-away' };
    f.track(openSqlitePlayerPitchTimingStore(f.path, f.links, { readAcceptedBaseline: () => awayTiming, readAcceptedLearning: () => null })).initialize(awayTiming.sourceId);
    const awayRelease = { ...releaseInput, ...away, sourceId: 'release-away' };
    f.track(openSqlitePlayerReleaseGeometryStore(f.path, f.links, { readAcceptedBaseline: () => awayRelease, readAcceptedChange: () => null })).initialize(awayRelease.sourceId);
  }
  const response = { sourceId: 'response', sourceVersion: 'fixture-v1', policyId: 'response', version: 'v1', availableAtDay: 1,
    motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.5, spinRetentionAtFullFatigue: 0.75 };
  const policies = f.track(openSqlitePitchFatiguePolicyStore(f.path, { readAcceptedPolicy: () => response })); policies.accept(response.sourceId);
  const effort = { sourceId: 'effort', sourceVersion: 'fixture-v1', policyId: 'effort', version: 'v1', availableAtDay: 1, effortUnitsPerPhysicalPitch: 2 };
  const input = { timeline: createCanonicalPlateAppearanceTimeline(initial.match, initial.world.tick), workloadRevision: 0,
    policySourceId: response.sourceId, effortPolicySourceId: effort.sourceId,
    delivery: { careerId: 'career-a', playerId: 'p2', gameDay: 10, matchSeed: 19, moundReference: { x: 0, y: 0, z: 18 },
      outingId: 'outing-1', playId: initial.match.playId, pitchIndex: 0, readyAtUs: initial.world.tick,
      timingIntent: { deliveryMode: 'NORMAL' as const, cadenceIntent: 'STANDARD' as const },
      physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
    flight: { durationUs: 1_500_000, acceleration: { x: 0, y: 0, z: 0 } },
    batter: { action: { kind: 'take' as const }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 } };
  return { path: f.path, links: f.links, official: f.official, scoring: f.scoring, participation: f.participation, world: f.world, roster: f.roster,
    firstInput: { ...f.firstInput, worldSetup: setup.worldSetup }, db: f.db, track: f.track, close: f.close, initialWorlds, initial, baseline,
    timing, release, workload, policies, response, effort, input, activities,
    stores: { workload, timing, release, policies, effortPolicies: { readAcceptedPolicy: (id: string) => id === effort.sourceId ? effort : null } } };
};

export const continuousPitchAction = (f: ReturnType<typeof continuousPitchFixture>, index: number, readyAtUs: number): AcceptedPhysicalPitchActionSource => {
  const { timeline: _timeline, effortPolicySourceId: _effortPolicySourceId, ...request } = f.input;
  const { playId: _playId, pitchIndex: _pitchIndex, ...delivery } = request.delivery;
  return { sourceId: `pitch-${index}`, sourceVersion: 'fixture-v1', gameId: 'game-1', initialWorldSourceId: 'initial-world',
    effortPolicy: f.effort, request: { ...request, delivery: { ...delivery, readyAtUs } } };
};

export const closeContinuousPitchPlay = (f: ReturnType<typeof continuousPitchFixture>, timeline: CanonicalPlateAppearanceTimeline) => {
  const next = applyStrikeoutPlateAppearanceToMatchState(f.initial.match, timeline);
  let adjudication = createPlayAdjudicationLedger({ playId: timeline.playId, ruleProfileId: f.initial.match.ruleProfileId, playEnd: null });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: 'continuous-rule', tick: timeline.lastEventTick + 1,
    snapshotId: 'continuous-rule', evidenceRevision: 1, ruling: { outsAfter: next.outs, basesAfter: next.bases, scoredRunnerIds: [] } });
  adjudication = closeOfficialPlay(adjudication, 1, { eventId: 'continuous-close', closureId: 'continuous-close', tick: timeline.lastEventTick + 2 });
  const application = { ...f.firstInput, applicationId: 'continuous-close', timeline, adjudication, nextStartedAtTick: timeline.lastEventTick + 3 };
  f.official.applyAndActivate(application); f.scoring.apply({ scoringApplicationId: 'continuous-scoring', officialApplication: application });
  return application;
};

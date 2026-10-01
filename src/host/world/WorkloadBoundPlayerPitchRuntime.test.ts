import { expect, it } from 'vitest';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteOfficialPitchWorkloadStore } from './SqliteOfficialPitchWorkloadStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import { resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld } from './WorkloadBoundPlayerPitchRuntime';

const response = { sourceId: 'response', sourceVersion: 'fixture-v1', policyId: 'response', version: 'v1', availableAtDay: 1,
  motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.5, spinRetentionAtFullFatigue: 0.75 };
const setup = () => {
  const f = officialPitchWorkloadFixture();
  const effort = { sourceId: 'effort', sourceVersion: 'fixture-v1', policyId: 'effort', version: 'v1', availableAtDay: 1, effortUnitsPerPhysicalPitch: 2 };
  const producer = f.track(openSqliteOfficialPitchWorkloadStore(f.path, { scoring: f.scoring, participation: f.participation }, { readAcceptedPolicy: () => effort }));
  const activity = producer.accept({ scoringApplicationId: 'scoring-2', activationApplicationId: 'application-1', policySourceId: effort.sourceId });
  const baseline = { sourceId: 'workload', sourceVersion: 'fixture-v1', personLinkSourceId: 'intake-p2', careerId: 'career-a', playerId: 'p2',
    createdAtDay: 1, fatigue: 0, recoveryCapacity: 1, policy: { policyId: 'workload', version: 'v1', availableAtDay: 1,
      workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
  const rest = { sourceEventId: 'rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest', careerId: 'career-a', playerId: 'p2', atDay: 11,
    kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
  const workload = f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, { readAcceptedBaseline: () => baseline,
    readAcceptedActivity: (id) => id === rest.sourceEventId ? rest : producer.readAcceptedActivity(id) }));
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
  const policies = f.track(openSqlitePitchFatiguePolicyStore(f.path, { readAcceptedPolicy: () => response })); policies.accept(response.sourceId);
  const current = f.official.getMatch('game-1')!;
  const startedAtTick = current.activation!.nextTimeline.startedAtTick;
  const input = { timeline: createCanonicalPlateAppearanceTimeline(current.matchState, startedAtTick), workloadRevision: 0, policySourceId: response.sourceId,
    delivery: { careerId: 'career-a', playerId: 'p2', gameDay: 10, matchSeed: 19, moundReference: { x: 0, y: 0, z: 18 },
      outingId: 'outing-1', playId: current.matchState.playId, pitchIndex: 0, readyAtUs: startedAtTick,
      timingIntent: { deliveryMode: 'NORMAL' as const, cadenceIntent: 'STANDARD' as const },
      physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
    flight: { durationUs: 1_500_000, acceleration: { x: 0, y: 0, z: 0 } },
    batter: { action: { kind: 'take' as const }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 } };
  return { ...f, input, workload, timing, release, policies, activity, rest, stores: { workload, timing, release, policies } };
};
it('actual official pitch workload changes subsequent physical flight; recovery changes future execution without rewriting history', () => {
  const f = setup();
  try {
    const originalTiming = f.timing.readHead('career-a', 'p2'), originalRelease = f.release.readHead('career-a', 'p2');
    const fresh = resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores, f.input);
    f.workload.apply(f.activity.sourceEventId, 0);
    const tiredInput = { ...f.input, workloadRevision: 1 }, tired = resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores, tiredInput);
    expect(tired.workload.fatigue).toBeCloseTo(0.6);
    expect(tired.pitch.delivery.timeline.motionToReleaseUs - fresh.pitch.delivery.timeline.motionToReleaseUs).toBe(180_000);
    expect(tired.pitch.trajectory.start.velocity.z).toBeCloseTo(-21); expect(tired.pitch.trajectory.start.spin.y).toBeCloseTo(85);
    expect(tired.pitch.trajectory.start.position).toEqual(fresh.pitch.trajectory.start.position);
    const crossing = (result: typeof tired) => {
      const physical = result.pitch.resolution;
      if (physical.kind !== 'recorded' || physical.physical.kind !== 'taken') throw new Error('expected actual physical take');
      return physical.physical.result.crossing.elapsedSeconds;
    };
    expect(crossing(tired)).toBeGreaterThan(crossing(fresh));
    f.workload.apply(f.rest.sourceEventId, 1);
    const recovered = resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores,
      { ...f.input, workloadRevision: 2, delivery: { ...f.input.delivery, gameDay: 11 } });
    expect(recovered.workload.fatigue).toBe(0); expect(recovered.pitch).toEqual(fresh.pitch);
    expect(resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores, tiredInput)).toEqual(tired);
    const reopened = { workload: f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links)),
      timing: f.track(openSqlitePlayerPitchTimingStore(f.path, f.links)), release: f.track(openSqlitePlayerReleaseGeometryStore(f.path, f.links)),
      policies: f.track(openSqlitePitchFatiguePolicyStore(f.path)) };
    expect(resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(reopened, tiredInput)).toEqual(tired);
    expect(f.timing.readHead('career-a', 'p2')).toEqual(originalTiming); expect(f.release.readHead('career-a', 'p2')).toEqual(originalRelease);
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(2);
  } finally { f.close(); }
});
it('rejects caller fatigue, invalid seed/scope, future policy/state and corrupt Native history', () => {
  const f = setup();
  try {
    expect(() => resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, fatigue: 0 } as typeof f.input)).toThrow();
    expect(() => resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, delivery: { ...f.input.delivery, matchSeed: Number.NaN } })).toThrow();
    expect(() => resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, delivery: { ...f.input.delivery, playerId: 'missing' } })).toThrow('missing');
    expect(() => resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, workloadRevision: 1 })).toThrow('missing');
    f.workload.apply(f.activity.sourceEventId, 0); f.workload.apply(f.rest.sourceEventId, 1);
    expect(() => resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, workloadRevision: 2 })).toThrow('future');
    const future = f.track(openSqlitePitchFatiguePolicyStore(f.path, { readAcceptedPolicy: () => ({ ...response, sourceId: 'future', version: 'future', availableAtDay: 11 }) })); future.accept('future');
    expect(() => resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores, { ...f.input, policySourceId: 'future' })).toThrow('future');
    f.db.exec("UPDATE world_player_workload_heads SET state_json='{}'");
    expect(() => resolveWorkloadBoundPlayerPitchAgainstBatterFromWorld(f.stores, f.input)).toThrow('corrupt');
  } finally { f.close(); }
});

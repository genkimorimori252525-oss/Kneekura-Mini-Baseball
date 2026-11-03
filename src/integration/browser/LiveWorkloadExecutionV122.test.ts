import { expect, it } from 'vitest';
import { restoreLiveWorkloadV122, advanceLiveWorkloadV122, resolveLivePitchWorkloadExecutionV122 } from './LiveWorkloadExecutionV122';
import { createPlayerWorkloadRecovery, advancePlayerWorkloadRecovery, type PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { applyPitchFatigueToExecution } from '../../core/sim/pitch/PitchFatigueExecution';

const context = () => ({ sourceId: 'workload-source', sourceVersion: 'v1',
  scope: { sessionId: 'session', matchId: 'match', careerId: 'career', playerId: 'pitcher', gameDay: 10 },
  baseline: { careerId: 'career', playerId: 'pitcher', createdAtDay: 1, fatigue: .2, recoveryCapacity: .5,
    policy: { policyId: 'workload', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: .1, travelFatiguePerKm: .001, recoveryPerHour: .1 } },
  activities: [{ expectedRevision: 0, activity: { sourceEventId: 'actual-match', sourceVersion: 'v1', evidenceId: 'physical-effort',
    careerId: 'career', playerId: 'pitcher', atDay: 10, kind: 'MATCH' as const, effortUnits: 3 } }], expectedRevision: 1 });
const timing = { baseStartIntervalUs: 10000000, normalMotionToReleaseUs: 600000, followThroughUs: 200000,
  quickSpeedFactor: 1.8, cadenceExecutionControl: .8, cadenceTimingKnowledge: .8, quickRepeatability: .8, naturalVariationUs: 50000,
  normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } };
const physics = { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } };
const policy = { policyId: 'explicit-response', version: 'v1', availableAtDay: 1,
  motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: .5, spinRetentionAtFullFatigue: .75 };

it('reconstructs the exact existing workload state from explicit activities and revisions without modifying history', () => {
  const c = context(), before = JSON.stringify(c), result = restoreLiveWorkloadV122(c),
    expected = advancePlayerWorkloadRecovery(createPlayerWorkloadRecovery(c.baseline), 0, c.activities[0].activity);
  expect(result.state).toEqual(expected); expect(result.state.fatigue).toBe(.5);
  expect(result.nativeAdmission).toBe(false); expect(result.batterExecutionStatus).toBe('NOT_CONNECTED_NO_RESPONSE_CALIBRATION');
  expect(JSON.stringify(c)).toBe(before); expect(Object.isFrozen(result.state.policy)).toBe(true);
  expect(restoreLiveWorkloadV122(c)).toEqual(result);
});

it('applies the shared explicit pitch response exactly once and preserves nominal SI', () => {
  const c = context(), before = JSON.stringify({ c, timing, physics, policy }),
    result = resolveLivePitchWorkloadExecutionV122({ context: c, timingProfile: timing, physics, policy });
  expect(result.execution).toEqual(applyPitchFatigueToExecution(timing, physics, .5, policy, 10));
  expect(result.execution.physics.velocity.z).toBe(-22.5); expect(result.execution.physics.spin.y).toBe(87.5);
  expect(JSON.stringify({ c, timing, physics, policy })).toBe(before);
  expect(result.workload.state.revision).toBe(1);
});

it('advances a canonical snapshot in constant history space and resolves execution without replaying history', () => {
  const c = context(), restored = restoreLiveWorkloadV122(c), activity: PlayerWorkloadActivity = {
    ...c.activities[0].activity, sourceEventId: 'actual-second-pitch', evidenceId: 'physical-effort-2', effortUnits: 1 },
    before = JSON.stringify(restored), next = advanceLiveWorkloadV122({ workload: restored, expectedRevision: 1, activity });
  expect(next.state).toEqual(advancePlayerWorkloadRecovery(restored.state, 1, activity));
  expect(next.state.revision).toBe(2); expect(next.state.fatigue).toBeCloseTo(.6);
  expect(next).not.toHaveProperty('context'); expect(next).not.toHaveProperty('activities');
  expect(JSON.stringify(restored)).toBe(before);
  expect(resolveLivePitchWorkloadExecutionV122({ workload: next, timingProfile: timing, physics, policy }).execution)
    .toEqual(applyPitchFatigueToExecution(timing, physics, next.state.fatigue, policy, 10));
  expect(() => advanceLiveWorkloadV122({ workload: next, expectedRevision: 1, activity })).toThrow();
  expect(() => resolveLivePitchWorkloadExecutionV122({ workload: { ...next, scope: { ...next.scope, playerId: 'other' } }, timingProfile: timing, physics, policy })).toThrow();
});

it('requires actual recovery rather than elapsed-day resets and preserves zero-fatigue execution', () => {
  const c = context(), fresh = { ...c, baseline: { ...c.baseline, fatigue: 0 }, activities: [], expectedRevision: 0 };
  expect(resolveLivePitchWorkloadExecutionV122({ context: fresh, timingProfile: timing, physics, policy }).execution).toEqual({ timingProfile: timing, physics });
  const idle = restoreLiveWorkloadV122({ ...c, scope: { ...c.scope, gameDay: 80 } });
  expect(idle.state.fatigue).toBe(.5);
  const rest: PlayerWorkloadActivity = { sourceEventId: 'actual-rest', sourceVersion: 'v1', evidenceId: 'recovery', careerId: 'career', playerId: 'pitcher',
    atDay: 10, kind: 'RECOVERY', durationHours: 4, quality: 1, medicalAvailability: 1 };
  expect(restoreLiveWorkloadV122({ ...c, activities: [...c.activities, { expectedRevision: 1, activity: rest }], expectedRevision: 2 }).state.fatigue).toBeCloseTo(.3);
});

it('rejects future, borrowed, duplicated and stale workload sources and future response policies', () => {
  const c = context();
  for (const bad of [{ ...c, expectedRevision: 2 }, { ...c, scope: { ...c.scope, playerId: 'other' } },
    { ...c, scope: { ...c.scope, gameDay: 0 } }, { ...c, activities: [{ ...c.activities[0], expectedRevision: 1 }] },
    { ...c, activities: [c.activities[0], { ...c.activities[0], expectedRevision: 1 }], expectedRevision: 2 },
    { ...c, activities: [{ ...c.activities[0], activity: { ...c.activities[0].activity, atDay: 11 } }] }])
    expect(() => restoreLiveWorkloadV122(bad)).toThrow();
  expect(() => resolveLivePitchWorkloadExecutionV122({ context: c, timingProfile: timing, physics, policy: { ...policy, availableAtDay: 11 } })).toThrow();
  let calls = 0;
  expect(() => restoreLiveWorkloadV122(Object.defineProperty({ ...c }, 'baseline', { enumerable: true, get: () => { calls++; return c.baseline; } }))).toThrow();
  expect(calls).toBe(0);
});

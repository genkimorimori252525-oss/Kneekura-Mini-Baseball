import { expect, it, vi } from 'vitest';
import { input } from './PrePitchRunnerFixtures.test-support';
import { executePhysicalPitchAction, physicalPitchActionInput } from './PhysicalPitchEvidenceFromSqlite';
import type { AcceptedPhysicalPitchActionSource, DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';
vi.mock('./ContinuousPlayerPitchRuntime', () => ({ resolveContinuousPlayerPitchAgainstBatterFromWorld: () => ({ pitch: { resolution: { kind: 'recorded' } } }) }));
const source = (): AcceptedPhysicalPitchActionSource => ({ sourceId: 'pitch', sourceVersion: 'v1', gameId: 'game', activationApplicationId: 'activation',
  effortPolicy: { sourceId: 'effort', sourceVersion: 'v1', policyId: 'effort', version: 'v1', availableAtDay: 0, effortUnitsPerPhysicalPitch: 1 },
  request: { workloadRevision: 0, policySourceId: 'policy', delivery: { careerId: 'career', playerId: 'pitcher', gameDay: 1, matchSeed: 1,
    moundReference: { x: 0, y: 0, z: 18 }, outingId: 'outing', readyAtUs: 1_000_000,
    timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 0, z: 0 } } },
    flight: { durationUs: 1_000_000, acceleration: { x: 0, y: 0, z: 0 } }, batter: { action: { kind: 'take' }, plateZ: 0,
      strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1, upperY: 1.8 }, ballRadiusMeters: 0.0366 } } });
const frame = (s: AcceptedPhysicalPitchActionSource) => ({ gameId: s.gameId, effortPolicy: s.effortPolicy,
  workload: { revision: 0, careerId: 'career', playerId: 'pitcher' }, policy: { sourceId: 'policy' }, bindings: [{ gameDay: 1 }],
  matchSeed: 1, outingId: 'outing', moundReference: s.request.delivery.moundReference, match: { playId: 1 },
  prePitchRunner: { source: input() },
} as unknown as DurablePhysicalPitch['frame']);
it('accepts the explicit runner source before consumption while leaving the legacy source bytes unchanged', () => {
  const legacy = source(), owned = { ...legacy, prePitchRunner: input() };
  expect(physicalPitchActionInput(legacy, legacy.sourceId)).toEqual(legacy);
  expect(physicalPitchActionInput(owned, owned.sourceId)).toEqual(owned);
  expect(physicalPitchActionInput(legacy, legacy.sourceId)).not.toHaveProperty('prePitchRunner');
});
it.each(['missing', 'different_id', 'different_route', 'different_pose'])('rejects %s runner ownership on a later pitch or replay', kind => {
  const original = source(), changed = structuredClone(input()) as any;
  if (kind === 'different_id') changed.sourceId = 'different-runner-motion';
  if (kind === 'different_route') changed.route.segments[0].end.x += 1;
  if (kind === 'different_pose') changed.bodyPose.primitiveMotions[0].offsetVelocity.x += 1;
  const next = { ...original, ...(kind === 'missing' ? {} : { prePitchRunner: changed }) };
  expect(() => executePhysicalPitchAction(next, frame(original), {} as any, 1)).toThrow(/runner/);
});

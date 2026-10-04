import { acquiredHistory, fixture, historySource } from './CanonicalWholePlayHistory.test-support';
import type { CanonicalWholePlayHistoryInput } from './CanonicalWholePlayHistory';
import { deriveInitialBattedWorldFieldMotion } from '../ball/BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldAcquisition, advanceBattedWorldScheduledFieldAcquisition } from '../ball/BattedWorldScheduledFieldAcquisition';
export const scheduledFixture = (interruptionAt?: number) => {
  const baseline = fixture(100, 0.0625 / 0.0625001), original = acquiredHistory(baseline), first = original.steps[0];
  if (first.kind !== 'motion') throw new Error('initial fixture');
  const wallX = 1 + (interruptionAt ?? 0) + baseline.response.world.parameters.ballRadius;
  const f = interruptionAt === undefined ? baseline : { ...baseline, response: { ...baseline.response,
    world: { ...baseline.response.world, surfaces: [{ surfaceId: 'capture-wall', start: { x: wallX, z: -1 }, end: { x: wallX, z: 1 }, minimumHeight: 0, maximumHeight: 2 }] },
    surfaces: [{ surfaceId: 'capture-wall', material: { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 } }] } };
  const initial = { ...first, field: deriveInitialBattedWorldFieldMotion(f) };
  const plan = prepareBattedWorldScheduledFieldAcquisition({ response: f.response, geometry: f.geometry, field: initial.field });
  const planStep = { source: historySource(1), previousSourceId: null, kind: 'acquisition_plan' as const,
    basis: initial.source, horizon: initial.field.motion.world.moment, plan };
  const input: CanonicalWholePlayHistoryInput = { ...original, steps: [initial, planStep] };
  const advance = (previous: ReturnType<typeof advanceBattedWorldScheduledFieldAcquisition> | null, throughElapsedSeconds: number, revision: number) => {
    const progress = advanceBattedWorldScheduledFieldAcquisition({ plan, previous, throughElapsedSeconds });
    return { source: historySource(revision), previousSourceId: historySource(revision - 1).sourceId, kind: 'acquisition_advance' as const,
      planSourceId: planStep.source.sourceId, field: initial.field, progress };
  };
  return { f, plan, input, advance };
};

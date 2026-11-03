import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import type { Profiler } from 'node:inspector';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { readCurrentSamePaLifecycleViewFromSqlite, withSamePaLifecycleReadPhase } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativeLifecycleCurrentProfileInputV220 = Readonly<{
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  expectedCurrent: ReturnType<typeof readCurrentSamePaLifecycleViewFromSqlite>;
  expectedPhysicalReference: SamePaReference<'pa_physical_v1_field_steps'>;
}>;

/** Exactly one normal read on a caller-owned readonly snapshot. This new cut22
 * attribution does not repeat the old cut11 measurement or accept any Source. */
export const readNativeLifecycleCurrentOnceV220 = (db: DatabaseSync, viewReference: NativeLifecycleCurrentProfileInputV220['viewReference']) => {
  assert.equal(viewReference.owner, 'pa_lifecycle_v1_execution_views'); assert.equal(viewReference.sourceId, 'physical-fixture:cut22:view');
  return withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference)));
};

/** Offline summarization of an already captured profile. No simulation or SQL
 * runs here; synchronous native work may be charged to its calling JS frame. */
export const summarizeNativeCurrentProfileV220 = (profile: Profiler.Profile) => {
  const samples = profile.samples, deltas = profile.timeDeltas;
  assert(Array.isArray(profile.nodes) && Array.isArray(samples) && Array.isArray(deltas));
  assert(samples.length > 0 && samples.length === deltas.length, 'CPU profile samples and weights missing');
  const nodes = new Map(profile.nodes.map(node => [node.id, node])), weights = new Map<number, { sampleCount: number; microseconds: number }>();
  for (let index = 0; index < samples.length; index++) {
    const id: number = samples[index], delta: number = deltas[index]; assert(nodes.has(id) && Number.isFinite(delta) && delta >= 0, 'invalid CPU sample or weight');
    const previous = weights.get(id) ?? { sampleCount: 0, microseconds: 0 };
    weights.set(id, { sampleCount: previous.sampleCount + 1, microseconds: previous.microseconds + delta });
  }
  const sampledMicroseconds = [...weights.values()].reduce((sum, value) => sum + value.microseconds, 0);
  return { sampleCount: samples.length, sampledTimeMs: sampledMicroseconds / 1000, profilerIntervalMs: (profile.endTime - profile.startTime) / 1000,
    attributionLimit: 'V8_SAMPLE_FRAME_WEIGHTS_ARE_NOT_EXCLUSIVE_JS_CPU; SYNCHRONOUS_NATIVE_CPP_WORK_CAN_BE_CHARGED_TO_ITS_CALLING_FRAME',
    topSelfSampledFrames: [...weights.entries()].sort((a, b) => b[1].microseconds - a[1].microseconds).slice(0, 30).map(([id, weight]) => {
      const frame = nodes.get(id)!.callFrame;
      return { functionName: frame.functionName, url: frame.url, scriptId: frame.scriptId, line: frame.lineNumber < 0 ? null : frame.lineNumber + 1,
        column: frame.columnNumber < 0 ? null : frame.columnNumber + 1, sampleCount: weight.sampleCount, sampledSelfTimeMs: weight.microseconds / 1000,
        sampledWeightFraction: sampledMicroseconds === 0 ? null : weight.microseconds / sampledMicroseconds };
    }) };
};

import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { sampleActualFieldObservation } from './ActualFieldObservation';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Prefix = Parameters<typeof sampleActualFieldObservation>[1];
/** Hash each already rederived snapshot separately only after the new capability opts in.
 * This preserves every original bound/owner/order without re-cloning all repeated roots
 * into one oversized object. It neither caches validation nor trusts stored hash columns. */
export const actualObservationPhysicalPrefixEvidence = (prefix: Prefix): Readonly<{
  physicalPrefixHash: string; physicalPrefixHashConvention?: 'owned_motion_observation_prefix_manifest_v1';
}> => {
  if (!prefix.executions.some(v => ['owned_motion_v1', 'owned_motion_v2', 'owned_acquisition_plan_v1', 'owned_throw_plan_v1'].includes(v.execution.kind))) return { physicalPrefixHash: hash(prefix) };
  const reference = (owner: 'batted_world_field_actions' | 'batted_world_field_executions',
    snapshot: { source: { sourceId: string; sourceVersion: string }; revision: number }) => ({ owner,
    sourceId: snapshot.source.sourceId, sourceVersion: snapshot.source.sourceVersion,
    revision: snapshot.revision, sourceHash: hash(snapshot.source), snapshotHash: owner === 'batted_world_field_executions'
      ? ownedScheduledMotionArchiveHash(snapshot as DurableBattedWorldFieldExecution) : hash(snapshot) });
  const version = 'owned_motion_observation_prefix_manifest_v1' as const;
  const manifest = { version, physicalPitchSourceId: prefix.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId,
    cut: { baseFieldSourceId: prefix.baseField.source.sourceId, executionSourceId: prefix.executions.at(-1)?.source.sourceId ?? null },
    baseField: reference('batted_world_field_actions', prefix.baseField),
    fields: prefix.fields.map(value => reference('batted_world_field_actions', value)),
    executions: prefix.executions.map(value => reference('batted_world_field_executions', value)) };
  return { physicalPrefixHash: hash(manifest), physicalPrefixHashConvention: version };
};

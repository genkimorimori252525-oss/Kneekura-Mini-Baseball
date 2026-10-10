import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
/** Shape-only Source examples. References here are deliberately not ownership
 * proofs and must never be used for a Native admission or genuine fixture. */
export const effectiveDefenderSourceFixture = () => {
  const ref = (owner: string) => ({ owner, sourceId: 'fixture:' + owner, sourceHash: hash(owner), snapshotHash: hash('result:' + owner) });
  const common = { sourceVersion: 'fixture-only-v1', capability: 'same_pa_consumer_action_v1', rightReference: ref('pa_dispatch_v1_rights'),
    physicalSourceReference: { sourceId: 'fixture-pitch', sourceVersion: 'fixture-only-v1', sourceHash: hash('physical') },
    member: { playerId: 'p2', bindingHash: hash('binding'), personHash: hash('person'), baselineSourceId: 'fixture-baseline', reservedRevision: 0,
      reservedStateHash: hash('reserved'), projectedStateHash: hash('projected') } };
  const baseFieldReference = ref('batted_world_field_actions'), executionReference = ref('batted_world_field_executions');
  const decision = { ...common, sourceId: 'fixture-effective-decision', route: 'defender_decision', actionOrdinal: 0,
    calibrationReferences: [{ route: 'defender_decision', calibrationReference: ref('pa_dispatch_v1_execution_calibrations') }],
    originalInputReferences: { observationReference: ref('actual_field_observations'), planReference: ref('actual_defensive_plans'),
      nominalDecisionModelReference: ref('world_player_decision_models'), baseFieldReference, executionReference },
    operation: { kind: 'effective_defender_decision_at_owned_cut_v1' } };
  const command = { ...common, sourceId: 'fixture-effective-command', route: 'defender_locomotion', actionOrdinal: 1,
    calibrationReferences: [{ route: 'defender_locomotion', calibrationReference: ref('pa_dispatch_v1_execution_calibrations') }],
    originalInputReferences: { nominalLocomotionModelReference: ref('world_player_locomotion_models'), baseFieldReference, executionReference },
    operation: { kind: 'command_from_effective_issued_decision_v1', effectiveDecisionReference: ref('pa_dispatch_v1_consumer_actions') } };
  return { decision, command, ref };
};

import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaHash, samePaText, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import type { SamePaPhysicalSourceReference } from './SamePlateAppearanceDispatchSource';
type Route = 'defender_decision' | 'defender_locomotion';
type Base<R extends Route> = Readonly<{ sourceId: string; sourceVersion: string; capability: 'same_pa_consumer_action_v1';
  rightReference: SamePaReference<'pa_dispatch_v1_rights'>; physicalSourceReference: SamePaPhysicalSourceReference; member: SamePaDispatchMember;
  route: R; calibrationReferences: readonly [Readonly<{ route: R; calibrationReference: SamePaReference<'pa_dispatch_v1_execution_calibrations'> }>]; actionOrdinal: number }>;
export type SamePaEffectiveDecisionInputs = Readonly<{
  observationReference: SamePaReference<'actual_field_observations'>; planReference: SamePaReference<'actual_defensive_plans'>;
  nominalDecisionModelReference: SamePaReference<'world_player_decision_models'>; baseFieldReference: SamePaReference<'batted_world_field_actions'>;
  executionReference: SamePaReference<'batted_world_field_executions'> | null;
}>;
export type SamePaEffectiveMotionInputs = Readonly<{
  nominalLocomotionModelReference: SamePaReference<'world_player_locomotion_models'>; baseFieldReference: SamePaReference<'batted_world_field_actions'>;
  executionReference: SamePaReference<'batted_world_field_executions'> | null;
}>;
export type SamePaEffectiveDecisionSource = Base<'defender_decision'> & Readonly<{ originalInputReferences: SamePaEffectiveDecisionInputs;
  operation: Readonly<{ kind: 'effective_defender_decision_at_owned_cut_v1' }> }>;
export type SamePaEffectiveCommandSource = Base<'defender_locomotion'> & Readonly<{ originalInputReferences: SamePaEffectiveMotionInputs;
  operation: Readonly<{ kind: 'command_from_effective_issued_decision_v1'; effectiveDecisionReference: SamePaReference<'pa_dispatch_v1_consumer_actions'> }> }>;
export type SamePaEffectiveDefenderSource = SamePaEffectiveDecisionSource | SamePaEffectiveCommandSource;
const integer = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
const cutValid = (input: SamePaEffectiveMotionInputs | SamePaEffectiveDecisionInputs) => ref(input.baseFieldReference, 'batted_world_field_actions')
  && (input.executionReference === null || ref(input.executionReference, 'batted_world_field_executions'));
export const samePaEffectiveMotionInputsInput = (raw: unknown): SamePaEffectiveMotionInputs => {
  const input = cloneInert(raw) as SamePaEffectiveMotionInputs;
  if (!fields(input, ['nominalLocomotionModelReference', 'baseFieldReference', 'executionReference'])
    || !ref(input.nominalLocomotionModelReference, 'world_player_locomotion_models') || !cutValid(input)) throw new Error('invalid effective motion input references');
  return freeze(input);
};
/** Closed Source-domain validation only. It accepts no owner effects or proof.
 * Native supplies a separately code-derived identity/ordinal when assembling a
 * consumer; matching this expectation is not itself durable ownership. */
export const samePaEffectiveDefenderSourceInput = (raw: unknown, expected?: Readonly<{ sourceId: string; actionOrdinal: number }>): SamePaEffectiveDefenderSource => {
  const s = cloneInert(raw) as SamePaEffectiveDefenderSource;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'rightReference', 'physicalSourceReference', 'member', 'route',
    'calibrationReferences', 'originalInputReferences', 'actionOrdinal', 'operation'])
    || !samePaText(s.sourceId) || !samePaText(s.sourceVersion) || s.capability !== 'same_pa_consumer_action_v1'
    || !ref(s.rightReference, 'pa_dispatch_v1_rights') || !samePaDispatchMemberValid(s.member) || !integer(s.actionOrdinal)
    || !fields(s.physicalSourceReference, ['sourceId', 'sourceVersion', 'sourceHash']) || !samePaText(s.physicalSourceReference.sourceId)
    || !samePaText(s.physicalSourceReference.sourceVersion) || !samePaHash(s.physicalSourceReference.sourceHash)
    || !Array.isArray(s.calibrationReferences) || s.calibrationReferences.length !== 1
    || !fields(s.calibrationReferences[0], ['route', 'calibrationReference']) || s.calibrationReferences[0].route !== s.route
    || !ref(s.calibrationReferences[0].calibrationReference, 'pa_dispatch_v1_execution_calibrations')) throw new Error('invalid effective defender Source fields or references');
  if (expected && (!fields(expected, ['sourceId', 'actionOrdinal']) || !samePaText(expected.sourceId) || !integer(expected.actionOrdinal)
    || expected.sourceId !== s.sourceId || expected.actionOrdinal !== s.actionOrdinal)) throw new Error('effective defender code-owned identity or ordinal differs');
  if (s.route === 'defender_decision') {
    const inputs = s.originalInputReferences;
    if (!fields(inputs, ['observationReference', 'planReference', 'nominalDecisionModelReference', 'baseFieldReference', 'executionReference'])
      || !ref(inputs.observationReference, 'actual_field_observations') || !ref(inputs.planReference, 'actual_defensive_plans')
      || !ref(inputs.nominalDecisionModelReference, 'world_player_decision_models') || !cutValid(inputs)
      || !fields(s.operation, ['kind']) || s.operation.kind !== 'effective_defender_decision_at_owned_cut_v1') throw new Error('invalid effective decision Source union');
  } else if (s.route === 'defender_locomotion') {
    samePaEffectiveMotionInputsInput(s.originalInputReferences);
    if (!fields(s.operation, ['kind', 'effectiveDecisionReference']) || s.operation.kind !== 'command_from_effective_issued_decision_v1'
      || !ref(s.operation.effectiveDecisionReference, 'pa_dispatch_v1_consumer_actions')
      || s.operation.effectiveDecisionReference.sourceId === s.sourceId) throw new Error('invalid effective command Source union');
  } else throw new Error('invalid effective defender Source route');
  return freeze(s);
};

import { expect } from 'vitest';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { appendNativePhysicalFieldActions } from './SamePlateAppearancePhysicalFieldActionsNative.test-support';
import type { appendNativeCatchWork } from './SamePlateAppearanceCatchWorkNative.test-support';
import type { SamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldAction';
import type { SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readSamePaLifecycleCalibrationFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { openSqliteReceivedUmpireDefenderPolicyDataStore, type AcceptedReceivedUmpireDefenderPolicyData } from './SqliteReceivedUmpireDefenderPolicyDataStore';
import { readSamePaAdmittedLiveWorkFromSqlite } from './SamePlateAppearanceAdmittedLiveWorkFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

/** One continuation of IFN01's genuinely received caught action. Core chooses
 * the response and owns its timing; the physical owner must actually reach
 * every boundary before this fixture invokes the next Source. */
export const appendNativeCaughtDefenderResponse = (h: ReturnType<typeof samePaPhysicalLifecycleFixture>, field: ReturnType<typeof appendNativePhysicalFieldActions>,
  caught: ReturnType<typeof appendNativeCatchWork>, label: string) => {
  let previous = caught.observed, ordinal = 0;
  const member = () => h.current().basis.members.find(m => m.playerId === field.playerId)!;
  const append = (throughTick: number, action?: SamePaPhysicalFieldAction): SamePaPhysicalFieldStep => {
    const previousReference = reference('pa_physical_v1_field_steps', previous);
    const source: SamePaPhysicalFieldStepSource = h.save({ sourceId: label + ':' + (++ordinal), sourceVersion: 'fixture-v1', capability: 'same_pa_physical_field_step_v1',
      viewReference: h.current().viewReference, launchReference: previous.source.launchReference, previousOperationReference: previousReference,
      fieldRootReference: previous.source.fieldRootReference, previousFieldReference: previousReference, throughTick, ...(action ? { action } : {}) });
    const value = h.physical.acceptOperation(source.sourceId); if (value.kind !== 'same_pa_physical_field_step_v1') throw new Error('IFN01 response physical step pending');
    h.advance(reference('pa_physical_v1_field_steps', value)); previous = value; return value;
  };
  const initial = { kind: 'defender_catch_response_v1' as const, member: member(), observationReference: reference('pa_physical_v1_field_steps', caught.observed),
    predecessorDecisionReference: field.decision.operationReference, predecessorMotionReference: field.motion.operationReference,
    policyDataReference: null, previousResponseReference: null };
  const unavailable = append(previous.evaluationTick, initial);
  if (unavailable.actionResult?.kind !== 'defender_catch_response_v1') throw new Error('IFN01 received response cause missing');
  expect(unavailable.actionResult.replan.semantic).toBe('call_profile_unavailable'); expect(unavailable.actionResult.issuedBySourceId).toBeNull();
  expect(unavailable.field).toEqual(caught.observed.field);
  const decisionSource = field.decision.value.source.action;
  if (decisionSource?.kind !== 'defender_decision_v1') throw new Error('IFN01 incumbent decision Source missing');
  const model = withSqliteReadTransaction(h.f.db, () => {
    const c = readSamePaLifecycleCalibrationFromSqlite(h.f.db, decisionSource.calibrationReference);
    if (c.source.route !== 'defender_decision') throw new Error('IFN01 incumbent decision model route missing');
    return playerDecisionModelEvidenceFromSqlite(h.f.db).read(c.source.nominalReference.sourceId)!;
  });
  const binding = h.f.actor.defenderBindings.find(d => d.playerId === field.playerId)!;
  const policySource: AcceptedReceivedUmpireDefenderPolicyData = { sourceId: label + ':out-profile', sourceVersion: 'fixture-v1', careerId: binding.careerId,
    playerId: binding.playerId, personLinkSourceId: binding.personLinkSourceId, fieldingModelSourceId: model.fieldingModel.source.sourceId,
    acceptedAtDay: binding.gameDay, capability: 'received_umpire_defender_policy_data_v1', provenance: 'explicit_imported_policy_data_v1',
    profiles: { out: { ballPursuitPriority: 0, holdPriority: 1 }, safe: null } };
  const policyOwner = h.f.x.f.track(openSqliteReceivedUmpireDefenderPolicyDataStore(h.f.path, { readAcceptedPolicyData: id => id === policySource.sourceId ? policySource : null }));
  const policy = policyOwner.accept(policySource.sourceId), policyDataReference = reference('world_received_umpire_defender_policy_data', policy);
  let response = append(previous.evaluationTick, { ...initial, member: member(), policyDataReference, previousResponseReference: reference('pa_physical_v1_field_steps', unavailable) });
  const responseResult = () => { if (response.actionResult?.kind !== 'defender_catch_response_v1') throw new Error('IFN01 real response missing'); return response.actionResult; };
  expect(responseResult().replan.semantic).toBe('ready'); expect(responseResult().replan.selectedAt).toBeNull();
  const advanceTo = (target: number) => {
    while (previous.field.motion.world.moment.elapsedSeconds < (target - previous.field.motion.world.moment.originTick) / field.motion.value.field.motion.actors[0].primitive.ticksPerSecond) {
      const before = previous.field.motion.world.moment.elapsedSeconds;
      if (!previous.field.motion.cursor) throw new Error('IFN01 real boundary blocks caught response progression');
      append(target);
      if (previous.field.motion.world.moment.elapsedSeconds <= before) throw new Error('IFN01 caught response made no real physical progress');
    }
  };
  const resume = () => {
    response = append(previous.evaluationTick, { ...initial, member: member(), policyDataReference, previousResponseReference: reference('pa_physical_v1_field_steps', response) });
  };
  const decisionTick = responseResult().replan.scheduling!.decisionTick;
  advanceTo(decisionTick); resume();
  expect(responseResult().replan.selectedAt?.tick).toBe(decisionTick); expect(responseResult().issuedBySourceId).toBe(response.source.sourceId);
  const issuer = response.source.sourceId, movementStartTick = responseResult().replan.scheduling!.movementStartTick!;
  advanceTo(movementStartTick); if (movementStartTick !== decisionTick) resume();
  expect(responseResult().replan.phase).toBe('renewal_due'); expect(responseResult().issuedBySourceId).toBe(issuer);
  const c = h.current().calibrationSet.calibrations.find(c => c.source.member.playerId === field.playerId && c.source.route === 'defender_locomotion')!;
  const adopted = append(previous.evaluationTick + 1, { kind: 'defender_motion_v1', selections: [{ member: member(),
    decisionReference: reference('pa_physical_v1_field_steps', response), calibrationReference: reference('pa_lifecycle_v1_execution_calibrations', c) }] });
  if (adopted.actionResult?.kind !== 'defender_motion_v1') throw new Error('IFN01 caught response adoption missing');
  expect(adopted.actionResult.motors[0].issuedAt).toEqual(responseResult().replan.selectedAt);
  const census = withSqliteReadTransaction(h.f.db, () => readSamePaAdmittedLiveWorkFromSqlite(h.f.db, h.current().viewReference, 'current'));
  if (census.kind !== 'same_pa_live_work_read_v1') throw new Error('IFN01 adopted response census missing');
  expect(census.census.catchResponses.pending).toEqual([]); expect(census.census.catchResponses.adopted).toHaveLength(1);
  expect(census.closure.physicalEnd).toBeNull();
  expect(h.physical.readOperation(reference('pa_physical_v1_field_steps', adopted)).record).toEqual(adopted);
  return { unavailable, response, adopted, census };
};

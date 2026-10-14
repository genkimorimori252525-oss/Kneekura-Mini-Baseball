import { expect } from 'vitest';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { appendNativePhysicalFieldActions } from './SamePlateAppearancePhysicalFieldActionsNative.test-support';
import { samePaOfficialSourceReference as externalReference, type AcceptedSamePaOfficialPerson, type AcceptedSamePaCatchAssignment,
  type AcceptedSamePaCatchAction, type AcceptedSamePaCatchCommunication } from './SamePlateAppearanceCatchCommunicationSource';
import type { AcceptedActualCommunicationModel } from './ActualCallCommunication';
import type { AcceptedSamePaCatchWork } from './SamePlateAppearanceCatchWork';
import { openSqliteSamePlateAppearanceCatchWorkStore } from './SamePlateAppearanceCatchWorkFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readSamePaAdmittedLiveWorkFromSqlite } from './SamePlateAppearanceAdmittedLiveWorkFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

/** Add to the existing IFN01 physical scenario; explicit original action and
 * declared synthetic reception conditions exercise ownership, not perception
 * quality, controller completion or a fixture-selected official outcome. */
export const appendNativeCatchWork = (h: ReturnType<typeof samePaPhysicalLifecycleFixture>, field: ReturnType<typeof appendNativePhysicalFieldActions>, label: string,
  options: Readonly<{ otherRecipientDelayTicks?: number; batterRecipientDelayTicks?: number }> = {}) => {
  const b = h.current(), moment = field.motion.value.field.motion.world.moment;
  const at = { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick };
  const person: AcceptedSamePaOfficialPerson = h.save({ sourceId: label + ':person', sourceVersion: 'fixture-v1', capability: 'accepted_original_umpire_person_v1',
    careerId: b.view.lineage.careerId, officialId: 'fixture-catch-umpire', personId: 'fixture-catch-umpire-person' });
  const assignment: AcceptedSamePaCatchAssignment = h.save({ sourceId: label + ':assignment', sourceVersion: 'fixture-v1', capability: 'same_pa_explicit_catch_assignment_v1',
    enrollmentReference: b.view.lineage.enrollmentReference, gameId: b.view.lineage.gameId, playId: b.view.lineage.playId,
    physicalPitchSourceId: b.view.cut.physicalPitchReference.sourceId, officialId: person.officialId, personId: person.personId, personReference: externalReference(person),
    policy: { sourceId: label + ':accepted-action-policy', sourceVersion: 'fixture-v1', ruleProfileId: h.f.actor.match.ruleProfileId, kind: 'accepted_original_official_action_v1' },
    pose: { position: { x: 0, y: 1.7, z: 0 }, validFromElapsedSeconds: at.elapsedSeconds, validThroughElapsedSeconds: at.elapsedSeconds } });
  const action: AcceptedSamePaCatchAction = h.save({ sourceId: label + ':action', sourceVersion: 'fixture-v1', capability: 'same_pa_explicit_catch_action_v1',
    assignmentReference: externalReference(assignment), officialId: person.officialId, personId: person.personId,
    viewReference: b.viewReference, judgment: 'caught', calledAt: at });
  const model: AcceptedActualCommunicationModel = h.save({ sourceId: label + ':reception-model', sourceVersion: 'fixture-v1', gameId: b.view.lineage.gameId,
    physicalPitchSourceId: b.view.cut.physicalPitchReference.sourceId, parameters: { version: 'fixed_receiver_conditions_v1', timing: 'exact_sent_plus_core_delay_ticks_v1',
      receivers: b.view.lineage.participantReferences.map(p => ({ playerId: p.playerId, conditions: { propagationDelayTicks: p.playerId === field.playerId ? 0
        : p.playerId === h.f.actor.binding.playerId ? options.batterRecipientDelayTicks ?? options.otherRecipientDelayTicks ?? 0 : options.otherRecipientDelayTicks ?? 0, recognitionBaseDelayTicks: 0,
        maxAdditionalRecognitionDelayTicks: 0, audibility: 1, recognition: 1, attention: 1, minimumRecognizableQuality: 0.5 } })) } });
  const communication: AcceptedSamePaCatchCommunication = h.save({ sourceId: label + ':communication', sourceVersion: 'fixture-v1', capability: 'same_pa_explicit_catch_communication_v1',
    viewReference: b.viewReference, actionReference: externalReference(action), modelReference: externalReference(model) });
  const source: AcceptedSamePaCatchWork = h.save({ sourceId: label + ':work', sourceVersion: 'fixture-v1', capability: 'same_pa_catch_work_v1',
    enrollmentReference: b.view.lineage.enrollmentReference, viewReference: b.viewReference, communicationReference: externalReference(communication), priorWorkReference: null });
  const get = (id: string) => h.accepted.get(id) ?? null;
  const owner = h.f.x.f.track(openSqliteSamePlateAppearanceCatchWorkStore(h.f.path, { readAcceptedWork: get, readAcceptedCommunication: get,
    readAcceptedAction: get, readAcceptedAssignment: get, readAcceptedOfficialPerson: get,
    readAcceptedReceptionModel: id => id === model.sourceId ? model : null }));
  const work = owner.accept(source.sourceId); if (work.kind !== 'same_pa_catch_work_v1') throw new Error('IFN01 catch original action admission pending');
  expect(work.communication.emitted?.content.judgment).toBe('caught'); expect(work.operative.kind).toBe('retired');
  for (const recipient of work.communication.recipients) {
    const delay = recipient.playerId === field.playerId ? 0 : recipient.playerId === h.f.actor.binding.playerId
      ? options.batterRecipientDelayTicks ?? options.otherRecipientDelayTicks ?? 0 : options.otherRecipientDelayTicks ?? 0;
    expect(recipient.kind).toBe(delay ? 'scheduled' : 'received');
  }
  const workReference = reference('pa_catch_v1_work', work);
  expect(() => withSqliteReadTransaction(h.f.db, () => readSamePaAdmittedLiveWorkFromSqlite(h.f.db, b.viewReference, 'current'))).toThrow();
  h.advance(workReference);
  const current = h.current(), original = field.observation.value.source.action;
  if (original?.kind !== 'defender_observation_v1') throw new Error('IFN01 original observation Source missing');
  const calibration = current.calibrationSet.calibrations.find(c => c.source.member.playerId === field.playerId && c.source.route === 'defender_observation')!;
  const observationSource = h.save({ ...field.motion.value.source, sourceId: label + ':received-observation', viewReference: current.viewReference,
    previousOperationReference: field.motion.operationReference, previousFieldReference: field.motion.operationReference, throughTick: at.tick,
    action: { ...original, member: current.basis.members.find(m => m.playerId === field.playerId)!, calibrationReference: reference('pa_lifecycle_v1_execution_calibrations', calibration),
      previousObservationReference: field.observation.operationReference, catchWorkReference: workReference } });
  const observed = h.physical.acceptOperation(observationSource.sourceId);
  if (observed.kind !== 'same_pa_physical_field_step_v1' || observed.actionResult?.kind !== 'defender_observation_v1') throw new Error('IFN01 catch sensory consumer pending');
  expect(observed.actionResult.receipt.perceived.communications).toHaveLength(1);
  expect(observed.actionResult.catchCommunication?.result.kind).toBe('received');
  expect(observed.field).toEqual(field.motion.value.field);
  h.advance(reference('pa_physical_v1_field_steps', observed));
  const census = withSqliteReadTransaction(h.f.db, () => readSamePaAdmittedLiveWorkFromSqlite(h.f.db, h.current().viewReference, 'current'));
  if (census.kind !== 'same_pa_live_work_read_v1' || census.communication.kind !== 'owned_same_pa_catch_communication_v1') throw new Error('IFN01 catch admitted census missing');
  expect(census.communication.workReferences).toEqual([workReference]); expect(census.communication.observations).toHaveLength(1);
  expect(census.closure.physicalEnd).toBeNull();
  const reopened = h.f.x.f.track(openSqliteSamePlateAppearanceCatchWorkStore(h.f.path));
  expect(reopened.read(source.sourceId)).toEqual(work); expect(reopened.accept(source.sourceId)).toEqual(work);
  return { work, workReference, observed, census };
};

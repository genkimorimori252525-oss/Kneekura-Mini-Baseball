import { expect } from 'vitest';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { appendNativeCatchWork } from './SamePlateAppearanceCatchWorkNative.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaOfficialSourceReference as externalReference } from './SamePlateAppearanceCatchCommunicationSource';
import { openSqliteSamePlateAppearanceCatchWorkStore } from './SamePlateAppearanceCatchWorkFromSqlite';
import { readSamePaFieldRuleEvidenceFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readSamePaAdmittedLiveWorkFromSqlite } from './SamePlateAppearanceAdmittedLiveWorkFromSqlite';
import { completeSamePaTerminalFixture } from './SamePlateAppearanceTerminalLifecycleFixture.test-support';
import { readPhysicalClosureScoringHistory } from './PhysicalPlayClosureEvidenceFromSqlite';
import { openSqlitePhysicalPlateAppearanceActorStore } from './SqlitePhysicalPlateAppearanceActorStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import type { AcceptedSamePaLifecycleOutcome } from './SamePlateAppearanceLifecycleOutcome';

/** Continue IFN01's original Native graph. No field, end, controller-completion
 * receipt, workload AFTER, official result or scoring record is supplied here. */
export const completeNativeFairCatchTerminal = (h: ReturnType<typeof samePaPhysicalLifecycleFixture>, root: SamePaPhysicalFieldRoot,
  previous: SamePaPhysicalFieldStep, caught: ReturnType<typeof appendNativeCatchWork>, label: string) => {
  const { f } = h, track = f.x.f.track, before = h.current();
  const originalRule = withSqliteReadTransaction(f.db, () => readSamePaFieldRuleEvidenceFromSqlite(f.db, before.viewReference, 'current'));
  if (originalRule.kind !== 'same_pa_field_rule_evidence_v1' || originalRule.fairCatch.kind !== 'same_pa_fair_catch_rule_basis_v1')
    throw new Error('IFN01 terminal composition requires its genuinely executed airborne fair catch');
  expect(originalRule.fairCatch.pendingContacts).toEqual([]); expect(originalRule.fairCatch.pendingPossession).toEqual([]);
  expect(root.source.liveProducerProfile).toBe('same_pa_empty_base_catch_v1');
  expect(Math.min(...previous.field.motion.actors.map(a => a.primitive.endTick))).toBeGreaterThan(previous.evaluationTick);
  const previousReference = reference('pa_physical_v1_field_steps', previous);
  const sealSource: SamePaPhysicalFieldStepSource = h.save({ sourceId: label + ':seal', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_field_step_v1',
    viewReference: before.viewReference, launchReference: previous.source.launchReference, previousOperationReference: previousReference,
    previousFieldReference: previousReference, fieldRootReference: reference('pa_physical_v1_field_roots', root), throughTick: previous.evaluationTick,
    action: { kind: 'retained_quantizer_checkpoint_v1' } });
  const sealed = h.physical.acceptOperation(sealSource.sourceId);
  if (sealed.kind !== 'same_pa_physical_field_step_v1' || sealed.actionResult?.kind !== 'retained_quantizer_checkpoint_v1') throw new Error('IFN01 real physical seal is pending');
  expect(sealed.actionResult.status).toBe('checkpoint_reached'); expect(sealed.field.motion.actors).toEqual(previous.field.motion.actors);
  expect(sealed.field.motion.world.moment.elapsedSeconds).toBe(sealed.actionResult.boundary.lastIncludedElapsedSeconds);
  expect(sealed.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(previous.field.motion.world.moment.elapsedSeconds);
  expect(sealed.evaluationTick).toBe(previous.evaluationTick); h.advance(reference('pa_physical_v1_field_steps', sealed));
  const cut = h.current(), communication = h.save({ ...caught.work.originalInputs.source, sourceId: label + ':communication', viewReference: cut.viewReference });
  const workSource = h.save({ sourceId: label + ':catch-work', sourceVersion: 'fixture-only-v1', capability: 'same_pa_catch_work_v1' as const,
    enrollmentReference: cut.view.lineage.enrollmentReference, viewReference: cut.viewReference,
    communicationReference: externalReference(communication), priorWorkReference: caught.workReference });
  const get = (id: string) => h.accepted.get(id) ?? null;
  const originalModel = caught.work.originalInputs.model;
  if (!originalModel) throw new Error('IFN01 original accepted reception model is missing');
  const works = track(openSqliteSamePlateAppearanceCatchWorkStore(f.path, { readAcceptedWork: get, readAcceptedCommunication: get,
    readAcceptedAction: get, readAcceptedAssignment: get, readAcceptedOfficialPerson: get,
    readAcceptedReceptionModel: id => id === originalModel.sourceId ? originalModel : null }));
  const work = works.accept(workSource.sourceId); if (work.kind !== 'same_pa_catch_work_v1') throw new Error('IFN01 sealed reception owner is pending');
  expect(work.originalInputs.action).toEqual(caught.work.originalInputs.action);
  expect(work.communication.evaluatedThrough.elapsedSeconds).toBe(sealed.field.motion.world.moment.elapsedSeconds);
  const workReference = reference('pa_catch_v1_work', work); h.advance(workReference);
  const current = h.current(), admitted = withSqliteReadTransaction(f.db, () => readSamePaAdmittedLiveWorkFromSqlite(f.db, current.viewReference, 'current'));
  if (admitted.kind !== 'same_pa_live_work_read_v1' || admitted.communication.kind !== 'owned_same_pa_catch_communication_v1') throw new Error('IFN01 final admitted work missing');
  expect(admitted.communication.recipients.filter(r => r.reception.kind === 'received')).toHaveLength(1);
  expect(admitted.communication.recipients.filter(r => r.reception.kind === 'scheduled')).toHaveLength(9);
  expect(admitted.communication.recipients.find(r => r.reception.kind === 'received')?.controllerResponse.kind).toBe('adopted');
  expect(admitted.census.runnerPlans).toHaveLength(1); expect(admitted.census.runnerPlans[0].due).toBe('future');
  expect(admitted.census.observationRefresh.pending.every(item => item.due === 'future')).toBe(true);
  const source: Extract<AcceptedSamePaLifecycleOutcome, { kind: 'fair_catch' }> = { sourceId: label + ':outcome', sourceVersion: 'fixture-only-v1',
    capability: 'same_pa_lifecycle_outcome_v1', enrollmentReference: current.view.lineage.enrollmentReference, viewReference: current.viewReference,
    physicalOperationReference: current.view.cut.physicalOperationReference, kind: 'fair_catch', rulePolicy: null, catchWorkReference: workReference,
    officialPolicy: { sourceId: label + ':window-policy', sourceVersion: 'explicit-fixture-v1', ruleProfileId: f.actor.match.ruleProfileId,
      officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } },
    official: { sourceId: label + ':scheduler', sourceVersion: 'fixture-only-v1', schedulerId: 'explicit-fixture-scheduler', events: [
      { sourceId: label + ':advance', sourceVersion: 'fixture-only-v1', schedulerId: 'explicit-fixture-scheduler', kind: 'advance_tick' },
      { sourceId: label + ':fence', sourceVersion: 'fixture-only-v1', schedulerId: 'explicit-fixture-scheduler', kind: 'next_play_fence' }] } };
  const completed = completeSamePaTerminalFixture(h, label, source);
  expect(completed.outcome.fairCatch?.generation.receivedControllerHandoffs).toHaveLength(1);
  expect(completed.outcome.fairCatch?.registry.frontier.information).toHaveLength(9 + admitted.census.observationRefresh.pending.length);
  expect(completed.outcome.fairCatch?.registry.frontier.physical).toHaveLength(10);
  expect(completed.outcome.physicalEnd?.tick).toBe(sealed.evaluationTick);
  const history = withSqliteReadTransaction(f.db, () => readPhysicalClosureScoringHistory(f.db, { gameId: f.actor.source.gameId,
    officialRevision: completed.transition.official.receipt.durableRevision }));
  expect(history.at(-1)?.scoring).toEqual(completed.transition.scoring);
  expect(history.at(-1)?.after).toEqual(completed.transition.official.receipt.appliedMatchState);
  const nextSource = { sourceId: label + ':next-batter', sourceVersion: 'fixture-only-v1', gameId: f.actor.source.gameId,
    playerId: 'away-2', activationApplicationId: completed.transition.source.applicationId };
  f.x.accepted.set(nextSource.sourceId, nextSource); const next = f.x.actors.accept(nextSource.sourceId);
  if (!('activationApplicationId' in next.source)) throw new Error('IFN01 next batter lacks its original activation');
  expect(next.source.activationApplicationId).toBe(completed.transition.source.applicationId);
  if (!('activation' in completed.transition.official)) throw new Error('IFN01 terminal catch did not activate a next play');
  expect(next.match).toEqual(completed.transition.official.activation.nextMatchState);
  const actorRows = f.db.prepare('SELECT * FROM physical_plate_appearance_actors ORDER BY source_id').all();
  const saved = json(actorRows), reopened = track(openSqlitePhysicalPlateAppearanceActorStore(f.path, f.x.sources));
  expect(reopened.read(nextSource.sourceId)).toEqual(next); expect(reopened.accept(nextSource.sourceId)).toEqual(next);
  expect(json(f.db.prepare('SELECT * FROM physical_plate_appearance_actors ORDER BY source_id').all())).toBe(saved);
  works.close(); const reopenedWork = track(openSqliteSamePlateAppearanceCatchWorkStore(f.path));
  expect(reopenedWork.read(workSource.sourceId)).toEqual(work); expect(reopenedWork.accept(workSource.sourceId)).toEqual(work);
  return { sealed, work, ...completed, next };
};

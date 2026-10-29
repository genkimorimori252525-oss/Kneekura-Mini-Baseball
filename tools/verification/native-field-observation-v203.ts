import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
  readSamePaLifecycleSetFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readCurrentSamePaInFlightCutFromSqlite, readSamePaPhysicalActionFromSqlite, readSamePaPhysicalFieldCalibrationFromSqlite,
  readSamePaPhysicalOperationFromSqlite, openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite, openSqliteBattingPerceptionStore } from '../../src/host/world/SqliteBattingPerceptionStore';
import { readSamePaBattingIntentFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { readSamePaPreparedActionFromSqlite, openSqliteSamePlateAppearanceDispatchStore } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { playerBattingModelEvidenceFromSqlite } from '../../src/host/world/PlayerBattingModelEvidence';
import { battedBodyModelMaterializationEvidenceFromSqlite } from '../../src/host/world/BattedBodyModelMaterializationEvidence';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from '../../src/host/world/PlayerBodyCapabilityMaterializationEvidence';
import { readBattingEmotionGenesisFromSqlite } from '../../src/host/world/SqliteBattingEmotionStore';
import { prepareSamePaLifecycleFixture } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { continueNativeSpinNeutralV193PostObservation, type NativeSpinNeutralPostObservationContextV193 } from '../../src/host/world/InFlightBattingLifecycleFixture.test-support';
import { openSqliteWorldControlStore } from '../../src/host/world/SqliteWorldControlStore';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
import type { prepareNativeFieldCaptureV199 } from './native-field-continuation-v199';
import { createNativeFieldPreparationV198Declaration } from './native-field-preparation-v198';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativeFieldObservationV203Input = Readonly<Pick<ReturnType<typeof prepareNativeFieldCaptureV199>,
  'retainedInputReferences' | 'resumePins' | 'precedingLifecycleViewReference' | 'eventReferences'>>;
const label = 'native-spin-neutral-v193:pitch3';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V203 retained owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V203 normal retained prerequisite missing'); return value; };

/** Owned-copy continuation of V199's unadmitted capture. The only new work is
 * two normal lifecycle advances and one normal observation. No batting tail is
 * run beyond the existing post-observation helper's authenticated cut4 entry. */
export function admitNativeFieldObservationV203(path: string, input: NativeFieldObservationV203Input, emit: (name: string, value?: unknown) => void) {
  assert.equal(input.eventReferences.length, 2); assert.equal(input.precedingLifecycleViewReference.sourceId, 'physical-fixture:cut2:view');
  assert.deepStrictEqual(input.retainedInputReferences.futureProfileDeclarationOnly, createNativeFieldPreparationV198Declaration());
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path), owners = new Set<{ close(): void }>();
  const track = <T extends { close(): void }>(owner: T): T => { owners.add(owner); return owner; };
  const release = (owner: { close(): void }) => { owner.close(); owners.delete(owner); };
  const locate = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => {
    // Locator only; every returned reference is authenticated by its normal reader.
    const row = must(db.prepare(`SELECT source_hash,snapshot_hash FROM main.${owner} WHERE source_id=?`).get(sourceId));
    return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
  };
  let failure: unknown;
  try {
    const preparation = input.retainedInputReferences, refs = preparation.retainedInputReferences, pins = input.resumePins;
    same(pins.postureReference, refs.postureReference); same(pins.intentReference, refs.intentReference);
    const original = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const actor = must(readPhysicalPlateAppearanceActorFromSqlite(db, refs.actorReference.sourceId));
      same(reference('physical_plate_appearance_actors', actor), refs.actorReference);
      assert.equal(actor.binding.careerId, 'career-a'); assert.equal(actor.binding.playerId, 'away-1'); assert.equal(actor.binding.gameDay, 40);
      const capture = readCurrentSamePaInFlightCutFromSqlite(db, pins.captureCutReference);
      if (capture.record.kind !== 'same_pa_physical_cut_v1' || capture.stage !== 'in_flight' || capture.record.operationOrdinal !== 1) throw Error('V203 normal first capture required');
      const captureCut = capture.record; same(capture.actor, actor); same(capture.physicalPitchReference, pins.launchReference);
      same(captureCut.source.sourceId, label + ':capture-cut'); same(captureCut.source.viewReference, input.precedingLifecycleViewReference);
      same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record;
      if (launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight') throw Error('V203 normal original launch required');
      same(launch.source.sourceId, label + ':launch'); same(launch.lineage, captureCut.lineage);
      const preceding = readHistoricalSamePaLifecycleViewFromSqlite(db, input.precedingLifecycleViewReference);
      same(preceding.actor, actor); same(preceding.view.cut.physicalOperationReference, pins.launchReference);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', preceding.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V203 preceding historical prefix required');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), preceding.view.source.prefixReference); same(prefix.source.eventReferences, input.eventReferences);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', preceding.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V203 original TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), preceding.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const calibrationIds = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(input.precedingLifecycleViewReference.sourceId).map(row => String(row.source_id));
      assert.equal(calibrationIds.length, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', calibrationIds)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V203 original calibration missing'); return value; });
      for (const calibration of calibrations) same(calibration.source.viewReference, input.precedingLifecycleViewReference);
      const sensor = must(calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === actor.binding.playerId));
      if (sensor.source.response.kind !== 'accepted_execution_values_v1') throw Error('V203 original explicit observation response missing');
      const observationValues = sensor.source.response.values as AcceptedBattingObservationCalibration['values'];
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(observationValues.calibration.errorParameters[key], 0);
      const action = readSamePaPhysicalActionFromSqlite(db, refs.actionReference); same(action.actor, actor); same(action.source.viewReference, refs.viewReference);
      same(launch.source.actionReference, refs.actionReference); same(launch.source.viewReference, refs.viewReference);
      const posture = readBattingPerceptionFromSqlite(db, 'posture', pins.postureReference);
      if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V203 original in-flight posture missing');
      const intent = readSamePaBattingIntentFromSqlite(db, pins.intentReference);
      same(posture.lineage, action.lineage); same(intent.lineage, action.lineage); same(posture.source.actionReference, refs.actionReference);
      same(posture.source.viewReference, refs.viewReference); same(intent.source.viewReference, refs.viewReference); same(intent.source.postureReference, pins.postureReference);
      const model = must(playerBattingModelEvidenceFromSqlite(db).read(refs.modelReference.sourceId));
      same(reference('world_player_batting_models', model), refs.modelReference); same(posture.model, model); same(action.source.batterModelReference, refs.modelReference);
      const fieldCalibration = readSamePaPhysicalFieldCalibrationFromSqlite(db, preparation.calibrationReference);
      same(fieldCalibration.source.actionReference, refs.actionReference); same(fieldCalibration.source.postureReference, pins.postureReference);
      same(fieldCalibration.source.viewReference, refs.viewReference); same(fieldCalibration.source.bodyModelReference, preparation.bodyModelReference);
      const bodyModel = must(battedBodyModelMaterializationEvidenceFromSqlite(db).read(preparation.bodyModelReference.sourceId));
      same(locate('world_batted_body_materializations', bodyModel.sourceId), preparation.bodyModelReference); same(fieldCalibration.calibration.model, bodyModel); assert.equal(bodyModel.actors.length, 10);
      const batterBody = must(playerBodyCapabilityMaterializationEvidenceFromSqlite(db).read(preparation.batterBodyReference.sourceId));
      same(reference('world_player_body_materializations', batterBody), preparation.batterBodyReference);
      same(batterBody.source, refs.matchDayBatterPreparation.request); same(batterBody.actor, posture.model.bodyMaterialization.actor); assert.equal(batterBody.source.atDay, actor.binding.gameDay);
      const qualifications = refs.qualificationReferences.map(ref => {
        const value = must(readNativeSpinControlMasteryV123(db, ref.sourceId)); same(reference('world_spin_mastery_v123', value), ref);
        assert.equal(value.source.careerId, actor.binding.careerId); assert.equal(value.source.playerId, actor.binding.playerId);
        assert.equal(value.source.personLinkSourceId, actor.person.sourceId); assert.equal(value.person.personId, actor.binding.personId);
        assert(value.source.acceptedAtDay <= actor.binding.gameDay); same(value.source.repertoireRef, model.source.repertoireRef); return value;
      });
      assert.deepStrictEqual(qualifications.map(q => q.source.technique), ['BACKSPIN', 'TOPSPIN']);
      assert.equal(new Set(qualifications.map(q => q.source.sourceEffectIdentity)).size, 2);
      assert.equal(new Set(qualifications.map(q => q.projection.qualified[0].episodeId)).size, 2);
      assert.equal(new Set(qualifications.flatMap(q => q.contacts.map(c => c.eventId))).size, 6);
      const acceptedAction = readSamePaPreparedActionFromSqlite(db, locate('pa_dispatch_v1_action_plans', 'native-action'));
      same(acceptedAction.lineage, action.lineage);
      const dispatchCalibrationIds = db.prepare('SELECT source_id FROM main.pa_dispatch_v1_execution_calibrations WHERE enrollment_source_id=? ORDER BY rowid')
        .all(action.lineage.enrollmentReference.sourceId).map(row => String(row.source_id)); assert.equal(dispatchCalibrationIds.length, 32);
      const genesis = must(readBattingEmotionGenesisFromSqlite(db, 'physical-fixture:emotion-genesis'));
      const physicalHead = db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(action.lineage.enrollmentReference.sourceId);
      assert.equal(physicalHead.length, 1); assert.equal(physicalHead[0].last_owner, pins.captureCutReference.owner);
      assert.equal(physicalHead[0].last_source_id, pins.captureCutReference.sourceId); assert.equal(physicalHead[0].last_snapshot_hash, pins.captureCutReference.snapshotHash);
      return { actor, captureCut, launch, preceding, prefix, totals, calibrations, observationValues, action, posture, intent,
        model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, dispatchCalibrationIds, genesis, physicalHead };
    }));
    emit('retained-current-capture-and-historical-cut2-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(original.dispatchCalibrationIds); release(dispatch); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(source: T): T => { accepted.set(source.sourceId, source); emit('inert-source-declaration-before-acceptance', source); return source; };
    const f = { db, path, actor: original.actor, acceptedAction: original.acceptedAction, acceptedCalibrations, x: { f: { track } } };
    const events = [...original.prefix.source.eventReferences], efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    let basis: ReturnType<NativeSpinNeutralPostObservationContextV193['current']> = { view: original.preceding.view, viewReference: input.precedingLifecycleViewReference,
      basis: original.preceding, calibrationSet: { calibrations: original.calibrations } };
    let advances = 0;
    const advance: NativeSpinNeutralPostObservationContextV193['advance'] = event => {
      assert(advances < 2, 'V203 only two lifecycle advances are admitted');
      if (advances === 0) same(event, pins.captureCutReference);
      else { assert.equal(event.owner, 'batting_observation_v1_observations'); assert.equal(event.sourceId, label + ':capture'); }
      events.push(event); const cutLabel = 'physical-fixture:cut' + events.length;
      emit('advance-' + events.length + '-start', { eventReference: event, anchorViewReference: original.prefix.source.anchorViewReference, eventReferences: [...events], efforts });
      const next = prepareSamePaLifecycleFixture(f, original.prefix.source.anchorViewReference, [...events], cutLabel, efforts, original.observationValues,
        undefined, undefined, undefined, stage => emit('advance-' + events.length + '-' + stage));
      basis = { view: next.view, viewReference: next.viewReference, basis: next.basis, calibrationSet: { calibrations: next.calibrationSet.calibrations } };
      advances++; emit('advance-' + events.length + '-accepted', { eventReference: event, prefix: next.prefix, totalSet: next.totalSet,
        viewReference: next.viewReference, view: next.view, calibrationSet: next.calibrationSet }); release(next.owner); return next;
    };
    advance(pins.captureCutReference);
    assert.equal(basis.viewReference.sourceId, 'physical-fixture:cut3:view');
    const member = () => must(basis.basis.members.find(m => m.playerId === f.actor.binding.playerId));
    const calibration = () => reference('pa_lifecycle_v1_execution_calibrations', must(basis.calibrationSet.calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === member().playerId)));
    // The declarations below reproduce InFlightBattingLifecycleFixture:130–140.
    const captureSource = save({ sourceId: label + ':capture', sourceVersion: 'fixture-only-v1', capability: 'owned_in_flight_batting_observation_v1',
      viewReference: basis.viewReference, member: member(), postureReference: pins.postureReference, physicalPitchReference: pins.launchReference,
      physicalOperationReference: pins.captureCutReference, calibrationReference: calibration(), observedTick: original.captureCut.evaluationTick, previousObservationReference: null });
    const wrongTime = save({ ...captureSource, sourceId: label + ':wrong-time-capture', observedTick: captureSource.observedTick + 1 });
    const perception = track(openSqliteBattingPerceptionStore(path, { readAcceptedObservation: id => accepted.get(id) }));
    assert.equal(perception.readObservation(captureSource.sourceId), null);
    const sensoryHead = () => db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
      .all('batting_observation_v1_observations', original.action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, original.actor.binding.playerId);
    const headBefore = sensoryHead(); assert.equal(headBefore.length, 0, 'V203 raw scope locator must be absent before its first normal observation');
    let wrongTimeRejected = false, wrongTimeError: string | null = null;
    try { perception.acceptObservation(wrongTime.sourceId); } catch (error) { wrongTimeRejected = true; wrongTimeError = String((error as Error).stack ?? error); }
    assert.equal(wrongTimeRejected, true); const wrongTimeSourceRows = db.prepare('SELECT source_id FROM main.batting_observation_v1_observations WHERE source_id=?').all(wrongTime.sourceId).length;
    assert.equal(wrongTimeSourceRows, 0); same(sensoryHead(), headBefore);
    emit('normal-wrong-time-observation-rejected', { wrongTimeSource: wrongTime, wrongTimeRejected, wrongTimeError, wrongTimeSourceRows,
      sensoryHeadBefore: headBefore, sensoryHeadAfter: sensoryHead(), rawHeadAbsenceIsLocatorOnly: true });
    const observation = perception.acceptObservation(captureSource.sourceId);
    if (observation.kind !== 'batting_observation') throw Error('V203 normal observation pending');
    const observationReference = reference('batting_observation_v1_observations', observation);
    same(perception.readObservation(observation.source.sourceId), observation);
    const headAfter = sensoryHead(); assert.equal(headAfter.length, 1); assert.equal(headAfter[0].revision, 1);
    assert.equal(headAfter[0].first_source_id, observationReference.sourceId); assert.equal(headAfter[0].last_source_id, observationReference.sourceId);
    assert.equal(headAfter[0].last_snapshot_hash, observationReference.snapshotHash);
    emit('normal-observation-accepted-before-lifecycle-admission', { observation, observationReference, sensoryHead: headAfter });
    advance(observationReference); release(perception); assert.equal(advances, 2); assert.equal(events.length, 4);
    const resumePins = { ...pins, observationReference };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path));
    const worldOwner = track(openSqliteWorldControlStore(path));
    const originalAction = original.acceptedAction.source;
    if (originalAction.variant !== 'declared_take_v1') throw Error('V203 original dispatch first TAKE Source differs');
    const h: NativeSpinNeutralPostObservationContextV193 = { f, accepted, save, events, current: () => basis, advance, physical,
      original: originalAction, genesis: original.genesis, worldOwner };
    const stop = new Error('V203_STOP_AFTER_NORMAL_POST_OBSERVATION_CURRENT_AUTHENTICATION'); let postObservationCurrentProven = false;
    try {
      continueNativeSpinNeutralV193PostObservation(h, label, resumePins, { onStage(stage) {
        assert.equal(stage, 'post-observation-current-authenticated'); postObservationCurrentProven = true;
        emit('normal-post-observation-current-authenticated-stop', { resumePins, viewReference: basis.viewReference, current: basis.basis, eventReferences: [...events] });
        throw stop;
      } });
      throw Error('V203 post-observation helper crossed its fixed stop point');
    } catch (error) { if (error !== stop) throw error; }
    assert.equal(postObservationCurrentProven, true); assert.equal(basis.viewReference.sourceId, 'physical-fixture:cut4:view');
    same(basis.view.cut.operationReference, observationReference); same(basis.view.cut.physicalOperationReference, pins.captureCutReference);
    same(db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(original.action.lineage.enrollmentReference.sourceId), original.physicalHead);
    return { boundary: 'NATIVE_FIELD_POST_OBSERVATION_CHECKPOINT_ONLY' as const, retainedInputReferences: preparation, originalInputs: original,
      finalViewReference: basis.viewReference, finalCurrent: basis.basis, finalPrefixReference: basis.view.source.prefixReference,
      observation, observationReference, resumePins, eventReferences: events, wrongTimeRejected, wrongTimeError, wrongTimeSourceRows,
      sensoryHeadBefore: headBefore, sensoryHeadAfter: headAfter, normalLifecycleAdvances: advances, postObservationCurrentProven,
      currentCaptureProven: true, precedingLifecycleHistoricalAuthenticated: true, physicalHeadRemainsCapture: true,
      captureLifecycleAdmissionComplete: true, observationLifecycleAdmissionComplete: true, resumeReady: true, fullContinuationComplete: false,
      deliveryAccepted: false, commitmentAccepted: false, resolutionAccepted: false, fieldRootAccepted: false, officialTerminalProven: false,
      launchRegenerated: false, captureRegenerated: false, newPracticeAccepted: 0, twoTakeReplayed: false, performancePass: false };
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = [];
    for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V203 owner cleanup failed');
  }
}

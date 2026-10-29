import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
  readSamePaLifecycleSetFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readCurrentSamePaInFlightCutFromSqlite, readSamePaPhysicalActionFromSqlite, readSamePaPhysicalFieldCalibrationFromSqlite,
  readSamePaPhysicalOperationFromSqlite, openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
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
import { assertInFlightBattingWriteCurrentFromSqlite } from '../../src/host/world/InFlightBattingLifecycleFenceFromSqlite';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
import type { admitNativeFieldObservationV203 } from './native-field-observation-v203';
import { createNativeFieldPreparationV198Declaration } from './native-field-preparation-v198';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativeFieldDeliveryV204Input = Readonly<Pick<ReturnType<typeof admitNativeFieldObservationV203>,
  'retainedInputReferences' | 'resumePins' | 'finalViewReference' | 'eventReferences'>>;
const label = 'native-spin-neutral-v193:pitch3';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V204 retained owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V204 normal retained prerequisite missing'); return value; };

/** Owned-copy continuation of V203's normally admitted observation. Stop after
 * the original helper accepts its delivery, before that event's admission. */
export function admitNativeFieldDeliveryV204(path: string, input: NativeFieldDeliveryV204Input, emit: (name: string, value?: unknown) => void) {
  assert.equal(input.eventReferences.length, 4); assert.equal(input.finalViewReference.sourceId, 'physical-fixture:cut4:view');
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
      if (capture.record.kind !== 'same_pa_physical_cut_v1' || capture.stage !== 'in_flight' || capture.record.operationOrdinal !== 1) throw Error('V204 normal retained capture required');
      const captureCut = capture.record; same(capture.actor, actor); same(capture.physicalPitchReference, pins.launchReference);
      same(captureCut.source.sourceId, label + ':capture-cut'); assert.equal(captureCut.source.viewReference.sourceId, 'physical-fixture:cut2:view');
      same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record;
      if (launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight') throw Error('V204 normal original launch required');
      same(launch.source.sourceId, label + ':launch'); same(launch.lineage, captureCut.lineage);
      const observation = readBattingPerceptionFromSqlite(db, 'observation', pins.observationReference);
      if (observation.kind !== 'batting_observation' || observation.source.capability !== 'owned_in_flight_batting_observation_v1') throw Error('V204 normal retained observation required');
      same(observation.source.sourceId, label + ':capture'); same(observation.source.physicalPitchReference, pins.launchReference);
      same(observation.source.physicalOperationReference, pins.captureCutReference); same(observation.source.postureReference, pins.postureReference);
      assert.equal(observation.source.viewReference.sourceId, 'physical-fixture:cut3:view'); same(observation.source.observedTick, captureCut.evaluationTick);
      same(observation.source.previousObservationReference, null); same(observation.lineage, captureCut.lineage);
      const observationView = readHistoricalSamePaLifecycleViewFromSqlite(db, observation.source.viewReference);
      same(observationView.actor, actor); same(observationView.view.cut.physicalOperationReference, pins.captureCutReference);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, input.finalViewReference);
      same(current.actor, actor); same(current.view.cut.operationReference, pins.observationReference); same(current.view.cut.physicalOperationReference, pins.captureCutReference);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V204 normal current prefix required');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference); same(prefix.source.eventReferences, input.eventReferences);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', current.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V204 original TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), current.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const calibrationIds = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(input.finalViewReference.sourceId).map(row => String(row.source_id));
      assert.equal(calibrationIds.length, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', calibrationIds)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V204 original calibration missing'); return value; });
      for (const calibration of calibrations) same(calibration.source.viewReference, input.finalViewReference);
      const sensor = must(calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === actor.binding.playerId));
      if (sensor.source.response.kind !== 'accepted_execution_values_v1') throw Error('V204 original explicit observation response missing');
      const observationValues = sensor.source.response.values as AcceptedBattingObservationCalibration['values'];
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(observationValues.calibration.errorParameters[key], 0);
      const action = readSamePaPhysicalActionFromSqlite(db, refs.actionReference); same(action.actor, actor); same(action.source.viewReference, refs.viewReference);
      same(launch.source.actionReference, refs.actionReference); same(launch.source.viewReference, refs.viewReference);
      const posture = readBattingPerceptionFromSqlite(db, 'posture', pins.postureReference);
      if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V204 original in-flight posture missing');
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
      const observationHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_observation_v1_observations', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(observationHead.length, 1); assert.equal(observationHead[0].revision, 1);
      assert.equal(observationHead[0].last_source_id, pins.observationReference.sourceId); assert.equal(observationHead[0].last_snapshot_hash, pins.observationReference.snapshotHash);
      const deliveryHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_observation_v1_deliveries', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(deliveryHead.length, 0, 'V204 raw delivery head locator must be absent');
      assert.equal(db.prepare('SELECT source_id FROM main.batting_observation_v1_deliveries WHERE source_id=?').all(label + ':delivery').length, 0);
      return { actor, captureCut, launch, observation, observationView, current, prefix, totals, calibrations, observationValues, action, posture, intent,
        model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, dispatchCalibrationIds, genesis, physicalHead,
        observationHead, deliveryHeadLocatorBefore: deliveryHead };
    }));
    emit('retained-normal-current-cut4-and-original-inputs-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(original.dispatchCalibrationIds); release(dispatch); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(source: T): T => {
      assert([label + ':delivery-cut', label + ':delivery'].includes(source.sourceId), 'V204 only the original delivery Sources are admitted');
      accepted.set(source.sourceId, source); emit('inert-source-declaration-before-acceptance', source); return source;
    };
    const f = { db, path, actor: original.actor, acceptedAction: original.acceptedAction, acceptedCalibrations, x: { f: { track } } };
    const events = [...original.prefix.source.eventReferences], efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    let basis: ReturnType<NativeSpinNeutralPostObservationContextV193['current']> = { view: original.current.view, viewReference: input.finalViewReference,
      basis: original.current, calibrationSet: { calibrations: original.calibrations } };
    let advances = 0;
    const advance: NativeSpinNeutralPostObservationContextV193['advance'] = event => {
      assert.equal(advances, 0, 'V204 only the delivery-cut lifecycle advance is admitted');
      assert.equal(event.owner, 'pa_physical_v1_cuts'); assert.equal(event.sourceId, label + ':delivery-cut');
      events.push(event); const cutLabel = 'physical-fixture:cut' + events.length;
      emit('advance-' + events.length + '-start', { eventReference: event, anchorViewReference: original.prefix.source.anchorViewReference, eventReferences: [...events], efforts });
      const next = prepareSamePaLifecycleFixture(f, original.prefix.source.anchorViewReference, [...events], cutLabel, efforts, original.observationValues,
        undefined, undefined, undefined, stage => emit('advance-' + events.length + '-' + stage));
      basis = { view: next.view, viewReference: next.viewReference, basis: next.basis, calibrationSet: { calibrations: next.calibrationSet.calibrations } };
      advances++; emit('advance-' + events.length + '-accepted', { eventReference: event, prefix: next.prefix, totalSet: next.totalSet,
        viewReference: next.viewReference, view: next.view, calibrationSet: next.calibrationSet }); release(next.owner); return next;
    };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => accepted.get(id) }));
    const worldOwner = track(openSqliteWorldControlStore(path));
    const originalAction = original.acceptedAction.source;
    if (originalAction.variant !== 'declared_take_v1') throw Error('V204 original dispatch first TAKE Source differs');
    const h: NativeSpinNeutralPostObservationContextV193 = { f, accepted, save, events, current: () => basis, advance, physical,
      original: originalAction, genesis: original.genesis, worldOwner };
    const stop = new Error('V204_STOP_AFTER_NORMAL_DELIVERY_ACCEPTANCE_BEFORE_ADMISSION');
    let postObservationCurrentProven = false, deliveryReadyReached = false;
    try {
      continueNativeSpinNeutralV193PostObservation(h, label, pins, { onStage(stage) {
        if (stage === 'post-observation-current-authenticated') { postObservationCurrentProven = true; emit(stage, { viewReference: basis.viewReference }); return; }
        if (stage === 'delivery-cut-ready') { emit(stage, { viewReference: basis.viewReference }); return; }
        assert.equal(stage, 'delivery-ready'); assert.equal(advances, 1); assert.equal(events.length, 5);
        deliveryReadyReached = true; emit('normal-delivery-accepted-before-lifecycle-admission', { viewReference: basis.viewReference, eventReferences: [...events] }); throw stop;
      } });
      throw Error('V204 original helper crossed its fixed delivery-ready stop point');
    } catch (error) { if (error !== stop) throw error; }
    assert.equal(postObservationCurrentProven, true); assert.equal(deliveryReadyReached, true); assert.equal(basis.viewReference.sourceId, 'physical-fixture:cut5:view');
    const checkpoint = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const deliveryCutReference = locate('pa_physical_v1_cuts', label + ':delivery-cut');
      const currentDeliveryCut = readCurrentSamePaInFlightCutFromSqlite(db, deliveryCutReference);
      if (currentDeliveryCut.record.kind !== 'same_pa_physical_cut_v1' || currentDeliveryCut.record.operationOrdinal !== 2 || currentDeliveryCut.stage !== 'in_flight') throw Error('V204 normal delivery cut frontier differs');
      const deliveryCut = currentDeliveryCut.record;
      same(currentDeliveryCut.actor, original.actor); same(deliveryCut.source.viewReference, input.finalViewReference);
      same(deliveryCut.source.launchReference, pins.launchReference); same(deliveryCut.source.previousOperationReference, pins.captureCutReference);
      assert.equal(deliveryCut.source.throughTick, original.captureCut.evaluationTick + original.observation.calculation.effectiveValues.deliveryLatencyTicks);
      const deliveryReference = locate('batting_observation_v1_deliveries', label + ':delivery');
      const delivery = readBattingPerceptionFromSqlite(db, 'delivery', deliveryReference);
      if (delivery.kind !== 'batting_observation_delivery' || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1') throw Error('V204 normal delivery missing');
      same(delivery.source.viewReference, basis.viewReference); same(delivery.source.observationReference, pins.observationReference);
      same(delivery.source.physicalPitchReference, pins.launchReference); same(delivery.source.physicalOperationReference, deliveryCutReference);
      const finalHistorical = readHistoricalSamePaLifecycleViewFromSqlite(db, basis.viewReference);
      same(finalHistorical.view, basis.view); same(finalHistorical.members, basis.basis.members);
      same(finalHistorical.view.cut.operationReference, deliveryCutReference); same(finalHistorical.view.cut.physicalOperationReference, deliveryCutReference);
      assertInFlightBattingWriteCurrentFromSqlite(db, basis.viewReference, deliveryReference);
      const physicalHead = db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(original.action.lineage.enrollmentReference.sourceId);
      assert.equal(physicalHead.length, 1); assert.equal(physicalHead[0].last_owner, deliveryCutReference.owner);
      assert.equal(physicalHead[0].last_source_id, deliveryCutReference.sourceId); assert.equal(physicalHead[0].last_snapshot_hash, deliveryCutReference.snapshotHash);
      const observationHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_observation_v1_observations', original.action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, original.actor.binding.playerId);
      same(observationHead, original.observationHead);
      const deliveryHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_observation_v1_deliveries', original.action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, original.actor.binding.playerId);
      assert.equal(deliveryHead.length, 1); assert.equal(deliveryHead[0].revision, 1);
      assert.equal(deliveryHead[0].first_source_id, deliveryReference.sourceId); assert.equal(deliveryHead[0].last_source_id, deliveryReference.sourceId);
      assert.equal(deliveryHead[0].last_snapshot_hash, deliveryReference.snapshotHash);
      return { deliveryCutReference, currentDeliveryCut, deliveryCut, deliveryReference, delivery, finalHistorical, physicalHead, observationHead, deliveryHead };
    }));
    const resumePins = { ...pins, deliveryCutReference: checkpoint.deliveryCutReference, deliveryReference: checkpoint.deliveryReference };
    emit('normal-unadmitted-delivery-and-historical-cut5-checkpoint-authenticated', { resumePins, finalViewReference: basis.viewReference, ...checkpoint });
    return { boundary: 'NATIVE_FIELD_DELIVERY_CHECKPOINT_ONLY' as const, retainedInputReferences: preparation, originalInputs: original,
      finalViewReference: basis.viewReference, finalPrefixReference: basis.view.source.prefixReference,
      currentAtAdvanceOnly: basis.basis, ...checkpoint, resumePins, eventReferences: events, normalLifecycleAdvances: advances,
      postObservationCurrentProven, deliveryCheckpointProven: true, deliveryAccepted: true, deliveryAwaitingLifecycleAdmission: true,
      deliveryAfterFenceProven: true, finalLifecycleCurrentProven: false, resumeReady: false, nativePostDeliveryConsumerProven: false,
      nativeResumeAdapterRequired: true, fullContinuationComplete: false, physicalHeadAdvancedToDeliveryCut: true,
      predictionAccepted: false, scoreAccepted: false, emotionAccepted: false, commitmentAccepted: false, resolutionAccepted: false,
      fieldRootAccepted: false, officialTerminalProven: false, launchRegenerated: false, captureRegenerated: false,
      observationRegenerated: false, newPracticeAccepted: 0, twoTakeReplayed: false, performancePass: false };
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = [];
    for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V204 owner cleanup failed');
  }
}

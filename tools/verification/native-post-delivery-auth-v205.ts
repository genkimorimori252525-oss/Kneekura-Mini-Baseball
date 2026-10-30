import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
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
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import { continueNativeSpinNeutralV193PostDelivery, type NativeSpinNeutralPostObservationContextV193 } from '../../src/host/world/InFlightBattingLifecycleFixture.test-support';
import { openSqliteWorldControlStore } from '../../src/host/world/SqliteWorldControlStore';
import { assertInFlightBattingWriteCurrentFromSqlite } from '../../src/host/world/InFlightBattingLifecycleFenceFromSqlite';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
import type { admitNativeFieldDeliveryV204 } from './native-field-delivery-v204';
import { createNativeFieldPreparationV198Declaration } from './native-field-preparation-v198';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativePostDeliveryAuthV205Input = Readonly<Pick<ReturnType<typeof admitNativeFieldDeliveryV204>,
  'retainedInputReferences' | 'resumePins' | 'finalViewReference' | 'eventReferences'>>;
const label = 'native-spin-neutral-v193:pitch3';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V205 retained owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V205 normal retained prerequisite missing'); return value; };

/** Authenticate the retained Native delivery and the real Native-only consumer
 * entry. The authentication stage stops this harness before every new accept. */
export function authenticateNativePostDeliveryV205(path: string, input: NativePostDeliveryAuthV205Input, emit: (name: string, value?: unknown) => void) {
  assert.equal(input.eventReferences.length, 5); assert.equal(input.finalViewReference.sourceId, 'physical-fixture:cut5:view');
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
      const currentDeliveryCut = readCurrentSamePaInFlightCutFromSqlite(db, pins.deliveryCutReference);
      if (currentDeliveryCut.record.kind !== 'same_pa_physical_cut_v1' || currentDeliveryCut.stage !== 'in_flight' || currentDeliveryCut.record.operationOrdinal !== 2) throw Error('V205 normal current delivery cut required');
      const deliveryCut = currentDeliveryCut.record; same(currentDeliveryCut.actor, actor); same(currentDeliveryCut.physicalPitchReference, pins.launchReference);
      const captureCut = readSamePaPhysicalOperationFromSqlite(db, pins.captureCutReference).record;
      if (captureCut.kind !== 'same_pa_physical_cut_v1' || captureCut.operationOrdinal !== 1) throw Error('V205 normal original capture required');
      same(captureCut.source.sourceId, label + ':capture-cut'); assert.equal(captureCut.source.viewReference.sourceId, 'physical-fixture:cut2:view');
      same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record;
      if (launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight') throw Error('V205 normal original launch required');
      same(launch.source.sourceId, label + ':launch'); same(launch.lineage, captureCut.lineage);
      const observation = readBattingPerceptionFromSqlite(db, 'observation', pins.observationReference);
      if (observation.kind !== 'batting_observation' || observation.source.capability !== 'owned_in_flight_batting_observation_v1') throw Error('V205 normal retained observation required');
      same(observation.source.sourceId, label + ':capture'); same(observation.source.physicalPitchReference, pins.launchReference);
      same(observation.source.physicalOperationReference, pins.captureCutReference); same(observation.source.postureReference, pins.postureReference);
      assert.equal(observation.source.viewReference.sourceId, 'physical-fixture:cut3:view'); same(observation.source.observedTick, captureCut.evaluationTick);
      same(observation.source.previousObservationReference, null); same(observation.lineage, captureCut.lineage);
      const observationView = readHistoricalSamePaLifecycleViewFromSqlite(db, observation.source.viewReference);
      same(observationView.actor, actor); same(observationView.view.cut.physicalOperationReference, pins.captureCutReference);
      const delivery = readBattingPerceptionFromSqlite(db, 'delivery', pins.deliveryReference);
      if (delivery.kind !== 'batting_observation_delivery' || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1') throw Error('V205 normal retained delivery required');
      same(delivery.source.sourceId, label + ':delivery'); same(delivery.source.observationReference, pins.observationReference);
      same(delivery.source.viewReference, input.finalViewReference); same(delivery.source.physicalPitchReference, pins.launchReference);
      same(delivery.source.physicalOperationReference, pins.deliveryCutReference); same(delivery.lineage, launch.lineage);
      same(deliveryCut.source.sourceId, label + ':delivery-cut'); assert.equal(deliveryCut.source.viewReference.sourceId, 'physical-fixture:cut4:view');
      same(deliveryCut.source.launchReference, pins.launchReference); same(deliveryCut.source.previousOperationReference, pins.captureCutReference);
      assert.equal(deliveryCut.source.throughTick, captureCut.evaluationTick + observation.calculation.effectiveValues.deliveryLatencyTicks);
      const historical = readHistoricalSamePaLifecycleViewFromSqlite(db, input.finalViewReference);
      same(historical.actor, actor); same(historical.view.cut.operationReference, pins.deliveryCutReference); same(historical.view.cut.physicalOperationReference, pins.deliveryCutReference);
      assertInFlightBattingWriteCurrentFromSqlite(db, input.finalViewReference, pins.deliveryReference);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', historical.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V205 normal historical prefix required');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), historical.view.source.prefixReference); same(prefix.source.eventReferences, input.eventReferences);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', historical.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V205 original TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), historical.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const calibrationIds = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(input.finalViewReference.sourceId).map(row => String(row.source_id));
      assert.equal(calibrationIds.length, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', calibrationIds)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V205 original calibration missing'); return value; });
      for (const calibration of calibrations) same(calibration.source.viewReference, input.finalViewReference);
      const sensor = must(calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === actor.binding.playerId));
      if (sensor.source.response.kind !== 'accepted_execution_values_v1') throw Error('V205 original explicit observation response missing');
      const observationValues = sensor.source.response.values as AcceptedBattingObservationCalibration['values'];
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(observationValues.calibration.errorParameters[key], 0);
      const action = readSamePaPhysicalActionFromSqlite(db, refs.actionReference); same(action.actor, actor); same(action.source.viewReference, refs.viewReference);
      same(launch.source.actionReference, refs.actionReference); same(launch.source.viewReference, refs.viewReference);
      const posture = readBattingPerceptionFromSqlite(db, 'posture', pins.postureReference);
      if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V205 original in-flight posture missing');
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
      const world = must(readEmotionWorldRevisionFromSqlite(db, actor.binding.careerId));
      const physicalHead = db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(action.lineage.enrollmentReference.sourceId);
      assert.equal(physicalHead.length, 1); assert.equal(physicalHead[0].last_owner, pins.deliveryCutReference.owner);
      assert.equal(physicalHead[0].last_source_id, pins.deliveryCutReference.sourceId); assert.equal(physicalHead[0].last_snapshot_hash, pins.deliveryCutReference.snapshotHash);
      const observationHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_observation_v1_observations', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(observationHead.length, 1); assert.equal(observationHead[0].revision, 1);
      assert.equal(observationHead[0].last_source_id, pins.observationReference.sourceId); assert.equal(observationHead[0].last_snapshot_hash, pins.observationReference.snapshotHash);
      const deliveryHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_observation_v1_deliveries', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(deliveryHead.length, 1); assert.equal(deliveryHead[0].revision, 1);
      assert.equal(deliveryHead[0].last_source_id, pins.deliveryReference.sourceId); assert.equal(deliveryHead[0].last_snapshot_hash, pins.deliveryReference.snapshotHash);
      return { actor, captureCut, launch, observation, observationView, historical, currentDeliveryCut, deliveryCut, delivery, prefix, totals, calibrations, observationValues, action, posture, intent,
        model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, dispatchCalibrationIds, genesis, world, physicalHead,
        observationHead, deliveryHead };
    }));
    emit('retained-native-post-delivery-context-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(original.dispatchCalibrationIds); release(dispatch); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(source: T): T => { accepted.set(source.sourceId, source); emit('inert-source-declaration', source); return source; };
    const f = { db, path, actor: original.actor, acceptedAction: original.acceptedAction, acceptedCalibrations, x: { f: { track } } };
    const events = [...original.prefix.source.eventReferences];
    const basis: ReturnType<NativeSpinNeutralPostObservationContextV193['current']> = { view: original.historical.view, viewReference: input.finalViewReference,
      basis: original.historical, calibrationSet: { calibrations: original.calibrations } };
    const advance: NativeSpinNeutralPostObservationContextV193['advance'] = () => { throw Error('V205 authentication must stop before cut6 lifecycle admission'); };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => accepted.get(id) }));
    const worldOwner = track(openSqliteWorldControlStore(path));
    same(worldOwner.readHead(original.actor.binding.careerId), original.world.head);
    const originalAction = original.acceptedAction.source;
    if (originalAction.variant !== 'declared_take_v1') throw Error('V205 original dispatch first TAKE Source differs');
    const h: NativeSpinNeutralPostObservationContextV193 = { f, accepted, save, events, current: () => basis, advance, physical,
      original: originalAction, genesis: original.genesis, worldOwner };
    const stop = new Error('V205_STOP_AFTER_NATIVE_POST_DELIVERY_ENTRY_AUTHENTICATION'); let nativePostDeliveryEntryAuthenticated = false;
    try {
      continueNativeSpinNeutralV193PostDelivery(h, label, pins, { onStage(stage) {
        assert.equal(stage, 'native-post-delivery-entry-authenticated');
        assert.equal(db.isTransaction, false, 'V205 authentication callback must follow read phase closure');
        assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 0);
        nativePostDeliveryEntryAuthenticated = true;
        emit('native-post-delivery-entry-authenticated-stop', { resumePins: pins, finalViewReference: basis.viewReference,
          finalHistorical: basis.basis, currentDeliveryCut: original.currentDeliveryCut, eventReferences: [...events], readPhaseClosed: true });
        throw stop;
      } });
      throw Error('V205 Native helper crossed its authentication-only stop point');
    } catch (error) { if (error !== stop) throw error; }
    assert.equal(nativePostDeliveryEntryAuthenticated, true); assert.equal(events.length, 5); assert.equal(accepted.size, 0);
    same(db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(original.action.lineage.enrollmentReference.sourceId), original.physicalHead);
    return { boundary: 'NATIVE_POST_DELIVERY_ENTRY_AUTHENTICATION_ONLY' as const, retainedInputReferences: preparation, originalInputs: original,
      finalViewReference: basis.viewReference, finalHistorical: basis.basis, currentDeliveryCut: original.currentDeliveryCut,
      deliveryCut: original.deliveryCut, delivery: original.delivery, deliveryReference: pins.deliveryReference,
      resumePins: pins, eventReferences: events, nativePostDeliveryEntryAuthenticated, nativePostDeliveryConsumerProven: true,
      nativeResumeAdapterRequired: false, resumeReady: true, readPhaseClosedBeforeStage: true,
      newAcceptedOperations: 0, normalLifecycleAdvances: 0, cut6AdmissionPerformed: false, deliveryAwaitingLifecycleAdmission: true,
      finalLifecycleCurrentProven: false, fullContinuationComplete: false, consumerAdoptionProven: false,
      predictionAccepted: false, scoreAccepted: false, emotionAccepted: false, commitmentAccepted: false, resolutionAccepted: false,
      fieldRootAccepted: false, officialTerminalProven: false, newPracticeAccepted: 0, twoTakeReplayed: false, performancePass: false };
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = [];
    for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V205 owner cleanup failed');
  }
}

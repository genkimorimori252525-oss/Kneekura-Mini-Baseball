import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
  readSamePaLifecycleSetFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readCurrentSamePaInFlightCutFromSqlite,
  readSamePaPhysicalOperationFromSqlite, openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { openSqliteSamePlateAppearanceDispatchStore } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { prepareSamePaLifecycleFixture } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { continueNativeSpinNeutralV193PostDelivery, type NativeSpinNeutralPostObservationContextV193 } from '../../src/host/world/InFlightBattingLifecycleFixture.test-support';
import { openSqliteWorldControlStore } from '../../src/host/world/SqliteWorldControlStore';
import { assertInFlightBattingWriteCurrentFromSqlite } from '../../src/host/world/InFlightBattingLifecycleFenceFromSqlite';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
import type { authenticateNativePostDeliveryV205 } from './native-post-delivery-auth-v205';
import { createNativeFieldPreparationV198Declaration } from './native-field-preparation-v198';
import { readNativeInFlightOriginalInputsV207 } from './native-inflight-original-inputs-v207';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativeDeliveryForecastV206Input = Readonly<Pick<ReturnType<typeof authenticateNativePostDeliveryV205>,
  'retainedInputReferences' | 'resumePins' | 'finalViewReference' | 'eventReferences'>>;
const label = 'native-spin-neutral-v193:pitch3';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V206 retained owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V206 normal retained prerequisite missing'); return value; };

/** Continue the retained Native entry through delivery admission and its first
 * forecast. The existing forecast-ready stage precedes forecast admission. */
export function admitNativeDeliveryForecastV206(path: string, input: NativeDeliveryForecastV206Input, emit: (name: string, value?: unknown) => void) {
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
      if (currentDeliveryCut.record.kind !== 'same_pa_physical_cut_v1' || currentDeliveryCut.stage !== 'in_flight' || currentDeliveryCut.record.operationOrdinal !== 2) throw Error('V206 normal current delivery cut required');
      const deliveryCut = currentDeliveryCut.record; same(currentDeliveryCut.actor, actor); same(currentDeliveryCut.physicalPitchReference, pins.launchReference);
      const captureCut = readSamePaPhysicalOperationFromSqlite(db, pins.captureCutReference).record;
      if (captureCut.kind !== 'same_pa_physical_cut_v1' || captureCut.operationOrdinal !== 1) throw Error('V206 normal original capture required');
      same(captureCut.source.sourceId, label + ':capture-cut'); assert.equal(captureCut.source.viewReference.sourceId, 'physical-fixture:cut2:view');
      same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record;
      if (launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight') throw Error('V206 normal original launch required');
      same(launch.source.sourceId, label + ':launch'); same(launch.lineage, captureCut.lineage);
      const observation = readBattingPerceptionFromSqlite(db, 'observation', pins.observationReference);
      if (observation.kind !== 'batting_observation' || observation.source.capability !== 'owned_in_flight_batting_observation_v1') throw Error('V206 normal retained observation required');
      same(observation.source.sourceId, label + ':capture'); same(observation.source.physicalPitchReference, pins.launchReference);
      same(observation.source.physicalOperationReference, pins.captureCutReference); same(observation.source.postureReference, pins.postureReference);
      assert.equal(observation.source.viewReference.sourceId, 'physical-fixture:cut3:view'); same(observation.source.observedTick, captureCut.evaluationTick);
      same(observation.source.previousObservationReference, null); same(observation.lineage, captureCut.lineage);
      const observationView = readHistoricalSamePaLifecycleViewFromSqlite(db, observation.source.viewReference);
      same(observationView.actor, actor); same(observationView.view.cut.physicalOperationReference, pins.captureCutReference);
      const delivery = readBattingPerceptionFromSqlite(db, 'delivery', pins.deliveryReference);
      if (delivery.kind !== 'batting_observation_delivery' || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1') throw Error('V206 normal retained delivery required');
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
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V206 normal historical prefix required');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), historical.view.source.prefixReference); same(prefix.source.eventReferences, input.eventReferences);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', historical.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V206 original TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), historical.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const calibrationIds = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(input.finalViewReference.sourceId).map(row => String(row.source_id));
      assert.equal(calibrationIds.length, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', calibrationIds)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V206 original calibration missing'); return value; });
      for (const calibration of calibrations) same(calibration.source.viewReference, input.finalViewReference);
      const sensor = must(calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === actor.binding.playerId));
      if (sensor.source.response.kind !== 'accepted_execution_values_v1') throw Error('V206 original explicit observation response missing');
      const observationValues = sensor.source.response.values as AcceptedBattingObservationCalibration['values'];
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(observationValues.calibration.errorParameters[key], 0);
      const { action, posture, intent, model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, dispatchCalibrationIds, genesis, world, physicalHead, observationHead, deliveryHead } = readNativeInFlightOriginalInputsV207(db, preparation, pins, actor, launch, locate);
      const forecastHeadLocatorBefore = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_prediction_v1_predictions', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(forecastHeadLocatorBefore.length, 0, 'V206 raw forecast head locator must be absent');
      assert.equal(db.prepare('SELECT source_id FROM main.batting_prediction_v1_predictions WHERE source_id=?').all(label + ':forecast').length, 0);
      return { actor, captureCut, launch, observation, observationView, historical, currentDeliveryCut, deliveryCut, delivery, prefix, totals, calibrations, observationValues, action, posture, intent,
        model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, dispatchCalibrationIds, genesis, world, physicalHead,
        observationHead, deliveryHead, forecastHeadLocatorBefore };
    }));
    emit('retained-native-delivery-and-cut5-context-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(original.dispatchCalibrationIds); release(dispatch); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(source: T): T => {
      assert.equal(source.sourceId, label + ':forecast', 'V206 only the existing forecast Source may be accepted');
      accepted.set(source.sourceId, source); emit('inert-source-declaration-before-acceptance', source); return source;
    };
    const f = { db, path, actor: original.actor, acceptedAction: original.acceptedAction, acceptedCalibrations, x: { f: { track } } };
    const events = [...original.prefix.source.eventReferences], efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    let basis: ReturnType<NativeSpinNeutralPostObservationContextV193['current']> = { view: original.historical.view, viewReference: input.finalViewReference,
      basis: original.historical, calibrationSet: { calibrations: original.calibrations } };
    let advances = 0;
    const advance: NativeSpinNeutralPostObservationContextV193['advance'] = event => {
      assert.equal(advances, 0, 'V206 only the delivery lifecycle advance is admitted'); same(event, pins.deliveryReference);
      events.push(event); assert.equal(events.length, 6); const cutLabel = 'physical-fixture:cut6';
      emit('advance-6-start', { eventReference: event, anchorViewReference: original.prefix.source.anchorViewReference, eventReferences: [...events], efforts });
      const next = prepareSamePaLifecycleFixture(f, original.prefix.source.anchorViewReference, [...events], cutLabel, efforts, original.observationValues,
        undefined, undefined, undefined, stage => emit('advance-6-' + stage));
      basis = { view: next.view, viewReference: next.viewReference, basis: next.basis, calibrationSet: { calibrations: next.calibrationSet.calibrations } };
      advances++; emit('advance-6-accepted', { eventReference: event, prefix: next.prefix, totalSet: next.totalSet,
        viewReference: next.viewReference, view: next.view, calibrationSet: next.calibrationSet }); release(next.owner); return next;
    };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => accepted.get(id) }));
    const worldOwner = track(openSqliteWorldControlStore(path));
    same(worldOwner.readHead(original.actor.binding.careerId), original.world.head);
    const originalAction = original.acceptedAction.source;
    if (originalAction.variant !== 'declared_take_v1') throw Error('V206 original dispatch first TAKE Source differs');
    const h: NativeSpinNeutralPostObservationContextV193 = { f, accepted, save, events, current: () => basis, advance, physical,
      original: originalAction, genesis: original.genesis, worldOwner };
    const stop = new Error('V206_STOP_AFTER_NORMAL_FORECAST_ACCEPTANCE_BEFORE_ADMISSION');
    let nativePostDeliveryEntryAuthenticated = false, forecastReadyReached = false;
    try {
      continueNativeSpinNeutralV193PostDelivery(h, label, pins, { onStage(stage) {
        if (stage === 'native-post-delivery-entry-authenticated') {
          assert.equal(db.isTransaction, false); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 0);
          nativePostDeliveryEntryAuthenticated = true; emit(stage, { viewReference: basis.viewReference, eventReferences: [...events] }); return;
        }
        assert.equal(stage, 'forecast-ready'); assert.equal(advances, 1); assert.equal(events.length, 6);
        forecastReadyReached = true; emit(stage, { viewReference: basis.viewReference, eventReferences: [...events] }); throw stop;
      }, prepareCommitment(source, executionInput) {
        const { buntProfileBinding: _bunt, ...ordinary } = source;
        return { ...ordinary, capability: 'same_pa_physical_commitment_v123' as const, spinBindingV123: {
          kind: 'fixed_native_spin_binding_v123' as const, modelReference: refs.modelReference,
          intent: { technique: 'NO_SPIN_TARGET' as const, selectedAtTick: executionInput.nominalRequest.currentFrame.time.tick },
          qualificationReferences: refs.qualificationReferences } };
      } });
      throw Error('V206 Native helper crossed its forecast-ready stop point');
    } catch (error) { if (error !== stop) throw error; }
    assert.equal(nativePostDeliveryEntryAuthenticated, true); assert.equal(forecastReadyReached, true);
    assert.equal(advances, 1); assert.equal(accepted.size, 1); assert.equal(basis.viewReference.sourceId, 'physical-fixture:cut6:view');
    const checkpoint = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const forecastReference = locate('batting_prediction_v1_predictions', label + ':forecast');
      const forecast = readBattingPerceptionFromSqlite(db, 'prediction', forecastReference);
      if (forecast.kind !== 'batting_observed_prediction' || forecast.source.capability !== 'owned_in_flight_batting_observed_prediction_v1') throw Error('V206 normal forecast missing');
      same(forecast.source.viewReference, basis.viewReference); same(forecast.source.observationReference, pins.observationReference);
      same(forecast.source.deliveryReference, pins.deliveryReference); same(forecast.source.modelReference, refs.modelReference);
      const currentDeliveryCut = readCurrentSamePaInFlightCutFromSqlite(db, pins.deliveryCutReference);
      same(currentDeliveryCut.record, original.deliveryCut); same(currentDeliveryCut.actor, original.actor);
      assert.equal(currentDeliveryCut.record.operationOrdinal, 2); assert.equal(currentDeliveryCut.stage, 'in_flight');
      const finalHistorical = readHistoricalSamePaLifecycleViewFromSqlite(db, basis.viewReference);
      same(finalHistorical.view, basis.view); same(finalHistorical.members, basis.basis.members);
      same(finalHistorical.view.cut.operationReference, pins.deliveryReference); same(finalHistorical.view.cut.physicalOperationReference, pins.deliveryCutReference);
      const finalPrefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', finalHistorical.view.source.prefixReference.sourceId);
      if (!finalPrefix || finalPrefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V206 final normal prefix missing');
      same(finalPrefix.source.eventReferences, events); same(events.at(-1), pins.deliveryReference);
      assertInFlightBattingWriteCurrentFromSqlite(db, basis.viewReference, forecastReference);
      const physicalHead = db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(original.action.lineage.enrollmentReference.sourceId);
      same(physicalHead, original.physicalHead);
      const invocationHead = (owner: string) => db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all(owner, original.action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, original.actor.binding.playerId);
      same(invocationHead('batting_observation_v1_observations'), original.observationHead);
      same(invocationHead('batting_observation_v1_deliveries'), original.deliveryHead);
      const forecastHead = invocationHead('batting_prediction_v1_predictions'); assert.equal(forecastHead.length, 1);
      assert.equal(forecastHead[0].revision, 1); assert.equal(forecastHead[0].first_source_id, forecastReference.sourceId);
      assert.equal(forecastHead[0].last_source_id, forecastReference.sourceId); assert.equal(forecastHead[0].last_snapshot_hash, forecastReference.snapshotHash);
      return { forecast, forecastReference, currentDeliveryCut, finalHistorical, finalPrefix, forecastHead };
    }));
    const resumePins = { ...pins, forecastReference: checkpoint.forecastReference };
    emit('normal-unadmitted-forecast-and-historical-cut6-authenticated', { resumePins, finalViewReference: basis.viewReference, ...checkpoint });
    return { boundary: 'NATIVE_DELIVERY_FORECAST_CHECKPOINT_ONLY' as const, retainedInputReferences: preparation, originalInputs: original,
      finalViewReference: basis.viewReference, finalPrefixReference: basis.view.source.prefixReference, currentAtAdvanceOnly: basis.basis,
      ...checkpoint, resumePins, eventReferences: events, nativePostDeliveryEntryAuthenticated, normalLifecycleAdvances: advances,
      deliveryAdmissionProven: true, forecastAccepted: true, forecastAfterFenceProven: true, forecastAwaitingLifecycleAdmission: true,
      finalLifecycleCurrentProven: false, nativePostForecastConsumerProven: false, nativeResumeAdapterRequired: true,
      resumeReady: false, fullContinuationComplete: false, predictionAdmissionPerformed: false, physicalHeadUnchanged: true,
      scoreAccepted: false, emotionAccepted: false, commitmentAccepted: false, resolutionAccepted: false, fieldRootAccepted: false,
      officialTerminalProven: false, newPracticeAccepted: 0, twoTakeReplayed: false, deliveryRegenerated: false, performancePass: false };
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = [];
    for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V206 owner cleanup failed');
  }
}

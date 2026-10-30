import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
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
import type { admitNativeDeliveryForecastV206, NativeDeliveryForecastV206Input } from './native-delivery-forecast-v206';
import { createNativeFieldPreparationV198Declaration } from './native-field-preparation-v198';
import { readNativeInFlightOriginalInputsV207 } from './native-inflight-original-inputs-v207';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativeForecastAdmissionV207Input = Readonly<Pick<ReturnType<typeof admitNativeDeliveryForecastV206>,
  'retainedInputReferences' | 'resumePins' | 'finalViewReference' | 'eventReferences'>>;
const label = 'native-spin-neutral-v193:pitch3';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V207 retained owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V207 normal retained prerequisite missing'); return value; };

/** Admit one retained forecast, then authenticate the admitted current cut7
 * through the same Native consumer entry before allowing score acceptance. */
export function admitNativeForecastAdmissionV207(path: string, input: NativeForecastAdmissionV207Input, emit: (name: string, value?: unknown) => void) {
  assert(['physical-fixture:cut6:view', 'physical-fixture:cut7:view'].includes(input.finalViewReference.sourceId));
  assert.equal(Object.keys(input.resumePins).length, 8);
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
      if (currentDeliveryCut.record.kind !== 'same_pa_physical_cut_v1' || currentDeliveryCut.stage !== 'in_flight' || currentDeliveryCut.record.operationOrdinal !== 2) throw Error('V207 normal current delivery cut required');
      const deliveryCut = currentDeliveryCut.record; same(currentDeliveryCut.actor, actor); same(currentDeliveryCut.physicalPitchReference, pins.launchReference);
      const captureCut = readSamePaPhysicalOperationFromSqlite(db, pins.captureCutReference).record;
      if (captureCut.kind !== 'same_pa_physical_cut_v1' || captureCut.operationOrdinal !== 1) throw Error('V207 normal original capture required');
      same(captureCut.source.sourceId, label + ':capture-cut'); assert.equal(captureCut.source.viewReference.sourceId, 'physical-fixture:cut2:view');
      same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record;
      if (launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight') throw Error('V207 normal original launch required');
      same(launch.source.sourceId, label + ':launch'); same(launch.lineage, captureCut.lineage);
      const observation = readBattingPerceptionFromSqlite(db, 'observation', pins.observationReference);
      if (observation.kind !== 'batting_observation' || observation.source.capability !== 'owned_in_flight_batting_observation_v1') throw Error('V207 normal retained observation required');
      same(observation.source.sourceId, label + ':capture'); same(observation.source.physicalPitchReference, pins.launchReference);
      same(observation.source.physicalOperationReference, pins.captureCutReference); same(observation.source.postureReference, pins.postureReference);
      assert.equal(observation.source.viewReference.sourceId, 'physical-fixture:cut3:view'); same(observation.source.observedTick, captureCut.evaluationTick);
      same(observation.source.previousObservationReference, null); same(observation.lineage, captureCut.lineage);
      const observationView = readHistoricalSamePaLifecycleViewFromSqlite(db, observation.source.viewReference);
      same(observationView.actor, actor); same(observationView.view.cut.physicalOperationReference, pins.captureCutReference);
      const delivery = readBattingPerceptionFromSqlite(db, 'delivery', pins.deliveryReference);
      if (delivery.kind !== 'batting_observation_delivery' || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1') throw Error('V207 normal retained delivery required');
      same(delivery.source.sourceId, label + ':delivery'); same(delivery.source.observationReference, pins.observationReference);
      assert.equal(delivery.source.viewReference.sourceId, 'physical-fixture:cut5:view'); same(delivery.source.physicalPitchReference, pins.launchReference);
      same(delivery.source.physicalOperationReference, pins.deliveryCutReference); same(delivery.lineage, launch.lineage);
      same(deliveryCut.source.sourceId, label + ':delivery-cut'); assert.equal(deliveryCut.source.viewReference.sourceId, 'physical-fixture:cut4:view');
      same(deliveryCut.source.launchReference, pins.launchReference); same(deliveryCut.source.previousOperationReference, pins.captureCutReference);
      assert.equal(deliveryCut.source.throughTick, captureCut.evaluationTick + observation.calculation.effectiveValues.deliveryLatencyTicks);
      const historical = readHistoricalSamePaLifecycleViewFromSqlite(db, input.finalViewReference);
      same(historical.actor, actor); same(historical.view.cut.physicalOperationReference, pins.deliveryCutReference);
      const forecastAlreadyAdmitted = must(historical.view.cut.operationReference).owner === 'batting_prediction_v1_predictions';
      if (forecastAlreadyAdmitted) {
        assert.equal(input.finalViewReference.sourceId, 'physical-fixture:cut7:view'); assert.equal(input.eventReferences.length, 7);
        same(historical.view.cut.operationReference, pins.forecastReference);
        const current = readCurrentSamePaLifecycleViewFromSqlite(db, input.finalViewReference); same(current.view, historical.view); same(current.members, historical.members);
        assertInFlightBattingWriteCurrentFromSqlite(db, input.finalViewReference, null);
      } else {
        assert.equal(input.finalViewReference.sourceId, 'physical-fixture:cut6:view'); assert.equal(input.eventReferences.length, 6);
        same(historical.view.cut.operationReference, pins.deliveryReference);
        assertInFlightBattingWriteCurrentFromSqlite(db, input.finalViewReference, pins.forecastReference);
      }
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', historical.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V207 normal historical prefix required');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), historical.view.source.prefixReference); same(prefix.source.eventReferences, input.eventReferences);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', historical.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V207 original TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), historical.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const calibrationIds = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(input.finalViewReference.sourceId).map(row => String(row.source_id));
      assert.equal(calibrationIds.length, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', calibrationIds)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V207 original calibration missing'); return value; });
      for (const calibration of calibrations) same(calibration.source.viewReference, input.finalViewReference);
      const sensor = must(calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === actor.binding.playerId));
      if (sensor.source.response.kind !== 'accepted_execution_values_v1') throw Error('V207 original explicit observation response missing');
      const observationValues = sensor.source.response.values as AcceptedBattingObservationCalibration['values'];
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(observationValues.calibration.errorParameters[key], 0);
      const { action, posture, intent, model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, dispatchCalibrationIds, genesis, world, physicalHead, observationHead, deliveryHead } = readNativeInFlightOriginalInputsV207(db, preparation, pins, actor, launch, locate);
      const forecast = readBattingPerceptionFromSqlite(db, 'prediction', pins.forecastReference);
      if (forecast.kind !== 'batting_observed_prediction' || forecast.source.capability !== 'owned_in_flight_batting_observed_prediction_v1') throw Error('V207 normal retained forecast required');
      same(forecast.source.sourceId, label + ':forecast'); assert.equal(forecast.source.viewReference.sourceId, 'physical-fixture:cut6:view');
      same(forecast.source.observationReference, pins.observationReference); same(forecast.source.deliveryReference, pins.deliveryReference); same(forecast.source.modelReference, refs.modelReference);
      const forecastView = readHistoricalSamePaLifecycleViewFromSqlite(db, forecast.source.viewReference);
      same(forecastView.actor, actor); same(forecastView.view.cut.operationReference, pins.deliveryReference); same(forecastView.view.cut.physicalOperationReference, pins.deliveryCutReference);
      const forecastHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_prediction_v1_predictions', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(forecastHead.length, 1); assert.equal(forecastHead[0].revision, 1); assert.equal(forecastHead[0].last_source_id, pins.forecastReference.sourceId);
      assert.equal(forecastHead[0].last_snapshot_hash, pins.forecastReference.snapshotHash);
      return { actor, captureCut, launch, observation, observationView, historical, currentDeliveryCut, deliveryCut, delivery, prefix, totals, calibrations, observationValues, action, posture, intent,
        model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, dispatchCalibrationIds, genesis, world, physicalHead,
        observationHead, deliveryHead, forecast, forecastView, forecastHead, forecastAlreadyAdmitted };
    }));
    emit('retained-native-forecast-context-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(original.dispatchCalibrationIds); release(dispatch); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(_source: T): T => { throw Error('V207 score and every later Source are outside this checkpoint'); };
    const f = { db, path, actor: original.actor, acceptedAction: original.acceptedAction, acceptedCalibrations, x: { f: { track } } };
    const events = [...original.prefix.source.eventReferences], efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    let basis: ReturnType<NativeSpinNeutralPostObservationContextV193['current']> = { view: original.historical.view, viewReference: input.finalViewReference,
      basis: original.historical, calibrationSet: { calibrations: original.calibrations } };
    let advances = 0;
    const routeMembers = (values: typeof original.calibrations) => values.map(value => json({ route: value.source.route, playerId: value.source.member.playerId })).sort();
    const readCurrentCheckpoint = () => withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      assert.equal(basis.viewReference.sourceId, 'physical-fixture:cut7:view'); assert.equal(events.length, 7);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, basis.viewReference); same(current.view, basis.view); same(current.members, basis.basis.members);
      same(current.view.cut.operationReference, pins.forecastReference); same(current.view.cut.physicalOperationReference, pins.deliveryCutReference);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V207 normal current prefix missing');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference); same(prefix.source.eventReferences, events); same(events.at(-1), pins.forecastReference);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', current.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V207 current TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), current.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const ids = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(basis.viewReference.sourceId).map(row => String(row.source_id));
      assert.equal(ids.length, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', ids)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V207 persisted cut7 calibration missing'); return value; });
      for (const calibration of calibrations) {
        same(calibration.source.viewReference, basis.viewReference);
        const member = must(current.members.find(value => value.playerId === calibration.source.member.playerId)); same(calibration.source.member, member);
      }
      same(calibrations, basis.calibrationSet.calibrations); same(routeMembers(calibrations), routeMembers(original.calibrations));
      assertInFlightBattingWriteCurrentFromSqlite(db, basis.viewReference, null);
      const currentDeliveryCut = readCurrentSamePaInFlightCutFromSqlite(db, pins.deliveryCutReference);
      same(currentDeliveryCut.record, original.deliveryCut); same(currentDeliveryCut.actor, original.actor); assert.equal(currentDeliveryCut.record.operationOrdinal, 2);
      const physicalHead = db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(original.action.lineage.enrollmentReference.sourceId); same(physicalHead, original.physicalHead);
      const invocationHead = (owner: string) => db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all(owner, original.action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, original.actor.binding.playerId);
      same(invocationHead('batting_observation_v1_observations'), original.observationHead); same(invocationHead('batting_observation_v1_deliveries'), original.deliveryHead);
      same(invocationHead('batting_prediction_v1_predictions'), original.forecastHead);
      const forecast = readBattingPerceptionFromSqlite(db, 'prediction', pins.forecastReference); same(forecast, original.forecast);
      return { boundary: 'NATIVE_FORECAST_ADMITTED_CURRENT_CUT7' as const, retainedInputReferences: preparation, resumePins: pins,
        finalViewReference: basis.viewReference, finalCurrent: current, finalPrefixReference: current.view.source.prefixReference, prefix, totals, calibrations,
        calibrationReferences: calibrations.map(value => reference('pa_lifecycle_v1_execution_calibrations', value)), eventReferences: [...events], currentDeliveryCut, forecast,
        predictionAdmissionProven: true, finalLifecycleCurrentProven: true, nativePostForecastConsumerProven: false, nativeResumeAdapterRequired: true,
        resumeReady: false, normalLifecycleAdvances: advances, fullContinuationComplete: false };
    }));
    let admissionCheckpoint: ReturnType<typeof readCurrentCheckpoint> | undefined;
    const stopAfterAdmission = new Error('V207_STOP_AFTER_NORMAL_CUT7_OWNER_RELEASE');
    const stopAfterCurrentReauthentication = new Error('V207_STOP_AFTER_CURRENT_CUT7_NATIVE_ENTRY_AUTHENTICATION');
    const advance: NativeSpinNeutralPostObservationContextV193['advance'] = event => {
      assert.equal(original.forecastAlreadyAdmitted, false); assert.equal(advances, 0, 'V207 only one forecast admission is allowed'); same(event, pins.forecastReference);
      events.push(event); assert.equal(events.length, 7);
      emit('advance-7-start', { eventReference: event, anchorViewReference: original.prefix.source.anchorViewReference, eventReferences: [...events], efforts });
      const next = prepareSamePaLifecycleFixture(f, original.prefix.source.anchorViewReference, [...events], 'physical-fixture:cut7', efforts, original.observationValues,
        undefined, undefined, undefined, stage => emit('advance-7-' + stage));
      basis = { view: next.view, viewReference: next.viewReference, basis: next.basis, calibrationSet: { calibrations: next.calibrationSet.calibrations } };
      advances++; release(next.owner);
      admissionCheckpoint = readCurrentCheckpoint();
      basis = { view: admissionCheckpoint.finalCurrent.view, viewReference: admissionCheckpoint.finalViewReference, basis: admissionCheckpoint.finalCurrent,
        calibrationSet: { calibrations: admissionCheckpoint.calibrations } };
      emit('normal-cut7-current-and-cal32-before-consumer-reauthentication', admissionCheckpoint);
      throw stopAfterAdmission;
    };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => accepted.get(id) }));
    const worldOwner = track(openSqliteWorldControlStore(path)); same(worldOwner.readHead(original.actor.binding.careerId), original.world.head);
    const originalAction = original.acceptedAction.source;
    if (originalAction.variant !== 'declared_take_v1') throw Error('V207 original dispatch first TAKE Source differs');
    const h: NativeSpinNeutralPostObservationContextV193 = { f, accepted, save, events, current: () => basis, advance, physical,
      original: originalAction, genesis: original.genesis, worldOwner };
    const commitmentOptions: Pick<NonNullable<Parameters<typeof continueNativeSpinNeutralV193PostDelivery>[3]>, 'prepareCommitment'> = {
      prepareCommitment(source, executionInput) {
        const { buntProfileBinding: _bunt, ...ordinary } = source;
        return { ...ordinary, capability: 'same_pa_physical_commitment_v123' as const, spinBindingV123: {
          kind: 'fixed_native_spin_binding_v123' as const, modelReference: refs.modelReference,
          intent: { technique: 'NO_SPIN_TARGET' as const, selectedAtTick: executionInput.nominalRequest.currentFrame.time.tick }, qualificationReferences: refs.qualificationReferences } };
      } };
    let pendingEntryAuthenticated = false, admittedEntryAuthenticated = false;
    if (!original.forecastAlreadyAdmitted) {
      try {
        continueNativeSpinNeutralV193PostDelivery(h, label, pins, { ...commitmentOptions, onStage(stage) {
          assert.equal(stage, 'native-post-forecast-entry-authenticated'); assert.equal(db.isTransaction, false); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 0);
          pendingEntryAuthenticated = true; emit('pending-forecast-native-entry-authenticated', { viewReference: basis.viewReference, eventReferences: [...events] });
        } });
        throw Error('V207 Native forecast crossed its cut7 checkpoint');
      } catch (error) { if (error !== stopAfterAdmission) throw error; }
      assert(pendingEntryAuthenticated); assert.equal(advances, 1); must(admissionCheckpoint);
    } else {
      admissionCheckpoint = readCurrentCheckpoint(); emit('retained-cut7-current-and-cal32-before-consumer-reauthentication', admissionCheckpoint);
    }
    const beforeMissingCalibration = readCurrentCheckpoint(), beforeProbeVersion = db.prepare('PRAGMA data_version').get()!.data_version;
    const missingCalibrationContext: NativeSpinNeutralPostObservationContextV193 = { ...h, current: () => ({ ...basis,
      calibrationSet: { calibrations: basis.calibrationSet.calibrations.slice(1) } }) };
    let missingCalibrationRejected = false, missingCalibrationStageReached = false;
    const unexpectedMissingCalibrationStage = new Error('V207_MISSING_CALIBRATION_PROBE_CROSSED_AUTHENTICATION');
    try {
      continueNativeSpinNeutralV193PostDelivery(missingCalibrationContext, label, pins, { ...commitmentOptions, onStage() {
        missingCalibrationStageReached = true; throw unexpectedMissingCalibrationStage;
      } });
      throw Error('V207 incomplete caller calibration context was accepted');
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Native post-forecast complete calibration set missing') throw error;
      missingCalibrationRejected = true;
    }
    assert(missingCalibrationRejected); assert.equal(missingCalibrationStageReached, false); assert.equal(db.isTransaction, false);
    assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 0); assert.equal(db.prepare('PRAGMA data_version').get()!.data_version, beforeProbeVersion);
    same(readCurrentCheckpoint(), beforeMissingCalibration);
    emit('missing-caller-calibration-rejected-before-native-authentication', { missingCalibrationRejected, currentCheckpointUnchanged: true,
      retainedCalibrationCount: basis.calibrationSet.calibrations.length, probeCalibrationCount: missingCalibrationContext.current().calibrationSet.calibrations.length });
    try {
      continueNativeSpinNeutralV193PostDelivery(h, label, pins, { ...commitmentOptions, onStage(stage) {
        assert.equal(stage, 'native-post-forecast-entry-authenticated'); assert.equal(db.isTransaction, false); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 0);
        admittedEntryAuthenticated = true; emit('admitted-forecast-native-entry-authenticated-stop', { viewReference: basis.viewReference, eventReferences: [...events] });
        throw stopAfterCurrentReauthentication;
      } });
      throw Error('V207 Native current consumer crossed its authentication-only stop point');
    } catch (error) { if (error !== stopAfterCurrentReauthentication) throw error; }
    assert(admittedEntryAuthenticated); assert.equal(accepted.size, 0);
    const final = readCurrentCheckpoint();
    emit('normal-current-cut7-and-native-consumer-authenticated', final);
    return { ...final, boundary: 'NATIVE_FORECAST_ADMISSION_CHECKPOINT_ONLY' as const, originalInputs: original,
      forecastReference: pins.forecastReference, pendingEntryAuthenticated, admittedEntryAuthenticated, postAdmissionEntryReauthenticated: admittedEntryAuthenticated, missingCalibrationRejected,
      nativePostForecastEntryAuthenticated: true, nativePostForecastConsumerProven: true, nativeResumeAdapterRequired: false, resumeReady: true,
      recoveredFromCurrentCut7: original.forecastAlreadyAdmitted, forecastRegenerated: false, scoreAccepted: false, emotionAccepted: false, commitmentAccepted: false,
      resolutionAccepted: false, fieldRootAccepted: false, officialTerminalProven: false, newPracticeAccepted: 0, twoTakeReplayed: false, performancePass: false };
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = [];
    for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V207 owner cleanup failed');
  }
}

/** Compare every extracted original-input field against the facts recorded by
 * the original V206 Native run, using its unchanged pre-forecast snapshot. */
export function compareNativeOriginalInputsV207(path: string, input: NativeDeliveryForecastV206Input,
  baseline: Readonly<{ originalInputs: Record<string, unknown> }>, emit: (name: string, value?: unknown) => void) {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path, { readOnly: true }); db.exec('PRAGMA query_only=1');
  let failure: unknown;
  try {
    const result = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const preparation = input.retainedInputReferences, refs = preparation.retainedInputReferences, pins = input.resumePins;
      const actor = must(readPhysicalPlateAppearanceActorFromSqlite(db, refs.actorReference.sourceId));
      same(reference('physical_plate_appearance_actors', actor), refs.actorReference);
      assert.equal(actor.binding.careerId, 'career-a'); assert.equal(actor.binding.playerId, 'away-1'); assert.equal(actor.binding.gameDay, 40);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record;
      if (launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight') throw Error('V207 compatibility normal launch required');
      const locate = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => {
        const row = must(db.prepare(`SELECT source_hash,snapshot_hash FROM main.${owner} WHERE source_id=?`).get(sourceId));
        return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
      };
      const facts = readNativeInFlightOriginalInputsV207(db, preparation, pins, actor, launch, locate);
      const expectedFieldNames = ['action', 'posture', 'intent', 'model', 'fieldCalibration', 'bodyModel', 'batterBody', 'qualifications', 'acceptedAction',
        'dispatchCalibrationIds', 'genesis', 'world', 'physicalHead', 'observationHead', 'deliveryHead'] as const;
      assert.deepStrictEqual(Object.keys(facts).sort(), [...expectedFieldNames].sort(), 'V207 extracted original-input field contract changed');
      const expected = Object.fromEntries(expectedFieldNames.map(key => { assert(Object.hasOwn(baseline.originalInputs, key), 'V207 baseline field missing: ' + key); return [key, baseline.originalInputs[key]]; }));
      const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as { parseDebugRecord(value: string): unknown; stringifyDebugRecord(value: unknown): string };
      const actualText = codec.stringifyDebugRecord(facts), expectedText = codec.stringifyDebugRecord(expected);
      assert.equal(actualText, expectedText, 'V207 extracted original-input debug records differ');
      assert.deepStrictEqual(codec.parseDebugRecord(actualText), codec.parseDebugRecord(expectedText));
      for (const [key, value] of Object.entries({ actor, launch })) {
        assert(Object.hasOwn(baseline.originalInputs, key));
        assert.equal(codec.stringifyDebugRecord(value), codec.stringifyDebugRecord(baseline.originalInputs[key]), 'V207 compatibility prerequisite differs: ' + key);
      }
      return { boundary: 'NATIVE_ORIGINAL_INPUTS_READONLY_COMPATIBILITY_ONLY' as const, originalInputs: facts,
        comparedFieldNames: Object.keys(facts), allExtractedFieldsExact: true, newAcceptedOperations: 0, fullContinuationComplete: false };
    }));
    emit('original-inputs-common-reader-exact', result); return result;
  } catch (error) { failure = error; throw error; }
  finally {
    try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
    catch (error) { throw new AggregateError(failure === undefined ? [error] : [failure, error], 'V207 compatibility reader cleanup failed'); }
  }
}

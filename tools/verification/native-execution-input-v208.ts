import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json, actorHash as hash, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
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
import { readCurrentBattingEmotionExecutionFromSqlite } from '../../src/host/world/SqliteBattingEmotionExecutionStore';
import { readCurrentSamePaBattingExecutionInputFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import { openSqliteWorldControlStore } from '../../src/host/world/SqliteWorldControlStore';
import { assertInFlightBattingWriteCurrentFromSqlite } from '../../src/host/world/InFlightBattingLifecycleFenceFromSqlite';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
import type { admitNativeForecastAdmissionV207 } from './native-forecast-admission-v207';
import { createNativeFieldPreparationV198Declaration } from './native-field-preparation-v198';
import { readNativeInFlightOriginalInputsV207 } from './native-inflight-original-inputs-v207';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativeExecutionInputV208Input = Readonly<Pick<ReturnType<typeof admitNativeForecastAdmissionV207>,
  'retainedInputReferences' | 'resumePins' | 'finalViewReference' | 'eventReferences'>>;
const label = 'native-spin-neutral-v193:pitch3';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V208 retained owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V208 normal retained prerequisite missing'); return value; };

/** Continue the normal admitted-forecast tail through accepted execution input.
 * Every completed cut8/cut9 is authenticated and saved before continuing. */
export function admitNativeExecutionInputV208(path: string, input: NativeExecutionInputV208Input, emit: (name: string, value?: unknown) => void) {
  assert.equal(input.finalViewReference.sourceId, 'physical-fixture:cut7:view'); assert.equal(input.eventReferences.length, 7);
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
      if (currentDeliveryCut.record.kind !== 'same_pa_physical_cut_v1' || currentDeliveryCut.stage !== 'in_flight' || currentDeliveryCut.record.operationOrdinal !== 2) throw Error('V208 normal current delivery cut required');
      const deliveryCut = currentDeliveryCut.record; same(currentDeliveryCut.actor, actor); same(currentDeliveryCut.physicalPitchReference, pins.launchReference);
      const captureCut = readSamePaPhysicalOperationFromSqlite(db, pins.captureCutReference).record;
      if (captureCut.kind !== 'same_pa_physical_cut_v1' || captureCut.operationOrdinal !== 1) throw Error('V208 normal original capture required');
      same(captureCut.source.sourceId, label + ':capture-cut'); assert.equal(captureCut.source.viewReference.sourceId, 'physical-fixture:cut2:view');
      same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record;
      if (launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight') throw Error('V208 normal original launch required');
      same(launch.source.sourceId, label + ':launch'); same(launch.lineage, captureCut.lineage);
      const observation = readBattingPerceptionFromSqlite(db, 'observation', pins.observationReference);
      if (observation.kind !== 'batting_observation' || observation.source.capability !== 'owned_in_flight_batting_observation_v1') throw Error('V208 normal retained observation required');
      same(observation.source.sourceId, label + ':capture'); same(observation.source.physicalPitchReference, pins.launchReference);
      same(observation.source.physicalOperationReference, pins.captureCutReference); same(observation.source.postureReference, pins.postureReference);
      assert.equal(observation.source.viewReference.sourceId, 'physical-fixture:cut3:view'); same(observation.source.observedTick, captureCut.evaluationTick);
      same(observation.source.previousObservationReference, null); same(observation.lineage, captureCut.lineage);
      const observationView = readHistoricalSamePaLifecycleViewFromSqlite(db, observation.source.viewReference);
      same(observationView.actor, actor); same(observationView.view.cut.physicalOperationReference, pins.captureCutReference);
      const delivery = readBattingPerceptionFromSqlite(db, 'delivery', pins.deliveryReference);
      if (delivery.kind !== 'batting_observation_delivery' || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1') throw Error('V208 normal retained delivery required');
      same(delivery.source.sourceId, label + ':delivery'); same(delivery.source.observationReference, pins.observationReference);
      assert.equal(delivery.source.viewReference.sourceId, 'physical-fixture:cut5:view'); same(delivery.source.physicalPitchReference, pins.launchReference);
      same(delivery.source.physicalOperationReference, pins.deliveryCutReference); same(delivery.lineage, launch.lineage);
      same(deliveryCut.source.sourceId, label + ':delivery-cut'); assert.equal(deliveryCut.source.viewReference.sourceId, 'physical-fixture:cut4:view');
      same(deliveryCut.source.launchReference, pins.launchReference); same(deliveryCut.source.previousOperationReference, pins.captureCutReference);
      assert.equal(deliveryCut.source.throughTick, captureCut.evaluationTick + observation.calculation.effectiveValues.deliveryLatencyTicks);
      const historical = readHistoricalSamePaLifecycleViewFromSqlite(db, input.finalViewReference);
      same(historical.actor, actor); same(historical.view.cut.physicalOperationReference, pins.deliveryCutReference);
      same(historical.view.cut.operationReference, pins.forecastReference);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, input.finalViewReference); same(current.view, historical.view); same(current.members, historical.members);
      assertInFlightBattingWriteCurrentFromSqlite(db, input.finalViewReference, null);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', historical.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V208 normal historical prefix required');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), historical.view.source.prefixReference); same(prefix.source.eventReferences, input.eventReferences);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', historical.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V208 original TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), historical.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const calibrationIds = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(input.finalViewReference.sourceId).map(row => String(row.source_id));
      assert.equal(calibrationIds.length, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', calibrationIds)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V208 original calibration missing'); return value; });
      for (const calibration of calibrations) same(calibration.source.viewReference, input.finalViewReference);
      const sensor = must(calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === actor.binding.playerId));
      if (sensor.source.response.kind !== 'accepted_execution_values_v1') throw Error('V208 original explicit observation response missing');
      const observationValues = sensor.source.response.values as AcceptedBattingObservationCalibration['values'];
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(observationValues.calibration.errorParameters[key], 0);
      const { action, posture, intent, model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, dispatchCalibrationIds, genesis, world, physicalHead, observationHead, deliveryHead } = readNativeInFlightOriginalInputsV207(db, preparation, pins, actor, launch, locate);
      const forecast = readBattingPerceptionFromSqlite(db, 'prediction', pins.forecastReference);
      if (forecast.kind !== 'batting_observed_prediction' || forecast.source.capability !== 'owned_in_flight_batting_observed_prediction_v1') throw Error('V208 normal retained forecast required');
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
        observationHead, deliveryHead, forecast, forecastView, forecastHead, executionHeadsBefore: db.prepare('SELECT * FROM main.batting_execution_v1_heads ORDER BY rowid').all() };
    }));
    assert.equal(original.world.head.worldRevision, 0);
    emit('retained-current-cut7-and-original-inputs-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(original.dispatchCalibrationIds); release(dispatch); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const accepted = new Map<string, unknown>(), allowedSources = new Set(['score', 'emotion', 'decision-cut', 'input'].map(name => label + ':' + name));
    const save = <T extends { sourceId: string }>(source: T): T => {
      assert(allowedSources.has(source.sourceId), 'V208 only the existing score/emotion/decision/input Source may be declared');
      assert(!accepted.has(source.sourceId), 'V208 original Source must not be declared twice');
      accepted.set(source.sourceId, source); emit('inert-source-declaration-before-acceptance', source); return source;
    };
    const f = { db, path, actor: original.actor, acceptedAction: original.acceptedAction, acceptedCalibrations, x: { f: { track } } };
    const events = [...original.prefix.source.eventReferences], efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    let basis: ReturnType<NativeSpinNeutralPostObservationContextV193['current']> = { view: original.historical.view, viewReference: input.finalViewReference,
      basis: original.historical, calibrationSet: { calibrations: original.calibrations } };
    let advances = 0;
    const routeMembers = (values: typeof original.calibrations) => values.map(value => json({ route: value.source.route, playerId: value.source.member.playerId })).sort();
    const readCurrentCheckpoint = (cut: 8 | 9) => withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      assert.equal(basis.viewReference.sourceId, 'physical-fixture:cut' + cut + ':view'); assert.equal(events.length, cut);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, basis.viewReference); same(current.view, basis.view); same(current.members, basis.basis.members);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V208 normal current prefix missing');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference); same(prefix.source.eventReferences, events);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', current.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V208 current TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), current.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const ids = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(basis.viewReference.sourceId).map(row => String(row.source_id));
      assert.equal(ids.length, 32); assert.equal(new Set(ids).size, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', ids)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V208 persisted current calibration missing'); return value; });
      for (const calibration of calibrations) {
        same(calibration.source.viewReference, basis.viewReference);
        const member = must(current.members.find(value => value.playerId === calibration.source.member.playerId)); same(calibration.source.member, member);
      }
      same(calibrations, basis.calibrationSet.calibrations); same(routeMembers(calibrations), routeMembers(original.calibrations));
      assertInFlightBattingWriteCurrentFromSqlite(db, basis.viewReference, null);
      const scoreReference = locate('batting_score_v1_assessments', label + ':score'), score = readBattingPerceptionFromSqlite(db, 'assessment', scoreReference);
      if (score.kind !== 'batting_score_assessment' || score.source.capability !== 'owned_in_flight_batting_score_assessment_v1') throw Error('V208 normal score missing');
      assert.equal(score.source.viewReference.sourceId, 'physical-fixture:cut7:view'); same(score.source.predictionReference, pins.forecastReference);
      same(score.source.modelReference, refs.modelReference); same(score.source.observationCutReference, pins.observationReference);
      const emotionReference = locate('batting_emotion_execution_v1_executions', label + ':emotion'), emotion = readCurrentBattingEmotionExecutionFromSqlite(db, emotionReference);
      if (emotion.source.capability !== 'owned_in_flight_batting_emotion_execution_v1') throw Error('V208 normal in-flight emotion required');
      assert.equal(emotion.source.viewReference.sourceId, 'physical-fixture:cut7:view'); same(emotion.source.observationReference, pins.observationReference);
      same(emotion.source.deliveryReference, pins.deliveryReference); same(emotion.source.physicalPitchReference, pins.launchReference); same(emotion.source.physicalOperationReference, pins.deliveryCutReference);
      same(emotion.source.genesisReference, reference('batting_emotion_v1_geneses', original.genesis));
      same(emotion.source.expectedWorld, { careerId: original.actor.binding.careerId, worldRevision: original.world.head.worldRevision,
        controlRevision: original.world.head.control.revision, controlHash: hash(original.world.head.control) });
      const world = must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId));
      assert.equal(world.head.worldRevision, 1); assert.equal(world.head.worldRevision, emotion.acceptance.afterWorldRevision);
      same(world, { ...original.world, head: { ...original.world.head, worldRevision: original.world.head.worldRevision + 1 } });
      const decisionCutReference = cut === 9 ? locate('pa_physical_v1_cuts', label + ':decision-cut') : null;
      const physicalReference = decisionCutReference ?? pins.deliveryCutReference, currentPhysicalCut = readCurrentSamePaInFlightCutFromSqlite(db, physicalReference);
      if (currentPhysicalCut.record.kind !== 'same_pa_physical_cut_v1' || currentPhysicalCut.stage !== 'in_flight') throw Error('V208 normal physical in-flight cut missing');
      same(currentPhysicalCut.actor, original.actor); same(currentPhysicalCut.physicalPitchReference, pins.launchReference); assert.equal(currentPhysicalCut.record.operationOrdinal, cut === 8 ? 2 : 3);
      same(current.view.cut.physicalOperationReference, physicalReference);
      if (cut === 8) {
        same(currentPhysicalCut.record, original.deliveryCut); same(current.view.cut.operationReference, emotionReference); same(events.at(-1), emotionReference);
      } else {
        assert.equal(currentPhysicalCut.record.source.sourceId, label + ':decision-cut'); assert.equal(currentPhysicalCut.record.source.viewReference.sourceId, 'physical-fixture:cut8:view');
        same(currentPhysicalCut.record.source.previousOperationReference, pins.deliveryCutReference); same(currentPhysicalCut.record.source.launchReference, pins.launchReference);
        same(currentPhysicalCut.record.source.throughTick, emotion.acceptance.proposal.inputs.swingDecision.tick);
        same(current.view.cut.operationReference, decisionCutReference); same(events.at(-1), decisionCutReference);
      }
      const invocationHead = (owner: string) => db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all(owner, original.action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, original.actor.binding.playerId);
      same(invocationHead('batting_observation_v1_observations'), original.observationHead); same(invocationHead('batting_observation_v1_deliveries'), original.deliveryHead);
      same(invocationHead('batting_prediction_v1_predictions'), original.forecastHead); same(db.prepare('SELECT * FROM main.batting_execution_v1_heads ORDER BY rowid').all(), original.executionHeadsBefore);
      const resumePins = decisionCutReference === null ? { ...pins, scoreReference, emotionReference } : { ...pins, scoreReference, emotionReference, decisionCutReference };
      return { boundary: 'NATIVE_EXECUTION_INPUT_INTERMEDIATE_CURRENT_CHECKPOINT' as const, retainedInputReferences: preparation, resumePins,
        finalViewReference: basis.viewReference, finalCurrent: current, finalPrefixReference: current.view.source.prefixReference, prefix, totals, calibrations,
        calibrationReferences: calibrations.map(value => reference('pa_lifecycle_v1_execution_calibrations', value)), eventReferences: [...events], currentPhysicalCut,
        decisionCutReference, scoreReference, score, emotionReference, emotion, world,
        finalLifecycleCurrentProven: true, normalLifecycleAdvances: advances, nativePostInputConsumerProven: false,
        nativeResumeAdapterRequired: true, resumeReady: false, fullContinuationComplete: false, executionInputAccepted: false };
    }));
    const advance: NativeSpinNeutralPostObservationContextV193['advance'] = event => {
      assert(advances < 2, 'V208 only cut8 and cut9 may be advanced'); const cut: 8 | 9 = advances === 0 ? 8 : 9;
      assert.equal(event.owner, cut === 8 ? 'batting_emotion_execution_v1_executions' : 'pa_physical_v1_cuts');
      assert.equal(event.sourceId, label + (cut === 8 ? ':emotion' : ':decision-cut'));
      events.push(event); assert.equal(events.length, cut);
      emit('advance-' + cut + '-start', { eventReference: event, anchorViewReference: original.prefix.source.anchorViewReference, eventReferences: [...events], efforts });
      const next = prepareSamePaLifecycleFixture(f, original.prefix.source.anchorViewReference, [...events], 'physical-fixture:cut' + cut, efforts, original.observationValues,
        undefined, undefined, undefined, stage => emit('advance-' + cut + '-' + stage));
      basis = { view: next.view, viewReference: next.viewReference, basis: next.basis, calibrationSet: { calibrations: next.calibrationSet.calibrations } };
      advances++; release(next.owner);
      const checkpoint = readCurrentCheckpoint(cut);
      basis = { view: checkpoint.finalCurrent.view, viewReference: checkpoint.finalViewReference, basis: checkpoint.finalCurrent, calibrationSet: { calibrations: checkpoint.calibrations } };
      emit('normal-cut' + cut + '-current-cal32-physical-world-checkpoint', checkpoint); return next;
    };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => accepted.get(id) }));
    const worldOwner = track(openSqliteWorldControlStore(path)); same(worldOwner.readHead(original.actor.binding.careerId), original.world.head);
    const originalAction = original.acceptedAction.source;
    if (originalAction.variant !== 'declared_take_v1') throw Error('V208 original dispatch first TAKE Source differs');
    assert.equal(original.action.source.nominalPitch.delivery.matchSeed, 19); assert.equal(originalAction.nominalPitch.delivery.matchSeed, 19);
    assert.equal(originalAction.nominalPitch.delivery.outingId, 'outing-1'); assert.equal(original.action.lineage.playId, 7); assert.equal(original.launch.pitchOrdinal, 3);
    const h: NativeSpinNeutralPostObservationContextV193 = { f, accepted, save, events, current: () => basis, advance, physical,
      original: originalAction, genesis: original.genesis, worldOwner };
    const stop = new Error('V208_STOP_AFTER_NORMAL_EXECUTION_INPUT_ACCEPTANCE_BEFORE_COMMITMENT');
    let admittedEntryAuthenticated = false, executionInputReady = false;
    try {
      continueNativeSpinNeutralV193PostDelivery(h, label, pins, { onStage(stage) {
        assert.equal(db.isTransaction, false); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 0);
        if (stage === 'native-post-forecast-entry-authenticated') {
          assert.equal(advances, 0); assert.equal(events.length, 7); admittedEntryAuthenticated = true;
          emit('admitted-forecast-native-entry-authenticated', { viewReference: basis.viewReference, eventReferences: [...events] }); return;
        }
        assert.equal(stage, 'execution-input-ready'); assert.equal(advances, 2); assert.equal(events.length, 9); executionInputReady = true;
        emit('execution-input-ready-stop', { viewReference: basis.viewReference, eventReferences: [...events] }); throw stop;
      }, prepareCommitment(source, executionInput) {
        const { buntProfileBinding: _bunt, ...ordinary } = source;
        return { ...ordinary, capability: 'same_pa_physical_commitment_v123' as const, spinBindingV123: {
          kind: 'fixed_native_spin_binding_v123' as const, modelReference: refs.modelReference,
          intent: { technique: 'NO_SPIN_TARGET' as const, selectedAtTick: executionInput.nominalRequest.currentFrame.time.tick }, qualificationReferences: refs.qualificationReferences } };
      } });
      throw Error('V208 Native tail crossed its execution-input-ready checkpoint');
    } catch (error) { if (error !== stop) throw error; }
    assert(admittedEntryAuthenticated && executionInputReady); assert.equal(advances, 2); assert.equal(accepted.size, 4);
    const final = readCurrentCheckpoint(9);
    const completed = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const finalHistorical = readHistoricalSamePaLifecycleViewFromSqlite(db, final.finalViewReference);
      same(finalHistorical.view, final.finalCurrent.view); same(finalHistorical.members, final.finalCurrent.members);
      assertInFlightBattingWriteCurrentFromSqlite(db, final.finalViewReference, null);
      const inputReference = locate('batting_execution_v1_inputs', label + ':input'), executionInput = readCurrentSamePaBattingExecutionInputFromSqlite(db, inputReference);
      if (executionInput.source.capability !== 'owned_in_flight_same_pa_batting_execution_input_v1') throw Error('V208 normal in-flight execution input required');
      same(executionInput.source.viewReference, final.finalViewReference); same(executionInput.source.postureReference, pins.postureReference);
      same(executionInput.source.intentReference, pins.intentReference); same(executionInput.source.emotionReference, final.emotionReference);
      same(executionInput.source.physicalPitchReference, pins.launchReference); same(executionInput.source.physicalOperationReference, must(final.decisionCutReference));
      same(executionInput.source.assessmentReferences, [final.scoreReference]); assert.equal(executionInput.source.directive, 'SWING');
      same(executionInput.source.expectedWorld, { ...final.emotion.source.expectedWorld, worldRevision: final.world.head.worldRevision });
      for (const entry of executionInput.source.calibrationReferences) {
        const value = must(final.calibrations.find(value => value.source.route === entry.route && value.source.member.playerId === original.actor.binding.playerId));
        same(entry.calibrationReference, reference('pa_lifecycle_v1_execution_calibrations', value));
      }
      same(executionInput.source.calibrationReferences.map(value => value.route), ['batter_decision', 'batter_motor', 'batter_swing']);
      const worldAfter = must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)); same(worldAfter, final.world);
      return { input: executionInput, inputReference, finalHistorical, worldAfter };
    }));
    const resumePins = { ...pins, scoreReference: final.scoreReference, emotionReference: final.emotionReference,
      decisionCutReference: must(final.decisionCutReference), inputReference: completed.inputReference };
    emit('normal-current-cut9-execution-input-and-world-authenticated', { ...final, ...completed, resumePins,
      executionInputAccepted: true, inputAwaitingConsumerContinuation: true });
    return { ...final, ...completed, boundary: 'NATIVE_EXECUTION_INPUT_CHECKPOINT_ONLY' as const, originalInputs: original, resumePins,
      currentDecisionCut: final.currentPhysicalCut, worldBefore: original.world, admittedEntryAuthenticated,
      executionInputAccepted: true, finalLifecycleCurrentProven: true, inputAwaitingConsumerContinuation: true, normalLifecycleAdvances: advances,
      nativePostInputConsumerProven: false, nativeResumeAdapterRequired: true, resumeReady: false, fullContinuationComplete: false,
      wholeRngConsumptionProven: false, commitmentAccepted: false, resolutionAccepted: false, fieldRootAccepted: false, officialTerminalProven: false,
      newPracticeAccepted: 0, twoTakeReplayed: false, forecastRegenerated: false, performancePass: false };
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = [];
    for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V208 owner cleanup failed');
  }
}

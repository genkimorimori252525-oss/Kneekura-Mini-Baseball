import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json, actorHash as hash, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readCurrentSamePaInFlightCutFromSqlite, readSamePaPhysicalOperationFromSqlite, readSamePaPhysicalActionFromSqlite,
  readSamePaPhysicalFieldCalibrationFromSqlite, openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { openSqliteSamePlateAppearanceDispatchStore, readSamePaPreparedActionFromSqlite } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { prepareSamePaLifecycleFixture, createSamePaLifecycleFixtureCalibrationSources } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { continueNativeSpinNeutralV193PostDelivery, type NativeSpinNeutralPostObservationContextV193 } from '../../src/host/world/InFlightBattingLifecycleFixture.test-support';
import { readCurrentBattingEmotionExecutionFromSqlite } from '../../src/host/world/SqliteBattingEmotionExecutionStore';
import { readCurrentSamePaBattingExecutionInputFromSqlite, readSamePaBattingExecutionInputFromSqlite,
  readSamePaBattingIntentFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import { openSqliteWorldControlStore } from '../../src/host/world/SqliteWorldControlStore';
import { assertInFlightBattingWriteCurrentFromSqlite } from '../../src/host/world/InFlightBattingLifecycleFenceFromSqlite';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { playerBattingModelEvidenceFromSqlite } from '../../src/host/world/PlayerBattingModelEvidence';
import { battedBodyModelMaterializationEvidenceFromSqlite } from '../../src/host/world/BattedBodyModelMaterializationEvidence';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from '../../src/host/world/PlayerBodyCapabilityMaterializationEvidence';
import { readBattingEmotionGenesisFromSqlite } from '../../src/host/world/SqliteBattingEmotionStore';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
import type { resumeNativeExecutionInputV209 } from './native-execution-input-recovery-v209';
import { createNativeFieldPreparationV198Declaration } from './native-field-preparation-v198';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativePostInputResolutionV210Input = Readonly<Pick<ReturnType<typeof resumeNativeExecutionInputV209>,
  'retainedInputReferences' | 'resumePins' | 'finalViewReference' | 'eventReferences'>>;
const label = 'native-spin-neutral-v193:pitch3';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V210 retained owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V210 normal retained prerequisite missing'); return value; };

/** Resume the existing Native input consumer, preserving its two normal full
 * lifecycle advances and saving each completed current/cal32 boundary. */
export function resumeNativePostInputResolutionV210(path: string, input: NativePostInputResolutionV210Input, emit: (name: string, value?: unknown) => void) {
  assert.equal(input.finalViewReference.sourceId, 'physical-fixture:cut9:view'); assert.equal(input.eventReferences.length, 9);
  assert.equal(Object.keys(input.resumePins).length, 12);
  assert.deepStrictEqual(input.retainedInputReferences.futureProfileDeclarationOnly, createNativeFieldPreparationV198Declaration());
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path), owners = new Set<{ close(): void }>();
  const track = <T extends { close(): void }>(owner: T): T => { owners.add(owner); return owner; };
  const release = (owner: { close(): void }) => { owner.close(); owners.delete(owner); };
  const locate = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => {
    // Locator only. Every returned reference is authenticated by its normal reader.
    const row = must(db.prepare(`SELECT source_hash,snapshot_hash FROM main.${owner} WHERE source_id=?`).get(sourceId));
    return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
  };
  const snapshot = <T>(read: () => T) => withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, read));
  let failure: unknown;
  try {
    const preparation = input.retainedInputReferences, refs = preparation.retainedInputReferences, pins = input.resumePins;
    same(pins.postureReference, refs.postureReference); same(pins.intentReference, refs.intentReference);
    const decisionCutReference = pins.decisionCutReference;
    const original = snapshot(() => {
      const actor = must(readPhysicalPlateAppearanceActorFromSqlite(db, refs.actorReference.sourceId));
      same(reference('physical_plate_appearance_actors', actor), refs.actorReference);
      assert.equal(actor.binding.careerId, 'career-a'); assert.equal(actor.binding.playerId, 'away-1'); assert.equal(actor.binding.gameDay, 40);
      const currentDecisionCut = readCurrentSamePaInFlightCutFromSqlite(db, decisionCutReference), decisionCut = currentDecisionCut.record;
      if (decisionCut.kind !== 'same_pa_physical_cut_v1' || currentDecisionCut.stage !== 'in_flight' || decisionCut.operationOrdinal !== 3) throw Error('V210 normal current decision cut required');
      same(currentDecisionCut.actor, actor); same(currentDecisionCut.physicalPitchReference, pins.launchReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record;
      const captureCut = readSamePaPhysicalOperationFromSqlite(db, pins.captureCutReference).record;
      const deliveryCut = readSamePaPhysicalOperationFromSqlite(db, pins.deliveryCutReference).record;
      if (launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight'
        || captureCut.kind !== 'same_pa_physical_cut_v1' || captureCut.operationOrdinal !== 1
        || deliveryCut.kind !== 'same_pa_physical_cut_v1' || deliveryCut.operationOrdinal !== 2) throw Error('V210 normal original physical chain required');
      same(launch.source.sourceId, label + ':launch'); same(captureCut.source.sourceId, label + ':capture-cut'); same(deliveryCut.source.sourceId, label + ':delivery-cut');
      same(decisionCut.source.sourceId, label + ':decision-cut'); assert.equal(decisionCut.source.viewReference.sourceId, 'physical-fixture:cut8:view');
      same(launch.lineage, captureCut.lineage); same(launch.lineage, deliveryCut.lineage); same(launch.lineage, decisionCut.lineage);
      same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
      same(deliveryCut.source.launchReference, pins.launchReference); same(deliveryCut.source.previousOperationReference, pins.captureCutReference);
      same(decisionCut.source.launchReference, pins.launchReference); same(decisionCut.source.previousOperationReference, pins.deliveryCutReference);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, input.finalViewReference); same(current.actor, actor);
      const historical = readHistoricalSamePaLifecycleViewFromSqlite(db, input.finalViewReference); same(historical, current);
      same(current.view.cut.operationReference, decisionCutReference); same(current.view.cut.physicalOperationReference, decisionCutReference);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V210 normal cut9 prefix missing');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference); same(prefix.source.eventReferences, input.eventReferences);
      same(input.eventReferences.at(-2), pins.emotionReference); same(input.eventReferences.at(-1), decisionCutReference);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', current.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V210 original TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), current.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const ids = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(input.finalViewReference.sourceId).map(row => String(row.source_id));
      assert.equal(ids.length, 32); assert.equal(new Set(ids).size, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', ids)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V210 original current calibration missing'); return value; });
      for (const calibration of calibrations) { same(calibration.source.viewReference, input.finalViewReference);
        same(calibration.source.member, must(current.members.find(m => m.playerId === calibration.source.member.playerId))); }
      const sensor = must(calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === actor.binding.playerId));
      if (sensor.source.response.kind !== 'accepted_execution_values_v1') throw Error('V210 original explicit observation response missing');
      const observationValues = sensor.source.response.values as AcceptedBattingObservationCalibration['values'];
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(observationValues.calibration.errorParameters[key], 0);
      const action = readSamePaPhysicalActionFromSqlite(db, refs.actionReference); same(action.actor, actor); same(action.source.viewReference, refs.viewReference);
      same(launch.source.actionReference, refs.actionReference); same(launch.source.viewReference, refs.viewReference);
      const posture = readBattingPerceptionFromSqlite(db, 'posture', pins.postureReference);
      if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V210 original in-flight posture missing');
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
      assert.equal(physicalHead.length, 1); assert.equal(physicalHead[0].last_owner, decisionCutReference.owner);
      assert.equal(physicalHead[0].last_source_id, decisionCutReference.sourceId); assert.equal(physicalHead[0].last_snapshot_hash, decisionCutReference.snapshotHash);
      const observationHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_observation_v1_observations', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(observationHead.length, 1); assert.equal(observationHead[0].revision, 1);
      assert.equal(observationHead[0].last_source_id, pins.observationReference.sourceId); assert.equal(observationHead[0].last_snapshot_hash, pins.observationReference.snapshotHash);
      const deliveryHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_observation_v1_deliveries', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(deliveryHead.length, 1); assert.equal(deliveryHead[0].revision, 1);
      assert.equal(deliveryHead[0].last_source_id, pins.deliveryReference.sourceId); assert.equal(deliveryHead[0].last_snapshot_hash, pins.deliveryReference.snapshotHash);
      assert.equal(world.head.worldRevision, 1);
      const observation = readBattingPerceptionFromSqlite(db, 'observation', pins.observationReference);
      const delivery = readBattingPerceptionFromSqlite(db, 'delivery', pins.deliveryReference);
      const forecast = readBattingPerceptionFromSqlite(db, 'prediction', pins.forecastReference);
      if (observation.kind !== 'batting_observation' || observation.source.capability !== 'owned_in_flight_batting_observation_v1'
        || delivery.kind !== 'batting_observation_delivery' || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1'
        || forecast.kind !== 'batting_observed_prediction' || forecast.source.capability !== 'owned_in_flight_batting_observed_prediction_v1') throw Error('V210 original in-flight perception required');
      same(observation.source.sourceId, label + ':capture'); same(observation.source.postureReference, pins.postureReference);
      same(observation.source.physicalPitchReference, pins.launchReference); same(observation.source.physicalOperationReference, pins.captureCutReference);
      same(delivery.source.sourceId, label + ':delivery'); same(delivery.source.observationReference, pins.observationReference);
      same(delivery.source.physicalPitchReference, pins.launchReference); same(delivery.source.physicalOperationReference, pins.deliveryCutReference);
      same(forecast.source.sourceId, label + ':forecast'); same(forecast.source.observationReference, pins.observationReference);
      same(forecast.source.deliveryReference, pins.deliveryReference); same(forecast.source.modelReference, refs.modelReference);
      assert.equal(observation.source.viewReference.sourceId, 'physical-fixture:cut3:view'); assert.equal(delivery.source.viewReference.sourceId, 'physical-fixture:cut5:view');
      assert.equal(forecast.source.viewReference.sourceId, 'physical-fixture:cut6:view');
      const score = readBattingPerceptionFromSqlite(db, 'assessment', pins.scoreReference);
      if (score.kind !== 'batting_score_assessment' || score.source.capability !== 'owned_in_flight_batting_score_assessment_v1') throw Error('V210 normal retained score required');
      same(score.source.predictionReference, pins.forecastReference); same(score.source.modelReference, refs.modelReference);
      same(score.source.observationCutReference, pins.observationReference); assert.equal(score.source.viewReference.sourceId, 'physical-fixture:cut7:view');
      const emotion = readCurrentBattingEmotionExecutionFromSqlite(db, pins.emotionReference);
      if (emotion.source.capability !== 'owned_in_flight_batting_emotion_execution_v1') throw Error('V210 normal retained emotion required');
      same(emotion.source.viewReference, score.source.viewReference); same(emotion.source.observationReference, pins.observationReference);
      same(emotion.source.deliveryReference, pins.deliveryReference); same(emotion.source.physicalPitchReference, pins.launchReference);
      same(emotion.source.physicalOperationReference, pins.deliveryCutReference); same(emotion.source.genesisReference, reference('batting_emotion_v1_geneses', genesis));
      assert.equal(emotion.acceptance.afterWorldRevision, world.head.worldRevision); same(decisionCut.source.throughTick, emotion.acceptance.proposal.inputs.swingDecision.tick);
      const executionInput = readCurrentSamePaBattingExecutionInputFromSqlite(db, pins.inputReference);
      if (executionInput.source.capability !== 'owned_in_flight_same_pa_batting_execution_input_v1') throw Error('V210 normal current in-flight execution input required');
      same(executionInput.source.viewReference, input.finalViewReference); same(executionInput.source.postureReference, pins.postureReference);
      same(executionInput.source.intentReference, pins.intentReference); same(executionInput.source.emotionReference, pins.emotionReference);
      same(executionInput.source.physicalPitchReference, pins.launchReference); same(executionInput.source.physicalOperationReference, decisionCutReference);
      same(executionInput.source.assessmentReferences, [pins.scoreReference]); assert.equal(executionInput.source.directive, 'SWING');
      same(executionInput.source.expectedWorld, { careerId: actor.binding.careerId, worldRevision: world.head.worldRevision,
        controlRevision: world.head.control.revision, controlHash: hash(world.head.control) });
      const originalAction = acceptedAction.source;
      if (originalAction.variant !== 'declared_take_v1') throw Error('V210 original dispatch first TAKE Source differs');
      assert.equal(action.source.nominalPitch.delivery.matchSeed, 19); assert.equal(originalAction.nominalPitch.delivery.matchSeed, 19);
      assert.equal(originalAction.nominalPitch.delivery.outingId, 'outing-1'); assert.equal(action.lineage.playId, 7); assert.equal(launch.pitchOrdinal, 3);
      assertInFlightBattingWriteCurrentFromSqlite(db, input.finalViewReference, null);
      const forecastHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_prediction_v1_predictions', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(forecastHead.length, 1); assert.equal(forecastHead[0].revision, 1); assert.equal(forecastHead[0].last_source_id, pins.forecastReference.sourceId);
      assert.equal(forecastHead[0].last_snapshot_hash, pins.forecastReference.snapshotHash);
      return { actor, launch, captureCut, deliveryCut, decisionCut, currentDecisionCut, current, historical, prefix, totals, calibrations, observationValues,
        action, posture, intent, model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, originalAction, dispatchCalibrationIds,
        genesis, world, physicalHead, observationHead, deliveryHead, forecastHead, score, emotion, executionInput,
        executionHeadsBefore: db.prepare('SELECT * FROM main.batting_execution_v1_heads ORDER BY rowid').all() };
    });
    emit('retained-current-cut9-input-cal32-and-originals-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(original.dispatchCalibrationIds); release(dispatch); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const originalCalibrationSources = createSamePaLifecycleFixtureCalibrationSources(acceptedCalibrations, input.finalViewReference, original.current, 'physical-fixture:cut9', original.observationValues);
    same(original.calibrations.map(c => c.source), originalCalibrationSources);
    const accepted = new Map<string, unknown>(), allowedSources = new Set(['commitment', 'resolution'].map(name => label + ':' + name));
    const save = <T extends { sourceId: string }>(source: T): T => { assert(allowedSources.has(source.sourceId)); assert(!accepted.has(source.sourceId));
      accepted.set(source.sourceId, source); emit('inert-source-declaration-before-acceptance', source); return source; };
    const f = { db, path, actor: original.actor, acceptedAction: original.acceptedAction, acceptedCalibrations, x: { f: { track } } };
    const events = [...input.eventReferences], efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    let basis: ReturnType<NativeSpinNeutralPostObservationContextV193['current']> = { view: original.current.view, viewReference: input.finalViewReference,
      basis: original.current, calibrationSet: { calibrations: original.calibrations } };
    let advances = 0;
    const routeMembers = (values: typeof original.calibrations) => values.map(c => json({ route: c.source.route, playerId: c.source.member.playerId })).sort();
    const readCheckpoint = (cut: 10 | 11) => snapshot(() => {
      assert.equal(basis.viewReference.sourceId, 'physical-fixture:cut' + cut + ':view'); assert.equal(events.length, cut);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, basis.viewReference); same(current.view, basis.view); same(current.members, basis.basis.members);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V210 normal current prefix missing');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference); same(prefix.source.eventReferences, events);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', current.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V210 current TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) { same(reference('pa_lifecycle_v1_total_assessments', total), current.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
        assert.equal(total.source.effortUnits, efforts[total.source.participantReference.playerId]); }
      const ids = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(basis.viewReference.sourceId).map(row => String(row.source_id));
      assert.equal(ids.length, 32); assert.equal(new Set(ids).size, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', ids)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V210 persisted current calibration missing'); return value; });
      for (const calibration of calibrations) { same(calibration.source.viewReference, basis.viewReference);
        same(calibration.source.member, must(current.members.find(m => m.playerId === calibration.source.member.playerId))); }
      same(calibrations, basis.calibrationSet.calibrations); same(routeMembers(calibrations), routeMembers(original.calibrations));
      const commitmentReference = locate('pa_physical_v1_commitments', label + ':commitment'), commitmentProof = readSamePaPhysicalOperationFromSqlite(db, commitmentReference);
      const commitment = commitmentProof.record;
      if (commitment.kind !== 'same_pa_physical_commitment_v1' || commitment.stage !== 'committed' || commitment.operationOrdinal !== 4) throw Error('V210 normal commitment required');
      same(commitmentProof.actor, original.actor); same(commitment.source.viewReference, input.finalViewReference);
      same(commitment.source.launchReference, pins.launchReference); same(commitment.source.previousOperationReference, pins.decisionCutReference);
      same(commitment.source.inputReference, pins.inputReference); same(commitment.source.intentReference, pins.intentReference);
      if (commitment.source.capability !== 'same_pa_physical_commitment_v123') throw Error('V210 original Native spin binding required');
      same(commitment.source.spinBindingV123.modelReference, refs.modelReference); same(commitment.source.spinBindingV123.qualificationReferences, refs.qualificationReferences);
      assert.equal(commitment.source.spinBindingV123.intent.technique, 'NO_SPIN_TARGET');
      assert.equal(commitment.beforeWorldRevision, original.world.head.worldRevision); assert.equal(commitment.afterWorldRevision, original.world.head.worldRevision + 1);
      assert.equal(commitment.controlRevision, original.world.head.control.revision); assert.equal(commitment.controlHash, hash(original.world.head.control));
      const resolutionReference = cut === 11 ? locate('pa_physical_v1_resolutions', label + ':resolution') : null;
      const resolutionProof = resolutionReference === null ? null : readSamePaPhysicalOperationFromSqlite(db, resolutionReference);
      const resolution = resolutionProof?.record ?? null;
      if (resolution !== null) {
        if (resolution.kind !== 'same_pa_physical_resolution_v1' || resolution.stage !== 'resolved' || resolution.operationOrdinal !== 5) throw Error('V210 normal resolution required');
        same(resolution.source.launchReference, pins.launchReference); same(resolution.source.previousOperationReference, commitmentReference);
        same(resolution.source.commitmentReference, commitmentReference); assert.equal(resolution.source.viewReference.sourceId, 'physical-fixture:cut10:view');
        same(resolution.source.throughTick, original.launch.trajectory.endTick); same(resolutionProof!.actor, original.actor);
      }
      const currentPhysicalOperation = resolutionProof ?? commitmentProof, physicalReference = resolutionReference ?? commitmentReference;
      same(current.view.cut.operationReference, physicalReference); same(current.view.cut.physicalOperationReference, physicalReference); same(events.at(-1), physicalReference);
      assert.equal(current.view.cut.stage, cut === 11 ? 'resolved' : 'in_flight');
      const physicalHeads = db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(original.action.lineage.enrollmentReference.sourceId);
      same(physicalHeads, [{ ...original.physicalHead[0], operation_ordinal: cut === 10 ? 4 : 5, last_owner: physicalReference.owner,
        last_source_id: physicalReference.sourceId, last_snapshot_hash: physicalReference.snapshotHash }]);
      const world = must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId));
      same(world, { ...original.world, head: { ...original.world.head, worldRevision: original.world.head.worldRevision + 1 } });
      const historicalInput = readSamePaBattingExecutionInputFromSqlite(db, pins.inputReference); same(historicalInput, original.executionInput);
      const invocationHead = (owner: string) => db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all(owner, original.action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, original.actor.binding.playerId);
      same(invocationHead('batting_observation_v1_observations'), original.observationHead); same(invocationHead('batting_observation_v1_deliveries'), original.deliveryHead);
      same(invocationHead('batting_prediction_v1_predictions'), original.forecastHead); same(db.prepare('SELECT * FROM main.batting_execution_v1_heads ORDER BY rowid').all(), original.executionHeadsBefore);
      const resumePins = resolutionReference === null ? { ...pins, commitmentReference } : { ...pins, commitmentReference, resolutionReference };
      return { boundary: 'NATIVE_POST_INPUT_RESOLUTION_INTERMEDIATE_CHECKPOINT' as const, retainedInputReferences: preparation, resumePins,
        finalViewReference: basis.viewReference, finalCurrent: current, finalPrefixReference: current.view.source.prefixReference, prefix, totals, calibrations,
        calibrationReferences: calibrations.map(c => reference('pa_lifecycle_v1_execution_calibrations', c)), eventReferences: [...events], currentPhysicalOperation,
        commitmentReference, commitment, resolutionReference, resolution, physicalHeads, historicalInput, world, normalLifecycleAdvances: advances,
        finalLifecycleCurrentProven: true, nativeBattingSuffixResolved: cut === 11, lifecycleResolvedProven: cut === 11,
        commitmentAccepted: true, resolutionAccepted: cut === 11, fieldRootAccepted: false, officialTerminalProven: false,
        nativePostResolvedConsumerProven: false, nativeResumeAdapterRequired: true, resumeReady: false, fullContinuationComplete: false,
        wholeRngConsumptionProven: false, performancePass: false };
    });
    const advance: NativeSpinNeutralPostObservationContextV193['advance'] = event => {
      assert(advances < 2, 'V210 only cut10 and cut11 may be advanced'); const cut: 10 | 11 = advances === 0 ? 10 : 11;
      assert.equal(event.owner, cut === 10 ? 'pa_physical_v1_commitments' : 'pa_physical_v1_resolutions');
      assert.equal(event.sourceId, label + (cut === 10 ? ':commitment' : ':resolution'));
      events.push(event); assert.equal(events.length, cut);
      emit('advance-' + cut + '-start', { eventReference: event, anchorViewReference: original.prefix.source.anchorViewReference, eventReferences: [...events], efforts });
      const next = prepareSamePaLifecycleFixture(f, original.prefix.source.anchorViewReference, [...events], 'physical-fixture:cut' + cut, efforts, original.observationValues,
        undefined, undefined, undefined, stage => emit('advance-' + cut + '-' + stage));
      basis = { view: next.view, viewReference: next.viewReference, basis: next.basis, calibrationSet: { calibrations: next.calibrationSet.calibrations } };
      advances++; release(next.owner);
      const checkpoint = readCheckpoint(cut);
      basis = { view: checkpoint.finalCurrent.view, viewReference: checkpoint.finalViewReference, basis: checkpoint.finalCurrent, calibrationSet: { calibrations: checkpoint.calibrations } };
      emit('normal-cut' + cut + '-current-cal32-physical-world-checkpoint', checkpoint); return next;
    };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => accepted.get(id) }));
    const worldOwner = track(openSqliteWorldControlStore(path)); same(worldOwner.readHead(original.actor.binding.careerId), original.world.head);
    const h: NativeSpinNeutralPostObservationContextV193 = { f, accepted, save, events, current: () => basis, advance, physical,
      original: original.originalAction, genesis: original.genesis, worldOwner };
    let postInputEntryAuthenticated = false;
    const nativeSuffix = continueNativeSpinNeutralV193PostDelivery(h, label, pins, {
      onStage(stage) { assert.equal(stage, 'native-post-input-entry-authenticated'); assert.equal(advances, 0); assert.equal(accepted.size, 0);
        assert.equal(db.isTransaction, false); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 0); postInputEntryAuthenticated = true;
        emit('native-post-input-entry-authenticated', { viewReference: basis.viewReference, eventReferences: [...events] }); },
      prepareCommitment(source, executionInput) { const { buntProfileBinding: _bunt, ...ordinary } = source;
        return { ...ordinary, capability: 'same_pa_physical_commitment_v123' as const, spinBindingV123: {
          kind: 'fixed_native_spin_binding_v123' as const, modelReference: refs.modelReference,
          intent: { technique: 'NO_SPIN_TARGET' as const, selectedAtTick: executionInput.nominalRequest.currentFrame.time.tick }, qualificationReferences: refs.qualificationReferences } }; }
    });
    assert(postInputEntryAuthenticated); assert.equal(advances, 2); assert.equal(accepted.size, 2);
    const final = readCheckpoint(11), resolution = must(final.resolution);
    if (resolution.kind !== 'same_pa_physical_resolution_v1' || resolution.stage !== 'resolved') throw Error('V210 final normal resolution missing');
    same(nativeSuffix.commitment, final.commitment); same(nativeSuffix.commitmentReference, final.commitmentReference);
    same(nativeSuffix.resolution, resolution); same(nativeSuffix.resolutionReference, final.resolutionReference);
    const finalHistorical = snapshot(() => readHistoricalSamePaLifecycleViewFromSqlite(db, final.finalViewReference)); same(finalHistorical, final.finalCurrent);
    const result = { ...final, boundary: 'NATIVE_POST_INPUT_RESOLUTION_CHECKPOINT_ONLY' as const, originalInputs: original, finalHistorical,
      resumePins: { ...pins, commitmentReference: final.commitmentReference, resolutionReference: must(final.resolutionReference) },
      resolutionReference: must(final.resolutionReference), resolution,
      postInputEntryAuthenticated, worldBefore: original.world, worldAfter: final.world, nativeSuffix,
      actualBatBallResult: resolution.resolution, actualContact: resolution.contact, canonicalTimeline: resolution.timeline,
      nativeBattingSuffixResolved: true, lifecycleResolvedProven: true, commitmentAccepted: true, resolutionAccepted: true,
      newPracticeAccepted: 0, twoTakeReplayed: false, forecastRegenerated: false };
    emit('normal-resolved-cut11-cal32-and-world-authenticated', result); return result;
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = [];
    for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V210 owner cleanup failed');
  }
}

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json, actorHash as hash, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite, readSamePaPhysicalActionFromSqlite, readSamePaPhysicalFieldCalibrationFromSqlite,
  openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { openSqliteSamePlateAppearanceDispatchStore, readSamePaPreparedActionFromSqlite } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { prepareSamePaLifecycleFixture, createSamePaLifecycleFixtureCalibrationSources } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { readBattingEmotionExecutionFromSqlite } from '../../src/host/world/SqliteBattingEmotionExecutionStore';
import { readSamePaBattingExecutionInputFromSqlite, readSamePaBattingIntentFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { playerBattingModelEvidenceFromSqlite } from '../../src/host/world/PlayerBattingModelEvidence';
import { battedBodyModelMaterializationEvidenceFromSqlite } from '../../src/host/world/BattedBodyModelMaterializationEvidence';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from '../../src/host/world/PlayerBodyCapabilityMaterializationEvidence';
import { readBattingEmotionGenesisFromSqlite } from '../../src/host/world/SqliteBattingEmotionStore';
import { samePaFieldBallPhysics } from '../../src/host/world/SamePlateAppearanceBallPhysics';
import type { SamePaPhysicalFieldStepSource } from '../../src/host/world/SamePlateAppearancePhysicalEpisode';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import { playerObservationModelEvidenceFromSqlite } from '../../src/host/world/SqlitePlayerObservationModelStore';
import { createSamePaObservationClockProjectionSourcesV212, type SamePaObservationClockProjectionContextV212 } from '../../src/host/world/SamePaObservationClockProjectionSourcesV212';
import { deriveSamePaObservationClockProjectionV1 } from '../../src/host/world/SamePlateAppearanceObservationClockProjectionV1';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
import type { admitNativeFieldRootV211 } from './native-field-root-v211';
import { createNativeFieldPreparationV198Declaration } from './native-field-preparation-v198';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativeFieldClockV212Input = Readonly<Pick<ReturnType<typeof admitNativeFieldRootV211>,
  'retainedInputReferences' | 'resumePins' | 'finalViewReference' | 'eventReferences'>>;
const label = 'native-spin-neutral-v193:pitch3';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V212 retained owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V212 normal retained prerequisite missing'); return value; };

/** Advance one normal free Source field step to its first natural boundary.
 * Project only the next fresh cut's nine defender observation Sources. */
export function advanceNativeFieldClockV212(path: string, input: NativeFieldClockV212Input, emit: (name: string, value?: unknown) => void) {
  assert.equal(input.finalViewReference.sourceId, 'physical-fixture:cut12:view'); assert.equal(input.eventReferences.length, 12);
  assert.equal(Object.keys(input.resumePins).length, 15);
  const declaration = input.retainedInputReferences.futureProfileDeclarationOnly;
  assert.deepStrictEqual(declaration, createNativeFieldPreparationV198Declaration());
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
    const original = snapshot(() => {
      const actor = must(readPhysicalPlateAppearanceActorFromSqlite(db, refs.actorReference.sourceId));
      same(reference('physical_plate_appearance_actors', actor), refs.actorReference);
      assert.equal(actor.binding.careerId, 'career-a'); assert.equal(actor.binding.playerId, 'away-1'); assert.equal(actor.binding.gameDay, 40);
      const currentPhysicalOperation = readSamePaPhysicalOperationFromSqlite(db, pins.fieldRootReference), fieldRoot = currentPhysicalOperation.record;
      if (fieldRoot.kind !== 'same_pa_physical_field_root_v1' || fieldRoot.stage !== 'field' || fieldRoot.operationOrdinal !== 6) throw Error('V212 normal current field root required');
      const resolution = readSamePaPhysicalOperationFromSqlite(db, pins.resolutionReference).record;
      if (resolution.kind !== 'same_pa_physical_resolution_v1' || resolution.stage !== 'resolved' || resolution.operationOrdinal !== 5) throw Error('V212 normal current physical resolution required');
      const contact = must(resolution.contact); assert.equal(resolution.timeline.status.kind, 'batted_ball_pending');
      same(currentPhysicalOperation.actor, actor); same(currentPhysicalOperation.physicalPitchReference, pins.launchReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record;
      const captureCut = readSamePaPhysicalOperationFromSqlite(db, pins.captureCutReference).record;
      const deliveryCut = readSamePaPhysicalOperationFromSqlite(db, pins.deliveryCutReference).record;
      const decisionCut = readSamePaPhysicalOperationFromSqlite(db, pins.decisionCutReference).record;
      const commitment = readSamePaPhysicalOperationFromSqlite(db, pins.commitmentReference).record;
      if (launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight'
        || captureCut.kind !== 'same_pa_physical_cut_v1' || captureCut.operationOrdinal !== 1
        || deliveryCut.kind !== 'same_pa_physical_cut_v1' || deliveryCut.operationOrdinal !== 2
        || decisionCut.kind !== 'same_pa_physical_cut_v1' || decisionCut.operationOrdinal !== 3
        || commitment.kind !== 'same_pa_physical_commitment_v1' || commitment.operationOrdinal !== 4 || commitment.stage !== 'committed') throw Error('V212 normal original physical chain required');
      same(launch.source.sourceId, label + ':launch'); same(captureCut.source.sourceId, label + ':capture-cut'); same(deliveryCut.source.sourceId, label + ':delivery-cut');
      same(decisionCut.source.sourceId, label + ':decision-cut'); same(commitment.source.sourceId, label + ':commitment'); same(resolution.source.sourceId, label + ':resolution');
      for (const value of [captureCut, deliveryCut, decisionCut, commitment, resolution]) same(value.lineage, launch.lineage);
      same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
      same(deliveryCut.source.launchReference, pins.launchReference); same(deliveryCut.source.previousOperationReference, pins.captureCutReference);
      same(decisionCut.source.launchReference, pins.launchReference); same(decisionCut.source.previousOperationReference, pins.deliveryCutReference);
      same(commitment.source.launchReference, pins.launchReference); same(commitment.source.previousOperationReference, pins.decisionCutReference);
      same(resolution.source.launchReference, pins.launchReference); same(resolution.source.previousOperationReference, pins.commitmentReference);
      same(resolution.source.commitmentReference, pins.commitmentReference); same(resolution.source.throughTick, launch.trajectory.endTick);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, input.finalViewReference); same(current.actor, actor); assert.equal(current.view.cut.stage, 'field_active');
      const historical = readHistoricalSamePaLifecycleViewFromSqlite(db, input.finalViewReference); same(historical, current);
      same(current.view.cut.operationReference, pins.fieldRootReference); same(current.view.cut.physicalOperationReference, pins.fieldRootReference);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V212 normal cut12 prefix missing');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference); same(prefix.source.eventReferences, input.eventReferences);
      same(input.eventReferences.at(-3), pins.commitmentReference); same(input.eventReferences.at(-2), pins.resolutionReference); same(input.eventReferences.at(-1), pins.fieldRootReference);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', current.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V212 original TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), current.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const ids = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(input.finalViewReference.sourceId).map(row => String(row.source_id));
      assert.equal(ids.length, 32); assert.equal(new Set(ids).size, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', ids)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V212 original current calibration missing'); return value; });
      for (const calibration of calibrations) { same(calibration.source.viewReference, input.finalViewReference);
        same(calibration.source.member, must(current.members.find(m => m.playerId === calibration.source.member.playerId))); }
      const sensor = must(calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === actor.binding.playerId));
      if (sensor.source.response.kind !== 'accepted_execution_values_v1') throw Error('V212 original explicit observation response missing');
      const observationValues = sensor.source.response.values as AcceptedBattingObservationCalibration['values'];
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(observationValues.calibration.errorParameters[key], 0);
      const action = readSamePaPhysicalActionFromSqlite(db, refs.actionReference); same(action.actor, actor); same(action.source.viewReference, refs.viewReference);
      same(launch.source.actionReference, refs.actionReference); same(launch.source.viewReference, refs.viewReference);
      const posture = readBattingPerceptionFromSqlite(db, 'posture', pins.postureReference);
      if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V212 original in-flight posture missing');
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
      assert.equal(physicalHead.length, 1); assert.equal(physicalHead[0].last_owner, pins.fieldRootReference.owner);
      assert.equal(physicalHead[0].last_source_id, pins.fieldRootReference.sourceId); assert.equal(physicalHead[0].last_snapshot_hash, pins.fieldRootReference.snapshotHash);
      const observationHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_observation_v1_observations', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(observationHead.length, 1); assert.equal(observationHead[0].revision, 1);
      assert.equal(observationHead[0].last_source_id, pins.observationReference.sourceId); assert.equal(observationHead[0].last_snapshot_hash, pins.observationReference.snapshotHash);
      const deliveryHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_observation_v1_deliveries', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(deliveryHead.length, 1); assert.equal(deliveryHead[0].revision, 1);
      assert.equal(deliveryHead[0].last_source_id, pins.deliveryReference.sourceId); assert.equal(deliveryHead[0].last_snapshot_hash, pins.deliveryReference.snapshotHash);
      assert.equal(world.head.worldRevision, 2); assert.equal(physicalHead[0].operation_ordinal, 6);
      const prelaunch = readHistoricalSamePaLifecycleViewFromSqlite(db, refs.viewReference); same(prelaunch.actor, actor);
      same(fieldCalibration.source.viewReference, refs.viewReference); same(fieldCalibration.source.actionReference, refs.actionReference);
      same(fieldCalibration.source.postureReference, pins.postureReference); same(fieldCalibration.source.parameters, declaration.calibrationParameters);
      same(fieldCalibration.calibration.parameters, fieldCalibration.source.parameters);
      same(must(fieldCalibration.calibration.model.actors.find(a => a.playerId === actor.binding.playerId)), batterBody.actor);
      const validatedProfile = samePaFieldBallPhysics({ sourceVersion: declaration.futureFieldRootSourceVersion,
        parameters: fieldCalibration.source.parameters, ballPhysics: declaration.futureBallPhysics });
      same(validatedProfile, declaration.futureBallPhysics);
      const observation = readBattingPerceptionFromSqlite(db, 'observation', pins.observationReference);
      const delivery = readBattingPerceptionFromSqlite(db, 'delivery', pins.deliveryReference);
      const forecast = readBattingPerceptionFromSqlite(db, 'prediction', pins.forecastReference);
      if (observation.kind !== 'batting_observation' || observation.source.capability !== 'owned_in_flight_batting_observation_v1'
        || delivery.kind !== 'batting_observation_delivery' || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1'
        || forecast.kind !== 'batting_observed_prediction' || forecast.source.capability !== 'owned_in_flight_batting_observed_prediction_v1') throw Error('V212 original in-flight perception required');
      same(observation.source.postureReference, pins.postureReference); same(observation.source.physicalPitchReference, pins.launchReference);
      same(observation.source.physicalOperationReference, pins.captureCutReference); same(delivery.source.observationReference, pins.observationReference);
      same(delivery.source.physicalPitchReference, pins.launchReference); same(delivery.source.physicalOperationReference, pins.deliveryCutReference);
      same(forecast.source.observationReference, pins.observationReference); same(forecast.source.deliveryReference, pins.deliveryReference); same(forecast.source.modelReference, refs.modelReference);
      const score = readBattingPerceptionFromSqlite(db, 'assessment', pins.scoreReference);
      if (score.kind !== 'batting_score_assessment' || score.source.capability !== 'owned_in_flight_batting_score_assessment_v1') throw Error('V212 normal retained score required');
      same(score.source.predictionReference, pins.forecastReference); same(score.source.modelReference, refs.modelReference); same(score.source.observationCutReference, pins.observationReference);
      const emotion = readBattingEmotionExecutionFromSqlite(db, pins.emotionReference);
      if (emotion.source.capability !== 'owned_in_flight_batting_emotion_execution_v1') throw Error('V212 normal retained emotion required');
      same(emotion.source.observationReference, pins.observationReference); same(emotion.source.deliveryReference, pins.deliveryReference);
      same(emotion.source.physicalPitchReference, pins.launchReference); same(emotion.source.physicalOperationReference, pins.deliveryCutReference);
      same(emotion.source.genesisReference, reference('batting_emotion_v1_geneses', genesis)); same(decisionCut.source.throughTick, emotion.acceptance.proposal.inputs.swingDecision.tick);
      const historicalInput = readSamePaBattingExecutionInputFromSqlite(db, pins.inputReference);
      if (historicalInput.source.capability !== 'owned_in_flight_same_pa_batting_execution_input_v1') throw Error('V212 normal historical in-flight input required');
      assert.equal(historicalInput.source.viewReference.sourceId, 'physical-fixture:cut9:view'); same(historicalInput.source.postureReference, pins.postureReference);
      same(historicalInput.source.intentReference, pins.intentReference); same(historicalInput.source.emotionReference, pins.emotionReference);
      same(historicalInput.source.physicalPitchReference, pins.launchReference); same(historicalInput.source.physicalOperationReference, pins.decisionCutReference);
      same(historicalInput.source.assessmentReferences, [pins.scoreReference]); assert.equal(historicalInput.source.directive, 'SWING');
      same(commitment.source.inputReference, pins.inputReference); same(commitment.source.intentReference, pins.intentReference);
      if (commitment.source.capability !== 'same_pa_physical_commitment_v123') throw Error('V212 original Native spin binding required');
      same(commitment.source.spinBindingV123.modelReference, refs.modelReference); same(commitment.source.spinBindingV123.qualificationReferences, refs.qualificationReferences);
      assert.equal(commitment.source.spinBindingV123.intent.technique, 'NO_SPIN_TARGET');
      assert.equal(commitment.beforeWorldRevision, 1); assert.equal(commitment.afterWorldRevision, world.head.worldRevision);
      assert.equal(commitment.controlRevision, world.head.control.revision); assert.equal(commitment.controlHash, hash(world.head.control));
      same(historicalInput.source.expectedWorld, { careerId: actor.binding.careerId, worldRevision: commitment.beforeWorldRevision,
        controlRevision: world.head.control.revision, controlHash: hash(world.head.control) });
      const originalAction = acceptedAction.source;
      if (originalAction.variant !== 'declared_take_v1') throw Error('V212 original dispatch first TAKE Source differs');
      assert.equal(action.source.nominalPitch.delivery.matchSeed, 19); assert.equal(originalAction.nominalPitch.delivery.matchSeed, 19);
      assert.equal(originalAction.nominalPitch.delivery.outingId, 'outing-1'); assert.equal(action.lineage.playId, 7); assert.equal(launch.pitchOrdinal, 3);
      assert(contact.tick >= current.view.cut.evaluationTick && contact.tick >= resolution.evaluationTick, 'V212 field root cannot backdate its normal current cut');
      assert(contact.tick <= posture.source.geometry.validUntilTick, 'V212 original posture field coverage is unavailable');
      same(fieldRoot.source.sourceId, declaration.fieldLabel + ':field-root'); same(fieldRoot.source.sourceVersion, declaration.futureFieldRootSourceVersion);
      same(fieldRoot.source.launchReference, pins.launchReference); same(fieldRoot.source.previousOperationReference, pins.resolutionReference);
      same(fieldRoot.source.resolutionReference, pins.resolutionReference); same(fieldRoot.source.postureReference, pins.postureReference);
      assert.equal(fieldRoot.source.viewReference.sourceId, 'physical-fixture:cut11:view');
      same(fieldRoot.source.fieldInputs, { kind: 'fresh_physical_field_calibration_v1', calibrationReference: preparation.calibrationReference });
      same(fieldRoot.source.parameters, fieldCalibration.source.parameters); same(fieldRoot.source.ballPhysics, declaration.futureBallPhysics);
      same(fieldRoot.source.throughTick, contact.tick);
      const observationHorizonTick = posture.source.geometry.validUntilTick; assert.equal(observationHorizonTick, 42_765_369);
      assert(fieldRoot.field.motion.actors.length > 0 && fieldRoot.field.motion.actors.every(a => a.primitive.endTick === observationHorizonTick), 'V212 original primitive horizon differs');
      const rootCursor = must(fieldRoot.field.motion.cursor); assert.equal(fieldRoot.field.motion.carrierPlayerId, null);
      same(must(rootCursor.sourceCurve).profile, declaration.futureBallPhysics);
      const observationClockOriginals = calibrations.filter(c => c.source.route === 'defender_observation').map(effectiveCalibration => {
        const source = effectiveCalibration.source;
        if (source.route !== 'defender_observation' || source.response.kind !== 'accepted_execution_values_v1') throw Error('V212 original defender observation required');
        assert.equal(source.observationClockProjection, undefined); assert.equal(effectiveCalibration.observationClockProjection, undefined);
        assert.equal(source.response.values.memoryDecayParameters.ticksPerSecond, 1_000);
        const nominal = must(playerObservationModelEvidenceFromSqlite(db).read(source.nominalReference.sourceId));
        same(reference('world_player_observation_models', nominal), source.nominalReference);
        assert.equal(nominal.source.calibration.memoryDecayParameters.ticksPerSecond, 1_000);
        return { nominalReference: source.nominalReference, nominalCalibration: nominal.source.calibration, effectiveCalibration };
      });
      assert.equal(observationClockOriginals.length, 9);
      const forecastHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_prediction_v1_predictions', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(forecastHead.length, 1); assert.equal(forecastHead[0].revision, 1); assert.equal(forecastHead[0].last_source_id, pins.forecastReference.sourceId);
      assert.equal(forecastHead[0].last_snapshot_hash, pins.forecastReference.snapshotHash);
      return { actor, launch, captureCut, deliveryCut, decisionCut, commitment, resolution, contact, fieldRoot, observationHorizonTick, observationClockOriginals, currentPhysicalOperation, current, historical, prelaunch,
        prefix, totals, calibrations, observationValues, action, posture, intent, model, fieldCalibration, bodyModel, batterBody, qualifications,
        acceptedAction, originalAction, dispatchCalibrationIds, genesis, world, physicalHead, observationHead, deliveryHead, forecastHead, score, emotion, historicalInput,
        executionHeadsBefore: db.prepare('SELECT * FROM main.batting_execution_v1_heads ORDER BY rowid').all() };
    });
    emit('retained-current-cut12-and-original-clocks-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(original.dispatchCalibrationIds); release(dispatch); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const originalCalibrationSources = createSamePaLifecycleFixtureCalibrationSources(acceptedCalibrations, input.finalViewReference, original.current, 'physical-fixture:cut12', original.observationValues);
    same(original.calibrations.map(c => c.source), originalCalibrationSources);
    const fieldStepSource: SamePaPhysicalFieldStepSource = {
      sourceId: declaration.fieldLabel + ':field-step', sourceVersion: declaration.futureFieldStepSourceVersion, capability: 'same_pa_physical_field_step_v1',
      viewReference: input.finalViewReference, launchReference: pins.launchReference, previousOperationReference: pins.fieldRootReference,
      fieldRootReference: pins.fieldRootReference, previousFieldReference: pins.fieldRootReference, throughTick: original.observationHorizonTick
    };
    assert.equal(Object.hasOwn(fieldStepSource, 'action'), false);
    emit('field-step-source-declared-before-acceptance', fieldStepSource);
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => id === fieldStepSource.sourceId ? fieldStepSource : null }));
    const fieldStep = physical.acceptOperation(fieldStepSource.sourceId);
    if (fieldStep.kind !== 'same_pa_physical_field_step_v1' || fieldStep.stage !== 'field' || fieldStep.operationOrdinal !== 7) throw Error('V212 normal free field step pending');
    release(physical);
    const fieldStepReference = reference('pa_physical_v1_field_steps', fieldStep), eventReferences = [...input.eventReferences, fieldStepReference];
    assert.equal(eventReferences.length, 13);
    const acceptedStep = snapshot(() => {
      const proof = readSamePaPhysicalOperationFromSqlite(db, fieldStepReference); same(proof.record, fieldStep); same(proof.actor, original.actor);
      const physicalHeads = db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(original.action.lineage.enrollmentReference.sourceId);
      same(physicalHeads, [{ ...original.physicalHead[0], operation_ordinal: 7, last_owner: fieldStepReference.owner,
        last_source_id: fieldStepReference.sourceId, last_snapshot_hash: fieldStepReference.snapshotHash }]);
      const world = must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)); same(world, original.world);
      return { boundary: 'NATIVE_FIELD_CLOCK_STEP_ACCEPTED_BEFORE_LIFECYCLE' as const, retainedInputReferences: preparation,
        resumePins: { ...pins, fieldStepReference }, precedingLifecycleViewReference: input.finalViewReference,
        anchorViewReference: original.prefix.source.anchorViewReference, fieldStepReference, fieldStepSource, fieldStep,
        currentPhysicalOperation: proof, physicalHeads, eventReferences, world, normalLifecycleAdvances: 0, fieldStepAccepted: true,
        finalLifecycleCurrentProven: false, observationClockProjected: false, observationClockProjectionCount: 0 };
    });
    emit('normal-field-step-accepted-before-cut13', acceptedStep);
    const cursor = fieldStep.field.motion.cursor;
    if (fieldStep.field.motion.carrierPlayerId !== null || !cursor?.sourceCurve) {
      emit('normal-field-step-clock-projection-inapplicable', { ...acceptedStep, clockProjectionApplicable: false,
        reason: 'NORMAL_FIELD_STEP_HAS_CARRIER_OR_NO_FREE_SOURCE_CURSOR', executedObservationClockProbeProven: false });
      throw Error('V212 observation clock projection is inapplicable to the normal field step: carrier or free Source cursor unavailable');
    }
    const moment = fieldStep.field.motion.world.moment, oldMoment = original.fieldRoot.field.motion.world.moment;
    assert.equal(moment.originTick, oldMoment.originTick);
    assert(moment.elapsedSeconds > oldMoment.elapsedSeconds && fieldStep.evaluationTick <= original.observationHorizonTick, 'V212 normal step must advance only within its original horizon');
    same(cursor.sourceCurve.profile, declaration.futureBallPhysics);
    const observationClockProjection: SamePaObservationClockProjectionContextV212 = { fieldReference: fieldStepReference,
      targetTicksPerSecond: cursor.sourceCurve.profile.air.ticksPerSecond, originals: original.observationClockOriginals };
    assert.equal(observationClockProjection.targetTicksPerSecond, 1_000_000);
    const f = { db, path, actor: original.actor, acceptedAction: original.acceptedAction, acceptedCalibrations, x: { f: { track } }, observationClockProjection };
    const efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    emit('advance-13-start', { eventReference: fieldStepReference, anchorViewReference: original.prefix.source.anchorViewReference, eventReferences, efforts, observationClockProjection });
    const next = prepareSamePaLifecycleFixture(f, original.prefix.source.anchorViewReference, eventReferences, 'physical-fixture:cut13', efforts, original.observationValues,
      undefined, undefined, undefined, stage => emit('advance-13-' + stage));
    release(next.owner);
    const checkpoint = snapshot(() => {
      assert.equal(next.viewReference.sourceId, 'physical-fixture:cut13:view');
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, next.viewReference); same(current.view, next.view); same(current.members, next.basis.members); same(current.actor, original.actor);
      assert.equal(current.view.cut.stage, 'field_active'); same(current.view.cut.operationReference, fieldStepReference); same(current.view.cut.physicalOperationReference, fieldStepReference);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V212 normal cut13 prefix missing');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference); same(prefix.source.eventReferences, eventReferences);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', current.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V212 current TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) { same(reference('pa_lifecycle_v1_total_assessments', total), current.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
        assert.equal(total.source.effortUnits, efforts[total.source.participantReference.playerId]); }
      const ids = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(next.viewReference.sourceId).map(row => String(row.source_id));
      assert.equal(ids.length, 32); assert.equal(new Set(ids).size, 32);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', ids)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V212 persisted current calibration missing'); return value; });
      for (const calibration of calibrations) { same(calibration.source.viewReference, next.viewReference);
        same(calibration.source.member, must(current.members.find(m => m.playerId === calibration.source.member.playerId))); }
      same(calibrations, next.calibrationSet.calibrations);
      const expectedSources = createSamePaObservationClockProjectionSourcesV212(createSamePaLifecycleFixtureCalibrationSources(acceptedCalibrations,
        next.viewReference, current, 'physical-fixture:cut13', original.observationValues), observationClockProjection);
      same(calibrations.map(c => c.source), expectedSources);
      const routes = (values: typeof calibrations) => values.map(c => json({ route: c.source.route, playerId: c.source.member.playerId })).sort();
      same(routes(calibrations), routes(original.calibrations));
      const projectionProofs = calibrations.filter(c => c.source.route === 'defender_observation').map(calibration => {
        const proof = deriveSamePaObservationClockProjectionV1(db, calibration.source, current);
        same(proof.evidence, calibration.observationClockProjection); assert.equal(proof.evidence.originalTicksPerSecond, 1_000);
        assert.equal(proof.evidence.targetTicksPerSecond, 1_000_000); same(proof.evidence.fieldReference, fieldStepReference);
        return { calibrationReference: reference('pa_lifecycle_v1_execution_calibrations', calibration), proof };
      });
      assert.equal(projectionProofs.length, 9);
      assert.equal(calibrations.filter(c => c.observationClockProjection !== undefined).length, 9);
      same(readSamePaLifecycleSetFromSqlite(db, 'calibration', original.calibrations.map(c => c.source.sourceId)), original.calibrations);
      const currentPhysicalOperation = readSamePaPhysicalOperationFromSqlite(db, fieldStepReference); same(currentPhysicalOperation.record, fieldStep); same(currentPhysicalOperation.actor, original.actor);
      same(currentPhysicalOperation.physicalPitchReference, pins.launchReference);
      const physicalHeads = db.prepare('SELECT * FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(original.action.lineage.enrollmentReference.sourceId);
      same(physicalHeads, acceptedStep.physicalHeads);
      const world = must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)); same(world, original.world);
      const historicalInput = readSamePaBattingExecutionInputFromSqlite(db, pins.inputReference); same(historicalInput, original.historicalInput);
      same(readSamePaPhysicalFieldCalibrationFromSqlite(db, preparation.calibrationReference), original.fieldCalibration);
      same(readSamePaPhysicalOperationFromSqlite(db, pins.fieldRootReference).record, original.fieldRoot);
      same(fieldStep.source, fieldStepSource); same(fieldStep.field.motion.cursor, cursor);
      const sourceCurve = must(cursor.sourceCurve), ballSolverEvidence = must(fieldStep.ballSolverEvidence);
      const invocationHead = (owner: string) => db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all(owner, original.action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, original.actor.binding.playerId);
      same(invocationHead('batting_observation_v1_observations'), original.observationHead); same(invocationHead('batting_observation_v1_deliveries'), original.deliveryHead);
      same(invocationHead('batting_prediction_v1_predictions'), original.forecastHead); same(db.prepare('SELECT * FROM main.batting_execution_v1_heads ORDER BY rowid').all(), original.executionHeadsBefore);
      return { boundary: 'NATIVE_FIELD_CLOCK_INTERMEDIATE_CURRENT_CHECKPOINT' as const, retainedInputReferences: preparation,
        resumePins: { ...pins, fieldStepReference }, finalViewReference: next.viewReference, finalCurrent: current, finalPrefixReference: current.view.source.prefixReference,
        prefix, totals, calibrations, calibrationReferences: calibrations.map(c => reference('pa_lifecycle_v1_execution_calibrations', c)), eventReferences,
        currentPhysicalOperation, physicalHeads, fieldStepReference, fieldStep, fieldStepSource, observationClockProjection, projectionProofs,
        fieldRootReference: pins.fieldRootReference, fieldRoot: original.fieldRoot, fieldCalibrationReference: preparation.calibrationReference,
        fieldModelReference: preparation.bodyModelReference, fieldModel: original.fieldCalibration.calibration.model,
        rootBallPhysics: declaration.futureBallPhysics, sourceCurve, ballSolverEvidence, historicalInput, world,
        normalLifecycleAdvances: 1, fieldStepAccepted: true, finalLifecycleCurrentProven: true, observationClockProjected: true, observationClockProjectionCount: 9,
        clockProjectionApplicable: true, executedObservationClockProbeProven: false, executedObservationClockProbeStatus: 'UNKNOWN' as const,
        executedObservationClockProbeReason: 'NO_RETAINED_ACTUAL_DEFENDER_OBSERVATION_SOURCE',
        nativePostFieldClockConsumerProven: false, nativeResumeAdapterRequired: true, resumeReady: false,
        defensiveAiAccepted: false, legalOutcomeProven: false, officialTerminalProven: false, fullContinuationComplete: false, performancePass: false, wholeRngConsumptionProven: false };
    });
    emit('normal-cut13-current-cal32-clock-physical-world-checkpoint', checkpoint);
    const finalHistorical = snapshot(() => readHistoricalSamePaLifecycleViewFromSqlite(db, checkpoint.finalViewReference)); same(finalHistorical, checkpoint.finalCurrent);
    const result = { ...checkpoint, boundary: 'NATIVE_FIELD_CLOCK_CHECKPOINT_ONLY' as const, originalInputs: original, finalHistorical,
      worldBefore: original.world, worldAfter: checkpoint.world, declaration, originalObservationCalibrations: original.observationClockOriginals.map(o => o.effectiveCalibration),
      newPracticeAccepted: 0, twoTakeReplayed: false, forecastRegenerated: false, fieldRootRegenerated: false };
    emit('normal-field-clock-cut13-and-world-authenticated', result); return result;
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = [];
    for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V212 owner cleanup failed');
  }
}

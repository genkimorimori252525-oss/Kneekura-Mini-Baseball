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
import { createSamePaLifecycleFixtureCalibrationSources } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { openSqliteSamePlateAppearanceLifecycleStore } from '../../src/host/world/SqliteSamePlateAppearanceLifecycleStore';
import { resumeInFlightBattingDecisionCut, type NativeSpinNeutralPostObservationContextV193 } from '../../src/host/world/InFlightBattingLifecycleFixture.test-support';
import { readCurrentBattingEmotionExecutionFromSqlite } from '../../src/host/world/SqliteBattingEmotionExecutionStore';
import { readCurrentSamePaBattingExecutionInputFromSqlite, readSamePaBattingIntentFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
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
import type { admitNativeExecutionInputV208, NativeExecutionInputV208Input } from './native-execution-input-v208';
import { createNativeFieldPreparationV198Declaration } from './native-field-preparation-v198';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

type Previous = ReturnType<typeof admitNativeExecutionInputV208>;
export type NativeExecutionInputRecoveryV209Input = Readonly<{
  retainedInput: NativeExecutionInputV208Input;
  checkpoint8: Pick<Previous, 'retainedInputReferences' | 'finalViewReference' | 'finalCurrent' | 'prefix' | 'totals' |
    'calibrations' | 'calibrationReferences' | 'eventReferences' | 'scoreReference' | 'score' | 'emotionReference' | 'emotion'> & Readonly<{
      world: Previous['worldAfter']; resumePins: NativeExecutionInputV208Input['resumePins'] & Pick<Previous['resumePins'], 'scoreReference' | 'emotionReference'>;
    }>;
  advance9: Readonly<{ eventReference: SamePaReference<'pa_physical_v1_cuts'>; anchorViewReference: Previous['prefix']['source']['anchorViewReference'];
    eventReferences: Previous['eventReferences']; efforts: Readonly<Record<string, number>> }>;
  inventory: Readonly<{ viewReference: Previous['finalViewReference']; current: Previous['finalCurrent']; world: Previous['worldAfter'];
    calibrationCount: number; inputCount: number }>;
  originalObservationValues: AcceptedBattingObservationCalibration['values'];
}>;
const label = 'native-spin-neutral-v193:pitch3', cutLabel = 'physical-fixture:cut9';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V209 retained owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V209 normal retained prerequisite missing'); return value; };

/** Recover only the unperformed calibration set and execution input after the
 * genuine cut9 prefix/TOTAL/view. No earlier owner acceptance is retried. */
export function resumeNativeExecutionInputV209(path: string, input: NativeExecutionInputRecoveryV209Input, emit: (name: string, value?: unknown) => void) {
  const { retainedInput, checkpoint8, advance9, inventory } = input;
  assert.equal(retainedInput.finalViewReference.sourceId, 'physical-fixture:cut7:view'); assert.equal(retainedInput.eventReferences.length, 7);
  assert.equal(Object.keys(retainedInput.resumePins).length, 8); assert.equal(checkpoint8.finalViewReference.sourceId, 'physical-fixture:cut8:view');
  assert.equal(inventory.viewReference.sourceId, cutLabel + ':view'); assert.equal(inventory.inputCount, 0);
  assert.equal(advance9.eventReference.owner, 'pa_physical_v1_cuts'); assert.equal(advance9.eventReference.sourceId, label + ':decision-cut');
  assert.equal(advance9.eventReferences.length, 9); same(checkpoint8.retainedInputReferences, retainedInput.retainedInputReferences);
  same(checkpoint8.eventReferences, [...retainedInput.eventReferences, checkpoint8.emotionReference]);
  same(advance9.eventReferences, [...checkpoint8.eventReferences, advance9.eventReference]);
  same(checkpoint8.resumePins, { ...retainedInput.resumePins, scoreReference: checkpoint8.scoreReference, emotionReference: checkpoint8.emotionReference });
  assert.deepStrictEqual(retainedInput.retainedInputReferences.futureProfileDeclarationOnly, createNativeFieldPreparationV198Declaration());
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
    const preparation = retainedInput.retainedInputReferences, refs = preparation.retainedInputReferences, pins = retainedInput.resumePins;
    const decisionCutReference = advance9.eventReference, viewReference = inventory.viewReference;
    const original = snapshot(() => {
      const actor = must(readPhysicalPlateAppearanceActorFromSqlite(db, refs.actorReference.sourceId));
      same(reference('physical_plate_appearance_actors', actor), refs.actorReference);
      assert.equal(actor.binding.careerId, 'career-a'); assert.equal(actor.binding.playerId, 'away-1'); assert.equal(actor.binding.gameDay, 40);
      const currentDecisionCut = readCurrentSamePaInFlightCutFromSqlite(db, decisionCutReference), decisionCut = currentDecisionCut.record;
      if (decisionCut.kind !== 'same_pa_physical_cut_v1' || currentDecisionCut.stage !== 'in_flight' || decisionCut.operationOrdinal !== 3) throw Error('V209 normal current decision cut required');
      same(currentDecisionCut.actor, actor); same(currentDecisionCut.physicalPitchReference, pins.launchReference);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record;
      const captureCut = readSamePaPhysicalOperationFromSqlite(db, pins.captureCutReference).record;
      const deliveryCut = readSamePaPhysicalOperationFromSqlite(db, pins.deliveryCutReference).record;
      if (launch.kind !== 'same_pa_physical_launch_v1' || launch.operationOrdinal !== 0 || launch.stage !== 'in_flight'
        || captureCut.kind !== 'same_pa_physical_cut_v1' || captureCut.operationOrdinal !== 1
        || deliveryCut.kind !== 'same_pa_physical_cut_v1' || deliveryCut.operationOrdinal !== 2) throw Error('V209 normal original physical chain required');
      same(launch.source.sourceId, label + ':launch'); same(captureCut.source.sourceId, label + ':capture-cut'); same(deliveryCut.source.sourceId, label + ':delivery-cut');
      same(launch.lineage, captureCut.lineage); same(launch.lineage, deliveryCut.lineage); same(launch.lineage, decisionCut.lineage);
      same(captureCut.source.launchReference, pins.launchReference); same(captureCut.source.previousOperationReference, pins.launchReference);
      same(deliveryCut.source.launchReference, pins.launchReference); same(deliveryCut.source.previousOperationReference, pins.captureCutReference);
      same(decisionCut.source.launchReference, pins.launchReference); same(decisionCut.source.previousOperationReference, pins.deliveryCutReference);
      same(decisionCut.source.viewReference, checkpoint8.finalViewReference);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, viewReference); same(current, inventory.current); same(current.actor, actor);
      same(current.view.cut.operationReference, decisionCutReference); same(current.view.cut.physicalOperationReference, decisionCutReference);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V209 normal cut9 prefix missing');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference);
      same(prefix.source.eventReferences, advance9.eventReferences); same(prefix.source.anchorViewReference, advance9.anchorViewReference);
      const historical8 = readHistoricalSamePaLifecycleViewFromSqlite(db, checkpoint8.finalViewReference);
      same(historical8, checkpoint8.finalCurrent); same(historical8.actor, actor); same(historical8.view.cut.operationReference, checkpoint8.emotionReference);
      same(historical8.view.cut.physicalOperationReference, pins.deliveryCutReference);
      const prefix8 = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', historical8.view.source.prefixReference.sourceId));
      if (prefix8.kind !== 'same_pa_lifecycle_prefix') throw Error('V209 normal original cut8 prefix missing');
      same(prefix8, checkpoint8.prefix); same(reference('pa_lifecycle_v1_work_prefixes', prefix8), historical8.view.source.prefixReference);
      same(prefix8.source.eventReferences, checkpoint8.eventReferences); same(prefix8.source.anchorViewReference, advance9.anchorViewReference);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', current.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V209 original TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) { same(reference('pa_lifecycle_v1_total_assessments', total), current.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
        assert.equal(total.source.effortUnits, advance9.efforts[total.source.participantReference.playerId]); }
      same(Object.fromEntries(checkpoint8.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits])), advance9.efforts);
      const calibrations8 = readSamePaLifecycleSetFromSqlite(db, 'calibration', checkpoint8.calibrationReferences.map(ref => ref.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V209 original cut8 calibration missing'); return value; });
      assert.equal(calibrations8.length, 32); same(calibrations8, checkpoint8.calibrations);
      for (const [i, calibration] of calibrations8.entries()) { same(reference('pa_lifecycle_v1_execution_calibrations', calibration), checkpoint8.calibrationReferences[i]);
        same(calibration.source.viewReference, checkpoint8.finalViewReference); same(calibration.source.member, must(historical8.members.find(m => m.playerId === calibration.source.member.playerId))); }
      const sensor = must(calibrations8.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === actor.binding.playerId));
      if (sensor.source.response.kind !== 'accepted_execution_values_v1') throw Error('V209 original explicit observation response missing');
      same(sensor.source.response.values, input.originalObservationValues);
      const observationValues = input.originalObservationValues;
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(observationValues.calibration.errorParameters[key], 0);
      const action = readSamePaPhysicalActionFromSqlite(db, refs.actionReference); same(action.actor, actor); same(action.source.viewReference, refs.viewReference);
      same(launch.source.actionReference, refs.actionReference); same(launch.source.viewReference, refs.viewReference);
      const posture = readBattingPerceptionFromSqlite(db, 'posture', pins.postureReference);
      if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V206 original in-flight posture missing');
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
      assert.equal(world.head.worldRevision, 1); same(world, checkpoint8.world); same(world, inventory.world);
      const observation = readBattingPerceptionFromSqlite(db, 'observation', pins.observationReference);
      const delivery = readBattingPerceptionFromSqlite(db, 'delivery', pins.deliveryReference);
      const forecast = readBattingPerceptionFromSqlite(db, 'prediction', pins.forecastReference);
      if (observation.kind !== 'batting_observation' || observation.source.capability !== 'owned_in_flight_batting_observation_v1'
        || delivery.kind !== 'batting_observation_delivery' || delivery.source.capability !== 'owned_in_flight_batting_observation_delivery_v1'
        || forecast.kind !== 'batting_observed_prediction' || forecast.source.capability !== 'owned_in_flight_batting_observed_prediction_v1') throw Error('V209 original in-flight perception required');
      same(observation.source.sourceId, label + ':capture'); same(observation.source.postureReference, pins.postureReference);
      same(observation.source.physicalPitchReference, pins.launchReference); same(observation.source.physicalOperationReference, pins.captureCutReference);
      same(delivery.source.sourceId, label + ':delivery'); same(delivery.source.observationReference, pins.observationReference);
      same(delivery.source.physicalPitchReference, pins.launchReference); same(delivery.source.physicalOperationReference, pins.deliveryCutReference);
      same(forecast.source.sourceId, label + ':forecast'); same(forecast.source.observationReference, pins.observationReference);
      same(forecast.source.deliveryReference, pins.deliveryReference); same(forecast.source.modelReference, refs.modelReference);
      assert.equal(observation.source.viewReference.sourceId, 'physical-fixture:cut3:view'); assert.equal(delivery.source.viewReference.sourceId, 'physical-fixture:cut5:view');
      assert.equal(forecast.source.viewReference.sourceId, 'physical-fixture:cut6:view');
      const score = readBattingPerceptionFromSqlite(db, 'assessment', checkpoint8.scoreReference);
      if (score.kind !== 'batting_score_assessment' || score.source.capability !== 'owned_in_flight_batting_score_assessment_v1') throw Error('V209 normal retained score required');
      same(score, checkpoint8.score); same(score.source.predictionReference, pins.forecastReference); same(score.source.modelReference, refs.modelReference);
      same(score.source.observationCutReference, pins.observationReference); same(score.source.viewReference, retainedInput.finalViewReference);
      const emotion = readCurrentBattingEmotionExecutionFromSqlite(db, checkpoint8.emotionReference);
      if (emotion.source.capability !== 'owned_in_flight_batting_emotion_execution_v1') throw Error('V209 normal retained emotion required');
      same(emotion, checkpoint8.emotion); same(emotion.source.viewReference, retainedInput.finalViewReference);
      same(emotion.source.observationReference, pins.observationReference); same(emotion.source.deliveryReference, pins.deliveryReference);
      same(emotion.source.physicalPitchReference, pins.launchReference); same(emotion.source.physicalOperationReference, pins.deliveryCutReference);
      same(emotion.source.genesisReference, reference('batting_emotion_v1_geneses', genesis)); assert.equal(emotion.acceptance.afterWorldRevision, world.head.worldRevision);
      same(emotion.source.expectedWorld, { careerId: actor.binding.careerId, worldRevision: emotion.acceptance.expectedFrame.worldRevision,
        controlRevision: world.head.control.revision, controlHash: hash(world.head.control) });
      same(decisionCut.source.throughTick, emotion.acceptance.proposal.inputs.swingDecision.tick);
      const originalAction = acceptedAction.source;
      if (originalAction.variant !== 'declared_take_v1') throw Error('V209 original dispatch first TAKE Source differs');
      assert.equal(action.source.nominalPitch.delivery.matchSeed, 19); assert.equal(originalAction.nominalPitch.delivery.matchSeed, 19);
      assert.equal(originalAction.nominalPitch.delivery.outingId, 'outing-1'); assert.equal(action.lineage.playId, 7); assert.equal(launch.pitchOrdinal, 3);
      assertInFlightBattingWriteCurrentFromSqlite(db, viewReference, null);
      const calibrationIds = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(viewReference.sourceId).map(row => String(row.source_id));
      assert.equal(calibrationIds.length, inventory.calibrationCount);
      if (calibrationIds.length !== 0 && calibrationIds.length !== 32) throw Error('same-PA lifecycle partial accepted set cannot be repaired');
      assert.equal(db.prepare('SELECT count(*) AS n FROM main.batting_execution_v1_inputs WHERE source_id=?').get(label + ':input')!.n, 0);
      const forecastHead = db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all('batting_prediction_v1_predictions', action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, actor.binding.playerId);
      assert.equal(forecastHead.length, 1); assert.equal(forecastHead[0].revision, 1); assert.equal(forecastHead[0].last_source_id, pins.forecastReference.sourceId);
      assert.equal(forecastHead[0].last_snapshot_hash, pins.forecastReference.snapshotHash);
      return { actor, launch, captureCut, deliveryCut, decisionCut, currentDecisionCut, current, prefix, totals, calibrations8, observationValues,
        action, posture, intent, model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction, originalAction, dispatchCalibrationIds,
        genesis, world, physicalHead, observationHead, deliveryHead, forecastHead, score, emotion, calibrationIds,
        executionHeadsBefore: db.prepare('SELECT * FROM main.batting_execution_v1_heads ORDER BY rowid').all() };
    });
    emit('retained-current-cut9-recovery-inputs-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(original.dispatchCalibrationIds); release(dispatch); assert.equal(acceptedCalibrations.calibrations.length, 32);
    const calibrationSources = createSamePaLifecycleFixtureCalibrationSources(acceptedCalibrations, viewReference, original.current, cutLabel, original.observationValues);
    assert.equal(calibrationSources.length, 32); assert.equal(new Set(calibrationSources.map(s => s.sourceId)).size, 32);
    let calibrationAcceptanceCount = 0;
    if (original.calibrationIds.length === 0) {
      const declarations = new Map(calibrationSources.map(source => [source.sourceId, source]));
      emit('normal-cut9-calibration-set-accept-start', { viewReference, calibrationSources });
      const owner = track(openSqliteSamePlateAppearanceLifecycleStore(path, { readAcceptedCalibration: id => declarations.get(id) }));
      const result = owner.acceptCalibrationSet(calibrationSources.map(source => source.sourceId));
      if (result.kind !== 'same_pa_lifecycle_calibration_set') throw Error('V209 normal recovered calibration set pending');
      calibrationAcceptanceCount++; release(owner);
    }
    const readCheckpoint = () => snapshot(() => {
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, viewReference); same(current, original.current);
      const ids = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(viewReference.sourceId).map(row => String(row.source_id));
      same(ids, calibrationSources.map(source => source.sourceId));
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', ids)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V209 recovered calibration missing'); return value; });
      assert.equal(calibrations.length, 32);
      for (const [i, calibration] of calibrations.entries()) { same(calibration.source, calibrationSources[i]);
        same(calibration.source.viewReference, viewReference); same(calibration.source.member, must(current.members.find(m => m.playerId === calibration.source.member.playerId))); }
      const routes = (values: typeof calibrations) => values.map(c => json({ route: c.source.route, playerId: c.source.member.playerId })).sort();
      same(routes(calibrations), routes(original.calibrations8));
      const world = must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)); same(world, original.world);
      const currentDecisionCut = readCurrentSamePaInFlightCutFromSqlite(db, decisionCutReference); same(currentDecisionCut, original.currentDecisionCut);
      assertInFlightBattingWriteCurrentFromSqlite(db, viewReference, null);
      const invocationHead = (owner: string) => db.prepare('SELECT * FROM main.batting_observation_v1_invocation_heads WHERE owner=? AND enrollment_source_id=? AND physical_pitch_source_id=? AND player_id=?')
        .all(owner, original.action.lineage.enrollmentReference.sourceId, pins.launchReference.sourceId, original.actor.binding.playerId);
      same(invocationHead('batting_observation_v1_observations'), original.observationHead); same(invocationHead('batting_observation_v1_deliveries'), original.deliveryHead);
      same(invocationHead('batting_prediction_v1_predictions'), original.forecastHead); same(db.prepare('SELECT * FROM main.batting_execution_v1_heads ORDER BY rowid').all(), original.executionHeadsBefore);
      return { boundary: 'NATIVE_EXECUTION_INPUT_RECOVERY_CURRENT_CHECKPOINT' as const, retainedInputReferences: preparation,
        resumePins: { ...pins, scoreReference: checkpoint8.scoreReference, emotionReference: checkpoint8.emotionReference, decisionCutReference },
        finalViewReference: viewReference, finalCurrent: current, finalPrefixReference: current.view.source.prefixReference, prefix: original.prefix, totals: original.totals,
        calibrations, calibrationReferences: calibrations.map(value => reference('pa_lifecycle_v1_execution_calibrations', value)), eventReferences: [...advance9.eventReferences],
        currentDecisionCut, scoreReference: checkpoint8.scoreReference, score: original.score, emotionReference: checkpoint8.emotionReference, emotion: original.emotion, world,
        finalLifecycleCurrentProven: true, calibrationAcceptanceCount, calibrationReaccepted: false, normalLifecycleAdvances: 0, executionInputAccepted: false };
    });
    const checkpoint = readCheckpoint(); emit('normal-current-cut9-cal32-recovered-checkpoint', checkpoint);
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(source: T): T => { assert.equal(source.sourceId, label + ':input'); assert.equal(accepted.size, 0);
      accepted.set(source.sourceId, source); emit('inert-input-source-declaration-before-acceptance', source); return source; };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => accepted.get(id) }));
    const worldOwner = track(openSqliteWorldControlStore(path)); same(worldOwner.readHead(original.actor.binding.careerId), original.world.head);
    const h: NativeSpinNeutralPostObservationContextV193 = {
      f: { db, path, actor: original.actor, x: { f: { track } } }, accepted, save, events: [...advance9.eventReferences], physical,
      original: original.originalAction, genesis: original.genesis, worldOwner,
      current: () => ({ view: checkpoint.finalCurrent.view, viewReference, basis: checkpoint.finalCurrent, calibrationSet: { calibrations: checkpoint.calibrations } }),
      advance: () => { throw Error('V209 must not advance an already admitted lifecycle prefix'); }
    };
    const stop = new Error('V209_STOP_AFTER_NORMAL_EXECUTION_INPUT_ACCEPTANCE_BEFORE_COMMITMENT'); let executionInputReady = false;
    try {
      resumeInFlightBattingDecisionCut(h, label, { ...pins, predictionReference: pins.forecastReference, scoreReference: checkpoint8.scoreReference,
        emotionReference: checkpoint8.emotionReference, decisionCutReference, decisionPrefixReference: checkpoint.finalPrefixReference }, {
        onStage(stage) { assert.equal(stage, 'execution-input-ready'); assert.equal(db.isTransaction, false); assert.equal(db.prepare('PRAGMA query_only').get()!.query_only, 0);
          executionInputReady = true; emit('execution-input-ready-stop', { viewReference, eventReferences: [...advance9.eventReferences] }); throw stop; },
        prepareCommitment(source, executionInput) { const { buntProfileBinding: _bunt, ...ordinary } = source;
          return { ...ordinary, capability: 'same_pa_physical_commitment_v123' as const, spinBindingV123: {
            kind: 'fixed_native_spin_binding_v123' as const, modelReference: refs.modelReference,
            intent: { technique: 'NO_SPIN_TARGET' as const, selectedAtTick: executionInput.nominalRequest.currentFrame.time.tick }, qualificationReferences: refs.qualificationReferences } }; }
      });
      throw Error('V209 Native continuation crossed its execution-input-ready checkpoint');
    } catch (error) { if (error !== stop) throw error; }
    assert(executionInputReady); assert.equal(accepted.size, 1);
    const final = readCheckpoint();
    const completed = snapshot(() => {
      const finalHistorical = readHistoricalSamePaLifecycleViewFromSqlite(db, viewReference); same(finalHistorical, final.finalCurrent);
      assertInFlightBattingWriteCurrentFromSqlite(db, viewReference, null);
      const inputReference = locate('batting_execution_v1_inputs', label + ':input'), executionInput = readCurrentSamePaBattingExecutionInputFromSqlite(db, inputReference);
      if (executionInput.source.capability !== 'owned_in_flight_same_pa_batting_execution_input_v1') throw Error('V209 normal recovered in-flight execution input required');
      same(executionInput.source.viewReference, viewReference); same(executionInput.source.member, must(final.finalCurrent.members.find(m => m.playerId === original.actor.binding.playerId)));
      same(executionInput.source.postureReference, pins.postureReference); same(executionInput.source.intentReference, pins.intentReference);
      same(executionInput.source.emotionReference, checkpoint8.emotionReference); same(executionInput.source.physicalPitchReference, pins.launchReference);
      same(executionInput.source.physicalOperationReference, decisionCutReference); same(executionInput.source.assessmentReferences, [checkpoint8.scoreReference]);
      assert.equal(executionInput.source.directive, 'SWING'); same(executionInput.source.expectedWorld, { ...original.emotion.source.expectedWorld, worldRevision: original.world.head.worldRevision });
      same(executionInput.source.calibrationReferences.map(c => c.route), ['batter_decision', 'batter_motor', 'batter_swing']);
      for (const entry of executionInput.source.calibrationReferences) same(entry.calibrationReference,
        reference('pa_lifecycle_v1_execution_calibrations', must(final.calibrations.find(c => c.source.route === entry.route && c.source.member.playerId === original.actor.binding.playerId))));
      const worldAfter = must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)); same(worldAfter, original.world);
      return { input: executionInput, inputReference, finalHistorical, worldAfter };
    });
    const result = { ...final, ...completed, boundary: 'NATIVE_EXECUTION_INPUT_RECOVERY_CHECKPOINT_ONLY' as const,
      resumePins: { ...final.resumePins, inputReference: completed.inputReference }, originalInputs: original, worldBefore: original.world,
      recoveredCurrentCut9Proven: true, executionInputAccepted: true, inputAwaitingConsumerContinuation: true,
      nativePostInputConsumerProven: false, nativeResumeAdapterRequired: true, resumeReady: false, fullContinuationComplete: false,
      wholeRngConsumptionProven: false, commitmentAccepted: false, resolutionAccepted: false, fieldRootAccepted: false, officialTerminalProven: false,
      newPracticeAccepted: 0, twoTakeReplayed: false, forecastRegenerated: false, performancePass: false };
    emit('normal-current-cut9-recovered-input-and-world-authenticated', result); return result;
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = [];
    for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V209 owner cleanup failed');
  }
}

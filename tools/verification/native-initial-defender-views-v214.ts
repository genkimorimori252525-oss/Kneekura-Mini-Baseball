import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json, actorHash as hash, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite, readCurrentSamePaLifecycleCalibrationFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { openSqliteSamePlateAppearanceLifecycleStore } from '../../src/host/world/SqliteSamePlateAppearanceLifecycleStore';
import { readSamePaPhysicalOperationFromSqlite, readSamePaPhysicalActionFromSqlite, readSamePaPhysicalFieldCalibrationFromSqlite,
  openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { openSqliteSamePlateAppearanceDispatchStore, readSamePaPreparedActionFromSqlite } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { createSamePaLifecycleFixtureCalibrationSources } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { readBattingEmotionExecutionFromSqlite } from '../../src/host/world/SqliteBattingEmotionExecutionStore';
import { readSamePaBattingExecutionInputFromSqlite, readSamePaBattingIntentFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { playerBattingModelEvidenceFromSqlite } from '../../src/host/world/PlayerBattingModelEvidence';
import { battedBodyModelMaterializationEvidenceFromSqlite } from '../../src/host/world/BattedBodyModelMaterializationEvidence';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from '../../src/host/world/PlayerBodyCapabilityMaterializationEvidence';
import { playerObservationModelEvidenceFromSqlite } from '../../src/host/world/SqlitePlayerObservationModelStore';
import { createSamePaObservationClockProjectionSourcesV212, type SamePaObservationClockProjectionContextV212 } from '../../src/host/world/SamePaObservationClockProjectionSourcesV212';
import { deriveSamePaObservationClockProjectionV1 } from '../../src/host/world/SamePlateAppearanceObservationClockProjectionV1';
import { createSamePaInitialDefenderObservationModelV214, createSamePaInitialDefenderObservationViewsV214 } from '../../src/host/world/SamePaInitialDefenderObservationViewV214';
import type { SamePaPhysicalFieldStepSource } from '../../src/host/world/SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecyclePrefix, SamePaLifecycleTotal, SamePaLifecycleView } from '../../src/host/world/SamePlateAppearanceLifecycle';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
import type { advanceNativeFieldClockV212 } from './native-field-clock-v212';
import { createNativeFieldPreparationV198Declaration } from './native-field-preparation-v198';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativeInitialDefenderViewsV214Input = Readonly<Pick<ReturnType<typeof advanceNativeFieldClockV212>,
  'retainedInputReferences' | 'resumePins' | 'finalViewReference' | 'eventReferences'> & { modelDeclaration: unknown }>;
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V214 original owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V214 normal original prerequisite missing'); return value; };

/** Nine first observations under an explicit, uncalibrated initial-view model.
 * Only normal physical/lifecycle owners write; each fresh cut prepares one route. */
export function observeNativeInitialDefenderViewsV214(path: string, input: NativeInitialDefenderViewsV214Input, emit: (name: string, value?: unknown) => void) {
  assert.equal(input.finalViewReference.sourceId, 'physical-fixture:cut13:view'); assert.equal(input.eventReferences.length, 13);
  assert.equal(Object.keys(input.resumePins).length, 16);
  const declaration = input.retainedInputReferences.futureProfileDeclarationOnly;
  same(declaration, createNativeFieldPreparationV198Declaration());
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path), owners = new Set<{ close(): void }>();
  const track = <T extends { close(): void }>(owner: T): T => { owners.add(owner); return owner; };
  const release = (owner: { close(): void }) => { owner.close(); owners.delete(owner); };
  const snapshot = <T>(read: () => T) => withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, read));
  const locate = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => {
    const row = must(db.prepare(`SELECT source_hash,snapshot_hash FROM main.${owner} WHERE source_id=?`).get(sourceId));
    return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
  };
  const heads = () => Object.fromEntries(db.prepare("SELECT name FROM main.sqlite_schema WHERE type='table' AND name LIKE '%_heads' ORDER BY name").all()
    .map(row => { const name = String(row.name); return [name, db.prepare('SELECT rowid,* FROM main."' + name.replaceAll('"', '""') + '" ORDER BY rowid').all()]; }));
  let failure: unknown;
  try {
    const preparation = input.retainedInputReferences, refs = preparation.retainedInputReferences, pins = input.resumePins;
    const original = snapshot(() => {
      const actor = must(readPhysicalPlateAppearanceActorFromSqlite(db, refs.actorReference.sourceId));
      same(reference('physical_plate_appearance_actors', actor), refs.actorReference);
      assert.equal(actor.binding.careerId, 'career-a'); assert.equal(actor.binding.gameDay, 40); assert.equal(actor.binding.playerId, 'away-1');
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, input.finalViewReference);
      const historical = readHistoricalSamePaLifecycleViewFromSqlite(db, input.finalViewReference); same(current, historical); same(current.actor, actor);
      assert.equal(current.view.cut.stage, 'field_active'); same(current.view.cut.operationReference, pins.fieldStepReference); same(current.view.cut.physicalOperationReference, pins.fieldStepReference);
      const physical = readSamePaPhysicalOperationFromSqlite(db, pins.fieldStepReference), fieldStep = physical.record;
      const fieldRoot = readSamePaPhysicalOperationFromSqlite(db, pins.fieldRootReference).record;
      if (fieldStep.kind !== 'same_pa_physical_field_step_v1' || fieldStep.operationOrdinal !== 7 || fieldStep.stage !== 'field'
        || fieldRoot.kind !== 'same_pa_physical_field_root_v1' || fieldRoot.operationOrdinal !== 6 || fieldRoot.stage !== 'field') throw Error('V214 normal retained field graph missing');
      same(physical.actor, actor); same(physical.physicalPitchReference, pins.launchReference);
      same(fieldStep.source.previousFieldReference, pins.fieldRootReference); same(fieldStep.source.fieldRootReference, pins.fieldRootReference);
      assert.equal(fieldStep.source.action, undefined); assert.equal(fieldStep.actionResult, undefined);
      same(fieldRoot.source.sourceVersion, declaration.futureFieldRootSourceVersion); same(fieldStep.source.sourceVersion, declaration.futureFieldStepSourceVersion);
      same(fieldRoot.source.ballPhysics, declaration.futureBallPhysics);
      const cursor = must(fieldStep.field.motion.cursor); assert.equal(fieldStep.field.motion.carrierPlayerId, null);
      same(must(cursor.sourceCurve).profile, declaration.futureBallPhysics);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V214 retained prefix missing');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference); same(prefix.source.eventReferences, input.eventReferences);
      same(input.eventReferences.at(-1), pins.fieldStepReference); same(input.eventReferences.at(-2), pins.fieldRootReference);
      const fieldHistory = prefix.source.eventReferences.flatMap(r => r.owner === 'pa_physical_v1_field_roots' || r.owner === 'pa_physical_v1_field_steps'
        ? [readSamePaPhysicalOperationFromSqlite(db, { ...r, owner: r.owner }).record] : []);
      same(fieldHistory, [fieldRoot, fieldStep]);
      assert(fieldHistory.every(f => f.kind === 'same_pa_physical_field_root_v1' || f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind !== 'defender_observation_v1'));
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', current.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V214 original TOTAL missing'); return value; });
      assert.equal(totals.length, 10);
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), must(current.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)).assessmentReference);
      const calIds = (view: string) => db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(view).map(r => String(r.source_id));
      const readCalibrations = (ids: string[]) => readSamePaLifecycleSetFromSqlite(db, 'calibration', ids)
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V214 original calibration missing'); return value; });
      const calibrations = readCalibrations(calIds(input.finalViewReference.sourceId)); assert.equal(calibrations.length, 32);
      for (const c of calibrations) { same(c.source.viewReference, input.finalViewReference); same(c.source.member, must(current.members.find(m => m.playerId === c.source.member.playerId))); }
      const unprojectedCalibrations = readCalibrations(calIds('physical-fixture:cut12:view')); assert.equal(unprojectedCalibrations.length, 32);
      const observationClockOriginals = unprojectedCalibrations.filter(c => c.source.route === 'defender_observation').map(effectiveCalibration => {
        const source = effectiveCalibration.source;
        if (source.route !== 'defender_observation') throw Error('V214 original route missing');
        assert.equal(source.observationClockProjection, undefined); assert.equal(effectiveCalibration.observationClockProjection, undefined);
        assert.equal(source.response.values.memoryDecayParameters.ticksPerSecond, 1_000);
        const nominal = must(playerObservationModelEvidenceFromSqlite(db).read(source.nominalReference.sourceId));
        same(reference('world_player_observation_models', nominal), source.nominalReference);
        return { nominalReference: source.nominalReference, nominalCalibration: nominal.source.calibration, effectiveCalibration };
      }); assert.equal(observationClockOriginals.length, 9);
      const projectionProofs = calibrations.filter(c => c.source.route === 'defender_observation').map(c => {
        const proof = deriveSamePaObservationClockProjectionV1(db, c.source, current); same(proof.evidence, c.observationClockProjection);
        same(proof.evidence.fieldReference, pins.fieldStepReference); assert.equal(proof.evidence.targetTicksPerSecond, 1_000_000); return proof;
      }); assert.equal(projectionProofs.length, 9);
      const sensor = must(calibrations.find(c => c.source.route === 'batter_observation'));
      if (sensor.source.route !== 'batter_observation') throw Error('V214 original batter observation missing');
      const observationValues = sensor.source.response.values as AcceptedBattingObservationCalibration['values'];
      const action = readSamePaPhysicalActionFromSqlite(db, refs.actionReference); same(action.actor, actor); same(action.source.viewReference, refs.viewReference);
      const posture = readBattingPerceptionFromSqlite(db, 'posture', pins.postureReference);
      if (posture.kind !== 'batting_invocation_posture') throw Error('V214 original posture missing');
      const intent = readSamePaBattingIntentFromSqlite(db, pins.intentReference); same(posture.source.actionReference, refs.actionReference); same(intent.source.postureReference, pins.postureReference);
      same(pins.postureReference, refs.postureReference); same(pins.intentReference, refs.intentReference);
      const model = must(playerBattingModelEvidenceFromSqlite(db).read(refs.modelReference.sourceId)); same(reference('world_player_batting_models', model), refs.modelReference); same(posture.model, model);
      const fieldCalibration = readSamePaPhysicalFieldCalibrationFromSqlite(db, preparation.calibrationReference);
      same(fieldCalibration.source.viewReference, refs.viewReference); same(fieldCalibration.source.actionReference, refs.actionReference); same(fieldCalibration.source.postureReference, pins.postureReference);
      const bodyModel = must(battedBodyModelMaterializationEvidenceFromSqlite(db).read(preparation.bodyModelReference.sourceId));
      same(locate('world_batted_body_materializations', bodyModel.sourceId), preparation.bodyModelReference); same(fieldCalibration.calibration.model, bodyModel);
      const batterBody = must(playerBodyCapabilityMaterializationEvidenceFromSqlite(db).read(preparation.batterBodyReference.sourceId)); same(reference('world_player_body_materializations', batterBody), preparation.batterBodyReference);
      same(batterBody.source, refs.matchDayBatterPreparation.request);
      const qualifications = refs.qualificationReferences.map(ref => { const value = must(readNativeSpinControlMasteryV123(db, ref.sourceId)); same(reference('world_spin_mastery_v123', value), ref); return value; });
      same(qualifications.map(q => q.source.technique), ['BACKSPIN', 'TOPSPIN']);
      const acceptedAction = readSamePaPreparedActionFromSqlite(db, locate('pa_dispatch_v1_action_plans', 'native-action'));
      const originalAction = acceptedAction.source; if (originalAction.variant !== 'declared_take_v1') throw Error('V214 original TAKE declaration missing');
      assert.equal(originalAction.nominalPitch.delivery.matchSeed, 19); assert.equal(action.source.nominalPitch.delivery.matchSeed, 19);
      assert.equal(originalAction.nominalPitch.delivery.outingId, 'outing-1'); assert.equal(action.lineage.playId, 7);
      const launch = readSamePaPhysicalOperationFromSqlite(db, pins.launchReference).record; assert.equal(launch.pitchOrdinal, 3);
      const resolution = readSamePaPhysicalOperationFromSqlite(db, pins.resolutionReference).record;
      const commitment = readSamePaPhysicalOperationFromSqlite(db, pins.commitmentReference).record;
      if (resolution.kind !== 'same_pa_physical_resolution_v1' || commitment.kind !== 'same_pa_physical_commitment_v1' || commitment.source.capability !== 'same_pa_physical_commitment_v123') throw Error('V214 original Native resolution missing');
      assert.equal(commitment.source.spinBindingV123.intent.technique, 'NO_SPIN_TARGET'); same(commitment.source.spinBindingV123.qualificationReferences, refs.qualificationReferences);
      const historicalInput = readSamePaBattingExecutionInputFromSqlite(db, pins.inputReference);
      const score = readBattingPerceptionFromSqlite(db, 'assessment', pins.scoreReference), emotion = readBattingEmotionExecutionFromSqlite(db, pins.emotionReference);
      same(commitment.source.inputReference, pins.inputReference); same(historicalInput.source.emotionReference, pins.emotionReference); same(historicalInput.source.assessmentReferences, [pins.scoreReference]);
      const world = must(readEmotionWorldRevisionFromSqlite(db, actor.binding.careerId)); assert.equal(world.head.worldRevision, 2);
      assert.equal(commitment.beforeWorldRevision, 1); assert.equal(commitment.afterWorldRevision, 2);
      same(historicalInput.source.expectedWorld, { careerId: actor.binding.careerId, worldRevision: 1, controlRevision: world.head.control.revision, controlHash: hash(world.head.control) });
      const dispatchCalibrationIds = db.prepare('SELECT source_id FROM main.pa_dispatch_v1_execution_calibrations WHERE enrollment_source_id=? ORDER BY rowid').all(action.lineage.enrollmentReference.sourceId).map(r => String(r.source_id));
      assert.equal(dispatchCalibrationIds.length, 32);
      const allHeads = heads(), physicalHeads = must(allHeads.pa_physical_v1_heads);
      assert.equal(physicalHeads.length, 1); assert.equal(physicalHeads[0].operation_ordinal, 7); assert.equal(physicalHeads[0].last_source_id, pins.fieldStepReference.sourceId);
      assert.equal(physicalHeads[0].last_snapshot_hash, pins.fieldStepReference.snapshotHash); assert.equal(physicalHeads[0].last_owner, pins.fieldStepReference.owner);
      const defenderIds = new Set(actor.defenderBindings.map(d => d.playerId)); assert.equal(defenderIds.size, 9);
      const defenders = bodyModel.actors.filter(b => defenderIds.has(b.playerId)).map(body => {
        const placement = must(actor.world.defenders.find(d => d.playerId === body.playerId));
        same(body.personId, must(actor.defenderBindings.find(d => d.playerId === body.playerId)).personId);
        return { playerId: body.playerId, heightMeters: body.heightMeters, bodyOriginHeightMeters: body.bodyOriginHeightMeters,
          bodyPrimitiveOffset: must(body.primitives.find(p => p.role === 'body')).offset, prePitchPosition: placement.position };
      }); assert.equal(defenders.length, 9);
      return { actor, current, historical, currentPhysicalOperation: physical, fieldRoot, fieldStep, fieldHistory, prefix, totals, calibrations, unprojectedCalibrations,
        observationClockOriginals, projectionProofs, observationValues, action, posture, intent, model, fieldCalibration, bodyModel, batterBody, qualifications, acceptedAction,
        originalAction, launch, commitment, resolution, historicalInput, score, emotion, world, dispatchCalibrationIds, allHeads, defenders, homePlate: fieldRoot.geometry.bases.home.region.center };
    });
    emit('retained-current-cut13-and-initial-history-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path)), acceptedCalibrations = dispatch.readCalibrationSet(original.dispatchCalibrationIds); release(dispatch);
    assert.equal(acceptedCalibrations.calibrations.length, 32);
    const projectionContext = (fieldReference: SamePaObservationClockProjectionContextV212['fieldReference']): SamePaObservationClockProjectionContextV212 => ({
      fieldReference, targetTicksPerSecond: 1_000_000, originals: original.observationClockOriginals });
    const sourcesFor = (viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>, basis: Pick<typeof original.current, 'members'>, cut: number,
      fieldReference: SamePaObservationClockProjectionContextV212['fieldReference']) => createSamePaObservationClockProjectionSourcesV212(
      createSamePaLifecycleFixtureCalibrationSources(acceptedCalibrations, viewReference, basis, 'physical-fixture:cut' + cut, original.observationValues), projectionContext(fieldReference));
    same(original.calibrations.map(c => c.source), sourcesFor(input.finalViewReference, original.current, 13, pins.fieldStepReference));
    const modelDeclaration = createSamePaInitialDefenderObservationModelV214('native-initial-defender-views-v214:nominal-initial-view-model');
    same(input.modelDeclaration, modelDeclaration);
    let views: ReturnType<typeof createSamePaInitialDefenderObservationViewsV214>['views'];
    try { views = createSamePaInitialDefenderObservationViewsV214(input.modelDeclaration, original.defenders, original.homePlate).views; }
    catch (error) { emit('nominal-initial-defender-views-declaration-rejected', { modelDeclaration, defenders: original.defenders, homePlate: original.homePlate, error: String(error) }); throw error; }
    emit('nominal-initial-defender-views-declared', { modelDeclaration, views, defenders: original.defenders, homePlate: original.homePlate,
      previousObservationReferences: views.map(v => ({ playerId: v.playerId, previousObservationReference: null })), rawGazeRestored: false, empiricallyCalibrated: false });
    let current = original.current, currentReference = input.finalViewReference, previousReference = pins.fieldStepReference, previous = original.fieldStep;
    let eventReferences = [...input.eventReferences];
    const resumePins: Record<string, SamePaReference<string>> = { ...pins };
    type Observation = Readonly<{ playerId: string; observationReference: typeof pins.fieldStepReference; observationSource: SamePaPhysicalFieldStepSource;
      observation: typeof original.fieldStep; actionResult: NonNullable<typeof original.fieldStep.actionResult>; receipt: Extract<NonNullable<typeof original.fieldStep.actionResult>, { kind: 'defender_observation_v1' }>['receipt'];
      precedingLifecycleViewReference: typeof input.finalViewReference; inputCalibrationReference: SamePaReference<'pa_lifecycle_v1_execution_calibrations'>;
      finalViewReference: typeof input.finalViewReference; scopedCalibrationReference: SamePaReference<'pa_lifecycle_v1_execution_calibrations'> }>;
    const observations: Observation[] = [];
    const efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    const expectedHeads = (ref: typeof pins.fieldStepReference, ordinal: number) => ({ ...original.allHeads,
      pa_physical_v1_heads: original.allHeads.pa_physical_v1_heads.map(h => ({ ...h, operation_ordinal: ordinal, last_owner: ref.owner, last_source_id: ref.sourceId, last_snapshot_hash: ref.snapshotHash })) });
    let currentScopedCalibration = original.calibrations[0];
    const checkpoints = [];
    for (let index = 0; index < views.length; index++) {
      const initialView = views[index], member = must(current.members.find(m => m.playerId === initialView.playerId));
      const inputCalibration = snapshot(() => {
        const candidates = index === 0 ? original.calibrations : [currentScopedCalibration];
        const c = must(candidates.find(c => c.source.member.playerId === initialView.playerId && c.source.route === 'defender_observation'));
        const normal = readCurrentSamePaLifecycleCalibrationFromSqlite(db, reference('pa_lifecycle_v1_execution_calibrations', c)); same(normal, c); return normal;
      });
      const inputCalibrationReference = reference('pa_lifecycle_v1_execution_calibrations', inputCalibration), precedingLifecycleViewReference = currentReference;
      const observationSource: SamePaPhysicalFieldStepSource = { sourceId: 'native-initial-defender-views-v214:observation:' + initialView.playerId,
        sourceVersion: declaration.futureFieldStepSourceVersion, capability: 'same_pa_physical_field_step_v1', viewReference: currentReference,
        launchReference: pins.launchReference, previousOperationReference: previousReference, fieldRootReference: pins.fieldRootReference,
        previousFieldReference: previousReference, throughTick: previous.evaluationTick,
        action: { kind: 'defender_observation_v1', member, calibrationReference: inputCalibrationReference, previousObservationReference: null, view: initialView.view } };
      const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => id === observationSource.sourceId ? observationSource : null }));
      const observation = physical.acceptOperation(observationSource.sourceId); release(physical);
      if (observation.kind !== 'same_pa_physical_field_step_v1' || observation.operationOrdinal !== 8 + index || observation.actionResult?.kind !== 'defender_observation_v1') throw Error('V214 normal initial observation pending');
      const observationReference = reference('pa_physical_v1_field_steps', observation), actionResult = observation.actionResult;
      same(actionResult.playerId, initialView.playerId); same(actionResult.samplingRequest.view, initialView.view); assert.equal(actionResult.samplingRequest.previousObservationSourceId, null);
      same(observation.field, original.fieldStep.field); same(observation.timeline, original.fieldStep.timeline); assert.equal(observation.evaluationTick, original.fieldStep.evaluationTick);
      eventReferences = [...eventReferences, observationReference]; resumePins['defenderObservationReference' + (index + 1)] = observationReference;
      snapshot(() => { same(readSamePaPhysicalOperationFromSqlite(db, observationReference).record, observation); same(heads(), expectedHeads(observationReference, 8 + index));
        same(must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)), original.world); });
      emit('normal-defender-observation-' + (index + 1) + '-accepted-before-lifecycle', { observationReference, observationSource, observation,
        precedingLifecycleViewReference, inputCalibrationReference, eventReferences, resumePins: { ...resumePins }, normalLifecycleAdvances: index,
        anchorViewReference: original.prefix.source.anchorViewReference, modelDeclaration, views });
      const cut = 14 + index, cutLabel = 'physical-fixture:cut' + cut, accepted = new Map<string, unknown>();
      const lifecycle = track(openSqliteSamePlateAppearanceLifecycleStore(path, { readAcceptedPrefix: id => accepted.get(id), readAcceptedTotal: id => accepted.get(id),
        readAcceptedView: id => accepted.get(id), readAcceptedCalibration: id => accepted.get(id) }));
      const prefixSource: SamePaLifecyclePrefix['source'] = { sourceId: cutLabel + ':prefix', sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_prefix_v1',
        enrollmentReference: original.acceptedAction.source.enrollmentReference, anchorViewReference: original.prefix.source.anchorViewReference, eventReferences };
      accepted.set(prefixSource.sourceId, prefixSource); const prefix = lifecycle.acceptPrefix(prefixSource.sourceId); if (prefix.kind === 'pending') throw Error('V214 normal prefix pending');
      const prefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix);
      const totalSources: SamePaLifecycleTotal['source'][] = prefix.lineage.participantReferences.map(p => ({ sourceId: cutLabel + ':total:' + p.playerId, sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_cumulative_total_v1',
        enrollmentReference: prefix.lineage.enrollmentReference, prefixReference, participantReference: p, effortUnits: efforts[p.playerId],
        provenance: { assessmentSourceId: cutLabel + ':assessment:' + p.playerId, assessmentVersion: 'fixture-only-v1', calibrationSourceId: cutLabel + ':explicit-total', calibrationVersion: 'fixture-only-v1' } }));
      totalSources.forEach(s => accepted.set(s.sourceId, s)); const totalSet = lifecycle.acceptTotalSet(totalSources.map(s => s.sourceId)); if (totalSet.kind !== 'same_pa_lifecycle_total_set') throw Error('V214 normal ten TOTALs pending');
      const viewSource: SamePaLifecycleView['source'] = { sourceId: cutLabel + ':view', sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_cumulative_view_v1',
        enrollmentReference: prefix.lineage.enrollmentReference, prefixReference, participantTotalReferences: totalSet.participantTotalReferences };
      accepted.set(viewSource.sourceId, viewSource); const view = lifecycle.acceptView(viewSource.sourceId); if (view.kind === 'pending') throw Error('V214 normal view pending');
      const viewReference = reference('pa_lifecycle_v1_execution_views', view), basis = snapshot(() => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
      const nextPlayerId = views[(index + 1) % views.length].playerId;
      const declarations = sourcesFor(viewReference, basis, cut, observationReference);
      const scopedSource = must(declarations.find(s => s.route === 'defender_observation' && s.member.playerId === nextPlayerId));
      accepted.set(scopedSource.sourceId, scopedSource); const scopedCalibration = lifecycle.acceptDefenderExecutionCalibrationV1(scopedSource.sourceId);
      if (scopedCalibration.kind !== 'same_pa_lifecycle_calibration') throw Error('V214 normal scoped defender calibration pending');
      release(lifecycle);
      const scopedCalibrationReference = reference('pa_lifecycle_v1_execution_calibrations', scopedCalibration);
      const observationItem: Observation = { playerId: initialView.playerId, observationReference, observationSource, observation, actionResult, receipt: actionResult.receipt,
        precedingLifecycleViewReference, inputCalibrationReference, finalViewReference: viewReference, scopedCalibrationReference };
      observations.push(observationItem);
      const checkpoint = snapshot(() => {
        const finalCurrent = readCurrentSamePaLifecycleViewFromSqlite(db, viewReference); same(finalCurrent, basis);
        const finalHistorical = readHistoricalSamePaLifecycleViewFromSqlite(db, viewReference); same(finalHistorical, finalCurrent);
        same(finalCurrent.view.cut.physicalOperationReference, observationReference); same(finalCurrent.view.cut.operationReference, observationReference); assert.equal(finalCurrent.view.cut.stage, 'field_active');
        same(readSamePaLifecycleRecordFromSqlite(db, 'prefix', prefix.source.sourceId), prefix); same(prefix.source.eventReferences, eventReferences);
        const totals = readSamePaLifecycleSetFromSqlite(db, 'total', totalSet.totals.map(t => t.source.sourceId)); same(totals, totalSet.totals); assert.equal(totals.length, 10);
        const persistedIds = db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(viewReference.sourceId).map(r => String(r.source_id));
        same(persistedIds, [scopedSource.sourceId]);
        const normal = readCurrentSamePaLifecycleCalibrationFromSqlite(db, scopedCalibrationReference); same(normal, scopedCalibration); same(normal.source, scopedSource);
        assert.equal(normal.source.route, 'defender_observation'); assert.equal(normal.source.member.playerId, nextPlayerId);
        same(normal.source.member, must(finalCurrent.members.find(m => m.playerId === nextPlayerId))); same(normal.source.viewReference, viewReference);
        const projectionProof = deriveSamePaObservationClockProjectionV1(db, normal.source, finalCurrent); same(projectionProof.evidence, normal.observationClockProjection);
        same(projectionProof.evidence.fieldReference, observationReference); assert.equal(projectionProof.evidence.targetTicksPerSecond, 1_000_000);
        const currentPhysicalOperation = readSamePaPhysicalOperationFromSqlite(db, observationReference); same(currentPhysicalOperation.record, observation); same(currentPhysicalOperation.actor, original.actor);
        const allHeads = heads(); same(allHeads, expectedHeads(observationReference, 8 + index));
        const world = must(readEmotionWorldRevisionFromSqlite(db, original.actor.binding.careerId)); same(world, original.world);
        same(readSamePaLifecycleSetFromSqlite(db, 'calibration', original.calibrations.map(c => c.source.sourceId)), original.calibrations);
        same(readSamePaLifecycleSetFromSqlite(db, 'calibration', original.unprojectedCalibrations.map(c => c.source.sourceId)), original.unprojectedCalibrations);
        return { boundary: 'NATIVE_INITIAL_DEFENDER_VIEWS_INTERMEDIATE_CHECKPOINT' as const, retainedInputReferences: preparation, resumePins: { ...resumePins },
          finalViewReference: viewReference, finalCurrent, finalHistorical, finalPrefixReference: prefixReference, prefix, totals,
          calibrations: [normal], calibrationReferences: [scopedCalibrationReference], scopedCalibration: normal, scopedCalibrationReference, projectionProof,
          eventReferences, observations: [...observations], currentPhysicalOperation, physicalHeads: allHeads.pa_physical_v1_heads, allHeads, world,
          modelDeclaration, views, nextPlayerId, normalLifecycleAdvances: index + 1, finalLifecycleCurrentProven: true,
          initialDefenderObservationCount: index + 1, scopedDefenderCalibrationCount: index + 1, otherRoutesFullReady: false, allRoutesReady: false };
      });
      emit('normal-cut' + cut + '-current-scoped-calibration-physical-world-checkpoint', checkpoint);
      checkpoints.push(checkpoint); currentScopedCalibration = checkpoint.scopedCalibration;
      current = checkpoint.finalCurrent; currentReference = viewReference; previousReference = observationReference; previous = observation;
    }
    const checkpoint = must(checkpoints.at(-1));
    const result = { ...checkpoint, boundary: 'NATIVE_INITIAL_DEFENDER_VIEWS_CHECKPOINT_ONLY' as const, originalInputs: original, normalOriginal: original,
      worldBefore: original.world, worldAfter: checkpoint.world, modelDeclaration, views, initialDefenderObservationsAccepted: true,
      initialDefenderObservationCount: observations.length, scopedDefenderCalibrationCount: observations.length, firstObservationHistoryProven: true,
      rawGazeRestored: false, continuingGazeProven: false, empiricallyCalibrated: false, nativePostInitialDefenderObservationConsumerProven: false,
      nativeResumeAdapterRequired: true, resumeReady: false, defensiveAiAccepted: false, legalOutcomeProven: false, officialTerminalProven: false,
      fullContinuationComplete: false, performancePass: false, wholeRngConsumptionProven: false };
    assert.equal(result.finalViewReference.sourceId, 'physical-fixture:cut22:view'); assert.equal(Object.keys(result.resumePins).length, 25); assert.equal(result.eventReferences.length, 22);
    emit('normal-initial-defender-views-cut22-authenticated', result); return result;
  } catch (error) { failure = error; throw error; }
  finally {
    const errors: unknown[] = [];
    for (const owner of [...owners].reverse()) try { owner.close(); } catch (error) { errors.push(error); }
    try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failure === undefined ? errors : [failure, ...errors], 'V214 owner cleanup failed');
  }
}

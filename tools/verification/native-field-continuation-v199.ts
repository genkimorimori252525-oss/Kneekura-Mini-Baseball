import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { actorJson as json } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleNextPitchBasisFromSqlite,
  readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalActionFromSqlite, readSamePaPhysicalFieldCalibrationFromSqlite, readSamePaPhysicalOperationFromSqlite, readCurrentSamePaInFlightCutFromSqlite,
  openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { readSamePaBattingIntentFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { battedBodyModelMaterializationEvidenceFromSqlite } from '../../src/host/world/BattedBodyModelMaterializationEvidence';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from '../../src/host/world/PlayerBodyCapabilityMaterializationEvidence';
import { readSamePaPreparedActionFromSqlite, openSqliteSamePlateAppearanceDispatchStore } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { prepareSamePaLifecycleFixture } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { readBattingEmotionGenesisFromSqlite } from '../../src/host/world/SqliteBattingEmotionStore';
import { openSqliteSpinControlMasteryV123, readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { openSqliteWorldControlStore } from '../../src/host/world/SqliteWorldControlStore';
import { resumeInFlightBattingSwing, type NativeSpinNeutralPostObservationContextV193 } from '../../src/host/world/InFlightBattingLifecycleFixture.test-support';
import { createNativeFieldPreparationV198Declaration, type prepareNativeFieldV198 } from './native-field-preparation-v198';
import { SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION } from '../../src/host/world/SamePlateAppearanceBallPhysics';
import { calculateBattingExecution } from '../../src/core/world/psychology/batting/BattingCommitment';
import type { SamePaPhysicalFieldRootSource } from '../../src/host/world/SamePlateAppearancePhysicalEpisode';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

type Preparation = ReturnType<typeof prepareNativeFieldV198>;
export type NativeFieldContinuationV199Input = Readonly<Pick<Preparation,
  'retainedInputReferences' | 'calibrationReference' | 'bodyModelReference' | 'futureProfileDeclarationOnly'> & {
    batterBodyReference: SamePaReference<'world_player_body_materializations'>;
  }>;
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V199 original owner input differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('V199 original owner input missing'); return value; };
const label = 'native-spin-neutral-v193:pitch3';

/** A new owned branch from the normal V198 prelaunch state. All original
 * practices, TAKEs, body receipts and prospective profiles stay immutable.
 * This ends at an admitted field root; no field step or official is authored. */
function runNativeFieldV199(path: string, input: NativeFieldContinuationV199Input, emit: (name: string, value?: unknown) => void,
  stopAt: 'FIRST_CAPTURE' | 'FIELD_ROOT') {
  assert.deepStrictEqual(input.futureProfileDeclarationOnly, createNativeFieldPreparationV198Declaration());
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path), owners = new Set<{ close(): void }>();
  const track = <T extends { close(): void }>(owner: T): T => { owners.add(owner); return owner; };
  const release = (owner: { close(): void }) => { owner.close(); owners.delete(owner); };
  const locate = <O extends string>(owner: O, sourceId: string): SamePaReference<O> => {
    // Candidate locator only. A normal owner below authenticates every value.
    const row = must(db.prepare(`SELECT source_hash,snapshot_hash FROM main.${owner} WHERE source_id=?`).get(sourceId));
    return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
  };
  try {
    const refs = input.retainedInputReferences;
    const original = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const action = readSamePaPhysicalActionFromSqlite(db, refs.actionReference);
      same(reference('physical_plate_appearance_actors', action.actor), refs.actorReference);
      same(action.source.viewReference, refs.viewReference); same(action.source.batterModelReference, refs.modelReference);
      assert.equal(action.physicalPitchSourceId, label + ':launch'); assert.equal(action.pitchOrdinal, 3);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, refs.viewReference);
      const next = readSamePaLifecycleNextPitchBasisFromSqlite(db, refs.viewReference, 'current');
      if (next.kind !== 'ready') throw Error('V199 prospective next-pitch basis unavailable: ' + next.reason);
      same(current.actor, action.actor); same(next.actor, action.actor); assert.equal(next.nextPitchOrdinal, 3);
      same(next.physicalWorld, action.physicalWorld); same(next.timeline, action.timeline);
      const posture = readBattingPerceptionFromSqlite(db, 'posture', refs.postureReference);
      if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V199 original in-flight posture missing');
      const intent = readSamePaBattingIntentFromSqlite(db, refs.intentReference);
      same(posture.lineage, action.lineage); same(intent.lineage, action.lineage);
      same(posture.source.actionReference, refs.actionReference); same(posture.source.viewReference, refs.viewReference);
      same(intent.source.postureReference, refs.postureReference); same(intent.source.viewReference, refs.viewReference);
      same(reference('world_player_batting_models', posture.model), refs.modelReference);
      const calibration = readSamePaPhysicalFieldCalibrationFromSqlite(db, input.calibrationReference);
      same(calibration.source.actionReference, refs.actionReference); same(calibration.source.postureReference, refs.postureReference);
      same(calibration.source.viewReference, refs.viewReference); same(calibration.source.bodyModelReference, input.bodyModelReference);
      const model = must(battedBodyModelMaterializationEvidenceFromSqlite(db).read(input.bodyModelReference.sourceId));
      same(model, calibration.calibration.model);
      const batterBody = must(playerBodyCapabilityMaterializationEvidenceFromSqlite(db).read(input.batterBodyReference.sourceId));
      same(reference('world_player_body_materializations', batterBody), input.batterBodyReference);
      assert.deepStrictEqual(batterBody.source, refs.matchDayBatterPreparation.request);
      assert.deepStrictEqual(batterBody.actor, posture.model.bodyMaterialization.actor);
      assert.equal(batterBody.source.atDay, action.actor.binding.gameDay); assert.equal(model.actors.length, 10);
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', current.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('V199 original prefix missing');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), current.view.source.prefixReference);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', current.view.source.participantTotalReferences.map(t => t.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('V199 original TOTAL missing'); return value; });
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), current.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(refs.viewReference.sourceId).map(row => String(row.source_id)))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('V199 original lifecycle calibration missing'); return value; });
      assert.equal(totals.length, 10); assert.equal(calibrations.length, 32);
      for (const calibration of calibrations) same(calibration.source.viewReference, refs.viewReference);
      const observation = must(calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === action.actor.binding.playerId));
      if (observation.source.response.kind !== 'accepted_execution_values_v1') throw Error('V199 original explicit observation missing');
      const observationValues = observation.source.response.values as AcceptedBattingObservationCalibration['values'];
      for (const key of ['minimumPositionErrorMeters', 'maximumPositionErrorMeters', 'minimumVelocityErrorMps', 'maximumVelocityErrorMps'] as const) assert.equal(observationValues.calibration.errorParameters[key], 0);
      const acceptedAction = readSamePaPreparedActionFromSqlite(db, locate('pa_dispatch_v1_action_plans', 'native-action'));
      same(acceptedAction.lineage, action.lineage);
      const originalCalibrationIds = db.prepare('SELECT source_id FROM main.pa_dispatch_v1_execution_calibrations WHERE enrollment_source_id=? ORDER BY rowid')
        .all(action.lineage.enrollmentReference.sourceId).map(row => String(row.source_id));
      const genesis = must(readBattingEmotionGenesisFromSqlite(db, 'physical-fixture:emotion-genesis'));
      const qualifications = refs.qualificationReferences.map(ref => {
        const value = must(readNativeSpinControlMasteryV123(db, ref.sourceId)); same(reference('world_spin_mastery_v123', value), ref); return value;
      });
      assert.deepStrictEqual(qualifications.map(q => q.source.technique), ['BACKSPIN', 'TOPSPIN']);
      assert.equal(new Set(qualifications.map(q => q.source.sourceEffectIdentity)).size, 2);
      const heads = db.prepare('SELECT last_source_id FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(action.lineage.enrollmentReference.sourceId);
      assert.equal(heads.length, 0, 'V199 requires the unlaunched V198 frontier');
      return { action, actor: action.actor, posture, intent, current, next, calibration, model, batterBody,
        prefix, totals, calibrations, acceptedAction, originalCalibrationIds, observationValues, genesis, qualifications };
    }));
    emit('original-v198-prospective-basis-authenticated', { input, ...original });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path));
    const acceptedCalibrations = dispatch.readCalibrationSet(original.originalCalibrationIds); release(dispatch);
    assert.equal(acceptedCalibrations.calibrations.length, 32);
    const mastery = track(openSqliteSpinControlMasteryV123(path));
    const inventory = mastery.selectAtDay(original.actor.binding.careerId, original.actor.binding.playerId, original.actor.binding.gameDay); release(mastery);
    assert.equal(inventory.effectiveStateId, 'GOLD'); assert.equal(inventory.motorQualifications.length, 2); assert.equal(inventory.rejected.length, 0);
    assert.deepStrictEqual(inventory.motorQualifications.map(q => q.qualificationRef), original.qualifications.map(q => ({ sourceId: q.source.sourceId, sourceVersion: q.source.sourceVersion })));
    emit('original-dispatch32-and-gold2-authenticated', { acceptedCalibrations, inventory });
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(source: T): T => { accepted.set(source.sourceId, source); emit('inert-source-declaration-before-acceptance', source); return source; };
    const f = { db, path, actor: original.actor, acceptedAction: original.acceptedAction, acceptedCalibrations, x: { f: { track } } };
    const events = [...original.prefix.source.eventReferences], efforts = Object.fromEntries(original.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    let basis: ReturnType<NativeSpinNeutralPostObservationContextV193['current']> = {
      view: original.current.view, viewReference: refs.viewReference, basis: original.current, calibrationSet: { calibrations: original.calibrations } };
    const advance: NativeSpinNeutralPostObservationContextV193['advance'] = event => {
      events.push(event); const cutLabel = 'physical-fixture:cut' + events.length;
      emit('advance-' + events.length + '-start', { eventReference: event, anchorViewReference: original.prefix.source.anchorViewReference, eventReferences: [...events], efforts });
      const next = prepareSamePaLifecycleFixture(f, original.prefix.source.anchorViewReference, [...events], cutLabel, efforts, original.observationValues,
        undefined, undefined, undefined, stage => emit('advance-' + events.length + '-' + stage));
      basis = { view: next.view, viewReference: next.viewReference, basis: next.basis, calibrationSet: { calibrations: next.calibrationSet.calibrations } };
      emit('advance-' + events.length + '-accepted', { eventReference: event, prefix: next.prefix, totalSet: next.totalSet,
        viewReference: next.viewReference, view: next.view, calibrationSet: next.calibrationSet });
      release(next.owner); return next;
    };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => accepted.get(id) }));
    const right = must(physical.readRight(original.action.source.sourceId + ':right'));
    assert(right.kind === 'same_pa_physical_right_prepared_v1');
    const rightReference = reference('pa_physical_v1_rights', right);
    same(right.source.actionReference, refs.actionReference); same(right.source.postureReference, refs.postureReference); same(right.source.viewReference, refs.viewReference);
    assert(refs.preparedRight.candidates.some(ref => json(ref) === json(rightReference)), 'V199 normal right differs from retained locator');
    emit('normal-stored-prepared-right-authenticated', { rightReference, right });
    const launchSource = save({ sourceId: original.action.physicalPitchSourceId, sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_launch_v1',
      viewReference: refs.viewReference, actionReference: refs.actionReference, rightReference });
    const launch = physical.acceptOperation(launchSource.sourceId);
    if (launch.kind !== 'same_pa_physical_launch_v1') throw Error('V199 normal launch pending');
    const launchReference = reference('pa_physical_v1_launches', launch);
    emit('normal-launch-accepted', { launch, launchReference }); advance(launchReference);
    const captureSource = save({ sourceId: label + ':capture-cut', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_cut_v1',
      viewReference: basis.viewReference, launchReference, previousOperationReference: launchReference, throughTick: launch.evaluationTick + 50_000 });
    const captureCut = physical.acceptOperation(captureSource.sourceId);
    if (captureCut.kind !== 'same_pa_physical_cut_v1') throw Error('V199 normal first capture cut pending');
    const captureCutReference = reference('pa_physical_v1_cuts', captureCut);
    emit('normal-first-capture-cut-accepted-before-admission', { captureCut, captureCutReference, lifecycleViewReference: basis.viewReference });
    if (stopAt === 'FIRST_CAPTURE') {
      const checkpoint = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
        const currentCapture = readCurrentSamePaInFlightCutFromSqlite(db, captureCutReference);
        assert(currentCapture.record.kind === 'same_pa_physical_cut_v1');
        same(currentCapture.record, captureCut); same(currentCapture.actor, original.actor);
        assert.equal(currentCapture.stage, 'in_flight'); assert.equal(currentCapture.record.operationOrdinal, 1);
        const precedingLifecycle = readHistoricalSamePaLifecycleViewFromSqlite(db, captureCut.source.viewReference);
        same(precedingLifecycle.view, basis.view); same(precedingLifecycle.members, basis.basis.members);
        same(precedingLifecycle.view.cut.physicalOperationReference, launchReference);
        same(readSamePaPhysicalOperationFromSqlite(db, launchReference).record, launch);
        same(readSamePaPhysicalFieldCalibrationFromSqlite(db, input.calibrationReference), original.calibration);
        same(readSamePaPhysicalActionFromSqlite(db, refs.actionReference), original.action);
        same(readBattingPerceptionFromSqlite(db, 'posture', refs.postureReference), original.posture);
        return { currentCapture, precedingLifecycle };
      }));
      const resumePins = { postureReference: refs.postureReference, intentReference: refs.intentReference, launchReference, captureCutReference };
      emit('normal-first-capture-checkpoint-authenticated', { resumePins, viewReference: basis.viewReference, ...checkpoint });
      return { boundary: 'NATIVE_FIXTURE_FIRST_CAPTURE_CHECKPOINT_ONLY' as const, originalInputs: original, retainedInputReferences: input,
        inventory, right, rightReference, launch, launchReference, captureCut, captureCutReference, resumePins,
        precedingLifecycleViewReference: basis.viewReference, eventReferences: events, checkpoint,
        launchAdvanceCompleted: true, currentCaptureProven: true, precedingLifecycleAuthenticated: true,
        captureAwaitingLifecycleAdmission: true, resumeReady: true, fullContinuationComplete: false,
        fieldRootAccepted: false, resolutionAccepted: false, newPracticeAccepted: 0, twoTakeReplayed: false,
        originalBodyReceiptsUnchanged: true, prospectiveProfileAdjustedAfterOutcome: false,
        secondNativeControlBranchProven: false, officialTerminalProven: false, wholeRngConsumptionProven: false,
        productionMasteryCalibrationProven: false, naturalGoldRarityProven: false, normalAiProven: false, performancePass: false };
    }
    const worldOwner = track(openSqliteWorldControlStore(path));
    const originalActionSource = original.acceptedAction.source;
    if (originalActionSource.variant !== 'declared_take_v1') throw Error('V199 original first TAKE Source missing');
    const h: NativeSpinNeutralPostObservationContextV193 = { f, accepted, save, events, current: () => basis, advance, physical,
      original: originalActionSource, genesis: original.genesis, worldOwner };
    const swing = resumeInFlightBattingSwing(h, label, { postureReference: refs.postureReference, intentReference: refs.intentReference,
      launchReference, captureCutReference }, { onStage: name => emit(name, { lifecycleViewReference: basis.viewReference, eventReferences: [...events] }),
      prepareCommitment(source, executionInput) {
        const { buntProfileBinding: _bunt, ...ordinary } = source;
        const declared = { ...ordinary, capability: 'same_pa_physical_commitment_v123' as const, spinBindingV123: {
          kind: 'fixed_native_spin_binding_v123' as const, modelReference: refs.modelReference,
          intent: { technique: 'NO_SPIN_TARGET' as const, selectedAtTick: executionInput.nominalRequest.currentFrame.time.tick }, qualificationReferences: refs.qualificationReferences } };
        emit('before-native-v123-no-target-commitment', { sourceDeclaration: declared, input: executionInput,
          inputReference: reference('batting_execution_v1_inputs', executionInput), actorReference: refs.actorReference, qualificationReferences: refs.qualificationReferences });
        return declared;
      } });
    const actual = swing.commitment.calculation;
    if (actual.algorithm !== 'batting-spin-execution-calculation-v123') throw Error('V199 Native spin calculation missing');
    assert.deepStrictEqual(actual.spinContext.techniques.map(t => t.technique), ['BACKSPIN', 'TOPSPIN']);
    assert.deepStrictEqual(actual.spinContext.techniques.map(t => t.qualificationRef), inventory.motorQualifications.map(q => q.qualificationRef));
    assert(actual.spinContext.techniques.every(t => t.motorProfileRefs.length > 0));
    const spinPlan = must(actual.spinMotorPlanV123);
    assert.deepStrictEqual([spinPlan.declaredIntent, spinPlan.selectedIntent, spinPlan.selectedQualificationRef, spinPlan.fallbackReason], ['NO_SPIN_TARGET', 'NO_SPIN_TARGET', null, null]);
    const ordinary = calculateBattingExecution({ nominalRequest: swing.input.nominalRequest, effectiveValues: swing.input.effectiveValues });
    if (!ordinary.ok) throw Error('V199 pure v1 calculation rejected');
    for (const key of ['nominalRequest', 'effectiveValues', 'commitment', 'status', 'scheduledTick'] as const) assert.deepStrictEqual(actual[key], ordinary.value[key]);
    assert(swing.resolution.contact); assert.equal(swing.resolution.timeline.events.filter(e => e.kind === 'BatBallContact').length, 1);
    emit('normal-two-qualification-no-target-resolution-accepted', { ...swing, ordinary: ordinary.value });
    const profile = input.futureProfileDeclarationOnly;
    assert.equal(profile.futureFieldRootSourceVersion, SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION);
    const rootSource: SamePaPhysicalFieldRootSource = save({ sourceId: 'native-spin-neutral-field-v199:field-root', sourceVersion: profile.futureFieldRootSourceVersion,
      capability: 'same_pa_physical_field_root_v1', viewReference: basis.viewReference, launchReference, previousOperationReference: swing.resolutionReference,
      resolutionReference: swing.resolutionReference, postureReference: refs.postureReference,
      fieldInputs: { kind: 'fresh_physical_field_calibration_v1', calibrationReference: input.calibrationReference },
      parameters: original.calibration.source.parameters, throughTick: swing.resolution.contact.tick, ballPhysics: profile.futureBallPhysics,
      commands: original.model.actors.map(actor => ({ playerId: actor.playerId, bodyAcceleration: { x: 0, y: 0, z: 0 },
        primitiveMotions: actor.primitives.map(p => ({ role: p.role, offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } })) })) });
    const root = physical.acceptOperation(rootSource.sourceId);
    if (root.kind !== 'same_pa_physical_field_root_v1') throw Error('V199 normal fresh field root pending');
    const rootReference = reference('pa_physical_v1_field_roots', root);
    emit('normal-v3-field-root-accepted', { rootReference, root, resolutionReference: swing.resolutionReference, source: rootSource });
    advance(rootReference);
    const current = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const rootProof = readSamePaPhysicalOperationFromSqlite(db, rootReference); same(rootProof.record, root);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, basis.viewReference);
      same(current.view, basis.view); same(current.actor, original.actor); same(current.view.cut.physicalOperationReference, rootReference);
      same(readSamePaPhysicalFieldCalibrationFromSqlite(db, input.calibrationReference), original.calibration);
      same(readSamePaPhysicalActionFromSqlite(db, refs.actionReference), original.action);
      same(readBattingPerceptionFromSqlite(db, 'posture', refs.postureReference), original.posture);
      return current;
    }));
    emit('normal-field-root-current-coverage-authenticated', { rootReference, viewReference: basis.viewReference, current });
    return { boundary: 'NATIVE_FIXTURE_V3_FIELD_ROOT_CONTINUATION_ONLY' as const, originalInputs: original, retainedInputReferences: input,
      inventory, right, rightReference, swing, ordinary: ordinary.value, rootSource, root, rootReference,
      finalViewReference: basis.viewReference, finalCurrent: current, eventReferences: events,
      consumerAdoptionProven: true, consumerTechniqueCount: 2, selectedIntent: 'NO_SPIN_TARGET', ordinaryExecutionEqual: true,
      actualContactCount: 1, fieldRootAccepted: true, currentFieldCoverageProven: true, fieldStepsAccepted: 0,
      newPracticeAccepted: 0, twoTakeReplayed: false, originalBodyReceiptsUnchanged: true, prospectiveProfileAdjustedAfterOutcome: false,
      fixtureAuthority: 'SYNTHETIC_NATIVE_PRACTICE_AND_CALIBRATION', secondNativeControlBranchProven: false,
      officialTerminalProven: false, wholeRngConsumptionProven: false, productionMasteryCalibrationProven: false,
      naturalGoldRarityProven: false, normalAiProven: false, performancePass: false };
  } finally { for (const owner of [...owners].reverse()) owner.close(); db.close(); }
}

export function continueNativeFieldV199(path: string, input: NativeFieldContinuationV199Input, emit: (name: string, value?: unknown) => void) {
  const result = runNativeFieldV199(path, input, emit, 'FIELD_ROOT');
  assert(result.boundary === 'NATIVE_FIXTURE_V3_FIELD_ROOT_CONTINUATION_ONLY');
  return result;
}

/** A completed real first-capture boundary. The capture remains unadmitted,
 * exactly as required by the existing resumeInFlightBattingSwing entry. */
export function prepareNativeFieldCaptureV199(path: string, input: NativeFieldContinuationV199Input, emit: (name: string, value?: unknown) => void) {
  const result = runNativeFieldV199(path, input, emit, 'FIRST_CAPTURE');
  assert(result.boundary === 'NATIVE_FIXTURE_FIRST_CAPTURE_CHECKPOINT_ONLY');
  return result;
}

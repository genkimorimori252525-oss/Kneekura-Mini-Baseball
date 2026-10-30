import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../src/core/sim/ball/BaseballAerodynamics';
import type { AeroGroundBallPhysicsV1 } from '../../src/core/sim/ball/VersionedBattedBallPhysics';
import { actorHash as hash, actorJson as json } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readCurrentSamePaLifecycleViewFromSqlite, readSamePaLifecycleNextPitchBasisFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalActionFromSqlite, readSamePaPhysicalFieldCalibrationFromSqlite, openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readBattingPerceptionFromSqlite } from '../../src/host/world/SqliteBattingPerceptionStore';
import { readSamePaBattingIntentFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { prepareFreshPhysicalFieldCalibrationFixture } from '../../src/host/world/SamePlateAppearancePhysicalFieldFixture.test-support';
import { battedBodyModelMaterializationEvidenceFromSqlite } from '../../src/host/world/BattedBodyModelMaterializationEvidence';
import { openSqlitePlayerBodyCapabilityMaterializationStore } from '../../src/host/world/SqlitePlayerBodyCapabilityMaterializationStore';
import type { BodyMaterializationReceipt, BodyMaterializationRequest } from '../../src/host/world/PlayerBodyCapabilityMaterialization';
import { samePaFieldBallPhysics, SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION, SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION } from '../../src/host/world/SamePlateAppearanceBallPhysics';
import type { readNativeSpinNeutralPrelaunchV197 } from './native-spin-neutral-prelaunch-v197';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

const fieldLabel = 'native-spin-neutral-field-v198';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'V198 original prospective input differs');
export type NativeFieldBatterPreparationV198Declaration = Readonly<Pick<BodyMaterializationReceipt, 'body' | 'pose' | 'reachCalibration'> & {
  request: BodyMaterializationRequest;
}>;
export type NativeFieldPreparationV198Input = Readonly<Pick<ReturnType<typeof readNativeSpinNeutralPrelaunchV197>,
  'actorReference' | 'actionReference' | 'postureReference' | 'intentReference' | 'viewReference' |
  'modelReference' | 'qualificationReferences' | 'preparedRight'> & {
    matchDayBatterPreparation: NativeFieldBatterPreparationV198Declaration;
  }>;

/** A new prospective receipt, not a retag of the original model's historical
 * body. Only its Source identity and materialization day differ. Both original
 * and new receipts are authenticated by the normal owner on this owned copy. */
export function prepareNativeFieldBatterV198(path: string, original: BodyMaterializationReceipt, gameDay: number,
  declaration: NativeFieldBatterPreparationV198Declaration, emit: (name: string, value?: unknown) => void) {
  const request: BodyMaterializationRequest = { ...original.source,
    sourceId: fieldLabel + ':batter-body-at-game-day', atDay: gameDay };
  assert.equal(original.source.role, 'batter');
  assert.deepStrictEqual(declaration, { request, body: original.body, pose: original.pose, reachCalibration: original.reachCalibration },
    'V198 prospective batter body declaration differs from original accepted inputs');
  const owner = openSqlitePlayerBodyCapabilityMaterializationStore(path, {
    readAcceptedMaterialization: id => id === request.sourceId ? request : null,
    readAcceptedBody: id => id === original.body.sourceId ? original.body : null,
    readAcceptedPose: id => id === original.pose.sourceId ? original.pose : null,
    readAcceptedReachCalibration: id => id === original.reachCalibration.sourceId ? original.reachCalibration : null,
  });
  try {
    assert.deepStrictEqual(owner.read(original.source.sourceId), original, 'V198 historical body receipt differs');
    emit('match-day-batter-source-declared-before-acceptance', declaration);
    const result = owner.accept(request.sourceId);
    if (result.kind !== 'materialized') throw Error('V198 original batter inputs are incomplete: ' + result.missing.join(','));
    assert.deepStrictEqual(result.value.source, request);
    assert.deepStrictEqual(result.value.actor, original.actor, 'V198 new receipt changed original actor physics');
    assert.deepStrictEqual(owner.read(original.source.sourceId), original);
    assert.deepStrictEqual(owner.read(request.sourceId), result.value);
    const accepted = { request, receipt: result.value, reference: reference('world_player_body_materializations', result.value) };
    emit('normal-match-day-batter-materialization-accepted', accepted);
    return accepted;
  } finally { owner.close(); }
}

/** Fixed prospectively from the existing explicit V191/ball-physics fixture.
 * The normal profile validator uses a zero-duration floor state only; no actual
 * contact, launch, flight, field or observed outcome supplies this declaration. */
export function createNativeFieldPreparationV198Declaration() {
  const parameters = { ticksPerSecond: 1_000_000, gravityY: -9.81, ballRadius: 0.0366, groundRestitution: 0.35, groundFriction: 0.78,
    groundRollingDecelerationMps2: 4, integrationStepTicks: 2_000, restingVerticalSpeed: 0.5 };
  const ballPhysics: AeroGroundBallPhysicsV1 = { kind: 'aero_ground_v1',
    air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
    ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366, inertiaRatio: 0.378, restingVerticalSpeedMps: 0.15,
      material: { restitution: 0.4, slidingFriction: 0.25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } };
  const validated = samePaFieldBallPhysics({ sourceVersion: SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION, parameters, ballPhysics });
  assert(validated);
  return { boundary: 'FIXTURE_ONLY_PROSPECTIVE_FIELD_SOURCE_DECLARATION', fieldLabel, calibrationParameters: parameters,
    futureFieldRootSourceVersion: SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION,
    futureFieldStepSourceVersion: SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION, futureBallPhysics: validated,
    calibrationAuthority: 'EXISTING_LEGACY_EIGHT_PARAMETER_CALIBRATION_UNCHANGED',
    futureGroundAuthority: 'EXPLICIT_AERO_GROUND_PROFILE_WHEN_ITS_RESERVED_ROOT_VERSION_IS_ADOPTED',
    prospectiveFixtureValues: { geometryRef: 'synthetic-field-contact-v1', availableAtDay: 1,
      bagHalfSize: { x: 0.01, z: 0.2 }, bagSurfaceHeightMeters: 0.1, batterGripOffset: { x: 0.5, y: 0.9, z: 0 },
      bodyMaterial: { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 }, gloveCenterRetentionCapacityJ: 1_000_000 },
    profileValidation: 'NORMAL_SOURCE_CONTRACT_ZERO_DURATION_FLOOR_VALIDATION_ONLY',
    futureFieldRootAccepted: false, flightOrCatchOutcomeProven: false, officialOutcomeProven: false,
    productionCalibrationProven: false, outcomeBasedProfileAdjustment: false };
}
type Declaration = ReturnType<typeof createNativeFieldPreparationV198Declaration>;

/** Accept match-day batter receipt, assembly and calibration on a new owned copy. The shared full
 * fixture's append closure is not created or called by this entry. */
export function prepareNativeFieldV198(path: string, input: NativeFieldPreparationV198Input, declaration: Declaration, emit: (name: string, value?: unknown) => void) {
  same(declaration, createNativeFieldPreparationV198Declaration());
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path), owners = new Set<{ close(): void }>();
  const track = <T extends { close(): void }>(value: T): T => { owners.add(value); return value; };
  try {
    const original = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const action = readSamePaPhysicalActionFromSqlite(db, input.actionReference);
      same(reference('physical_plate_appearance_actors', action.actor), input.actorReference); same(action.source.viewReference, input.viewReference);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, input.viewReference);
      const next = readSamePaLifecycleNextPitchBasisFromSqlite(db, input.viewReference, 'current');
      if (next.kind !== 'ready') throw Error('V198 prospective next-pitch basis unavailable: ' + next.reason);
      same(next.actor, action.actor); same(current.actor, action.actor); same(next.physicalWorld, action.physicalWorld); same(next.timeline, action.timeline);
      assert.equal(next.nextPitchOrdinal, action.pitchOrdinal); assert.equal(action.pitchOrdinal, 3);
      const posture = readBattingPerceptionFromSqlite(db, 'posture', input.postureReference);
      if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_in_flight_batting_posture_v1') throw Error('V198 original posture unavailable');
      same(posture.source.actionReference, input.actionReference); same(posture.source.viewReference, input.viewReference); same(posture.lineage, action.lineage);
      const intent = readSamePaBattingIntentFromSqlite(db, input.intentReference);
      same(intent.lineage, action.lineage); same(intent.source.postureReference, input.postureReference); same(intent.source.viewReference, input.viewReference);
      same(action.source.batterModelReference, input.modelReference); same(reference('world_player_batting_models', posture.model), input.modelReference);
      assert.equal(1 + posture.sceneBodies.length, 10);
      const heads = db.prepare('SELECT last_owner,last_source_id FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(action.lineage.enrollmentReference.sourceId);
      assert.equal(heads.length, 0, 'V198 requires the original unlaunched physical frontier');
      return { actor: action.actor, action, posture, intent, model: posture.model, current, next };
    }));
    emit('original-prospective-basis-authenticated', { input, ...original });
    const matchDayBatter = prepareNativeFieldBatterV198(path, original.posture.model.bodyMaterialization,
      original.actor.binding.gameDay, input.matchDayBatterPreparation, emit);
    const accepted = new Map<string, unknown>();
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedFieldCalibration: id => accepted.get(id) }));
    const result = prepareFreshPhysicalFieldCalibrationFixture({
      f: { db, path, actor: original.action.actor, x: { f: { track } } },
      current: () => ({ viewReference: input.viewReference }),
      physical: { acceptFieldCalibration: id => physical.acceptFieldCalibration(id) },
      save: source => { accepted.set(source.sourceId, source); emit('calibration-source-declared-before-acceptance', source); return source; },
    }, { action: original.action, actionReference: input.actionReference }, original.posture, input.postureReference, declaration.fieldLabel, {}, matchDayBatter.receipt);
    assert.deepEqual(result.source.parameters, declaration.calibrationParameters);
    same(result.source.actionReference, input.actionReference); same(result.source.postureReference, input.postureReference); same(result.source.viewReference, input.viewReference);
    assert.equal(result.source.availableAtDay, 1); assert.equal(result.source.geometryRef, 'synthetic-field-contact-v1');
    emit('normal-body-model-and-field-calibration-accepted', result);
    const after = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const calibration = readSamePaPhysicalFieldCalibrationFromSqlite(db, result.calibrationReference); same(calibration, result.calibration);
      const model = battedBodyModelMaterializationEvidenceFromSqlite(db).read(result.bodyModelReference.sourceId); same(model, result.model);
      const current = readCurrentSamePaLifecycleViewFromSqlite(db, input.viewReference);
      const next = readSamePaLifecycleNextPitchBasisFromSqlite(db, input.viewReference, 'current');
      if (next.kind !== 'ready') throw Error('V198 preparation changed the next-pitch basis');
      same(current, original.current); same(next, original.next);
      const heads = db.prepare('SELECT last_owner,last_source_id FROM main.pa_physical_v1_heads WHERE enrollment_source_id=?').all(original.action.lineage.enrollmentReference.sourceId);
      assert.equal(heads.length, 0, 'V198 preparation must not launch');
      const validatedFutureProfile = samePaFieldBallPhysics({ sourceVersion: declaration.futureFieldRootSourceVersion,
        parameters: calibration.source.parameters, ballPhysics: declaration.futureBallPhysics });
      same(validatedFutureProfile, declaration.futureBallPhysics);
      return { calibrationReference: result.calibrationReference, calibration, bodyModelReference: result.bodyModelReference, model, current, next };
    }));
    emit('accepted-preparation-and-unchanged-current-basis-authenticated', after);
    return { boundary: 'NATIVE_FIXTURE_FIELD_SOURCE_PREPARATION_ONLY', calibrationReference: result.calibrationReference, bodyModelReference: result.bodyModelReference,
      originalInputs: original, retainedInputReferences: input, acceptedPreparation: after, matchDayBatterPreparation: matchDayBatter,
      retainedQualificationReferencesAuthority: 'V197_NORMAL_READ_PROOF_RETAINED_NOT_REEXECUTED_HERE',
      preparedRightAuthority: 'UNAUTHENTICATED_LOCATOR_ONLY_NORMAL_READ_RIGHT_REQUIRED_BEFORE_FUTURE_LAUNCH',
      originalPhysicalPitchSourceId: original.action.physicalPitchSourceId,
      bodyModelHash: hash(result.model), sourceHash: hash(result.source), viewReference: input.viewReference,
      currentLifecycleProven: true, nextPitchBasisProven: true, unlaunched: true, bodyCount: result.model.actors.length,
      fixtureOnly: true, productionCalibrationProven: false, acceptedBatterBodyMaterializations: 1, originalActorValuesExact: true,
      acceptedModelAssemblies: 1, acceptedFieldCalibrations: 1,
      newPhysicalOperationsAccepted: 0, newPracticeAccepted: 0, launchAccepted: false, fieldRootAccepted: false,
      flightOrCatchOutcomeProven: false, officialOutcomeProven: false, futureProfileDeclarationOnly: declaration,
      originalFailedRunsPreserved: true, originalExecutionSourceEndPin: 'UNKNOWN', performancePass: false };
  } finally { for (const owner of [...owners].reverse()) owner.close(); db.close(); }
}

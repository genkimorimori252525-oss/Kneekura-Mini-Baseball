import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import type { Vec3 } from '../../core/model/geometry';
import { initialQualifiedHeadsV135, readInitialQualifiedDecisionV135 } from './InitialQualifiedPitchV135.test-support';
import { assertCurrentObservedInitialPitchOperationFromSqlite } from './SqliteObservedInitialPitchStore';
import { readInitialBatEquipmentFromSqlite } from './SqliteInitialBatEquipmentStore';
import { readObservedInitialPitchHandControlFromSqlite } from './SqliteObservedInitialPitchStore';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { openSqliteMeasuredBattingBodyReferenceStore, measuredBattingBodyReferenceTable, type AcceptedMeasuredBattingBodyReferenceV1, type OwnedMeasuredBattingBodyReferenceV1 } from './SqliteMeasuredBattingBodyReferenceStore';
import { openSqliteInitialPitchHandHoldStore, initialPitchHandHoldTable, type AcceptedInitialPitchHandHoldV1, type OwnedInitialPitchHandHoldV1 } from './SqliteInitialPitchHandHoldStore';
import { readInitialOwnedJointControlPreparation, type InitialOwnedJointControlRequestV1 } from './InitialOwnedJointControlPreparationFromSqlite';
import { openSqliteInitialJointPhysicalExecutionStore, readInitialJointPhysicalExecutionFromSqlite,
  type InitialJointPhysicalRightSource, type InitialJointPhysicalExecutionSource } from './SqliteInitialJointPhysicalExecutionStore';
import { initialJointRightTable, initialJointExecutionTable } from './InitialJointPhysicalExecutionMetadata';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
type Stage = (name: string) => void;
type PelvisDataset = Readonly<{ authority: string; originalBatDatasetSha256: string; archiveMemberSha256: string;
  clips: readonly Readonly<{ clipId: string; batSourceSha256: string; handedness: 'R' | 'L';
    frames: readonly Readonly<{ tick: number; leftHip: Vec3; rightHip: Vec3 }>[] }>[] }>;
const requireValue = <T>(v: T | null | undefined, message: string): T => { if (v == null) throw Error(message); return v; };
const ns = 'iqj139', sourceVersion = 'explicit-synthetic-qualified-initial-joint-v139';

/** The manifest is only a same-database locator and full-pin set. All records
 * below come from original Native Owners; no donor rows or cloned DB exist. */
export function executeInitialQualifiedJointV139(manifestPath: string, stage: Stage = () => {},
  continuation?: 'READ_EXISTING_COMPONENTS_V140'|'READ_EXISTING_COMPONENTS_WITH_PREPARATION_V141') {
  stage('same-database-qualified-decision-reopen-start');
  const original = readInitialQualifiedDecisionV135(manifestPath), { prefix, decision } = original, { path } = prefix;
  strictEqual(prefix.modelReference.sourceId, 'authored-native-match:measured-batting:model:contact-aim-v138:controlled-observer-v139');
  if (decision.calculation.algorithm !== 'batting-spin-execution-calculation-v123') throw Error('explicit v123 qualified calculation required');
  strictEqual(decision.calculation.status, 'READY'); strictEqual(decision.calculation.commitment?.action, 'SWING');
  strictEqual(decision.calculation.spinMotorPlanV123?.selectedIntent, 'BACKSPIN');
  strictEqual(decision.calculation.spinMotorPlanV123?.fallbackReason, null);
  const measured = requireValue(decision.calculation.commitment?.sampledTrajectoryV1, 'original measured commitment missing');
  strictEqual(measured.frames.length, 137); strictEqual(measured.provenance.clipId, 'obp-123_6');
  const beforeHeads = initialQualifiedHeadsV135(path);
  const beforeDatabase = databaseCensusV139(path);
  if (continuation) {
    for (const table of [measuredBattingBodyReferenceTable, initialPitchHandHoldTable])
      strictEqual(beforeDatabase.tables.some(t => t.name === table), true, 'existing component required; repair forbidden');
    for (const table of [initialJointRightTable, initialJointExecutionTable])
      strictEqual(beforeDatabase.tables.some(t => t.name === table), false, 'continuation requires an unissued joint right/execution');
  }
  const db = new Native(path, { readOnly: true });
  let inputs;
  try {
    db.exec('PRAGMA query_only=1; BEGIN');
    inputs = withBattedWorldPhysicalReadTraversal(db, () => withSamePaLifecycleReadPhase(db, () => {
      deepStrictEqual(assertCurrentObservedInitialPitchOperationFromSqlite(db, prefix.decisionReference), decision);
      const bat = readInitialBatEquipmentFromSqlite(db, prefix.initialBatReference);
      const model = requireValue(playerBattingModelEvidenceFromSqlite(db).read(prefix.modelReference.sourceId), 'original model missing');
      deepStrictEqual(reference('world_player_batting_models', model), prefix.modelReference);
      const hand = readObservedInitialPitchHandControlFromSqlite(db, prefix.decisionReference, true);
      return { bat, model, hand };
    }));
    db.exec('COMMIT');
  } finally { db.close(); }
  stage('same-database-current-originals-ready');
  const clip = requireValue(inputs.model.repertoire.values.sampledProfiles?.find(p => p.profileId === decision.calculation.commitment?.profileId), 'original measured profile missing');
  const data = JSON.parse(readFileSync(new URL('../../../docs/demos/measured-batter-pelvis-v1.json', import.meta.url), 'utf8')) as PelvisDataset;
  strictEqual(data.authority, 'ORIGINAL_HIP_JOINT_CENTERS_NOT_MEASURED_BODY_COM_OR_PLAYER_CALIBRATION');
  strictEqual(createHash('sha256').update(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json', import.meta.url))).digest('hex'), data.originalBatDatasetSha256);
  const hips = requireValue(data.clips.find(p => p.clipId === clip.measured.provenance.clipId), 'original same-clip pelvis missing');
  strictEqual(hips.batSourceSha256, clip.measured.provenance.sourceSha256); strictEqual(hips.handedness, clip.handedness);
  deepStrictEqual(hips.frames.map(f => f.tick), clip.measured.frames.map(f => f.tick)); strictEqual(hips.frames.length, 137);
  const measuredEnd = measured.startTick + (measured.frames.at(-1)!.tick - measured.frames[0].tick)
    / measured.sourceTicksPerSecond / measured.playbackRate * measured.ticksPerSecond;
  const throughTick = Math.min(inputs.bat.binding.control.throughTick, Math.ceil(measuredEnd) - 1);
  const bridgeStartTick = Math.max(decision.calculation.nominalRequest.source.bodyReadyTick,
    decision.evaluationTick + decision.calculation.effectiveValues.motor.motorLatencyTicks);
  strictEqual(bridgeStartTick < measured.startTick, true); strictEqual(throughTick > measured.startTick && throughTick < measuredEnd, true);
  strictEqual(inputs.hand.issuedAtTick <= inputs.hand.control.anchors.followThroughEndTick, true);
  const sources = new Map<string, unknown>(), keep = <T extends { sourceId: string }>(s: T): T => { sources.set(s.sourceId, s); return s; };
  const bodySource: AcceptedMeasuredBattingBodyReferenceV1 = keep({ sourceId: ns + ':body', sourceVersion,
    capability: 'owned_measured_batting_body_reference_v1', initialBatReference: prefix.initialBatReference, profileId: clip.profileId,
    availableAtDay: original.genesis.actor.binding.gameDay,
    reference: { provenance: { clipId: hips.clipId, sourceSha256: data.archiveMemberSha256, batSourceSha256: hips.batSourceSha256 },
      sourceTicksPerSecond: clip.measured.sourceTicksPerSecond, frames: hips.frames.map(({ tick, leftHip, rightHip }) => ({ tick, leftHip, rightHip })) },
    postureSpeed: { maximumSpeedMps: 5, basis: 'EXPLICIT_SYNTHETIC_PERSON_POSTURE_SPEED_V1',
      provenance: { assessmentSourceId: ns + ':posture-assessment', assessmentVersion: sourceVersion,
        calibrationSourceId: ns + ':synthetic-posture-speed', calibrationVersion: sourceVersion } } });
  const handSource: AcceptedInitialPitchHandHoldV1 = keep({ sourceId: ns + ':pitcher-hold', sourceVersion,
    capability: 'owned_initial_pitch_hand_hold_v1', operationReference: prefix.decisionReference, throughTick });
  let body: OwnedMeasuredBattingBodyReferenceV1, hand: OwnedInitialPitchHandHoldV1;
  if (continuation) {
    // Only the genuine Owner return is proof. No raw snapshot or provider is
    // used, and historical authentication does not confer a new current right.
    stage('existing-body-owner-read-start');
    const owner = openSqliteMeasuredBattingBodyReferenceStore(path);
    try { body = requireValue(owner.read(bodySource.sourceId), 'original body missing; repair forbidden'); }
    finally { owner.close(); }
    deepStrictEqual(body.source, bodySource); stage('existing-body-owner-read-ready');
    stage('existing-hand-owner-read-start');
    const holdOwner = openSqliteInitialPitchHandHoldStore(path);
    try { hand = requireValue(holdOwner.read(handSource.sourceId), 'original hand successor missing; repair forbidden'); }
    finally { holdOwner.close(); }
    deepStrictEqual(hand.source, handSource); stage('existing-hand-owner-read-ready');
    deepStrictEqual(databaseCensusV139(path), beforeDatabase);
  } else {
    stage('same-clip-body-admit-start');
    const owner = openSqliteMeasuredBattingBodyReferenceStore(path, { readAcceptedBodyReference: id => sources.get(id) ?? null });
    try {
      const value = owner.accept(bodySource.sourceId); if (value.kind !== 'measured_batting_body_reference_v1') throw Error('owned body missing');
      body = value;
    } finally { owner.close(); }
    const holdOwner = openSqliteInitialPitchHandHoldStore(path, { readAcceptedHandHold: id => sources.get(id) ?? null });
    try {
      const value = holdOwner.accept(handSource.sourceId); if (value.kind !== 'initial_pitch_hand_hold_renewal_v1') throw Error('owned hand successor missing');
      hand = value;
    } finally { holdOwner.close(); }
  }
  stage('body-and-pitcher-hold-ready');
  const withPreparation=continuation==='READ_EXISTING_COMPONENTS_WITH_PREPARATION_V141';
  const jointNamespace=withPreparation?'iqj141':ns;
  const jointSourceVersion=withPreparation?'explicit-synthetic-qualified-initial-joint-preparation-v141':sourceVersion;
  const executionOwner = openSqliteInitialJointPhysicalExecutionStore(path, { readAcceptedSource: id => sources.get(id) ?? null });
  try {
    const controls: InitialOwnedJointControlRequestV1 = { batter: { initialBatReference: prefix.initialBatReference,
      decisionReference: prefix.decisionReference, bridgeStartTick, throughTick, bodyControlReference: reference(measuredBattingBodyReferenceTable, body),
      ...(withPreparation?{preparationV141:{version:'explicit_bat_preparation_waypoints_v141' as const,
        waypoints:[{tick:Math.floor((bridgeStartTick+measured.startTick)/2),
          grip:{...inputs.bat.binding.control.grip,y:1.45},orientation:inputs.bat.binding.control.orientation}]}}:{}) },
      pitcherHandHoldReference: reference(initialPitchHandHoldTable, hand) };
    const rightSource: InitialJointPhysicalRightSource = keep({ sourceId: jointNamespace + ':right', sourceVersion:jointSourceVersion,
      capability: 'initial_joint_physical_right_v1', calculation: { controls, throughTick } });
    stage('joint-right-start');
    const right = executionOwner.accept(rightSource.sourceId); if (right.kind !== 'initial_joint_physical_right_v1') throw Error('owned joint right missing');
    strictEqual(right.motionIssued, false); stage('joint-right-ready');
    const executionSource: InitialJointPhysicalExecutionSource = keep({ sourceId: jointNamespace + ':execution', sourceVersion:jointSourceVersion,
      capability: 'initial_joint_physical_execution_v1', rightReference: reference(initialJointRightTable, right) });
    stage('joint-physical-execution-start');
    const execution = executionOwner.accept(executionSource.sourceId); if (execution.kind !== 'initial_joint_physical_execution_v1') throw Error('actual joint execution missing');
    stage('joint-physical-execution-ready:' + execution.calculation.result.kind);
    // A conditional contact assertion is insufficient: every other boundary
    // fails this Gate, with the actual accepted result preserved for diagnosis.
    strictEqual(execution.calculation.result.kind, 'bat_contact');
    strictEqual(execution.motionIssued, true); strictEqual(execution.physicalExecutionAdmitted, true);
    strictEqual(execution.stop.nextMotionAllowed, false); strictEqual(execution.stop.workloadTotalAdmitted, false);
    strictEqual(execution.physicalWork.assessmentStatus, 'REQUIRES_NONEMPTY_WORKLOAD_SETTLEMENT');
    deepStrictEqual(execution.calculation.input.batterControl.bat.measured, measured);
    deepStrictEqual(execution.calculation.input.batterControl.body.reference.transform, measured.transform);
    deepStrictEqual(execution.calculation.input.batterControl.bat.initial, inputs.bat.binding.control);
    deepStrictEqual(executionOwner.accept(executionSource.sourceId), execution);
    strictEqual(initialQualifiedHeadsV135(path), beforeHeads);
    throws(() => readInitialOwnedJointControlPreparation(path, controls), /executed joint physical work/);
    const duplicate = keep({ ...executionSource, sourceId: jointNamespace + ':duplicate-execution' });
    const after = executionCensusV139(path);
    throws(() => executionOwner.accept(duplicate.sourceId), /executed joint physical work/);
    deepStrictEqual(executionCensusV139(path), after); strictEqual(after.length, 1);
    const afterDatabase = databaseCensusV139(path), expectedNewTables = (continuation
      ? [initialJointRightTable, initialJointExecutionTable]
      : [measuredBattingBodyReferenceTable, initialPitchHandHoldTable, initialJointRightTable, initialJointExecutionTable]).sort();
    deepStrictEqual(afterDatabase.tables.filter(t => !beforeDatabase.tables.some(b => b.name === t.name)).map(t => t.name).sort(), expectedNewTables);
    for (const old of beforeDatabase.tables) deepStrictEqual(afterDatabase.tables.find(t => t.name === old.name), old);
    for (const old of beforeDatabase.schema) deepStrictEqual(afterDatabase.schema.find(t => t.name === old.name && t.type === old.type), old);
    for (const added of afterDatabase.schema.filter(t => !beforeDatabase.schema.some(b => b.name === t.name && b.type === t.type))) {
      strictEqual(expectedNewTables.includes(String(added.tbl_name)), true);
    }
    const executionReference = reference(initialJointExecutionTable, execution);
    const resultPath = join(dirname(manifestPath), withPreparation?'stage-b-v141.json':continuation ? 'stage-b-v140.json' : 'stage-b-v139.json');
    writeFileSync(resultPath, json({ version: withPreparation?'same_database_qualified_joint_preparation_v141':continuation ? 'same_database_qualified_joint_resume_v140' : 'same_database_qualified_joint_v139', path, manifestPath, executionReference, controls,
      bodySource, handSource, rightSource, executionSource, executionHash: hash(execution) }), { flag: 'wx' });
    return { prefix, decision, measuredEnd, throughTick, execution, executionReference, beforeHeads, resultPath };
  } finally { executionOwner.close(); }
}

export function executionCensusV139(path: string) {
  const db = new Native(path, { readOnly: true });
  try { return db.prepare('SELECT * FROM main.' + initialJointExecutionTable + ' ORDER BY source_id').all(); } finally { db.close(); }
}

/** Read-only witness only, never an admission proof. No legacy table counts. */
export function databaseCensusV139(path: string) {
  const db = new Native(path, { readOnly: true });
  try {
    const schema = db.prepare("SELECT type,name,tbl_name,sql FROM main.sqlite_schema WHERE name NOT LIKE 'sqlite_%' OR type='index' ORDER BY type,name").all();
    const tables = db.prepare("SELECT name FROM main.sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => {
      const name = String(row.name), records = db.prepare('SELECT * FROM main."' + name.replaceAll('"', '""') + '"').all();
      return { name, hash: createHash('sha256').update(JSON.stringify(records.map(r => JSON.stringify(r)).sort())).digest('hex') };
    });
    return { schema, tables };
  } finally { db.close(); }
}

/** Fresh q1 connection, no writer facade/provider. Historical proof authorizes
 * neither another current motion nor empty workload settlement. */
export function replayInitialQualifiedJointV139(path: string, ref: Parameters<typeof readInitialJointPhysicalExecutionFromSqlite>[1]) {
  const db = new Native(path, { readOnly: true });
  try {
    db.exec('PRAGMA query_only=1; BEGIN');
    const value = withBattedWorldPhysicalReadTraversal(db, () => withSamePaLifecycleReadPhase(db, () => readInitialJointPhysicalExecutionFromSqlite(db, ref)));
    db.exec('COMMIT'); return value;
  } finally { db.close(); }
}

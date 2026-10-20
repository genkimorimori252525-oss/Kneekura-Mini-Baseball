import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../../src/host/world/SqliteSamePlateAppearancePhysicalEpisodeStore';
import { readSamePaPhysicalOperationFromSqlite } from '../../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import type { SamePaPhysicalOperationReference } from '../../../src/host/world/SamePlateAppearancePhysicalEpisode';
import { openSqliteSamePlateAppearanceLifecycleStore } from '../../../src/host/world/SqliteSamePlateAppearanceLifecycleStore';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
  readSamePaLifecycleSetFromSqlite } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import type { SamePaLifecycleCalibration } from '../../../src/host/world/SamePlateAppearanceLifecycleCalibration';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import { openSqliteBattingPerceptionStore } from '../../../src/host/world/SqliteBattingPerceptionStore';
import { openSqliteBattingEmotionStore } from '../../../src/host/world/SqliteBattingEmotionStore';
import { openSqliteBattingEmotionExecutionStore } from '../../../src/host/world/SqliteBattingEmotionExecutionStore';
import { readEmotionWorldRevisionFromSqlite } from '../../../src/host/world/EmotionWorldRevisionFromSqlite';
import { battingEmotionFrame } from '../../../src/host/world/NativeBattingEmotionExecution';
import { request as emotionFixture } from '../../../src/core/world/psychology/execution/ExecutionFixtures.test-support';
import { openSqliteBattingExecutionInputStore } from '../../../src/host/world/SqliteBattingExecutionInputStore';
import type { SamePaPhysicalFieldAction } from '../../../src/host/world/SamePlateAppearancePhysicalFieldAction';
import { openSqliteSamePlateAppearanceTeamCoverageDispatch } from '../../../src/host/world/SamePlateAppearanceTeamCoverageDispatch';

/** Read-only recovery entry for the interrupted TN01's own retained artifact.
 * Raw rows supply expected pins only; the original owner rederives every proof.
 * This does not copy a proof into any writer or credit nine-person execution. */
const [directoryArgument, mode = 'read'] = process.argv.slice(2);
assert.ok(/^declare-cut(\d+)-calibrations$/.test(mode) || /^(advance-)?defender-(observation|decision)-[0-8]$/.test(mode)
  || /^checkpoint-reopen-[0-8]$/.test(mode) || ['read',
  'delivery', 'advance-delivery', 'advance-forecast', 'advance-emotion', 'advance-decision-cut', 'advance-commitment', 'advance-resolution',
  'forecast', 'score', 'emotion', 'decision-cut', 'input', 'commitment', 'resolution', 'field-root', 'field-step', 'advance-field-root', 'advance-field-step', 'decision-checkpoint', 'checkpoint-finalize', 'due-wait', 'advance-due-wait', 'motion'].includes(mode));
assert.ok(directoryArgument);
const directory = resolve(directoryArgument), originalPath = join(directory, 'retained-prefix.sqlite');
const resumeDirectory = join(directory, 'retained-resume');
if (mode !== 'read') mkdirSync(resumeDirectory, { recursive: true });
const path = mode === 'read' ? originalPath : join(resumeDirectory, 'resume.sqlite');
if (mode !== 'read' && !existsSync(path)) copyFileSync(originalPath, path, constants.COPYFILE_EXCL);
assert.ok(!path.startsWith('file:'));
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const persistSourceMap = (mapPath: string, entries: Map<string, unknown>) => {
  // A worker interruption must not truncate the last durable declarations.
  // Complete the new map in a sibling file before atomically replacing it.
  const pendingPath = mapPath + '.pending-' + process.pid;
  writeFileSync(pendingPath, JSON.stringify([...entries.entries()], null, 2), { flag: 'wx' });
  renameSync(pendingPath, mapPath);
};
const originalFileHash = sha(readFileSync(path)), sourceBytes = readFileSync(join(directory, 'accepted-sources-0.json'));
const preservedOriginalHash = sha(readFileSync(originalPath));
const sources = new Map<string, unknown>(JSON.parse(sourceBytes.toString('utf8')));
assert.equal(sources.size, 20);
const expectedSource = sources.get('team-native:pitch3:delivery-cut');
assert.ok(expectedSource);
const raw = new DatabaseSync(path, { readOnly: true });
let pin: SamePaPhysicalOperationReference, expectedSnapshotHash: string, expectedTick: number;
try {
  assert.equal(raw.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
  const row = raw.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM pa_physical_v1_cuts WHERE source_id=?')
    .get('team-native:pitch3:delivery-cut');
  assert.ok(row);
  assert.equal(hash(expectedSource), row.source_hash);
  assert.deepEqual(JSON.parse(String(row.source_json)), expectedSource);
  const expected = JSON.parse(String(row.snapshot_json));
  assert.equal(hash(expected), row.snapshot_hash);
  expectedSnapshotHash = String(row.snapshot_hash); expectedTick = expected.evaluationTick;
  pin = { owner: 'pa_physical_v1_cuts', sourceId: 'team-native:pitch3:delivery-cut',
    sourceHash: String(row.source_hash), snapshotHash: expectedSnapshotHash };
} finally { raw.close(); }
const ownerRead = () => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const proof = withSqliteReadTransaction(db, () => readSamePaPhysicalOperationFromSqlite(db, pin));
    assert.equal(hash(proof.record), expectedSnapshotHash);
    assert.equal(hash(proof.record.source), hash(expectedSource));
    assert.equal(proof.evaluationTick, expectedTick);
    assert.equal(proof.kind, 'same_pa_physical_cut_v1');
    assert.equal(proof.stage, 'in_flight');
    return { reference: proof.reference, evaluationTick: proof.evaluationTick, stage: proof.stage, physicalPitchReference: proof.physicalPitchReference };
  } finally { db.close(); }
};
const started = Date.now(), first = ownerRead(), reopened = ownerRead();
assert.deepEqual(reopened, first);
assert.equal(sha(readFileSync(path)), originalFileHash);
const receipt = { status: 'PASS_ORIGINAL_OWNER_PARTIAL_PREFIX_READ_REOPEN', originalFileHash,
  readDatabasePath: path, preservedOriginalDatabaseHash: preservedOriginalHash,
  acceptedSourceFileHash: sha(sourceBytes), sourceCount: sources.size, ...first,
  independentlyReopened: true, originalBytesUnchanged: true, elapsedMilliseconds: Date.now() - started,
  newSources: 0, teamExecutionCredit: 0, officialResult: null,
  priorAttempt: { status: 'FAIL_WORKER_EXITED_UNEXPECTEDLY', elapsedSeconds: 626.42, causality: 'UNKNOWN' } };
writeFileSync(join(mode === 'read' ? directory : resumeDirectory,
  mode === 'read' ? 'read-reopen-receipt.json' : 'read-reopen-' + mode + '-receipt.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt));
if (mode.startsWith('declare-cut')) {
  // Fresh approved synthetic declarations, not a reconstruction/proof of the
  // uncaptured old proposal. The original Source20 and retained DB stay intact.
  const db = new DatabaseSync(path, { readOnly: true });
  const nextCut = Number(mode.match(/^declare-cut(\d+)-calibrations$/)![1]);
  const priorViewId = nextCut <= 6 ? 'physical-fixture:cut' + (nextCut - 1) + ':view' : 'team-retained:cut' + (nextCut - 1) + ':view';
  const nextViewId = nextCut === 5 ? 'physical-fixture:cut5:view' : 'team-retained:cut' + nextCut + ':view';
  let basis: ReturnType<typeof readCurrentSamePaLifecycleViewFromSqlite>, previous: readonly SamePaLifecycleCalibration[];
  try {
    const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get(nextViewId);
    assert.ok(row);
    const pin = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(row.snapshot_json)));
    const ids = db.prepare('SELECT source_id FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
      .all(priorViewId).map(r => String(r.source_id));
    assert.equal(ids.length, 32);
    const authentic = withSqliteReadTransaction(db, () => ({ basis: readCurrentSamePaLifecycleViewFromSqlite(db, pin),
      values: readSamePaLifecycleSetFromSqlite(db, 'calibration', ids) }));
    basis = authentic.basis;
    if (nextCut <= 11) assert.equal(basis.view.cut.operationReference.sourceId, nextCut === 5 ? 'team-native:pitch3:delivery-cut'
      : nextCut === 6 ? 'team-retained:pitch3:delivery' : nextCut === 7 ? 'team-retained:pitch3:forecast'
        : nextCut === 8 ? 'team-retained:pitch3:emotion' : nextCut === 9 ? 'team-retained:pitch3:decision-cut'
          : nextCut === 10 ? 'team-retained:pitch3:commitment' : 'team-retained:pitch3:resolution');
    if (nextCut >= 9) {
      const cutReference = basis.view.cut.physicalOperationReference;
      const nativeOwner = cutReference.owner;
      if (nativeOwner === 'pa_take_successor_v1_pitch_actions') throw new Error('retained calibration needs current physical episode');
      const proof = withSqliteReadTransaction(db, () => readSamePaPhysicalOperationFromSqlite(db, { ...cutReference, owner: nativeOwner }));
      assert.equal(basis.view.cut.evaluationTick, proof.evaluationTick);
    } else assert.equal(basis.view.cut.evaluationTick, expectedTick);
    previous = authentic.values.map(value => { assert.ok(value?.kind === 'same_pa_lifecycle_calibration'); return value; });
  } finally { db.close(); }
  const version = 'retained-resume-synthetic-prior-v1';
  const declarations = previous.map(value => {
    const old = value.source, member = basis.members.find(m => m.playerId === old.member.playerId);
    assert.ok(member);
    return { ...old, sourceId: 'team-retained:cut' + nextCut + ':' + old.member.playerId + ':' + old.route, sourceVersion: version,
      viewReference: reference('pa_lifecycle_v1_execution_views', basis.view), member,
      provenance: { ...old.provenance, assessmentSourceId: 'team-retained:cut' + nextCut + ':assessment:' + old.member.playerId + ':' + old.route,
        assessmentVersion: version, calibrationSourceId: 'team-retained:cut' + (nextCut - 1) + '-authenticated-prior:' + old.route, calibrationVersion: version } };
  });
  const savedMapPath = join(resumeDirectory, 'accepted-sources.json');
  const published = existsSync(savedMapPath) ? new Map<string, unknown>(JSON.parse(readFileSync(savedMapPath, 'utf8'))) : new Map(sources);
  for (const declaration of declarations) {
    if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published Source collision');
    else published.set(declaration.sourceId, declaration);
  }
  // Persist the whole authority map before the first original writer call.
  persistSourceMap(savedMapPath, published);
  const owner = openSqliteSamePlateAppearanceLifecycleStore(path, { readAcceptedCalibration: id => published.get(id) });
  let result: ReturnType<typeof owner.acceptCalibrationSet>;
  const started = Date.now();
  try { result = owner.acceptCalibrationSet(declarations.map(s => s.sourceId)); } finally { owner.close(); }
  assert.equal(result.kind, 'same_pa_lifecycle_calibration_set');
  if (result.kind !== 'same_pa_lifecycle_calibration_set') throw new Error('original cut5 calibration admission pending');
  const reopened = openSqliteSamePlateAppearanceLifecycleStore(path, { readAcceptedCalibration: id => published.get(id) });
  try { assert.deepEqual(reopened.acceptCalibrationSet(declarations.map(s => s.sourceId)), result); } finally { reopened.close(); }
  assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
  assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
  const resultReceipt = { status: 'PASS_NEW_SYNTHETIC_CUT' + nextCut + '_CALIBRATION_DECLARATIONS_ORIGINAL_OWNER_REOPEN',
    previousProposalHash: 'UNKNOWN_UNCAPTURED', sourceVersion: version, reusedAuthenticatedPriorValues: true,
    declarationIds: declarations.map(s => s.sourceId), originalViewReference: reference('pa_lifecycle_v1_execution_views', basis.view),
    acceptedSetHash: hash(result), authorityMapHash: sha(readFileSync(savedMapPath)), elapsedMilliseconds: Date.now() - started,
    originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true,
    teamExecutionCredit: 0, officialResult: null };
  writeFileSync(join(resumeDirectory, 'cut' + nextCut + '-calibration-receipt.json'), JSON.stringify(resultReceipt, null, 2));
  console.log(JSON.stringify(resultReceipt));
}
if (mode === 'delivery') {
  const mapPath = join(resumeDirectory, 'accepted-sources.json');
  assert.ok(existsSync(mapPath), 'first admit the explicit cut5 calibration tail');
  const published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true });
  let basis: ReturnType<typeof readCurrentSamePaLifecycleViewFromSqlite>, observationReference: ReturnType<typeof reference<'batting_observation_v1_observations'>>;
  let calibrationReference: ReturnType<typeof reference<'pa_lifecycle_v1_execution_calibrations'>>;
  try {
    const viewRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('physical-fixture:cut5:view');
    const captureRow = db.prepare('SELECT snapshot_json FROM batting_observation_v1_observations WHERE source_id=?').get('team-native:pitch3:capture');
    assert.ok(viewRow && captureRow);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(viewRow.snapshot_json)));
    basis = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
    observationReference = reference('batting_observation_v1_observations', JSON.parse(String(captureRow.snapshot_json)));
    const id = 'team-retained:cut5:' + basis.actor.binding.playerId + ':batter_observation';
    const calRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_calibrations WHERE source_id=?').get(id);
    assert.ok(calRow, 'original cut5 batter observation calibration missing');
    calibrationReference = reference('pa_lifecycle_v1_execution_calibrations', JSON.parse(String(calRow.snapshot_json)));
  } finally { db.close(); }
  const member = basis.members.find(m => m.playerId === basis.actor.binding.playerId);
  assert.ok(member);
  const declaration = { sourceId: 'team-retained:pitch3:delivery', sourceVersion: 'retained-resume-synthetic-prior-v1',
    capability: 'owned_in_flight_batting_observation_delivery_v1', viewReference: reference('pa_lifecycle_v1_execution_views', basis.view),
    member, observationReference, physicalPitchReference: first.physicalPitchReference,
    physicalOperationReference: pin, calibrationReference };
  if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published delivery collision');
  else published.set(declaration.sourceId, declaration);
  persistSourceMap(mapPath, published);
  const owner = openSqliteBattingPerceptionStore(path, { readAcceptedDelivery: id => published.get(id) });
  const started = Date.now();
  let delivered: ReturnType<typeof owner.acceptDelivery>;
  try { delivered = owner.acceptDelivery(declaration.sourceId); } finally { owner.close(); }
  assert.equal(delivered.kind, 'batting_observation_delivery');
  if (delivered.kind !== 'batting_observation_delivery') throw new Error('original delivery admission pending');
  const reopened = openSqliteBattingPerceptionStore(path);
  try { assert.deepEqual(reopened.readDelivery(declaration.sourceId), delivered); } finally { reopened.close(); }
  assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
  assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
  const resultReceipt = { status: 'PASS_NEW_DELIVERY_SOURCE_ORIGINAL_PERCEPTION_OWNER_REOPEN',
    previousProposalHash: 'UNKNOWN_UNCAPTURED', deliveryReference: reference('batting_observation_v1_deliveries', delivered),
    authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
    originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true,
    teamExecutionCredit: 0, officialResult: null };
  writeFileSync(join(resumeDirectory, 'delivery-receipt.json'), JSON.stringify(resultReceipt, null, 2));
  console.log(JSON.stringify(resultReceipt));
}
if (mode.startsWith('advance-')) {
  const mapPath = join(resumeDirectory, 'accepted-sources.json');
  const published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const publish = <T extends { sourceId: string }>(source: T): T => {
    if (published.has(source.sourceId)) assert.equal(hash(published.get(source.sourceId)), hash(source), 'published lifecycle collision');
    else published.set(source.sourceId, source);
    persistSourceMap(mapPath, published); return source;
  };
  const owner = openSqliteSamePlateAppearanceLifecycleStore(path, { readAcceptedPrefix: id => published.get(id),
    readAcceptedTotal: id => published.get(id), readAcceptedView: id => published.get(id) });
  const perception = openSqliteBattingPerceptionStore(path), emotionOwner = openSqliteBattingEmotionExecutionStore(path),
    physical = openSqliteSamePlateAppearancePhysicalEpisodeStore(path), db = new DatabaseSync(path, { readOnly: true });
  const started = Date.now();
  try {
    const operationKind = mode.slice('advance-'.length);
    const defenderStage = operationKind.match(/^defender-(observation|decision)-([0-8])$/);
    const nextCut = operationKind === 'delivery' ? 6 : operationKind === 'forecast' ? 7 : operationKind === 'emotion' ? 8
      : operationKind === 'decision-cut' ? 9 : operationKind === 'commitment' ? 10 : operationKind === 'resolution' ? 11
        : operationKind === 'field-root' ? 12 : operationKind === 'field-step' ? 13 : operationKind === 'due-wait' ? 32
          : defenderStage ? 14 + Number(defenderStage[2]) * 2 + (defenderStage[1] === 'decision' ? 1 : 0) : NaN;
    assert.ok(Number.isSafeInteger(nextCut));
    const priorViewId = nextCut === 6 ? 'physical-fixture:cut5:view' : 'team-retained:cut' + (nextCut - 1) + ':view';
    const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get(priorViewId);
    assert.ok(row);
    const originalViewRef = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(row.snapshot_json)));
    const prior = withSqliteReadTransaction(db, () => {
      const basis = readHistoricalSamePaLifecycleViewFromSqlite(db, originalViewRef);
      const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', basis.view.source.prefixReference.sourceId);
      assert.ok(prefix?.kind === 'same_pa_lifecycle_prefix');
      const ids = basis.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', ids).map(t => { assert.ok(t?.kind === 'same_pa_lifecycle_total'); return t; });
      return { basis, prefix, totals };
    });
    const physicalOwner = operationKind === 'decision-cut' ? 'pa_physical_v1_cuts' : operationKind === 'commitment' ? 'pa_physical_v1_commitments'
      : operationKind === 'resolution' ? 'pa_physical_v1_resolutions' : operationKind === 'field-root' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps';
    const cutRow = !['delivery', 'forecast', 'emotion'].includes(operationKind)
      ? db.prepare('SELECT snapshot_json FROM ' + physicalOwner + ' WHERE source_id=?').get('team-retained:' + (nextCut >= 12 ? 'field:' : 'pitch3:') + operationKind) : null;
    const currentPhysicalReference = cutRow ? reference(physicalOwner, JSON.parse(String(cutRow.snapshot_json))) : pin;
    const operation = operationKind === 'delivery' ? perception.readDelivery('team-retained:pitch3:delivery')
      : operationKind === 'forecast' ? perception.readPrediction('team-retained:pitch3:forecast')
        : operationKind === 'emotion' ? emotionOwner.read('team-retained:pitch3:emotion') : physical.readOperation(currentPhysicalReference).record;
    assert.ok(operation?.kind === (operationKind === 'delivery' ? 'batting_observation_delivery'
      : operationKind === 'forecast' ? 'batting_observed_prediction' : operationKind === 'emotion' ? 'batting_emotion_execution'
        : operationKind === 'decision-cut' ? 'same_pa_physical_cut_v1' : operationKind === 'commitment' ? 'same_pa_physical_commitment_v1'
          : operationKind === 'resolution' ? 'same_pa_physical_resolution_v1' : operationKind === 'field-root' ? 'same_pa_physical_field_root_v1' : 'same_pa_physical_field_step_v1'));
    const operationReference = reference(operationKind === 'delivery' ? 'batting_observation_v1_deliveries'
      : operationKind === 'forecast' ? 'batting_prediction_v1_predictions' : operationKind === 'emotion'
        ? 'batting_emotion_execution_v1_executions' : physicalOwner, operation);
    const version = 'retained-resume-synthetic-prior-v1', stem = 'team-retained:cut' + nextCut;
    const prefixDeclaration = publish({ ...prior.prefix.source, sourceId: stem + ':prefix', sourceVersion: version,
      eventReferences: [...prior.prefix.source.eventReferences, operationReference] });
    const prefix = owner.acceptPrefix(prefixDeclaration.sourceId);
    assert.equal(prefix.kind, 'same_pa_lifecycle_prefix');
    if (prefix.kind !== 'same_pa_lifecycle_prefix') throw new Error('original delivery advance prefix pending');
    const prefixReference = reference('pa_lifecycle_v1_work_prefixes', prefix);
    const totals = prior.totals.map(t => publish({ ...t.source, sourceId: stem + ':total:' + t.source.participantReference.playerId,
      sourceVersion: version, prefixReference, provenance: { ...t.source.provenance,
        assessmentSourceId: stem + ':assessment:' + t.source.participantReference.playerId, assessmentVersion: version,
        calibrationSourceId: 'team-retained:authenticated-cut' + (nextCut - 1) + '-cumulative-effort', calibrationVersion: version } }));
    const totalSet = owner.acceptTotalSet(totals.map(t => t.sourceId));
    assert.equal(totalSet.kind, 'same_pa_lifecycle_total_set');
    if (totalSet.kind !== 'same_pa_lifecycle_total_set') throw new Error('original delivery advance ten total declarations pending');
    const viewDeclaration = publish({ ...prior.basis.view.source, sourceId: stem + ':view', sourceVersion: version,
      prefixReference, participantTotalReferences: totalSet.participantTotalReferences });
    const view = owner.acceptView(viewDeclaration.sourceId);
    assert.equal(view.kind, 'same_pa_lifecycle_view');
    if (view.kind !== 'same_pa_lifecycle_view') throw new Error('original delivery advance view pending');
    assert.equal(view.cut.operationReference.sourceId, operation!.source.sourceId);
    assert.deepEqual(view.cut.physicalOperationReference, currentPhysicalReference);
    const reopened = openSqliteSamePlateAppearanceLifecycleStore(path);
    try { assert.deepEqual(reopened.readView(view.source.sourceId), view); } finally { reopened.close(); }
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
    const resultReceipt = { status: 'PASS_ACTUAL_' + operationKind.toUpperCase() + '_LIFECYCLE_ADVANCE_ORIGINAL_OWNER_REOPEN',
      previousProposalHash: 'UNKNOWN_UNCAPTURED', viewReference: reference('pa_lifecycle_v1_execution_views', view),
      operationReference: view.cut.operationReference, physicalOperationReference: view.cut.physicalOperationReference,
      evaluationTick: view.cut.evaluationTick, authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
      originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
    writeFileSync(join(resumeDirectory, 'advance-' + operationKind + '-receipt.json'), JSON.stringify(resultReceipt, null, 2));
    console.log(JSON.stringify(resultReceipt));
  } finally { owner.close(); physical.close(); emotionOwner.close(); perception.close(); db.close(); }
}
if (mode === 'forecast') {
  const mapPath = join(resumeDirectory, 'accepted-sources.json');
  const published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true }), perception = openSqliteBattingPerceptionStore(path,
    { readAcceptedPrediction: id => published.get(id) });
  const started = Date.now();
  try {
    const viewRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut6:view');
    assert.ok(viewRow);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(viewRow.snapshot_json)));
    const basis = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
    const member = basis.members.find(m => m.playerId === basis.actor.binding.playerId);
    const posture = perception.readPosture('team-native:pitch3:posture');
    const capture = perception.readObservation('team-native:pitch3:capture');
    const delivery = perception.readDelivery('team-retained:pitch3:delivery');
    assert.ok(member && posture?.kind === 'batting_invocation_posture' && capture?.kind === 'batting_observation'
      && delivery?.kind === 'batting_observation_delivery');
    const parameter = posture.model.predictionCalibration;
    const declaration = { sourceId: 'team-retained:pitch3:forecast', sourceVersion: 'retained-resume-synthetic-prior-v1',
      capability: 'owned_in_flight_batting_observed_prediction_v1', viewReference, member,
      observationReference: reference('batting_observation_v1_observations', capture),
      deliveryReference: reference('batting_observation_v1_deliveries', delivery), modelReference: posture.source.modelReference,
      predictionParameterReference: { sourceId: parameter.sourceId, sourceVersion: parameter.sourceVersion, sourceHash: hash(parameter) } };
    if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published forecast collision');
    else published.set(declaration.sourceId, declaration);
    persistSourceMap(mapPath, published);
    const prediction = perception.acceptPrediction(declaration.sourceId);
    assert.equal(prediction.kind, 'batting_observed_prediction');
    if (prediction.kind !== 'batting_observed_prediction') throw new Error('original observed forecast admission pending');
    const reopened = openSqliteBattingPerceptionStore(path);
    try { assert.deepEqual(reopened.readPrediction(declaration.sourceId), prediction); } finally { reopened.close(); }
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
    const resultReceipt = { status: 'PASS_OBSERVED_FORECAST_SOURCE_ORIGINAL_PERCEPTION_OWNER_REOPEN',
      predictionReference: reference('batting_prediction_v1_predictions', prediction),
      availableEvidence: { originalObservationReference: declaration.observationReference, originalDeliveryReference: declaration.deliveryReference },
      authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
      originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
    writeFileSync(join(resumeDirectory, 'forecast-receipt.json'), JSON.stringify(resultReceipt, null, 2));
    console.log(JSON.stringify(resultReceipt));
  } finally { perception.close(); db.close(); }
}
if (mode === 'score') {
  const mapPath = join(resumeDirectory, 'accepted-sources.json');
  const published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true }), perception = openSqliteBattingPerceptionStore(path,
    { readAcceptedAssessment: id => published.get(id) });
  const started = Date.now();
  try {
    const viewRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut7:view');
    assert.ok(viewRow);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(viewRow.snapshot_json)));
    const basis = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
    const member = basis.members.find(m => m.playerId === basis.actor.binding.playerId);
    const posture = perception.readPosture('team-native:pitch3:posture');
    const capture = perception.readObservation('team-native:pitch3:capture');
    const forecast = perception.readPrediction('team-retained:pitch3:forecast');
    assert.ok(member && posture?.kind === 'batting_invocation_posture' && capture?.kind === 'batting_observation'
      && forecast?.kind === 'batting_observed_prediction');
    const version = 'retained-resume-synthetic-prior-v1';
    const declaration = { sourceId: 'team-retained:pitch3:score', sourceVersion: version,
      capability: 'owned_in_flight_batting_score_assessment_v1', viewReference, member,
      predictionReference: reference('batting_prediction_v1_predictions', forecast), modelReference: posture.source.modelReference,
      observationCutReference: reference('batting_observation_v1_observations', capture), score: 0.9,
      provenance: { assessmentSourceId: 'team-retained:pitch3:explicit-score', assessmentVersion: version,
        calibrationSourceId: 'explicit-original-fixture-0.9-score', calibrationVersion: version } };
    if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published assessment collision');
    else published.set(declaration.sourceId, declaration);
    persistSourceMap(mapPath, published);
    const score = perception.acceptAssessment(declaration.sourceId);
    assert.equal(score.kind, 'batting_score_assessment');
    if (score.kind !== 'batting_score_assessment') throw new Error('original explicit fixture assessment admission pending');
    const reopened = openSqliteBattingPerceptionStore(path);
    try { assert.deepEqual(reopened.readAssessment(declaration.sourceId), score); } finally { reopened.close(); }
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
    const resultReceipt = { status: 'PASS_EXPLICIT_SYNTHETIC_ASSESSMENT_ORIGINAL_OWNER_REOPEN',
      assessmentReference: reference('batting_score_v1_assessments', score), declaredFixtureScore: 0.9,
      calibratedProductionScore: false, authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
      originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
    writeFileSync(join(resumeDirectory, 'score-receipt.json'), JSON.stringify(resultReceipt, null, 2));
    console.log(JSON.stringify(resultReceipt));
  } finally { perception.close(); db.close(); }
}
if (mode === 'emotion') {
  const mapPath = join(resumeDirectory, 'accepted-sources.json'), published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true }), perception = openSqliteBattingPerceptionStore(path),
    genesisOwner = openSqliteBattingEmotionStore(path), owner = openSqliteBattingEmotionExecutionStore(path, { readAcceptedExecution: id => published.get(id) });
  const started = Date.now();
  try {
    const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut7:view');
    assert.ok(row);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(row.snapshot_json)));
    const context = withSqliteReadTransaction(db, () => {
      const basis = readCurrentSamePaLifecycleViewFromSqlite(db, viewReference);
      const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', basis.view.source.prefixReference.sourceId);
      assert.ok(prefix?.kind === 'same_pa_lifecycle_prefix');
      const world = readEmotionWorldRevisionFromSqlite(db, basis.actor.binding.careerId); assert.ok(world);
      return { basis, prefix, world };
    });
    const { basis, prefix, world } = context, member = basis.members.find(m => m.playerId === basis.actor.binding.playerId);
    const capture = perception.readObservation('team-native:pitch3:capture'), delivery = perception.readDelivery('team-retained:pitch3:delivery');
    const genesis = genesisOwner.readGenesis('physical-fixture:emotion-genesis');
    assert.ok(member && capture?.kind === 'batting_observation' && delivery?.kind === 'batting_observation_delivery' && genesis);
    const sourceFrame = { viewReference, observationReference: reference('batting_observation_v1_observations', capture),
      deliveryReference: reference('batting_observation_v1_deliveries', delivery), previousExecutionReference: null };
    const time = { tick: basis.view.cut.evaluationTick, sequence: prefix.source.eventReferences.length };
    const frame = battingEmotionFrame(sourceFrame, basis.actor, world, time), declared = structuredClone(emotionFixture());
    const a = declared.appraisal as any, club = basis.actor.binding.clubId, game = basis.actor.worldFixture.game,
      opponent = club === game.homeClubId ? game.awayClubId : game.homeClubId;
    Object.assign(a.importance, { scope: frame.scope, contextId: frame.contextId, time, clubId: club, opponentClubId: opponent });
    Object.assign(a.importance.competition, { careerId: frame.scope.careerId, matchId: frame.scope.matchId, clubId: club,
      opponentClubId: opponent, competitionId: basis.actor.binding.competitionEditionId });
    Object.assign(a.importance.personal, { scope: frame.scope, clubId: club });
    Object.assign(a.importance.rivalry, { careerId: frame.scope.careerId, fromClubId: club, toClubId: opponent });
    for (const part of [a.importance.competition, a.importance.personal, a.importance.rivalry, a.player]) part.stamp.time = time;
    a.player.scope = frame.scope;
    Object.assign(a.event, { scope: frame.scope, contextId: frame.contextId, eventId: delivery.source.sourceId,
      stamp: { sourceId: delivery.source.sourceId, revision: delivery.eventSequence,
        time: { tick: delivery.delivery.evaluatedAtTick, sequence: delivery.eventSequence } } });
    a.evidenceEventIds = [delivery.source.sourceId]; a.policy = genesis.state.policy;
    const { frame: _frame, ...rawBaseline } = declared.baseline;
    const shift = (window: { tick: number; earliestTick: number; latestTick: number }) => ({ ...window,
      tick: window.tick + time.tick - 100, earliestTick: window.earliestTick + time.tick - 100, latestTick: window.latestTick + time.tick - 100 });
    const baseline = { ...rawBaseline, swingDecision: shift(rawBaseline.swingDecision),
      throwIntent: shift(rawBaseline.throwIntent), defenseReplan: shift(rawBaseline.defenseReplan) };
    const version = 'retained-resume-synthetic-prior-v1';
    const declaration = { sourceId: 'team-retained:pitch3:emotion', sourceVersion: version,
      capability: 'owned_in_flight_batting_emotion_execution_v1', physicalPitchReference: first.physicalPitchReference,
      physicalOperationReference: pin, executionId: 'team-retained:pitch3:emotion-event', ...sourceFrame, member,
      genesisReference: reference('batting_emotion_v1_geneses', genesis), expectedWorld: { careerId: basis.actor.binding.careerId,
        worldRevision: world.head.worldRevision, controlRevision: world.head.control.revision, controlHash: hash(world.head.control) },
      appraisalAssessment: a, baseline, executionModel: declared.model, provenance: { assessmentSourceId: 'team-retained:pitch3:explicit-appraisal',
        assessmentVersion: version, calibrationSourceId: 'existing-explicit-emotion-fixture', calibrationVersion: version } };
    if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published emotion collision');
    else published.set(declaration.sourceId, declaration);
    persistSourceMap(mapPath, published);
    const emotion = owner.accept(declaration.sourceId);
    assert.equal(emotion.kind, 'batting_emotion_execution');
    if (emotion.kind !== 'batting_emotion_execution') throw new Error('original synthetic appraisal admission pending');
    const reopened = openSqliteBattingEmotionExecutionStore(path);
    try { assert.deepEqual(reopened.read(declaration.sourceId), emotion); } finally { reopened.close(); }
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
    const resultReceipt = { status: 'PASS_EXPLICIT_SYNTHETIC_APPRAISAL_ORIGINAL_OWNER_REOPEN',
      emotionReference: reference('batting_emotion_execution_v1_executions', emotion),
      scheduling: emotion.acceptance.proposal.inputs.swingDecision, calibratedProductionAppraisal: false,
      authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
      originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
    writeFileSync(join(resumeDirectory, 'emotion-receipt.json'), JSON.stringify(resultReceipt, null, 2));
    console.log(JSON.stringify(resultReceipt));
  } finally { owner.close(); genesisOwner.close(); perception.close(); db.close(); }
}
if (mode === 'decision-cut') {
  const mapPath = join(resumeDirectory, 'accepted-sources.json'), published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true }), emotionOwner = openSqliteBattingEmotionExecutionStore(path),
    owner = openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => published.get(id) });
  const started = Date.now();
  try {
    const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut8:view');
    assert.ok(row);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(row.snapshot_json)));
    const basis = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
    const emotion = emotionOwner.read('team-retained:pitch3:emotion'); assert.ok(emotion);
    const throughTick = emotion.acceptance.proposal.inputs.swingDecision.tick;
    assert.ok(throughTick > basis.view.cut.evaluationTick);
    const declaration = { sourceId: 'team-retained:pitch3:decision-cut', sourceVersion: 'retained-resume-synthetic-prior-v1',
      capability: 'same_pa_physical_cut_v1', viewReference, launchReference: first.physicalPitchReference,
      previousOperationReference: basis.view.cut.physicalOperationReference, throughTick };
    if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published cut collision');
    else published.set(declaration.sourceId, declaration);
    persistSourceMap(mapPath, published);
    const cut = owner.acceptOperation(declaration.sourceId);
    assert.equal(cut.kind, 'same_pa_physical_cut_v1');
    if (cut.kind !== 'same_pa_physical_cut_v1') throw new Error('original decision physical cut admission pending');
    const cutReference = reference('pa_physical_v1_cuts', cut);
    const reopened = openSqliteSamePlateAppearancePhysicalEpisodeStore(path);
    try { assert.deepEqual(reopened.readOperation(cutReference).record, cut); } finally { reopened.close(); }
    assert.equal(cut.evaluationTick, throughTick);
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
    const resultReceipt = { status: 'PASS_ACTUAL_SCHEDULED_DECISION_CUT_ORIGINAL_PHYSICAL_OWNER_REOPEN', cutReference,
      evaluationTick: cut.evaluationTick, schedulingSourceReference: reference('batting_emotion_execution_v1_executions', emotion),
      authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
      originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
    writeFileSync(join(resumeDirectory, 'decision-cut-receipt.json'), JSON.stringify(resultReceipt, null, 2));
    console.log(JSON.stringify(resultReceipt));
  } finally { owner.close(); emotionOwner.close(); db.close(); }
}
if (mode === 'input') {
  const mapPath = join(resumeDirectory, 'accepted-sources.json'), published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true }), perception = openSqliteBattingPerceptionStore(path),
    emotionOwner = openSqliteBattingEmotionExecutionStore(path), owner = openSqliteBattingExecutionInputStore(path, { readAcceptedInput: id => published.get(id) });
  const started = Date.now();
  try {
    const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut9:view'); assert.ok(row);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(row.snapshot_json)));
    const context = withSqliteReadTransaction(db, () => {
      const basis = readCurrentSamePaLifecycleViewFromSqlite(db, viewReference);
      const world = readEmotionWorldRevisionFromSqlite(db, basis.actor.binding.careerId); assert.ok(world); return { basis, world };
    });
    const { basis, world } = context, member = basis.members.find(m => m.playerId === basis.actor.binding.playerId);
    const posture = perception.readPosture('team-native:pitch3:posture'), score = perception.readAssessment('team-retained:pitch3:score'),
      emotion = emotionOwner.read('team-retained:pitch3:emotion'), intent = owner.readIntent('team-native:pitch3:intent');
    assert.ok(member && posture?.kind === 'batting_invocation_posture' && score?.kind === 'batting_score_assessment'
      && emotion && intent?.kind === 'same_pa_batting_intent');
    const calibrations = (['batter_decision', 'batter_motor', 'batter_swing'] as const).map(route => {
      const id = 'team-retained:cut9:' + member.playerId + ':' + route;
      const r = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_calibrations WHERE source_id=?').get(id); assert.ok(r);
      return { route, calibrationReference: reference('pa_lifecycle_v1_execution_calibrations', JSON.parse(String(r.snapshot_json))) };
    });
    const declaration = { sourceId: 'team-retained:pitch3:input', sourceVersion: 'retained-resume-synthetic-prior-v1',
      capability: 'owned_in_flight_same_pa_batting_execution_input_v1', viewReference, member,
      postureReference: reference('batting_observation_v1_postures', posture), emotionReference: reference('batting_emotion_execution_v1_executions', emotion),
      intentReference: reference('batting_execution_v1_intents', intent), physicalPitchReference: first.physicalPitchReference,
      physicalOperationReference: basis.view.cut.physicalOperationReference, assessmentReferences: [reference('batting_score_v1_assessments', score)],
      calibrationReferences: calibrations, directive: 'SWING', expectedWorld: { careerId: basis.actor.binding.careerId,
        worldRevision: world.head.worldRevision, controlRevision: world.head.control.revision, controlHash: hash(world.head.control) } };
    if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published input collision');
    else published.set(declaration.sourceId, declaration);
    persistSourceMap(mapPath, published);
    const input = owner.acceptInput(declaration.sourceId);
    assert.equal(input.kind, 'same_pa_batting_input');
    if (input.kind !== 'same_pa_batting_input') throw new Error('original batting input admission pending');
    const reopened = openSqliteBattingExecutionInputStore(path);
    try { assert.deepEqual(reopened.readInput(declaration.sourceId), input); } finally { reopened.close(); }
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
    const resultReceipt = { status: 'PASS_EXPLICIT_FIXTURE_INPUT_ORIGINAL_OWNER_REOPEN', inputReference: reference('batting_execution_v1_inputs', input),
      authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
      originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
    writeFileSync(join(resumeDirectory, 'input-receipt.json'), JSON.stringify(resultReceipt, null, 2));
    console.log(JSON.stringify(resultReceipt));
  } finally { owner.close(); emotionOwner.close(); perception.close(); db.close(); }
}
if (mode === 'commitment') {
  const mapPath = join(resumeDirectory, 'accepted-sources.json'), published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true }), inputs = openSqliteBattingExecutionInputStore(path),
    owner = openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => published.get(id) });
  const started = Date.now();
  try {
    const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut9:view'); assert.ok(row);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(row.snapshot_json)));
    const basis = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
    const input = inputs.readInput('team-retained:pitch3:input'), intent = inputs.readIntent('team-native:pitch3:intent');
    assert.ok(input?.kind === 'same_pa_batting_input' && intent?.kind === 'same_pa_batting_intent');
    const declaration = { sourceId: 'team-retained:pitch3:commitment', sourceVersion: 'retained-resume-synthetic-prior-v1',
      capability: 'same_pa_physical_commitment_v1', viewReference, launchReference: first.physicalPitchReference,
      previousOperationReference: basis.view.cut.physicalOperationReference, inputReference: reference('batting_execution_v1_inputs', input),
      intentReference: reference('batting_execution_v1_intents', intent) };
    if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published commitment collision');
    else published.set(declaration.sourceId, declaration);
    persistSourceMap(mapPath, published);
    const commitment = owner.acceptOperation(declaration.sourceId);
    assert.equal(commitment.kind, 'same_pa_physical_commitment_v1');
    if (commitment.kind !== 'same_pa_physical_commitment_v1') throw new Error('original physical batting commitment admission pending');
    const commitmentReference = reference('pa_physical_v1_commitments', commitment);
    const reopened = openSqliteSamePlateAppearancePhysicalEpisodeStore(path);
    try { assert.deepEqual(reopened.readOperation(commitmentReference).record, commitment); } finally { reopened.close(); }
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
    const resultReceipt = { status: 'PASS_ACTUAL_PHYSICAL_BATTING_COMMITMENT_ORIGINAL_OWNER_REOPEN', commitmentReference,
      worldRevisionBefore: commitment.beforeWorldRevision, worldRevisionAfter: commitment.afterWorldRevision,
      authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
      originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
    writeFileSync(join(resumeDirectory, 'commitment-receipt.json'), JSON.stringify(resultReceipt, null, 2));
    console.log(JSON.stringify(resultReceipt));
  } finally { owner.close(); inputs.close(); db.close(); }
}
if (mode === 'resolution') {
  const mapPath = join(resumeDirectory, 'accepted-sources.json'), published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true }), owner = openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => published.get(id) });
  const started = Date.now();
  try {
    const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut10:view'); assert.ok(row);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(row.snapshot_json)));
    const basis = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
    const launch = owner.readOperation(first.physicalPitchReference).record;
    assert.equal(launch.kind, 'same_pa_physical_launch_v1');
    if (launch.kind !== 'same_pa_physical_launch_v1') throw new Error('original launch missing');
    assert.equal(basis.view.cut.physicalOperationReference.owner, 'pa_physical_v1_commitments');
    const declaration = { sourceId: 'team-retained:pitch3:resolution', sourceVersion: 'retained-resume-synthetic-prior-v1',
      capability: 'same_pa_physical_resolution_v1', viewReference, launchReference: first.physicalPitchReference,
      previousOperationReference: basis.view.cut.physicalOperationReference, commitmentReference: basis.view.cut.physicalOperationReference,
      throughTick: launch.trajectory.endTick };
    if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published resolution collision');
    else published.set(declaration.sourceId, declaration);
    persistSourceMap(mapPath, published);
    const resolution = owner.acceptOperation(declaration.sourceId);
    assert.equal(resolution.kind, 'same_pa_physical_resolution_v1');
    if (resolution.kind !== 'same_pa_physical_resolution_v1') throw new Error('original physical swing resolution admission pending');
    const resolutionReference = reference('pa_physical_v1_resolutions', resolution);
    const reopened = openSqliteSamePlateAppearancePhysicalEpisodeStore(path);
    try { assert.deepEqual(reopened.readOperation(resolutionReference).record, resolution); } finally { reopened.close(); }
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
    const resultReceipt = { status: 'PASS_ACTUAL_PHYSICAL_SWING_RESOLUTION_ORIGINAL_OWNER_REOPEN', resolutionReference,
      actualContact: resolution.contact !== null, resolutionKind: resolution.resolution.kind, evaluationTick: resolution.evaluationTick,
      authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
      originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
    writeFileSync(join(resumeDirectory, 'resolution-receipt.json'), JSON.stringify(resultReceipt, null, 2));
    console.log(JSON.stringify(resultReceipt));
  } finally { owner.close(); db.close(); }
}
if (mode === 'field-root') {
  const mapPath = join(resumeDirectory, 'accepted-sources.json'), published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true }), owner = openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => published.get(id) });
  const started = Date.now();
  try {
    const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut11:view'); assert.ok(row);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(row.snapshot_json)));
    const basis = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
    const resolutionRef = basis.view.cut.physicalOperationReference;
    assert.equal(resolutionRef.owner, 'pa_physical_v1_resolutions');
    const resolution = owner.readOperation({ ...resolutionRef, owner: 'pa_physical_v1_resolutions' }).record;
    assert.ok(resolution.kind === 'same_pa_physical_resolution_v1' && resolution.contact);
    const calibration = owner.readFieldCalibration('team-native:field:calibration');
    assert.ok(calibration?.kind === 'same_pa_physical_field_calibration_prepared_v1');
    const source = calibration.source, model = calibration.calibration.model;
    const declaration = { sourceId: 'team-retained:field:field-root', sourceVersion: 'retained-resume-synthetic-prior-v1',
      capability: 'same_pa_physical_field_root_v1', viewReference, launchReference: first.physicalPitchReference,
      previousOperationReference: resolutionRef, resolutionReference: resolutionRef, postureReference: source.postureReference,
      fieldInputs: { kind: 'fresh_physical_field_calibration_v1', calibrationReference: reference('pa_physical_v1_field_calibrations', calibration) },
      parameters: source.parameters, throughTick: resolution.contact.tick,
      commands: model.actors.map(a => ({ playerId: a.playerId, bodyAcceleration: { x: 0, y: 0, z: 0 },
        primitiveMotions: a.primitives.map(p => ({ role: p.role, offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } })) })) };
    if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published field-root collision');
    else published.set(declaration.sourceId, declaration);
    persistSourceMap(mapPath, published);
    const root = owner.acceptOperation(declaration.sourceId);
    assert.equal(root.kind, 'same_pa_physical_field_root_v1');
    if (root.kind !== 'same_pa_physical_field_root_v1') throw new Error('original physical field root admission pending');
    const fieldRootReference = reference('pa_physical_v1_field_roots', root);
    const reopened = openSqliteSamePlateAppearancePhysicalEpisodeStore(path);
    try { assert.deepEqual(reopened.readOperation(fieldRootReference).record, root); } finally { reopened.close(); }
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
    const resultReceipt = { status: 'PASS_ACTUAL_CONTACT_FIELD_ROOT_ORIGINAL_OWNER_REOPEN', fieldRootReference,
      actualContactTick: resolution.contact.tick, actorPrimitives: root.field.motion.actors.length,
      fieldResponseKind: root.field.motion.response.kind, authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
      originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
    writeFileSync(join(resumeDirectory, 'field-root-receipt.json'), JSON.stringify(resultReceipt, null, 2));
    console.log(JSON.stringify(resultReceipt));
  } finally { owner.close(); db.close(); }
}
if (mode === 'field-step' || /^defender-(observation|decision)-[0-8]$/.test(mode)) {
  const mapPath = join(resumeDirectory, 'accepted-sources.json'), published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true }), owner = openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => published.get(id) });
  const started = Date.now();
  try {
    const match = mode.match(/^defender-(observation|decision)-([0-8])$/), index = match ? Number(match[2]) : -1;
    const cut = mode === 'field-step' ? 12 : 13 + index * 2 + (match![1] === 'decision' ? 1 : 0);
    const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut' + cut + ':view'); assert.ok(row);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(row.snapshot_json)));
    const basis = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
    const rootRow = db.prepare('SELECT snapshot_json FROM pa_physical_v1_field_roots WHERE source_id=?').get('team-retained:field:field-root'); assert.ok(rootRow);
    const fieldRootReference = reference('pa_physical_v1_field_roots', JSON.parse(String(rootRow.snapshot_json)));
    const root = owner.readOperation(fieldRootReference).record;
    assert.ok(root.kind === 'same_pa_physical_field_root_v1');
    const previousReference = basis.view.cut.physicalOperationReference;
    assert.ok(previousReference.owner === 'pa_physical_v1_field_roots' || previousReference.owner === 'pa_physical_v1_field_steps');
    const proof = owner.readOperation({ ...previousReference, owner: previousReference.owner });
    const previous = proof.record;
    assert.ok(previous.kind === 'same_pa_physical_field_root_v1' || previous.kind === 'same_pa_physical_field_step_v1');
    let action: SamePaPhysicalFieldAction | undefined;
    if (match) {
      const policyPath = join(resumeDirectory, 'selected-policy.json');
      const moment = previous.field.motion.world.moment, cursor = previous.field.motion.cursor; assert.ok(cursor);
      const centerAt = (playerId: string) => {
        const body = previous.field.motion.actors.find(a => a.playerId === playerId && a.primitive.role === 'body'); assert.ok(body);
        const p = body.primitive, dt = (moment.originTick - p.startTick) / root.response.world.parameters.ticksPerSecond + moment.elapsedSeconds - (body.startElapsedSeconds ?? 0);
        return { x: p.startCenter.x + p.startVelocity.x * dt + 0.5 * p.acceleration.x * dt * dt,
          y: p.startCenter.y + p.startVelocity.y * dt + 0.5 * p.acceleration.y * dt * dt,
          z: p.startCenter.z + p.startVelocity.z * dt + 0.5 * p.acceleration.z * dt * dt };
      };
      if (!existsSync(policyPath)) {
        assert.equal(mode, 'defender-observation-0');
        const players = proof.actor.defenderBindings.map(b => ({ playerId: b.playerId,
          distance: Math.hypot(centerAt(b.playerId).x - cursor.moment.ball.position.x, centerAt(b.playerId).z - cursor.moment.ball.position.z) }))
          .sort((a, b) => a.distance - b.distance || a.playerId.localeCompare(b.playerId));
        assert.equal(players.length, 9);
        writeFileSync(policyPath, JSON.stringify({ sourceVersion: 'explicit-selected-policy-fixture-v1',
          basisReference: previousReference, selectionScope: 'accepted_individual_selected_only', players }, null, 2));
      }
      const policy = JSON.parse(readFileSync(policyPath, 'utf8')), playerId = String(policy.players[index].playerId);
      const member = basis.members.find(m => m.playerId === playerId); assert.ok(member);
      const route = match[1] === 'observation' ? 'defender_observation' : 'defender_decision';
      const calRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_calibrations WHERE source_id=?').get('team-retained:cut' + cut + ':' + playerId + ':' + route); assert.ok(calRow);
      const calibrationReference = reference('pa_lifecycle_v1_execution_calibrations', JSON.parse(String(calRow.snapshot_json)));
      if (match[1] === 'observation') {
        const center = centerAt(playerId);
        action = { kind: 'defender_observation_v1', member, calibrationReference, previousObservationReference: null,
          view: { poseVersion: 'actual-current-ball-directed-fixture-v1', bodyRelativeEyeOffset: { x: 0, y: 0.6, z: 0 },
            forward: { x: cursor.moment.ball.position.x - center.x, y: cursor.moment.ball.position.y - center.y - 0.6,
              z: cursor.moment.ball.position.z - center.z }, attentionTarget: { kind: 'ball' } } };
      } else {
        const observationRow = db.prepare('SELECT snapshot_json FROM pa_physical_v1_field_steps WHERE source_id=?').get('team-retained:field:defender-observation-' + index); assert.ok(observationRow);
        const observationReference = reference('pa_physical_v1_field_steps', JSON.parse(String(observationRow.snapshot_json)));
        const observation = owner.readOperation(observationReference).record;
        assert.ok(observation.kind === 'same_pa_physical_field_step_v1' && observation.actionResult?.kind === 'defender_observation_v1' && observation.actionResult.playerId === playerId);
        action = { kind: 'defender_decision_v1', member, calibrationReference, observationReference,
          priorities: { ballPursuitPriority: index === 0 ? 1 : 0, baseCoverPriorities: [], relayPriority: index === 1 ? 1 : 0,
            backupPriority: index === 2 ? 1 : 0, deepCoveragePriority: index === 3 ? 1 : 0, holdPriority: index >= 4 ? 1 : 0 },
          ...(index > 0 && index < 4 ? { supportGeometry: { kind: 'perceived_ball_support_geometry_v1', base: 1 } } : {}) };
      }
    }
    const declaration = { sourceId: 'team-retained:field:' + mode, sourceVersion: 'retained-resume-synthetic-prior-v1', capability: 'same_pa_physical_field_step_v1',
      viewReference, launchReference: first.physicalPitchReference, previousOperationReference: previousReference, fieldRootReference,
      previousFieldReference: previousReference, throughTick: mode === 'field-step' ? root.evaluationTick + 2_000_000 : previous.evaluationTick,
      ...(action ? { action } : {}) };
    if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published field-step collision');
    else published.set(declaration.sourceId, declaration);
    persistSourceMap(mapPath, published);
    const step = owner.acceptOperation(declaration.sourceId);
    assert.equal(step.kind, 'same_pa_physical_field_step_v1');
    if (step.kind !== 'same_pa_physical_field_step_v1') throw new Error('original physical field step admission pending');
    const stepReference = reference('pa_physical_v1_field_steps', step);
    const reopened = openSqliteSamePlateAppearancePhysicalEpisodeStore(path);
    try { assert.deepEqual(reopened.readOperation(stepReference).record, step); } finally { reopened.close(); }
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
    const resultReceipt = { status: 'PASS_ORIGINAL_FIELD_' + mode.toUpperCase() + '_OWNER_REOPEN', stepReference,
      evaluationTick: step.evaluationTick, actionResultKind: step.actionResult?.kind ?? null,
      actorPrimitives: step.field.motion.actors.length, authorityMapHash: sha(readFileSync(mapPath)), elapsedMilliseconds: Date.now() - started,
      originalDatabaseBytesUnchanged: true, originalSources20BytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
    writeFileSync(join(resumeDirectory, mode + '-receipt.json'), JSON.stringify(resultReceipt, null, 2)); console.log(JSON.stringify(resultReceipt));
  } finally { owner.close(); db.close(); }
}
if (mode === 'decision-checkpoint') {
  // Freeze the accepted individual selection lineage before grouped motion.
  // This artifact is for a distinct future candidate/team Source experiment;
  // it does not turn these nine singleton selections into full-candidate AI.
  const mapPath = join(resumeDirectory, 'accepted-sources.json');
  const mapBytes = readFileSync(mapPath), sourceMap = new Map<string, unknown>(JSON.parse(mapBytes.toString('utf8')));
  const db = new DatabaseSync(path, { readOnly: true });
  let references: ReturnType<typeof reference<'pa_physical_v1_field_steps'>>[], viewReference: ReturnType<typeof reference<'pa_lifecycle_v1_execution_views'>>;
  try {
    assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'delete', 'snapshot copy requires a closed rollback-journal database');
    const viewRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut31:view'); assert.ok(viewRow);
    viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(viewRow.snapshot_json)));
    const current = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
    assert.equal(current.view.cut.physicalOperationReference.sourceId, 'team-retained:field:defender-decision-8');
    references = Array.from({ length: 9 }, (_, index) => {
      const id = 'team-retained:field:defender-decision-' + index;
      const row = db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM pa_physical_v1_field_steps WHERE source_id=?').get(id); assert.ok(row);
      assert.equal(hash(sourceMap.get(id)), row.source_hash);
      assert.deepEqual(JSON.parse(String(row.source_json)), sourceMap.get(id));
      assert.equal(hash(JSON.parse(String(row.snapshot_json))), row.snapshot_hash);
      return reference('pa_physical_v1_field_steps', JSON.parse(String(row.snapshot_json)));
    });
  } finally { db.close(); }
  const snapshotDirectory = join(directory, 'accepted-nine-decisions-checkpoint');
  assert.ok(!existsSync(snapshotDirectory), 'fixed checkpoint already exists; do not overwrite a prior lineage');
  mkdirSync(snapshotDirectory);
  const snapshotPath = join(snapshotDirectory, 'accepted-nine-decisions.sqlite'), sourcePath = join(snapshotDirectory, 'accepted-sources.json');
  const databaseHash = sha(readFileSync(path));
  copyFileSync(path, snapshotPath, constants.COPYFILE_EXCL); copyFileSync(mapPath, sourcePath, constants.COPYFILE_EXCL);
  assert.equal(sha(readFileSync(path)), databaseHash); assert.equal(sha(readFileSync(snapshotPath)), databaseHash);
  assert.equal(sha(readFileSync(sourcePath)), sha(mapBytes));
  const manifest = { status: 'FIXED_SNAPSHOT_CAPTURED_ORIGINAL_OWNER_REOPEN_PENDING', snapshotPath, sourcePath,
    databaseHash, authorityMapHash: sha(mapBytes), sourceCount: sourceMap.size, viewReference, decisionReferences: references,
    selectionScope: 'accepted_individual_selected_only', groupedMotionIssued: false, teamExecutionCredit: 0, officialResult: null };
  writeFileSync(join(snapshotDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2)); console.log(JSON.stringify(manifest));
  const reader = new DatabaseSync(snapshotPath, { readOnly: true }), started = Date.now();
  try {
    const proofs = references.map(ref => withSqliteReadTransaction(reader, () => readSamePaPhysicalOperationFromSqlite(reader, ref)));
    assert.equal(new Set(proofs.map(p => {
      assert.ok(p.record.kind === 'same_pa_physical_field_step_v1' && p.record.actionResult?.kind === 'defender_decision_v1');
      assert.equal(hash(p.record), p.reference.snapshotHash); return p.record.actionResult.playerId;
    })).size, 9);
    const result = { ...manifest, status: 'PASS_FIXED_NINE_DECISIONS_ORIGINAL_OWNER_INDEPENDENT_REOPEN',
      elapsedMilliseconds: Date.now() - started };
    writeFileSync(join(snapshotDirectory, 'reopen-receipt.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { reader.close(); }
  assert.equal(sha(readFileSync(snapshotPath)), databaseHash);
  assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
}
if (/^checkpoint-reopen-[0-8]$/.test(mode) || mode === 'checkpoint-finalize') {
  // A bounded per-actor fallback if the single read-only all-nine rederivation
  // outlives its child budget. Reuse the exact immutable artifact; never rebuild
  // the expensive admitted Source prefix or overwrite its fixed manifest.
  const snapshotDirectory = join(directory, 'accepted-nine-decisions-checkpoint');
  const manifest = JSON.parse(readFileSync(join(snapshotDirectory, 'manifest.json'), 'utf8'));
  assert.equal(manifest.selectionScope, 'accepted_individual_selected_only');
  assert.equal(manifest.decisionReferences.length, 9);
  assert.equal(sha(readFileSync(manifest.snapshotPath)), manifest.databaseHash);
  assert.equal(sha(readFileSync(manifest.sourcePath)), manifest.authorityMapHash);
  if (mode !== 'checkpoint-finalize') {
    const index = Number(mode.slice('checkpoint-reopen-'.length)), pin = manifest.decisionReferences[index];
    const reader = new DatabaseSync(manifest.snapshotPath, { readOnly: true }), started = Date.now();
    try {
      const proof = withSqliteReadTransaction(reader, () => readSamePaPhysicalOperationFromSqlite(reader, pin));
      assert.ok(proof.record.kind === 'same_pa_physical_field_step_v1' && proof.record.actionResult?.kind === 'defender_decision_v1');
      assert.equal(hash(proof.record), pin.snapshotHash);
      const result = { status: 'PASS_FIXED_ORIGINAL_DECISION_INDEPENDENT_OWNER_REOPEN', index, decisionReference: pin,
        playerId: proof.record.actionResult.playerId, recordHash: hash(proof.record), databaseHash: manifest.databaseHash,
        authorityMapHash: manifest.authorityMapHash, elapsedMilliseconds: Date.now() - started, teamExecutionCredit: 0, officialResult: null };
      const receiptPath = join(snapshotDirectory, 'actor-' + index + '-reopen-receipt.json');
      assert.ok(!existsSync(receiptPath), 'preserve the prior per-actor readback receipt');
      writeFileSync(receiptPath, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
    } finally { reader.close(); }
  } else {
    const receipts = Array.from({ length: 9 }, (_, index) => {
      const value = JSON.parse(readFileSync(join(snapshotDirectory, 'actor-' + index + '-reopen-receipt.json'), 'utf8'));
      assert.equal(value.status, 'PASS_FIXED_ORIGINAL_DECISION_INDEPENDENT_OWNER_REOPEN'); assert.equal(value.index, index);
      assert.deepEqual(value.decisionReference, manifest.decisionReferences[index]);
      assert.equal(value.recordHash, manifest.decisionReferences[index].snapshotHash);
      assert.equal(value.databaseHash, manifest.databaseHash); assert.equal(value.authorityMapHash, manifest.authorityMapHash); return value;
    });
    assert.equal(new Set(receipts.map(r => r.playerId)).size, 9);
    const result = { ...manifest, status: 'PASS_FIXED_NINE_DECISIONS_ORIGINAL_OWNER_INDEPENDENT_REOPEN',
      perActorReadbackReceipts: receipts.map(r => 'actor-' + r.index + '-reopen-receipt.json') };
    assert.ok(!existsSync(join(snapshotDirectory, 'reopen-receipt.json')), 'preserve the prior complete checkpoint receipt');
    writeFileSync(join(snapshotDirectory, 'reopen-receipt.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  }
  assert.equal(sha(readFileSync(manifest.snapshotPath)), manifest.databaseHash);
  assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
}
if (mode === 'due-wait' || mode === 'motion') {
  assert.ok(existsSync(join(directory, 'accepted-nine-decisions-checkpoint', 'reopen-receipt.json')),
    'freeze and independently reopen all nine accepted decisions before motion');
  const mapPath = join(resumeDirectory, 'accepted-sources.json'), published = new Map<string, unknown>(JSON.parse(readFileSync(mapPath, 'utf8')));
  const db = new DatabaseSync(path, { readOnly: true }), owner = openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedOperation: id => published.get(id) });
  const started = Date.now();
  try {
    const hasDueCut = mode === 'motion' && !!db.prepare('SELECT 1 FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut32:view');
    const cut = hasDueCut ? 32 : 31;
    const viewRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut' + cut + ':view'); assert.ok(viewRow);
    const viewReference = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(viewRow.snapshot_json)));
    const basis = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference));
    const previousFieldReference = basis.view.cut.physicalOperationReference;
    assert.equal(previousFieldReference.owner, 'pa_physical_v1_field_steps');
    const previous = owner.readOperation({ ...previousFieldReference, owner: 'pa_physical_v1_field_steps' }).record;
    assert.ok(previous.kind === 'same_pa_physical_field_step_v1');
    const decisions = Array.from({ length: 9 }, (_, index) => {
      const row = db.prepare('SELECT snapshot_json FROM pa_physical_v1_field_steps WHERE source_id=?').get('team-retained:field:defender-decision-' + index); assert.ok(row);
      const decisionReference = reference('pa_physical_v1_field_steps', JSON.parse(String(row.snapshot_json)));
      const decision = owner.readOperation(decisionReference).record;
      assert.ok(decision.kind === 'same_pa_physical_field_step_v1' && decision.actionResult?.kind === 'defender_decision_v1');
      return { decisionReference, result: decision.actionResult };
    });
    const dueTick = Math.max(...decisions.map(d => d.result.calculation.scheduling.movementStartTick));
    if (mode === 'due-wait' && dueTick <= previous.evaluationTick) {
      const result = { status: 'PASS_NINE_DECISIONS_ALREADY_DUE_NO_NEW_OPERATION', dueTick,
        currentTick: previous.evaluationTick, waitAdmitted: false, teamExecutionCredit: 0, officialResult: null };
      writeFileSync(join(resumeDirectory, 'due-wait-receipt.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
    } else {
      assert.ok(mode === 'due-wait' || dueTick <= previous.evaluationTick, 'wait for the real owned movement-start cut first');
      const action: SamePaPhysicalFieldAction | undefined = mode === 'motion' ? { kind: 'defender_motion_v1', selections: decisions.map(d => {
        const member = basis.members.find(m => m.playerId === d.result.playerId); assert.ok(member);
        const row = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_calibrations WHERE source_id=?')
          .get('team-retained:cut' + cut + ':' + member.playerId + ':defender_locomotion'); assert.ok(row);
        return { member, decisionReference: d.decisionReference,
          calibrationReference: reference('pa_lifecycle_v1_execution_calibrations', JSON.parse(String(row.snapshot_json))) };
      }) } : undefined;
      const declaration = { sourceId: 'team-retained:field:' + mode, sourceVersion: 'retained-resume-synthetic-prior-v1',
        capability: 'same_pa_physical_field_step_v1' as const, viewReference, launchReference: first.physicalPitchReference,
        previousOperationReference: { ...previousFieldReference, owner: 'pa_physical_v1_field_steps' as const },
        fieldRootReference: previous.source.fieldRootReference,
        previousFieldReference: { ...previousFieldReference, owner: 'pa_physical_v1_field_steps' as const },
        // A 100 ms owned coverage request makes real displacement observable.
        // Any earlier actual collision boundary remains the original owner's cut.
        throughTick: mode === 'due-wait' ? dueTick : previous.evaluationTick + 100_000, ...(action ? { action } : {}) };
      if (published.has(declaration.sourceId)) assert.equal(hash(published.get(declaration.sourceId)), hash(declaration), 'published grouped field collision');
      else published.set(declaration.sourceId, declaration);
      persistSourceMap(mapPath, published);
      if (mode === 'motion') {
        const dispatch = openSqliteSamePlateAppearanceTeamCoverageDispatch(path, { readAcceptedOperation: id => published.get(id) });
        try {
          const preparation = dispatch.prepare(declaration), execution = dispatch.accept(declaration.sourceId, preparation);
          const reopened = openSqliteSamePlateAppearanceTeamCoverageDispatch(path);
          try { assert.deepEqual(reopened.read(execution.motionReference), execution); } finally { reopened.close(); }
          assert.equal(execution.actors.length, 9); assert.ok(execution.bodiesMoved);
          const result = { ...execution, independentlyReopened: true, requestedCoverageTicks: 100_000,
            elapsedMilliseconds: Date.now() - started, fullCandidateTacticalIntegration: false,
            baseCoverIntegration: 'not_exercised_requires_visible_original_handler_commitment' };
          writeFileSync(join(resumeDirectory, 'motion-receipt.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
        } finally { dispatch.close(); }
      } else {
        const step = owner.acceptOperation(declaration.sourceId); assert.ok(step.kind === 'same_pa_physical_field_step_v1');
        const stepReference = reference('pa_physical_v1_field_steps', step), reopened = openSqliteSamePlateAppearancePhysicalEpisodeStore(path);
        try { assert.deepEqual(reopened.readOperation(stepReference).record, step); } finally { reopened.close(); }
        const result = { status: 'PASS_ACTUAL_NINE_DECISION_DUE_WAIT_ORIGINAL_OWNER_REOPEN', stepReference, dueTick,
          evaluationTick: step.evaluationTick, waitAdmitted: true, dueReached: step.evaluationTick >= dueTick,
          elapsedMilliseconds: Date.now() - started, teamExecutionCredit: 0, officialResult: null };
        writeFileSync(join(resumeDirectory, 'due-wait-receipt.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
      }
    }
    assert.equal(sha(readFileSync(originalPath)), preservedOriginalHash);
    assert.equal(sha(readFileSync(join(directory, 'accepted-sources-0.json'))), sha(sourceBytes));
  } finally { owner.close(); db.close(); }
}

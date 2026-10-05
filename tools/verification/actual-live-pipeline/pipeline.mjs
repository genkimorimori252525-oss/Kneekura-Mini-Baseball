import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { appendFileSync, existsSync, fstatSync, mkdirSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';
import { fileURLToPath } from 'node:url';
import { assertClosedMainFile, fileHash, jsonRead, openSqliteHandles, requireAbsolute, requireHash, verifySource, writeNewJson } from './pipeline-common.mjs';

const NEXT_TAKE = { action: { kind: 'take' }, plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 };
const [mode, configPathArg] = process.argv.slice(2);
assert(['--run', '--import-check'].includes(mode), 'use --run or --import-check with an absolute config path');
const configPath = requireAbsolute(configPathArg, 'config path'), c = jsonRead(configPath);
assert.equal(c.schema, 'actual_artifact_pipeline_run_v2');
const sourceRoot = requireAbsolute(c.sourceRoot, 'sourceRoot');
assert.equal(realpathSync(dirname(fileURLToPath(import.meta.url))), realpathSync(join(sourceRoot, 'tools/verification/actual-live-pipeline')),
  'the executed wrapper must belong to the frozen Source cut');
const configSha256 = fileHash(configPath);
if (mode === '--run') {
  assert.equal(Number(process.versions.node.split('.')[0]), 26);
  assert.equal(configSha256, process.env.BASEBALL_PIPELINE_CONFIG_SHA256, 'supervisor and execution configuration differ');
  const heapLimitMiB = getHeapStatistics().heap_size_limit / 1024 / 1024;
  const nativeLocks = [[8, '/workspace/shared/baseball-native-aux-check.lock'], [9, '/workspace/shared/baseball-native-check.lock']].map(([fd, path]) => {
    assert.equal(readlinkSync(`/proc/self/fd/${fd}`), path, 'execution process must retain the inherited Native lock');
    const actual = fstatSync(fd), named = statSync(path);
    assert.equal(actual.dev, named.dev); assert.equal(actual.ino, named.ino);
    return { fd, path, device: actual.dev, inode: actual.ino };
  });
  const executingProcess = { at: new Date().toISOString(), pid: process.pid, ppid: process.ppid, role: 'standalone-vite-node-helper-execution',
    node: process.version, execArgv: process.execArgv, inheritedNodeOptions: process.env.NODE_OPTIONS,
    requestedOldSpaceMiB: c.runtime.oldSpaceMiB, heapLimitMiB, nativeLocks, memory: process.memoryUsage(), nodeSha256: fileHash(process.execPath) };
  writeNewJson(join(`${requireAbsolute(c.runDirectory, 'runDirectory')}.runtime`, 'executing-process.json'), executingProcess);
  assert.equal(process.env.BASEBALL_PIPELINE_OLD_SPACE_MIB, String(c.runtime.oldSpaceMiB));
  assert.equal(heapLimitMiB, c.runtime.expectedHeapLimitMiB, 'actual execution-process heap differs');
  assert.equal(executingProcess.nodeSha256, c.runtime.nodeSha256);
}
const checkSource = () => verifySource(c.sourceManifestPath, c.sourceManifestSha256, sourceRoot, c.sourceCommit);
const sourceIdentity = checkSource();
const loadHelpers = async () => {
  const official = await import(`${sourceRoot}/src/host/world/ActualLiveOfficialArtifact.test-support.ts`);
  const role = await import(`${sourceRoot}/src/host/world/ActualRoleWorkloadArtifact.test-support.ts`);
  const next = await import(`${sourceRoot}/src/host/world/ActualLiveNextActorArtifact.test-support.ts`);
  assert.equal(typeof official.verifyActualLiveOfficialArtifact, 'function');
  assert.equal(typeof role.verifyActualRoleWorkloadArtifact, 'function');
  assert.equal(typeof next.verifyActualLiveNextActorArtifact, 'function');
  return { official: official.verifyActualLiveOfficialArtifact, role: role.verifyActualRoleWorkloadArtifact, next: next.verifyActualLiveNextActorArtifact };
};

if (mode === '--import-check') {
  await loadHelpers(); checkSource();
  console.log(JSON.stringify({ kind: 'import_check_passed', sourceIdentity, artifactHelpersExecuted: 0, nativeArtifactsOpened: 0 }));
} else {
  assert.equal(Number(process.versions.node.split('.')[0]), 26, 'scheduled artifact execution requires Node 26');
  const physicalPath = realpathSync(requireAbsolute(c.physicalArtifactPath, 'physicalArtifactPath'));
  const proofPath = realpathSync(requireAbsolute(c.physicalEvidencePath, 'physicalEvidencePath'));
  requireHash(c.physicalArtifactSha256, 'physicalArtifactSha256'); requireHash(c.physicalEvidenceSha256, 'physicalEvidenceSha256');
  assert.equal(fileHash(physicalPath), c.physicalArtifactSha256); assert.equal(fileHash(proofPath), c.physicalEvidenceSha256);
  assertClosedMainFile(physicalPath);
  assert(typeof c.physicalEndSourceId === 'string' && c.physicalEndSourceId.trim() === c.physicalEndSourceId && c.physicalEndSourceId.length);
  assert.equal(c.nextBatterPlayerId, 'away-2');
  assert.deepEqual(c.nextTake, NEXT_TAKE);
  assert.equal(c.faultChecks, true); assert.equal(c.executeNextPitch, true);
  const runDirectory = requireAbsolute(c.runDirectory, 'runDirectory');
  assert(!existsSync(runDirectory), 'fresh run directory required; failed runs are never silently retried');
  mkdirSync(runDirectory, { recursive: true });
  const at = () => new Date().toISOString(), started = performance.now();
  const paths = {
    official: join(runDirectory, '01-official.sqlite'), role: join(runDirectory, '02-role-workload.sqlite'), next: join(runDirectory, '03-next-actor-pitch.sqlite'),
  };
  const counts = { officialStarted: 0, officialCompleted: 0, roleStarted: 0, roleCompleted: 0, nextStarted: 0, nextCompleted: 0 };
  const phaseReceipts = [], allArtifactPaths = [physicalPath, ...Object.values(paths), `${paths.role}.stale.sqlite`, `${paths.role}.recovery.sqlite`];
  const progress = (stage, message, details = {}) => {
    const value = { at: at(), stage, elapsedSeconds: (performance.now() - started) / 1000, message, details };
    appendFileSync(join(runDirectory, 'phases.jsonl'), `${JSON.stringify(value)}\n`); console.log(JSON.stringify(value));
  };
  const auditInputs = () => {
    const source = checkSource();
    assert.equal(fileHash(physicalPath), c.physicalArtifactSha256); assert.equal(fileHash(proofPath), c.physicalEvidenceSha256);
    assert.equal(fileHash(configPath), configSha256); return source;
  };
  writeNewJson(join(runDirectory, 'input.json'), { config: c, configSha256, sourceIdentity, node: { version: process.version, path: process.execPath, sha256: fileHash(process.execPath) },
    helperScope: 'existing_owned_artifact_helpers', originalPhysicalArtifact: { path: physicalPath, sha256: c.physicalArtifactSha256, evidencePath: proofPath, evidenceSha256: c.physicalEvidenceSha256 },
    fixtureInputs: { nextBatterPlayerId: c.nextBatterPlayerId, nextTake: NEXT_TAKE, faultChecks: true, executeNextPitch: true }, startedAt: at() });
  let stage = 'startup';
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
  const assertNoGlobalPrepareSpy = () => {
    const prepare = DatabaseSync.prototype.prepare;
    assert(!Object.getOwnPropertyDescriptor(prepare, 'mock') && !prepare._isMockFunction,
      'global prepare spies retain unrelated native statements; use the reviewed scoped write witness');
  };
  const diskFacts = path => {
    assertClosedMainFile(path);
    const sha256 = fileHash(path), db = new DatabaseSync(path, { readOnly: true });
    let facts;
    try {
      const main = db.prepare('PRAGMA database_list').all().find(r => r.name === 'main');
      assert.equal(main.file, path); assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => String(r.name));
      const rowCounts = Object.fromEntries(tables.map(name => [name, Number(db.prepare(`SELECT count(*) AS n FROM "${name.replaceAll('"', '""')}"`).get().n)]));
      const activities = tables.includes('world_player_workload_activities') ? db.prepare("SELECT json_extract(source_json,'$.kind') AS kind,count(*) AS n FROM world_player_workload_activities GROUP BY kind ORDER BY kind").all().map(row => ({ kind: String(row.kind), n: Number(row.n) })) : [];
      facts = { path, sha256, realDisk: true, mainFilename: main.file, journalMode: 'wal', rowCounts, workloadActivityKinds: activities };
    } finally { db.close(); }
    assertClosedMainFile(path); assert.equal(fileHash(path), sha256);
    return { ...facts, wrapperReadOnlyOpenClosedVerified: true };
  };
  const rowDelta = (before, after, table) => (after.rowCounts[table] ?? 0) - (before.rowCounts[table] ?? 0);
  const requireCommon = result => {
    assert.equal(result.sourceUnchanged, true); assert.equal(result.realDisk, true); assert.equal(result.wal, true); assert.equal(result.allConnectionsClosedReopened, true);
  };
  const receipt = (name, value) => {
    const path = join(runDirectory, `${name}.receipt.json`); writeNewJson(path, { schema: 'actual_artifact_stage_receipt_v1', status: 'passed',
      at: at(), elapsedSeconds: (performance.now() - started) / 1000, originalPhysicalArtifactSha256: c.physicalArtifactSha256,
      physicalEndSourceId: c.physicalEndSourceId, sourceIdentity, counts: { ...counts }, ...value });
    const sealed = { stage: name, path, sha256: fileHash(path) };
    phaseReceipts.push(sealed); progress(name, 'phase receipt persisted', { receipt: sealed });
  };
  try {
    const helpers = await loadHelpers();
    assertNoGlobalPrepareSpy();
    const physical = diskFacts(physicalPath);
    assert.equal(physical.rowCounts.actual_first_base_play_ends, 1, 'expected one physical end in bounded input');
    assert.equal(physical.rowCounts.actual_live_play_fences, 1, 'expected one physical seal in bounded input');
    assert.equal(physical.rowCounts.world_player_workload_activities ?? 0, 0);
    writeNewJson(join(runDirectory, 'physical-input-census.json'), physical);

    stage = 'official'; progress(stage, 'executing existing official helper'); counts.officialStarted++;
    const official = await helpers.official({ sourcePath: physicalPath, destinationPath: paths.official, physicalEndSourceId: c.physicalEndSourceId, faultChecks: true, progress: message => progress(stage, message) });
    counts.officialCompleted++; requireCommon(official); auditInputs();
    assertNoGlobalPrepareSpy();
    assert.deepEqual(official.faultEvidence, { adjudicationDependencyAfterInsert: true, officialApplicationAfterInsert: true });
    assert.equal(official.adjudicationEvidence.physicalEndReference.owner, 'actual_first_base_play_ends');
    assert.equal(official.adjudicationEvidence.physicalEndReference.sourceId, c.physicalEndSourceId);
    assert.equal(official.exactlyOnceOfficialApplication, true); assert.equal(official.actualRoleWorkloadStillPending, true);
    const officialDisk = diskFacts(paths.official);
    assert.equal(official.sourceSha256, physical.sha256); assert.equal(official.destinationSha256, officialDisk.sha256);
    assert.equal(rowDelta(physical, officialDisk, 'applications'), 1);
    assert.equal(rowDelta(physical, officialDisk, 'physical_pitch_progress_actions'), 0);
    assert.equal(official.result.scoring.kind, 'unsupported');
    receipt('01-official', { input: physical, output: officialDisk, closureSourceId: official.closureSourceId, applicationId: official.applicationId,
      officialReceipt: official.result.official.receipt, retiredControllerCount: official.result.controllerReset.retired.length,
      originalTableHashes: official.originalTableHashes, scoring: official.result.scoring, workload: official.result.workload,
      faultEvidence: official.faultEvidence, adjudicationEvidence: official.adjudicationEvidence,
      executed: { helperCalls: 1, newOfficialApplications: 1, newPhysicalPitchActions: 0 }, syntheticFixturePolicy: true, faultChecks: true });

    stage = 'role'; progress(stage, 'executing existing all-ten workload helper'); counts.roleStarted++;
    const role = await helpers.role({ sourcePath: paths.official, destinationPath: paths.role, closureSourceId: official.closureSourceId, faultChecks: true, progress: message => progress(stage, message) });
    counts.roleCompleted++; requireCommon(role); auditInputs();
    assertNoGlobalPrepareSpy();
    assert.deepEqual(role.faultEvidence, { assessmentAfterInsert: true, freezeAfterInsert: true, workloadAfterInsert: true,
      staleCurrentHeadRejected: true, interruptedAfterFirstInsert: true });
    assert.equal(fileHash(paths.official), officialDisk.sha256);
    assert.equal(role.participantCount, 10); assert.equal(role.settlement.kind, 'complete'); assert.equal(role.exactlyOnce, true);
    assert.equal(role.playableArtifactRecoveryActivities, 0); assert.equal(role.playableHeadsEqualFrozenAfter, true);
    assert.equal(role.automaticEffortGeneration, false); assert.equal(role.syntheticFixtureInputs, true);
    assert.deepEqual(role.acceptedInputManifest.assessments.map(value => value.effortUnits), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(role.acceptedInputManifest.assessments.map(value => value.participantReference.playerId), role.settlement.participants.map(value => value.playerId));
    assert.deepEqual(role.acceptedInputManifest.baselineEvidence.map(value => value.source.playerId), role.settlement.participants.map(value => value.playerId));
    assert.equal(role.acceptedInputManifest.baselineEvidence.length, 10);
    assert.equal(role.acceptedInputManifest.addedBaselines.length + role.acceptedInputManifest.retainedBaselinePlayerIds.length, 10);
    for (const baseline of role.acceptedInputManifest.addedBaselines) {
      assert.equal(baseline.createdAtDay, role.settlement.gameDay); assert.equal(baseline.fatigue, 0.1); assert.equal(baseline.recoveryCapacity, 0.5);
      assert.deepEqual(baseline.policy, { policyId: 'explicit-role-workload-fixture', version: 'fixture-v1', availableAtDay: 0,
        workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 });
    }
    const roleDisk = diskFacts(paths.role);
    assert.equal(role.sourceSha256, officialDisk.sha256); assert.equal(role.destinationSha256, roleDisk.sha256);
    assert.equal(rowDelta(officialDisk, roleDisk, 'world_player_workload_activities'), 10);
    assert.equal(rowDelta(officialDisk, roleDisk, 'physical_pitch_progress_actions'), 0);
    assert.deepEqual(roleDisk.workloadActivityKinds, [{ kind: 'MATCH', n: 10 }]);
    const recoveryDisk = diskFacts(role.recoveryRegression.path), staleDisk = diskFacts(`${paths.role}.stale.sqlite`);
    receipt('02-role-workload', { input: officialDisk, output: roleDisk, settlement: role.settlement,
      faultEvidence: role.faultEvidence, acceptedInputManifest: role.acceptedInputManifest,
      executed: { helperCalls: 1, participantSettlements: role.settlement.participants.filter(p => p.applied).length, newMatchWorkloadActivities: 10, newPhysicalPitchActions: 0 },
      syntheticFixtureInputs: true, automaticEffortGeneration: false, playableArtifactRecoveryActivities: 0,
      recoveryRegression: { ...role.recoveryRegression, disk: recoveryDisk }, staleCasRegression: { disk: staleDisk }, faultChecks: true });

    stage = 'next'; progress(stage, 'executing next actor and real physical take helper'); counts.nextStarted++;
    const next = await helpers.next({ sourcePath: paths.role, destinationPath: paths.next, closureSourceId: official.closureSourceId,
      nextBatterPlayerId: 'away-2', faultChecks: true, executeNextPitch: true, nextTake: NEXT_TAKE, progress: message => progress(stage, message) });
    counts.nextCompleted++; requireCommon(next); auditInputs();
    assertNoGlobalPrepareSpy();
    assert.deepEqual(next.faultEvidence, { wrongActivationRejected: true, actorReadinessAfterInsert: true });
    assert.equal(fileHash(paths.official), officialDisk.sha256); assert.equal(fileHash(paths.role), roleDisk.sha256);
    assert.equal(next.nextPitchExecuted, true); assert.equal(next.exactlyOnceActorAdmission, true); assert.equal(next.autonomousLineupSelection, false);
    assert.equal(next.nextBatterSelection, 'explicit_fixture_input'); assert.equal(next.actor.source.playerId, 'away-2');
    const nextDisk = diskFacts(paths.next);
    assert.equal(next.sourceSha256, roleDisk.sha256); assert.equal(next.destinationSha256, nextDisk.sha256);
    assert.equal(rowDelta(roleDisk, nextDisk, 'physical_plate_appearance_actors'), 1);
    assert.equal(rowDelta(roleDisk, nextDisk, 'physical_pitch_progress_actions'), 1);
    assert.equal(rowDelta(roleDisk, nextDisk, 'world_player_workload_activities'), 0);
    const pitch = next.nextPitch;
    assert.deepEqual(pitch.source.request.batter, NEXT_TAKE);
    receipt('03-next-actor-pitch', { input: roleDisk, output: nextDisk, actor: next.actor,
      faultEvidence: next.faultEvidence,
      pitch: { source: pitch.source, progressRevision: pitch.progressRevision, gameId: pitch.frame.gameId, playId: pitch.frame.match.playId,
        actorSourceId: pitch.frame.batterActor.source.sourceId, workload: pitch.frame.workload, beforeEventCount: pitch.beforeTimeline.events.length,
        afterEventCount: pitch.result.pitch.resolution.timeline.events.length, timeline: pitch.result.pitch.resolution.timeline },
      executed: { helperCalls: 1, newActorAdmissions: 1, newPhysicalPitchActions: 1, newWorkloadActivities: 0 },
      nextBatterSelection: 'explicit_fixture_input', autonomousLineupSelection: false, scoringStillUnsupported: true,
      physicalWorldRecoveryProven: false, faultChecks: true });
    assert.deepEqual(openSqliteHandles(allArtifactPaths), []);
    assert.deepEqual(counts, { officialStarted: 1, officialCompleted: 1, roleStarted: 1, roleCompleted: 1, nextStarted: 1, nextCompleted: 1 });
    writeNewJson(join(runDirectory, 'terminal.json'), { status: 'passed', at: at(), elapsedSeconds: (performance.now() - started) / 1000,
      sourceIdentity: auditInputs(), counts, phaseReceipts, openSqliteHandles: [], physicalSourceUnchanged: true,
      sourceCutUnchanged: true, scoringStillUnsupported: true, autonomousLineupSelection: false, automaticEffortGeneration: false,
      recoveryOnlyOnIsolatedCopy: true, elapsedWorldRecoveryTimeProven: false, newPhysicalPitchActions: 1,
      testScope: 'standalone real helper execution; no test discovery or skipped-test inference' });
    progress('terminal', 'all three artifact stages passed');
  } catch (error) {
    let inputAudit; try { inputAudit = { passed: true, sourceIdentity: auditInputs() }; } catch (e) { inputAudit = { passed: false, error: String(e) }; }
    writeNewJson(join(runDirectory, 'terminal.json'), { status: 'failed', stage, at: at(), counts, phaseReceipts, inputAudit,
      openSqliteHandles: openSqliteHandles(allArtifactPaths), error: { name: error?.name, message: error?.message, stack: error?.stack } });
    console.error(error); process.exitCode = 1;
  }
}

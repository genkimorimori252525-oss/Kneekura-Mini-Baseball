import { installScalarSqliteCounters as readCounters } from './SqliteScalarCounters.test-support';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, existsSync, fsyncSync, mkdtempSync, openSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { clearKnownFirstBaseTrapOnDisposableCopy, knownFirstBaseSealTrapSql } from './ActualFirstBaseArtifactGuards.test-support';
import { openSqliteActualFirstBasePlayEndStore, actualFirstBaseEndArchiveEncoding } from './SqliteActualFirstBasePlayEndStore';
import { ownedScheduledWholeHistoryArchiveEncoding } from './OwnedScheduledMotionArchive';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import type { DatabaseSync } from 'node:sqlite';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualFirstBasePlayEndInput } from './ActualFirstBasePlayEnd';
const inputs = () => {
  const input = process.env.BASEBALL_KNOWN_PROFILE_PRE_END_DB, inputHash = process.env.BASEBALL_KNOWN_PROFILE_PRE_END_SHA256;
  const manifestPath = process.env.BASEBALL_KNOWN_PROFILE_INPUT_MANIFEST, manifestHash = process.env.BASEBALL_KNOWN_PROFILE_INPUT_MANIFEST_SHA256;
  const sourceCommit = process.env.BASEBALL_KNOWN_PROFILE_SOURCE_COMMIT, sourceManifestSha256 = process.env.BASEBALL_KNOWN_PROFILE_SOURCE_MANIFEST_SHA256;
  const constructionHash = process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_SHA256, constructionTerminalHash = process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_RECEIPT_SHA256;
  const constructionSourceCommit = process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_SOURCE_COMMIT, constructionSourceManifestSha256 = process.env.BASEBALL_KNOWN_PROFILE_CONSTRUCTION_SOURCE_MANIFEST_SHA256;
  if (!input || !manifestPath || !inputHash?.match(/^[a-f0-9]{64}$/) || !manifestHash?.match(/^[a-f0-9]{64}$/)
    || !sourceCommit?.match(/^[a-f0-9]{40}$/) || !sourceManifestSha256?.match(/^[a-f0-9]{64}$/)
    || !constructionHash?.match(/^[a-f0-9]{64}$/) || !constructionTerminalHash?.match(/^[a-f0-9]{64}$/)
    || !constructionSourceCommit?.match(/^[a-f0-9]{40}$/) || !constructionSourceManifestSha256?.match(/^[a-f0-9]{64}$/)) throw new Error('explicit fresh known-profile input/manifest/Source pins required');
  const bytes = readFileSync(manifestPath); expect(sha(bytes)).toBe(manifestHash);
  const manifest = JSON.parse(bytes.toString('utf8')) as { schema: string; ruleProfileId: string; ruleProfileSha256: string;
    originalConstructionDatabaseSha256: string; originalConstructionTerminalSha256: string; originalConstructionSourceCommit: string; originalConstructionSourceManifestSha256: string; databaseSha256: string; physicalEndRows: number; sealRows: number; uncheckpointedWalBytes: number;
    request: Parameters<typeof actualFirstBasePlayEndInput>[0]; futureDecisionSourceId: string; tables: ReturnType<typeof fingerprints> };
  expect(manifest.schema).toBe('synthetic_first_base_known_profile_pre_end_fixture_v1'); expect(manifest.databaseSha256).toBe(inputHash);
  expect(manifest.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id); expect(manifest.ruleProfileSha256).toBe(actorHash(NPB_2026_RULE_PROFILE));
  expect(manifest.originalConstructionDatabaseSha256).toBe(constructionHash); expect(manifest.originalConstructionTerminalSha256).toBe(constructionTerminalHash);
  expect(manifest.originalConstructionSourceCommit).toBe(constructionSourceCommit); expect(manifest.originalConstructionSourceManifestSha256).toBe(constructionSourceManifestSha256);
  expect(manifest.physicalEndRows).toBe(0); expect(manifest.sealRows).toBe(0); expect(manifest.uncheckpointedWalBytes).toBe(0);
  const request = actualFirstBasePlayEndInput(manifest.request, 'physical-end');
  expect(request.sourceId).toBe('physical-end'); expect(manifest.futureDecisionSourceId).toBe('scheduled-decision-home-2');
  return { input: resolve(input), inputHash, manifestPath: resolve(manifestPath), manifestHash, manifest, request, sourceCommit, sourceManifestSha256 };
};
const writeNew = (path: string, value: unknown) => { const fd = openSync(path, 'wx');
  try { writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fsyncSync(fd); } finally { closeSync(fd); } };
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const phase = (name: string) => {
  const value = { time: new Date().toISOString(), phase: name, ...process.memoryUsage() };
  console.info('known-profile-end-acceptance', name);
  if (process.env.BASEBALL_KNOWN_PROFILE_PHASE_LOG) appendFileSync(process.env.BASEBALL_KNOWN_PROFILE_PHASE_LOG, `${JSON.stringify(value)}\n`);
};
const fingerprints = (db: DatabaseSync) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all().map(row => {
    const name = String(row.name), hashes: string[] = [];
    for (const value of db.prepare(`SELECT * FROM ${quote(name)}`).iterate()) hashes.push(sha(JSON.stringify(value)));
    return { name, count: hashes.length, logicalRowsHash: sha(JSON.stringify(hashes.sort())) };
  });
const originals = (values: ReturnType<typeof fingerprints>) => values.filter(row => !['actual_first_base_play_ends', 'actual_live_play_fences'].includes(row.name));
const emptyTerminal = (db: DatabaseSync) => {
  expect(db.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends').get()!.n).toBe(0);
  expect(db.prepare('SELECT count(*) AS n FROM actual_live_play_fences').get()!.n).toBe(0);
};

// Raw input sanity only. The acceptance case still invokes every concrete owner proof.
it.runIf(!!process.env.BASEBALL_KNOWN_PROFILE_PRE_END_DB)('checks the fresh known-profile pre-end manifest and original npb-2026 lineage without replaying domain owners', () => {
  const { input: path, inputHash, manifest, request } = inputs();
  expect(sha(readFileSync(path))).toBe(inputHash);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    emptyTerminal(db); expect(fingerprints(db)).toEqual(manifest.tables);
    expect(JSON.parse(String(db.prepare('SELECT state_json FROM matches WHERE match_id=?').get('game-1')!.state_json)).ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
    expect(JSON.parse(String(db.prepare('SELECT snapshot_json FROM physical_pitch_progress_actions WHERE source_id=?').get('pitch-0')!.snapshot_json)).frame.match.ruleProfileId).toBe(NPB_2026_RULE_PROFILE.id);
    const ids = [ ['actual_live_play_runtimes', request.runtimeSourceId], ['batted_world_field_actions', request.baseFieldSourceId],
      ['batted_world_field_executions', request.executionSourceId], ['actual_live_rule_consumptions', request.ruleConsumptionSourceId],
      ['actual_first_base_umpire_calls', request.umpireCallSourceId], ['actual_call_communications', request.communicationSourceId],
      ['batted_world_field_executions', 'field-first-base-race'], ['batted_world_field_executions', 'actual-call-due-cut'],
      ['actual_first_base_umpire_observations', 'play-end-umpire-observation'], ['actual_defensive_decisions', 'scheduled-decision-home-2'] ];
    for (const [table, id] of ids) {
      const rows = db.prepare(`SELECT source_id,source_json,source_hash,snapshot_hash FROM ${quote(table)} WHERE source_id=?`).all(id);
      expect(rows).toHaveLength(1); expect(JSON.parse(String(rows[0].source_json)).sourceId).toBe(id);
      expect(rows[0].source_hash).toMatch(/^[0-9a-f]{64}$/); expect(rows[0].snapshot_hash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(db.prepare('SELECT snapshot_hash FROM actual_defensive_decisions WHERE source_id=?').get(manifest.futureDecisionSourceId)!.snapshot_hash).toMatch(/^[a-f0-9]{64}$/);
  } finally { db.close(); }
  expect(sha(readFileSync(path))).toBe(inputHash);
  expect(existsSync(`${path}-wal`) ? statSync(`${path}-wal`).size : 0).toBe(0);
});

it.runIf(!!process.env.BASEBALL_KNOWN_PROFILE_PRE_END_DB)('witnesses a fresh seal INSERT rollback, accepts the same known-profile original chain, and closes/reopens/retries before exporting', async () => {
  const { input, inputHash, manifest, request, sourceCommit, sourceManifestSha256, manifestHash } = inputs();
  const output = process.env.BASEBALL_KNOWN_PROFILE_ENDED_OUTPUT_DB, witnessPath = process.env.BASEBALL_KNOWN_PROFILE_SEAL_WITNESS;
  if (!output || !witnessPath || existsSync(output) || existsSync(witnessPath)) throw new Error('fresh known-profile output and witness paths required');
  expect(sha(readFileSync(input))).toBe(inputHash);
  expect(existsSync(`${input}-wal`) ? statSync(`${input}-wal`).size : 0).toBe(0);
  const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const path = join(mkdtempSync(join(tmpdir(), 'native-first-base-acceptance-')), 'state.sqlite');
  const source = new DatabaseSync(input, { readOnly: true });
  try { await backup(source, path); } finally { source.close(); }
  const db = new DatabaseSync(path), counters = readCounters(db); let dbClosed = false;
  let store: ReturnType<typeof openSqliteActualFirstBasePlayEndStore> | null = null;
  try {
    expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    expect(fingerprints(db)).toEqual(manifest.tables); emptyTerminal(db);
    phase(`copied pinned pre-end chain ${path}`);
    expect(clearKnownFirstBaseTrapOnDisposableCopy(db)).toBe('absent');
    const before = originals(fingerprints(db));
    const ref = (table: string, id: string) => db.prepare(`SELECT source_hash,snapshot_hash,snapshot_json FROM ${quote(table)} WHERE source_id=?`).get(id)!;
    const runtime = JSON.parse(String(ref('actual_live_play_runtimes', request.runtimeSourceId).snapshot_json));
    const rule = ref('batted_world_field_executions', 'field-first-base-race');
    const due = ref('batted_world_field_executions', 'actual-call-due-cut');
    const tail = ref('batted_world_field_executions', request.executionSourceId);
    const called = ref('actual_first_base_umpire_calls', request.umpireCallSourceId);
    const perceived = ref('actual_first_base_umpire_observations', 'play-end-umpire-observation');
    const future = ref('actual_defensive_decisions', 'scheduled-decision-home-2');
    const originalCall = JSON.parse(String(called.snapshot_json)), originalObservation = JSON.parse(String(perceived.snapshot_json));
    store = openSqliteActualFirstBasePlayEndStore(path, { readAcceptedEnd: id => id === request.sourceId ? request : null });
    db.exec(knownFirstBaseSealTrapSql);
    let observedInsert: { endRows: number; sealRows: number; dependencySnapshotHash: string } | null = null;
    const witnessedSql = 'INSERT INTO actual_live_play_fences VALUES(?,?,?,?)';
    const witness = witnessSqliteWrite(witnessedSql, connection => {
      const value = { endRows: Number(connection.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends WHERE source_id=?').get(request.sourceId)!.n),
        sealRows: Number(connection.prepare('SELECT count(*) AS n FROM actual_live_play_fences WHERE closure_source_id=?').get(request.sourceId)!.n),
        dependencySnapshotHash: String(connection.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(request.executionSourceId)!.snapshot_hash) };
      if (value.endRows !== 1 || value.sealRows !== 1 || value.dependencySnapshotHash !== 'changed-during-seal') return false;
      observedInsert = value; return true;
    });
    phase('begin fresh same-attempt seal INSERT rollback proof');
    try {
      expect(() => store!.accept(request.sourceId)).toThrow(/archive|identity|original|owner|snapshot|admitted source/);
      expect(witness.wasReached()).toBe(true); expect(observedInsert).not.toBeNull();
    } finally { witness.close(); expect(clearKnownFirstBaseTrapOnDisposableCopy(db)).toBe('removed_known_trap'); }
    emptyTerminal(db); const afterRollback = originals(fingerprints(db)); expect(afterRollback).toEqual(before);
    writeNew(witnessPath, { schema: 'known_profile_seal_insert_rollback_v1', sourceCommit, sourceManifestSha256,
      fixtureRuleProfileId: NPB_2026_RULE_PROFILE.id, inputSha256: inputHash, inputManifestSha256: manifestHash,
      request, actualWorkerPid: process.pid, witnessedSql, observedInsert,
      endRowsAfterRollback: Number(db.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends').get()!.n),
      sealRowsAfterRollback: Number(db.prepare('SELECT count(*) AS n FROM actual_live_play_fences').get()!.n),
      beforeOriginalTables: before, afterOriginalTables: afterRollback,
      beforeOriginalTablesSha256: sha(JSON.stringify(before)), afterOriginalTablesSha256: sha(JSON.stringify(afterRollback)) });
    phase('fresh seal INSERT witnessed; exact original rows restored; clean acceptance begins');
    const ended = store.accept(request.sourceId); phase('physical end committed; final reopen proof still pending');
    expect(ended.kind).toBe('ended'); expect(ended.registry.resolution).toMatchObject({ kind: 'ended', reason: 'all_offense_terminal' });
    expect(ended.wholeHistory.end).toEqual({ kind: 'unestablished' });
    expect(ended.wholeHistoryHash).toBe(ownedScheduledWholeHistoryArchiveEncoding(ended.wholeHistory, ended.physicalPitchSourceId, ended.gameId).hash);
    expect(ended.generation.producerIds).toHaveLength(70); expect(ended.generation.bodyBaseHistoryHashes).toHaveLength(40);
    expect(ended.exactEnd.elapsedSeconds).toBe(ended.generation.boundary.lastIncludedElapsedSeconds);
    expect(ended.registry.frontier.physical).toHaveLength(10);
    expect(ended.futureWork.controllers).toHaveLength(10); expect(ended.futureWork.communication).toHaveLength(10);
    expect(ended.futureWork.communication.every(value => value.dueTick > ended.playEnd.tick)).toBe(true);
    expect(ended.futureWork.controllerDecisions).toHaveLength(1);
    const retained = ended.futureWork.controllerDecisions![0];
    expect(retained.decisionSourceId).toBe('scheduled-decision-home-2'); expect(retained.decisionHash).toBe(future.snapshot_hash);
    expect(retained.work.cut.executionSourceId).toBe('field-first-base-race'); expect(retained.work.deadlines.decision.tick).toBeGreaterThan(ended.playEnd.tick);
    expect(ended.registry.frontier.actors.find(actor => actor.actorId === retained.work.playerId)).toEqual({ actorId: retained.work.playerId,
      kind: 'decision_pending', dueTick: retained.work.deadlines.decision.tick });
    expect(ended.registry.frontier.actors.filter(actor => actor.actorId !== retained.work.playerId).every(actor => actor.kind === 'acting')).toBe(true);
    const producerId = runtime.membership.producers.find((value: { domain: string; playerId?: string }) =>
      value.domain === 'actor_decision' && value.playerId === retained.work.playerId)!.producerId;
    expect(ended.registry.registry.sources.find(value => value.sourceId === producerId)).toMatchObject({
      decisions: retained.work.source.decisions, queue: { nextPendingTick: retained.work.deadlines.decision.tick } });
    expect(ended.operativeRetirement).toMatchObject({ kind: 'retired', causeCallSourceId: request.umpireCallSourceId });
    expect(originalCall.schedule.kind).toBe('called'); expect(originalCall.schedule.call).toBe('out');
    expect(originalCall.currentExecutionHash).toBe(due.snapshot_hash);
    expect(ended.exactEnd.elapsedSeconds).toBeGreaterThan(originalCall.schedule.calledAtElapsedSeconds);
    expect(originalCall.schedule.calledAtElapsedSeconds).toBe(originalObservation.availability.elapsedSeconds + originalObservation.setup.calibration.callDelaySeconds);
    expect(originalObservation.setup.calibration.callDelaySeconds).toBeGreaterThan(0);
    const refs = ended.operativeCallReferences;
    expect(refs.ruleEvidence).toMatchObject({ sourceId: 'field-first-base-race', sourceHash: rule.source_hash, snapshotHash: rule.snapshot_hash });
    expect(refs.call).toMatchObject({ sourceId: 'operative-call', sourceHash: called.source_hash, snapshotHash: called.snapshot_hash });
    expect(refs.perception).toMatchObject({ sourceId: 'play-end-umpire-observation', snapshotHash: perceived.snapshot_hash });
    expect(ended.finalRuleReference).toMatchObject({ sourceId: 'field-first-base-race', snapshotHash: rule.snapshot_hash });
    const applicable = ended.firstBaseEvidenceApplicability;
    expect(applicable).toMatchObject({ version: 'owned_first_base_evidence_applicability_v1', rule: refs.ruleEvidence, call: refs.call,
      from: originalObservation.availability, through: ended.exactEnd, coverage: 'no_new_rule_relevant_physical_or_base_facts',
      fence: { owner: 'actual_first_base_play_ends', sourceId: request.sourceId } });
    expect(applicable.physicalSuffix.map(value => [value.sourceId, value.snapshotHash])).toEqual([
      ['actual-call-due-cut', due.snapshot_hash], ['actual-post-call-quantizer-tail', tail.snapshot_hash] ]);
    expect(applicable.bodyBaseHistoryHashes).toEqual(ended.generation.bodyBaseHistoryHashes);
    expect(originals(fingerprints(db))).toEqual(before);
    expect(db.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends').get()!.n).toBe(1);
    expect(db.prepare('SELECT count(*) AS n FROM actual_live_play_fences').get()!.n).toBe(1);
    const expected = actualFirstBaseEndArchiveEncoding(ended).hash, completedRows = fingerprints(db);
    store.close(); store = null; db.close(); dbClosed = true; phase('all original connections closed; reopening end owner');
    const reopened = openSqliteActualFirstBasePlayEndStore(path);
    try {
      expect(actualFirstBaseEndArchiveEncoding(reopened.read(request.sourceId)!).hash).toBe(expected);
      expect(actualFirstBaseEndArchiveEncoding(reopened.accept(request.sourceId)).hash).toBe(expected);
    } finally { reopened.close(); }
    const check = new DatabaseSync(path, { readOnly: true });
    try { expect(fingerprints(check)).toEqual(completedRows); } finally { check.close(); }
    phase('end owner reopened and retried unchanged');
    counters.close();
    const pendingOutput = `${output}.partial-${process.pid}`;
    if (existsSync(pendingOutput)) throw new Error('temporary output artifact path already exists');
    const finished = new DatabaseSync(path, { readOnly: true });
    try { await backup(finished, pendingOutput); } finally { finished.close(); }
    const exported = new DatabaseSync(pendingOutput, { readOnly: true });
    try {
      expect(exported.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
      expect(exported.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(resolve(pendingOutput));
      expect(exported.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
      expect(fingerprints(exported)).toEqual(completedRows);
    } finally { exported.close(); }
    expect(sha(readFileSync(input))).toBe(inputHash);
    expect(existsSync(`${input}-wal`) ? statSync(`${input}-wal`).size : 0).toBe(0);
    expect(existsSync(`${pendingOutput}-wal`) ? statSync(`${pendingOutput}-wal`).size : 0).toBe(0);
    expect(JSON.parse(readFileSync(witnessPath, 'utf8')).sourceCommit).toBe(sourceCommit);
    renameSync(pendingOutput, output);
    phase(`verified closed ended backup ${output}`);
  } finally {
    try { store?.close(); }
    finally { try { if (!dbClosed) db.close(); }
      finally { try { counters.close(); }
        finally { if (process.env.BASEBALL_KNOWN_PROFILE_SQL_COUNTER_OUTPUT) writeFileSync(process.env.BASEBALL_KNOWN_PROFILE_SQL_COUNTER_OUTPUT, `${JSON.stringify(counters.report(), null, 2)}\n`); } } }
  }
}, 7_200_000);

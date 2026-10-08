import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { constants, copyFileSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createPlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { prepareTerminalWorkloadCopy, acceptedTerminalWorkloadFixturePacket, expectedActivity, requireTerminalWorkload,
  cleanupTerminalWorkload, observeTerminalWorkloadConnectionChanges, type TerminalWorkloadStore } from './ActualFoulTerminalRoleWorkloadFixture.test-support';

// SQLite rows have null prototypes; persisted evidence equality is wire-data equality.
const same = (actual: unknown, expected: unknown) => assert.equal(json(actual), json(expected));
type Pin = Readonly<{ path: string; sha256: string }>;
type Candidate = Readonly<{ version: 'terminal_workload_ready_checkpoint_candidate_v1'; checkpoint: Pin; layoutReceipt: Pin;
  producerConfig: Pin; producerCase: string }>;
const qualifiedCase = 'W09 qualifies an original-owner-produced pre-charge workload checkpoint without rewriting it';
const qualifiedFile = 'src/host/world/ActualFoulTerminalRoleWorkloadCheckpoint.acceptance.ts';
const canonical = (path: string) => {
  assert(isAbsolute(path) && normalize(path) === path && realpathSync(path) === path && lstatSync(path).isFile(), 'checkpoint pin must be a canonical regular file');
};
const pinnedJson = (pin: Pin) => { canonical(pin.path); assert.equal(fileHash(pin.path), pin.sha256); return JSON.parse(readFileSync(pin.path, 'utf8')); };
const noSidecars = (path: string) => {
  canonical(path);
  for (const suffix of ['-wal', '-shm', '-journal']) {
    try { lstatSync(path + suffix); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    throw new Error('checkpoint source has a sidecar');
  }
};
const candidateFromEnvironment = (): Candidate => {
  assert(process.env.BASEBALL_GATE_RUNTIME && process.env.BASEBALL_GATE_LOCKS, 'checkpoint requires an admitted private runtime');
  const path = process.env.TERMINAL_WORKLOAD_CHECKPOINT_INPUT; assert(path, 'checkpoint manifest missing'); canonical(path);
  const value = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(value.version, 'terminal_workload_ready_checkpoint_candidate_v1');
  assert.equal(value.producerCase, 'W03 prerequisite assessment INSERT corruption rolls back the entire owned write');
  const config = pinnedJson(value.producerConfig);
  assert.equal(config.sourceIdentity.head, '4ab120f8aa0c8f99e5127339115b4c155c911a7c');
  assert(config.cases.some((c: { name: string; status: string }) => c.name === value.producerCase && c.status === 'passed'));
  // The producing grouped stage is not credited here. This independently
  // qualifies bytes left by its actual owner path and all expected row deltas.
  return value;
};
const prepareCandidateCopy = async (candidate: Candidate) => {
  const f = prepareTerminalWorkloadCopy(); let store: TerminalWorkloadStore | undefined;
  let accounting: ReturnType<typeof observeTerminalWorkloadConnectionChanges> | undefined;
  try {
    const packet = acceptedTerminalWorkloadFixturePacket(f), original = rawCensus(f.db), originalSchema = schemaCensus(f.db);
    const expected = original.map(owner => ({ ...owner, rows: owner.rows.map(row => ({ ...row })) }));
    const table = (name: string) => expected.find(owner => owner.table === name)!.rows;
    const append = (name: string, row: Record<string, string | number>) => {
      const rows = table(name); rows.push({ __ack_rowid: Math.max(0, ...rows.map(row => Number(row.__ack_rowid))) + 1, ...row });
    };
    for (const source of packet.baselines.values()) {
      const initial = createPlayerWorkloadRecovery({ careerId: source.careerId, playerId: source.playerId, createdAtDay: source.createdAtDay,
        fatigue: source.fatigue, recoveryCapacity: source.recoveryCapacity, policy: source.policy });
      const policy = table('world_player_workload_policies').find(row => row.career_id === source.careerId
        && row.policy_id === source.policy.policyId && row.version === source.policy.version);
      if (policy) assert.equal(policy.policy_json, json(source.policy));
      else append('world_player_workload_policies', { career_id: source.careerId, policy_id: source.policy.policyId,
        version: source.policy.version, policy_json: json(source.policy) });
      append('world_player_workload_baselines', { source_id: source.sourceId, career_id: source.careerId,
        player_id: source.playerId, source_json: json(source), initial_json: json(initial) });
      append('world_player_workload_heads', { career_id: source.careerId, player_id: source.playerId, revision: 0, state_json: json(initial) });
    }
    for (const source of packet.assessments.values()) {
      const actor = f.actors.find(a => a.binding.playerId === source.participantReference.playerId)!;
      const value = { source, careerId: f.reference.careerId, gameId: f.reference.gameId, playId: f.reference.playId,
        playerId: actor.binding.playerId, actor, activity: expectedActivity(f, source) };
      append('actual_role_workload_assessments', { source_id: source.sourceId, closure_source_id: f.sourceId,
        career_id: value.careerId, game_id: value.gameId, play_id: value.playId, player_id: value.playerId,
        source_json: json(source), source_hash: hash(source), snapshot_json: json(value), snapshot_hash: hash(value) });
    }
    const layout = pinnedJson(candidate.layoutReceipt);
    assert.equal(layout.version, 'terminal_workload_private_layout_v1');
    assert.equal(layout.retainedSha256, f.retainedSha256);
    same(layout.afterSchema, originalSchema);
    assert.equal(layout.destinationPath, candidate.checkpoint.path);
    noSidecars(candidate.checkpoint.path); assert.equal(fileHash(candidate.checkpoint.path), candidate.checkpoint.sha256);
    const destination = join(f.directory, 'ready-workload.sqlite');
    copyFileSync(candidate.checkpoint.path, destination, constants.COPYFILE_EXCL);
    assert.equal(fileHash(destination), candidate.checkpoint.sha256);
    noSidecars(candidate.checkpoint.path); assert.equal(fileHash(candidate.checkpoint.path), candidate.checkpoint.sha256);
    f.links.close(); f.db.close();
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    accounting = observeTerminalWorkloadConnectionChanges();
    f.path = destination; f.db = new DatabaseSync(destination); f.links = openSqlitePlayerPersonLinkStore(destination);
    const schema = schemaCensus(f.db);
    same(schema, { ...originalSchema, mainVersion: Number(originalSchema.mainVersion) + 2 });
    same(rawCensus(f.db), expected);
    const api = await requireTerminalWorkload();
    same(withSqliteReadTransaction(f.db, () => api.context(f.db, f.sourceId)), { terminal: f.saved, actors: f.actors, reference: f.reference });
    withSqliteReadTransaction(f.db, () => {
      for (const actor of f.actors) {
        const row = table('world_player_workload_heads').find(row => row.career_id === f.reference.careerId && row.player_id === actor.binding.playerId)!;
        same(readActualRoleWorkloadState(f.db, f.reference.careerId, actor.binding.playerId, undefined, actor.binding.personLinkSourceId), JSON.parse(String(row.state_json)));
      }
    });
    store = api.open(destination, f.links);
    const pending = { ...f.reference, kind: 'pending', missingAssessments: [], missingBaselines: [], reason: 'settlement_not_frozen' };
    same(store.readSettlement(f.sourceId), pending);
    store.acceptAssessments([...packet.assessments.keys()]);
    same(store.readSettlement(f.sourceId), pending);
    same(rawCensus(f.db), expected); same(schemaCensus(f.db), schema);
    accounting.assertUnchanged(); accounting.close(); accounting = undefined;
    store.close(); store = undefined;
    noSidecars(candidate.checkpoint.path); assert.equal(fileHash(candidate.checkpoint.path), candidate.checkpoint.sha256);
    assert.equal(fileHash(f.retainedPath), f.retainedSha256);
    const receipt = { version: 'terminal_workload_ready_checkpoint_copy_v1', sourceSha256: candidate.checkpoint.sha256,
      originalAcknowledgedSha256: f.retainedSha256, referenceHash: hash(f.reference), rowsHash: hash(expected), schemaHash: hash(schema),
      noWrites: true, originalUnchanged: true };
    writeFileSync(join(f.directory, 'ready-workload-copy-receipt.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
    return { f, receipt };
  } catch (error) {
    try { accounting?.close(); } finally { cleanupTerminalWorkload(f, store); } throw error;
  }
};
export const qualifyTerminalWorkloadCheckpoint = () => prepareCandidateCopy(candidateFromEnvironment());
export const prepareTerminalWorkloadReadyCopy = async () => {
  const path = process.env.TERMINAL_WORKLOAD_CHECKPOINT_INPUT; assert(path, 'qualified checkpoint manifest missing'); canonical(path);
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(manifest.version, 'terminal_workload_ready_checkpoint_qualified_v1');
  const candidate = pinnedJson(manifest.candidate), config = pinnedJson(manifest.config), terminal = pinnedJson(manifest.terminal), report = pinnedJson(manifest.report);
  assert.equal(candidate.version, 'terminal_workload_ready_checkpoint_candidate_v1');
  assert.equal(config.schema, 'baseball_fresh_stage_v1'); assert.equal(config.released, true); assert.equal(config.expectedExitCode, 0);
  assert.equal(terminal.schema, 'baseball_fresh_terminal_v1'); assert.equal(terminal.status, 'passed');
  assert.equal(terminal.configSha256, manifest.config.sha256); assert.equal(terminal.stage, config.stage);
  assert.equal(manifest.terminal.path, join(config.runDirectory, 'terminal.json'));
  assert.equal(manifest.report.path, join(config.runDirectory, 'vitest.json'));
  same(terminal.failures, []); same(terminal.cancelSignals, []); same(terminal.remainingOwnedProcesses, []);
  assert.equal(terminal.originalChildExit, 0); same(terminal.after, terminal.before);
  for (const group of ['source', 'dependencies', 'controls', 'runtime']) assert.equal(terminal.before[group].sha256, config.inputs[group].sha256);
  for (const pin of [manifest.candidate, candidate.checkpoint, candidate.layoutReceipt, candidate.producerConfig]) {
    assert(terminal.before.controls.entries.some((row: unknown) => json(row) === json([pin.path, 'file', pin.sha256])), 'checkpoint qualification omitted a pinned input');
  }
  assert(terminal.ownedIdentities.length > 0);
  for (const identity of terminal.ownedIdentities) {
    const exits = terminal.groupChildExits.filter((exit: { identity: unknown }) => json(exit.identity) === json(identity));
    assert.equal(exits.length, 1); assert.equal(exits[0].exitCode, 0); assert.equal(exits[0].rawWaitStatus, 0);
  }
  assert.equal(terminal.tests.passedCases, 1); assert.equal(terminal.tests.expectedFailedCases, 0); same(terminal.tests.skipped, []);
  assert.equal(terminal.tests.reportSha256, manifest.report.sha256);
  same(config.cases, [{ file: qualifiedFile, name: qualifiedCase, status: 'passed' }]);
  assert.equal(config.artifactEnvironment.TERMINAL_WORKLOAD_CHECKPOINT_INPUT, manifest.candidate.path);
  assert(config.inputs.controls.files.includes(candidate.checkpoint.path));
  assert.equal(report.success, true); assert.equal(report.numPassedTests, 1); assert.equal(report.numFailedTests, 0);
  assert.equal(report.numTotalTests, 1); assert.equal(report.numPendingTests, 0); assert.equal(report.numTodoTests, 0);
  assert.equal(report.testResults.length, 1); assert.equal(report.testResults[0].name, join(config.inputs.source.root, qualifiedFile));
  assert.equal(report.testResults[0].assertionResults.length, 1);
  assert.equal(report.testResults[0].assertionResults[0].fullName, qualifiedCase); assert.equal(report.testResults[0].assertionResults[0].status, 'passed');
  const result = await prepareCandidateCopy(candidate); return result.f;
};

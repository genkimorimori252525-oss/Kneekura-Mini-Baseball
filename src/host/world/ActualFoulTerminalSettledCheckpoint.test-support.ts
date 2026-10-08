import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import type { DatabaseSync as Database } from 'node:sqlite';
import { createPlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import type { FoulTerminalApplicationProposal } from './ActualFoulTerminalApplication';
import type { TerminalWorkloadPlan } from './ActualFoulTerminalRoleWorkloadFixture.test-support';
import { constants, copyFileSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize } from 'node:path';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { prepareRetainedTerminalAcknowledgementCopy } from './ActualFoulTerminalAcknowledgementRetained.test-support';
import { workloadTables } from './ActualFoulTerminalRoleWorkloadFixture.test-support';

type Pin = Readonly<{ path: string; sha256: string }>;
const manifestHash = '4e662ef1981dd9ad2861aa3045b5607b9ec4276ce979ebb16ed47c1110056aae';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b));
const canonical = (path: string) => assert(isAbsolute(path) && normalize(path) === path
  && realpathSync(path) === path && lstatSync(path).isFile(), 'settled input must be a canonical regular file');
const pinnedJson = (pin: Pin) => {
  canonical(pin.path); const bytes = readFileSync(pin.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256);
  return JSON.parse(bytes.toString('utf8'));
};
export const noSettledCheckpointSidecars = (path: string) => {
  canonical(path);
  for (const suffix of ['-wal','-shm','-journal']) {
    try { lstatSync(path + suffix); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    throw new Error('settled checkpoint has an unexpected sidecar: ' + suffix);
  }
};

/** The old W02 producer is evidence only for the pinned old production. This
 * helper authenticates its closed lineage and makes a new exclusive copy. It
 * does not certify the current workload owner, settle, or rewrite any row. */
export const prepareRetainedTerminalSettledCopy = () => {
  assert(process.env.BASEBALL_GATE_RUNTIME && process.env.BASEBALL_GATE_LOCKS, 'settled checkpoint requires admitted private controls');
  const path = process.env.TERMINAL_POSTPLAY_SETTLED_INPUT; assert(path, 'settled checkpoint manifest missing');
  const input = pinnedJson({ path, sha256: manifestHash });
  assert.equal(input.version, 'terminal_workload_settled_w02_input_v1');
  assert.equal(input.sourceProductionCommitByExactBytes, '4ab120f8aa0c8f99e5127339115b4c155c911a7c');
  assert.equal(input.sourceSrcTreeByExactBytes, '416ec9d5784848837ba521751d0a4940bc83ba27');
  assert.equal(input.sourceId, 'terminal-application');
  const config = pinnedJson(input.config), terminal = pinnedJson(input.terminal), report = pinnedJson(input.report);
  const layout = pinnedJson(input.layoutReceipt);
  const producerLogPath = join(config.runDirectory, 'output.log'); canonical(producerLogPath);
  assert.equal(fileHash(producerLogPath), '70acfb62698e57905d8c67d71e5814886104933933dfc810249470888b1835d7');
  const producerLog = readFileSync(producerLogPath, 'utf8');
  const logWitness = 'stdout | ' + input.qualifiedCase.file + ' > ' + input.qualifiedCase.name
    + '\nTERMINAL_ACKNOWLEDGEMENT_RETAINED_PRIVATE_ARTIFACT=' + dirname(input.artifact.path);
  assert.equal(producerLog.split(logWitness).length, 2, 'sole exact W02 artifact attribution is required');
  for (const pin of input.lineageControlPins as Pin[]) { canonical(pin.path); assert.equal(fileHash(pin.path), pin.sha256); }
  same(config.sourceIdentity, input.recordedSourceIdentity);
  assert.equal(config.schema, 'baseball_fresh_stage_v1'); assert.equal(config.released, true); assert.equal(config.expectedExitCode, 0);
  assert.equal(terminal.schema, 'baseball_fresh_terminal_v1'); assert.equal(terminal.status, 'passed');
  assert.equal(terminal.configSha256, input.config.sha256); assert.equal(terminal.stage, config.stage);
  assert.equal(input.terminal.path, join(config.runDirectory, 'terminal.json'));
  assert.equal(input.report.path, join(config.runDirectory, 'vitest.json'));
  same(terminal.failures, []); same(terminal.cancelSignals, []); same(terminal.remainingOwnedProcesses, []);
  assert.equal(terminal.originalChildExit, 0); same(terminal.after, terminal.before);
  for (const group of ['source','dependencies','controls','runtime']) {
    assert.equal(terminal.before[group].sha256, config.inputs[group].sha256);
    assert.equal(terminal.before[group].sha256, input.admittedInputGroupHashes[group]);
  }
  same(terminal.before.controls.entries.map((entry: unknown[]) => ({ path: entry[0], sha256: entry[2] })), input.lineageControlPins);
  assert(terminal.ownedIdentities.length > 0);
  for (const identity of terminal.ownedIdentities) {
    const exits = terminal.groupChildExits.filter((exit: { identity: unknown }) => json(exit.identity) === json(identity));
    assert.equal(exits.length, 1); assert.equal(exits[0].exitCode, 0); assert.equal(exits[0].rawWaitStatus, 0);
  }
  assert.equal(terminal.tests.passedCases, 3); assert.equal(terminal.tests.expectedFailedCases, 0); same(terminal.tests.skipped, []);
  assert.equal(terminal.tests.reportSha256, input.report.sha256);
  assert.equal(report.success, true); assert.equal(report.numPassedTests, 3); assert.equal(report.numFailedTests, 0);
  assert.equal(report.numTotalTests, 3); assert.equal(report.numPendingTests, 0); assert.equal(report.numTodoTests, 0);
  const actualCases = report.testResults.flatMap((suite: { name: string; assertionResults: { fullName: string; status: string; failureMessages: unknown[] }[] }) =>
    suite.assertionResults.map(c => { same(c.failureMessages, []); return { file: suite.name.slice(config.inputs.source.root.length + 1), name: c.fullName, status: c.status }; }));
  same(actualCases.map(json).sort(), config.cases.map(json).sort());
  assert.equal(input.qualifiedCase.file, 'src/host/world/ActualFoulTerminalRoleWorkload.acceptance.ts');
  assert.equal(input.qualifiedCase.name, 'W02 genuine terminal TOTALs charge all ten original participants once and conserve the pending origin');
  assert.equal(actualCases.filter((c: { file: string; name: string; status: string }) => c.file === input.qualifiedCase.file
    && c.name === input.qualifiedCase.name && c.status === 'passed').length, 1);
  assert.equal(input.originalAcknowledgedManifest.path, process.env.TERMINAL_PENDING_CUTOVER_INPUT);
  assert.equal(config.artifactEnvironment.TERMINAL_PENDING_CUTOVER_INPUT, input.originalAcknowledgedManifest.path);
  pinnedJson(input.originalAcknowledgedManifest);
  const retained = prepareRetainedTerminalAcknowledgementCopy('acknowledged');
  assert.equal(retained.sourceId, input.sourceId);
  assert.equal(layout.version, 'terminal_workload_private_layout_v1');
  assert.equal(layout.retainedSha256, retained.retainedSha256); assert.equal(layout.destinationPath, input.artifact.path);
  noSettledCheckpointSidecars(input.artifact.path); assert.equal(fileHash(input.artifact.path), input.artifact.sha256);
  const destination = join(retained.directory, 'settled-workload.sqlite');
  copyFileSync(input.artifact.path, destination, constants.COPYFILE_EXCL);
  assert.equal(fileHash(destination), input.artifact.sha256);
  noSettledCheckpointSidecars(input.artifact.path); assert.equal(fileHash(input.artifact.path), input.artifact.sha256);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let original: InstanceType<typeof DatabaseSync> | undefined, db: InstanceType<typeof DatabaseSync> | undefined;
  try {
    original = new DatabaseSync(retained.path, { readOnly: true });
    db = new DatabaseSync(destination);
    const originalRows = rawCensus(original);
    assert.equal(hash(originalRows), layout.originalRowsHash); same(schemaCensus(original), layout.beforeSchema);
    same(schemaCensus(db), layout.afterSchema);
    same(rawCensus(db, workloadTables), rawCensus(original, workloadTables));
    // Preserve all pre-existing global workload prefixes; participant heads are
    // authenticated separately by the real current workload evidence reader.
    for (const name of ['world_player_workload_policies','world_player_workload_baselines','world_player_workload_activities']) {
      const before = originalRows.find(owner => owner.table === name)!.rows;
      const after: ReturnType<typeof rawCensus>[number]['rows'] = rawCensus(db).find(owner => owner.table === name)!.rows;
      for (const row of before) assert(after.some(candidate => json(candidate) === json(row)), 'original workload prefix changed: ' + name);
    }
    original.close(); original = undefined;
    const result = { ...retained, acknowledgedCopyPath: retained.path, path: destination, db, input, originalRows,
      settledSourcePath: input.artifact.path as string, settledSourceSha256: input.artifact.sha256 as string };
    db = undefined; return result;
  } catch (error) {
    const errors = [error];
    for (const handle of [db, original]) try { handle?.close(); } catch (cleanup) { errors.push(cleanup); }
    if (errors.length > 1) throw new AggregateError(errors, 'settled copy handle cleanup failed', { cause:error });
    throw error;
  }
};

/** Exact old fixture delta only. These already accepted test calibrations are
 * copied from the original W02 fixture packet; they are never production input
 * acceptance or new calibration. Real current owners authenticate first. */
export const assertRetainedSettledExactRows = (db: Database,
  originalRows: ReturnType<typeof rawCensus>, complete: Exclude<TerminalWorkloadPlan, { kind:'pending' }>) => {
  const expected = originalRows.map(owner => ({ ...owner, rows:owner.rows.map(row => ({ ...row })) }));
  for (const table of ['actual_role_workload_assessments','actual_role_workload_settlements']) {
    assert(!expected.some(owner => owner.table === table)); expected.push({ table, rows:[] });
  }
  expected.sort((a,b) => String(a.table) < String(b.table) ? -1 : String(a.table) > String(b.table) ? 1 : 0);
  const rows = (table: string) => expected.find(owner => owner.table === table)!.rows;
  const append = (table: string, row: Record<string,string|number>) => {
    const found = rows(table); found.push({ __ack_rowid:Math.max(0,...found.map(r => Number(r.__ack_rowid))) + 1, ...row });
  };
  const terminal = rows('actual_foul_terminal_applications').find(row => row.source_id === complete.terminalSourceId)!;
  const proposal = JSON.parse(String(terminal.proposal_json)) as FoulTerminalApplicationProposal;
  const actors = [...proposal.participants].sort((a,b) => a.binding.playerId < b.binding.playerId ? -1 : a.binding.playerId > b.binding.playerId ? 1 : 0);
  same(complete.participants.map(p => [p.playerId,p.personId,p.clubId]), actors.map(a => [a.binding.playerId,a.person.personId,a.binding.clubId]));
  for (const [i,p] of complete.participants.entries()) {
    const actor = actors[i], head = rows('world_player_workload_heads').find(row => row.career_id === complete.careerId && row.player_id === p.playerId);
    if (head) { same(p.before, JSON.parse(String(head.state_json))); head.revision = p.after.revision; head.state_json = json(p.after); }
    else {
      const source = { sourceId:'fixture-terminal-role-baseline:' + p.playerId, sourceVersion:'fixture-v1', personLinkSourceId:actor.binding.personLinkSourceId,
        careerId:complete.careerId, playerId:p.playerId, createdAtDay:complete.gameDay, fatigue:0.1, recoveryCapacity:0.5,
        policy:{ policyId:'explicit-role-workload-fixture', version:'fixture-v1', availableAtDay:0,
          workloadFatiguePerUnit:0.01, travelFatiguePerKm:0.001, recoveryPerHour:0.1 } };
      const initial = createPlayerWorkloadRecovery({ careerId:source.careerId, playerId:source.playerId, createdAtDay:source.createdAtDay,
        fatigue:source.fatigue, recoveryCapacity:source.recoveryCapacity, policy:source.policy });
      same(p.before, initial);
      const policy = rows('world_player_workload_policies').find(row => row.career_id === source.careerId
        && row.policy_id === source.policy.policyId && row.version === source.policy.version);
      if (policy) assert.equal(policy.policy_json, json(source.policy));
      else append('world_player_workload_policies', { career_id:source.careerId, policy_id:source.policy.policyId,
        version:source.policy.version, policy_json:json(source.policy) });
      append('world_player_workload_baselines', { source_id:source.sourceId, career_id:source.careerId, player_id:source.playerId,
        source_json:json(source), initial_json:json(initial) });
      append('world_player_workload_heads', { career_id:source.careerId, player_id:source.playerId, revision:p.after.revision, state_json:json(p.after) });
    }
    const source = { sourceId:'fixture-terminal-total-effort:' + p.playerId, sourceVersion:'fixture-v1', capability:'actual_foul_terminal_total_workload_v1',
      terminalReference:complete.terminalReference, physicalEndReference:complete.physicalEndReference,
      wholeHistoryReference:complete.wholeHistoryReference, originalPhysicalPitchPrefix:complete.originalPhysicalPitchPrefix,
      participantReference:{ playerId:p.playerId, bindingHash:hash(actor.binding), personHash:hash(actor.person) }, effortUnits:i,
      provenance:{ assessmentSourceId:'explicit-fixture-assessment:' + p.playerId, assessmentVersion:'fixture-v1',
        calibrationSourceId:'explicit-fixture-total-effort', calibrationVersion:'fixture-v1' } };
    const activity = { sourceEventId:'actual-total-play-workload:' + hash([complete.careerId,complete.gameId,complete.playId,p.playerId]),
      sourceVersion:'actual-total-play-workload-v1', evidenceId:complete.physicalEndReference.sourceId, careerId:complete.careerId,
      playerId:p.playerId, atDay:complete.gameDay, kind:'MATCH', effortUnits:i };
    same(p.activity, activity); assert.equal(p.assessmentSourceId, source.sourceId);
    const snapshot = { source, careerId:complete.careerId, gameId:complete.gameId, playId:complete.playId, playerId:p.playerId, actor, activity };
    append('actual_role_workload_assessments', { source_id:source.sourceId, closure_source_id:complete.terminalSourceId,
      career_id:complete.careerId, game_id:complete.gameId, play_id:complete.playId, player_id:p.playerId,
      source_json:json(source), source_hash:hash(source), snapshot_json:json(snapshot), snapshot_hash:hash(snapshot) });
    append('world_player_workload_activities', { source_id:p.activity.sourceEventId, career_id:complete.careerId, player_id:p.playerId,
      before_revision:p.before.revision, after_revision:p.after.revision, source_json:json(p.activity), before_json:json(p.before), after_json:json(p.after) });
  }
  const frozen = { ...complete, kind:'frozen', participants:complete.participants.map(({ applied:_applied, ...p }) => p) };
  append('actual_role_workload_settlements', { closure_source_id:complete.terminalSourceId, career_id:complete.careerId,
    game_id:complete.gameId, play_id:complete.playId, plan_json:json(frozen), plan_hash:hash(frozen) });
  same(rawCensus(db), expected);
};

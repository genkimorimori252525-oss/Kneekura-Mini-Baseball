import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { constants, copyFileSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { prepareTerminalWorkloadReadyCopy } from './ActualFoulTerminalRoleWorkloadCheckpoint.test-support';
import { acceptedTerminalWorkloadFixturePacket, expectedActivity, requireTerminalWorkload, cleanupTerminalWorkload,
  observeTerminalWorkloadConnectionChanges, type TerminalWorkloadStore } from './ActualFoulTerminalRoleWorkloadFixture.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b));
type Pin = Readonly<{ path: string; sha256: string }>;
const pin = (p: Pin) => {
  assert(isAbsolute(p.path) && normalize(p.path) === p.path && realpathSync(p.path) === p.path && lstatSync(p.path).isFile());
  assert.equal(fileHash(p.path), p.sha256);
};
const read = (p: Pin) => { pin(p); return JSON.parse(readFileSync(p.path, 'utf8')); };
const sidecarsAbsent = (path: string) => {
  for (const suffix of ['-wal', '-shm', '-journal']) {
    try { lstatSync(path + suffix); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    throw new Error('settled retained Source has a sidecar');
  }
};
/** No charge is generated here. Current owners independently authenticate an
 * exclusive copy of a naturally completed old W02, with an independent exact
 * ready-to-settled census derived from the already qualified ready checkpoint. */
export const prepareTerminalWorkloadSettledCopy = async () => {
  const input = process.env.TERMINAL_WORKLOAD_SETTLED_INPUT; assert(input, 'settled input manifest missing');
  assert.equal(realpathSync(input), input); assert(lstatSync(input).isFile());
  const m = JSON.parse(readFileSync(input, 'utf8'));
  assert.equal(m.version, 'terminal_workload_settled_w02_input_v1');
  assert.equal(m.sourceId, 'terminal-application');
  const config = read(m.config), terminal = read(m.terminal), report = read(m.report), layout = read(m.layoutReceipt);
  assert.equal(terminal.status, 'passed'); assert.equal(terminal.configSha256, m.config.sha256); assert.equal(terminal.stage, config.stage);
  same(terminal.before, terminal.after); same(terminal.failures, []); same(terminal.cancelSignals, []); same(terminal.remainingOwnedProcesses, []);
  assert.equal(terminal.originalChildExit, 0); assert.equal(terminal.tests.reportSha256, m.report.sha256);
  assert.equal(terminal.tests.passedCases, 3); assert.equal(terminal.tests.expectedFailedCases, 0); same(terminal.tests.skipped, []);
  assert.equal(report.success, true); assert.equal(report.numTotalTests, 3); assert.equal(report.numPassedTests, 3); assert.equal(report.numFailedTests, 0);
  assert.equal(report.numPendingTests, 0); assert.equal(report.numTodoTests, 0); assert.equal(report.testResults.length, 1);
  assert.equal(report.testResults[0].name, join(config.inputs.source.root, m.qualifiedCase.file));
  const qualified = report.testResults[0].assertionResults.filter((a: { fullName: string }) => a.fullName === m.qualifiedCase.name);
  assert.equal(qualified.length, 1); assert.equal(qualified[0].status, 'passed'); same(qualified[0].failureMessages, []);
  for (const group of ['source', 'dependencies', 'controls', 'runtime']) assert.equal(terminal.before[group].sha256, config.inputs[group].sha256);
  for (const p of m.lineageControlPins as Pin[]) {
    pin(p); assert(terminal.before.controls.entries.some((e: unknown) => json(e) === json([p.path, 'file', p.sha256])));
  }
  for (const identity of terminal.ownedIdentities) {
    const exits = terminal.groupChildExits.filter((e: { identity: unknown }) => json(e.identity) === json(identity));
    assert.equal(exits.length, 1); assert.equal(exits[0].exitCode, 0); assert.equal(exits[0].rawWaitStatus, 0);
  }
  assert.equal(m.artifact.sha256, '310e9ff07f47618ad182715cff5254f24ec4dc6166aec4bfb926145f54ad8389');
  assert.equal(layout.destinationPath, m.artifact.path); pin(m.artifact); sidecarsAbsent(m.artifact.path);
  const f = await prepareTerminalWorkloadReadyCopy();
  let store: TerminalWorkloadStore | undefined, accounting: ReturnType<typeof observeTerminalWorkloadConnectionChanges> | undefined;
  try {
    assert.equal(layout.retainedSha256, f.retainedSha256);
    const packet = acceptedTerminalWorkloadFixturePacket(f), ready = rawCensus(f.db), schema = schemaCensus(f.db);
    const participants = withSqliteReadTransaction(f.db, () => f.actors.map(actor => {
      const source = [...packet.assessments.values()].find(s => s.participantReference.playerId === actor.binding.playerId)!;
      const activity = expectedActivity(f, source), before = readActualRoleWorkloadState(f.db, f.reference.careerId, actor.binding.playerId)!;
      return { playerId: actor.binding.playerId, personId: actor.person.personId, clubId: actor.binding.clubId,
        assessmentSourceId: source.sourceId, activity, before, after: advancePlayerWorkloadRecovery(before, before.revision, activity) };
    }));
    const assessmentHashes = [...packet.assessments.values()].map(source => {
      const actor = f.actors.find(a => a.binding.playerId === source.participantReference.playerId)!;
      return { sourceId: source.sourceId, hash: hash({ source, careerId: f.reference.careerId, gameId: f.reference.gameId,
        playId: f.reference.playId, playerId: actor.binding.playerId, actor, activity: expectedActivity(f, source) }) };
    }).sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);
    const plan = { ...f.reference, kind: 'frozen', capturedAt: 'settlement_freeze', participants, assessmentHashes };
    const expected = ready.map(owner => ({ ...owner, rows: owner.rows.map(row => ({ ...row })) }));
    const rows = (table: string) => expected.find(owner => owner.table === table)!.rows;
    const append = (table: string, row: Record<string, string | number>) => {
      const target = rows(table); target.push({ __ack_rowid: Math.max(0, ...target.map(r => Number(r.__ack_rowid))) + 1, ...row });
    };
    append('actual_role_workload_settlements', { closure_source_id: f.sourceId, career_id: f.reference.careerId,
      game_id: f.reference.gameId, play_id: f.reference.playId, plan_json: json(plan), plan_hash: hash(plan) });
    for (const p of participants) {
      append('world_player_workload_activities', { source_id: p.activity.sourceEventId, career_id: f.reference.careerId, player_id: p.playerId,
        before_revision: p.before.revision, after_revision: p.after.revision, source_json: json(p.activity), before_json: json(p.before), after_json: json(p.after) });
      const head = rows('world_player_workload_heads').find(r => r.career_id === f.reference.careerId && r.player_id === p.playerId)!;
      head.revision = p.after.revision; head.state_json = json(p.after);
    }
    const path = join(f.directory, 'settled-workload.sqlite'); copyFileSync(m.artifact.path, path, constants.COPYFILE_EXCL);
    assert.equal(fileHash(path), m.artifact.sha256); pin(m.artifact); sidecarsAbsent(m.artifact.path);
    f.links.close(); f.db.close();
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    accounting = observeTerminalWorkloadConnectionChanges(); f.path = path; f.db = new DatabaseSync(path); f.links = openSqlitePlayerPersonLinkStore(path);
    same(rawCensus(f.db), expected); same(schemaCensus(f.db), { ...schema, mainVersion: Number(schema.mainVersion) - 2 });
    same(schemaCensus(f.db), layout.afterSchema);
    const api = await requireTerminalWorkload(); store = api.open(path, f.links);
    const complete = { ...plan, kind: 'complete' as const, participants: participants.map(p => ({ ...p, applied: true })) };
    same(store.readSettlement(f.sourceId), complete); accounting.assertUnchanged(); accounting.close(); accounting = undefined;
    store.close(); store = undefined; pin(m.artifact); sidecarsAbsent(m.artifact.path);
    return { f, packet, complete };
  } catch (error) { try { accounting?.close(); } finally { cleanupTerminalWorkload(f, store); } throw error; }
};

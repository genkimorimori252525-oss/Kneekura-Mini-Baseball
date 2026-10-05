import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { AcceptedActualRoleWorkloadAssessment } from './ActualRoleWorkloadAssessment';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
type ClosureOwner = typeof import('./ActualLivePlayClosureEvidenceFromSqlite');
const physical = vi.hoisted(() => ({ closure: null as unknown, hook: null as ((db: DatabaseSync) => void) | null, real: null as ClosureOwner | null }));
// Only the expensive physical/official closure read is supplied. The original
// application and strict current Match, ten accepted role assessments/effects,
// historical/current heads, real readonly WAL connections and cleanup are real.
// These controls cannot certify a genuine physical artifact.
// Register the complete mock before loading the original module: importing it
// inside this factory traverses closure -> readiness -> role and captures the
// real reader before Vitest finishes installing the partial mock.
vi.mock('./ActualLivePlayClosureEvidenceFromSqlite', () => ({
  actualLivePlayClosureEvidenceFromSqlite: (db: DatabaseSync) => ({ read: () => {
    physical.hook?.(db); return structuredClone(physical.closure);
  } }),
  assertActualLiveClosureStage: (...args: Parameters<ClosureOwner['assertActualLiveClosureStage']>) => physical.real!.assertActualLiveClosureStage(...args),
  actualLiveClosureApplicationRows: (...args: Parameters<ClosureOwner['actualLiveClosureApplicationRows']>) => physical.real!.actualLiveClosureApplicationRows(...args),
  assertPriorActualLiveClosureCompleted: (...args: Parameters<ClosureOwner['assertPriorActualLiveClosureCompleted']>) => physical.real!.assertPriorActualLiveClosureCompleted(...args),
}));
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { verifyActualRoleReadReplay, type RoleReadReplayInput } from '../../../tools/verification/actual-live-pipeline/role-read-replay-helper';
physical.real = await vi.importActual<ClosureOwner>('./ActualLivePlayClosureEvidenceFromSqlite');
const { DatabaseSync: RealDatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const handles = (path: string) => readdirSync('/proc/self/fd').flatMap(fd => {
  try { const target = readlinkSync(`/proc/self/fd/${fd}`); return target.startsWith(path) ? [{ fd, target }] : []; } catch { return []; }
});
const census = (db: DatabaseSync) => Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
  .map(row => [String(row.name), Number(db.prepare(`SELECT count(*) AS n FROM "${String(row.name).replaceAll('"', '""')}"`).get()!.n)]));
const fixture = (mutate?: (db: DatabaseSync) => void) => {
  physical.hook = null;
  const directory = mkdtempSync(join(tmpdir(), 'settled-role-replay-')), path = join(directory, 'role.sqlite');
  const cleanup: (() => void)[] = [() => rmSync(directory, { recursive: true, force: true })];
  const close = () => { physical.hook = null; const errors: unknown[] = [];
    while (cleanup.length) { try { cleanup.pop()!(); } catch (error) { errors.push(error); } }
    if (errors.length) throw new AggregateError(errors, 'role replay fixture cleanup failed'); };
  try {
    const f = officialPitchWorkloadFixture(true, true, path, true, undefined, { ruleProfileId: asRuleProfileId('npb-2026') });
    let closed = false; cleanup.push(() => { if (!closed) f.close(); });
    const first = f.official.applyAndActivate(f.firstInput);
    const closureSourceId = String(f.db.prepare('SELECT closure_id FROM applications WHERE application_id=?').get(f.firstInput.applicationId)!.closure_id);
    const bindings = f.db.prepare("SELECT binding_json FROM official_participant_bindings WHERE player_id='away-1' OR json_extract(binding_json,'$.side')='HOME' ORDER BY player_id").all()
      .map(row => JSON.parse(String(row.binding_json)) as OfficialParticipantBinding);
    const actors = bindings.map(binding => ({ binding, person: f.links.readLink(binding.personLinkSourceId)! }));
    expect(actors).toHaveLength(10);
    const physicalEndReference = { owner: 'actual_first_base_play_ends' as const, sourceId: 'end', sourceVersion: 'fixture', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
    const wholeHistoryReference = { hash: 'c'.repeat(64), convention: 'owned_scheduled_whole_history_manifest_v1' as const };
    const source = { sourceId: closureSourceId }, scoring = { kind: 'unsupported' }, workload = { kind: 'pending', reason: 'actual_role_effort_policy_and_application_unconnected' };
    const proposal = { source, gameId: 'game-1', playId: f.initial.playId, application: f.firstInput, expectedOfficial: first,
      actors, physicalEndReference, wholeHistoryReference, controllerReset: { physicalEndReference }, scoring, workload };
    physical.closure = { source, proposal, status: 'OFFICIAL_APPLIED', officialApplied: true, result: { official: first, scoring, workload } };
    f.db.exec('CREATE TABLE actual_live_play_closures(source_id TEXT PRIMARY KEY,proposal_json TEXT,proposal_hash TEXT); CREATE TABLE actual_first_base_play_ends(source_id TEXT PRIMARY KEY); INSERT INTO actual_first_base_play_ends VALUES(\'end\'); CREATE TABLE actual_live_play_fences(source_id TEXT PRIMARY KEY); INSERT INTO actual_live_play_fences VALUES(\'fence\'); CREATE TABLE physical_plate_appearance_actors(source_id TEXT PRIMARY KEY); INSERT INTO physical_plate_appearance_actors VALUES(\'actor\'); CREATE TABLE physical_pitch_progress_actions(source_id TEXT PRIMARY KEY); INSERT INTO physical_pitch_progress_actions VALUES(\'pitch\')');
    f.db.prepare('INSERT INTO actual_live_play_closures VALUES(?,?,?)').run(closureSourceId, json(proposal), hash(proposal));
    const assessments = new Map<string, AcceptedActualRoleWorkloadAssessment>(), baselines = new Map<string, AcceptedPlayerWorkloadBaseline>();
    for (const actor of actors) {
      const playerId = actor.binding.playerId;
      assessments.set(`assessment:${playerId}`, { sourceId: `assessment:${playerId}`, sourceVersion: 'fixture', closureSourceId,
        physicalEndReference, wholeHistoryReference, participantReference: { playerId, bindingHash: hash(actor.binding), personHash: hash(actor.person) }, effortUnits: 1,
        provenance: { assessmentSourceId: `accepted:${playerId}`, assessmentVersion: 'fixture', calibrationSourceId: 'calibration', calibrationVersion: 'fixture' } });
      baselines.set(`baseline:${playerId}`, { sourceId: `baseline:${playerId}`, sourceVersion: 'fixture', personLinkSourceId: actor.binding.personLinkSourceId,
        careerId: actor.binding.careerId, playerId, createdAtDay: 1, fatigue: 0.1, recoveryCapacity: 0.5,
        policy: { policyId: 'fixture', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } });
    }
    const role = f.track(openSqliteActualRoleWorkloadStore(path, f.links, {
      readAcceptedAssessment: id => assessments.get(id) ?? null, readAcceptedBaseline: id => baselines.get(id) ?? null }));
    for (const id of baselines.keys()) role.initializeBaseline(id);
    role.acceptAssessments([...assessments.keys()]); const settlement = role.settle(closureSourceId);
    expect(settlement.kind).toBe('complete'); if (settlement.kind !== 'complete') throw new Error('fixture needs complete role effects');
    expect(settlement.participants).toHaveLength(10); const rowCounts = census(f.db);
    mutate?.(f.db); f.close(); closed = true;
    const artifactSha256 = fileHash(path), output = { path, sha256: artifactSha256, realDisk: true as const, mainFilename: path,
      journalMode: 'wal' as const, rowCounts, workloadActivityKinds: [{ kind: 'MATCH', n: 10 }], wrapperReadOnlyOpenClosedVerified: true as const };
    const input: RoleReadReplayInput = { artifactPath: path, artifactSha256, expectedSettlementSha256: hash(settlement), roleReceipt: { settlement, output },
      originalReceipt: { closureSourceId, applicationId: f.firstInput.applicationId, officialReceipt: first.receipt, scoring, workload,
        retiredControllerCount: 10, adjudicationEvidence: { physicalEndReference, wholeHistoryReference }, output } };
    expect(handles(path)).toEqual([]); return { path, directory, input, close };
  } catch (error) { try { close(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'role replay setup failed', { cause: error }); } throw error; }
};

it('reads two fresh readonly settlements matching sealed DTO bytes and all ten current heads', () => {
  const x = fixture(), seen: DatabaseSync[] = [];
  physical.hook = db => { expect(db).toBeInstanceOf(RealDatabaseSync); expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(() => db.exec('CREATE TABLE forbidden(id TEXT)')).toThrow(/readonly|read-only/); seen.push(db); };
  try {
    const result = verifyActualRoleReadReplay(x.input), settlement = x.input.roleReceipt.settlement;
    if (settlement.kind !== 'complete') throw new Error('expected complete fixture');
    expect(result.passes).toHaveLength(2); expect(seen).toHaveLength(2); expect(seen[0] === seen[1]).toBe(false);
    expect(seen.every(db => !db.isOpen)).toBe(true);
    expect(result.passes.map(p => p.connectionId)).toEqual([1, 2]);
    expect(result.passes[0].observation).toEqual({ settlement: x.input.roleReceipt.settlement,
      currentHeads: settlement.participants.map(p => p.after), artifact: x.input.roleReceipt.output });
    expect(result.passes[0].observation).toEqual(result.passes[1].observation);
    expect(result.passes[0].observationSha256).toBe(hash(result.passes[0].observation));
    expect(result.executed).toEqual({ readOnlyConnections: 2, readTransactions: 2, settlementReads: 2, currentHeadReads: 20,
      officialHelperCalls: 0, roleHelperCalls: 0, nextHelperCalls: 0, newOfficialApplications: 0, newWorkloadActivities: 0, newPhysicalPitchActions: 0 });
    expect(fileHash(x.path)).toBe(x.input.artifactSha256); expect(handles(x.path)).toEqual([]);
  } finally { x.close(); }
});
const corruptions: [string, string, RegExp][] = [
  ['advanced Match', 'UPDATE matches SET durable_revision=durable_revision+1', /written Match|current Match/],
  ['changed current head', "UPDATE world_player_workload_heads SET revision=revision+1 WHERE player_id='p2'", /head/],
  ['missing effect', "DELETE FROM world_player_workload_activities WHERE player_id='away-1'", /census|effect/],
  ['changed assessment', "UPDATE actual_role_workload_assessments SET snapshot_hash='changed' WHERE player_id='away-1'", /assessment/],
  ['changed frozen plan', "UPDATE actual_role_workload_settlements SET plan_hash='changed'", /plan/],
];
for (const [name, sql, pattern] of corruptions) it(`rejects ${name} even when the changed database hash is repinned`, () => {
  const x = fixture(db => db.exec(sql));
  try { expect(() => verifyActualRoleReadReplay(x.input)).toThrow(pattern); expect(handles(x.path)).toEqual([]); } finally { x.close(); }
});
it('rejects an altered sealed DTO digest before opening a connection', () => {
  const x = fixture(); let calls = 0; physical.hook = () => { calls++; };
  try { expect(() => verifyActualRoleReadReplay({ ...x.input, expectedSettlementSha256: 'f'.repeat(64) })).toThrow(/digest|settlement/); expect(calls).toBe(0); } finally { x.close(); }
});
it('rejects wrong artifact bytes before any physical read', () => {
  const x = fixture(); let calls = 0; physical.hook = () => { calls++; };
  try { expect(() => verifyActualRoleReadReplay({ ...x.input, artifactSha256: 'f'.repeat(64) })).toThrow(/hash|bytes/); expect(calls).toBe(0); } finally { x.close(); }
});
it('rejects a resolved artifact alias before opening it', () => {
  const x = fixture(), alias = join(x.directory, 'alias.sqlite'); symlinkSync(x.path, alias);
  try { expect(() => verifyActualRoleReadReplay({ ...x.input, artifactPath: alias })).toThrow(/path|identity/); expect(handles(x.path)).toEqual([]); } finally { x.close(); }
});
it('preserves the original owner exception while closing its read connection', () => {
  const x = fixture(), failure = new Error('original role owner failure'); let db: DatabaseSync | undefined;
  physical.hook = value => { db = value; throw failure; };
  try { let caught: unknown; try { verifyActualRoleReadReplay(x.input); } catch (error) { caught = error; }
    expect(caught).toBe(failure); expect(db!.isOpen).toBe(false); expect(fileHash(x.path)).toBe(x.input.artifactSha256); expect(handles(x.path)).toEqual([]);
  } finally { x.close(); }
});
it('reopens after closing pass one and rejects a changed physical reference on pass two', () => {
  const x = fixture(), seen: DatabaseSync[] = [], original = physical.closure;
  physical.hook = db => { seen.push(db); if (seen.length === 2) {
    expect(seen[0].isOpen).toBe(false);
    const changed = structuredClone(original) as { proposal: { physicalEndReference: { sourceHash: string } } };
    changed.proposal.physicalEndReference.sourceHash = 'e'.repeat(64); physical.closure = changed;
  } };
  try { expect(() => verifyActualRoleReadReplay(x.input)).toThrow(/physical|reference|settlement/); expect(seen).toHaveLength(2); expect(seen.every(db => !db.isOpen)).toBe(true); }
  finally { physical.closure = original; x.close(); }
});
it('requires all original census rows before accepting the observation', () => {
  const x = fixture();
  try { const input = { ...x.input, roleReceipt: { ...x.input.roleReceipt, output: { ...x.input.roleReceipt.output,
      rowCounts: { ...x.input.roleReceipt.output.rowCounts, applications: 2 } } } };
    expect(() => verifyActualRoleReadReplay(input)).toThrow(/census/); expect(handles(x.path)).toEqual([]);
  } finally { x.close(); }
});

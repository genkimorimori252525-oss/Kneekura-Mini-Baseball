import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { ActualRoleWorkloadContext } from './ActualRoleWorkloadEvidenceFromSqlite';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
const physical = vi.hoisted(() => ({ context: null as ActualRoleWorkloadContext | null,
  onRead: null as ((db: DatabaseSync) => void) | null }));
// Only the expensive authenticated physical context is supplied. The prepared
// plan, current Match/head checks, SQLite transactions, readonly file and closes
// are real. This cannot certify an original physical/official artifact.
vi.mock('./ActualRoleWorkloadEvidenceFromSqlite', async importOriginal => {
  const actual = await importOriginal<typeof import('./ActualRoleWorkloadEvidenceFromSqlite')>();
  return { ...actual, actualRoleWorkloadContextFromSqlite: (db: DatabaseSync) => { physical.onRead?.(db); return physical.context; } };
});
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { verifyActualOfficialReadReplay, type OriginalOfficialReplayReceipt } from '../../../tools/verification/actual-live-pipeline/official-read-replay-helper';
const { DatabaseSync: RealDatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const handles = (path: string) => readdirSync('/proc/self/fd').flatMap(fd => {
  try { const target=readlinkSync(`/proc/self/fd/${fd}`); return target.startsWith(path) ? [{fd,target}] : []; } catch { return []; }
});
const census = (db: DatabaseSync) => Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
  .map(row => [String(row.name), Number(db.prepare(`SELECT count(*) AS n FROM "${String(row.name).replaceAll('"','""')}"`).get()!.n)]));
const fixture = (mutate?: (db: DatabaseSync) => void) => {
  physical.onRead = null;
  const directory = mkdtempSync(join(tmpdir(), 'official-read-replay-')), path = join(directory, 'official.sqlite');
  const f = officialPitchWorkloadFixture(true, true, path, true, undefined, { ruleProfileId: asRuleProfileId('npb-2026') });
  let closed = false;
  try {
    const first = f.official.applyAndActivate(f.firstInput);
    const closureSourceId = String(f.db.prepare('SELECT closure_id FROM applications WHERE application_id=?').get(f.firstInput.applicationId)!.closure_id);
    const bindings = f.db.prepare("SELECT binding_json FROM official_participant_bindings WHERE player_id='away-1' OR json_extract(binding_json,'$.side')='HOME' ORDER BY player_id").all()
      .map(row => JSON.parse(String(row.binding_json)) as OfficialParticipantBinding);
    const actors = bindings.map(binding => ({ binding, person: f.links.readLink(binding.personLinkSourceId)! }));
    expect(actors).toHaveLength(10);
    const baseline = { sourceId: 'baseline-p2', sourceVersion: 'fixture', personLinkSourceId: 'intake-p2', careerId: 'career-a', playerId: 'p2',
      createdAtDay: 1, fatigue: 0.1, recoveryCapacity: 0.5, policy: { policyId: 'fixture', version: 'v1', availableAtDay: 0,
        workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
    f.track(openSqlitePlayerWorkloadRecoveryStore(path, f.links, { readAcceptedBaseline: () => baseline, readAcceptedActivity: () => null })).initialize(baseline.sourceId);
    f.db.exec('CREATE TABLE actual_first_base_play_ends(source_id TEXT PRIMARY KEY); INSERT INTO actual_first_base_play_ends VALUES(\'end\'); CREATE TABLE actual_live_play_fences(source_id TEXT PRIMARY KEY); INSERT INTO actual_live_play_fences VALUES(\'fence\'); CREATE TABLE physical_pitch_progress_actions(source_id TEXT PRIMARY KEY); INSERT INTO physical_pitch_progress_actions VALUES(\'pitch\')');
    const physicalEndReference = { owner: 'actual_first_base_play_ends' as const, sourceId: 'end', sourceVersion: 'fixture', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
    const wholeHistoryReference = { hash: 'c'.repeat(64), convention: 'owned_scheduled_whole_history_manifest_v1' as const };
    const scoring = { kind: 'unsupported' }, workload = { kind: 'pending', reason: 'actual_role_effort_policy_and_application_unconnected' };
    const p = { source: { sourceId: closureSourceId, adjudicationSourceId: 'adjudication' }, gameId: 'game-1', playId: f.initial.playId,
      application: f.firstInput, expectedOfficial: first, physicalEndReference, wholeHistoryReference,
      adjudicationReference: { sourceId: 'adjudication', snapshotHash: 'd'.repeat(64) }, scoring, workload, actors,
      controllerReset: { physicalEndReference, retired: actors.map(actor => ({ playerId: actor.binding.playerId })) } };
    physical.context = { closure: { source: p.source, proposal: p, status: 'OFFICIAL_APPLIED', officialApplied: true,
      result: { sourceId: closureSourceId, official: first, scoring, workload, controllerReset: p.controllerReset } },
      p, actors, reference: { closureSourceId, closureApplicationId: f.firstInput.applicationId, closureProposalHash: hash(p),
        careerId: 'career-a', gameId: 'game-1', playId: f.initial.playId, gameDay: 10, physicalEndReference, wholeHistoryReference } } as unknown as ActualRoleWorkloadContext;
    const rowCounts = census(f.db);
    mutate?.(f.db); f.close(); closed = true;
    const artifactSha256 = fileHash(path);
    const originalReceipt: OriginalOfficialReplayReceipt = { closureSourceId, applicationId: f.firstInput.applicationId, officialReceipt: first.receipt,
      scoring, workload, retiredControllerCount: 10, adjudicationEvidence: { physicalEndReference, wholeHistoryReference },
      output: { path, sha256: artifactSha256, realDisk: true, mainFilename: path, journalMode: 'wal', rowCounts, workloadActivityKinds: [], wrapperReadOnlyOpenClosedVerified: true } };
    expect(handles(path)).toEqual([]);
    return { directory, path, input: { artifactPath: path, artifactSha256, originalReceipt },
      close() { physical.onRead=null; rmSync(directory, {recursive:true,force:true}); } };
  } catch (error) { if (!closed) f.close(); physical.onRead=null; rmSync(directory,{recursive:true,force:true}); throw error; }
};

it('authenticates two fresh real readonly transaction connections and closes them with equal observations', () => {
  const x=fixture(), observed: DatabaseSync[]=[];
  physical.onRead=db=>{
    expect(db).toBeInstanceOf(RealDatabaseSync); expect(db.isTransaction).toBe(true);
    expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(() => db.exec('CREATE TABLE forbidden_replay_write(id TEXT)')).toThrow(/readonly|read-only/);
    observed.push(db);
  };
  try {
    const result=verifyActualOfficialReadReplay(x.input);
    expect(result.passes).toHaveLength(2); expect(observed).toHaveLength(2); expect(observed[0] === observed[1]).toBe(false);
    expect(observed.every(db=>!db.isOpen)).toBe(true);
    expect(result.passes[0].observation).toEqual(result.passes[1].observation);
    expect(result.passes[0].observationSha256).toBe(result.passes[1].observationSha256);
    expect(result.passes.map(pass=>pass.connectionId)).toEqual([1,2]);
    expect(result.executed).toEqual({readOnlyConnections:2,readTransactions:2,roleContextReads:2,strictCurrentStageChecks:2,preparedPlanReads:2,
      officialHelperCalls:0,officialWrites:0,newOfficialApplications:0,newWorkloadActivities:0,newPhysicalPitchActions:0});
    expect(result.passes[0].observation.preparedPlan).toMatchObject({kind:'pending',missingAssessments:['away-1','home-1','home-2','home-3','home-4','home-5','home-6','home-7','home-8','p2'],missingBaselines:['away-1','home-1','home-2','home-3','home-4','home-5','home-6','home-7','home-8']});
    expect(fileHash(x.path)).toBe(x.input.artifactSha256); expect(handles(x.path)).toEqual([]); expect(result.openSqliteHandles).toEqual([]);
  } finally { x.close(); }
});

it('rejects an advanced current Match even when the changed file hash is supplied', () => {
  const x=fixture(db=>db.exec('UPDATE matches SET durable_revision=durable_revision+1'));
  try { expect(()=>verifyActualOfficialReadReplay(x.input)).toThrow(/written Match|current Match/); expect(handles(x.path)).toEqual([]); }
  finally { x.close(); }
});

it('authenticates the retained baseline head and rejects its changed revision', () => {
  const x=fixture(db=>db.exec("UPDATE world_player_workload_heads SET revision=revision+100 WHERE player_id='p2'"));
  try { expect(()=>verifyActualOfficialReadReplay(x.input)).toThrow(/head|corrupt/); expect(handles(x.path)).toEqual([]); }
  finally { x.close(); }
});

it.each(['actual_role_workload_assessments','actual_role_workload_settlements','world_player_workload_activities'])('rejects nonzero prior role rows in %s before accepting replay', table => {
  const x=fixture(db=>{
    if (table==='world_player_workload_activities') db.exec("INSERT INTO world_player_workload_activities VALUES('foreign','career-a','p2',0,1,'{}','{}','{}')");
    else db.exec(`CREATE TABLE ${table}(source_id TEXT PRIMARY KEY); INSERT INTO ${table} VALUES('foreign')`);
  });
  try { expect(()=>verifyActualOfficialReadReplay(x.input)).toThrow(/census|role rows|workload rows/); expect(handles(x.path)).toEqual([]); }
  finally { x.close(); }
});

it('rejects wrong original artifact bytes before any physical context read', () => {
  const x=fixture(); let reads=0; physical.onRead=()=>{reads++;};
  try { expect(()=>verifyActualOfficialReadReplay({...x.input,artifactSha256:'f'.repeat(64)})).toThrow(/hash|bytes/); expect(reads).toBe(0); expect(handles(x.path)).toEqual([]); }
  finally { x.close(); }
});

it('rejects an alias path before reading the original artifact', () => {
  const x=fixture(), alias=join(x.directory,'alias.sqlite'); symlinkSync(x.path,alias);
  try { expect(()=>verifyActualOfficialReadReplay({...x.input,artifactPath:alias})).toThrow(/path|identity/); expect(handles(x.path)).toEqual([]); }
  finally { x.close(); }
});

it('closes the read connection while preserving an owner exception and original file bytes', () => {
  const x=fixture(), failure=new Error('original owner replay failed'); let connection: DatabaseSync | undefined;
  physical.onRead=db=>{connection=db;throw failure;};
  try {
    let caught: unknown; try { verifyActualOfficialReadReplay(x.input); } catch(error) { caught=error; }
    expect(caught).toBe(failure); expect(connection).toBeDefined(); expect(connection!.isOpen).toBe(false);
    expect(fileHash(x.path)).toBe(x.input.artifactSha256); expect(handles(x.path)).toEqual([]);
  } finally { x.close(); }
});

it('rejects changed owner observations on the reopened connection and closes both reads', () => {
  const x=fixture(), connections:DatabaseSync[]=[];const original=physical.context;
  physical.onRead=db=>{
    connections.push(db);
    if(connections.length===2) physical.context={...physical.context!,closure:{...physical.context!.closure,result:{...physical.context!.closure.result!,workload:{kind:'complete'}}}} as unknown as ActualRoleWorkloadContext;
  };
  try { expect(()=>verifyActualOfficialReadReplay(x.input)).toThrow(/workload|observation/); expect(connections).toHaveLength(2); expect(connections.every(db=>!db.isOpen)).toBe(true); expect(handles(x.path)).toEqual([]); }
  finally { physical.context=original;x.close(); }
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { closeSync, existsSync, lstatSync, openSync, readSync, readdirSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';
import { performance } from 'node:perf_hooks';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import { actualRoleWorkloadContextFromSqlite, prepareActualRoleWorkloadPlan } from '../../../src/host/world/ActualRoleWorkloadEvidenceFromSqlite';
import { assertActualLiveClosureStage } from '../../../src/host/world/ActualLivePlayClosureEvidenceFromSqlite';
import { actorHash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type ReplayArtifactFacts = Readonly<{ path: string; sha256: string; realDisk: true; mainFilename: string; journalMode: 'wal';
  rowCounts: Readonly<Record<string, number>>; workloadActivityKinds: readonly Readonly<{ kind: string; n: number }>[]; wrapperReadOnlyOpenClosedVerified: true }>;
export type OriginalOfficialReplayReceipt = Readonly<{ closureSourceId: string; applicationId: string; officialReceipt: unknown;
  scoring: unknown; workload: unknown; retiredControllerCount: number;
  adjudicationEvidence: Readonly<{ physicalEndReference: unknown; wholeHistoryReference: unknown }>; output: ReplayArtifactFacts }>;
export type ReplayPass = Readonly<{ index: number; connectionId: number; readOnly: boolean; queryOnly: boolean; transactionOwned: boolean;
  transactionClosed: boolean; connectionClosed: boolean; totalChanges: number; walBytesBefore: number | null; walBytesAfter: number | null;
  artifactSha256Before: string; artifactSha256After: string; seconds: number; observation: Readonly<Record<string, unknown>>; observationSha256: string }>;
export type OfficialReadReplayResult = Readonly<{ passes: readonly ReplayPass[]; executed: Readonly<Record<string, number>>;
  checks: Readonly<Record<string, boolean>>; openSqliteHandles: readonly Readonly<{ fd: string; target: string }>[] }>;
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const originalPlayers = ['away-1','home-1','home-2','home-3','home-4','home-5','home-6','home-7','home-8','p2'];
const fileHash = (path: string) => {
  const hash=createHash('sha256'), fd=openSync(path,'r'), buffer=Buffer.allocUnsafe(1024*1024);
  try { for (;;) { const count=readSync(fd,buffer,0,buffer.length,null);if(!count)break;hash.update(buffer.subarray(0,count)); } }
  finally { closeSync(fd); }
  return hash.digest('hex');
};
const artifactHandles = (path: string) => readdirSync('/proc/self/fd').flatMap(fd => {
  try { const target=readlinkSync(`/proc/self/fd/${fd}`);return [path,`${path}-wal`,`${path}-shm`].includes(target)?[{fd,target}]:[]; }
  catch { return []; }
});
const closedArtifact = (path: string, expectedHash: string) => {
  assert(isAbsolute(path) && normalize(path)===path && realpathSync(path)===path && lstatSync(path).isFile(),'replay artifact path identity differs');
  const walBytes=existsSync(`${path}-wal`)?statSync(`${path}-wal`).size:null;
  assert(walBytes===null || walBytes===0,'replay artifact WAL is not empty');
  assert.deepEqual(artifactHandles(path),[],'replay artifact has an open handle');
  assert.equal(fileHash(path),expectedHash,'replay artifact hash differs');return walBytes;
};

/** Read-only compatibility proof for an already admitted original official
 * artifact. Producer/provenance/Source admission remains the caller's job.
 * This never applies official or workload effects or authorizes activation. */
export const verifyActualOfficialReadReplay = (input: Readonly<{ artifactPath: string; artifactSha256: string;
  originalReceipt: OriginalOfficialReplayReceipt; progress?: (message: string) => void }>): OfficialReadReplayResult => {
  const path=input.artifactPath, original=input.originalReceipt, progress=input.progress??(()=>{});
  assert.match(input.artifactSha256,/^[a-f0-9]{64}$/);
  assert.equal(original.output.path,path,'replay artifact path differs');
  assert.equal(original.output.sha256,input.artifactSha256,'replay original artifact hash differs');
  const passes: ReplayPass[]=[], executed={readOnlyConnections:0,readTransactions:0,roleContextReads:0,strictCurrentStageChecks:0,preparedPlanReads:0,
    officialHelperCalls:0,officialWrites:0,newOfficialApplications:0,newWorkloadActivities:0,newPhysicalPitchActions:0};
  for(let index=0;index<2;index++){
    const walBytesBefore=closedArtifact(path,input.artifactSha256), started=performance.now();
    const db=new DatabaseSync(path,{readOnly:true});executed.readOnlyConnections++;
    let observation: Readonly<Record<string,unknown>>;
    try {
      progress(`read pass ${index+1}: opened a fresh read-only connection`);
      executed.readTransactions++;
      observation=withSqliteReadTransaction(db,()=>{
        assert.equal(db.isTransaction,true);assert.equal(db.prepare('PRAGMA query_only').get()!.query_only,1);
        assert.equal(db.prepare('PRAGMA database_list').all().find(row=>row.name==='main')!.file,path);
        assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode,'wal');
        const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>String(row.name));
        const rowCounts=Object.fromEntries(tables.map(name=>[name,Number(db.prepare(`SELECT count(*) AS n FROM "${name.replaceAll('"','""')}"`).get()!.n)]));
        assert.deepEqual(rowCounts,original.output.rowCounts,'replay census differs');
        for(const name of ['actual_role_workload_assessments','actual_role_workload_settlements','world_player_workload_activities'])
          assert.equal(rowCounts[name]??0,0,'replay census contains prior role rows');
        for(const name of ['applications','physical_pitch_progress_actions','actual_first_base_play_ends','actual_live_play_fences'])
          assert.equal(rowCounts[name],1,'replay original bounded census differs');
        const workloadActivityKinds=tables.includes('world_player_workload_activities')?db.prepare("SELECT json_extract(source_json,'$.kind') AS kind,count(*) AS n FROM world_player_workload_activities GROUP BY kind ORDER BY kind").all()
          .map(row=>({kind:String(row.kind),n:Number(row.n)})):[];
        assert.deepEqual(workloadActivityKinds,[]);assert.deepEqual(workloadActivityKinds,original.output.workloadActivityKinds);
        progress(`read pass ${index+1}: authenticating the original official context`);
        executed.roleContextReads++;
        const context=actualRoleWorkloadContextFromSqlite(db,original.closureSourceId), closure=context.closure, result=closure.result;
        assert.equal(closure.status,'OFFICIAL_APPLIED');assert.equal(closure.officialApplied,true);assert(result);
        assert.equal(closure.source.sourceId,original.closureSourceId);assert.equal(context.reference.closureSourceId,original.closureSourceId);
        assert.equal(context.p.application.applicationId,original.applicationId);
        executed.strictCurrentStageChecks++;assertActualLiveClosureStage(db,context.p,true,true);
        assert.deepEqual(result.official.receipt,original.officialReceipt,'replay official receipt differs');
        assert.deepEqual(result.scoring,original.scoring,'replay scoring differs');assert.equal(result.scoring.kind,'unsupported');
        assert.deepEqual(result.workload,original.workload,'replay workload differs');assert.equal(result.workload.kind,'pending');
        assert.equal(result.controllerReset.retired.length,original.retiredControllerCount);assert.equal(result.controllerReset.retired.length,10);
        assert.deepEqual(context.p.physicalEndReference,original.adjudicationEvidence.physicalEndReference);
        assert.deepEqual(context.p.wholeHistoryReference,original.adjudicationEvidence.wholeHistoryReference);
        const participantReferences=context.actors.map(actor=>({playerId:actor.binding.playerId,personId:actor.person.personId,clubId:actor.binding.clubId,
          careerId:actor.binding.careerId,gameId:actor.binding.gameId,playId:context.p.playId,gameDay:actor.binding.gameDay,
          bindingHash:actorHash(actor.binding),personHash:actorHash(actor.person)}));
        assert.deepEqual(participantReferences.map(actor=>actor.playerId),originalPlayers);
        assert.equal(new Set(participantReferences.map(actor=>actor.personId)).size,10);
        assert(participantReferences.every(actor=>actor.careerId===context.reference.careerId && actor.gameId===context.reference.gameId && actor.gameDay===context.reference.gameDay));
        executed.preparedPlanReads++;
        const pending=prepareActualRoleWorkloadPlan(db,context);assert.equal(pending.kind,'pending');
        if(pending.kind!=='pending')throw new Error('replay role inputs must remain pending');
        assert.deepEqual(pending.missingAssessments,originalPlayers);
        assert(new Set(pending.missingBaselines).size===pending.missingBaselines.length && pending.missingBaselines.every(player=>originalPlayers.includes(player)));
        assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n,0,'replay connection wrote changes');
        return {closureSourceId:original.closureSourceId,applicationId:original.applicationId,closureStatus:closure.status,officialApplied:true,
          currentMatchExact:true,currentHeadsAuthenticated:true,closureProposalHash:context.reference.closureProposalHash,
          adjudicationReference:context.p.adjudicationReference,officialReceipt:result.official.receipt,scoring:result.scoring,workload:result.workload,
          retiredControllerCount:result.controllerReset.retired.length,physicalEndReference:context.p.physicalEndReference,
          wholeHistoryReference:context.p.wholeHistoryReference,participantReferences,
          preparedPlan:{kind:pending.kind,missingAssessments:pending.missingAssessments,missingBaselines:pending.missingBaselines},
          artifact:{path,sha256:input.artifactSha256,realDisk:true,mainFilename:path,journalMode:'wal',rowCounts,workloadActivityKinds,wrapperReadOnlyOpenClosedVerified:true}};
      });
      assert.equal(db.isTransaction,false,'replay read transaction remains open');
    } finally { if(db.isOpen)db.close(); }
    assert.equal(db.isOpen,false);
    const walBytesAfter=closedArtifact(path,input.artifactSha256);
    if(index===1)assert.deepEqual(observation,passes[0].observation,'reopened replay observation differs');
    passes.push({index,connectionId:index+1,readOnly:true,queryOnly:true,transactionOwned:true,transactionClosed:true,connectionClosed:true,totalChanges:0,
      walBytesBefore,walBytesAfter,artifactSha256Before:input.artifactSha256,artifactSha256After:input.artifactSha256,
      seconds:(performance.now()-started)/1000,observation,observationSha256:createHash('sha256').update(JSON.stringify(observation)).digest('hex')});
    progress(`read pass ${index+1}: transaction and connection closed; original bytes preserved`);
  }
  return {passes,executed,checks:{artifactUnchanged:true,closeReopenEqual:true,readOnlyEnforced:true},openSqliteHandles:artifactHandles(path)};
};

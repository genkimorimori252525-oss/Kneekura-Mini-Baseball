import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { constants,copyFileSync,existsSync,readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash,actorJson as json,readPhysicalPlateAppearanceActorFromSqlite,
  assertPhysicalActorOpenFrame,type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { playerWorkloadRecoveryStoreFromSqlite,type AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { assertSamePaStorage } from './SamePlateAppearanceReservationGuard';
import { fileHash,rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

type FileReference=Readonly<{path:string;sha256:string}>;
type ActorReference=Readonly<{owner:'physical_plate_appearance_actors';sourceId:string;sourceHash:string;snapshotHash:string}>;
type AcceptedInput=Readonly<{
  version:'same_pa_away2_baseline_accepted_input_v1';privateFixtureAccepted:true;
  acceptedProposal:FileReference;acceptedFixtureManifest:FileReference;qualifiedActorManifest:FileReference;
  inventoryReceipt:FileReference;inventoryTerminal:FileReference;baselineSource:AcceptedPlayerWorkloadBaseline;
}>;
const {DatabaseSync:NativeDatabase}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const same=(actual:unknown,expected:unknown)=>assert.equal(json(actual),json(expected));
const withoutRowid=(row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).filter(([key])=>key!=='__ack_rowid'));
const closed=(path:string)=>{for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(path+suffix),'baseline prerequisite artifact has a sidecar: '+suffix);};
const readPinned=<T>(ref:FileReference):T=>{assert.equal(fileHash(ref.path),ref.sha256);return JSON.parse(readFileSync(ref.path,'utf8')) as T;};
const totalChanges=(db:DatabaseSync)=>{const value=db.prepare('SELECT total_changes() AS n').get()!.n;assert.equal(typeof value,'number');return value as number;};
const refs=(db:DatabaseSync,actor:DurablePhysicalPlateAppearanceActor)=>[actor.binding,...actor.defenderBindings].map(binding=>{
  const state=readActualRoleWorkloadState(db,binding.careerId,binding.playerId,undefined,binding.personLinkSourceId);
  if(!state)return {playerId:binding.playerId,reference:null};
  const row=db.prepare('SELECT source_id,source_json FROM world_player_workload_baselines WHERE career_id=? AND player_id=?').get(binding.careerId,binding.playerId);assert(row);
  return {playerId:binding.playerId,reference:{playerId:binding.playerId,baselineSourceId:String(row.source_id),revision:state.revision,stateHash:hash(state)},baselineSourceHash:hash(JSON.parse(String(row.source_json)))};
});
const originalActor=(db:DatabaseSync,reference:ActorReference)=>{
  const actor=readPhysicalPlateAppearanceActorFromSqlite(db,reference.sourceId);assert(actor);assertPhysicalActorOpenFrame(db,actor);
  assert.equal(hash(actor.source),reference.sourceHash);assert.equal(hash(actor),reference.snapshotHash);
  assert.equal(actor.binding.playerId,'away-2');assert.equal(actor.match.playId,8);
  assert.equal(new Set([actor.binding,...actor.defenderBindings].map(b=>b.playerId)).size,10);
  assert.equal(new Set([actor.binding,...actor.defenderBindings].map(b=>b.personId)).size,10);
  return actor;
};

/** A separately accepted private fixture prerequisite only. The ordinary global
 * Player owner receives its exact Source; no reservation or physical owner writes. */
export const verifySamePaBaselinePrerequisite=(input:Readonly<{inputPath:string;inputSha256:string;destinationPath:string}>)=>{
  assert(process.env.BASEBALL_GATE_RUNTIME&&process.env.BASEBALL_GATE_LOCKS,'private bounded controller required');
  assert.equal(fileHash(input.inputPath),input.inputSha256);
  const packet=JSON.parse(readFileSync(input.inputPath,'utf8')) as AcceptedInput;
  assert.equal(packet.version,'same_pa_away2_baseline_accepted_input_v1');assert.equal(packet.privateFixtureAccepted,true);
  const proposed=readPinned<{candidateBaselineSource:AcceptedPlayerWorkloadBaseline}>(packet.acceptedProposal);
  same(packet.baselineSource,proposed.candidateBaselineSource);
  const source=packet.baselineSource;
  const fixture=readPinned<{nextBatterPlayerId:string;fixtureInputs:{missingRoleBaselineRecipe:{createdAtDay:string;fatigue:number;recoveryCapacity:number;policy:AcceptedPlayerWorkloadBaseline['policy']}}}>(packet.acceptedFixtureManifest);
  assert.equal(fixture.nextBatterPlayerId,source.playerId);
  const recipe=fixture.fixtureInputs.missingRoleBaselineRecipe;assert.equal(recipe.createdAtDay,'original authenticated game day');
  same({fatigue:source.fatigue,recoveryCapacity:source.recoveryCapacity,policy:source.policy},
    {fatigue:recipe.fatigue,recoveryCapacity:recipe.recoveryCapacity,policy:recipe.policy});
  const qualified=readPinned<{version:string;qualified:boolean;artifact:FileReference;qualification:{receipt:FileReference}}>(packet.qualifiedActorManifest);
  assert.equal(qualified.version,'terminal_next_actor_checkpoint_input_v1');assert.equal(qualified.qualified,true);
  const actorReceipt=readPinned<{actorSourceId:string;acceptedActorPlayerId:string;pitchSourceId:null;pitchWriterInvoked:boolean;readinessReference:unknown}>(qualified.qualification.receipt);
  assert.equal(actorReceipt.acceptedActorPlayerId,source.playerId);assert.equal(actorReceipt.pitchSourceId,null);assert.equal(actorReceipt.pitchWriterInvoked,false);
  const inventory=readPinned<{kind:string;actorReference:ActorReference;missingBaselinePlayerIds:string[];participantBaselineReferences:unknown[];reservationAttempted:boolean}>(packet.inventoryReceipt);
  assert.equal(inventory.kind,'authenticated_actor_prerequisites');same(inventory.missingBaselinePlayerIds,[source.playerId]);assert.equal(inventory.reservationAttempted,false);
  const priorTerminal=readPinned<{status:string;remainingOwnedProcesses:unknown[];tests:{passedCases:number;reportSha256:string}}>(packet.inventoryTerminal);
  assert.equal(priorTerminal.status,'passed');same(priorTerminal.remainingOwnedProcesses,[]);assert.equal(priorTerminal.tests.passedCases,1);
  assert.equal(inventory.actorReference.sourceId,actorReceipt.actorSourceId);
  const sourcePath=qualified.artifact.path;assert.notEqual(sourcePath,input.destinationPath);assert(!existsSync(input.destinationPath));
  closed(sourcePath);assert.equal(fileHash(sourcePath),qualified.artifact.sha256);
  copyFileSync(sourcePath,input.destinationPath,constants.COPYFILE_EXCL);assert.equal(fileHash(input.destinationPath),qualified.artifact.sha256);

  const opened:DatabaseSync[]=[],open=()=>{const db=new NativeDatabase(input.destinationPath);opened.push(db);return db;};
  const db=open();let writer:ReturnType<typeof playerWorkloadRecoveryStoreFromSqlite>|null=null;
  const witnesses:ReturnType<typeof witnessSqliteWrite>[]=[];
  try{
    console.info('SP_BASELINE_PROGRESS=authenticating original actor and absent baseline');
    const before=withSqliteReadTransaction(db,()=>withBattedWorldPhysicalReadTraversal(db,()=>{
      const actor=originalActor(db,inventory.actorReference),binding=actor.binding;
      same(actor.origin.foulTerminalReadiness,actorReceipt.readinessReference);
      same({careerId:source.careerId,playerId:source.playerId,personLinkSourceId:source.personLinkSourceId,createdAtDay:source.createdAtDay},
        {careerId:binding.careerId,playerId:binding.playerId,personLinkSourceId:binding.personLinkSourceId,createdAtDay:binding.gameDay});
      const person=playerPersonLinkEvidenceFromSqlite(db).readLink(source.personLinkSourceId);same(person,actor.person);assert(person);assert(person.acceptedAtDay<=source.createdAtDay);
      assert.equal(assertSamePaStorage(db),false);
      assert.equal(readActualRoleWorkloadState(db,source.careerId,source.playerId,undefined,source.personLinkSourceId),null);
      assert.equal(db.prepare('SELECT policy_json FROM world_player_workload_policies WHERE career_id=? AND policy_id=? AND version=?').get(source.careerId,source.policy.policyId,source.policy.version)?.policy_json,json(source.policy));
      const baselines=refs(db,actor);same(baselines.filter(p=>p.reference===null).map(p=>p.playerId),[source.playerId]);
      same(baselines.filter(p=>p.reference!==null).map(p=>p.reference),inventory.participantBaselineReferences);
      return {actor,baselines,rows:rawCensus(db),schema:schemaCensus(db)};
    }));
    console.info('SP_BASELINE_PROGRESS=accepted actor, Person, recipe and nine retained states authenticated');
    let baselineReads=0,activityReads=0;
    writer=playerWorkloadRecoveryStoreFromSqlite(db,playerPersonLinkEvidenceFromSqlite(db),{
      readAcceptedBaseline:sourceId=>{baselineReads++;assert.equal(sourceId,source.sourceId);return source;},
      readAcceptedActivity:()=>{activityReads++;return null;},
    });
    same(rawCensus(db),before.rows);same(schemaCensus(db),before.schema);
    const observed:{kind:string;changes:number}[]=[],connections=new Set<DatabaseSync>(),changesBefore=totalChanges(db);
    for(const [kind,sql] of [['baseline','INSERT INTO world_player_workload_baselines VALUES (?, ?, ?, ?, ?)'],['head','INSERT INTO world_player_workload_heads VALUES (?, ?, ?, ?)']] as const){
      witnesses.push(witnessSqliteWrite(sql,connection=>{
        assert.equal(connection,db);assert(connection.isTransaction);assert.equal(connection.prepare('PRAGMA query_only').get()!.query_only,0);
        assert.equal(connection.prepare('PRAGMA database_list').all().find(r=>r.name==='main')?.file,input.destinationPath);
        connections.add(connection);observed.push({kind,changes:totalChanges(connection)-changesBefore});return true;
      }));
    }
    const initial=writer.initialize(source.sourceId);
    same(observed,[{kind:'baseline',changes:1},{kind:'head',changes:2}]);assert.equal(connections.size,1);assert.equal(totalChanges(db)-changesBefore,2);
    assert.equal(db.isTransaction,false);assert.equal(db.prepare('PRAGMA query_only').get()!.query_only,0);
    assert.equal(initial.revision,0);assert.equal(initial.effectiveDay,source.createdAtDay);
    const expectedRows=structuredClone(before.rows);
    const actualBaseline=db.prepare('SELECT rowid AS __ack_rowid,* FROM world_player_workload_baselines WHERE source_id=?').get(source.sourceId);assert(actualBaseline);
    same(withoutRowid(actualBaseline),{source_id:source.sourceId,career_id:source.careerId,player_id:source.playerId,source_json:json(source),initial_json:json(initial)});
    const actualHead=db.prepare('SELECT rowid AS __ack_rowid,* FROM world_player_workload_heads WHERE career_id=? AND player_id=?').get(source.careerId,source.playerId);assert(actualHead);
    same(withoutRowid(actualHead),{career_id:source.careerId,player_id:source.playerId,revision:0,state_json:json(initial)});
    for(const [table,added] of [['world_player_workload_baselines',actualBaseline],['world_player_workload_heads',actualHead]] as const){
      const existing=expectedRows.find(t=>t.table===table);assert(existing);
      assert.equal(added.__ack_rowid,Number(existing.rows.at(-1)?.__ack_rowid??0)+1);existing.rows.push(added);
    }
    same(rawCensus(db),expectedRows);same(schemaCensus(db),before.schema);
    const after=withSqliteReadTransaction(db,()=>{
      const state=readActualRoleWorkloadState(db,source.careerId,source.playerId,undefined,source.personLinkSourceId);same(state,initial);
      const baselines=refs(db,before.actor);assert(baselines.every(p=>p.reference!==null));
      same(baselines.filter(p=>p.playerId!==source.playerId),before.baselines.filter(p=>p.playerId!==source.playerId));return baselines;
    });
    same(writer.initialize(source.sourceId),initial);assert.equal(totalChanges(db)-changesBefore,2);assert.equal(baselineReads,2);assert.equal(activityReads,0);
    assert.equal(observed.length,2);same(rawCensus(db),expectedRows);same(schemaCensus(db),before.schema);
    while(witnesses.length)witnesses.pop()!.close();
    writer.close();writer=null;assert.equal(db.isOpen,false);closed(input.destinationPath);
    const committedHash=fileHash(input.destinationPath);
    console.info('SP_BASELINE_PROGRESS=exactly two writes and zero-write retry complete; reopening normally');

    const reopened=open(),offline=playerWorkloadRecoveryStoreFromSqlite(reopened,playerPersonLinkEvidenceFromSqlite(reopened));
    try{withSqliteReadTransaction(reopened,()=>withBattedWorldPhysicalReadTraversal(reopened,()=>{
      same(rawCensus(reopened),expectedRows);same(schemaCensus(reopened),before.schema);
      const actor=originalActor(reopened,inventory.actorReference);same(actor,before.actor);
      same(offline.readHead(source.careerId,source.playerId),initial);same(refs(reopened,actor),after);
      assert.equal(assertSamePaStorage(reopened),false);assert.equal(totalChanges(reopened),0);
    }));}finally{offline.close();}
    assert(opened.every(connection=>!connection.isOpen));closed(input.destinationPath);assert.equal(fileHash(input.destinationPath),committedHash);
    closed(sourcePath);assert.equal(fileHash(sourcePath),qualified.artifact.sha256);assert.equal(fileHash(input.inputPath),input.inputSha256);
    for(const ref of [packet.acceptedProposal,packet.acceptedFixtureManifest,packet.qualifiedActorManifest,packet.inventoryReceipt,packet.inventoryTerminal])assert.equal(fileHash(ref.path),ref.sha256);
    const created=after.find(p=>p.playerId===source.playerId);assert(created?.reference&&'baselineSourceHash' in created);
    return {version:'same_pa_away2_baseline_prerequisite_v1',acceptedInput:{path:input.inputPath,sha256:input.inputSha256},
      sourceArtifact:qualified.artifact,destinationPath:input.destinationPath,destinationSha256:committedHash,
      actorReference:inventory.actorReference,acceptedBaselineSource:source,acceptedBaselineSourceHash:hash(source),
      observedBaselineReference:created.reference,observedBaselineSourceHash:created.baselineSourceHash,
      participantBaselineReferences:after.map(p=>p.reference),writerObservation:{nativeConnections:connections.size,statements:observed,totalChanges:2},
      baselineAuthorityReads:baselineReads,activityAuthorityReads:activityReads,exactRetry:true,callbackFreeReadOnlyReopen:true,
      originalRowsAndRowidsPreserved:true,schemaUnchanged:true,closedHandles:true,closedSidecars:true,inputBytesUnchanged:true,
      newBaselineRows:1,newHeadRows:1,newPolicyRows:0,newActivityRows:0,reservationAttempted:false,physicalPitchWriterInvoked:false,
      successorRightWritten:false,reservationReleased:false,fixtureOnly:true,productionCalibrationClaim:false};
  }finally{
    while(witnesses.length)witnesses.pop()!.close();
    writer?.close();for(const connection of opened)if(connection.isOpen)connection.close();
  }
};

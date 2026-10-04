import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { actualRoleWorkloadContextFromSqlite } from './ActualRoleWorkloadEvidenceFromSqlite';
import { openSqliteActualRoleWorkloadStore } from './SqliteActualRoleWorkloadStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerWorkloadRecoveryStore, type AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import type { AcceptedActualRoleWorkloadAssessment } from './ActualRoleWorkloadAssessment';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { withActualRoleWorkloadRecoveryCopy } from './ActualRoleWorkloadRecoveryArtifact.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
const literal=(value:string)=>`'${value.replaceAll("'","''")}'`;
/** Explicit synthetic calibration/effort acceptance on a separate authenticated
 * original-chain backup. This is a scheduled heavy integration harness, never an
 * automatic effort model and never a test that silently fabricates a physical end. */
export const verifyActualRoleWorkloadArtifact=async(input:Readonly<{
  sourcePath:string;destinationPath:string;closureSourceId:string;faultChecks:boolean;
  progress?:(message:string)=>void;
}>)=>{
  assert.notEqual(input.sourcePath,input.destinationPath);assert.equal(existsSync(input.destinationPath),false);
  mkdirSync(dirname(input.destinationPath),{recursive:true});
  const originalHash=fileHash(input.sourcePath),source=new DatabaseSync(input.sourcePath,{readOnly:true});
  try{await backup(source,input.destinationPath);}finally{source.close();}
  const resources:{close():void}[]=[];
  const track=<T extends {close():void}>(resource:T):T=>{resources.push(resource);return resource;};
  const drain=()=>{while(resources.length)resources.pop()!.close();};
  try {
  const db=track(new DatabaseSync(input.destinationPath)),links=track(openSqlitePlayerPersonLinkStore(input.destinationPath));
  const assessments=new Map<string,AcceptedActualRoleWorkloadAssessment>(),baselines=new Map<string,AcceptedPlayerWorkloadBaseline>();
  const owner=track(openSqliteActualRoleWorkloadStore(input.destinationPath,links,{readAcceptedAssessment:id=>assessments.get(id)??null,readAcceptedBaseline:id=>baselines.get(id)??null}));
  const count=(table:string)=>Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n);
  let complete:ReturnType<typeof owner.settle>|null=null;
  const assertPlayableEffects=(connection:Pick<import('node:sqlite').DatabaseSync,'prepare'>)=>{
    assert(complete && complete.kind==='complete');
    const activities=connection.prepare('SELECT source_json FROM world_player_workload_activities').all();
    assert.equal(activities.length,10);assert(activities.every(row=>JSON.parse(String(row.source_json)).kind==='MATCH'));
    for(const p of complete.participants)assert.equal(json(readActualRoleWorkloadState(connection,complete.careerId,p.playerId)),json(p.after));
  };
  const report=input.progress??(()=>{});
  try{
    assert.equal(db.prepare('PRAGMA database_list').all().find(r=>r.name==='main')!.file,input.destinationPath);
    assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode,'wal');
    report('authenticated original closure');
    const context=actualRoleWorkloadContextFromSqlite(db,input.closureSourceId),ref=context.reference;
    assert.equal(context.actors.length,10);assert.equal(context.closure.officialApplied,true);
    assert.equal(count('world_player_workload_activities'),0);
    const pending=owner.readSettlement(input.closureSourceId);assert.equal(pending.kind,'pending');
    assert.deepEqual(pending.kind==='pending'?pending.missingAssessments:[],context.actors.map(a=>a.binding.playerId));
    const fixtureEffort=[0,1,2,3,4,5,6,7,8,9]; // Accepted fixture inputs, never production defaults.
    for(const [i,actor]of context.actors.entries()){
      const playerId=actor.binding.playerId,sourceId=`fixture-total-effort:${playerId}`;
      assessments.set(sourceId,{sourceId,sourceVersion:'fixture-v1',closureSourceId:input.closureSourceId,
        physicalEndReference:ref.physicalEndReference,wholeHistoryReference:ref.wholeHistoryReference,
        participantReference:{playerId,bindingHash:hash(actor.binding),personHash:hash(actor.person)},effortUnits:fixtureEffort[i],
        provenance:{assessmentSourceId:`explicit-fixture-assessment:${playerId}`,assessmentVersion:'fixture-v1',calibrationSourceId:'explicit-fixture-total-effort',calibrationVersion:'fixture-v1'}});
      if(!readActualRoleWorkloadState(db,ref.careerId,playerId)){
        const baseline:AcceptedPlayerWorkloadBaseline={sourceId:`fixture-role-baseline:${playerId}`,sourceVersion:'fixture-v1',personLinkSourceId:actor.binding.personLinkSourceId,
          careerId:ref.careerId,playerId,createdAtDay:ref.gameDay,fatigue:0.1,recoveryCapacity:0.5,
          policy:{policyId:'explicit-role-workload-fixture',version:'fixture-v1',availableAtDay:0,workloadFatiguePerUnit:0.01,travelFatiguePerKm:0.001,recoveryPerHour:0.1}};
        baselines.set(baseline.sourceId,baseline);
      }
    }
    if(input.faultChecks){
      db.exec(`CREATE TRIGGER fixture_corrupt_assessment AFTER INSERT ON actual_role_workload_assessments BEGIN
        UPDATE actual_role_workload_assessments SET source_json=json_set(source_json,'$.effortUnits',999) WHERE source_id=NEW.source_id; END;`);
      assert.throws(()=>owner.acceptAssessments([...assessments.keys()]));assert.equal(count('actual_role_workload_assessments'),0);
      db.exec('DROP TRIGGER fixture_corrupt_assessment');
    }
    report('accepting all original participant assessments');
    owner.acceptAssessments([...assessments.keys()]);assert.equal(count('actual_role_workload_assessments'),10);
    assert.equal(count('world_player_workload_activities'),0);
    const baselinePending=owner.freeze(input.closureSourceId);
    if(baselines.size){assert.equal(baselinePending.kind,'pending');assert.deepEqual(baselinePending.kind==='pending'?baselinePending.missingBaselines:[],context.actors.filter(a=>baselines.has(`fixture-role-baseline:${a.binding.playerId}`)).map(a=>a.binding.playerId));}
    for(const sourceId of baselines.keys())owner.initializeBaseline(sourceId);
    if(input.faultChecks){
      db.exec(`CREATE TRIGGER fixture_corrupt_freeze AFTER INSERT ON actual_role_workload_settlements BEGIN
        UPDATE world_player_workload_heads SET revision=revision+1 WHERE player_id=${literal(context.actors[0].binding.playerId)}; END;`);
      assert.throws(()=>owner.freeze(input.closureSourceId));assert.equal(count('actual_role_workload_settlements'),0);assert.equal(count('world_player_workload_activities'),0);
      db.exec('DROP TRIGGER fixture_corrupt_freeze');
    }
    report('freezing exact settlement-time BEFORE states');
    const frozen=owner.freeze(input.closureSourceId);assert.equal(frozen.kind,'applying');
    assert(frozen.participants.every(p=>!p.applied));assert.equal(frozen.capturedAt,'settlement_freeze');
    if(input.faultChecks){
      const stalePath=`${input.destinationPath}.stale.sqlite`;assert.equal(existsSync(stalePath),false);await backup(db,stalePath);
      const staleResources:{close():void}[]=[];
      const trackStale=<T extends {close():void}>(resource:T):T=>{staleResources.push(resource);return resource;};
      try {
      const staleLinks=trackStale(openSqlitePlayerPersonLinkStore(stalePath)),staleOwner=trackStale(openSqliteActualRoleWorkloadStore(stalePath,staleLinks)),staleDb=trackStale(new DatabaseSync(stalePath));
      const first=frozen.participants[0],travel={sourceEventId:'fixture-intervening-travel',sourceVersion:'fixture-v1',evidenceId:'explicit-fixture-travel',
        careerId:ref.careerId,playerId:first.playerId,atDay:ref.gameDay,kind:'TRAVEL' as const,distanceKm:0};
      const staleGlobal=trackStale(openSqlitePlayerWorkloadRecoveryStore(stalePath,staleLinks,{readAcceptedBaseline:()=>null,readAcceptedActivity:id=>id===travel.sourceEventId?travel:null}));
        staleGlobal.apply(travel.sourceEventId,first.before.revision);
        assert.throws(()=>staleOwner.settle(input.closureSourceId),/revision|BEFORE/);
        assert.equal(Number(staleDb.prepare('SELECT count(*) AS n FROM world_player_workload_activities').get()!.n),1);
        assert.equal(staleGlobal.readActivity(first.activity.sourceEventId),null);
      }finally{while(staleResources.length)staleResources.pop()!.close();}
      const first=frozen.participants[0];
      db.exec(`CREATE TRIGGER fixture_corrupt_workload_write AFTER INSERT ON world_player_workload_activities
        WHEN NEW.source_id=${literal(first.activity.sourceEventId)} BEGIN UPDATE actual_role_workload_assessments SET source_hash='forged' WHERE source_id=${literal(first.assessmentSourceId)}; END;`);
      assert.throws(()=>owner.settle(input.closureSourceId));assert.equal(count('world_player_workload_activities'),0);
      assert.equal(db.prepare('SELECT source_hash FROM actual_role_workload_assessments WHERE source_id=?').get(first.assessmentSourceId)!.source_hash,hash(assessments.get(first.assessmentSourceId)!));
      db.exec('DROP TRIGGER fixture_corrupt_workload_write');
      const changed=frozen.participants[0].assessmentSourceId,original=assessments.get(changed)!;
      assessments.set(changed,{...original,effortUnits:original.effortUnits+1});assert.throws(()=>owner.settle(input.closureSourceId),/frozen differently/);
      assert.equal(count('world_player_workload_activities'),0);assessments.set(changed,original);
      const blocked=frozen.participants[1];
      db.exec(`CREATE TRIGGER fixture_interrupt_settlement BEFORE INSERT ON world_player_workload_activities
        WHEN NEW.source_id=${literal(blocked.activity.sourceEventId)} BEGIN SELECT RAISE(ABORT,'fixture interruption'); END;`);
      assert.throws(()=>owner.settle(input.closureSourceId),/fixture interruption/);assert.equal(count('world_player_workload_activities'),1);
      db.exec('DROP TRIGGER fixture_interrupt_settlement');
      const interrupted=owner.readSettlement(input.closureSourceId);assert.equal(interrupted.kind,'applying');
      assert.equal(interrupted.participants.filter(p=>p.applied).length,1);
    }
    report('applying accepted total-play effort through existing workload owner');
    complete=owner.settle(input.closureSourceId);assert.equal(complete.kind,'complete');assert.equal(count('world_player_workload_activities'),10);
    assert.equal(json(owner.settle(input.closureSourceId)),json(complete));assert.equal(count('world_player_workload_activities'),10);
    assert(complete.participants.every(p=>p.applied&&p.after.revision===p.before.revision+1));
    assert.equal(complete.participants[0].activity.effortUnits,0);assert.equal(complete.participants[0].before.fatigue,complete.participants[0].after.fatigue);
    assertPlayableEffects(db);
  }finally{drain();}
  report('all connections closed; reopening playable disk without recovery');
  const reopenedLinks=track(openSqlitePlayerPersonLinkStore(input.destinationPath)),reopened=track(openSqliteActualRoleWorkloadStore(input.destinationPath,reopenedLinks)),reopenedDb=track(new DatabaseSync(input.destinationPath));
  try{
    assert.equal(json(reopened.readSettlement(input.closureSourceId)),json(complete));assert.equal(json(reopened.settle(input.closureSourceId)),json(complete));
    assertPlayableEffects(reopenedDb);
  }finally{drain();}
  assert(complete && complete.kind==='complete');const completed=complete;
  report('testing day-level recovery only on an isolated backup; no elapsed World time is claimed');
  const recoveryRegression=await withActualRoleWorkloadRecoveryCopy(input.destinationPath,recoveryPath=>{
    const p=completed.participants[0],recovery={sourceEventId:'fixture-actual-recovery-after-settlement',sourceVersion:'fixture-v1',evidenceId:'explicit-fixture-recovery',
      careerId:completed.careerId,playerId:p.playerId,atDay:completed.gameDay,kind:'RECOVERY' as const,durationHours:1,quality:1,medicalAvailability:1};
    const recoveryLinks=track(openSqlitePlayerPersonLinkStore(recoveryPath)),recoveryOwner=track(openSqliteActualRoleWorkloadStore(recoveryPath,recoveryLinks));
    const global=track(openSqlitePlayerWorkloadRecoveryStore(recoveryPath,recoveryLinks,{readAcceptedBaseline:()=>null,readAcceptedActivity:id=>id===recovery.sourceEventId?recovery:null}));
    let recovered:ReturnType<typeof global.apply>;
    try{
      recovered=global.apply(recovery.sourceEventId,p.after.revision);assert.equal(recovered.revision,p.after.revision+1);
      assert.equal(json(recoveryOwner.readSettlement(input.closureSourceId)),json(completed));
    }finally{drain();}
    const laterLinks=track(openSqlitePlayerPersonLinkStore(recoveryPath)),laterOwner=track(openSqliteActualRoleWorkloadStore(recoveryPath,laterLinks));
    const laterGlobal=track(openSqlitePlayerWorkloadRecoveryStore(recoveryPath,laterLinks));
    try{
      assert.equal(json(laterOwner.readSettlement(input.closureSourceId)),json(completed));assert.equal(json(laterOwner.settle(input.closureSourceId)),json(completed));
      assert.equal(json(laterGlobal.readHead(completed.careerId,p.playerId)),json(recovered));
      assert.equal(json(laterGlobal.readActivity(recovery.sourceEventId)?.activity),json(recovery));
    }finally{drain();}
  });
  const untouched=track(new DatabaseSync(input.destinationPath,{readOnly:true}));
  try{assertPlayableEffects(untouched);}finally{drain();}
  assert.equal(fileHash(input.sourcePath),originalHash);
  return {sourceSha256:originalHash,destinationSha256:fileHash(input.destinationPath),destinationPath:input.destinationPath,
    sourceUnchanged:true,realDisk:true,wal:true,allConnectionsClosedReopened:true,participantCount:10,exactlyOnce:true,
    syntheticFixtureInputs:true,automaticEffortGeneration:false,faultChecks:input.faultChecks,settlement:complete,
    playableArtifactRecoveryActivities:0,playableHeadsEqualFrozenAfter:true,recoveryRegression:{...recoveryRegression,acceptedFixtureDurationHours:1}};
  }finally{drain();}
};

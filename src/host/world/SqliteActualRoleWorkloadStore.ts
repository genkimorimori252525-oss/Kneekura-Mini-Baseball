import { assertNoSamePaPlayerReservation } from './SamePlateAppearanceReservationGuard';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actualRoleWorkloadAssessmentInput as input, type AcceptedActualRoleWorkloadAssessment } from './ActualRoleWorkloadAssessment';
import { actualRoleWorkloadContextFromSqlite as context, deriveActualRoleWorkloadAssessment as derive, readActualRoleAssessments,
  prepareActualRoleWorkloadPlan, actualRoleWorkloadEvidenceFromSqlite as evidence } from './ActualRoleWorkloadEvidenceFromSqlite';
import { actualRoleWorkloadIdentityRow as identity } from './ActualRoleWorkloadMetadata';
import { assertNoLegacyPitchWorkloadCharge } from './ActualRoleWorkloadChargeGuard';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { openSqlitePlayerWorkloadRecoveryStore, type AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import type { SqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayId as id } from './ActualLivePlayScope';
export type AcceptedActualRoleWorkloadAuthority=Readonly<{
  readAcceptedAssessment(sourceId:string):AcceptedActualRoleWorkloadAssessment|null;
  readAcceptedBaseline?(sourceId:string):AcceptedPlayerWorkloadBaseline|null;
}>;
/** Durable accepted-input producer and resumable settlement coordinator. Every
 * state mutation is delegated to the existing Player workload/recovery owner. */
export const openSqliteActualRoleWorkloadStore=(path:string,personLinks:Pick<SqlitePlayerPersonLinkStore,'readLink'>,
  authority?:AcceptedActualRoleWorkloadAuthority)=>{
  if(!id(path) || !personLinks || typeof personLinks.readLink!=='function' || authority && typeof authority.readAcceptedAssessment!=='function') throw new Error('invalid actual role workload owner');
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(path);
  let closeWorkload:(()=>void)|null=null;
  try {
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS actual_role_workload_assessments(source_id TEXT PRIMARY KEY,closure_source_id TEXT NOT NULL,
      career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,player_id TEXT NOT NULL,
      source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
      UNIQUE(career_id,game_id,play_id,player_id));
    CREATE TABLE IF NOT EXISTS actual_role_workload_settlements(closure_source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,
      game_id TEXT NOT NULL,play_id INTEGER NOT NULL,plan_json TEXT NOT NULL,plan_hash TEXT NOT NULL,UNIQUE(career_id,game_id,play_id));`);
  let closed=false;
  const check=()=>{if(closed) throw new Error('closed actual role workload store');};
  const transaction=<T>(mode:string,work:()=>T):T=>{db.exec(mode);try{const value=work();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}};
  const activityPlan=(connection:Pick<DatabaseSync,'prepare'>,sourceId:string)=>{
    const rows=connection.prepare(`SELECT closure_source_id FROM actual_role_workload_settlements WHERE ${claim('plan_json',['participants',{array:'all'},'activity','sourceEventId'],'$id')}`).all({id:sourceId});
    if(rows.length!==1) throw new Error('actual role workload activity lacks exact frozen settlement');
    const result=evidence(connection).readSettlement(String(rows[0].closure_source_id));
    if(result.kind==='pending') throw new Error('actual role workload frozen settlement missing');
    const participant=result.participants.find(p=>p.activity.sourceEventId===sourceId);
    if(!participant) throw new Error('actual role workload frozen activity missing');
    return {result,participant};
  };
  const currentParticipantHeads=(connection:Pick<DatabaseSync,'prepare'>,result:ReturnType<typeof activityPlan>['result'])=>result.participants.map(p=>{
    const current=readActualRoleWorkloadState(connection,result.careerId,p.playerId);
    // Applied actors may have separately accepted later activity. Their complete
    // current chain must still contain the authenticated frozen AFTER prefix.
    if(!current || (p.applied
      ? current.revision<p.after.revision || current.revision===p.after.revision && json(current)!==json(p.after)
      : json(current)!==json(p.before)))throw new Error('actual role workload participant current head differs from frozen effects');
    return current;
  });
  let chargeBoundary:Readonly<{connection:Pick<DatabaseSync,'prepare'>;sourceEventId:string;heads:ReturnType<typeof currentParticipantHeads>}>|null=null;
  const workload=openSqlitePlayerWorkloadRecoveryStore(path,personLinks,{
    readAcceptedBaseline:sourceId=>authority?.readAcceptedBaseline?.(sourceId)??null,
    readAcceptedActivity:sourceId=>transaction('BEGIN',()=>activityPlan(db,sourceId).participant.activity),
  },(connection,activity,phase)=>{
    const {result,participant}=activityPlan(connection,activity.sourceEventId);
    if(json(participant.activity)!==json(activity)) throw new Error('actual role workload activity differs from frozen assessment');
    assertNoLegacyPitchWorkloadCharge(connection,{careerId:result.careerId,gameId:result.gameId,playId:result.playId,playerId:participant.playerId});
    if(phase==='written' && !participant.applied || phase==='write' && participant.applied) throw new Error('actual role workload application stage differs');
    const heads=currentParticipantHeads(connection,result);
    if(phase==='write')chargeBoundary={connection,sourceEventId:activity.sourceEventId,heads};
    else if(phase==='written'){
      const before=chargeBoundary;chargeBoundary=null;
      if(!before || before.connection!==connection || before.sourceEventId!==activity.sourceEventId)throw new Error('actual role workload participant transaction boundary missing');
      for(const head of heads){
        const expected=head.playerId===participant.playerId?participant.after:before.heads.find(p=>p.playerId===head.playerId);
        if(!expected || json(head)!==json(expected))throw new Error('actual role workload participant head changed during charge');
      }
    }else chargeBoundary=null;
  });
  closeWorkload=()=>workload.close();
  const readSettlement=(closureSourceId:string)=>{check();return transaction('BEGIN',()=>evidence(db).readSettlement(closureSourceId));};
  const acceptAssessments=(sourceIds:readonly string[])=>{
    check();if(!Array.isArray(sourceIds)||!sourceIds.length||sourceIds.some(v=>!id(v))||new Set(sourceIds).size!==sourceIds.length)throw new Error('actual role workload assessment IDs must be unique nonempty IDs');
    const requested=sourceIds.map(sourceId=>{const raw=authority?.readAcceptedAssessment(sourceId)??null;return raw===null?null:input(raw,sourceId);});
    const project=()=>{
      const inputs=sourceIds.map((sourceId,i)=>{
        const row=identity(db,'actual_role_workload_assessments',sourceId);
        const archived=row?input(JSON.parse(String(row.source_json)),sourceId):null;
        if(archived && requested[i] && json(archived)!==json(requested[i]))throw new Error('actual role workload assessment frozen differently');
        const source=requested[i]??archived;if(!source)throw new Error('accepted actual role workload assessment missing');return source;
      });
      const closureSourceId=inputs[0].closureSourceId;
      if(inputs.some(v=>v.closureSourceId!==closureSourceId))throw new Error('actual role workload assessment batch closure differs');
      const c=context(db,closureSourceId),existing=readActualRoleAssessments(db,c),values=inputs.map(source=>derive(c,source));
      if(new Set(values.map(v=>v.playerId)).size!==values.length)throw new Error('actual role workload canonical charge alias differs');
      const added=values.filter(v=>!existing.some(a=>a.source.sourceId===v.source.sourceId));
      for(const value of values){
        const prior=existing.find(a=>a.playerId===value.playerId);
        if(prior && json(prior)!==json(value))throw new Error('actual role workload canonical charge already assessed');
        assertNoLegacyPitchWorkloadCharge(db,value);
      }
      for(const value of added)assertNoSamePaPlayerReservation(db,value);
      if(added.length && identity(db,'actual_role_workload_settlements',closureSourceId))throw new Error('actual role workload assessment set already frozen');
      return {closureSourceId,existing,values,added};
    };
    const proposed=transaction('BEGIN',project);
    if(!proposed.added.length)return proposed.values;
    return transaction('BEGIN IMMEDIATE',()=>{
      const current=project();
      if(json(current)!==json(proposed))throw new Error('actual role workload physical input or assessment set changed before acceptance');
      for(const value of current.added)db.prepare('INSERT INTO actual_role_workload_assessments VALUES(?,?,?,?,?,?,?,?,?,?)').run(value.source.sourceId,current.closureSourceId,value.careerId,value.gameId,value.playId,value.playerId,json(value.source),hash(value.source),json(value),hash(value));
      for(const value of current.added)assertNoSamePaPlayerReservation(db,value);
      const saved=readActualRoleAssessments(db,context(db,current.closureSourceId));
      if(saved.length!==current.existing.length+current.added.length || [...current.existing,...current.added].some(v=>!saved.some(a=>json(a)===json(v))))throw new Error('actual role workload assessment changed during acceptance');
      return current.values;
    });
  };
  const acceptAssessment=(sourceId:string)=>acceptAssessments([sourceId])[0];
  const freeze=(closureSourceId:string)=>{
    check();const original=readSettlement(closureSourceId);
    if(original.kind!=='pending')return original;
    const plan=transaction('BEGIN',()=>prepareActualRoleWorkloadPlan(db,context(db,closureSourceId)));
    if(plan.kind==='pending')return plan;
    return transaction('BEGIN IMMEDIATE',()=>{
      if(identity(db,'actual_role_workload_settlements',closureSourceId))return evidence(db).readSettlement(closureSourceId);
      const current=prepareActualRoleWorkloadPlan(db,context(db,closureSourceId));
      if(json(current)!==json(plan))throw new Error('actual role workload assessment set or BEFORE changed before freeze');
      for(const p of plan.participants)assertNoSamePaPlayerReservation(db,{careerId:plan.careerId,playerId:p.playerId});
      db.prepare('INSERT INTO actual_role_workload_settlements VALUES(?,?,?,?,?,?)').run(closureSourceId,plan.careerId,plan.gameId,plan.playId,json(plan),hash(plan));
      for(const p of plan.participants)assertNoSamePaPlayerReservation(db,{careerId:plan.careerId,playerId:p.playerId});
      const saved=evidence(db).readSettlement(closureSourceId);
      if(saved.kind!=='applying' || saved.participants.some(p=>p.applied))throw new Error('actual role workload initial settlement stage differs');
      // Recheck current heads after INSERT triggers, before committing the frozen set.
      for(const p of plan.participants)if(json(readActualRoleWorkloadState(db,plan.careerId,p.playerId))!==json(p.before))throw new Error('actual role workload BEFORE changed during freeze');
      return saved;
    });
  };
  const settle=(closureSourceId:string)=>{
    check();const frozen=freeze(closureSourceId);if(frozen.kind==='pending')return frozen;
    for(const p of frozen.participants){
      const raw=authority?.readAcceptedAssessment(p.assessmentSourceId)??null;
      if(raw!==null){
        const row=identity(db,'actual_role_workload_assessments',p.assessmentSourceId);
        if(!row || json(input(raw,p.assessmentSourceId))!==row.source_json)throw new Error('actual role workload accepted assessment frozen differently');
      }
    }
    for(const p of frozen.participants){
      const before=workload.selectAtRevision(frozen.careerId,p.playerId,p.before.revision);
      if(json(before)!==json(p.before))throw new Error('actual role workload original BEFORE differs');
      const after=workload.apply(p.activity.sourceEventId,p.before.revision);
      if(json(after)!==json(p.after) || json(workload.readActivity(p.activity.sourceEventId))!==json({activity:p.activity,before:p.before,after:p.after}))throw new Error('actual role workload applied state differs');
    }
    return transaction('BEGIN',()=>{
      const result=evidence(db).readSettlement(closureSourceId);if(result.kind!=='complete')throw new Error('actual role workload application incomplete');
      currentParticipantHeads(db,result);return result;
    });
  };
  return Object.freeze({acceptAssessment,acceptAssessments,freeze,settle,readSettlement,
    initializeBaseline(sourceId:string){check();return workload.initialize(sourceId);},
    close(){if(!closed){workload.close();db.close();closed=true;}}});
  }catch(error){try{closeWorkload?.();}finally{db.close();}throw error;}
};

import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { renewalSourceRow,renewalJournalOwners } from './ActualReceivedUmpireRenewalJournal';
import { renewalEnrollmentInput,renewalDecisionInput,renewalMotorInput,renewalAdoptionInput,renewalExactCut,assertRenewalCut,
  type RenewalAdoptionExecutionSource,type RenewalCut } from './ActualReceivedUmpireRenewal';
import { sqliteJsonMetadataNodes as nodes,type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
/** Fixed metadata rank proof, before receipt replay. No current head lookup or
 * executable result body is authority in this preflight. */
export const preflightReceivedRenewalAdoption=(db:DatabaseSync,input:Readonly<{source:RenewalAdoptionExecutionSource;gameId:string;physicalPitchSourceId:string;
  predecessor:Readonly<{sourceId:string;revision:number}>;cut:RenewalCut}>)=>{
  const source=renewalAdoptionInput(input.source),prior=input.predecessor;
  if(!Number.isSafeInteger(prior.revision)||prior.revision<1||prior.sourceId!==source.previousExecutionSourceId)throw new Error('received renewal physical predecessor rank differs');
  const scalar=(raw:string,path:SqliteJsonMetadataPath,kind:'text'|'number'):string|number=>{
    const found=db.prepare(`WITH document(value) AS (VALUES(?)) SELECT type,atom FROM (${nodes('(SELECT value FROM document)',path)})`).all(raw);
    if(found.length!==1)throw new Error('received renewal physical metadata scalar differs');
    const valid=kind==='text'?found[0].type==='text'&&typeof found[0].atom==='string':
      ['integer','real'].includes(String(found[0].type))&&typeof found[0].atom==='number'&&Number.isFinite(found[0].atom);
    if(!valid)throw new Error('received renewal physical metadata scalar differs');
    return found[0].atom as string|number;
  };
  const row=(index:0|1|2,id:string)=>{
    const owner=renewalJournalOwners[index],r=renewalSourceRow(db,owner,id);if(!r)throw new Error('received renewal physical dependency owner missing');
    const parse=index===0?renewalEnrollmentInput:index===1?renewalDecisionInput:renewalMotorInput,s=parse(JSON.parse(String(r.source_json)),id);
    const digest=(raw:unknown)=>typeof raw==='string'?createHash('sha256').update(raw).digest('hex'):null;
    if(s.sourceVersion!==r.source_version||json(s)!==r.source_json||digest(r.source_json)!==r.source_hash||digest(r.snapshot_json)!==r.snapshot_hash)throw new Error('received renewal physical dependency Source identity differs');
    const mirrors=db.prepare("SELECT type,value FROM json_each(?) WHERE key='source'").all(String(r.snapshot_json));
    if(mirrors.length!==1||mirrors[0].type!=='object'||mirrors[0].value!==r.source_json)throw new Error('received renewal physical dependency Source mirror differs');
    return {row:r,source:s};
  };
  const e=row(0,source.action.renewalEnrollmentSourceId),m=row(2,source.action.renewalMotorSourceId);
  const motor=renewalMotorInput(m.source as Parameters<typeof renewalMotorInput>[0]);
  if(motor.renewalEnrollmentSourceId!==source.action.renewalEnrollmentSourceId||m.row.renewal_decision_source_id!==motor.renewalDecisionSourceId)throw new Error('received renewal physical motor enrollment binding differs');
  const d=row(1,motor.renewalDecisionSourceId),decision=renewalDecisionInput(d.source as Parameters<typeof renewalDecisionInput>[0]);
  const enrollment=renewalEnrollmentInput(e.source as Parameters<typeof renewalEnrollmentInput>[0]);
  const keys=['game_id','play_id','physical_pitch_source_id','player_id','runtime_source_id','received_enrollment_source_id','origin_process_source_id','received_replan_source_id','renewal_enrollment_source_id'];
  if(e.row.game_id!==input.gameId||e.row.physical_pitch_source_id!==input.physicalPitchSourceId||e.row.renewal_enrollment_source_id!==source.action.renewalEnrollmentSourceId
    ||e.row.received_enrollment_source_id!==enrollment.receivedEnrollmentSourceId||e.row.received_replan_source_id!==enrollment.receivedReplanSourceId
    ||decision.renewalEnrollmentSourceId!==source.action.renewalEnrollmentSourceId||keys.some(k=>d.row[k]!==e.row[k]||m.row[k]!==e.row[k]))throw new Error('received renewal physical dependency scope binding differs');
  const raw=String(e.row.snapshot_json);
  if(scalar(raw,['anchor','baseField','sourceId'],'text')!==source.baseFieldSourceId
    ||scalar(raw,['anchor','physicalPredecessor','sourceId'],'text')!==prior.sourceId||scalar(raw,['anchor','physicalPredecessor','revision'],'number')!==prior.revision)throw new Error('received renewal physical anchor must be its strict predecessor');
  const cut={originTick:scalar(raw,['cut','originTick'],'number') as number,elapsedSeconds:scalar(raw,['cut','elapsedSeconds'],'number') as number,
    tick:scalar(raw,['cut','tick'],'number') as number,ticksPerSecond:scalar(raw,['cut','ticksPerSecond'],'number') as number};
  assertRenewalCut(renewalExactCut(input.cut,input.cut.ticksPerSecond),cut);
  return {enrollmentSourceId:enrollment.sourceId,decisionSourceId:decision.sourceId,motorSourceId:motor.sourceId};
};

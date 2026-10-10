import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { memoSamePaLifecycleRead, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaLiveBallAssignmentInput } from './SamePlateAppearanceLiveBallStateSource';
import { samePaRestartPlayTable as table, samePaRestartPlayInput, type SamePaRestartPlayAuthority, type SamePaRestartPlayReference, type AcceptedSamePaRestartPlay } from './SamePlateAppearanceRestartPlaySource';
import { assertSamePaRestartPlayStorage as storage, samePaRestartPlaySchema as schema } from './SamePlateAppearanceRestartPlayStorage';
import { deriveSamePaRestartPlayFromSqlite, samePaRestartPlayOriginalsInput, type SamePaRestartPlayOriginals, type SamePaRestartPlay } from './SamePlateAppearanceRestartPlayProof';
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('restart Play original Source or immutable row differs');};
const pending=(reason:string)=>freeze({kind:'pending' as const,reason});
export const samePaRestartPlayRow=(v:SamePaRestartPlay)=>({source_id:v.source.sourceId,source_version:v.source.sourceVersion,career_id:v.lineage.careerId,game_id:v.lineage.gameId,
  play_id:v.lineage.playId,enrollment_source_id:v.lineage.enrollmentReference.sourceId,actor_source_id:v.lineage.actorReference.sourceId,first_pitch_source_id:v.lineage.firstPhysicalPitchSourceId,
  physical_pitch_source_id:v.physicalPitchSourceId,reset_source_id:v.resetReference.sourceId,assignment_source_id:v.originalInputs.assignment.sourceId,view_source_id:v.source.viewReference.sourceId,
  source_json:json(v.source),source_hash:hash(v.source),snapshot_json:json(v),snapshot_hash:hash(v)});
const row=(db:DatabaseSync,id:string)=>{
  if(!samePaText(id))throw new Error('invalid restart Play identity');
  const rows=storage(db)?db.prepare(`SELECT * FROM main.${table} WHERE source_id=$id OR ${claim('source_json',['sourceId'],'$id')} OR ${claim('snapshot_json',['source','sourceId'],'$id')}`).all({id}):[];
  if(rows.length>1||rows.length===1&&rows[0].source_id!==id)throw new Error('restart Play Source alias differs');return rows[0]??null;
};
export const readSamePaRestartPlayByIdFromSqlite=(db:DatabaseSync,id:string):SamePaRestartPlay|null=>withSamePaLifecycleReadPhase(db,()=>memoSamePaLifecycleRead(db,table+':'+id,()=>{
  const r=row(db,id);if(!r)return null;
  const source=samePaRestartPlayInput(JSON.parse(String(r.source_json)),id),saved=JSON.parse(String(r.snapshot_json));
  const value=deriveSamePaRestartPlayFromSqlite(db,source,saved.originalInputs,false);same(r,samePaRestartPlayRow(value));return value;
}));
export const readSamePaRestartPlayFromSqlite=(db:DatabaseSync,ref:SamePaRestartPlayReference)=>{
  if(!samePaReferenceValid(ref,table))throw new Error('invalid restart Play reference');const v=readSamePaRestartPlayByIdFromSqlite(db,ref.sourceId);
  if(!v)throw new Error('original restart Play missing');same(ref,reference(table,v));return v;
};
/** Discover by every original enrollment claim, then authenticate all matches.
 * The full journal retains reset/action/posture provenance even across pitches. */
export const readSamePaRestartPlaysFromSqlite=(db:DatabaseSync,enrollment:SamePaReference<'same_pa_enrollments'>,resets:readonly SamePaReference<'pa_lifecycle_v1_resets'>[])=>{
  if(!samePaReferenceValid(enrollment,'same_pa_enrollments'))throw new Error('invalid restart Play enrollment');
  if(!storage(db)||!resets.length)return [] as SamePaRestartPlay[];
  if(resets.some(r=>!samePaReferenceValid(r,'pa_lifecycle_v1_resets')))throw new Error('invalid restart Play reset history');
  const rows=db.prepare(`SELECT * FROM main.${table} WHERE enrollment_source_id=$id OR ${claim('source_json',['enrollmentReference','sourceId'],'$id')}
    OR ${claim('snapshot_json',['source','enrollmentReference','sourceId'],'$id')} OR ${claim('snapshot_json',['lineage','enrollmentReference','sourceId'],'$id')}`).all({id:enrollment.sourceId});
  // Never re-read a future restart while authenticating its own earlier
  // lifecycle prefix: only the caller's already-owned reset history is eligible.
  const resetIds=new Set(resets.map(r=>r.sourceId));
  return rows.filter(r=>{const source=JSON.parse(String(r.source_json)),snapshot=JSON.parse(String(r.snapshot_json));
    return [r.reset_source_id,source.resetReference?.sourceId,snapshot.source?.resetReference?.sourceId,snapshot.resetReference?.sourceId].some(id=>resetIds.has(String(id)));
  }).map(r=>{const v=readSamePaRestartPlayByIdFromSqlite(db,String(r.source_id));if(!v)throw new Error('restart Play disappeared');same(v.lineage.enrollmentReference,enrollment);return v;});
};
const capture=(s:AcceptedSamePaRestartPlay,authority:SamePaRestartPlayAuthority):SamePaRestartPlayOriginals|null=>{
  const venue=authority.readAcceptedVenue(s.venueReference.sourceId),raw=authority.readAcceptedAssignment(s.assignmentReference.sourceId);
  if(venue==null||raw==null)return null;const assignment=samePaLiveBallAssignmentInput(raw,s.assignmentReference.sourceId),person=authority.readAcceptedOfficialPerson(assignment.personReference.sourceId);
  return person==null?null:samePaRestartPlayOriginalsInput(s,{venue,assignment,person} as SamePaRestartPlayOriginals);
};
/** Fresh admission always proves the still-current reset view. Reopening only
 * replays saved original inputs, and cannot create a declaration in the past. */
export const openSqliteSamePlateAppearanceRestartPlayStore=(path:string,authority?:SamePaRestartPlayAuthority)=>{
  if(!samePaText(path)||authority&&Object.values(authority).some(f=>typeof f!=='function'))throw new Error('invalid restart Play owner');
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(path),tx=battingInvocationTransaction(db,()=>storage(db));
  const rows=()=>storage(db)?db.prepare('SELECT * FROM main.'+table+' ORDER BY rowid').all():[];
  const read=(id:string)=>readSamePaRestartPlayByIdFromSqlite(db,id);
  const accept=(id:string)=>{
    if(!samePaText(id))throw new Error('invalid restart Play identity');const raw=authority?.readAcceptedPlay(id)??null,source=raw===null?null:samePaRestartPlayInput(raw,id);
    const prior=tx.run(false,p=>p(()=>read(id)),()=>{});
    if(prior){if(source){same(prior.source,source);if(authority){
      const venue=authority.readAcceptedVenue(source.venueReference.sourceId),assignment=authority.readAcceptedAssignment(source.assignmentReference.sourceId);
      const person=authority.readAcceptedOfficialPerson(prior.originalInputs.assignment.personReference.sourceId);
      if(venue!=null)same(venue,prior.originalInputs.venue);if(assignment!=null)same(assignment,prior.originalInputs.assignment);if(person!=null)same(person,prior.originalInputs.person);
    }}return prior;}
    if(!source||!authority)return pending('accepted_explicit_restart_play_required');const original=capture(source,authority);
    if(!original)return pending('original_restart_venue_and_plate_umpire_required');
    const derive=()=>deriveSamePaRestartPlayFromSqlite(db,source,original,true);
    const before=tx.run(false,p=>p(()=>({value:derive(),rows:rows()})),()=>{}),added=samePaRestartPlayRow(before.value),expected=[...before.rows,added];
    const verify=()=>{same(read(id),before.value);same(rows(),expected);};
    return tx.run(true,(proof,step)=>{same(proof(()=>({value:derive(),rows:rows()})),before);
      if(!storage(db))step(()=>db.exec(schema),0,1);
      step(()=>{const delta=db.prepare('INSERT INTO main.'+table+' VALUES('+Object.keys(added).map(()=>'?').join(',')+')').run(...Object.values(added));if(delta.changes!==1)throw new Error('restart Play exact row delta differs');},1);
      proof(verify);return before.value;
    },verify);
  };
  return Object.freeze({accept,read:(id:string)=>tx.run(false,p=>p(()=>read(id)),()=>{}),close:tx.close});
};

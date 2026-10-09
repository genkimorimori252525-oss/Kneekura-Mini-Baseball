import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { createRequire } from 'node:module';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import type { DatabaseSync } from 'node:sqlite';
import { readPhysicalPlateAppearanceActorFromSqlite, assertPhysicalActorOpenFrame,
  actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { samePlateAppearanceEnrollmentInput, type SamePlateAppearanceEnrollmentResult } from './SamePlateAppearanceEnrollment';
import { assertSamePaStorage,assertNoSamePaPlayerReservation,assertNoSamePaWorkReservation,
  authenticateSamePaRow,samePaEnrollmentRow,samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { assertSamePaRegistrationBeforeWork } from './ActualLiveRuntimeRegistration';
import { assertNoActualRoleWorkloadCharge,assertNoLegacyPitchWorkloadCharge } from './ActualRoleWorkloadChargeGuard';
import { assertHistoricalSamePaWorkloadCut } from './SamePlateAppearanceHistoricalWorkloadCut';
type Db=Pick<DatabaseSync,'prepare'>;
const deriveEnrollment = (db:Db,raw:unknown,ownSourceId?:string) => {
  assertSamePaStorage(db);const source=samePlateAppearanceEnrollmentInput(raw);
  const actor=readPhysicalPlateAppearanceActorFromSqlite(db,source.actorReference.sourceId);
  if(!actor)throw new Error('same-PA original actor missing');
  const actorRows=db.prepare(`SELECT * FROM main.physical_plate_appearance_actors WHERE source_id=$id OR ${claim('source_json',['sourceId'],'$id')} OR ${claim('snapshot_json',['source','sourceId'],'$id')}`).all({id:source.actorReference.sourceId});
  const row=actorRows[0];
  if(actorRows.length!==1||row.source_id!==source.actorReference.sourceId||row.source_hash!==source.actorReference.sourceHash||row.snapshot_hash!==source.actorReference.snapshotHash
    ||row.source_json!==json(actor.source)||row.snapshot_json!==json(actor)||row.source_hash!==hash(actor.source)||row.snapshot_hash!==hash(actor))throw new Error('same-PA original actor reference differs');
  assertPhysicalActorOpenFrame(db,actor);
  const originals=readSamePaOriginalParticipants(db,actor),bindings=originals.map(p=>p.binding).sort((a,b)=>a.playerId<b.playerId?-1:a.playerId>b.playerId?1:0);
  if((source.capability==='reserved_same_pa_enrollment_v1')!==(originals.length===10)
    ||source.participantBaselineReferences.length!==bindings.length
    ||bindings.some(b=>!source.participantBaselineReferences.some(p=>p.playerId===b.playerId)))throw new Error('same-PA exact original participant membership differs');
  const scope={gameId:actor.source.gameId,playId:actor.match.playId,physicalPitchSourceId:source.firstPhysicalPitchSourceId};
  assertNoSamePaWorkReservation(db,scope,ownSourceId);assertSamePaRegistrationBeforeWork(db,{...scope,actorSourceId:actor.source.sourceId,
    ...('initialWorldSourceId' in actor.source?{initialWorldSourceId:actor.source.initialWorldSourceId}:{activationApplicationId:actor.source.activationApplicationId})});
  const workloadTables=['world_player_workload_baselines','world_player_workload_heads','world_player_workload_activities','world_player_workload_policies'];
  const installed=workloadTables.map(name=>db.prepare("SELECT name,type FROM main.sqlite_master WHERE lower(name)=lower(?)").all(name));
  if(installed.some(r=>r.length)&&installed.some((r,i)=>r.length!==1||r[0].name!==workloadTables[i]||r[0].type!=='table'))throw new Error('same-PA workload history schema is partial or malformed');
  const missingBaselinePlayerIds:string[]=[];
  const participants=bindings.flatMap(binding=>{
    assertNoSamePaPlayerReservation(db,binding,ownSourceId);
    const charge={careerId:binding.careerId,gameId:binding.gameId,playId:scope.playId,playerId:binding.playerId};
    // The enrollment itself is not a charge; these helpers inspect only existing
    // charge owners during acquisition (reservation exclusion is checked above).
    assertNoActualRoleWorkloadCharge(db,charge,ownSourceId);assertNoLegacyPitchWorkloadCharge(db,charge,ownSourceId);
    const ref=source.participantBaselineReferences.find(p=>p.playerId===binding.playerId)!;
    const state=readActualRoleWorkloadState(db,binding.careerId,binding.playerId,undefined,binding.personLinkSourceId);
    const bases=installed[0].length?db.prepare(`SELECT * FROM main.world_player_workload_baselines WHERE source_id=$id OR ${claim('source_json',['sourceId'],'$id')}`).all({id:ref.baselineSourceId}):[];
    if(!state){if(bases.length)throw new Error('same-PA supplied baseline is foreign');missingBaselinePlayerIds.push(binding.playerId);return [];}
    if(bases.length!==1||bases[0].career_id!==binding.careerId||bases[0].player_id!==binding.playerId||bases[0].source_id!==ref.baselineSourceId
      ||JSON.parse(String(bases[0].source_json)).sourceId!==ref.baselineSourceId||state.revision!==ref.revision||hash(state)!==ref.stateHash||state.effectiveDay>binding.gameDay)throw new Error('same-PA current baseline reference is stale or foreign');
    const person=originals.find(p=>p.binding.playerId===binding.playerId)?.person;
    if(!person||person.personId!==binding.personId||person.sourceId!==binding.personLinkSourceId)throw new Error('same-PA original Person differs');
    return [{binding,personHash:hash(person),baselineSourceId:ref.baselineSourceId,baselineSourceHash:hash(JSON.parse(String(bases[0].source_json))),state}];
  });
  if(missingBaselinePlayerIds.length)return {actor,result:freeze({kind:'pending' as const,missingBaselinePlayerIds})};
  return {actor,result:freeze({kind:'reserved' as const,source,careerId:actor.binding.careerId,gameId:scope.gameId,playId:scope.playId,actorHash:hash(actor),
    officialRevision:actor.officialRevision,worldHash:hash(actor.world),fixtureHash:actor.fixtureHash,participants,
    firstPitch:{physicalPitchSourceId:source.firstPhysicalPitchSourceId,state:'blocked_execution_basis' as const,predecessorResumeSourceId:null,consumingSourceId:null}})};
};
/** All participant fences inspect the same immutable claim census. The existing
 * phase owns it; every independent proof after a write/retry starts afresh. */
const deriveEnrollmentBasis = (db:Db,raw:unknown,ownSourceId?:string) => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const read = () => deriveEnrollment(db, raw, ownSourceId);
  return db instanceof Native && db.isTransaction && db.prepare('PRAGMA query_only').get()!.query_only === 1
    ? withSamePaContinuationReadPhase(db, read) : read();
};
export const deriveSamePlateAppearanceEnrollment = (db:Db,raw:unknown,ownSourceId?:string):SamePlateAppearanceEnrollmentResult => deriveEnrollmentBasis(db,raw,ownSourceId).result;
/** Returns the actor from this exact authentication, for private read-only
 * execution assembly. It accepts no cached actor or caller proof. */
export const readSamePlateAppearanceEnrollmentBasis = (db:Db,sourceId:string) => {
  const row=samePaEnrollmentRow(db,sourceId);if(!row)return null;
  const value=authenticateSamePaRow(db,row),basis=deriveEnrollmentBasis(db,value.source,sourceId);
  if(json(value)!==json(basis.result))throw new Error('same-PA enrollment prerequisites changed');return {enrollment:freeze(value),actor:basis.actor};
};
export const readSamePlateAppearanceEnrollment = (db:Db,sourceId:string) => readSamePlateAppearanceEnrollmentBasis(db,sourceId)?.enrollment??null;
/** Original reservation evidence after causal work, settlement or release.
 * This historical arm grants no current execution or workload admission. */
export const readHistoricalSamePlateAppearanceEnrollment = (db:Db,sourceId:string) => {
  const row=samePaEnrollmentRow(db,sourceId);if(!row)return null;
  const enrollment=authenticateSamePaRow(db,row);
  const actor=readPhysicalPlateAppearanceActorFromSqlite(db,enrollment.source.actorReference.sourceId);
  if(!actor||json(enrollment.source.actorReference)!==json({owner:'physical_plate_appearance_actors',sourceId:actor.source.sourceId,sourceHash:hash(actor.source),snapshotHash:hash(actor)})
    ||enrollment.actorHash!==hash(actor)||enrollment.officialRevision!==actor.officialRevision
    ||enrollment.worldHash!==hash(actor.world)||enrollment.fixtureHash!==actor.fixtureHash)throw new Error('historical same-PA enrollment actor differs');
  const originals=readSamePaOriginalParticipants(db,actor),bindings=originals.map(p=>p.binding).sort((a,b)=>a.playerId<b.playerId?-1:a.playerId>b.playerId?1:0);
  if((enrollment.source.capability==='reserved_same_pa_enrollment_v1')!==(originals.length===10)||json(bindings)!==json(enrollment.participants.map(p=>p.binding)))throw new Error('historical same-PA enrollment participants differ');
  for(const p of enrollment.participants){
    const baselines=db.prepare(`SELECT * FROM main.world_player_workload_baselines WHERE source_id=$id OR ${claim('source_json',['sourceId'],'$id')}`).all({id:p.baselineSourceId});
    if(baselines.length!==1||baselines[0].source_id!==p.baselineSourceId||baselines[0].career_id!==p.binding.careerId||baselines[0].player_id!==p.binding.playerId
      ||hash(JSON.parse(String(baselines[0].source_json)))!==p.baselineSourceHash)throw new Error('historical same-PA enrollment baseline Source differs');
    assertHistoricalSamePaWorkloadCut(db,p.binding.careerId,p.binding.playerId,p.state.revision);
    const state=readActualRoleWorkloadState(db,p.binding.careerId,p.binding.playerId,p.state.revision,p.binding.personLinkSourceId);
    const person=originals.find(v=>v.binding.playerId===p.binding.playerId)?.person;
    if(json(state)!==json(p.state)||!person||hash(person)!==p.personHash)throw new Error('historical same-PA enrollment reserved state or Person differs');
  }
  return freeze(enrollment);
};

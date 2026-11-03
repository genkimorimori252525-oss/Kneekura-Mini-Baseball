import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readSamePaLifecycleClaimRows, type SamePaLifecycleClaimRow } from './SamePlateAppearanceLifecycleClaimGuard';
import { samePaPhysicalEpisodeSourceInput, type SamePaPhysicalCommitment } from './SamePlateAppearancePhysicalEpisode';
import { samePaReferenceValid, samePaHash, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { hashSpinAimDomainValueV228 } from './SpinAimQualificationV228';
import { readEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';

const commitOwner='pa_physical_v1_commitments', resolutionOwner='pa_physical_v1_resolutions', eventKind='SAME_PA_EFFECTIVE_BATTING_COMMITMENT_V1';
type WorldRow=Readonly<{career_id:unknown;world_revision:unknown;source_kind:unknown;source_event_id:unknown;event_json:unknown}>;
export type PhysicalCommitmentMembershipV232=Readonly<{reference:SamePaReference<typeof commitOwner>;careerId:string;beforeWorldRevision:number;afterWorldRevision:number;actionKey:string}>;
export type PhysicalResolutionMembershipV232=Readonly<{reference:SamePaReference<typeof resolutionOwner>;commitmentReference:SamePaReference<typeof commitOwner>}>;
export type PhysicalWorldMembershipV232=Readonly<{commitments:readonly PhysicalCommitmentMembershipV232[];resolutionCandidates:readonly PhysicalResolutionMembershipV232[]}>;
const fail=():never=>{throw Error('physical commitment World membership differs')};
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nat=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const eq=(a:unknown,b:unknown)=>isDeepStrictEqual(a,b);
/** Shared exact event construction; no reader or qualification dependency. */
export function physicalCommitmentWorldEventV232(value:SamePaPhysicalCommitment) {
 return {kind:eventKind,reference:{owner:commitOwner,sourceId:value.source.sourceId,sourceHash:hash(value.source),snapshotHash:hash(value)},
  beforeWorldRevision:value.beforeWorldRevision,afterWorldRevision:value.afterWorldRevision,actionKey:value.actionKey};
}
/** Qualification cutoff must precede the consuming commitment, and recursive cutoff must decrease. */
export function assertQualificationDependencyRankV232(qualificationEnd:number, commitmentBefore:number, enclosingEnd:number):void {
 if(!nat(qualificationEnd)||!nat(commitmentBefore)||!nat(enclosingEnd)||qualificationEnd>commitmentBefore||qualificationEnd>=enclosingEnd)return fail();
}
type Input=Readonly<{careerId:string;endWorldRevision:number;expectedWorldPrefixHash:string;expectedWorldEventHash:string;
 prefix:readonly WorldRow[];claims:readonly SamePaLifecycleClaimRow[];events:readonly WorldRow[]}>;
function assertWorldPrefixV232(input:Pick<Input,'careerId'|'endWorldRevision'|'expectedWorldPrefixHash'|'expectedWorldEventHash'>,prefix:readonly WorldRow[]):void {
 if(!samePaText(input.careerId)||!nat(input.endWorldRevision)||input.endWorldRevision<1||!samePaHash(input.expectedWorldPrefixHash)||!samePaHash(input.expectedWorldEventHash)
  ||prefix.length!==input.endWorldRevision||prefix.some((e,i)=>e.career_id!==input.careerId||e.world_revision!==i+1||!samePaText(e.source_kind)||!samePaText(e.source_event_id)||typeof e.event_json!=='string')
  ||hashSpinAimDomainValueV228(prefix)!==input.expectedWorldPrefixHash||hashSpinAimDomainValueV228(prefix.at(-1))!==input.expectedWorldEventHash)return fail();
}
/** Metadata-only verifier. Its caller must supply claims from the normal claim guard
 * and a borrowed authenticated World snapshot; it grants no physical authority.
 * Resolution candidates have no authenticated cutoff here and cannot be treated as prefix outcomes. */
export function authenticatePhysicalCommitmentMembershipMetadataV232(input:Input):PhysicalWorldMembershipV232 {
 const {careerId,endWorldRevision,prefix,claims,events}=input;
 assertWorldPrefixV232(input,prefix);
 if(!eq(prefix,events.filter(e=>e.career_id===careerId&&nat(e.world_revision)&&e.world_revision<=endWorldRevision).sort((a,b)=>Number(a.world_revision)-Number(b.world_revision))))return fail();
 const ids=new Set<string>(),commits:(PhysicalCommitmentMembershipV232 & {enrollmentSourceId:string;pitchOrdinal:number;launchReference:unknown})[]=[],
  resolutions:(PhysicalResolutionMembershipV232 & {careerId:string;enrollmentSourceId:string;pitchOrdinal:number;launchReference:unknown})[]=[];
 const rows=claims.filter(c=>c.table===commitOwner||c.table===resolutionOwner);
 for(const claim of rows){
  const row=claim.row,owner=claim.table;if(!samePaText(row.source_id)||ids.has(row.source_id)||claims.filter(c=>c.table.startsWith('pa_physical_v1_')&&c.row.source_id===row.source_id).length!==1)return fail();ids.add(row.source_id);
  if(typeof row.source_json!=='string'||typeof row.snapshot_json!=='string')return fail();
  let rawSource:unknown,rawSnapshot:unknown;try{rawSource=JSON.parse(row.source_json);rawSnapshot=JSON.parse(row.snapshot_json)}catch{return fail()}
  if(!object(rawSource)||!object(rawSnapshot)||json(rawSource)!==row.source_json||json(rawSnapshot)!==row.snapshot_json
   ||hash(rawSource)!==row.source_hash||hash(rawSnapshot)!==row.snapshot_hash||!eq(rawSnapshot.source,rawSource))return fail();
  const source=samePaPhysicalEpisodeSourceInput(rawSource,row.source_id),reference={owner,sourceId:row.source_id,sourceHash:row.source_hash,snapshotHash:row.snapshot_hash};
  if(!samePaReferenceValid(reference,owner)||!object(rawSnapshot.lineage)||!object(rawSnapshot.lineage.enrollmentReference)
   ||!nat(rawSnapshot.pitchOrdinal)||!nat(rawSnapshot.operationOrdinal)||!samePaText(rawSnapshot.physicalPitchSourceId))return fail();
  const lineage=rawSnapshot.lineage,enrollment=lineage.enrollmentReference;
  if(!object(enrollment)||!samePaText(enrollment.sourceId)||!samePaReferenceValid(enrollment,'same_pa_enrollments')||!samePaText(lineage.careerId)||!samePaText(lineage.gameId)||!nat(lineage.playId)
   ||!('previousOperationReference' in source)||row.source_version!==source.sourceVersion||row.enrollment_source_id!==enrollment.sourceId
   ||row.career_id!==lineage.careerId||row.game_id!==lineage.gameId||row.play_id!==lineage.playId||row.pitch_ordinal!==rawSnapshot.pitchOrdinal
   ||row.operation_ordinal!==rawSnapshot.operationOrdinal||row.physical_pitch_source_id!==rawSnapshot.physicalPitchSourceId||row.view_source_id!==source.viewReference.sourceId
   ||!('launchReference' in source)||rawSnapshot.physicalPitchSourceId!==source.launchReference.sourceId
   ||row.previous_owner!==source.previousOperationReference.owner||row.previous_source_id!==source.previousOperationReference.sourceId
   ||row.canonical_key!==json([enrollment,rawSnapshot.pitchOrdinal,rawSnapshot.operationOrdinal])||claim.enrollmentSourceIds.length!==1||claim.enrollmentSourceIds[0]!==enrollment.sourceId)return fail();
  if(owner===commitOwner){
   if(!['same_pa_physical_commitment_v1','same_pa_physical_commitment_v123','same_pa_physical_observed_spin_aim_trial_v226','same_pa_physical_qualified_spin_aim_v233'].includes(source.capability)
    ||rawSnapshot.kind!=='same_pa_physical_commitment_v1'||rawSnapshot.stage!=='committed'||!nat(rawSnapshot.beforeWorldRevision)||!nat(rawSnapshot.afterWorldRevision)
    ||rawSnapshot.afterWorldRevision!==rawSnapshot.beforeWorldRevision+1||!samePaText(rawSnapshot.actionKey)||!('launchReference' in source)
    ||rawSnapshot.actionKey!==json(['same-pa-effective-commitment-v1',enrollment,source.launchReference]))return fail();
   const matches=events.filter(e=>e.career_id===lineage.careerId&&e.world_revision===rawSnapshot.afterWorldRevision);
   const expected={kind:eventKind,reference,beforeWorldRevision:rawSnapshot.beforeWorldRevision,afterWorldRevision:rawSnapshot.afterWorldRevision,actionKey:rawSnapshot.actionKey};
   if(matches.length!==1||matches[0].source_kind!==eventKind||matches[0].source_event_id!==row.source_id||matches[0].event_json!==json(expected))return fail();
   commits.push({reference:reference as SamePaReference<typeof commitOwner>,careerId:lineage.careerId,beforeWorldRevision:rawSnapshot.beforeWorldRevision,
    afterWorldRevision:rawSnapshot.afterWorldRevision,actionKey:rawSnapshot.actionKey,enrollmentSourceId:enrollment.sourceId,pitchOrdinal:rawSnapshot.pitchOrdinal,launchReference:source.launchReference});
  }else{
   if(source.capability!=='same_pa_physical_resolution_v1'||rawSnapshot.kind!=='same_pa_physical_resolution_v1'||rawSnapshot.stage!=='resolved')return fail();
   if(source.commitmentReference!==null){
    resolutions.push({reference:reference as SamePaReference<typeof resolutionOwner>,commitmentReference:source.commitmentReference,careerId:lineage.careerId,
      enrollmentSourceId:enrollment.sourceId,pitchOrdinal:rawSnapshot.pitchOrdinal,launchReference:source.launchReference});}
  }
 }
 const revisions=new Set<string>(), idsInEvents=new Set<string>();
 for(const e of events.filter(e=>e.source_kind===eventKind)){
  const matches=commits.filter(c=>c.careerId===e.career_id&&c.afterWorldRevision===e.world_revision&&c.reference.sourceId===e.source_event_id);
  const key=json([e.career_id,e.world_revision]),id=json([e.career_id,e.source_event_id]);if(matches.length!==1||revisions.has(key)||idsInEvents.has(id))return fail();revisions.add(key);idsInEvents.add(id);
 }
 const seenResolutions=new Set<string>();for(const r of resolutions){const matches=commits.filter(c=>eq(c.reference,r.commitmentReference));
  if(matches.length!==1||matches[0].careerId!==r.careerId||matches[0].enrollmentSourceId!==r.enrollmentSourceId
   ||matches[0].pitchOrdinal!==r.pitchOrdinal||!eq(matches[0].launchReference,r.launchReference)||seenResolutions.has(r.commitmentReference.sourceId))return fail();seenResolutions.add(r.commitmentReference.sourceId);}
 const selected=commits.filter(c=>c.careerId===careerId&&c.afterWorldRevision<=endWorldRevision),selectedIds=new Set(selected.map(c=>c.reference.sourceId));
 return {commitments:selected.map(({reference,careerId,beforeWorldRevision,afterWorldRevision,actionKey})=>({reference,careerId,beforeWorldRevision,afterWorldRevision,actionKey})),
  resolutionCandidates:resolutions.filter(r=>selectedIds.has(r.commitmentReference.sourceId)).map(({reference,commitmentReference})=>({reference,commitmentReference}))};
}
/** Authenticate from the actual Owner metadata and World rows inside one read-only snapshot. */
export function readPhysicalCommitmentWorldMembershipV232(db:DatabaseSync,input:Omit<Input,'prefix'|'claims'|'events'>):PhysicalWorldMembershipV232 {
 if(!db.isTransaction||db.prepare('PRAGMA query_only').get()!.query_only!==1)return fail();
 const head=readEmotionWorldRevisionFromSqlite(db,input.careerId);if(!head||head.head.worldRevision<input.endWorldRevision)return fail();
 const events=db.prepare('SELECT career_id,world_revision,source_kind,source_event_id,event_json FROM main.world_decision_revision_events ORDER BY career_id,world_revision').all().map(e=>({career_id:e.career_id,world_revision:e.world_revision,source_kind:e.source_kind,source_event_id:e.source_event_id,event_json:e.event_json}));
 const prefix=events.filter(e=>e.career_id===input.careerId&&Number(e.world_revision)<=input.endWorldRevision);
 assertWorldPrefixV232(input,prefix);
 return authenticatePhysicalCommitmentMembershipMetadataV232({...input,prefix,events,claims:readSamePaLifecycleClaimRows(db)});
}

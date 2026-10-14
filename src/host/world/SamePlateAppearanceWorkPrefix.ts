import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type SamePaReference<Owner extends string=string>=Readonly<{owner:Owner;sourceId:string;sourceHash:string;snapshotHash:string}>;
export type SamePaParticipantReference=Readonly<{playerId:string;bindingHash:string;personHash:string;baselineSourceId:string;revision:number;stateHash:string}>;
export type SamePaExecutionLineage=Readonly<{
  enrollmentReference:SamePaReference<'same_pa_enrollments'>;actorReference:SamePaReference<'physical_plate_appearance_actors'>;
  careerId:string;gameId:string;playId:number;firstPhysicalPitchSourceId:string;participantReferences:readonly SamePaParticipantReference[];
}>;
export type AcceptedSamePaWorkPrefix=Readonly<{sourceId:string;sourceVersion:string;capability:'reserved_same_pa_empty_prefix_v1';enrollmentReference:SamePaReference<'same_pa_enrollments'>}>;
export type SamePaEmptyWorkPrefix=Readonly<{kind:'empty_prefix';source:AcceptedSamePaWorkPrefix;lineage:SamePaExecutionLineage;
  physicalRevision:0;endpoint:null;episodes:readonly [];resumes:readonly [];timeline:CanonicalPlateAppearanceTimeline;
  worldHash:string;timelineHash:string;domainCensus:readonly string[];participantWork:readonly Readonly<{playerId:string;work:readonly []}>[];coverageHash:string}>;
export const samePaFields=(value:unknown,names:readonly string[]):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
export const samePaText=(value:unknown):value is string=>typeof value==='string'&&!!value&&value===value.trim();
export const samePaHash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const samePaReferenceValid=(value:unknown,owner:string):boolean=>samePaFields(value,['owner','sourceId','sourceHash','snapshotHash'])
  &&value.owner===owner&&samePaText(value.sourceId)&&samePaHash(value.sourceHash)&&samePaHash(value.snapshotHash);
export const samePaParticipantValid=(value:unknown):boolean=>samePaFields(value,['playerId','bindingHash','personHash','baselineSourceId','revision','stateHash'])
  &&samePaText(value.playerId)&&samePaText(value.baselineSourceId)&&samePaHash(value.bindingHash)&&samePaHash(value.personHash)&&samePaHash(value.stateHash)
  &&Number.isSafeInteger(value.revision)&&Number(value.revision)>=0;
export const samePaPrefixInput=(raw:unknown,id?:string):AcceptedSamePaWorkPrefix=>{
  const value=cloneInert(raw) as AcceptedSamePaWorkPrefix;
  if(!samePaFields(value,['sourceId','sourceVersion','capability','enrollmentReference'])||!samePaText(value.sourceId)||!samePaText(value.sourceVersion)
    ||id!==undefined&&value.sourceId!==id||value.capability!=='reserved_same_pa_empty_prefix_v1'||!samePaReferenceValid(value.enrollmentReference,'same_pa_enrollments'))throw new Error('invalid same-PA empty prefix Source');
  return freeze(value);
};

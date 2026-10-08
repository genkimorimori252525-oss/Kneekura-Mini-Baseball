import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields,samePaText,samePaReferenceValid } from './SamePlateAppearanceWorkPrefix';
import { samePaTotalInput,type AcceptedSamePaCumulativeTotal,type SamePaCumulativeTotal } from './SamePlateAppearanceCumulativeTotal';
import type { SamePaTotalReference } from './SamePlateAppearanceExecutionView';
/** An observed collection, with no accepted aggregate Source or owner row. */
export type SamePaTotalSet=Readonly<{kind:'total_set';totals:readonly SamePaCumulativeTotal[];participantTotalReferences:readonly SamePaTotalReference[]}>;
const order=(a:string,b:string)=>a<b?-1:a>b?1:0;
export const samePaTotalSetIds=(raw:unknown):readonly string[]=>{
  const ids=cloneInert(raw) as string[];
  if(!Array.isArray(ids)||ids.length!==10||!ids.every(samePaText)||new Set(ids).size!==10)throw new Error('same-PA TOTAL set needs exactly ten distinct Source identities');
  return freeze(ids);
};
/** Also checks the available subset before a missing-input pending result. */
export const assertSamePaTotalSetDistinct=(sources:readonly AcceptedSamePaCumulativeTotal[]):void=>{
  if(new Set(sources.map(s=>s.sourceId)).size!==sources.length||new Set(sources.map(s=>s.participantReference.playerId)).size!==sources.length
    ||new Set(sources.map(s=>s.provenance.assessmentSourceId)).size!==sources.length
    ||sources.some(s=>sources.some(other=>other.sourceId!==s.sourceId&&other.sourceId===s.provenance.assessmentSourceId)))throw new Error('same-PA TOTAL set duplicate participant or assessment provenance ownership');
};
export const samePaTotalSetSources=(raw:readonly unknown[]):readonly AcceptedSamePaCumulativeTotal[]=>{
  if(raw.length!==10)throw new Error('same-PA TOTAL set needs exactly ten Sources');
  const sources=raw.map(s=>samePaTotalInput(s));assertSamePaTotalSetDistinct(sources);
  return freeze(sources.sort((a,b)=>order(a.participantReference.playerId,b.participantReference.playerId)));
};
export const samePaTotalSetReferences=(raw:unknown):readonly SamePaTotalReference[]=>{
  const refs=cloneInert(raw) as SamePaTotalReference[];
  if(!Array.isArray(refs)||refs.length!==10||refs.some(r=>!samePaFields(r,['playerId','assessmentReference'])||!samePaText(r.playerId)||!samePaReferenceValid(r.assessmentReference,'reserved_pa_total_assessments'))
    ||new Set(refs.map(r=>r.playerId)).size!==10||new Set(refs.map(r=>r.assessmentReference.sourceId)).size!==10)throw new Error('same-PA TOTAL set needs exactly ten participant owner references');
  return freeze(refs.sort((a,b)=>order(a.playerId,b.playerId)));
};

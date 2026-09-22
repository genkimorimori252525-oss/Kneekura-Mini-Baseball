import type { TraitResult } from '../TraitTypes';
import type { SourceTraitAssessment } from '../sources/SourceTraitTypes';
import { findSourceTraitFamily } from '../sources/SourceTraitFamilies';
import { attempt, order } from '../TraitValidation';
import { readMeasuredRequest } from './MeasuredTraitValidation';
import { summarizeMeasurements } from './MeasuredTraitStatistics';
import type { MeasuredTraitClassification } from './MeasuredTraitTypes';
/** Real measurements -> recognition proposal. Missing evidence never becomes a false ABSENT classification. */
export function classifyMeasuredTrait(input: unknown): TraitResult<MeasuredTraitClassification> {
  return attempt(() => {
    const r=readMeasuredRequest(input);
    const windowStart=r.time.day-r.model.windowDays+1;
    const observations=r.observations.filter(o=>o.time.day>=windowStart);
    const groups=new Map<string,{episodeId:string;time:typeof r.time;eventIds:string[]}>();
    for(const o of observations) {
      const g=groups.get(o.episodeId);
      if(g){g.time=o.time;g.eventIds.push(o.eventId);}else groups.set(o.episodeId,{episodeId:o.episodeId,time:o.time,eventIds:[o.eventId]});
    }
    const episodes=[...groups.values()].sort((a,b)=>a.time.day-b.time.day||a.time.sequence-b.time.sequence||order(a.episodeId,b.episodeId))
      .map(e=>({...e,eventIds:e.eventIds.sort(order)}));
    const span=episodes.length?episodes[episodes.length-1]!.time.day-episodes[0]!.time.day:0;
    const common={boundary:'MEASURED_TRAIT_CLASSIFICATION_ONLY' as const,algorithmVersion:'measured-traits-v1' as const,
      request:r,sampleCount:observations.length,episodeCount:episodes.length,evidenceSpanDays:span};
    const reasons:Array<'STALE_SOURCE'|'INSUFFICIENT_EVIDENCE'|'INSUFFICIENT_FAILURE_EPISODES'>=[];
    if(r.time.day-r.source.time.day>r.model.maximumSourceAgeDays) reasons.push('STALE_SOURCE');
    if(episodes.length<r.model.minimumEpisodes||span<r.model.minimumDays) reasons.push('INSUFFICIENT_EVIDENCE');
    if(reasons.length)return {...common,status:'UNAVAILABLE' as const,reasons,metrics:[],assessment:null};
    const statistics=summarizeMeasurements({...r,observations});
    if(statistics.insufficientFailureEpisodes)return {...common,status:'UNAVAILABLE' as const,reasons:['INSUFFICIENT_FAILURE_EPISODES' as const],metrics:statistics.metrics,assessment:null};
    const family=findSourceTraitFamily(r.model.rule.familyId)!;
    const assessment:SourceTraitAssessment={familyId:family.familyId,classificationId:r.classificationId,scope:r.scope,time:r.time,
      stateId:statistics.stateId,targetTeamId:null,modelId:r.model.modelId,modelVersion:r.model.version,changeKind:'RECOGNITION',
      bindings:[{role:family.requirements[0]!.role,source:r.source}],episodes};
    return {...common,status:'READY' as const,reasons:[] as const,metrics:statistics.metrics,assessment};
  });
}

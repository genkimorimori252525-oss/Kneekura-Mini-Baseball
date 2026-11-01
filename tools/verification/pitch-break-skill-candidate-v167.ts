import { cloneInert } from '../../src/core/adjudication/OfficialWindowPolicy';
import { analyzePitchBreakLowSpinCasesV158, PITCH_BREAK_LOW_SPIN_PROTOCOL_V158,
  type PitchBreakLowSpinComparisonV158 } from './pitch-break-low-spin-v158';

export type PitchBreakSkillCandidateInputV167=Readonly<{id:string;comparison:PitchBreakLowSpinComparisonV158;
  percentTimes:Readonly<{p10:number|null;p50:number|null;p90:number|null}>;referenceElapsedSeconds:number}>;

function assert(value:unknown,message:string):asserts value { if(!value)throw Error('pitch break skill candidate: '+message); }
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
const old=PITCH_BREAK_LOW_SPIN_PROTOCOL_V158;
export const PITCH_BREAK_SKILL_CANDIDATE_PROTOCOL_V167=freeze({version:'pitch_break_skill_candidate_protocol_v167',
  authority:'MODEL_CANDIDATE_SCREEN_NOT_SKILL_ADMISSION',maximumAbsoluteAmountDifferenceMeters:old.maximumAbsoluteAmountDifferenceMeters,
  maximumRelativeAmountDifference:old.maximumRelativeAmountDifference,maximumDirectionDifferenceDegrees:old.maximumDirectionDifferenceDegrees,
  minimumP50FractionDifference:old.minimumP50FractionDifference,minimumLate20FractionDifference:old.minimumLate20FractionDifference,
  requiredOrder:'INCREASING_LATE20_WITH_INCREASING_P10_AND_DECREASING_P90_MINUS_P10',
  adjacentTimingScreen:'UNCHANGED_V158_P50_FRACTION_DIFFERENCE_OR_LATE20_FRACTION_DIFFERENCE',
  p50OrderRequired:false,p90OrderRequired:false,newPerceptionThresholdAdded:false,skillAdmission:false,baselineGate:'NOT_EVALUATED'});

/** Pure observation screen. Percentile arrival times describe accumulated
 * displacement and never identify force onset or grant skill admission. */
export function analyzePitchBreakSkillCandidatesV167(raw:readonly PitchBreakSkillCandidateInputV167[]){
  const cases=cloneInert(raw),reference=cases[0]?.referenceElapsedSeconds;
  assert(cases.every(item=>item.id===item.comparison.id),'input and comparison IDs must agree');
  assert(cases.every(item=>item.referenceElapsedSeconds>0&&item.referenceElapsedSeconds===reference),'positive common reference elapsed time required');
  const pairAnalysis=analyzePitchBreakLowSpinCasesV158(cases.map(item=>item.comparison)),
    key=(ids:readonly string[])=>JSON.stringify([...ids].sort()),
    pairByIds=new Map(pairAnalysis.pairs.map(item=>[key([item.caseAId,item.caseBId]),item])),triples=[];
  for(let i=0;i<cases.length;i++)for(let j=i+1;j<cases.length;j++)for(let k=j+1;k<cases.length;k++){
    const rows=[cases[i],cases[j],cases[k]],caseIds=rows.map(item=>item.id),
      pairs=[[0,1],[0,2],[1,2]].map(([a,b])=>pairByIds.get(key([caseIds[a],caseIds[b]]))!),
      nearAmountAndDirection=pairs.every(item=>item.matchedAmountAndDirection),largeAmountBand=pairs.every(item=>item.largeAmountBand),
      late20Available=rows.every(item=>item.comparison.commonTime.late20Fraction!==null),
      ordered=late20Available?[...rows].sort((a,b)=>a.comparison.commonTime.late20Fraction!-b.comparison.commonTime.late20Fraction!):null,
      orderedCaseIds=ordered===null?null:ordered.map(item=>item.id),
      observations=ordered===null?null:ordered.map(item=>({id:item.id,...item.percentTimes,
        transitionIntervalSeconds:item.percentTimes.p10===null||item.percentTimes.p90===null?null:item.percentTimes.p90-item.percentTimes.p10,
        late20Fraction:item.comparison.commonTime.late20Fraction})),
      percentilesAvailable=observations!==null&&observations.every(item=>item.p10!==null&&item.p50!==null&&item.p90!==null),
      withinCasePercentileOrder=percentilesAvailable&&observations!.every(item=>item.p10!>=0&&item.p10!<=item.p50!&&
        item.p50!<=item.p90!&&item.p90!<=reference!),
      late20StrictlyIncreasing=observations!==null&&observations[0].late20Fraction!<observations[1].late20Fraction!&&
        observations[1].late20Fraction!<observations[2].late20Fraction!,
      p10StrictlyIncreasing=percentilesAvailable&&observations![0].p10!<observations![1].p10!&&observations![1].p10!<observations![2].p10!,
      transitionIntervalStrictlyDecreasing=percentilesAvailable&&observations![0].transitionIntervalSeconds!>observations![1].transitionIntervalSeconds!&&
        observations![1].transitionIntervalSeconds!>observations![2].transitionIntervalSeconds!,
      adjacentTimeShapeCandidate=orderedCaseIds!==null&&pairByIds.get(key(orderedCaseIds.slice(0,2)))!.timeShapeCandidate&&
        pairByIds.get(key(orderedCaseIds.slice(1,3)))!.timeShapeCandidate,
      modelCandidate=nearAmountAndDirection&&withinCasePercentileOrder&&late20StrictlyIncreasing&&p10StrictlyIncreasing&&
        transitionIntervalStrictlyDecreasing&&adjacentTimeShapeCandidate,reasons=[];
    if(!nearAmountAndDirection)reasons.push('V158_AMOUNT_DIRECTION_OR_CLASSIFICATION_NOT_MATCHED_IN_ALL_PAIRS');
    if(!late20StrictlyIncreasing)reasons.push('LATE20_NOT_STRICTLY_INCREASING');
    if(!percentilesAvailable)reasons.push('PERCENTILE_TIMES_UNAVAILABLE');
    else{
      if(!withinCasePercentileOrder)reasons.push('PERCENTILE_TIMES_OUT_OF_ORDER_WITHIN_CASE');
      if(!p10StrictlyIncreasing)reasons.push('P10_NOT_STRICTLY_INCREASING');
      if(!transitionIntervalStrictlyDecreasing)reasons.push('TRANSITION_INTERVAL_NOT_STRICTLY_DECREASING');
    }
    if(!adjacentTimeShapeCandidate)reasons.push('V158_ADJACENT_TIMING_SCREEN_NOT_MET');
    triples.push({caseIds,orderedCaseIds,nearAmountAndDirection,largeAmountBand,late20StrictlyIncreasing,p10StrictlyIncreasing,
      transitionIntervalStrictlyDecreasing,adjacentTimeShapeCandidate,withinCasePercentileOrder,modelCandidate,
      skillAdmission:false as const,reasons,observations});
  }
  const modelCandidates=triples.filter(item=>item.modelCandidate);
  return freeze({pairs:pairAnalysis.pairs,triples,summary:{caseCount:cases.length,pairCount:pairAnalysis.pairs.length,tripleCount:triples.length,
    nearAmountAndDirectionTripleCount:triples.filter(item=>item.nearAmountAndDirection).length,
    modelCandidateCount:modelCandidates.length,modelCandidates:modelCandidates.map(({orderedCaseIds,observations,largeAmountBand})=>
      ({orderedCaseIds,observations,largeAmountBand,modelCandidate:true as const,skillAdmission:false as const})),
    skillAdmission:false as const,baselineGate:'NOT_EVALUATED' as const}});
}

import { expect, it } from 'vitest';
import { analyzePitchBreakSkillCandidatesV167, type PitchBreakSkillCandidateInputV167 } from './pitch-break-skill-candidate-v167';

// Synthetic summaries test only the predicate. No Source flight is evaluated.
const observation=(id:string,p10:number|null,p50:number|null,p90:number|null,late20Fraction:number|null,amount=.5):PitchBreakSkillCandidateInputV167=>({
  id,referenceElapsedSeconds:1,percentTimes:{p10,p50,p90},comparison:{id,factors:{spinScale:.04,gyroDegrees:30,materialPhaseDegrees:0},
    commonTime:{status:'CLASSIFIED',amountMeters:amount,direction:{x:1,y:0},p50Fraction:p50,late20Fraction},
    samePlane:{status:'CLASSIFIED',amountMeters:amount,direction:{x:1,y:0}}},
});
const desirable=()=>[observation('weak',.1,.4,.8,.2),observation('middle',.2,.35,.7,.35),observation('strong',.3,.34,.6,.5)];
const analyze=(input:PitchBreakSkillCandidateInputV167[])=>{
  const before=structuredClone(input),result=analyzePitchBreakSkillCandidatesV167(input);expect(input).toStrictEqual(before);return result;
};
const triple=(input:PitchBreakSkillCandidateInputV167[])=>{const result=analyze(input);expect(result.triples).toHaveLength(1);return result.triples[0];};

it('accepts later p10 with a shorter transition and increasing late20 even when p50 and p90 become earlier',()=>{
  const input=desirable(),result=analyze([input[2],input[0],input[1]]),item=result.triples[0];
  expect(item.orderedCaseIds).toStrictEqual(['weak','middle','strong']);expect(item.modelCandidate).toBe(true);
  expect(item.p10StrictlyIncreasing).toBe(true);expect(item.transitionIntervalStrictlyDecreasing).toBe(true);
  expect(item.late20StrictlyIncreasing).toBe(true);expect(item.adjacentTimeShapeCandidate).toBe(true);
  expect(item.observations!.map(row=>row.transitionIntervalSeconds)).toStrictEqual([.7000000000000001,.49999999999999994,.3]);
  expect(item.reasons).toStrictEqual([]);expect(item.skillAdmission).toBe(false);expect(result.summary.modelCandidateCount).toBe(1);
  expect(result.summary.skillAdmission).toBe(false);expect(result.summary.baselineGate).toBe('NOT_EVALUATED');
});

it('reuses either p50 fraction or late20 fraction difference in the old adjacent OR screen',()=>{
  const lateOnly=[observation('a',.1,.4,.8,.2),observation('b',.2,.4,.7,.35),observation('c',.3,.4,.6,.5)],
    p50Only=[observation('a',.1,.3,.8,.2),observation('b',.2,.4,.75,.201),observation('c',.3,.5,.7,.202)];
  expect(triple(lateOnly).modelCandidate).toBe(true);expect(triple(p50Only).modelCandidate).toBe(true);
});

it('rejects later p10 alone when the transition interval does not shorten',()=>{
  const item=triple([observation('a',.1,.4,.6,.2),observation('b',.2,.5,.7,.35),observation('c',.3,.6,.8,.5)]);
  expect(item.p10StrictlyIncreasing).toBe(true);expect(item.transitionIntervalStrictlyDecreasing).toBe(false);
  expect(item.modelCandidate).toBe(false);expect(item.reasons).toContain('TRANSITION_INTERVAL_NOT_STRICTLY_DECREASING');
});

it('rejects a shorter transition alone when p10 does not become later',()=>{
  const item=triple([observation('a',.1,.4,.8,.2),observation('b',.1,.35,.6,.35),observation('c',.1,.3,.4,.5)]);
  expect(item.transitionIntervalStrictlyDecreasing).toBe(true);expect(item.p10StrictlyIncreasing).toBe(false);expect(item.modelCandidate).toBe(false);
});

it('rejects early concentration when late20 moves opposite to later p10 and a shorter transition',()=>{
  const item=triple([observation('a',.1,.4,.8,.5),observation('b',.2,.35,.7,.35),observation('c',.3,.34,.6,.2)]);
  expect(item.orderedCaseIds).toStrictEqual(['c','b','a']);expect(item.modelCandidate).toBe(false);
  expect(item.p10StrictlyIncreasing).toBe(false);expect(item.transitionIntervalStrictlyDecreasing).toBe(false);
});

it('does not replace the old adjacent time-difference screen with arbitrarily small changes',()=>{
  const item=triple([observation('a',.1,.4,.8,.2),observation('b',.2,.4,.7,.21),observation('c',.3,.4,.6,.22)]);
  expect(item.p10StrictlyIncreasing).toBe(true);expect(item.transitionIntervalStrictlyDecreasing).toBe(true);
  expect(item.late20StrictlyIncreasing).toBe(true);expect(item.adjacentTimeShapeCandidate).toBe(false);expect(item.modelCandidate).toBe(false);
});

it('requires unchanged absolute and relative amount limits and direction limits on every pair in both bases',()=>{
  const input=desirable(),amounts=[.5,.515,.53],changed=input.map((item,index)=>({...item,comparison:{...item.comparison,
    commonTime:{...item.comparison.commonTime,amountMeters:amounts[index]},samePlane:{...item.comparison.samePlane,amountMeters:amounts[index]}}})),
    result=analyze(changed);
  expect(result.pairs.filter(item=>item.matchedAmountAndDirection)).toHaveLength(2);expect(result.triples[0].modelCandidate).toBe(false);
  for(const basis of ['commonTime','samePlane'] as const){
    const direction=desirable().map((item,index)=>{const angle=(index-1)*3*Math.PI/180;return {...item,comparison:{...item.comparison,
      [basis]:{...item.comparison[basis],direction:{x:Math.cos(angle),y:Math.sin(angle)}}}};});
    expect(analyze(direction).triples[0].modelCandidate).toBe(false);
  }
  const small=desirable().map((item,index)=>({...item,comparison:{...item.comparison,
    commonTime:{...item.comparison.commonTime,amountMeters:.01+index*.001},samePlane:{...item.comparison.samePlane,amountMeters:.01+index*.001}}}));
  expect(triple(small).modelCandidate).toBe(false);
});

it('retains nonmonotonic, unclassified, small, missing-plane and zero observations as failed candidates',()=>{
  const input=desirable(),bad=input[1],invalid=[
    ...(['NON_MONOTONIC_PROJECTION','UNCLASSIFIED','SMALL_FINAL_DISPLACEMENT'] as const).map(status=>({...bad,
      comparison:{...bad.comparison,commonTime:{...bad.comparison.commonTime,status}}})),
    {...bad,comparison:{...bad.comparison,samePlane:{status:'NO_FINITE_PLANE_CROSSING' as const,amountMeters:null,direction:null}}},
    {...bad,comparison:{...bad.comparison,commonTime:{...bad.comparison.commonTime,amountMeters:0}}},
  ];
  for(const item of invalid){const rejected=triple([input[0],item,input[2]]);expect(rejected.modelCandidate).toBe(false);expect(rejected.reasons.length).toBeGreaterThan(0);}
});

it('rejects unavailable percentiles, tied p10 or late20 and invalid within-case percentile order without filling data',()=>{
  const input=desirable();
  for(const key of ['p10','p50','p90'] as const){
    const bad={...input[1],percentTimes:{...input[1].percentTimes,[key]:null}},item=triple([input[0],bad,input[2]]);
    expect(item.modelCandidate).toBe(false);expect(item.observations![1][key]).toBeNull();
  }
  expect(triple([input[0],{...input[1],percentTimes:{...input[1].percentTimes,p10:.1}},input[2]]).modelCandidate).toBe(false);
  expect(triple([input[0],{...input[1],comparison:{...input[1].comparison,commonTime:{...input[1].comparison.commonTime,late20Fraction:.2}}},input[2]]).modelCandidate).toBe(false);
  expect(triple([input[0],{...input[1],percentTimes:{p10:.4,p50:.3,p90:.7}},input[2]]).modelCandidate).toBe(false);
});

it('enumerates all pairs and triples for fifty-six inputs without mutating or freezing the caller',()=>{
  const input=Array.from({length:56},(_,i)=>observation('case-'+i,.1+i*.001,.4,.9-i*.001,.1+i*.01)),result=analyze(input);
  expect(result.pairs).toHaveLength(1540);expect(result.triples).toHaveLength(27720);
  expect(result.summary.caseCount).toBe(56);expect(result.summary.tripleCount).toBe(27720);
  expect(Object.isFrozen(input[0].percentTimes)).toBe(false);expect(Object.isFrozen(result.triples[0])).toBe(true);
});

it('rejects inconsistent identifiers, duplicate IDs and reference clocks while allowing empty input',()=>{
  const input=desirable();expect(()=>analyzePitchBreakSkillCandidatesV167([input[0],input[0]])).toThrow(/unique/);
  expect(()=>analyzePitchBreakSkillCandidatesV167([{...input[0],id:'wrong'}])).toThrow(/IDs/);
  expect(()=>analyzePitchBreakSkillCandidatesV167([input[0],{...input[1],referenceElapsedSeconds:2}])).toThrow(/common reference/);
  const empty=analyze([]);expect(empty.triples).toStrictEqual([]);expect(empty.summary.modelCandidateCount).toBe(0);
});

/** Preference affects an attempted route, never a catch, speed or official out.
 * Timing tolerance and judgement spread are provisional controller tuning. */
export const LIVE_DOUBLE_PLAY_POLICY_V106 = Object.freeze({ lateToleranceSeconds: .65, judgementSpreadSeconds: .12 });
export type LiveDoublePlayRouteV106 = Readonly<{ firstRunnerId:string; firstBase:number; secondRunnerId:string;
  secondBase:number; firstMarginSeconds:number; secondMarginSeconds:number; controlSeconds:number }>;
export function decideLiveDoublePlayV106(input:Readonly<{ outs:number; seed:number; opportunityId:string;
  pursuitCostWeight:number; routes:readonly LiveDoublePlayRouteV106[] }>){
  if(!Number.isInteger(input.outs)||input.outs<0||input.outs>2||!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>0xffffffff
    ||!input.opportunityId||!Number.isFinite(input.pursuitCostWeight)||input.pursuitCostWeight<.25||input.pursuitCostWeight>4
    ||input.routes.some(r=>![r.firstMarginSeconds,r.secondMarginSeconds,r.controlSeconds].every(Number.isFinite)||r.controlSeconds<0))
    throw new Error('invalid double play decision');
  let hash=(2166136261^input.seed)>>>0;for(const c of input.opportunityId)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  hash=Math.imul(hash^(hash>>>16),0x85ebca6b)>>>0;
  const cautious=input.pursuitCostWeight>1,judgementSeconds=(hash/4294967296*2-1)*LIVE_DOUBLE_PLAY_POLICY_V106.judgementSpreadSeconds/Math.max(1,input.pursuitCostWeight),
    toleranceSeconds=cautious?0:LIVE_DOUBLE_PLAY_POLICY_V106.lateToleranceSeconds/Math.sqrt(input.pursuitCostWeight),
    // An optimistic close-play decision may lose both races. No single-out
    // guarantee is imposed on a human-like attempt at two retirements.
    eligible=input.outs===2?[]:input.routes.filter(r=>r.firstMarginSeconds+judgementSeconds>=-toleranceSeconds
      &&r.secondMarginSeconds+judgementSeconds>=-toleranceSeconds),
    selected=eligible.slice().sort((a,b)=>a.controlSeconds-b.controlSeconds||b.firstBase-a.firstBase||a.firstRunnerId.localeCompare(b.firstRunnerId))[0]??null;
  return {selected,toleranceSeconds,judgementSeconds,cautious,reason:input.outs===2?'TWO_OUTS_SINGLE_RETIREMENT':selected?'ATTEMPT_DOUBLE_PLAY':'NO_PLAUSIBLE_DOUBLE_PLAY'} as const;
}

/** Opt-in defense policy. Omission keeps the old "throw only on a positive margin" rule exact. */
export type LiveFieldThrowPolicyV1=Readonly<{version:'live_field_throw_policy_v1';sourceId:string}>;
export const LIVE_FIELD_THROW_POLICY_V1:LiveFieldThrowPolicyV1=Object.freeze({version:'live_field_throw_policy_v1',sourceId:'field-throw-v1-authored'});
/** Authored game AI, not a measured curve. Seconds are how late the throw is forecast to be.
 * Past `hopelessSeconds` nobody throws. Below it, holding back is a judgment that takes skill:
 * the weakest fielder still throws at the hopeless line, the best one gives up at `sharpestSeconds`. */
export const LIVE_CLOSE_THROW_CALIBRATION_V1=Object.freeze({hopelessSeconds:.85,sharpestSeconds:.2,
  bestDecisionSeconds:.035,worstDecisionSeconds:.3,neutralSkill:.5,widestNoiseSeconds:.12,narrowestNoiseSeconds:.04,cautiousScale:.6,
  /** A holder this far from every bag sends the ball back in instead of keeping it. */returnDistanceMeters:15,returnWaitSeconds:4});
export function validateLiveFieldThrowPolicyV1(policy:LiveFieldThrowPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_field_throw_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid field throw policy');
  return policy;
}
/** Skill reads the fielder's own decision speed, the one input of 守備力 that is judgment. Zero means unauthored. */
export function liveCloseThrowSkillV1(decisionSeconds:number){
  const c=LIVE_CLOSE_THROW_CALIBRATION_V1;
  if(!Number.isFinite(decisionSeconds)||decisionSeconds<=0)return c.neutralSkill;
  return Math.min(1,Math.max(0,(c.worstDecisionSeconds-decisionSeconds)/(c.worstDecisionSeconds-c.bestDecisionSeconds)));
}
/** How late a fielder still throws. Aggression and caution come from the same fields the
 * pursuit choice reads, so a trait reaches this only through its resolved values. */
export function liveCloseThrowToleranceV1(input:Readonly<{decisionSeconds:number;pursuitCostWeight:number;cautious?:boolean}>){
  const c=LIVE_CLOSE_THROW_CALIBRATION_V1,skill=liveCloseThrowSkillV1(input.decisionSeconds),
    base=c.hopelessSeconds+(c.sharpestSeconds-c.hopelessSeconds)*skill;
  return Math.min(c.hopelessSeconds,base/Math.sqrt(input.pursuitCostWeight)*(input.cautious?c.cautiousScale:1));
}
/** One stable draw per opportunity, so replanning cannot flip the choice by redrawing. */
export function decideLiveCloseThrowV1(input:Readonly<{seed:number;opportunityId:string;marginSeconds:number;decisionSeconds:number;pursuitCostWeight:number;cautious?:boolean}>){
  if(!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>0xffffffff||!input.opportunityId||!Number.isFinite(input.marginSeconds)
    ||!Number.isFinite(input.pursuitCostWeight)||input.pursuitCostWeight<.25||input.pursuitCostWeight>4)throw Error('invalid close throw estimate');
  const c=LIVE_CLOSE_THROW_CALIBRATION_V1;
  let hash=(2166136261^input.seed)>>>0;
  for(const ch of 'close-throw:'+input.opportunityId)hash=Math.imul(hash^ch.charCodeAt(0),16777619)>>>0;
  hash=Math.imul(hash^(hash>>>16),0x85ebca6b)>>>0;
  const skill=liveCloseThrowSkillV1(input.decisionSeconds),toleranceSeconds=liveCloseThrowToleranceV1(input),
    judgementSeconds=(hash/4294967296*2-1)*(c.widestNoiseSeconds+(c.narrowestNoiseSeconds-c.widestNoiseSeconds)*skill),
    hopeless=input.marginSeconds<-c.hopelessSeconds,
    attempt=!hopeless&&input.marginSeconds+judgementSeconds>=-toleranceSeconds;
  return {attempt,skill,toleranceSeconds,judgementSeconds,
    reason:attempt?'CLOSE_THROW_ATTEMPT':hopeless?'HOPELESS_THROW':'READ_TOO_LATE'} as const;
}

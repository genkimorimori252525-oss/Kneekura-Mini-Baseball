/** Opt-in defense policy. Omission keeps the old "throw only on a positive margin" rule exact. */
export type LiveFieldThrowPolicyV1=Readonly<{version:'live_field_throw_policy_v1';sourceId:string;
  /** Optional (omitted: off). With the ball out beyond the infield dirt and no out to make, the throw back in ahead of a moving
   * runner is timed on him going on through the bags (his own motion model) and thrown as a competitive throw, as an outfielder
   * does rather than lobbing it in on a runner he takes to be stopping (2026-11-09: such lobs, 23 m/s at effort .35, let runners
   * from first take third on singles with almost no outs). */
  runnerContinuesV1?:true;
  /** Optional (omitted: off). A holder going to tag a runner gets down to him: he crouches toward the runner's low point (a slider's
   * leg) and turns to face him, as a catcher drops to tag at the plate. Without it the holder's posture stays upright, his glove
   * cannot get below about half a metre, and a slider passes under it (2026-11-10: catches 0.2-0.5 s ahead of the runner with no
   * tag, 4 of 43 sends home in 24 bundle-10 games). */
  holderTagCrouchV1?:true}>;
export const LIVE_FIELD_THROW_POLICY_V1:LiveFieldThrowPolicyV1=Object.freeze({version:'live_field_throw_policy_v1',sourceId:'field-throw-v1-authored'});
/** Authored game AI, not a measured curve. Seconds are how late the throw is forecast to be.
 * Past `hopelessSeconds` nobody throws. Below it, holding back is a judgment that takes skill:
 * the weakest fielder still throws at the hopeless line, the best one gives up at `sharpestSeconds`. */
export const LIVE_CLOSE_THROW_CALIBRATION_V1=Object.freeze({hopelessSeconds:.85,sharpestSeconds:.2,
  bestDecisionSeconds:.035,worstDecisionSeconds:.3,neutralSkill:.5,widestNoiseSeconds:.12,narrowestNoiseSeconds:.04,cautiousScale:.6,
  /** A holder this far from every bag sends the ball back in instead of keeping it. */returnDistanceMeters:15,returnWaitSeconds:4});
export function validateLiveFieldThrowPolicyV1(policy:LiveFieldThrowPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).some(k=>!['version','sourceId','runnerContinuesV1','holderTagCrouchV1'].includes(k))
    ||policy.runnerContinuesV1!==undefined&&policy.runnerContinuesV1!==true||policy.holderTagCrouchV1!==undefined&&policy.holderTagCrouchV1!==true||policy.version!=='live_field_throw_policy_v1'
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

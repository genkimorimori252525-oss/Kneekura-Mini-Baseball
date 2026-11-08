import type {BatterApproachV122} from './BatterIntentV122';
import type {SpinAimTechniqueV243} from './PredictedContactFrameAimV243';
export type BatterTechniqueV1=SpinAimTechniqueV243;
export type BatterTechniquePolicyV1=Readonly<{version:'batter_technique_policy_v1';sourceId:string;thresholds:Readonly<{minimumComponent:number;minimumImprovement:number}>}>;
/** Only what the batter knows when he commits: his own perceived location, the
 * scoreboard, and his own intent. Actual Source, pitch identity and outcome are absent. */
export type BatterTechniqueInputV1=Readonly<{bats:'R'|'L';perceived:Readonly<{x:number;y:number}>;zone:Readonly<{halfWidth:number;lowerY:number;upperY:number}>;
 balls:number;strikes:number;outs:number;bases:Readonly<{first:boolean;second:boolean;third:boolean}>;
 swingMode:'balanced'|'contact'|'power';plateAggression:number;approach:Pick<BatterApproachV122,'directionCommitment'|'twoStrikeCommitmentDelta'|'preferredWhenCommitted'>|null;draw:number}>;
type Reason='RUNNER_THIRD_LIFT'|'RUNNER_FIRST_GROUND_BALL'|'LOW_PITCH'|'OUTSIDE_OPPOSITE_FIELD'|'INSIDE_PULL';
export type BatterTechniqueSelectionV1=Readonly<{version:'batter_technique_selection_v1';technique:BatterTechniqueV1|null;reason:Reason|'NO_REASON'|'NOT_THIS_SWING'|'INVALID_INPUT';willingness:number;draw:number|null}>;
const unit=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const count=(v:unknown,hi:number)=>Number.isInteger(v)&&(v as number)>=0&&(v as number)<=hi;
/** Canonical order, so a caller's key order never changes a continuation binding. */
export const LIVE_BATTER_TECHNIQUE_POLICY_V1:BatterTechniquePolicyV1=Object.freeze({version:'batter_technique_policy_v1',sourceId:'batter-technique-v1',thresholds:Object.freeze({minimumComponent:1,minimumImprovement:1})});
export function validateBatterTechniquePolicyV1(raw:unknown):BatterTechniquePolicyV1{
 const p=raw as BatterTechniquePolicyV1,t=p?.thresholds;
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).sort().join('|')!=='sourceId|thresholds|version'||p.version!=='batter_technique_policy_v1'||typeof p.sourceId!=='string'||p.sourceId.length===0||p.sourceId.length>200||p.sourceId.trim()!==p.sourceId
  ||!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).sort().join('|')!=='minimumComponent|minimumImprovement'||![t.minimumComponent,t.minimumImprovement].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0))throw Error('batter technique v1: invalid policy');
 return Object.freeze({version:p.version,sourceId:p.sourceId,thresholds:Object.freeze({minimumComponent:t.minimumComponent,minimumImprovement:t.minimumImprovement})});
}
/** Authored batter reasoning, not calibrated league behaviour. One intent per
 * swing at most: the strongest reason decides what he would try, and the draw
 * decides whether he tries it on this swing, so plenty of swings carry nothing. */
export function selectBatterContactTechniqueV1(i:BatterTechniqueInputV1):BatterTechniqueSelectionV1{
 const out=(technique:BatterTechniqueV1|null,reason:BatterTechniqueSelectionV1['reason'],willingness:number,draw:number|null)=>Object.freeze({version:'batter_technique_selection_v1' as const,technique,reason,willingness,draw});
 const a=i?.approach,w=a?.preferredWhenCommitted;
 if(!i||!['R','L'].includes(i.bats)||!i.perceived||![i.perceived.x,i.perceived.y].every(Number.isFinite)||!i.zone||![i.zone.halfWidth,i.zone.lowerY,i.zone.upperY].every(Number.isFinite)||i.zone.halfWidth<=0||i.zone.upperY<=i.zone.lowerY
  ||!count(i.balls,3)||!count(i.strikes,2)||!count(i.outs,2)||!i.bases||![i.bases.first,i.bases.second,i.bases.third].every(v=>typeof v==='boolean')||!['balanced','contact','power'].includes(i.swingMode)||!unit(i.plateAggression)||!unit(i.draw)
  ||a&&(!unit(a.directionCommitment)||!Number.isFinite(a.twoStrikeCommitmentDelta)||!w||![w.pull,w.center,w.opposite].every(unit)))return out(null,'INVALID_INPUT',0,null);
 const inside=-i.perceived.x/i.zone.halfWidth*(i.bats==='R'?1:-1),height=(i.perceived.y-i.zone.lowerY)/(i.zone.upperY-i.zone.lowerY),twoStrikes=i.strikes===2,ahead=i.balls-i.strikes>=2,
  power=i.swingMode==='power',contact=i.swingMode==='contact',aggression=i.plateAggression,
  // Field-using hitters shorten up; aggressive ones pull and lift.
  place=(power?.75:contact?1.2:1)*(1.25-.5*aggression)*(ahead?.7:1),drive=(power?1.2:contact?.8:1)*(.75+.5*aggression)*(ahead?1.2:1),
  commitment=a?clamp(a.directionCommitment+(twoStrikes?a.twoStrikeCommitmentDelta:0),0,1):.5,share=(s:number|undefined)=>w?(.4+1.8*s!)*(.7+.6*commitment):1,
  options:readonly (readonly [BatterTechniqueV1,Reason,number])[]=[
   // A fly ball scores the runner from third; a pitch at the knees cannot be lifted.
   ...(i.bases.third&&i.outs<2&&height>=.25?[['BACKSPIN','RUNNER_THIRD_LIFT',.7*drive*(twoStrikes?.7:1)] as const]:[]),
   // Keep the runner moving and stay out of the air, unless he is up there to drive it.
   ...(i.bases.first&&!i.bases.third&&i.outs<2&&!power&&height<=.8?[['TOPSPIN','RUNNER_FIRST_GROUND_BALL',(contact?.55:.35)*place*(twoStrikes?.8:1)] as const]:[]),
   ...(height<.3?[['TOPSPIN','LOW_PITCH',(.3+.6*clamp((.3-height)/.4,0,1))*place*(twoStrikes?.8:1)] as const]:[]),
   // Two strikes is when a hitter goes the other way, so this one is not reduced.
   ...(inside<-.45?[['SLICE','OUTSIDE_OPPOSITE_FIELD',(.3+.4*clamp((-inside-.45)/.55,0,1))*place*share(w?.opposite)] as const]:[]),
   ...(inside>.45?[['HOOK','INSIDE_PULL',(.3+.4*clamp((inside-.45)/.55,0,1))*drive*share(w?.pull)*(twoStrikes?.5:1)] as const]:[]),
  ];
 if(!options.length)return out(null,'NO_REASON',0,i.draw);
 const [technique,reason,raw]=options.reduce((best,option)=>option[2]>best[2]?option:best),willingness=clamp(raw,0,.85);
 return i.draw<willingness?out(technique,reason,willingness,i.draw):out(null,'NOT_THIS_SWING',willingness,i.draw);
}

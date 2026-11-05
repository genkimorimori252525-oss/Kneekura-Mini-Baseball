import {SeedRoot} from '../../core/rng/SeedRoot';
import {compileLiveFenceShapeV1,type LiveFenceShapeInputV1} from '../../core/sim/fielding/LiveFenceShapeV1';
import {liveFieldRunnerAccelerationScaleV1,type LiveFieldKinematicsPolicyV1} from '../../core/sim/fielding/LiveFieldRangeV1';

type Vec=Readonly<{x:number;y:number;z:number}>;
type BaseName='first'|'second'|'third';
type Instruction='conservative'|'balanced'|'aggressive';
const NEXT:Readonly<Record<BaseName,BaseName|'home'>>={first:'second',second:'third',third:'home'};
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
export const DELIVERY_SECONDS=1.1;
/** Resolved from a runner's traits. Missing fields keep every old value exact. */
export type LiveRunnerTraitsV1=Readonly<{stealSkillV1?:number;stealPreferenceV1?:number}>;
/** Opt-in. Omission keeps the speed-only lead and the old pickoff race exact. */
export type LiveRunnerLeadPolicyV1=Readonly<{version:'live_runner_lead_policy_v1';sourceId:string}>;
export const LIVE_RUNNER_LEAD_POLICY_V1:LiveRunnerLeadPolicyV1=Object.freeze({version:'live_runner_lead_policy_v1',sourceId:'runner-lead-v1-authored'});
/** Opt-in. Omission keeps the catcher's old instant exchange exact. */
export type LiveCatcherThrowPolicyV1=Readonly<{version:'live_catcher_throw_policy_v1';sourceId:string}>;
export const LIVE_CATCHER_THROW_POLICY_V1:LiveCatcherThrowPolicyV1=Object.freeze({version:'live_catcher_throw_policy_v1',sourceId:'catcher-throw-v1-authored'});
/** Authored model of how far a runner dares to go, anchored to real leads of 2 to 5 meters. */
export const LIVE_RUNNER_LEAD_CALIBRATION_V1=Object.freeze({returnReachMeters:1.9,returnTurnSeconds:.12,defaultSafetySeconds:.35,
  /** Only part of the running margin reaches the lead: it is the risk he accepts, not the whole gap. */leadSafetyBaseSeconds:.15,leadSafetyShare:.55,
  managerAggressiveSafetySeconds:.1,managerConservativeSafetySeconds:.6,stealSkillMeters:.4,deliveryMetersPerSecond:.6,
  pickoffMoveSeconds:.62,pickoffTechniqueSeconds:.1,lefthandedMoveSeconds:.08,pickoffThrowEffort:.8,pickoffTagSeconds:.17,pickoffJitterSeconds:.4,
  baseScale:Object.freeze({first:1,second:1.2,third:.85}),minimumMeters:1.2,maximumMeters:6});
/** Mitt to release. .32 of 送球動作 reads about .69 s and .74 about .94 s, the range of real exchanges. */
export const LIVE_CATCHER_THROW_CALIBRATION_V1=Object.freeze({exchangeBaseSeconds:.5,exchangePerTransfer:.6,steppedForwardMeters:.9,flightSpeedShare:.9,tagSeconds:.08,jitterShare:.5});
/** Opt-in. Omission starts a batted-ball play with each runner where he stood before the pitch. */
export type LiveRunnerSecondaryLeadPolicyV1=Readonly<{version:'live_runner_secondary_lead_policy_v1';sourceId:string}>;
export const LIVE_RUNNER_SECONDARY_LEAD_POLICY_V1:LiveRunnerSecondaryLeadPolicyV1=Object.freeze({version:'live_runner_secondary_lead_policy_v1',sourceId:'secondary-lead-v1-savant'});
/** The ground a runner gains between the pitcher starting his motion and the release (Baseball Savant lead distance, every
 * pitch, 2024: first 10.3 to 13.7 ft, +3.5 ft; second 13.2 to 17.3 ft, +4.05 ft; 2016-2025 alike). What he gains after the
 * release is not published and is left out. Third has no published lead. */
export const LIVE_RUNNER_SECONDARY_LEAD_CALIBRATION_V1=Object.freeze({gainMeters:Object.freeze({first:3.5*.3048,second:4.05*.3048})});
export function validateLiveRunnerSecondaryLeadPolicyV1(policy:LiveRunnerSecondaryLeadPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_runner_secondary_lead_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid runner secondary lead policy');
  return policy;
}
/** Opt-in. Omission keeps the old steal race exact. */
export type LiveStealRacePolicyV1=Readonly<{version:'live_steal_race_policy_v1';sourceId:string}>;
export const LIVE_STEAL_RACE_POLICY_V1:LiveStealRacePolicyV1=Object.freeze({version:'live_steal_race_policy_v1',sourceId:'steal-race-v1-authored'});
/** Authored, read against real steals: a runner reaches second about 3.4 s after the pitcher's first move.
 * The old race started him from rest at his primary lead, ran him to the center of the bag and let almost
 * nothing vary, so a standard runner lost every race by about .4 s.
 * secondaryLeadMeters: the shuffle he has taken by the time he breaks. Nobody holds a runner on second, so his is longer.
 * slideReachMeters: a slide puts a hand or foot on the bag about a body length before the hips get there.
 * jumpJitterSeconds, tagJitterSeconds: a good or bad jump, and a throw off the bag that has to be swept back. */
export const LIVE_STEAL_RACE_CALIBRATION_V1=Object.freeze({secondaryLeadMeters:Object.freeze({first:.4,second:1.5}),slideReachMeters:.9,jumpJitterSeconds:.2,tagBaseSeconds:.12,tagJitterSeconds:.25});
export type LiveLeadRunnerV1=Readonly<{topSpeedMps:number;accelerationMps2:number;reactionSeconds:number;baserunningSafetyMarginSeconds?:number}&LiveRunnerTraitsV1>;
export type LiveLeadPitcherV1=Readonly<{throwSpeedMps:number;throws?:'R'|'L';pickoffTechniqueV1?:number;deliverySecondsV1?:number}>;

/** Running ability from foot speed. Uncalibrated game model: lead and steal choices only. */
export const runnerAbilityV1=(topSpeedMps:number)=>clamp((topSpeedMps-7.2)/2.1,0,1);

/** Lead off the base in meters. A manager instruction scales it; 盗塁 is part of the lead. */
export function leadMetersV1(runner:number|Readonly<{topSpeedMps:number}&LiveRunnerTraitsV1>,instruction:Instruction){
  const spec=typeof runner==='number'?{topSpeedMps:runner}:runner;
  return (2.2+1.8*runnerAbilityV1(spec.topSpeedMps)+.4*(spec.stealSkillV1??0))*(instruction==='aggressive'?1.15:instruction==='conservative'?.75:1);
}
/** The pitcher's move, before the ball leaves his hand. */
const pickoffMoveSecondsV1=(technique:number,throws:'R'|'L'|undefined)=>{const c=LIVE_RUNNER_LEAD_CALIBRATION_V1;
  return c.pickoffMoveSeconds-c.pickoffTechniqueSeconds*technique-(throws==='L'?c.lefthandedMoveSeconds:0);};
/** Time to get a hand on the bag from a lead: turn, run from a stop, dive the last stretch. */
export function runnerReturnSecondsV1(leadMeters:number,runner:Pick<LiveLeadRunnerV1,'topSpeedMps'|'accelerationMps2'|'reactionSeconds'>){
  const c=LIVE_RUNNER_LEAD_CALIBRATION_V1,run=Math.max(0,leadMeters-c.returnReachMeters),rise=runner.topSpeedMps/runner.accelerationMps2,riseMeters=runner.topSpeedMps*rise/2;
  return runner.reactionSeconds+c.returnTurnSeconds+(run<=riseMeters?Math.sqrt(2*run/runner.accelerationMps2):rise+(run-riseMeters)/runner.topSpeedMps);
}
/** The lead he can get back from when the pitcher throws over, less the risk he refuses. His own
 * margin (積極走塁 lowers it) applies unless the manager has said otherwise, as with every green trait. */
export function runnerLeadMetersV1(x:Readonly<{runner:LiveLeadRunnerV1;pitcher:LiveLeadPitcherV1;base:BaseName;instruction:Instruction;pitcherToFirstMeters:number}>){
  const c=LIVE_RUNNER_LEAD_CALIBRATION_V1,{runner,pitcher}=x,
    own=x.instruction==='aggressive'?c.managerAggressiveSafetySeconds:x.instruction==='conservative'?c.managerConservativeSafetySeconds:runner.baserunningSafetyMarginSeconds??c.defaultSafetySeconds,
    safety=c.leadSafetyBaseSeconds+c.leadSafetyShare*own,
    pickoff=pickoffMoveSecondsV1(pitcher.pickoffTechniqueV1??0,pitcher.throws)+x.pitcherToFirstMeters/(pitcher.throwSpeedMps*c.pickoffThrowEffort)+c.pickoffTagSeconds,
    available=Math.max(0,pickoff-safety-runner.reactionSeconds-c.returnTurnSeconds),rise=runner.topSpeedMps/runner.accelerationMps2,
    run=available<=rise?.5*runner.accelerationMps2*available**2:runner.topSpeedMps*rise/2+(available-rise)*runner.topSpeedMps,
    // A quick delivery shortens what a long lead buys; a slow one invites it.
    held=c.deliveryMetersPerSecond*((pitcher.deliverySecondsV1??DELIVERY_SECONDS)-DELIVERY_SECONDS);
  return clamp((c.returnReachMeters+run+held+c.stealSkillMeters*(runner.stealSkillV1??0))*c.baseScale[x.base],c.minimumMeters,c.maximumMeters);
}
export function leadPositionV1(bases:Readonly<Record<string,Vec>>,name:BaseName,meters:number):Vec{
  const from=bases[name],to=bases[NEXT[name]]!,d=Math.hypot(to.x-from.x,to.z-from.z),k=meters/d;
  return {x:from.x+(to.x-from.x)*k,y:from.y,z:from.z+(to.z-from.z)*k};
}

/** The runner who may go on this pitch, or null. One attempt per pitch, lead runner only. */
export function decideStealV1(x:Readonly<{seed:number;pitchOrdinal:number;match:any;topSpeedOf:(id:string)=>number;instruction:Instruction;runnerOf?:(id:string)=>LiveRunnerTraitsV1}>){
  const {first,second,third}=x.match.bases;
  const name:BaseName|null=second&&!third?'second':first&&!second?'first':null;if(!name)return null;
  const runnerId=x.match.bases[name] as string,traits=x.runnerOf?.(runnerId),preference=traits?.stealPreferenceV1??0,
    ability=clamp(runnerAbilityV1(x.topSpeedOf(runnerId))+.2*(traits?.stealSkillV1??0),0,1),
    // 積極盗塁/慎重盗塁 is the runner's own default: any manager instruction replaces it.
    own=x.instruction!=='balanced'||preference===0?1:preference>0?1+.5*preference:1/(1-preference);
  if(x.match.balls>=3&&name==='first')return null;
  const rate=ability*ability*(name==='second'?.05:.14)*(x.instruction==='aggressive'?1.8:x.instruction==='conservative'?.3:own);
  if(new SeedRoot(x.seed).streamRng(x.pitchOrdinal-1,'pitch','steal-decision-v1').nextFloat()>=rate)return null;
  return {name,target:NEXT[name] as BaseName,runnerId};
}

/** Race between the runner, moving from the pitcher's release, and the catcher's throw. */
export function resolveStealV1(x:Readonly<{seed:number;pitchOrdinal:number;from:Vec;to:Vec;catcher:Vec;catchSeconds:number;
  runner:Readonly<{topSpeedMps:number;accelerationMps2:number;reactionSeconds:number}&LiveRunnerTraitsV1>;transferSeconds:number;throwSpeedMps:number;
  /** クイック: first move to release. Omission keeps the common delivery. */deliverySeconds?:number;
  /** Mitt to release from 送球動作, and the throw from a step forward. Omission keeps the instant exchange. */catcherThrowV1?:true;
  /** A shuffle, a running start, a slide and a variable jump and tag. Omission keeps the old race exact. */stealRaceV1?:true;
  /** The same runner start as in the field play. Omission keeps the authored one. */kinematicsV1?:LiveFieldKinematicsPolicyV1}>){
  const race=x.stealRaceV1===true?LIVE_STEAL_RACE_CALIBRATION_V1:null,line=Math.hypot(x.to.x-x.from.x,x.to.z-x.from.z),
    secondary=race?race.secondaryLeadMeters[Math.hypot(x.to.x,x.to.z-38.79)<1?'first':'second']:0,
    from=race?{x:x.from.x+(x.to.x-x.from.x)*secondary/line,y:x.from.y,z:x.from.z+(x.to.z-x.from.z)*secondary/line}:x.from,
    runner=race?{...x.runner,accelerationMps2:x.runner.accelerationMps2*liveFieldRunnerAccelerationScaleV1(x.kinematicsV1)}:x.runner,
    distance=race?line-secondary-race.slideReachMeters:line,rise=runner.topSpeedMps/runner.accelerationMps2,
    // 盗塁 reads the pitcher sooner. Top speed and acceleration stay the runner's own.
    raceRng=race?new SeedRoot(x.seed).streamRng(x.pitchOrdinal-1,'pitch','steal-jump-v1'):null,
    jump=race?(raceRng!.nextFloat()+raceRng!.nextFloat()-1)*race.jumpJitterSeconds:0,
    reaction=Math.max(0,runner.reactionSeconds-.06*(runner.stealSkillV1??0)+jump),
    fullSeconds=reaction+rise/2+distance/runner.topSpeedMps,
    // The runner breaks on the pitcher's first move, about a second before release. The
    // record starts at release, so the whole run is replayed in the remaining time.
    runnerSeconds=fullSeconds-(x.deliverySeconds??DELIVERY_SECONDS),pace=fullSeconds/runnerSeconds,
    c=LIVE_CATCHER_THROW_CALIBRATION_V1,paced=x.catcherThrowV1===true,
    throwDistance=Math.hypot(x.to.x-x.catcher.x,x.to.z-(x.catcher.z+(paced?c.steppedForwardMeters:0))),throwSeconds=throwDistance/(x.throwSpeedMps*(paced?c.flightSpeedShare:.92)),
    rng=new SeedRoot(x.seed).streamRng(x.pitchOrdinal-1,'pitch','steal-race-v1'),jitter=(rng.nextFloat()+rng.nextFloat()-1)*.12,
    // A hurried exchange and an ordinary one differ on the same throw, so part of the jitter belongs to the hands.
    exchangeSeconds=paced?c.exchangeBaseSeconds+c.exchangePerTransfer*x.transferSeconds+jitter*c.jitterShare:x.transferSeconds,
    releaseSeconds=x.catchSeconds+exchangeSeconds,arrivalSeconds=paced?releaseSeconds+throwSeconds+c.tagSeconds+jitter*(1-c.jitterShare):releaseSeconds+throwSeconds+.08+jitter;
  const tagSeconds=race?race.tagBaseSeconds-c.tagSeconds+Math.abs(raceRng!.nextFloat()+raceRng!.nextFloat()-1)*race.tagJitterSeconds:0,
    raceArrivalSeconds=arrivalSeconds+tagSeconds;
  const position=(seconds:number):Vec=>{const t=seconds*pace,moved=t<=reaction?0:Math.min(distance,t<reaction+rise
    ?.5*runner.accelerationMps2*(t-reaction)**2:(t-reaction-rise/2)*runner.topSpeedMps),k=moved/distance;
    if(!race)return {x:x.from.x+(x.to.x-x.from.x)*k,y:0,z:x.from.z+(x.to.z-x.from.z)*k};
    const u=k*distance/Math.hypot(x.to.x-from.x,x.to.z-from.z);return {x:from.x+(x.to.x-from.x)*u,y:0,z:from.z+(x.to.z-from.z)*u};};
  const velocity=(seconds:number):Vec=>{const t=seconds*pace,speed=t<=reaction||t>=fullSeconds?0:Math.min(runner.topSpeedMps,(t-reaction)*runner.accelerationMps2),
    k=speed*pace/(race?Math.hypot(x.to.x-from.x,x.to.z-from.z):distance);return {x:(x.to.x-from.x)*k,y:0,z:(x.to.z-from.z)*k};};
  return {safe:runnerSeconds<=raceArrivalSeconds,runnerSeconds,releaseSeconds,arrivalSeconds:raceArrivalSeconds,exchangeSeconds,throwSeconds,position,velocity};
}

/** A throw to first between pitches, more likely against a long lead. かく乱 draws the
 * pitcher's attention: he looks over more often, and no ability of his changes. */
export function decidePickoffV1(x:Readonly<{seed:number;pitchOrdinal:number;match:any;leadMeters:number;runnerThreat?:number}>){
  const {first,second}=x.match.bases;if(!first||second)return null;
  const rate=(.05+.04*clamp((x.leadMeters-2.2)/1.8,0,1))*(1+.5*(x.runnerThreat??0));
  return new SeedRoot(x.seed).streamRng(x.pitchOrdinal-1,'pitch','pickoff-decision-v1').nextFloat()<rate?{runnerId:first as string}:null;
}

/** The runner dives back while the ball travels. Pitcher technique shortens the move;
 * the first baseman's glove speed shortens the tag. */
export function resolvePickoffV1(x:Readonly<{seed:number;pitchOrdinal:number;lead:Vec;base:Vec;pitcher:Vec;pitcherTechnique:number;throwSpeedMps:number;
  runner:Readonly<{topSpeedMps:number;reactionSeconds:number;accelerationMps2?:number}>;receiverGloveSpeedMps:number;
  /** Return run from a stop, and the wider read on the move. Omission keeps the old race exact. */leadRaceV1?:Readonly<{throws?:'R'|'L'}>}>){
  const distance=Math.hypot(x.lead.x-x.base.x,x.lead.z-x.base.z),lead=x.leadRaceV1,
    backSeconds=lead?runnerReturnSecondsV1(distance,{topSpeedMps:x.runner.topSpeedMps,reactionSeconds:x.runner.reactionSeconds,accelerationMps2:x.runner.accelerationMps2!}):x.runner.reactionSeconds+.12+distance/(x.runner.topSpeedMps*.8),
    rng=new SeedRoot(x.seed).streamRng(x.pitchOrdinal-1,'pitch','pickoff-race-v1'),jitter=(rng.nextFloat()+rng.nextFloat()-1)*(lead?LIVE_RUNNER_LEAD_CALIBRATION_V1.pickoffJitterSeconds:.1),
    moveSeconds=lead?pickoffMoveSecondsV1(x.pitcherTechnique,lead.throws):.62-.1*x.pitcherTechnique,throwSeconds=Math.hypot(x.base.x-x.pitcher.x,x.base.z-x.pitcher.z)/(x.throwSpeedMps*.8),
    tagSeconds=.3-.012*x.receiverGloveSpeedMps,arrivalSeconds=moveSeconds+throwSeconds+tagSeconds+jitter;
  const position=(t:number):Vec=>{const k=t<=x.runner.reactionSeconds?0:Math.min(1,(t-x.runner.reactionSeconds)/(backSeconds-x.runner.reactionSeconds));
    return {x:x.lead.x+(x.base.x-x.lead.x)*k,y:0,z:x.lead.z+(x.base.z-x.lead.z)*k};};
  return {safe:backSeconds<=arrivalSeconds,moveSeconds,arrivalSeconds,backSeconds,endSeconds:Math.max(arrivalSeconds,backSeconds)+.25,position};
}

/** Plain carry estimate for a batted ball, used only when the field world cannot finish the play. */
/** Manager AI: walk the batter to set up a force, late in a close game with first base open. Public facts only; authored. */
export function decideIntentionalWalkV1(x:Readonly<{inning:number;regulationInnings:number;outs:number;firstOpen:boolean;runnerInScoringPosition:boolean;defenseLead:number;balls:number;strikes:number}>){
  return x.firstOpen&&x.runnerInScoringPosition&&x.outs>=1&&x.inning>=x.regulationInnings-1&&Math.abs(x.defenseLead)<=1&&x.strikes===0;
}
/** Opt-in. Omission keeps the old square body column exact. */
export type LiveHitByPitchPolicyV1=Readonly<{version:'live_hit_by_pitch_policy_v1';sourceId:string}>;
export const LIVE_HIT_BY_PITCH_POLICY_V1:LiveHitByPitchPolicyV1=Object.freeze({version:'live_hit_by_pitch_policy_v1',sourceId:'hit-by-pitch-v1-authored'});
/** A batter stands side-on: his chest is thin toward the plate and his shoulders are wide along the pitch.
 * He also gives ground on a ball coming at him, more the longer he has to see it. Authored, read against real
 * stances (front of the body about .7 m from the plate's center) and a hit-by-pitch rate near .3% of pitches. */
export const LIVE_HIT_BY_PITCH_CALIBRATION_V1=Object.freeze({halfThicknessMeters:.14,ballRadiusMeters:.0366,
  dodgeAfterSeconds:.3,dodgeMetersPerSecond:.3,maximumDodgeMeters:.05});
/** The pitch went through the batter's body column. Colliders are not modelled, so this is the plain geometric test. */
export function pitchHitsBatterV1(frames:readonly Readonly<{tick?:number;ball?:Readonly<{position:Vec}>|null}>[],batter:Vec,heightMeters:number,
  /** Side-on body and a dodge. Omission keeps the old column exact. */sideOnV1?:Readonly<{ticksPerSecond:number}>){
  if(!sideOnV1)return frames.some(f=>{const p=f.ball?.position;return !!p&&Math.abs(p.z-batter.z)<=.2&&Math.abs(p.x-batter.x)<=.22&&p.y>=.35&&p.y<=heightMeters;});
  const c=LIVE_HIT_BY_PITCH_CALIBRATION_V1,start=frames.find(f=>f.ball&&f.tick!==undefined)?.tick;
  // A pitch covers more than the body's width between two frames, so test where it crosses the body's plane.
  for(let i=1;i<frames.length;i++){const a=frames[i-1],b=frames[i],p=a.ball?.position,q=b.ball?.position;
    if(!p||!q||start===undefined||a.tick===undefined||b.tick===undefined||p.z===q.z||(p.z-batter.z)*(q.z-batter.z)>0)continue;
    const u=(batter.z-p.z)/(q.z-p.z),x=p.x+(q.x-p.x)*u,y=p.y+(q.y-p.y)*u,seen=(a.tick+(b.tick-a.tick)*u-start)/sideOnV1.ticksPerSecond,
      dodge=Math.min(c.maximumDodgeMeters,Math.max(0,(seen-c.dodgeAfterSeconds)*c.dodgeMetersPerSecond)),center=batter.x+(Math.sign(batter.x)||1)*dodge;
    return Math.abs(x-center)<=c.halfThicknessMeters+c.ballRadiusMeters&&y>=.35&&y<=heightMeters;}
  return false;
}
export function settleBattedBallV1(x:Readonly<{ball:Readonly<{position:Vec;velocity:Vec}>;fenceRadiusMeters:number;fenceHeightMeters:number;fenceShapeV1?:LiveFenceShapeInputV1;seed:number;pitchOrdinal:number}>){
  const {position:p,velocity:v}=x.ball,flat=Math.hypot(v.x,v.z),gravity=9.8,drag=.72,
    air=Math.max(.3,(v.y+Math.sqrt(Math.max(0,v.y*v.y+2*gravity*p.y)))/gravity),seconds=Math.min(6,air),
    landX=p.x+v.x*air*drag,landZ=p.z+v.z*air*drag,distance=Math.hypot(landX,landZ),fair=landZ>0&&Math.abs(landX)<=landZ,
    draw=new SeedRoot(x.seed).streamRng(x.pitchOrdinal-1,'pitch','simple-batted-v1').nextFloat(),
    wall=x.fenceShapeV1?compileLiveFenceShapeV1(x.fenceShapeV1,{x:0,z:0}).wallAt(Math.atan2(landX,landZ)):null,
    outcome:'foul'|'out'|'single'|'home_run'=!fair?'foul':distance>(wall?wall.distanceMeters+wall.heightMeters:x.fenceRadiusMeters+x.fenceHeightMeters)?'home_run':draw<.3?'single':'out';
  const at=(t:number):Vec=>({x:p.x+v.x*t*drag,y:Math.max(.04,p.y+v.y*t-gravity*t*t/2),z:p.z+v.z*t*drag});
  void flat;return {outcome,seconds,at};
}

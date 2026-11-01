import {SeedRoot} from '../../core/rng/SeedRoot';

type Vec=Readonly<{x:number;y:number;z:number}>;
type BaseName='first'|'second'|'third';
type Instruction='conservative'|'balanced'|'aggressive';
const NEXT:Readonly<Record<BaseName,BaseName|'home'>>={first:'second',second:'third',third:'home'};
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const DELIVERY_SECONDS=1.1;

/** Running ability from foot speed. Uncalibrated game model: lead and steal choices only. */
export const runnerAbilityV1=(topSpeedMps:number)=>clamp((topSpeedMps-7.2)/2.1,0,1);

/** Lead off the base in meters. A manager instruction scales it. */
export function leadMetersV1(topSpeedMps:number,instruction:Instruction){
  return (2.2+1.8*runnerAbilityV1(topSpeedMps))*(instruction==='aggressive'?1.15:instruction==='conservative'?.75:1);
}
export function leadPositionV1(bases:Readonly<Record<string,Vec>>,name:BaseName,meters:number):Vec{
  const from=bases[name],to=bases[NEXT[name]]!,d=Math.hypot(to.x-from.x,to.z-from.z),k=meters/d;
  return {x:from.x+(to.x-from.x)*k,y:from.y,z:from.z+(to.z-from.z)*k};
}

/** The runner who may go on this pitch, or null. One attempt per pitch, lead runner only. */
export function decideStealV1(x:Readonly<{seed:number;pitchOrdinal:number;match:any;topSpeedOf:(id:string)=>number;instruction:Instruction}>){
  const {first,second,third}=x.match.bases;
  const name:BaseName|null=second&&!third?'second':first&&!second?'first':null;if(!name)return null;
  const runnerId=x.match.bases[name] as string,ability=runnerAbilityV1(x.topSpeedOf(runnerId));
  if(x.match.balls>=3&&name==='first')return null;
  const rate=ability*ability*(name==='second'?.05:.14)*(x.instruction==='aggressive'?1.8:x.instruction==='conservative'?.3:1);
  if(new SeedRoot(x.seed).streamRng(x.pitchOrdinal-1,'pitch','steal-decision-v1').nextFloat()>=rate)return null;
  return {name,target:NEXT[name] as BaseName,runnerId};
}

/** Race between the runner, moving from the pitcher's release, and the catcher's throw. */
export function resolveStealV1(x:Readonly<{seed:number;pitchOrdinal:number;from:Vec;to:Vec;catcher:Vec;catchSeconds:number;
  runner:Readonly<{topSpeedMps:number;accelerationMps2:number;reactionSeconds:number}>;transferSeconds:number;throwSpeedMps:number}>){
  const {runner}=x,distance=Math.hypot(x.to.x-x.from.x,x.to.z-x.from.z),rise=runner.topSpeedMps/runner.accelerationMps2,
    fullSeconds=runner.reactionSeconds+rise/2+distance/runner.topSpeedMps,
    // The runner breaks on the pitcher's first move, about a second before release. The
    // record starts at release, so the whole run is replayed in the remaining time.
    runnerSeconds=fullSeconds-DELIVERY_SECONDS,pace=fullSeconds/runnerSeconds,
    throwDistance=Math.hypot(x.to.x-x.catcher.x,x.to.z-x.catcher.z),throwSeconds=throwDistance/(x.throwSpeedMps*.92),
    rng=new SeedRoot(x.seed).streamRng(x.pitchOrdinal-1,'pitch','steal-race-v1'),jitter=(rng.nextFloat()+rng.nextFloat()-1)*.12,
    releaseSeconds=x.catchSeconds+x.transferSeconds,arrivalSeconds=releaseSeconds+throwSeconds+.08+jitter;
  const position=(seconds:number):Vec=>{const t=seconds*pace,moved=t<=runner.reactionSeconds?0:Math.min(distance,t<runner.reactionSeconds+rise
    ?.5*runner.accelerationMps2*(t-runner.reactionSeconds)**2:(t-runner.reactionSeconds-rise/2)*runner.topSpeedMps),k=moved/distance;
    return {x:x.from.x+(x.to.x-x.from.x)*k,y:0,z:x.from.z+(x.to.z-x.from.z)*k};};
  const velocity=(seconds:number):Vec=>{const t=seconds*pace,speed=t<=runner.reactionSeconds||t>=fullSeconds?0:Math.min(runner.topSpeedMps,(t-runner.reactionSeconds)*runner.accelerationMps2),
    k=speed*pace/distance;return {x:(x.to.x-x.from.x)*k,y:0,z:(x.to.z-x.from.z)*k};};
  return {safe:runnerSeconds<=arrivalSeconds,runnerSeconds,releaseSeconds,arrivalSeconds,position,velocity};
}

/** A throw to first between pitches, more likely against a long lead. */
export function decidePickoffV1(x:Readonly<{seed:number;pitchOrdinal:number;match:any;leadMeters:number}>){
  const {first,second}=x.match.bases;if(!first||second)return null;
  const rate=.05+.04*clamp((x.leadMeters-2.2)/1.8,0,1);
  return new SeedRoot(x.seed).streamRng(x.pitchOrdinal-1,'pitch','pickoff-decision-v1').nextFloat()<rate?{runnerId:first as string}:null;
}

/** The runner dives back while the ball travels. Pitcher technique shortens the move;
 * the first baseman's glove speed shortens the tag. */
export function resolvePickoffV1(x:Readonly<{seed:number;pitchOrdinal:number;lead:Vec;base:Vec;pitcher:Vec;pitcherTechnique:number;throwSpeedMps:number;
  runner:Readonly<{topSpeedMps:number;reactionSeconds:number}>;receiverGloveSpeedMps:number}>){
  const distance=Math.hypot(x.lead.x-x.base.x,x.lead.z-x.base.z),backSeconds=x.runner.reactionSeconds+.12+distance/(x.runner.topSpeedMps*.8),
    rng=new SeedRoot(x.seed).streamRng(x.pitchOrdinal-1,'pitch','pickoff-race-v1'),jitter=(rng.nextFloat()+rng.nextFloat()-1)*.1,
    moveSeconds=.62-.1*x.pitcherTechnique,throwSeconds=Math.hypot(x.base.x-x.pitcher.x,x.base.z-x.pitcher.z)/(x.throwSpeedMps*.8),
    tagSeconds=.3-.012*x.receiverGloveSpeedMps,arrivalSeconds=moveSeconds+throwSeconds+tagSeconds+jitter;
  const position=(t:number):Vec=>{const k=t<=x.runner.reactionSeconds?0:Math.min(1,(t-x.runner.reactionSeconds)/(backSeconds-x.runner.reactionSeconds));
    return {x:x.lead.x+(x.base.x-x.lead.x)*k,y:0,z:x.lead.z+(x.base.z-x.lead.z)*k};};
  return {safe:backSeconds<=arrivalSeconds,moveSeconds,arrivalSeconds,backSeconds,endSeconds:Math.max(arrivalSeconds,backSeconds)+.25,position};
}

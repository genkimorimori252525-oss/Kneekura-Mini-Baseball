import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BallWorldMotionActor } from '../ball/BallWorldContinuation';
import { createSourceFreeBallKernel,type SourceFreeBallDescriptorV2 } from '../ball/SourceFreeBallKernel';
import { querySourceFreeBallWorldV2 } from '../ball/SourceFreeBallWorldQuery';
import { sourceRk4PositionBounds } from '../ball/SourceFreeBallSpeedBound';
import { multiplyQuaternions } from '../pitching/BaseballOrientation';
import { sampleControlledPitchHandV1,validateControlledHeldPitchV1,type ControlledHeldPitchV1,type ControlledHeldPitchAnchorsV1 } from './ControlledHeldPitchV1';
import { createPitchHandHoldRenewalV1,type PitchHandHoldRenewalV1 } from './PitchHandHoldRenewalV1';

export type ControlledPitchWorldInputV1=Readonly<{
  descriptor:SourceFreeBallDescriptorV2;motion:ControlledHeldPitchV1;anchors:ControlledHeldPitchAnchorsV1;
  pitcherPlayerId:string;otherActors:readonly BallWorldMotionActor[];throughTick:number;
}>;
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const scale=(a:Vec3,n:number):Vec3=>({x:a.x*n,y:a.y*n,z:a.z*n});
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const norm=(a:Vec3)=>Math.hypot(a.x,a.y,a.z);
const json=(v:unknown)=>JSON.stringify(v);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('controlled pitch world: '+message);}

/** Current controlled release -> original free-ball Source. Every query starts
 * at that same root; observation partitions never reanchor the integration.
 * The moving hand is always a collider. Its initial owned surface is certified
 * by the current custody constraint, not inferred from rounded world distances
 * or a previous collision witness. No point or clock is changed. */
export function queryControlledPitchWorldV1(raw:ControlledPitchWorldInputV1){
  return queryWorld(raw);
}
export function queryControlledPitchWorldWithHoldRenewalV1(raw:ControlledPitchWorldInputV1,request:PitchHandHoldRenewalV1){
  const p=cloneInert(raw),renewal=createPitchHandHoldRenewalV1(p.motion,p.anchors,request);
  return queryWorld(p,renewal);
}
function queryWorld(raw:ControlledPitchWorldInputV1,renewal?:ReturnType<typeof createPitchHandHoldRenewalV1>){
  const p=cloneInert(raw),{descriptor:d,anchors:a,motion}=p;
  const binding=renewal?.originalBinding??validateControlledHeldPitchV1(motion,a),release=a.release.releaseAtUs;
  const controlThrough=renewal?.request.throughTick??a.followThroughEndTick;
  assert(d.initial.originTick===release&&d.initial.elapsedSeconds===0
    &&json(d.initial.ball)===json({tick:release,position:a.release.position,velocity:a.release.velocity,spin:a.release.spin})
    &&d.profile.air.ticksPerSecond===1e6&&d.profile.ground.radiusM===a.ballRadiusM
    &&d.throughElapsedSeconds<=(controlThrough-release)/1e6,'free Source differs from release or finite control');
  assert(typeof p.pitcherPlayerId==='string'&&p.pitcherPlayerId.length>0&&Number.isSafeInteger(p.throughTick)
    &&p.throughTick>release&&p.throughTick<=controlThrough
    &&(p.throughTick-release)/1e6<=d.throughElapsedSeconds,'cut outside owned control');
  assert(!p.otherActors.some(v=>v.playerId===p.pitcherPlayerId&&v.primitive.role==='tag_hand'),'moving hand cannot have a second collider');
  const kernel=createSourceFreeBallKernel(d),first=motion.followThrough[0],next=motion.followThrough[1],dt=(next.tick-first.tick)/1e6;
  let window=Math.min(dt,d.throughElapsedSeconds,kernel.boundaries.find(b=>b.kind==='ground')?.elapsedSeconds??Infinity);
  assert(window>0,'no airborne release interval');
  let accelerationBound=0;
  for(const cell of kernel.cells){
    if(cell.fromElapsedSeconds>=window)break;
    const at=kernel.evaluateAt(cell.fromElapsedSeconds,'outgoing');
    assert(at.phase==='airborne','release interval crossed a ground response');
    accelerationBound=Math.max(accelerationBound,sourceRk4PositionBounds(at.moment.ball,cell.throughElapsedSeconds-cell.fromElapsedSeconds,d.profile.air).maximumAccelerationMps2);
  }
  // In every RK4 cell, |v_end-v_start| <= A*h and the dense position
  // remainder <= A*h²/2. Summing the original lattice therefore bounds the
  // entire displacement from release by |p(t)-p0-v0*t| <= A*t²/2.
  const delta=sub(next.handCenter,first.handCenter);
  const quadratic=sub(scale(delta,3/(dt*dt)),scale(add(scale(first.handVelocity,2),next.handVelocity),1/dt));
  const cubic=add(scale(delta,-2/(dt*dt*dt)),scale(add(first.handVelocity,next.handVelocity),1/(dt*dt)));
  const normal=binding.releaseContact.normal,v=binding.releaseContact.normalVelocityMps;
  const q=-dot(normal,quadratic)-accelerationBound/2,c=-dot(normal,cubic);
  const proves=(h:number)=>v>0?v+Math.min(0,q*h)+Math.min(0,c*h*h)>0:v===0&&q+Math.min(0,c*h)>0;
  for(let i=0;i<32&&!proves(window);i++)window/=2;
  assert(proves(window),'current release separation cannot be certified');
  const departure={kind:'current_owned_release_supporting_plane_v1' as const,throughElapsedSeconds:window,
    outwardVelocityMps:v,quadraticLowerCoefficient:q,cubicCoefficient:c,maximumBallAccelerationMps2:accelerationBound,
    initialOffset:motion.held.at(-1)!.ballOffset,positionOrClockCorrected:false as const};
  const physical=querySourceFreeBallWorldV2({descriptor:d,moment:d.initial,side:'outgoing',
    throughElapsedSeconds:(p.throughTick-release)/1e6,actors:p.otherActors,surfaces:[]});
  if(physical.kind==='unresolved')return freeze({kind:'unresolved' as const,reason:physical.reason,departure,interval:physical.interval});
  const handAt=(seconds:number)=>{const at=release+seconds*1e6;
    return renewal&&at>a.followThroughEndTick?renewal.sampleContinuous(at):sampleControlledPitchHandV1(motion,at);};
  const gap=(seconds:number)=>norm(sub(kernel.evaluateAt(seconds,'incoming').moment.ball.position,handAt(seconds).position))-a.ballRadiusM-a.handRadiusM;
  assert(gap(window)>0,'current release has no separated numerical witness');
  let handSpeed=0;
  for(let i=1;i<motion.followThrough.length;i++){
    const one=motion.followThrough[i-1],two=motion.followThrough[i],h=(two.tick-one.tick)/1e6;
    handSpeed=Math.max(handSpeed,norm(one.handVelocity),norm(two.handVelocity),norm(sub(scale(sub(two.handCenter,one.handCenter),3/h),add(one.handVelocity,two.handVelocity))));
  }
  type Search={kind:'clear'}|{kind:'contact';at:number;from:number}|{kind:'unresolved';from:number;through:number};
  let budget=100_000;
  const search=(lo:number,hi:number,speed:number,rounding:number,depth=0):Search=>{
    assert(--budget>=0,'hand CCD work exhausted');
    const one=gap(lo),two=gap(hi);
    if(one<=0)return {kind:'contact',at:lo,from:lo};
    if(Math.min(one,two)>speed*(hi-lo)+rounding)return {kind:'clear'};
    const mid=(lo+hi)/2;
    if(depth>=60||mid===lo||mid===hi||hi-lo<=1e-15)return two<=0?{kind:'contact',at:hi,from:lo}:{kind:'unresolved',from:lo,through:hi};
    const left=search(lo,mid,speed,rounding,depth+1);
    if(left.kind==='contact'||left.kind==='unresolved'&&mid-left.from>1e-12)return left;
    const right=search(mid,hi,speed,rounding,depth+1);
    if(left.kind==='clear')return right;
    if(right.kind==='contact'&&right.at-left.from<=1e-12)return {...right,from:left.from};
    return right.kind==='unresolved'?{kind:'unresolved',from:left.from,through:right.through}:left;
  };
  for(const cell of kernel.cells){
    const lo=Math.max(window,cell.fromElapsedSeconds),hi=Math.min(physical.moment.elapsedSeconds,cell.throughElapsedSeconds);
    if(hi<=lo)continue;
    const result=search(lo,hi,cell.maximumPositionSpeedMps+handSpeed,cell.positionRoundingBoundMeters);
    if(result.kind==='unresolved')return freeze({kind:'unresolved' as const,reason:'moving_hand_contact_refinement_required',departure,interval:{from:result.from,through:result.through}});
    if(result.kind==='contact'){
      const at=kernel.evaluateAt(result.at,'incoming'),hand=handAt(result.at);
      const relative=sub(at.moment.ball.position,hand.position),length=norm(relative);assert(length>0,'contact normal unavailable');
      return freeze({kind:'boundary' as const,departure,moment:at.moment,orientation:multiplyQuaternions(at.orientation,binding.releaseOrientation),
        contacts:[...(result.at===physical.moment.elapsedSeconds?physical.contacts:[]),{kind:'actor' as const,playerId:p.pitcherPlayerId,role:'tag_hand' as const,
          center:hand.position,velocity:hand.velocity,normal:scale(relative,1/length),moment:at.moment}].sort((a,b)=>json(a)<json(b)?-1:json(a)>json(b)?1:0),
        handContactSearchWitness:{fromElapsedSeconds:result.from,witnessElapsedSeconds:result.at,signedGapMeters:gap(result.at),positionRoundingBoundMeters:cell.positionRoundingBoundMeters}});
    }
  }
  const at=kernel.evaluateAt(physical.moment.elapsedSeconds,'incoming');
  return freeze({kind:physical.kind,departure,moment:physical.moment,orientation:multiplyQuaternions(at.orientation,binding.releaseOrientation),contacts:physical.contacts});
}

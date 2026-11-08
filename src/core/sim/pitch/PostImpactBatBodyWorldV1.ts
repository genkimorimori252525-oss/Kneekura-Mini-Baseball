import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { createSourceFreeBallKernel,type SourceFreeBallDescriptorV2 } from '../ball/SourceFreeBallKernel';
import { sourceRk4PositionBounds } from '../ball/SourceFreeBallSpeedBound';
import { querySourceFreeBallWorldV2 } from '../ball/SourceFreeBallWorldQuery';
import { createPostImpactBatBodyControlV1,type PostImpactBatBodyControlInputV1 } from '../contact/PostImpactBatBodyControlV1';
import { createRigidBatStateFromBatterSwingState,measureRigidBatBallGeometry,measureRigidBatBallSurfaceSeparation } from '../contact/RigidBatBallContact';
import { sampleControlledPitchHandV1 } from './ControlledHeldPitchV1';
import { createPitchHandHoldRenewalV1 } from './PitchHandHoldRenewalV1';
import { multiplyQuaternions } from '../pitching/BaseballOrientation';

export type PostImpactBatBodyWorldInputV1=Readonly<{version:'post_impact_bat_body_world_v1';control:PostImpactBatBodyControlInputV1;throughTick:number}>;
const a=(p:Vec3)=>[p.x,p.y,p.z],v=(p:readonly number[]):Vec3=>({x:p[0],y:p[1],z:p[2]});
const sub=(a:readonly number[],b:readonly number[])=>a.map((x,i)=>x-b[i]),add=(a:readonly number[],b:readonly number[])=>a.map((x,i)=>x+b[i]);
const mul=(a:readonly number[],s:number)=>a.map(x=>x*s),norm=(a:readonly number[])=>Math.hypot(...a),dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const freeze=<T>(p:T):T=>{if(p&&typeof p==='object'){Object.values(p).forEach(freeze);Object.freeze(p);}return p;};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('post-impact bat/body world: '+message);}
type Search={kind:'clear'}|{kind:'hit';from:number;at:number}|{kind:'unresolved';from:number;through:number};

/** Conditional continuation from the SAME exact impact moment. Actual bat,
 * body, palm, pitcher hand and every other actor stay in the query. No Source
 * execution right, neural-policy calibration or workload settlement is implied. */
export function queryPostImpactBatBodyWorldV1(raw:PostImpactBatBodyWorldInputV1){
  const p=cloneInert(raw);assert(p&&Object.keys(p).sort().join('|')==='control|throughTick|version'&&p.version==='post_impact_bat_body_world_v1','invalid input');
  const c=createPostImpactBatBodyControlV1(p.control),w=p.control.world,impact=c.impact,start=c.fromElapsedSeconds,end=(p.throughTick-impact.moment.originTick)/1e6;
  assert(Number.isSafeInteger(p.throughTick)&&end>start&&end<=c.throughElapsedSeconds,'query exceeds finite recovery');
  const initial={...impact.moment,ball:{...impact.moment.ball,velocity:impact.contact.exitVelocity,spin:impact.contact.exitSpin}};
  const descriptor:SourceFreeBallDescriptorV2={...w.pitch.descriptor,initial,throughElapsedSeconds:c.throughElapsedSeconds};
  const kernel=createSourceFreeBallKernel(descriptor),incoming=createSourceFreeBallKernel(w.pitch.descriptor);
  const retained=w.pitch.otherActors.filter(x=>!(x.playerId===w.batterPlayerId&&['body','tag_hand'].includes(x.primitive.role)));
  assert(retained.length===w.pitch.otherActors.length-2,'original collider replacement differs');
  const fixed=querySourceFreeBallWorldV2({descriptor,moment:initial,side:'outgoing',throughElapsedSeconds:end,actors:retained,surfaces:[]});
  const horizon=fixed.kind==='unresolved'?fixed.interval.from:fixed.moment.elapsedSeconds;
  const renewal=createPitchHandHoldRenewalV1(w.pitch.motion,w.pitch.anchors,w.pitcherRenewal),origin=initial.originTick;
  const pitcherHand=(t:number)=>{const tick=origin+t*1e6;return tick>=w.pitcherRenewal.fromTick?renewal.sampleContinuous(tick):sampleControlledPitchHandV1(w.pitch.motion,tick);};
  let pitcherSpeed=0;
  if(origin+start*1e6<w.pitcherRenewal.fromTick)for(let i=1;i<w.pitch.motion.followThrough.length;i++){
    const x=w.pitch.motion.followThrough[i-1],y=w.pitch.motion.followThrough[i],s=(y.tick-x.tick)/1e6;
    pitcherSpeed=Math.max(pitcherSpeed,norm(a(x.handVelocity)),norm(a(y.handVelocity)),norm(sub(mul(sub(a(y.handCenter),a(x.handCenter)),3/s),add(a(x.handVelocity),a(y.handVelocity)))));
  }
  const sphere=(role:string)=>w.pitch.otherActors.find(x=>x.playerId===w.batterPlayerId&&x.primitive.role===role)!.primitive;
  const body=sphere('body'),hand=sphere('tag_hand');
  const parts=w.batPhysical.radiusProfile.knots.slice(1).map((right,i)=>({left:w.batPhysical.radiusProfile.knots[i],right,index:i}));
  const wholeAt=(t:number)=>createRigidBatStateFromBatterSwingState(c.sample(t).bat.state,w.batPhysical);
  const partAt=(t:number,index:number)=>{
    const whole=wholeAt(t),part=parts[index],axis=sub(a(whole.pose.tip),a(whole.pose.grip));
    return {...whole,pose:{grip:v(add(a(whole.pose.grip),mul(axis,part.left.t))),tip:v(add(a(whole.pose.grip),mul(axis,part.right.t)))},
      physical:{...whole.physical,radiusProfile:{knots:[{t:0,radiusM:part.left.radiusM},{t:1,radiusM:part.right.radiusM}]}}};
  };
  const ballAt=(t:number)=>kernel.evaluateAt(t,'incoming').moment.ball;
  const departures:Record<string,unknown>[]=[];
  const departureFrom=(index:number)=>{
    const bat=partAt(start,index),geometry=measureRigidBatBallGeometry(initial.ball,bat,w.ball);
    if(geometry.signedGapMeters>0)return start;
    assert(geometry.normal,'bat departure normal unavailable');
    const priorCell=incoming.cells.find(x=>x.fromElapsedSeconds<=start&&x.throughElapsedSeconds>=start);assert(priorCell,'original incoming cell missing');
    const bracket=start-impact.witness.firstPossibleElapsedSeconds;
    assert(bracket>=0&&bracket<=1e-12,'original contact bracket is unsupported');
    const witnessBound=priorCell.positionRoundingBoundMeters+(priorCell.maximumPositionSpeedMps+c.certificate.incomingMaximumPointSpeedMps)*bracket;
    assert(geometry.signedGapMeters>=-witnessBound,'part penetration exceeds original contact witness');
    const n=a(geometry.normal),s=c.sample(start),whole=wholeAt(start),axis=sub(a(whole.pose.tip),a(whole.pose.grip));
    const part=parts[index],knots=[part.left,part.right];
    const support=Math.max(...knots.map(k=>dot(n,add(a(whole.pose.grip),mul(axis,k.t)))+k.radiusM));
    const supportGap=dot(n,a(initial.ball.position))-w.ball.radiusM-support;
    const arithmetic=256*Number.EPSILON*(1+norm(a(initial.ball.position))+norm(a(whole.pose.grip))+norm(axis)+w.ball.radiusM);
    assert(supportGap>=-witnessBound-arithmetic,'segment support differs from original convex contact witness');
    const outward=Math.min(...knots.map(k=>dot(n,sub(a(initial.ball.velocity),add(a(s.bat.state.linearVelocity),a(cross(s.bat.state.angularVelocity,v(mul(axis,k.t)))))))));
    assert(outward>0,'actual impulse does not separate this bat segment');
    const cell=kernel.cells.find(x=>x.fromElapsedSeconds===start);assert(cell,'outgoing Source cell missing');
    const air=sourceRk4PositionBounds(initial.ball,cell.throughElapsedSeconds-start,descriptor.profile.air);
    const batAcceleration=c.certificate.maximumGripAccelerationMps2+(c.certificate.maximumAngularAccelerationRadPerSecond2+c.certificate.maximumAngularSpeedRadPerSecond**2)*norm(axis)*part.right.t;
    const deviation=air.linearDeviationMps2+batAcceleration/2,rounding=cell.positionRoundingBoundMeters+arithmetic;
    const window=Math.min(horizon-start,cell.throughElapsedSeconds-start,deviation===0?Infinity:outward/(2*deviation));
    const escape=2*(Math.max(0,-supportGap)+rounding)/outward;
    const lowerGap=supportGap+outward*escape-deviation*escape*escape-rounding;
    assert(Number.isFinite(escape)&&escape>0&&escape<=1e-12&&escape<window&&lowerGap>0,'bat contact departure is uncertified');
    const gapEscape=measureRigidBatBallSurfaceSeparation(ballAt(start+escape),partAt(start+escape,index),w.ball);
    const gapEnd=measureRigidBatBallSurfaceSeparation(ballAt(start+window),partAt(start+window,index),w.ball);
    assert(gapEscape>0&&gapEnd>0,'actual bat departure lacks separated witnesses');
    departures.push({partIndex:index,originalBracketBoundMeters:witnessBound,initialSignedGapMeters:geometry.signedGapMeters,
      initialSupportingPlaneGapMeters:supportGap,outgoingNormalSpeedMps:outward,linearDeviationMps2:deviation,
      arithmeticBoundMeters:arithmetic,positionRoundingBoundMeters:cell.positionRoundingBoundMeters,
      escapeBracketThroughElapsedSeconds:start+escape,provenClearThroughElapsedSeconds:start+window,
      supportingPlaneLowerGapAtEscapeMeters:lowerGap,signedGapAtEscapeMeters:gapEscape,signedGapAtWindowEndMeters:gapEnd,
      positionOrClockCorrected:false});
    return start+window;
  };
  const colliders=[...parts.map(part=>({key:'bat' as const,index:part.index,speed:c.certificate.maximumPointSpeedMps,
    from:departureFrom(part.index),gap:(t:number)=>measureRigidBatBallSurfaceSeparation(ballAt(t),partAt(t,part.index),w.ball)})),
    {key:'body' as const,index:-1,speed:c.certificate.maximumBodySpeedMps,from:start,gap:(t:number)=>norm(sub(a(ballAt(t).position),a(c.sample(t).body.position)))-body.radius-w.ball.radiusM},
    {key:'tag_hand' as const,index:-1,speed:c.certificate.maximumPalmSpeedMps,from:start,gap:(t:number)=>norm(sub(a(ballAt(t).position),a(c.sample(t).hand.position)))-hand.radius-w.ball.radiusM},
    {key:'pitcher_hand' as const,index:-1,speed:pitcherSpeed,from:start,gap:(t:number)=>norm(sub(a(ballAt(t).position),a(pitcherHand(t).position)))-w.pitch.anchors.handRadiusM-w.ball.radiusM}];
  let budget=500000;
  const find=(gap:(t:number)=>number,lo:number,hi:number,speed:number,rounding:number,depth=0):Search=>{
    assert(--budget>=0,'contact proof budget exhausted');const x=gap(lo),y=gap(hi);assert(Number.isFinite(x)&&Number.isFinite(y),'nonfinite separation');
    if(x<=0)return {kind:'hit',at:lo,from:lo};if(Math.min(x,y)>speed*(hi-lo)+rounding)return {kind:'clear'};
    const mid=(lo+hi)/2;if(depth===60||mid===lo||mid===hi||hi-lo<=1e-15)return y<=0?{kind:'hit',at:hi,from:lo}:{kind:'unresolved',from:lo,through:hi};
    const left=find(gap,lo,mid,speed,rounding,depth+1);if(left.kind==='hit'||left.kind==='unresolved'&&mid-left.from>1e-12)return left;
    const right=find(gap,mid,hi,speed,rounding,depth+1);if(left.kind==='clear')return right;
    if(right.kind==='hit'&&right.at-left.from<=1e-12)return {...right,from:left.from};return right.kind==='unresolved'?{kind:'unresolved',from:left.from,through:right.through}:left;
  };
  const hits=colliders.flatMap(collider=>{for(const cell of kernel.cells){const lo=Math.max(collider.from,cell.fromElapsedSeconds),hi=Math.min(horizon,cell.throughElapsedSeconds);if(hi<=lo)continue;
    const found=find(collider.gap,lo,hi,cell.maximumPositionSpeedMps+collider.speed,cell.positionRoundingBoundMeters);if(found.kind!=='clear')return [{collider,found}];}return [];})
    .sort((x,y)=>(x.found.kind==='hit'?x.found.at:x.found.from)-(y.found.kind==='hit'?y.found.at:y.found.from));
  const coverage={originalOtherActorCount:w.pitch.otherActors.length,retainedOtherActorCount:retained.length,replacedActorCount:2,
    pitcherHandRetained:true,actualBatPartCount:parts.length,sourceMomentReanchored:false,physicalExecutionAdmitted:false};
  const first=hits[0];
  if(first?.found.kind==='unresolved')return freeze({kind:'unresolved' as const,reason:'dynamic_recovery_contact_refinement',interval:first.found,coverage,departures});
  if(first&&first.found.kind==='hit'){
    const hit=first.found;
    if(hits.slice(1).some(h=>h.found.from<=hit.at)||fixed.kind==='boundary'&&fixed.moment.elapsedSeconds<=hit.at||fixed.kind==='unresolved'&&fixed.interval.from<=hit.at)
      return freeze({kind:'unresolved' as const,reason:'recovery_contact_order_ambiguous',interval:{from:hit.from,through:hit.at},coverage,departures});
    const at=kernel.evaluateAt(hit.at,'incoming');
    return freeze({kind:'boundary' as const,moment:at.moment,orientation:multiplyQuaternions(at.orientation,impact.orientation),
      contact:{kind:first.collider.key,partIndex:first.collider.index,firstPossibleElapsedSeconds:hit.from,signedGapMeters:first.collider.gap(hit.at)},
      actorsAtMoment:c.sample(hit.at),pitcherHandAtMoment:pitcherHand(hit.at),descriptor,coverage,departures});
  }
  if(fixed.kind==='unresolved')return freeze({kind:'unresolved' as const,reason:fixed.reason,interval:fixed.interval,coverage,departures});
  const at=kernel.evaluateAt(fixed.moment.elapsedSeconds,'incoming');
  return freeze({kind:fixed.kind,moment:fixed.moment,orientation:multiplyQuaternions(at.orientation,impact.orientation),contacts:fixed.contacts,
    actorsAtMoment:c.sample(fixed.moment.elapsedSeconds),pitcherHandAtMoment:pitcherHand(fixed.moment.elapsedSeconds),descriptor,coverage,departures,
    controlEndsAtThisMoment:fixed.moment.elapsedSeconds===c.throughElapsedSeconds});
}

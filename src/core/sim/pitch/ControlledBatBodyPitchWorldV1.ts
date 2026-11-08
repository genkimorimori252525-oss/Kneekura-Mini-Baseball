import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { createCoupledHeldMeasuredBatBodyControlV1,type CoupledHeldMeasuredBatBodyControlV1 } from '../contact/HeldToMeasuredBatControlV1';
import { validateInitialHeldBatV1 } from '../contact/InitialHeldBatV1';
import { createRigidBatStateFromBatterSwingState,measureRigidBatBallSurfaceSeparation,resolveRigidBatBallContactWithParameterResolver,
  type RigidBatPhysicalProperties,type RigidBaseballProperties } from '../contact/RigidBatBallContact';
import { validateWoodBatSpeedResponseProfile,resolveWoodBatSpeedResponse,type WoodBatSpeedResponseProfile } from '../contact/WoodBatSpeedResponseProfile';
import { multiplyQuaternions,rotateVectorByQuaternion } from '../pitching/BaseballOrientation';
import { createPitchHandHoldRenewalV1,type PitchHandHoldRenewalV1 } from './PitchHandHoldRenewalV1';
import { queryControlledPitchWorldWithHoldRenewalV1,type ControlledPitchWorldInputV1 } from './ControlledPitchWorldV1';

export type ControlledBatBodyPitchWorldInputV1=Readonly<{
  version:'controlled_bat_body_pitch_world_v1';pitch:ControlledPitchWorldInputV1;pitcherRenewal:PitchHandHoldRenewalV1;
  batterPlayerId:string;batterControl:CoupledHeldMeasuredBatBodyControlV1;maximumGloveReachM:number;
  batPhysical:RigidBatPhysicalProperties;ball:RigidBaseballProperties;contactResponse:WoodBatSpeedResponseProfile;
}>;
const fields=(v:unknown,k:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...k].sort().join('|');
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const scale=(v:Vec3,n:number):Vec3=>({x:v.x*n,y:v.y*n,z:v.z*n});
const norm=(v:Vec3)=>Math.hypot(v.x,v.y,v.z);
const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const sameVector=(a:Vec3,b:Vec3)=>a.x===b.x&&a.y===b.y&&a.z===b.z;
const finiteVector=(v:Vec3)=>fields(v,['x','y','z'])&&Object.values(v).every(Number.isFinite);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('controlled bat/body pitch world: '+message);}
type Search={kind:'clear'}|{kind:'hit';at:number;from:number}|{kind:'unresolved';from:number;through:number};

/** Conditional physical query, NOT a Native execution right. All original
 * colliders remain, with precisely the batter's body/hand replaced by their
 * continuous controllers and the actual tapered bat added. Same ball Source
 * root; no future-flight retarget, fixed step contact guess or position nudge. */
export function queryControlledBatBodyPitchWorldV1(raw:ControlledBatBodyPitchWorldInputV1){
  const p=cloneInert(raw);
  assert(fields(p,['version','pitch','pitcherRenewal','batterPlayerId','batterControl','maximumGloveReachM','batPhysical','ball','contactResponse'])
    &&p.version==='controlled_bat_body_pitch_world_v1'&&typeof p.batterPlayerId==='string'&&p.batterPlayerId.length>0
    &&p.batterPlayerId!==p.pitch.pitcherPlayerId&&Number.isFinite(p.maximumGloveReachM)&&p.maximumGloveReachM>0,'invalid world input');
  const model=createCoupledHeldMeasuredBatBodyControlV1(p.batterControl),bat=p.batterControl.bat,release=p.pitch.descriptor.initial.originTick;
  const renewal=createPitchHandHoldRenewalV1(p.pitch.motion,p.pitch.anchors,p.pitcherRenewal);
  assert(p.pitch.throughTick<=bat.throughTick&&release>=bat.initial.startTick&&p.pitch.throughTick>release,'world query exceeds batter control');
  assert(p.ball.radiusM===p.pitch.descriptor.profile.ground.radiusM&&p.ball.radiusM===p.pitch.descriptor.profile.air.aerodynamics.ballRadiusM
    &&p.ball.massKg===p.pitch.descriptor.profile.air.aerodynamics.ballMassKg&&p.ball.rotationalInertiaFactor===p.pitch.descriptor.profile.ground.inertiaRatio
    &&Math.max(...p.batPhysical.radiusProfile.knots.map(k=>k.radiusM))===bat.initial.maximumBatRadiusM,'original ball/bat physical parameters differ');
  validateWoodBatSpeedResponseProfile(p.contactResponse);
  createRigidBatStateFromBatterSwingState(model.sampleContinuous(release).state,p.batPhysical);
  const own=(role:'body'|'tag_hand'|'glove'|'left_foot'|'right_foot')=>{
    const matches=p.pitch.otherActors.filter(a=>a.playerId===p.batterPlayerId&&a.primitive.role===role);assert(matches.length===1,'original own collider missing or duplicated: '+role);
    const a=matches[0].primitive;
    assert(Number.isFinite(a.radius)&&a.radius>0&&a.ticksPerSecond===1e6&&Number.isSafeInteger(a.startTick)&&Number.isSafeInteger(a.endTick)
      &&a.startTick<=bat.initial.startTick&&a.endTick>=p.pitch.throughTick&&finiteVector(a.startCenter)
      &&finiteVector(a.startVelocity)&&finiteVector(a.acceleration)&&norm(a.startVelocity)===0&&norm(a.acceleration)===0,'replacement requires the original stationary scene command');
    return matches[0];
  };
  const body=own('body'),hand=own('tag_hand'),glove=own('glove');
  const originalObstacles=p.pitch.otherActors.filter(a=>a!==hand).map(a=>{
    const s=a.primitive;
    assert(finiteVector(s.startCenter)&&finiteVector(s.startVelocity)&&finiteVector(s.acceleration)
      &&norm(s.startVelocity)===0&&norm(s.acceleration)===0,'moving other actors require their own coupled scene version');
    return {center:s.startCenter,radiusM:s.radius};
  });
  originalObstacles.push({center:p.pitch.anchors.shoulder,radiusM:p.pitch.anchors.armReachM+p.pitch.anchors.handRadiusM});
  assert(originalObstacles.length===bat.body.obstacles.length&&originalObstacles.every((o,i)=>o.radiusM===bat.body.obstacles[i].radiusM
    &&sameVector(o.center,bat.body.obstacles[i].center)),'controller obstacle set differs from the original physical scene');
  assert(sameVector(body.primitive.startCenter,bat.body.bodyOrigin)&&body.primitive.radius===bat.body.obstacles[p.batterControl.bodyObstacleIndex].radiusM
    &&sameVector(hand.primitive.startCenter,bat.body.handCenter)&&hand.primitive.radius===bat.body.handRadiusM,'original body/hand binding differs');
  for(const [role,index]of [['left_foot',p.batterControl.footObstacleIndices[0]],['right_foot',p.batterControl.footObstacleIndices[1]]] as const){
    const foot=own(role).primitive,old=bat.body.obstacles[index];assert(sameVector(foot.startCenter,old.center)&&foot.radius===old.radiusM,'original foot command differs');
  }
  // Preserve the actual palm-center attachment, including any initial grip
  // residual. Anchored rotation differences reproduce the ORIGINAL center
  // exactly at entry rather than snapping it onto the bat reference point.
  const initial=validateInitialHeldBatV1(bat.initial,bat.body),q0=initial.orientation;
  const local=rotateVectorByQuaternion(sub(bat.body.handCenter,bat.initial.grip),{x:-q0.x,y:-q0.y,z:-q0.z,w:q0.w});
  const rotated0=rotateVectorByQuaternion(local,q0);
  const handAt=(tick:number)=>{
    const s=model.sampleContinuous(tick),r=rotateVectorByQuaternion(local,s.orientation);
    return {position:add(bat.body.handCenter,add(sub(s.state.pose.grip,bat.initial.grip),sub(r,rotated0))),
      velocity:add(s.state.linearVelocity,cross(s.state.angularVelocity,r))};
  };
  assert(sameVector(handAt(bat.initial.startTick).position,bat.body.handCenter),'initial palm position was changed');
  const handSpeed=model.certificate.maximumPointSpeedMps*Math.max(1,norm(local)/(bat.initial.batLengthM+bat.initial.maximumBatRadiusM));
  const bodySpeed=model.certificate.bodySpeedUpperBoundMps;
  let constraintBudget=100000;
  const proveGap=(at:(tick:number)=>number,speed:number,lo=bat.bridgeStartTick,hi=bat.throughTick,depth=0):void=>{
    assert(--constraintBudget>=0,'palm/glove proof work exhausted');const mid=(lo+hi)/2,gap=at(mid),pad=speed*(hi-lo)/2/1e6;
    if(gap>pad)return;
    assert(gap>0&&depth<40&&mid!==lo&&mid!==hi,'actual palm/glove reach or body clearance is uncertified at '+mid);
    proveGap(at,speed,lo,mid,depth+1);proveGap(at,speed,mid,hi,depth+1);
  };
  const palmBodyDistance=(t:number)=>norm(sub(handAt(t).position,model.sampleBodyContinuous(t).position));
  proveGap(t=>bat.body.maximumHandReachM-palmBodyDistance(t),handSpeed+bodySpeed);
  proveGap(t=>palmBodyDistance(t)-hand.primitive.radius-body.primitive.radius,handSpeed+bodySpeed);
  proveGap(t=>p.maximumGloveReachM-norm(sub(glove.primitive.startCenter,model.sampleBodyContinuous(t).position)),bodySpeed);
  proveGap(t=>handAt(t).position.y-hand.primitive.radius,handSpeed);
  for(const [i,o]of originalObstacles.entries())if(i!==p.batterControl.bodyObstacleIndex)
    proveGap(t=>norm(sub(handAt(t).position,o.center))-hand.primitive.radius-o.radiusM,handSpeed);
  const replaced=new Set([body,hand]);
  const retained=p.pitch.otherActors.filter(a=>!replaced.has(a));
  assert(retained.length===p.pitch.otherActors.length-2,'collider replacement count differs');
  const fixed=queryControlledPitchWorldWithHoldRenewalV1({...p.pitch,otherActors:retained},p.pitcherRenewal);
  const kernel=createSourceFreeBallKernel(p.pitch.descriptor);
  const horizon=fixed.kind==='unresolved'?fixed.interval.from:fixed.moment.elapsedSeconds;
  const rigidAt=(seconds:number)=>createRigidBatStateFromBatterSwingState(model.sampleContinuous(release+seconds*1e6).state,p.batPhysical);
  const colliders=[
    {key:'bat',speed:model.certificate.maximumPointSpeedMps,gap:(t:number)=>measureRigidBatBallSurfaceSeparation(kernel.evaluateAt(t,'incoming').moment.ball,rigidAt(t),p.ball)},
    {key:'body',speed:bodySpeed,gap:(t:number)=>norm(sub(kernel.evaluateAt(t,'incoming').moment.ball.position,model.sampleBodyContinuous(release+t*1e6).position))-body.primitive.radius-p.ball.radiusM},
    {key:'tag_hand',speed:handSpeed,gap:(t:number)=>norm(sub(kernel.evaluateAt(t,'incoming').moment.ball.position,handAt(release+t*1e6).position))-hand.primitive.radius-p.ball.radiusM},
  ] as const;
  let budget=500000;
  const find=(gap:(t:number)=>number,lo:number,hi:number,speed:number,rounding:number,depth=0):Search=>{
    assert(--budget>=0,'dynamic contact search work exhausted');const a=gap(lo),b=gap(hi);assert(Number.isFinite(a)&&Number.isFinite(b),'nonfinite contact gap');
    if(a<=0)return {kind:'hit',at:lo,from:lo};
    if(Math.min(a,b)>speed*(hi-lo)+rounding)return {kind:'clear'};
    const mid=(lo+hi)/2;
    if(depth===60||mid===lo||mid===hi||hi-lo<=1e-15)return b<=0?{kind:'hit',at:hi,from:lo}:{kind:'unresolved',from:lo,through:hi};
    const left=find(gap,lo,mid,speed,rounding,depth+1);
    if(left.kind==='hit'||left.kind==='unresolved'&&mid-left.from>1e-12)return left;
    const right=find(gap,mid,hi,speed,rounding,depth+1);
    if(left.kind==='clear')return right;
    if(right.kind==='hit'&&right.at-left.from<=1e-12)return {...right,from:left.from};
    return right.kind==='unresolved'?{kind:'unresolved',from:left.from,through:right.through}:left;
  };
  const hits=colliders.flatMap(c=>{
    for(const cell of kernel.cells){
      const lo=cell.fromElapsedSeconds,hi=Math.min(horizon,cell.throughElapsedSeconds);if(hi<=lo)continue;
      const result=find(c.gap,lo,hi,cell.maximumPositionSpeedMps+c.speed,cell.positionRoundingBoundMeters);
      if(result.kind!=='clear')return [{collider:c,result}];
    }return [];
  }).sort((a,b)=>(a.result.kind==='hit'?a.result.at:a.result.from)-(b.result.kind==='hit'?b.result.at:b.result.from));
  const coverage={originalActorCount:p.pitch.otherActors.length,retainedActorCount:retained.length,replacedActorCount:2,addedBat:true,
    palmAttachmentPreserved:true,actualPalmAndGloveReachCertified:true,sourceBallReanchored:false,physicalExecutionAdmitted:false};
  const first=hits[0];
  if(!first){
    const actorsAtMoment=fixed.kind==='unresolved'?null:(()=>{const t=release+fixed.moment.elapsedSeconds*1e6;
      return {body:model.sampleBodyContinuous(t),hand:handAt(t),bat:model.sampleContinuous(t)};})();
    return freeze({kind:'scene_result' as const,physical:fixed,actorsAtMoment,coverage});
  }
  if(first.result.kind==='unresolved')return freeze({kind:'unresolved' as const,reason:'dynamic_contact_refinement_required',interval:first.result,coverage});
  const hit=first.result,others=hits.slice(1);
  if(others.some(v=>(v.result.kind==='hit'?v.result.from:v.result.from)<=hit.at)
    ||fixed.kind!=='unresolved'&&fixed.kind==='boundary'&&fixed.moment.elapsedSeconds<=hit.at
    ||fixed.kind==='unresolved'&&fixed.interval.from<=hit.at)
    return freeze({kind:'unresolved' as const,reason:'simultaneous_contact_order_requires_resolution',interval:{from:hit.from,through:hit.at},coverage});
  const at=kernel.evaluateAt(hit.at,'incoming'),tick=release+hit.at*1e6;
  const orientation=multiplyQuaternions(at.orientation,renewal.originalBinding.releaseOrientation);
  const witness={firstPossibleElapsedSeconds:hit.from,witnessElapsedSeconds:hit.at,signedGapMeters:first.collider.gap(hit.at)};
  const actorsAtContact={body:model.sampleBodyContinuous(tick),hand:handAt(tick),bat:model.sampleContinuous(tick)};
  if(first.collider.key==='bat'){
    const contact=resolveRigidBatBallContactWithParameterResolver(at.moment.ball,rigidAt(hit.at),p.ball,k=>resolveWoodBatSpeedResponse(p.contactResponse,k.normalApproachSpeedMps));
    if(!contact)return freeze({kind:'unresolved' as const,reason:'bat_contact_has_no_closing_impulse',interval:{from:hit.from,through:hit.at},coverage});
    return freeze({kind:'bat_contact' as const,moment:at.moment,orientation,contact,witness,actorsAtContact,coverage,
      postImpactBatControlRequiresSuccessor:true as const});
  }
  const sample=first.collider.key==='body'?actorsAtContact.body:actorsAtContact.hand;
  const delta=sub(at.moment.ball.position,sample.position),distance=norm(delta);assert(distance>0,'actor contact normal unavailable');
  return freeze({kind:'actor_contact' as const,moment:at.moment,orientation,witness,actorsAtContact,coverage,
    contact:{playerId:p.batterPlayerId,role:first.collider.key,center:sample.position,velocity:sample.velocity,normal:scale(delta,1/distance)}});
}

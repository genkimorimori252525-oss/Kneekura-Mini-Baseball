import type { Vec3 } from '../../core/model/geometry';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { createSourceFreeBallKernel,type SourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { createAeroGroundBallPhysicsProfile,type AeroGroundBallPhysicsV1 } from '../../core/sim/ball/VersionedBattedBallPhysics';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { IDENTITY_QUATERNION, normalizeQuaternion, quaternionFromAxisAngle, type Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import { createReferenceBatKinematicsV1,type ReferenceBatKinematicsInputV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { createRigidBatStateFromBatterSwingState,measureRigidBatBallSurfaceSeparation,type BatRadiusProfile,
  type RigidBatPhysicalProperties,type RigidBatBallContactResult } from '../../core/sim/contact/RigidBatBallContact';
import { resolveWoodBatSpeedProfileBallContact } from '../../core/sim/contact/WoodBatSpeedResponseProfile';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../core/sim/contact/WoodBatProductionProfileV1';
import { resolveCatchRetention } from '../../core/sim/fielding/CatchRetention';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { resolveHeightRatioStrikeZoneRegion } from '../../core/sim/pitching/RulebookStrikeZone';
import { registerMeasuredBatToFieldV1,MEASURED_BAT_FIELD_REGISTRATION_V1 } from './MeasuredBatFieldRegistrationV1';
import type { LivePhysicalAbilityControlsV1 } from './LivePhysicalRosterV1';

export type LiveMeasuredClipV1=Readonly<{
  id:string;side:'R'|'L';source:Readonly<{sha256:string;repository?:string}>;contactTimeSeconds:number;
  normalization:Readonly<{batLengthM:number;sweetSpotT:number;positionScale?:number}>;
  frames:readonly Readonly<{tick:number;grip:Vec3;orientation:Quaternion}>[];
}>;
export type LivePitchInputV1=Readonly<{
  originTick:number;seed:number;
  batter:LivePhysicalAbilityControlsV1 & Readonly<{heightMeters:number;bats:'R'|'L';batLengthM:number;batMassKg:number;swingRate:number;
    timingStdSeconds:number;aimStdMeters:number;chaseMarginMeters:number;clipId?:string}>;
  pitcher:Readonly<{releaseSpeedMps:number;spinRadPerSecond:Vec3;commandStdMeters:number;maximumPitchSpeedMps?:number;throws?:'R'|'L'}>;
  catcher?:Readonly<{gloveSpeedMps:number;gloveReachMeters:number;gloveRadiusMeters:number;retentionCapacityJ:number;captureDissipationPowerW:number;pocketRadiusMeters:number}>;
  measuredClips:readonly LiveMeasuredClipV1[];batting:'balanced'|'contact'|'power'|'take'|'bunt';pitchType:string;location:string;
  physics:AeroGroundBallPhysicsV1;
}>;
export type LivePitchFrameV1=Readonly<{tick:number;elapsedSeconds:number;
  ball:Readonly<{position:Vec3;velocity:Vec3;spin:Vec3;orientation:Quaternion;visible:boolean;possessedBy:null|'catcher'}>;
  bat:Readonly<{grip:Vec3;tip:Vec3;radiusProfile:BatRadiusProfile}>|null}>;
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a:Vec3,s:number):Vec3=>({x:a.x*s,y:a.y*s,z:a.z*s});
const norm=(v:Vec3)=>Math.hypot(v.x,v.y,v.z);
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const bounded=(n:number,a:number,b:number)=>Number.isFinite(n)&&n>=a&&n<=b;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('live pitch: '+message);}
const zero=():Vec3=>({x:0,y:0,z:0});
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
function betweenDirections(from:Vec3,to:Vec3):Quaternion{
  const a=mul(from,1/norm(from)),b=mul(to,1/norm(to)),d=clamp(dot(a,b),-1,1);
  if(d< -1+1e-12)return quaternionFromAxisAngle(cross(a,Math.abs(a.x)<.8?{x:1,y:0,z:0}:{x:0,y:1,z:0}),Math.PI);
  const axis=cross(a,b);return normalizeQuaternion({w:1+d,x:axis.x,y:axis.y,z:axis.z});
}
const openBiomechanics='https://github.com/drivelineresearch/openbiomechanics';
function random(seed:number){let s=seed>>>0;const uniform=()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
  return {uniform,normal:()=>clamp(Math.sqrt(-2*Math.log(Math.max(1e-12,uniform())))*Math.cos(2*Math.PI*uniform()),-3,3)};}
type Search={kind:'hit';from:number;at:number}|{kind:'unresolved';from:number;through:number}|null;
/** Lipschitz exclusion over the original Source cells, with chronological
 * refinement. This searches continuous geometry, independently of render fps. */
function firstContact(kernel:SourceFreeBallKernel,gap:(seconds:number)=>number,colliderSpeed:number,through:number):Search{
  let budget=200000;
  const search=(lo:number,hi:number,speed:number,rounding:number,depth=0):Search=>{
    assert(--budget>=0,'continuous collision proof budget exhausted');const a=gap(lo),b=gap(hi);
    assert(Number.isFinite(a)&&Number.isFinite(b),'nonfinite collision gap');
    if(a<=0)return {kind:'hit',from:lo,at:lo};
    if(Math.min(a,b)>speed*(hi-lo)+rounding)return null;
    const mid=(lo+hi)/2;
    if(depth===60||mid===lo||mid===hi||hi-lo<=1e-15)return b<=0?{kind:'hit',from:lo,at:hi}:{kind:'unresolved',from:lo,through:hi};
    const left=search(lo,mid,speed,rounding,depth+1);
    if(left?.kind==='hit'||left&&mid-left.from>1e-12)return left;
    const right=search(mid,hi,speed,rounding,depth+1);
    if(!left)return right;
    if(right?.kind==='hit'&&right.at-left.from<=1e-12)return {...right,from:left.from};
    return right?.kind==='unresolved'?{kind:'unresolved',from:left.from,through:right.through}:left;
  };
  for(const c of kernel.cells){const lo=c.fromElapsedSeconds,hi=Math.min(through,c.throughElapsedSeconds);if(hi<=lo)continue;
    const r=search(lo,hi,c.maximumPositionSpeedMps+colliderSpeed,c.positionRoundingBoundMeters+128*Number.EPSILON);if(r)return r;}
  return null;
}
function crossing(kernel:SourceFreeBallKernel,planeZ:number):number|null{
  for(const c of kernel.cells){const a=kernel.evaluateAt(c.fromElapsedSeconds).moment.ball,b=kernel.evaluateAt(c.throughElapsedSeconds).moment.ball;
    if(a.position.z>=planeZ&&b.position.z<=planeZ){let lo=c.fromElapsedSeconds,hi=c.throughElapsedSeconds;
      for(let i=0;i<60&&hi-lo>1e-12;i++){const mid=(lo+hi)/2;if(kernel.evaluateAt(mid).moment.ball.position.z<=planeZ)hi=mid;else lo=mid;}return hi;}}
  return null;
}

/** A playable local physical experiment. OBP supplies bat axes/hand paths;
 * registration, rate/aim error, pitcher command and catcher control below are
 * explicit provisional SI models. They do not supply Native authorizations,
 * measured body torque, original performer anthropometry or named-league SI. */
export function simulateLivePitchV1(raw:LivePitchInputV1){
  const input=cloneInert(raw),b=input.batter,p=input.pitcher,profile=createAeroGroundBallPhysicsProfile(input.physics),tps=profile.air.ticksPerSecond,
    catcher=input.catcher??{gloveSpeedMps:7,gloveReachMeters:.95,gloveRadiusMeters:.14,retentionCapacityJ:350,captureDissipationPowerW:10000,pocketRadiusMeters:.18};
  assert(Number.isSafeInteger(input.originTick)&&input.originTick>=0&&Number.isSafeInteger(input.seed)&&tps===profile.ground.ticksPerSecond,'invalid original clock or seed');
  assert(bounded(b.heightMeters,1.1,2.5)&&['R','L'].includes(b.bats)&&bounded(b.batLengthM,.55,1.2)&&bounded(b.batMassKg,.4,1.8)
    &&bounded(b.swingRate,.3,3)&&bounded(b.timingStdSeconds,0,.08)&&bounded(b.aimStdMeters,0,.35)&&bounded(b.chaseMarginMeters,0,.6),'invalid batter SI controls');
  assert(bounded(p.releaseSpeedMps,15,85)&&bounded(p.commandStdMeters,0,.6)&&p.spinRadPerSecond&&Object.values(p.spinRadPerSecond).every(Number.isFinite)
    &&norm(p.spinRadPerSecond)<=1200,'invalid pitcher SI controls');
  assert((p.maximumPitchSpeedMps===undefined||bounded(p.maximumPitchSpeedMps,15,85))&&(p.throws===undefined||['R','L'].includes(p.throws)),'invalid pitcher limit or throwing side');
  for(const [key,lo,hi] of [['maximumSweetSpotSpeedMps',.1,90],['targetSweetSpotSpeedMps',.1,90],['motorLatencySeconds',0,2],
    ['technicalTimingOffsetSeconds',-.5,.5],['sweetSpotT',.65,.9],['attackAngleDegrees',-80,80],['pullAngleDegrees',-80,80],
    ['badBallControl',0,1],['preContactSeconds',.005,2],['followThroughSeconds',.005,2],['contactDepthMeters',.001,2],['zoneJudgmentStdMeters',0,.6]] as const)
    assert(b[key]===undefined||bounded(b[key]!,lo,hi),'invalid authored batter control: '+key);
  if(b.swingDecision)assert(['AUTO','TAKE','SWING'].includes(b.swingDecision.approach)&&bounded(b.swingDecision.threshold,0,1)
    &&bounded(b.swingDecision.aggressionWeight,0,1),'invalid authored swing decision');
  assert(bounded(catcher.gloveSpeedMps,.1,40)&&bounded(catcher.gloveReachMeters,.4,3)&&bounded(catcher.gloveRadiusMeters,.03,.3)
    &&bounded(catcher.retentionCapacityJ,1,2000)&&bounded(catcher.captureDissipationPowerW,10,1e6)&&bounded(catcher.pocketRadiusMeters,.02,1),'invalid catcher SI controls');
  assert(['balanced','contact','power','take','bunt'].includes(input.batting),'invalid batting command');
  const r=random(input.seed),clips=input.measuredClips.filter(c=>c.side===b.bats&&(!b.clipId||c.id===b.clipId));
  assert(clips.length>0,'a measured OpenBiomechanics clip for the actual batting side is required');
  const clip=clips[Math.floor(r.uniform()*clips.length)];
  assert(clip.id.startsWith('obp-')&&clip.source.repository===openBiomechanics&&/^[a-f0-9]{64}$/.test(clip.source.sha256)
    &&Number.isFinite(clip.contactTimeSeconds)&&clip.frames.length>=2,'unsupported measured clip provenance');
  const pitchType=input.pitchType==='auto'?['fastball','slider','curve','changeup'][Math.floor(r.uniform()*4)]:input.pitchType;
  assert(['fastball','slider','curve','changeup','cutter','sinker','splitter'].includes(pitchType),'unsupported physical pitch type');
  const factor=({fastball:1,slider:.91,curve:.8,changeup:.82,cutter:.95,sinker:.96,splitter:.89} as Record<string,number>)[pitchType],
    speed=Math.min(p.releaseSpeedMps,p.maximumPitchSpeedMps??Infinity)*factor*(.98+.02*r.uniform()),spinMagnitude=norm(p.spinRadPerSecond);
  const axes:Record<string,Vec3>={slider:{x:.25,y:-.8,z:.55},curve:{x:-1,y:0,z:.1},changeup:{x:.65,y:.2,z:.25},
    cutter:{x:.7,y:-.45,z:.25},sinker:{x:.55,y:.5,z:.2},splitter:{x:-.15,y:.15,z:.3}};
  const spin=pitchType==='fastball'?p.spinRadPerSecond:mul(axes[pitchType],spinMagnitude*(pitchType==='changeup'?.7:1)/norm(axes[pitchType]));
  const zone=resolveHeightRatioStrikeZoneRegion({plateCenterX:0,playerPhysicalProfile:{heightMeters:b.heightMeters}}),middle=(zone.lowerY+zone.upperY)/2;
  const location=input.location==='auto'?['zone','zone','low','outside','inside'][Math.floor(r.uniform()*5)]:input.location;
  assert(['zone','low','outside','inside','high'].includes(location),'unsupported target location');
  const batterSide=b.bats==='R'?-1:1,target={x:(r.uniform()-.5)*.32,y:middle+(r.uniform()-.5)*(zone.upperY-zone.lowerY)*.7,z:.15};
  if(location==='outside')target.x=-batterSide*(.25+r.uniform()*.25);
  if(location==='inside')target.x=batterSide*(.19+r.uniform()*.2);
  if(location==='low')target.y=zone.lowerY-.06-r.uniform()*.16;
  if(location==='high')target.y=zone.upperY+.06+r.uniform()*.16;
  const commanded={...target,x:target.x+r.normal()*p.commandStdMeters,y:target.y+r.normal()*p.commandStdMeters};
  const release={x:p.throws==='L'?-.18:.18,y:1.83,z:16.9},flightGuess=(release.z-commanded.z)/speed;
  let vx=(commanded.x-release.x)/flightGuess,vy=(commanded.y-release.y-profile.air.gravityY*flightGuess*flightGuess/2)/flightGuess,
    vz=-Math.sqrt(Math.max(speed*speed-vx*vx-vy*vy,speed*speed*.5)),flightTime=flightGuess;
  let initial={tick:input.originTick,position:release,velocity:{x:vx,y:vy,z:vz},spin};
  // Pitcher's inverse command solve: only the release velocity changes. Once
  // released, neither the original ball nor a contact result is corrected.
  for(let i=0;i<3;i++){
    const at=sampleAerodynamicPitchStateAtElapsedSeconds(initial,flightTime,profile.air);
    flightTime=clamp(flightTime+(commanded.z-at.position.z)/at.velocity.z,.12,1.6);
    vx+=(commanded.x-at.position.x)/flightTime;vy+=(commanded.y-at.position.y)/flightTime;
    const horizontal=Math.hypot(vx,vy);if(horizontal>speed*.65){vx*=speed*.65/horizontal;vy*=speed*.65/horizontal;}
    vz=-Math.sqrt(speed*speed-vx*vx-vy*vy);initial={...initial,velocity:{x:vx,y:vy,z:vz}};
  }
  const horizon=Math.min(2.5,Math.max(.8,flightTime+.4)),descriptor={kind:'aero_ground_continuous_source_kernel_v2' as const,
    initial:{originTick:input.originTick,elapsedSeconds:0,ball:initial},throughElapsedSeconds:horizon,profile},kernel=createSourceFreeBallKernel(descriptor),
    plateTime=crossing(kernel,.15),catchPlaneTime=crossing(kernel,-.85);
  assert(plateTime!==null&&catchPlaneTime!==null,'pitched ball did not cross the finite plate/catcher planes');
  const decisionTime=Math.min(.14,plateTime*.35),observed=kernel.evaluateAt(decisionTime).moment.ball;
  const predictAtPlane=(plane:number)=>{
    let dt=Math.max(.001,(plane-observed.position.z)/observed.velocity.z),pred=observed;
    for(let i=0;i<3;i++){pred=sampleAerodynamicPitchStateAtElapsedSeconds(observed,dt,profile.air);dt=clamp(dt+(plane-pred.position.z)/pred.velocity.z,.001,horizon-decisionTime);}
    return {elapsedSeconds:decisionTime+dt,ball:sampleAerodynamicPitchStateAtElapsedSeconds(observed,dt,profile.air)};
  };
  const prediction=predictAtPlane(b.contactDepthMeters??.15),controlFactor=input.batting==='power'?1.08:input.batting==='contact'?.92:1,
    timingError=r.normal()*b.timingStdSeconds*(input.batting==='contact'?.72:input.batting==='power'?1.15:1),
    awkwardness=Math.max(0,Math.abs(prediction.ball.position.x)/.2159-1,(.55-prediction.ball.position.y)/.5,(prediction.ball.position.y-1.5)/.5),
    awkwardErrorFactor=b.badBallControl===undefined?1:1+awkwardness*(1-b.badBallControl),
    aimScale=b.aimStdMeters*(input.batting==='contact'?.7:input.batting==='power'?1.1:1)*awkwardErrorFactor,
    aimError={x:r.normal()*aimScale,y:r.normal()*aimScale,z:r.normal()*aimScale*.3},
    sweetSpotT=clamp((b.sweetSpotT??(b.batLengthM-.1524)/b.batLengthM)+(r.uniform()-.5)*.025,.65,.9),heightScale=b.heightMeters/1.8;
  const judgmentStd=b.zoneJudgmentStdMeters??0,judgmentError={x:0,y:0};
  if(judgmentStd!==0){
    // An isolated recognition stream does not consume clip, pitch-command,
    // timing or aim draws. No identity/league enters this numerical model.
    const judgmentRng=new SeedRoot(input.seed).streamRng(0,'batting','zone-judgment-v1'),
      normal=()=>Math.sqrt(-2*Math.log(1-judgmentRng.nextFloat()))*Math.cos(2*Math.PI*judgmentRng.nextFloat());
    judgmentError.x=normal()*judgmentStd;judgmentError.y=normal()*judgmentStd;
  }
  const judgmentPosition=judgmentStd===0?prediction.ball.position:{...prediction.ball.position,
    x:prediction.ball.position.x+judgmentError.x,y:prediction.ball.position.y+judgmentError.y};
  const inChaseEnvelope=Math.abs(judgmentPosition.x)<=zone.halfWidth+b.chaseMarginMeters
    &&judgmentPosition.y>=zone.lowerY-b.chaseMarginMeters&&judgmentPosition.y<=zone.upperY+b.chaseMarginMeters,
    zoneMargin=Math.min(zone.halfWidth-Math.abs(judgmentPosition.x),judgmentPosition.y-zone.lowerY,zone.upperY-judgmentPosition.y),
    swingScore=clamp(.5+zoneMargin/Math.max(.1,zone.halfWidth)+(b.swingDecision?(b.swingDecision.aggressionWeight-.5)*.2:0),0,1),
    swingOffered=input.batting!=='take'&&(b.swingDecision?b.swingDecision.approach==='SWING'
      ||b.swingDecision.approach==='AUTO'&&inChaseEnvelope&&swingScore>=b.swingDecision.threshold:inChaseEnvelope);
  const desiredContactTime=Math.max(.055,prediction.elapsedSeconds+timingError+(b.technicalTimingOffsetSeconds??0)),sourceContactTick=clip.contactTimeSeconds*1e6;
  const fullFrames=registerMeasuredBatToFieldV1(clip.frames).map(f=>({tick:f.tick,grip:mul(f.grip,heightScale),orientation:f.orientation})),
    probeInput:ReferenceBatKinematicsInputV1={provenance:{clipId:clip.id,sourceSha256:clip.source.sha256},frames:fullFrames,batLengthM:b.batLengthM,
      sweetSpotT,sourceTicksPerSecond:1e6,startTick:input.originTick,ticksPerSecond:tps,playbackRate:1,
      transform:{rotation:IDENTITY_QUATERNION,translation:zero(),scale:1}},probe=createReferenceBatKinematicsV1(probeInput),
    probeVelocity=probe.sampleAtSourceTick(sourceContactTick,'outgoing').sweetSpotVelocity;
  let rate=b.swingRate*controlFactor;
  if(b.targetSweetSpotSpeedMps!==undefined){assert(norm(probeVelocity)>1e-9,'measured reference has no finite contact speed');rate*=b.targetSweetSpotSpeedMps/norm(probeVelocity);}
  if(b.maximumSweetSpotSpeedMps!==undefined)rate=Math.min(rate,b.maximumSweetSpotSpeedMps/probe.maximumSweetSpotSpeedMps);
  assert(bounded(rate,.01,20),'authored motor rate is outside this finite reference model');
  let authoredRotation=IDENTITY_QUATERNION;
  if(b.attackAngleDegrees!==undefined||b.pullAngleDegrees!==undefined){
    const side=b.bats==='R'?1:-1,attack=b.attackAngleDegrees===undefined?Math.atan2(probeVelocity.y,Math.hypot(probeVelocity.x,probeVelocity.z)):b.attackAngleDegrees*Math.PI/180,
      pull=b.pullAngleDegrees===undefined?-Math.atan2(probeVelocity.x,probeVelocity.z):b.pullAngleDegrees*side*Math.PI/180;
    authoredRotation=betweenDirections(probeVelocity,{x:-Math.sin(pull)*Math.cos(attack),y:Math.sin(attack),z:Math.cos(pull)*Math.cos(attack)});
  }
  const minimumSourceTick=sourceContactTick-(b.preContactSeconds??Math.max(0,desiredContactTime-.045))*rate*1e6;
  let selectedFrames=fullFrames.filter(f=>f.tick>=minimumSourceTick);
  if(b.preContactSeconds!==undefined){const previous=fullFrames.filter(f=>f.tick<minimumSourceTick).at(-1);if(previous)selectedFrames=[previous,...selectedFrames];}
  if(b.followThroughSeconds!==undefined){const maximumSourceTick=sourceContactTick+b.followThroughSeconds*rate*1e6,
    last=selectedFrames.findIndex(f=>f.tick>=maximumSourceTick);if(last>=0)selectedFrames=selectedFrames.slice(0,last+1);}
  assert(selectedFrames.length>=2&&selectedFrames[0].tick<sourceContactTick&&selectedFrames.at(-1)!.tick>sourceContactTick,'measured swing does not bracket contact reference');
  const startOffset=desiredContactTime-(sourceContactTick-selectedFrames[0].tick)/1e6/rate,
    plannedStartTick=input.originTick+Math.max(0,Math.round(startOffset*tps)),
    actualStartTick=b.motorLatencySeconds===undefined?plannedStartTick:Math.max(plannedStartTick,input.originTick+Math.ceil((decisionTime+b.motorLatencySeconds)*tps)),
    motorDelaySeconds=(actualStartTick-plannedStartTick)/tps,
    referenceInput:ReferenceBatKinematicsInputV1={provenance:{clipId:clip.id,sourceSha256:clip.source.sha256},frames:selectedFrames,
      batLengthM:b.batLengthM,sweetSpotT,sourceTicksPerSecond:1e6,startTick:actualStartTick,ticksPerSecond:tps,playbackRate:rate,
      transform:{rotation:authoredRotation,translation:zero(),scale:1}};
  const referenceZero=createReferenceBatKinematicsV1(referenceInput),referenceContactTick=referenceInput.startTick+(sourceContactTick-selectedFrames[0].tick)/1e6/rate*tps,
    point=referenceZero.sampleContinuous(referenceContactTick).sweetSpot;
  const registeredReference={...referenceInput,transform:{...referenceInput.transform,translation:sub(add(prediction.ball.position,aimError),point)}};
  const reference=createReferenceBatKinematicsV1(registeredReference),radiusProfile:BatRadiusProfile={knots:[{t:0,radiusM:.019},{t:.06,radiusM:.014},
    {t:.42,radiusM:.014},{t:.7,radiusM:.03},{t:.94,radiusM:.033},{t:1,radiusM:.031}]},
    batPhysical:RigidBatPhysicalProperties={massKg:b.batMassKg,centerOfMassT:.65,transverseMomentOfInertiaKgM2:b.batMassKg*b.batLengthM*b.batLengthM*.075,
      axialMomentOfInertiaKgM2:b.batMassKg*.025*.025/2,radiusProfile},
    ballPhysical={massKg:profile.air.aerodynamics.ballMassKg,radiusM:profile.air.aerodynamics.ballRadiusM,rotationalInertiaFactor:profile.ground.inertiaRatio};
  const held=reference.sampleContinuous(input.batting==='bunt'?referenceContactTick:input.originTick),
    batSample=(seconds:number)=>swingOffered&&input.batting!=='bunt'?reference.sampleContinuous(input.originTick+seconds*tps)
      :{...held,state:{...held.state,linearVelocity:zero(),angularVelocity:zero()}};
  const rigidAt=(seconds:number)=>createRigidBatStateFromBatterSwingState(batSample(seconds).state,batPhysical),
    batBound=swingOffered&&input.batting!=='bunt'?reference.maximumGripSpeedMps+reference.maximumAngularSpeedRadPerSecond*b.batLengthM:0;
  // A catcher's forecast must include a possible pitch bounce. This is a
  // separate prediction from the observed state; it never replaces the
  // released Source used by collision, spin, clock or rendering.
  const catcherForecast=createSourceFreeBallKernel({...descriptor,initial:kernel.evaluateAt(decisionTime).moment}),
    catcherForecastTime=crossing(catcherForecast,-.85);
  assert(catcherForecastTime!==null,'catcher forecast did not reach its finite plane');
  const catcherPrediction={elapsedSeconds:catcherForecastTime,ball:catcherForecast.evaluateAt(catcherForecastTime).moment.ball},
    catcherStart={x:0,y:middle,z:-.85},body={x:0,y:.8,z:-1.2},reach=catcher.gloveReachMeters,
    catcherTarget={x:catcherPrediction.ball.position.x,y:catcherPrediction.ball.position.y,z:-.85};
  catcherTarget.y=Math.max(catcher.gloveRadiusMeters,catcherTarget.y);
  const planarReach=Math.sqrt(reach*reach-(catcherTarget.z-body.z)**2),fromBody={x:catcherTarget.x-body.x,y:catcherTarget.y-body.y,z:0};
  if(norm(fromBody)>planarReach){const constrained=add(body,mul(fromBody,planarReach/norm(fromBody)));catcherTarget.x=constrained.x;catcherTarget.y=constrained.y;}
  const moveStart=decisionTime,moveEnd=Math.max(moveStart+.025,catcherPrediction.elapsedSeconds-.025),moveDuration=moveEnd-moveStart,
    delta=sub(catcherTarget,catcherStart),distance=norm(delta),maximumGloveSpeedMps=catcher.gloveSpeedMps;
  if(distance>maximumGloveSpeedMps*moveDuration/1.5){const limited=add(catcherStart,mul(delta,maximumGloveSpeedMps*moveDuration/1.5/distance));catcherTarget.x=limited.x;catcherTarget.y=limited.y;}
  const finalDelta=sub(catcherTarget,catcherStart),gloveAt=(seconds:number)=>{
    const u=clamp((seconds-moveStart)/moveDuration,0,1),smooth=u*u*(3-2*u),ds=seconds>moveStart&&seconds<moveEnd?6*u*(1-u)/moveDuration:0;
    return {position:add(catcherStart,mul(finalDelta,smooth)),velocity:mul(finalDelta,ds)};
  };
  const ground=kernel.boundaries.find(x=>x.kind==='ground')?.elapsedSeconds??horizon,
    catcherHit=firstContact(kernel,t=>norm(sub(kernel.evaluateAt(t,'incoming').moment.ball.position,gloveAt(t).position))-catcher.gloveRadiusMeters-ballPhysical.radiusM,
      maximumGloveSpeedMps,horizon),catcherAt=catcherHit?.kind==='hit'?catcherHit.at:Math.min(horizon,catchPlaneTime+.05),
    batHit=firstContact(kernel,t=>measureRigidBatBallSurfaceSeparation(kernel.evaluateAt(t,'incoming').moment.ball,rigidAt(t),ballPhysical),batBound,catcherAt);
  let contact:RigidBatBallContactResult|null=null,contactMoment:BallWorldMoment|null=null,contactOrientation:Quaternion|null=null,
    call:'ball'|'called_strike'|'swinging_strike'|null=null,endElapsedSeconds=catcherAt,secureTick:number|null=null,unsupportedReason:string|null=null;
  if(batHit?.kind==='unresolved'){unsupportedReason='bat_contact_refinement_required';endElapsedSeconds=batHit.from;}
  else if(batHit?.kind==='hit'){
    const at=kernel.evaluateAt(batHit.at,'incoming');contact=resolveWoodBatSpeedProfileBallContact(at.moment.ball,rigidAt(batHit.at),ballPhysical,NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1);
    if(contact){contactMoment=at.moment;contactOrientation=at.orientation;endElapsedSeconds=batHit.at;}
    else {unsupportedReason='separating_or_tangent_bat_contact_requires_continuation';endElapsedSeconds=batHit.at;}
  }else if(catcherHit?.kind==='unresolved'){unsupportedReason='catcher_contact_refinement_required';endElapsedSeconds=catcherHit.from;}
  else if(catcherHit?.kind==='hit'){
    const at=kernel.evaluateAt(catcherHit.at,'incoming'),glove=gloveAt(catcherHit.at),relative=sub(at.moment.ball.position,glove.position),normal=mul(relative,1/norm(relative)),
      retention=resolveCatchRetention({contactTick:at.moment.ball.tick,ball:at.moment.ball,glove:{tick:at.moment.ball.tick,...glove},contactNormal:normal,
        pocketOffsetMeters:Math.hypot(relative.x,relative.y),bodyStability:1},{ticksPerSecond:tps,ballMassKg:ballPhysical.massKg,ballRadiusMeters:ballPhysical.radiusM,
        pocketRadiusMeters:catcher.pocketRadiusMeters,centerRetentionCapacityJ:catcher.retentionCapacityJ,captureDissipationPowerW:catcher.captureDissipationPowerW,
        failedContactRestitution:.15,failedTangentialDamping:.6,failedSpinDamping:.4});
    if(retention.outcome.kind==='secured'){
      secureTick=retention.outcome.secureTick;endElapsedSeconds=(secureTick-input.originTick)/tps;
      const plate=kernel.evaluateAt(plateTime).moment.ball.position;
      call=swingOffered?'swinging_strike':ground>plateTime&&Math.abs(plate.x)<=zone.halfWidth+ballPhysical.radiusM&&plate.y+ballPhysical.radiusM>=zone.lowerY
        &&plate.y-ballPhysical.radiusM<=zone.upperY?'called_strike':'ball';
    }else unsupportedReason='catcher_retention_failed_live_ball_requires_successor';
  }else unsupportedReason='catcher_missed_live_ball_requires_successor';
  const endedAtTick=contactMoment?.ball.tick??quantizeEventTick(input.originTick,endElapsedSeconds,tps),times=new Set<number>([0,endElapsedSeconds]),
    referenceThroughTick=registeredReference.startTick+(selectedFrames.at(-1)!.tick-selectedFrames[0].tick)/1e6/rate*tps;
  for(let i=1;i*.011<endElapsedSeconds;i++)times.add(i*.011);
  if(catcherHit?.kind==='hit'&&catcherHit.at<endElapsedSeconds)times.add(catcherHit.at);
  const frames:LivePitchFrameV1[]=[...times].sort((a,c)=>a-c).map(seconds=>{
    const capturing=secureTick!==null&&catcherHit?.kind==='hit'&&seconds>=catcherHit.at,
      sample=kernel.evaluateAt(Math.min(seconds,capturing&&catcherHit?.kind==='hit'?catcherHit.at:horizon),'incoming'),bat=batSample(seconds).state.pose,
      owned=secureTick!==null&&quantizeEventTick(input.originTick,seconds,tps)>=secureTick;
    // During finite retention the reduced-order pocket constraint stores the
    // contact load; secure custody/visibility changes only at Core's secureTick.
    const heldPosition=capturing&&catcherHit?.kind==='hit'?add(sample.moment.ball.position,sub(gloveAt(seconds).position,gloveAt(catcherHit.at).position)):sample.moment.ball.position;
    return {tick:quantizeEventTick(input.originTick,seconds,tps),elapsedSeconds:seconds,
      ball:{position:heldPosition,velocity:capturing?gloveAt(seconds).velocity:sample.moment.ball.velocity,spin:capturing?zero():sample.moment.ball.spin,
        orientation:sample.orientation,visible:!owned,possessedBy:owned?'catcher':null},bat:input.originTick+seconds*tps<=referenceThroughTick?{...bat,radiusProfile}:null};
  });
  const sampleBatAtTick=(atTick:number)=>{assert(Number.isFinite(atTick)&&atTick>=input.originTick,'bat observation precedes release');
    if(atTick>referenceThroughTick)return null;
    return {...batSample((atTick-input.originTick)/tps).state.pose,radiusProfile};};
  return {frames,contact,contactMoment,contactOrientation,call,endedAtTick,clipId:clip.id,pitchType,speedKmh:speed*3.6,sampleBatAtTick,
    diagnostics:{authority:'LOCAL_CORE_PHYSICAL_EXPERIMENT_V1' as const,nativeAdmission:false as const,sourceDescriptor:descriptor,
      sourceBallReanchored:false as const,sourceClockTicksPerSecond:tps,obpSourceSha256:clip.source.sha256,battingSide:b.bats,
      measuredClipId:clip.id,measuredBatCoordinateRegistration:MEASURED_BAT_FIELD_REGISTRATION_V1,
      swingOffered,sweetSpotT,playbackRate:rate,referenceStartTick:referenceInput.startTick,referenceThroughTick,predictionMadeAtElapsedSeconds:decisionTime,
      individualControls:{maximumPitchSpeedMps:p.maximumPitchSpeedMps??null,throwingSide:p.throws??'R',maximumSweetSpotSpeedMps:b.maximumSweetSpotSpeedMps??null,
        targetSweetSpotSpeedMps:b.targetSweetSpotSpeedMps??null,motorLatencySeconds:b.motorLatencySeconds??null,technicalTimingOffsetSeconds:b.technicalTimingOffsetSeconds??null,
        sweetSpotT:b.sweetSpotT??null,attackAngleDegrees:b.attackAngleDegrees??null,pullAngleDegrees:b.pullAngleDegrees??null,badBallControl:b.badBallControl??null,
        swingDecision:b.swingDecision??null,preContactSeconds:b.preContactSeconds??null,followThroughSeconds:b.followThroughSeconds??null,contactDepthMeters:b.contactDepthMeters??null,
        zoneJudgmentStdMeters:judgmentStd},
      zoneJudgment:{standardDeviationMeters:judgmentStd,errorMeters:judgmentError,observedForecastPosition:prediction.ball.position,
        estimatedPosition:judgmentPosition,stream:'zone-judgment-v1' as const,basis:'AUTHORED_XY_COURSE_ESTIMATE_ERROR_NOT_CHASE_PREFERENCE' as const},
      authoredDecisionPolicy:'BOUNDED_OBSERVED_ZONE_MARGIN_V1_NOT_CALIBRATED_RECOGNITION' as const,swingScore,awkwardErrorFactor,motorDelaySeconds,
      authoredTrajectoryPolicy:'FINITE_MEASURED_KEYS_WITH_EXPLICIT_RIGID_DIRECTION_RATE_AND_WINDOW_CONTROLS' as const,
      referenceMaximumSweetSpotSpeedMps:reference.maximumSweetSpotSpeedMps,referenceContactTick,
      plannedReferenceStartTick:plannedStartTick,maximumOnTimeMotorLatencySeconds:(plannedStartTick-input.originTick)/tps-decisionTime,
      desiredContactElapsedSeconds:desiredContactTime,selectedSourceFirstTick:selectedFrames[0].tick,selectedSourceLastTick:selectedFrames.at(-1)!.tick,
      referenceSpeedCalibration:'EXACT_ORIGINAL_SOURCE_COORDINATE_OUTGOING_HALF_OPEN_SEGMENT' as const,
      referenceContactSweetSpotSpeedMps:norm(reference.sampleAtSourceTick(sourceContactTick,'outgoing').sweetSpotVelocity),
      referenceContactSweetSpotVelocity:reference.sampleAtSourceTick(sourceContactTick,'outgoing').sweetSpotVelocity,
      referenceIncomingContactSweetSpotVelocity:reference.sampleAtSourceTick(sourceContactTick,'incoming').sweetSpotVelocity,
      referenceWorldSampleContactSweetSpotVelocity:reference.sampleContinuous(referenceContactTick).sweetSpotVelocity,
      predictionModel:'CURRENT_OBSERVED_STATE_AERO_FORECAST_NO_BODY_OR_NEURAL_CALIBRATION' as const,timingErrorSeconds:timingError,aimErrorMeters:aimError,
      catcherModel:'BOUNDED_C1_GLOVE_IDEAL_STATE_FORECAST_REDUCED_ORDER_RETENTION' as const,catcherMaximumSpeedMps:maximumGloveSpeedMps,
      catcherSI:catcher,catcherCalibration:input.catcher?'EXPLICIT_ROSTER_SI':'EXPLICIT_COMPATIBILITY_TEST_MODEL',
      catcherPredictionPhysics:'OBSERVED_STATE_AERO_GROUND_FORECAST_NOT_A_REPLACEMENT_ACTUAL_SOURCE' as const,
      catcherBodyReachM:reach,secureTick,catcherContactElapsedSeconds:catcherHit?.kind==='hit'?catcherHit.at:null,unsupportedReason,
      collisionSearch:'ORIGINAL_SOURCE_CELL_SPEED_BOUND_CONTINUOUS_TAPERED_BAT' as const,materialProfileId:NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1.profileId,
      bodyTorqueCalibrated:false as const,axialRollMeasured:false as const,postImpactBodyRecoilImplemented:false as const,
      postImpactBatPresentation:'PRESCRIBED_OBP_REFERENCE_MOTOR_CONTINUATION_RECOIL_NOT_COUPLED' as const,
      batReferenceScope:'FINITE_MEASURED_KEYS_ONLY_NOT_AN_EQUIPMENT_RELEASE_FACT' as const,
      batterBodyCollidersImplemented:false as const,pitcherReleaseHandColliderImplemented:false as const}};
}

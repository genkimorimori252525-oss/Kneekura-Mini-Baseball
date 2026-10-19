import type { Vec3 } from '../../core/model/geometry';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { createRigidBatSwingWindowFromSampledV1, resolveAerodynamicRigidBatSwing } from '../../core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../core/sim/contact/WoodBatProductionProfileV1';
import { resolveWoodBatSpeedResponse } from '../../core/sim/contact/WoodBatSpeedResponseProfile';
import { createFreeBaseballTrajectory, type FreeBaseballSample } from '../../core/sim/ball/FreeBaseballTrajectory';
import { advanceAerodynamicPitchState } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { advanceBaseballOrientation, IDENTITY_QUATERNION } from '../../core/sim/pitching/BaseballOrientation';
import { createWorkbenchPlayer, exportWorkbenchPlayerSources, WORKBENCH_TICKS_PER_SECOND, type WorkbenchPlayer } from './WorkbenchPlayer';
import { createWorkbenchPitchTrajectory } from './WorkbenchPitchTrajectory';
import type { WorkbenchPitch } from './BattingWorkbench';
import { withReferenceImpactTrajectoryV1, type ImpactTrajectorySettingsV1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';

export type ReferenceBattingWorkbenchInput = Readonly<{ player: WorkbenchPlayer; pitch: WorkbenchPitch;
  referenceTrajectory: ReferenceBatKinematicsInputV1; throughSeconds?: number;
  impactTrajectory?: ImpactTrajectorySettingsV1; impactContactSourceTick?: number }>;
const add = (a: Vec3,b: Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const scale = (a:Vec3,n:number):Vec3=>({x:a.x*n,y:a.y*n,z:a.z*n});
const norm = (a:Vec3)=>Math.hypot(a.x,a.y,a.z);
const cross = (a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});

/** Actual ball collision with an explicitly authored sampled reference motor.
 * Position/timing/calibration are operator inputs: no guaranteed hit, target
 * trajectory or outcome is generated. Body reach and recoil are unmodelled;
 * this experiment cannot supply a Native accepted player/motor Source. */
export const simulateReferenceBattingWorkbench = (raw: ReferenceBattingWorkbenchInput) => {
  const input=cloneInert(raw), player=createWorkbenchPlayer(input.player);
  if ((input.impactTrajectory===undefined)!==(input.impactContactSourceTick===undefined)) throw new Error('impact adjustment requires settings and measured contact time');
  const referenceInput=input.impactTrajectory===undefined?input.referenceTrajectory:
      withReferenceImpactTrajectoryV1(input.referenceTrajectory,input.impactContactSourceTick!,input.impactTrajectory),
    reference=createReferenceBatKinematicsV1(referenceInput);
  const p=WORKBENCH_TICKS_PER_SECOND, duration=input.throughSeconds??8;
  if(!Number.isFinite(duration)||duration<1||duration>20||referenceInput.ticksPerSecond!==p)
    throw new Error('invalid reference experiment duration or clock');
  if(Math.abs(reference.batLengthM-player.bat.lengthM)>1e-9||reference.sweetSpotT!==player.bat.sweetSpotT)
    throw new Error('参考バットの長さ・芯と選手の用具が一致しません');
  if(referenceInput.startTick<player.capability.motorLatencyTicks)throw new Error('参考スイング始動が選手の反応時間より早すぎます');
  if(reference.maximumSweetSpotSpeedMps>player.capability.maximumSweetSpotSpeedMps*(1+1e-10))
    throw new Error('参考軌道の実速度が選手の身体上限を超えます');
  const frames=referenceInput.frames, refEnd=referenceInput.startTick
    +(frames[frames.length-1].tick-frames[0].tick)/referenceInput.sourceTicksPerSecond/referenceInput.playbackRate*p;
  if(refEnd>20*p)throw new Error('reference experiment clip exceeds twenty seconds');
  const sourceValues=exportWorkbenchPlayerSources(player),equipment=sourceValues.equipment;
  const {initial,parameters,flightEnd}=createWorkbenchPitchTrajectory(input.pitch);
  const trajectory = {start:initial,endTick:flightEnd,parameters};
  const swing = createRigidBatSwingWindowFromSampledV1(referenceInput,equipment.batPhysical,{startTick:initial.tick,endTick:flightEnd});
  const outcome = resolveAerodynamicRigidBatSwing({trajectory,swing,ball:equipment.ball,
    parameterResolver:k=>resolveWoodBatSpeedResponse(NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,k.normalApproachSpeedMps)});
  const contact = outcome.kind==='contact'?outcome.contact:null, end = contact?.tick??flightEnd;
  let ball=initial,orientation=IDENTITY_QUATERNION;
  const pitchFrames:Readonly<{tick:number;position:Vec3;spin:Vec3;orientation:typeof IDENTITY_QUATERNION}>[]=[];
  pitchFrames.push({tick:ball.tick,position:ball.position,spin:ball.spin,orientation});
  while(ball.tick<end){
    const step=Math.min(1_000,end-ball.tick),next=advanceAerodynamicPitchState(ball,step,parameters);
    orientation=advanceBaseballOrientation(orientation,scale(add(ball.spin,next.spin),.5),step/p);ball=next;
    if(ball.tick%8_000===0||ball.tick===end)pitchFrames.push({tick:ball.tick,position:ball.position,spin:ball.spin,orientation});
  }
  const batEnd=Math.ceil(Math.max(flightEnd,refEnd)),batTicks=new Set<number>([0,batEnd]);
  for(let tick=0;tick<=batEnd;tick+=4_000)batTicks.add(tick);
  if(contact)batTicks.add(contact.tick);
  const batFrames=[...batTicks].sort((a,b)=>a-b).map(tick=>{const f=reference.sample(tick);
    return {tick,...f.state.pose,orientation:f.orientation,sweetSpot:f.sweetSpot,sweetSpotVelocity:f.sweetSpotVelocity,body:null};});
  let flightFrames:readonly FreeBaseballSample[]=[],firstLanding:Vec3|null=null;
  if(contact){const free=createFreeBaseballTrajectory({initialBall:{tick:contact.tick,position:contact.ballCenter,
    velocity:contact.exitVelocity,spin:contact.exitSpin},throughTick:contact.tick+Math.round(duration*p),aerodynamics:parameters,
    ground:{radiusM:equipment.ball.radiusM,inertiaRatio:equipment.ball.rotationalInertiaFactor,gravityMps2:9.81,ticksPerSecond:p,
      restingVerticalSpeedMps:.15,material:{restitution:.4,slidingFriction:.3,rollingDecelerationMps2:.8,normalSpinDecayPerSecond:.5}},orientationAtStart:orientation});
    flightFrames=free.observe(Array.from({length:Math.floor(duration*100)+1},(_,i)=>contact!.tick+i*10_000));
    firstLanding=free.groundContacts[0]?.incoming.position??null;}
  const horizontal=contact?Math.hypot(contact.exitVelocity.x,contact.exitVelocity.z):0;
  const exitSpeed=contact?norm(contact.exitVelocity):null,exitSpin=contact?norm(contact.exitSpin):null;
  const perpendicularSpin=contact&&exitSpeed?norm(cross(contact.exitSpin,scale(contact.exitVelocity,1/exitSpeed))):0;
  return {authority:'CORE_REFERENCE_BAT_RESEARCH' as const,nativeAdmission:false as const,officialResult:null,
    player,sourceValues,bodyConstraintsApplied:false as const,referenceProvenance:reference.provenance,
    trajectoryAuthority:{beforeContact:'SAMPLED_REFERENCE_KINEMATICS',afterContact:'PRESCRIBED_REFERENCE_REPLAY_RECOIL_NOT_COUPLED'} as const,
    numericalResolution:{contactClockTicks:1,renderStepTicks:4_000,referenceInterpolation:'LINEAR_GRIP_SHORTEST_SO3'},
    batFrames,pitchFrames,flightFrames,contact,
    diagnostics:['参考バットのみの研究試験。身体到達範囲・判断・予測・位置誤差は未適用、反応時間と実速度上限・用具は検証',
      '投球・衝突・打球の飛翔/地上物理は共通Core。衝突後のバットは参考軌道を継続し反動は身体に連成していません',
      '実測キー間は線形/SO(3)補間。軸回り回転は未計測です。正式Nativeモデル・公式裁定の受入証拠にはできません'],
    metrics:{batSpeedMps:reference.maximumSweetSpotSpeedMps,exitSpeedMps:exitSpeed,
      launchAngleDeg:contact?Math.atan2(contact.exitVelocity.y,horizontal)*180/Math.PI:null,
      spinRpm:exitSpin===null?null:exitSpin*60/(2*Math.PI),spinEfficiency:exitSpin?perpendicularSpin/exitSpin:null,
      carryM:contact&&firstLanding?Math.hypot(firstLanding.x-contact.ballCenter.x,firstLanding.z-contact.ballCenter.z):null}};
};

import type { Vec3 } from '../../model/geometry';
import { planLiveThrowActionV103,LIVE_THROW_EFFORT_POLICY_V103,type LiveThrowActionInputV103 } from './LiveThrowActionV103';
import { createLiveBodyHandPreparationV105,liveFielderPreparationPostureSecondsV105,type LiveFielderBodyModelV105,type LiveFielderBodyPoseV105 } from './LiveFielderBodyGeometryV105';
/** Provisional technique policy, independent of public/league-relative grades.
 * Skill enables a motor option; it never changes authored SI or grants custody. */
export type LiveGloveTossCapabilityV110=Readonly<{capacityMps:number;buildSeconds:number}>;
export function resolveLiveGloveTossCapabilityV110(p:Readonly<{reactionSeconds:number;decisionSeconds:number;
 advancedFielding:number;gloveSpeedMps:number;throwSpeedMps:number}>):LiveGloveTossCapabilityV110|undefined{
 if(!Object.values(p).every(Number.isFinite)||p.reactionSeconds<0||p.decisionSeconds<0||p.advancedFielding<0||p.advancedFielding>2
  ||p.gloveSpeedMps<=0||p.throwSpeedMps<=0)throw Error('invalid glove toss internal capability');
 if(p.advancedFielding===0&&p.reactionSeconds+p.decisionSeconds>.25)return undefined;
 return Object.freeze({capacityMps:Math.min(p.gloveSpeedMps,p.throwSpeedMps),buildSeconds:.1/(1+p.advancedFielding)});
}
export type LiveTransferActorV110=Readonly<{position:Vec3;velocity:Vec3;glovePosition:Vec3;gloveVelocity:Vec3;
 gloveSpeedMps:number;gloveReachMeters:number;bodyModelV105?:LiveFielderBodyModelV105;bodyPoseV105?:Pick<LiveFielderBodyPoseV105,'crouchMeters'|'forward'>;
 gloveTossV110?:LiveGloveTossCapabilityV110}>;
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export function liveGloveTossOffsetV110(actor:Pick<LiveTransferActorV110,'position'|'bodyModelV105'>,target:Vec3):Vec3{
 const d=sub(target,actor.position),h=Math.hypot(d.x,d.z),m=actor.bodyModelV105,r=m?.armReachMeters??.8;
 return {x:h?d.x/h*r*.35:0,y:m?m.shoulderHeightMeters-m.hipHeightMeters-r*.25:0,z:h?d.z/h*r*.35:-r*.35};
}
/** Two bounded command hypotheses at most. A glove flick uses its own hand
 * motor cap/preparation, with no ball-to-throwing-hand transfer. Both commands
 * still require actual hand preparation, body reach, receiver and release. */
export function planLiveTransferActionV110(normal:LiveThrowActionInputV103,actor?:LiveTransferActorV110,maximumVariantSolves=2,normalPreparationAvailable=true,compareReadyReceiverTossV118=false){
 const hand=normalPreparationAvailable?planLiveThrowActionV103(normal):{kind:'unreachable' as const,reason:'NORMAL_HAND_PREPARATION_UNAVAILABLE_V110' as const,
  capacityMps:normal.capacityMps,outputSearchLimitApplied:normal.capacityMps>LIVE_THROW_EFFORT_POLICY_V103.maximumCommandSpeedMps},tagHand=(solves:number)=>({...hand,releaseStyleV110:'hand_throw' as const,
  releasePositionV110:normal.releasePosition,spinV110:normal.spin,transferVariantSolvesV110:solves,
  fullChargeSecondsV110:normal.throwEffortBuildSecondsV103??LIVE_THROW_EFFORT_POLICY_V103.defaultBuildSeconds}),
  capability=actor?.gloveTossV110;
 // Individual decisions compare both physical commands even when the receiver
 // is already ready. A long transfer can make a short glove feed earlier;
 // readiness alone must not force the slower full-power hand command.
 if(!actor||!capability||maximumVariantSolves<2||!compareReadyReceiverTossV118&&normal.preferStrongestFeasibleV103&&!(normal.receiverReadySeconds!>0))return tagHand(1);
 const offset=liveGloveTossOffsetV110(actor,normal.target),release=add(actor.position,offset),d=sub(normal.target,release),g=Math.abs(normal.physics.air.gravityY),
  capacity=Math.min(capability.capacityMps,normal.capacityMps,actor.gloveSpeedMps),
  maximumVacuumRange=capacity/g*Math.sqrt(Math.max(0,capacity*capacity+2*g*(release.y-normal.target.y)));
 if(Math.hypot(d.x,d.z)>maximumVacuumRange)return tagHand(1);
 const preparation=createLiveBodyHandPreparationV105({fromElapsedSeconds:0,
  initialOffset:add(sub(actor.glovePosition,actor.position),{x:0,y:actor.bodyPoseV105?.crouchMeters??0,z:0}),
  initialRelativeVelocity:sub(actor.gloveVelocity,actor.velocity),targetOffset:offset,
  maximumRelativeSpeedMps:actor.gloveSpeedMps,maximumReachMeters:actor.gloveReachMeters},actor.bodyModelV105);
 if(preparation.kind!=='planned')return tagHand(1);
 const posture=actor.bodyModelV105?liveFielderPreparationPostureSecondsV105(actor.bodyModelV105,actor.bodyPoseV105,actor.position,normal.target):0,
  tossInput={...normal,releasePosition:release,capacityMps:capacity,spin:{x:0,y:0,z:0},remainingTransferSeconds:0,
   handPreparationSeconds:posture+preparation.durationSeconds,chargeElapsedSeconds:0,throwEffortBuildSecondsV103:capability.buildSeconds},
  toss=planLiveThrowActionV103(tossInput);
 if(toss.kind!=='planned')return tagHand(2);
 const projectedRelease=(a:Extract<ReturnType<typeof planLiveThrowActionV103>,{kind:'planned'}>)=>
  a.releaseDelaySeconds+Math.max(0,(normal.receiverReadySeconds??0)-a.releaseDelaySeconds-a.flightSeconds);
 if(hand.kind==='planned'&&(hand.meetsDeadline&&!toss.meetsDeadline||toss.controlSeconds>hand.controlSeconds+.025
  ||projectedRelease(toss)>=projectedRelease(hand)-.001))return tagHand(2);
 return {...toss,selectionReason:'GLOVE_TOSS_EARLY_RELEASE' as const,releaseStyleV110:'glove_toss' as const,
  releasePositionV110:release,spinV110:tossInput.spin,transferVariantSolvesV110:2,fullChargeSecondsV110:capability.buildSeconds};
}

import type { Vec3 } from '../../model/geometry';
import type { LiveFielderBodyModelV105 } from './LiveFielderBodyGeometryV105';

/** Opt-in defense policy. Omission keeps the old alignment and motion exact. */
export type LiveFieldRangePolicyV1=Readonly<{version:'live_field_range_policy_v1';sourceId:string}>;
export const LIVE_FIELD_RANGE_POLICY_V1:LiveFieldRangePolicyV1=Object.freeze({version:'live_field_range_policy_v1',sourceId:'field-range-v1-authored'});
/** Same for every fielder, so it can never be a per-player or per-trait correction.
 * readyAccelerationScale: a fielder breaks from a set ready position, not a standing start.
 * The shared speed bands then cover ten yards in about 1.7 seconds, a usual big-league split, instead of 2.1.
 * lowBallArmScale: a stride and a leaned torso reach a low ball further than a straight arm.
 * Standing-height reach barely changes because the arm is measured from the crouched shoulder. */
export const LIVE_FIELD_RANGE_CALIBRATION_V1=Object.freeze({readyAccelerationScale:1.7,/** Outfielders read the ball standing, with a drop step to come, so they keep less of it. */readOutfieldAccelerationScale:1.1,lowBallArmScale:1.18,lowBallCrouchFraction:.45,
  /** Glove to release near .75 seconds, the quick exchange of an infielder set to throw, from about 1.0. */throwBuildScale:.6,
  /** A runner breaks from a lead or the box, not from rest: same bands, home to first near 4.4 seconds. */runnerAccelerationScale:1.4,
  /** Nobody dives at a ball that will still be there when he arrives. */diveMinimumBallSpeedMps:14,
  /** A runner tagging up times the catch instead of reacting to it, and a run home is worth a close race. */tagUpReactionSeconds:.05,tagUpHomeMarginSeconds:0,tagUpBaseMarginSeconds:.2,
  /** The defense forecast is a perfect line to the bag. A long throw home bounces and has to be gathered. */tagUpLongThrowAllowanceSeconds:.5,
  /** A ball in the air has to be read for depth first, so everyone starts later than on a grounder. */airReadSeconds:.3,airBallLaunchDegrees:10,
  /** A foot stretched to the bag, not the body center standing on it. */fielderBagReachMeters:.75,
  /** A receiver with the ball at the bag only has to drop the glove in front of it. */tagSwipeSeconds:.12,
  /** A second fielder only takes a bag from the man assigned to it when he beats him there by this much. */coverOverrideSeconds:.6,
  /** Seconds kept beyond the time a full crouch takes, so the glove is down when the ball arrives. */crouchLeadSeconds:.12,
  /** A ball that cannot be reached on foot keeps him upright, where a dive is still open, until this late. */lateCrouchSeconds:.2});
/** Infield depth and angle from the usual alignment with nobody shifted. The old spot put the
 * corners on the foul lines and left a forty degree gap either side of second base. */
export const LIVE_FIELD_RANGE_PLACEMENTS_V1=Object.freeze({'1B':Object.freeze({x:19.9,z:30.6}),'2B':Object.freeze({x:9.6,z:44}),
  '3B':Object.freeze({x:-19.6,z:31.4}),SS:Object.freeze({x:-8.8,z:44.2})});
/** Who owns a bag, first choice first. The fielder taking the ball drops out of the list.
 * Second goes to the middle infielder away from the ball, as on a real ground ball. */
export function liveFieldCoverOrderV1(base:1|2|3|4,ballX:number):readonly string[]{
  if(base===1)return ['1B','P','2B'];
  if(base===2)return ballX<0?['2B','SS']:['SS','2B'];
  if(base===3)return ['3B','SS','P'];
  return ['C','P'];
}
/** Opt-in. Omission keeps the runner's old read of a ball in flight. */
export type LiveRunnerThrowReadPolicyV1=Readonly<{version:'live_runner_throw_read_policy_v1';sourceId:string}>;
export const LIVE_RUNNER_THROW_READ_POLICY_V1:LiveRunnerThrowReadPolicyV1=Object.freeze({version:'live_runner_throw_read_policy_v1',sourceId:'runner-throw-read-v1-authored'});
/** A runner who watches a throw go to a cutoff counts on that man catching it and throwing on, at a share of his arm. */
export const LIVE_RUNNER_THROW_READ_CALIBRATION_V1=Object.freeze({relayArmShare:.85,relayCatchSeconds:.1,
  /** His read of the defense does not jump on one odd look: he goes by the middle of his last few. */memorySeconds:.3,
  /** The defense forecast is a perfect line. A long throw bounces and has to be gathered, more the further it comes. */longThrowFromMeters:30,longThrowSecondsPerMeter:.008,
  /** Sending a runner home: an even race is enough, and with two out a little less. */homeMarginSeconds:.05,homeMarginTwoOutSeconds:0,
  /** The walking lead a runner has taken by the time the ball is hit, toward the next bag. Nobody holds second. */secondaryLeadMeters:Object.freeze({1:.5,2:1.5,3:.8})});
export function validateLiveRunnerThrowReadPolicyV1(policy:LiveRunnerThrowReadPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_runner_throw_read_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid runner throw read policy');
  return policy;
}
export function validateLiveFieldRangePolicyV1(policy:LiveFieldRangePolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_field_range_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid field range policy');
  return policy;
}
/** Every estimate reads the same spec as the motor, so plans and motion cannot disagree. */
export function liveFieldRangeSpecV1<T extends Readonly<{accelerationMps2:number;defensivePosition?:string;throwEffortBuildSecondsV103?:number;bodyModelV105?:LiveFielderBodyModelV105}>>(spec:T):T{
  const c=LIVE_FIELD_RANGE_CALIBRATION_V1,m=spec.bodyModelV105,outfield=['LF','CF','RF'].includes(spec.defensivePosition??'');
  return {...spec,accelerationMps2:spec.accelerationMps2*(outfield?c.readOutfieldAccelerationScale:c.readyAccelerationScale),
    ...(spec.throwEffortBuildSecondsV103===undefined?{}:{throwEffortBuildSecondsV103:spec.throwEffortBuildSecondsV103*c.throwBuildScale}),
    ...(m?{bodyModelV105:{...m,armReachMeters:m.armReachMeters*c.lowBallArmScale,maximumCrouchMeters:m.heightMeters*c.lowBallCrouchFraction}}:{})};
}
export const liveFieldRunnerRangeSpecV1=<T extends Readonly<{accelerationMps2:number}>>(spec:T):T=>({...spec,accelerationMps2:spec.accelerationMps2*LIVE_FIELD_RANGE_CALIBRATION_V1.runnerAccelerationScale});
export function liveFieldAirReadV1<T extends Readonly<{reactionSeconds:number}>>(spec:T,ballVelocity:Vec3):T{
  const c=LIVE_FIELD_RANGE_CALIBRATION_V1,launch=Math.atan2(ballVelocity.y,Math.hypot(ballVelocity.x,ballVelocity.z))*180/Math.PI;
  return launch>=c.airBallLaunchDegrees?{...spec,reactionSeconds:spec.reactionSeconds+c.airReadSeconds}:spec;
}
/** A fielder stays up and runs until the ball is close enough that the crouch is due. */
export function liveFieldCrouchDueV1(m:LiveFielderBodyModelV105,etaSeconds:number,reachable:boolean){
  const c=LIVE_FIELD_RANGE_CALIBRATION_V1;
  return etaSeconds<=(reachable?m.maximumCrouchMeters/m.postureSpeedMps+c.crouchLeadSeconds:c.lateCrouchSeconds);
}
/** The hand drops to the ball's height first and reaches out along the ground after, instead of
 * pointing straight at a ball still metres away and only sweeping down at the last instant. */
export function liveFieldLowGloveTargetV1(armReachMeters:number,shoulder:Vec3,target:Vec3):Vec3{
  const dy=target.y-shoulder.y,dx=target.x-shoulder.x,dz=target.z-shoulder.z,flat=Math.hypot(dx,dz),arm=armReachMeters*.995;
  if(dy>=0||-dy>=arm||flat===0)return target;
  const scale=Math.min(1,Math.sqrt(arm*arm-dy*dy)/flat);
  return {x:shoulder.x+dx*scale,y:target.y,z:shoulder.z+dz*scale};
}
export const liveFieldPlacementV1=(role:string,fallback:Vec3):Vec3=>{
  const p=(LIVE_FIELD_RANGE_PLACEMENTS_V1 as Record<string,{x:number;z:number}>)[role];
  return p?{x:p.x,y:fallback.y,z:p.z}:fallback;
};

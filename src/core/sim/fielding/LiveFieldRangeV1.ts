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
/** Opt-in. Omission keeps the out with the largest margin, and any double play that passes its timing test. */
export type LiveFieldRunValuePolicyV1=Readonly<{version:'live_field_run_value_policy_v1';sourceId:string}>;
export const LIVE_FIELD_RUN_VALUE_POLICY_V1:LiveFieldRunValuePolicyV1=Object.freeze({version:'live_field_run_value_policy_v1',sourceId:'field-run-value-v1-authored'});
/** The holder takes the out that leaves the batting side the fewest runs to come, each play weighted by his chance of
 * winning its race. spreadSeconds: the scatter of throws, catches and tags around a forecast margin, authored.
 * table: runs to the end of the half by outs and occupied bags (first + 2*second + 4*third). NPB 2015-2017 by DELTA,
 * as cited on ja.wikipedia.org/wiki/Linear_Weights. It is the real league the sim aims at; replace it with the sim's
 * own measurement once the league is calibrated. */
export const LIVE_FIELD_RUN_VALUE_CALIBRATION_V1=Object.freeze({spreadSeconds:.15,table:Object.freeze({sourceId:'npb-2015-2017-delta',values:Object.freeze([
  Object.freeze([.436,.787,1.019,1.378,1.221,1.591,1.849,2.13]),Object.freeze([.239,.483,.667,.884,.873,1.127,1.313,1.506]),Object.freeze([.091,.212,.315,.421,.345,.482,.526,.713])])})});
export function validateLiveFieldRunValuePolicyV1(policy:LiveFieldRunValuePolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_field_run_value_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid field run value policy');
  return policy;
}
/** Opt-in. Omission keeps the fixed cover order (1B, P, 2B for first and so on) and its .6 s override exact. */
export type LiveFieldCoverPolicyV1=Readonly<{version:'live_field_cover_policy_v1';sourceId:string}>;
export const LIVE_FIELD_COVER_POLICY_V1:LiveFieldCoverPolicyV1=Object.freeze({version:'live_field_cover_policy_v1',sourceId:'field-cover-v1-authored'});
/** No position owns a bag. Whoever this fielder sees reaching the ball first is taking it, and of everyone else the bag
 * goes to whoever he sees getting there first. Speed, depth and where each man already is decide it, not his position.
 * tieSeconds: two men this close both start for the bag; the existing duplicate-cover cost sorts them out. */
export const LIVE_FIELD_COVER_CALIBRATION_V1=Object.freeze({tieSeconds:.1,
  /** A second man is still going for the ball when he can take it this soon after the first. Authored. */chaseWindowSeconds:.4});
/** Who goes for the ball and who takes the bag, as one fielder sees it. The first fielder who can take the ball in time sets
 * the moment. Everyone with a shot at it before then (a stab or a dive as it goes by) and everyone who can take it in time
 * within chaseWindowSeconds of that moment is going for the ball. The bag goes to whoever else reaches it first. So the man
 * with nothing better to do covers, whatever his position: on a ball in the hole the shortstop and third baseman go and the
 * second baseman covers; up the middle the nearer man goes and the other covers; to the right side the pitcher covers first.
 * A man the ball has gone past has no shot left and is free to cover. With the ball held nobody chases. Ties go by id. */
export function liveFieldCoverDutyV1(x:Readonly<{holder:string|null;chaseWindowSeconds:number;
  candidates:readonly Readonly<{playerId:string;inTimeSeconds:number|null;shotSeconds:number|null;baseSeconds:number}>[]}>){
  const rest=x.candidates.filter(c=>c.playerId!==x.holder).slice().sort((p,q)=>p.playerId.localeCompare(q.playerId)),
    inTime=rest.filter(c=>c.inTimeSeconds!==null&&Number.isFinite(c.inTimeSeconds)),
    moment=x.holder!==null||!inTime.length?null:Math.min(...inTime.map(c=>c.inTimeSeconds!)),
    chasers=moment===null?[]:rest.filter(c=>c.shotSeconds!==null&&c.shotSeconds<=moment||c.inTimeSeconds!==null&&c.inTimeSeconds<=moment+x.chaseWindowSeconds).map(c=>c.playerId),
    free=rest.filter(c=>!chasers.includes(c.playerId)),
    duty=free.reduce<typeof free[number]|null>((m,c)=>!m||c.baseSeconds<m.baseSeconds?c:m,null);
  return {chasers,duty:duty?.playerId??null,dutySeconds:duty?.baseSeconds??null};
}
export function validateLiveFieldCoverPolicyV1(policy:LiveFieldCoverPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_field_cover_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid field cover policy');
  return policy;
}
/** Opt-in. Omission keeps every leg braking into its bag and the old stop-and-look exact. */
export type LiveRunnerTurnPolicyV1=Readonly<{version:'live_runner_turn_policy_v1';sourceId:string}>;
export const LIVE_RUNNER_TURN_POLICY_V1:LiveRunnerTurnPolicyV1=Object.freeze({version:'live_runner_turn_policy_v1',sourceId:'runner-turn-v1-authored'});
/** Authored. Once the ball is through the infield a runner takes his bag at speed, bent toward the next one,
 * and makes his call where he can still pull up on the bag, instead of braking into it and starting over from rest.
 * ballDepthMeters: from home, beyond the middle infielders' usual depth (about 44 m).
 * lookAheadSeconds: the next look comes this much later, so the last moment to pull up is judged one look ahead.
 * bendRadians: the call is made before the bend around the bag. A smaller arc only lines his heading up.
 * looseBallAllowanceSeconds: added to the perfect-pickup defense forecast while no fielder holds the ball yet.
 * 2026-11-03, same batted balls replayed: .6 and 1.2 sent runners home into throws that a held runner later beat
 * by going on the throw to the infield (runs 16 -> 16 and 15, outs 1 -> 2 and 4 over 31 balls). Kept at 0. */
export const LIVE_RUNNER_TURN_CALIBRATION_V1=Object.freeze({ballDepthMeters:46,lookAheadSeconds:.12,bendRadians:.35,looseBallAllowanceSeconds:0});
export function validateLiveRunnerTurnPolicyV1(policy:LiveRunnerTurnPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_runner_turn_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid runner turn policy');
  return policy;
}
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
export function liveFieldRangeSpecV1<T extends Readonly<{accelerationMps2:number;defensivePosition?:string;throwEffortBuildSecondsV103?:number;bodyModelV105?:LiveFielderBodyModelV105}>>(spec:T,
  /** fieldKinematicsV1: the Statcast-fitted outfield break. Omission keeps the authored one. */kinematics?:LiveFieldKinematicsPolicyV1):T{
  const c=LIVE_FIELD_RANGE_CALIBRATION_V1,m=spec.bodyModelV105,outfield=['LF','CF','RF'].includes(spec.defensivePosition??'');
  return {...spec,accelerationMps2:spec.accelerationMps2*(outfield?kinematics?LIVE_FIELD_KINEMATICS_CALIBRATION_V1.readOutfieldAccelerationScale:c.readOutfieldAccelerationScale:c.readyAccelerationScale),
    ...(spec.throwEffortBuildSecondsV103===undefined?{}:{throwEffortBuildSecondsV103:spec.throwEffortBuildSecondsV103*c.throwBuildScale}),
    ...(m?{bodyModelV105:{...m,armReachMeters:m.armReachMeters*c.lowBallArmScale,maximumCrouchMeters:m.heightMeters*c.lowBallCrouchFraction}}:{})};
}
export const liveFieldRunnerAccelerationScaleV1=(kinematics?:LiveFieldKinematicsPolicyV1)=>kinematics?LIVE_FIELD_KINEMATICS_CALIBRATION_V1.runnerAccelerationScale:LIVE_FIELD_RANGE_CALIBRATION_V1.runnerAccelerationScale;
export const liveFieldRunnerRangeSpecV1=<T extends Readonly<{accelerationMps2:number}>>(spec:T,kinematics?:LiveFieldKinematicsPolicyV1):T=>({...spec,accelerationMps2:spec.accelerationMps2*liveFieldRunnerAccelerationScaleV1(kinematics)});
/** Opt-in, needs fieldRangeV1. Omission keeps the authored outfield break (x1.1) and runner start (x1.4). */
export type LiveFieldKinematicsPolicyV1=Readonly<{version:'live_field_kinematics_policy_v1';sourceId:string}>;
export const LIVE_FIELD_KINEMATICS_POLICY_V1:LiveFieldKinematicsPolicyV1=Object.freeze({version:'live_field_kinematics_policy_v1',sourceId:'field-kinematics-v1-statcast'});
/** Fitted 2026-11-03 to MLB Statcast with the shared speed bands and a 27.3 ft/s top speed (the 2025 mean).
 * runnerAccelerationScale: least squares on the 2025 90 ft running splits (5 ft .55 s ... 90 ft 4.03 s, from first movement),
 * rms .05 s; the first 5 ft stay .09 s slow because the bands start too gently.
 * readOutfieldAccelerationScale: with the .3 s air read kept, 33.9 ft toward the ball 3 s after release (the 2025 mean jump)
 * and 85 ft by 4.75 s with a 1 m reach (the 55% catch-probability band), taking release to contact as .42 s.
 * The read and the scale trade off one for one in these two targets; the read was left as it was. */
export const LIVE_FIELD_KINEMATICS_CALIBRATION_V1=Object.freeze({readOutfieldAccelerationScale:1.3,runnerAccelerationScale:1.54});
export function validateLiveFieldKinematicsPolicyV1(policy:LiveFieldKinematicsPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_field_kinematics_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid field kinematics policy');
  return policy;
}
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

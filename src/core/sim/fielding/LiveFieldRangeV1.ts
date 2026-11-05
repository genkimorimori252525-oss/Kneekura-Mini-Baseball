import type { Vec3 } from '../../model/geometry';
import type { LiveFielderBodyModelV105 } from './LiveFielderBodyGeometryV105';
import type { LivePropulsionShapeV84 } from '../locomotion/LiveLocomotionV84';

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
/** Opt-in. Omission keeps the authored halfway on shallow flies only, and a runner on first holding his bag on a deep ball or a liner. */
export type LiveRunnerSafeLeadPolicyV1=Readonly<{version:'live_runner_safe_lead_policy_v1';sourceId:string}>;
export const LIVE_RUNNER_SAFE_LEAD_POLICY_V1:LiveRunnerSafeLeadPolicyV1=Object.freeze({version:'live_runner_safe_lead_policy_v1',sourceId:'runner-safe-lead-v1'});
/** A runner on first with fewer than two out, on a ball in the air that may be caught, goes as far toward second as he can and
 * still get back before a catch and the throw to first: his reaction, the turn, and the run back against the time to the catch,
 * the catcher's exchange and his throw. Tagging up from first gains little, so on a deep ball or a liner he is that much nearer
 * when it drops. turnSeconds: stopping and turning back, authored.
 * minimumLandingDepthMeters: only balls to the outfield. A shallow ball is caught well before it would land, so the time to the
 * landing overstates the time he has; there the authored halfway still decides (2026-11-04: on all balls the lead doubled
 * runners off on pop-ups, 2 to 7 extra outs over 120 chances). */
export const LIVE_RUNNER_SAFE_LEAD_CALIBRATION_V1=Object.freeze({turnSeconds:.3,maximumShare:.8,minimumLandingDepthMeters:60});
export function validateLiveRunnerSafeLeadPolicyV1(policy:LiveRunnerSafeLeadPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_runner_safe_lead_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid runner safe lead policy');
  return policy;
}
/** Opt-in. Omission readies a receiver's glove for a glove toss as if it came from a throwing hand. */
export type LiveTossReceivePolicyV1=Readonly<{version:'live_toss_receive_policy_v1';sourceId:string}>;
export const LIVE_TOSS_RECEIVE_POLICY_V1:LiveTossReceivePolicyV1=Object.freeze({version:'live_toss_receive_policy_v1',sourceId:'toss-receive-v1-physics'});
/** A receiver waits with his glove on the line the ball will come in along. A throw leaves from the hand, at least a hand's
 * height above the hip; a glove toss leaves from the glove, wherever the glove holds the ball. Readying for a hand throw held
 * the glove 0.3 m over a flick that left from 1.2 m, and a pitcher 1.4 m away let it under (2026-11-04, a shaded MLB grounder). */
export function validateLiveTossReceivePolicyV1(policy:LiveTossReceivePolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_toss_receive_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid toss receive policy');
  return policy;
}
/** Opt-in. Omission crouches for a ball only once it is judged reachable. */
export type LiveFieldAttemptCrouchPolicyV1=Readonly<{version:'live_field_attempt_crouch_policy_v1';sourceId:string}>;
export const LIVE_FIELD_ATTEMPT_CROUCH_POLICY_V1:LiveFieldAttemptCrouchPolicyV1=Object.freeze({version:'live_field_attempt_crouch_policy_v1',sourceId:'attempt-crouch-v1-physics'});
/** A fielder who is going for a close ball gets down for it as early as for a sure one. Reachable needed the crouch to be in
 * time, and the crouch waited for reachable: a shortstop squarely in the path of a 70 mph roller stayed upright, his glove
 * held at 1.3 m, and the ball went between his feet (2026-11-04, a shaded MLB grounder). The glove already treated such an
 * attempt as a ground catch; this lets the body follow it. */
export function validateLiveFieldAttemptCrouchPolicyV1(policy:LiveFieldAttemptCrouchPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_field_attempt_crouch_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid field attempt crouch policy');
  return policy;
}
/** Opt-in, with fieldCoverV1. Omission lets the cover plan send a man to a bag while he is seen going for the ball. */
export type LiveFieldCoverSeenPolicyV1=Readonly<{version:'live_field_cover_seen_policy_v1';sourceId:string}>;
export const LIVE_FIELD_COVER_SEEN_POLICY_V1:LiveFieldCoverSeenPolicyV1=Object.freeze({version:'live_field_cover_seen_policy_v1',sourceId:'cover-seen-v1-plan'});
/** The cover plan does not count on a man it can see going for the ball, himself included, to take a bag: the bag goes to the
 * next man there. On a grounder the second baseman took, every man's plan sent the first baseman to first; he had already gone
 * for the ball, the pitcher was not given the bag, and nobody covered it (2026-11-04). Holding the first baseman to the plan
 * instead kept men off balls that were theirs (MLB grounders .263 to .326), so it is the plan that follows the men. */
export function validateLiveFieldCoverSeenPolicyV1(policy:LiveFieldCoverSeenPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_field_cover_seen_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid field cover seen policy');
  return policy;
}
/** Opt-in. Omission lets a relay route win on ready time and direction risk alone. */
export type LiveRelayStepPolicyV1=Readonly<{version:'live_relay_step_policy_v1';sourceId:string}>;
export const LIVE_RELAY_STEP_POLICY_V1:LiveRelayStepPolicyV1=Object.freeze({version:'live_relay_step_policy_v1',sourceId:'relay-step-v1-control'});
/** Each catch a relay adds must make the throw ready at least one control step (the fielders' own decision step) sooner, or
 * the route with fewer catches is kept: a gain under one step cannot be told from none, and every catch can be dropped. A
 * second baseman fed the first baseman 1.7 m away on the way to a pitcher still running to the bag; both routes waited on the
 * pitcher and were ready at 2.163 s, and the first baseman dropped it (2026-11-05, an MLB grounder). */
export function validateLiveRelayStepPolicyV1(policy:LiveRelayStepPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_relay_step_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid relay step policy');
  return policy;
}
/** Opt-in. Omission holds a runner whenever no fielder is forecast to get the ball. */
export type LiveRunnerLooseBallReadPolicyV1=Readonly<{version:'live_runner_loose_ball_read_policy_v1';sourceId:string}>;
export const LIVE_RUNNER_LOOSE_BALL_READ_POLICY_V1:LiveRunnerLooseBallReadPolicyV1=Object.freeze({version:'live_runner_loose_ball_read_policy_v1',sourceId:'loose-ball-read-v1-observed'});
/** No fielder forecast to get the ball means the ball is loose, not that the race is unknown. The runner takes, from what he
 * last saw, the soonest the defense could have it on the bag: the nearest man running to where the ball was, less the time
 * since, then his exchange and a throw from there. A ball rolling to a fielder would have given that fielder a forecast.
 * A runner on second, ready to go at 2.79 s after a liner fell in the left-field corner, stood until 4.41 s for want of a
 * forecast and stopped at third (2026-11-05, an MLB single). */
export function validateLiveRunnerLooseBallReadPolicyV1(policy:LiveRunnerLooseBallReadPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_runner_loose_ball_read_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid runner loose ball read policy');
  return policy;
}
/** Opt-in. Omission runs the line-drive read from the runner's latest look at the ball. */
export type LiveRunnerLineDriveReadPolicyV1=Readonly<{version:'live_runner_line_drive_read_policy_v1';sourceId:string}>;
export const LIVE_RUNNER_LINE_DRIVE_READ_POLICY_V1:LiveRunnerLineDriveReadPolicyV1=Object.freeze({version:'live_runner_line_drive_read_policy_v1',sourceId:'line-drive-read-v1-first-sight'});
/** A runner freezes on a liner for a short read from when he first saw it in the air, then goes on what he sees. Run from
 * his latest look, the read never ended: that look always trails now by his reaction (.18-.2 s), less than the .25 s read,
 * so he stood until the ball came down even when no fielder could reach it. A runner on second stood 2.4 s on a liner the
 * center fielder got to at 6.1 s, his read of the catch at -1.8 to -4.0 s all the while (2026-11-05, an MLB single). */
export function validateLiveRunnerLineDriveReadPolicyV1(policy:LiveRunnerLineDriveReadPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_runner_line_drive_read_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid runner line drive read policy');
  return policy;
}
/** Opt-in. Omission lets a runner go halfway whenever his read of the catch falls to the halfway band. */
export type LiveRunnerSureCatchHoldPolicyV1=Readonly<{version:'live_runner_sure_catch_hold_policy_v1';sourceId:string}>;
export const LIVE_RUNNER_SURE_CATCH_HOLD_POLICY_V1:LiveRunnerSureCatchHoldPolicyV1=Object.freeze({version:'live_runner_sure_catch_hold_policy_v1',sourceId:'sure-catch-hold-v1'});
/** A runner who has read a sure catch on this flight stays at his bag. His read of the catch is the time the best fielder has
 * to spare before the ball comes down, so with a fielder camped under a pop-up it falls with the hang itself, into the halfway
 * band in the last .8 s of every high fly; he walked off and was doubled off. In 396 replayed MLB balls, 6 of 36 caught balls
 * with a runner on and less than two out ended in a double play, against 54 of 1,627 in MLB 2025 (3 of 329 pop-ups). */
export function validateLiveRunnerSureCatchHoldPolicyV1(policy:LiveRunnerSureCatchHoldPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_runner_sure_catch_hold_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid runner sure catch hold policy');
  return policy;
}
/** Opt-in. Omission keeps every runner, the batter too, waiting until the man on the bag ahead has left it. */
export type LiveForcedRunPolicyV1=Readonly<{version:'live_forced_run_policy_v1';sourceId:string}>;
export const LIVE_FORCED_RUN_POLICY_V1:LiveForcedRunPolicyV1=Object.freeze({version:'live_forced_run_policy_v1',sourceId:'forced-run-v1-rule'});
/** A forced runner may run to a bag that is still taken when the man on it is forced as well: that man has to give it up, so
 * the bag ahead is not a reason to wait. The batter is always forced, so he runs the moment he has hit the ball, whoever is on
 * first. A man who may choose to stay (a liner that can still be caught) still makes his own choice, and nobody passes anybody. */
export function validateLiveForcedRunPolicyV1(policy:LiveForcedRunPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_forced_run_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid forced run policy');
  return policy;
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
/** No position owns a bag or the ball. Each fielder chooses, as he sees it, who goes for the ball and who takes each bag
 * together, by the runs it saves (assignLiveFieldCoverV1). Authored except where noted.
 * spreadSeconds: the scatter around a forecast margin, the same as fieldRunValueV1's race model.
 * chancePool: how many of the best chances at the ball are tried as chasers. coverChoices: how many of the quickest free men per bag.
 * lookAheadSeconds: a man in time for the ball is judged by his best margin on its way, so these later points of its path
 * are tried after the first one he can reach; a ball hit at him gets more certain the longer it comes. */
/* keepRuns: how much more a new plan must save before a fielder drops the one under way. Authored, about the run value
 * of the quarter second a change of mind costs one man in a close race. */
export const LIVE_FIELD_COVER_CALIBRATION_V1=Object.freeze({spreadSeconds:.15,chancePool:4,coverChoices:3,keepRuns:.03,lookAheadSeconds:Object.freeze([.2,.4,.6])});
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
  /** fieldKinematicsV1: the Statcast-fitted outfield break. Omission keeps the authored one. */kinematics?:LiveFieldKinematicsPolicyV1,
  /** outfieldBreakV1: the break refitted to outfielders' own legs. Omission keeps fieldKinematicsV1's. */outfieldBreak?:LiveOutfieldBreakPolicyV1):T{
  const c=LIVE_FIELD_RANGE_CALIBRATION_V1,m=spec.bodyModelV105,outfield=['LF','CF','RF'].includes(spec.defensivePosition??'');
  return {...spec,accelerationMps2:spec.accelerationMps2*(outfield?kinematics?outfieldBreak?LIVE_OUTFIELD_BREAK_CALIBRATION_V1.readOutfieldAccelerationScale:LIVE_FIELD_KINEMATICS_CALIBRATION_V1.readOutfieldAccelerationScale:c.readOutfieldAccelerationScale:c.readyAccelerationScale),
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
/** Opt-in, needs fieldRangeV1 and fieldKinematicsV1. Omission keeps the authored speed bands (25%/65% of top speed at 1/.7/.35). */
export type LiveLocomotionStartPolicyV1=Readonly<{version:'live_locomotion_start_policy_v1';sourceId:string}>;
export const LIVE_LOCOMOTION_START_POLICY_V1:LiveLocomotionStartPolicyV1=Object.freeze({version:'live_locomotion_start_policy_v1',sourceId:'locomotion-start-v1-statcast'});
/** The shape of the first steps, the same for every runner and fielder. Fitted 2026-11-03 to the 2025 Statcast 90 ft running
 * splits (430 regulars, 5 ft .55 s, 10 ft .87, 30 ft 1.80, 90 ft 4.03, from first movement) with a 27.4 ft/s top speed and the
 * fieldKinematicsV1 runner scale (1.54) left as it is, so braking and turning, which are read from the same ability, do not
 * change. The authored bands leave the first 5 ft at .64 s; these reach .55 s and hold the rest (rms .006 s over 18 splits).
 * Each position's mean splits fit the same shape within .009 s, with only the scale moving (catchers .96 to center fielders 1.04).
 * Under it the infield ten yards (1.75 s at the ready scale) and the outfield jump (34.5 ft in 3 s) stay as they were;
 * a fielder is only quicker over his first metre or so (1.04 m to 1.39 m in the first half second at the ready scale). */
export const LIVE_LOCOMOTION_START_CALIBRATION_V1=Object.freeze({shape:Object.freeze({through:Object.freeze([.45,.75,1] as const),share:Object.freeze([1.393,.348,.209] as const)}) as LivePropulsionShapeV84});
export function validateLiveLocomotionStartPolicyV1(policy:LiveLocomotionStartPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_locomotion_start_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid locomotion start policy');
  return policy;
}
/** Opt-in, needs fieldKinematicsV1. Omission keeps its outfield break scale (1.3). */
export type LiveOutfieldBreakPolicyV1=Readonly<{version:'live_outfield_break_policy_v1';sourceId:string}>;
export const LIVE_OUTFIELD_BREAK_POLICY_V1:LiveOutfieldBreakPolicyV1=Object.freeze({version:'live_outfield_break_policy_v1',sourceId:'outfield-break-v1-statcast'});
/** fieldKinematicsV1 fitted the outfield break to the 2025 mean jump (33.9 ft in 3 s) with every fielder at the league mean
 * sprint, 27.3 ft/s. Outfielders run faster than that (left 27.8, center 28.7, right 27.8 ft/s, and a quicker start), so on
 * their own legs the same scale gives them 35.3-36.2 ft. Refitted 2026-11-04 to those legs and the starting shape of
 * locomotionStartV1: 34.1 ft in 3 s and 84 ft by 4.75 s with the reach, against 33.9 and 85. */
export const LIVE_OUTFIELD_BREAK_CALIBRATION_V1=Object.freeze({readOutfieldAccelerationScale:1.18});
export function validateLiveOutfieldBreakPolicyV1(policy:LiveOutfieldBreakPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_outfield_break_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid outfield break policy');
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
/** Opt-in, needs fieldRangeV1. Omission keeps the authored spots (the infield above, the old outfield). */
export type LiveFieldAlignmentPolicyV1=Readonly<{version:'live_field_alignment_policy_v1';sourceId:string}>;
export const LIVE_FIELD_ALIGNMENT_POLICY_V1:LiveFieldAlignmentPolicyV1=Object.freeze({version:'live_field_alignment_policy_v1',sourceId:'field-alignment-v1-statcast-2025'});
/** Where the league's fielders start, 2025 Statcast (Savant position_data, every fielder with 100 or more pitches at the
 * position, weighted by pitches), in metres from home with +x toward first. The infield already sat within a metre of these.
 * The authored outfield stood 7 m shallow in center and 4 degrees toward the lines in the corners. One spot for every batter
 * and every park; a placement that answers the batter and the park is the next step. */
export const LIVE_FIELD_ALIGNMENT_V1=Object.freeze({'1B':Object.freeze({x:19.3,z:27.8}),'2B':Object.freeze({x:9.5,z:44}),'3B':Object.freeze({x:-19.1,z:31.1}),
  SS:Object.freeze({x:-9.3,z:43.9}),LF:Object.freeze({x:-41.3,z:80.7}),CF:Object.freeze({x:.3,z:98.1}),RF:Object.freeze({x:41.2,z:79.9})});
export function validateLiveFieldAlignmentPolicyV1(policy:LiveFieldAlignmentPolicyV1){
  if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join('|')!=='sourceId|version'||policy.version!=='live_field_alignment_policy_v1'
    ||typeof policy.sourceId!=='string'||!policy.sourceId)throw Error('invalid field alignment policy');
  return policy;
}
export const liveFieldPlacementV1=(role:string,fallback:Vec3,alignment?:LiveFieldAlignmentPolicyV1):Vec3=>{
  const p=((alignment?LIVE_FIELD_ALIGNMENT_V1:LIVE_FIELD_RANGE_PLACEMENTS_V1) as Record<string,{x:number;z:number}>)[role];
  return p?{x:p.x,y:fallback.y,z:p.z}:fallback;
};

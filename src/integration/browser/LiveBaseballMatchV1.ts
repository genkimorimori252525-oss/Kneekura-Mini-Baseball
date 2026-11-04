import {validateBatterTechniquePolicyV1,type BatterTechniquePolicyV1} from '../../core/decision/batting/BatterContactTechniqueV1';
import {resolveLiveContactFrameMotorPracticeV244} from './LiveContactFrameMotorV244';
import {lateCutBodiesV1} from '../../experimental/robin/playability/late-cut-bodies-v1';
import {simulateRobinBridgeV1} from '../../experimental/robin/bridge/match-legacy-rng-seam';
import {resolveLoosePitchContinuationV2} from './LoosePitchContinuationV2';
import {decideIntentionalWalkV1,decidePickoffV1,decideStealV1,leadMetersV1,LIVE_CATCHER_THROW_CALIBRATION_V1,pitchHitsBatterV1,leadPositionV1,resolvePickoffV1,resolveStealV1,runnerLeadMetersV1,settleBattedBallV1,type LiveCatcherThrowPolicyV1,type LiveStealRacePolicyV1,type LiveHitByPitchPolicyV1,type LiveRunnerLeadPolicyV1} from './LiveBaseRunningV1';
import {validateLiveFieldThrowPolicyV1,type LiveFieldThrowPolicyV1} from '../../core/sim/fielding/LiveCloseThrowV1';
import {liveFieldPlacementV1,validateLiveFieldRangePolicyV1,validateLiveRunnerThrowReadPolicyV1,validateLiveRunnerTurnPolicyV1,validateLiveFieldCoverPolicyV1,validateLiveFieldRunValuePolicyV1,validateLiveFieldKinematicsPolicyV1,validateLiveLocomotionStartPolicyV1,type LiveLocomotionStartPolicyV1,validateLiveFieldAlignmentPolicyV1,type LiveFieldAlignmentPolicyV1,validateLiveOutfieldBreakPolicyV1,type LiveOutfieldBreakPolicyV1,validateLiveForcedRunPolicyV1,type LiveForcedRunPolicyV1,validateLiveTossReceivePolicyV1,type LiveTossReceivePolicyV1,validateLiveFieldAttemptCrouchPolicyV1,type LiveFieldAttemptCrouchPolicyV1,validateLiveFieldCoverSeenPolicyV1,type LiveFieldCoverSeenPolicyV1,validateLiveRelayStepPolicyV1,type LiveRelayStepPolicyV1,validateLiveRunnerSafeLeadPolicyV1,type LiveRunnerSafeLeadPolicyV1,type LiveFieldCoverPolicyV1,type LiveFieldRunValuePolicyV1,type LiveFieldKinematicsPolicyV1,type LiveFieldRangePolicyV1,type LiveRunnerThrowReadPolicyV1,type LiveRunnerTurnPolicyV1} from '../../core/sim/fielding/LiveFieldRangeV1';
import {commandFor} from './LivePracticeCommandV273';
import {declareSpinPracticeEpisodesV242,deriveSpinEpisodeConfigurationV242,type LiveSpinEpisodePlanV242} from './LiveSpinPracticeEpisodesV242';
import {resolveLiveRobustContactFrameMotorPracticeV248} from './LiveRobustContactFrameMotorV248';
import type {LiveBattingPracticeRequestV150} from './LiveBattingPracticeV150';
import {createSealedPracticeOwnerV256,readSealedPracticeSnapshotV256} from './LiveSealedPracticeOpportunityV256';
import {lateEvidenceHeadroomV121} from '../../core/decision/batting/BatterApproachPolicyV121';
import {resolveLivePlateVisionV1} from './LivePhysicalRosterV1';
import {encodeLiveSpinPracticeProofV239,hashLiveSpinPracticeProofV239} from './LiveSpinPracticeProofV239';
import {forecastObservedPitchV246,type ObservedPitchForecastPolicyV246} from '../../core/decision/batting/ObservedPitchForecastV246';
import {parsePracticeSwingDecisionV241} from './PracticeSwingDecisionV241';
import { liveFielderBodyControlBoundsV105, resolveLiveFielderBodyModelV105, type LiveFielderBodyPoseV105 } from '../../core/sim/fielding/LiveFielderBodyGeometryV105';
import { BASEBALL_SURFACES_V101 } from '../../core/sim/ball/BaseballSurfaceCalibrationV101';
import {createLiveEmotionTrackerV1,type LiveEmotionOutcomeV1,type LiveEmotionPolicyV1} from './LiveEmotionV1';
import {liveAthleticControlBoundsV115,validateLiveAthleticControlsV115} from '../../core/sim/LiveAthleticControlsV115';
import { LIVE_THROW_EFFORT_POLICY_V103 } from '../../core/sim/fielding/LiveThrowActionV103';
import type { BaseballGroundMaterial } from '../../core/sim/ball/BaseballGroundDynamics';
import { liveEmotionResponseFromTraitsV1, resolveLiveBatterSituationV1, resolveLivePitcherSituationV1, resolveLiveTechnicalTraitsV75, type LiveTraitPhysicalFieldsV1 } from './LiveTraitProfilesV1';
import { resolveLiveExecutionPhysicalV77 } from './LiveTraitRuntimeV77';
import { validatePitchRepertoireV77, validatePitchingMotionV77 } from './LivePitchAuthoringV77';
import { validatePitchRepertoireV78 } from './LivePitchAuthoringV78';
import { classifyBatterCourseV79, validateBatterCourseProfileV79 } from './BatterCourseProfileV79';
import {validateBatterCourseProfileV87} from './BatterCourseProfileV87';
import {validateZoneRecognitionV87} from './ZoneRecognitionV87';
import { cloneValidatedMeasuredCatalogV81 } from './MeasuredClipValidationCacheV81';
import { liveSpinRepertoireClipsV124 } from './LiveSpinControlV123';
import { buildLiveFieldPlayInputV95 } from './LiveFieldInputV95';
import { convertLiveFieldFramesV98 } from './LiveFieldFrameConversionV98';
import {scoreLivePlayV100} from './LiveScoringEvidenceV100';
import type {LocalScoringV100} from './LiveMatchScoringV100';
import type {BattingDirectionRequestV149} from '../../core/decision/batting/BattingDirectionRequestV149';
import {deriveLivePlayRandomnessV152,validateLiveRandomnessV152,type LiveRandomnessV152} from '../../core/rng/LiveRandomStreamsV152';
import type {LiveFieldPlayInputV1} from '../../core/sim/fielding/LiveFieldPlayV1';
import {createSourceFreePoleSessionV148} from '../../core/sim/ball/SourceFreeBallWorldQuery';
import { resolveLiveBattingSetupV94 } from '../../core/sim/pitching/BattingSetupV94';
import type { Vec3 } from '../../core/model/geometry';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { createAeroGroundBallPhysicsProfile, type AeroGroundBallPhysicsV1 } from '../../core/sim/ball/VersionedBattedBallPhysics';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import { IDENTITY_QUATERNION, type Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import { simulateLiveFieldPlayV1, deriveLiveFieldFenceGeometryV1 } from '../../core/sim/fielding/LiveFieldPlayV1';
import type { LiveDefensiveOpportunityV1 } from '../../core/sim/fielding/LiveDefensiveOpportunityV1';
import { reducePlayableMatchV1, type PlayableMatchRuleResultV1 } from './PlayableMatchRulesV1';
import { simulateLivePitchV1, takeYawDecisionEvidenceV274, type LiveMeasuredClipV1, type LivePitchInputV1, type LiveNeutralReactivePolicyV272 } from './LivePitchV1';
import type { LivePhysicalAbilityControlsV1 } from './LivePhysicalRosterV1';
import type {SwingInstructionV121} from '../../core/decision/batting/BatterApproachPolicyV121';
import type {LiveManagerCommunicationSourceV122} from './LiveManagerCommunicationV122';
import {createLiveMatchWorkloadOwnerV122,type LiveMatchWorkloadConfigV122,type LiveMatchWorkloadContinuationV122} from './LiveMatchWorkloadOwnerV122';
import {freezeBatterBeliefV122,assimilateBatterEvidenceV122,validateBatterEvidenceV122,type BatterBeliefV122,type BatterEvidenceV122} from '../../core/decision/batting/BatterIntentV122';
import {appendBatterObservedEvidenceV151,createBatterObservedEvidenceV151,createEmptyBatterObservedMemoryV151,
  validateBatterObservedMemoryV151,type BatterObservedMemoryV151} from '../../core/decision/batting/BatterObservedMemoryV151';
import {validateLiveBatterObservationPolicyV151,type LiveBatterObservationPolicyV151} from './LiveBatterObservationV151';
import {createRegionSnapshotV222,validateRegionEvidenceV222,validateObservedRegionPolicyV222,type BatterObservedRegionExperiencePolicyV222,type BatterObservedRegionEvidenceV222} from '../../core/decision/batting/BatterObservedRegionExperienceV222';
import {validateObservedDirectionMotorV153,type ObservedDirectionMotorPolicyV153} from './LiveDirectionMotorV153';
import {validateObservedReactiveDirectionGroupPolicyV251,type ObservedReactiveDirectionGroupPolicyV251} from '../../core/sim/contact/ObservedDirectionRegistrationV153';
import { resolveLiveTraitPreferencesV54, validateLiveTraitProfileV1, type LiveTraitProfileV1 } from './LiveTraitProfilesV1';
import { validateImpactTrajectorySettingsV1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';

export type LivePositionV1 = 'P'|'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF';
export type LivePlayerPhysicalV1 = LivePhysicalAbilityControlsV1 & Readonly<{
  basis:'EXPLICIT_AUTHORED_SI_V1'; batLengthM:number;batMassKg:number;swingRate:number;
  timingStdSeconds:number;aimStdMeters:number;chaseMarginMeters:number;clipId?:string;
  releaseSpeedMps:number;spinRadPerSecond:Vec3;commandStdMeters:number;
  reactionSeconds:number;topSpeedMps:number;accelerationMps2:number;gloveSpeedMps:number;
  gloveReachMeters:number;gloveRadiusMeters:number;retentionCapacityJ:number;captureDissipationPowerW:number;
  transferSeconds:number;transferDelayMaxSecondsV101?:number;throwSpeedMps:number;
}>;
/** Explicit playability calibration, not measured abilities of any named player.
 * League ratings and presentation names never enter these physical parameters. */
export const LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1:LivePlayerPhysicalV1 = Object.freeze({
  basis:'EXPLICIT_AUTHORED_SI_V1',batLengthM:.84,batMassKg:.88,swingRate:1,
  timingStdSeconds:.009,aimStdMeters:.022,chaseMarginMeters:.12,
  releaseSpeedMps:42.5,spinRadPerSecond:Object.freeze({x:-230,y:15,z:10}),commandStdMeters:.11,
  reactionSeconds:.18,topSpeedMps:8,accelerationMps2:5.2,gloveSpeedMps:11,
  gloveReachMeters:1.35,gloveRadiusMeters:.11,retentionCapacityJ:160,captureDissipationPowerW:3000,
  transferSeconds:.46,throwSpeedMps:34,throwEffortBuildSecondsV103:LIVE_THROW_EFFORT_POLICY_V103.defaultBuildSeconds,
});
export type LiveTeamV1 = Readonly<{id:string;name:string;battingOrder:readonly string[];pitcherId:string;defense:Readonly<Record<LivePositionV1,string>>}>;
export type LivePlayerV1 = Readonly<{playerId:string;name:string;heightMeters:number;bats:'R'|'L';throws?:'R'|'L';physical?:LivePlayerPhysicalV1;traitProfile?:LiveTraitProfileV1}>;
export type LiveMatchAutoDirectionPolicyV250=Readonly<{version:'live_match_auto_direction_policy_v250';sourceId:string}>;
export type LiveMatchInputV1 = Readonly<{seed:number;innings?:number;teams:readonly [LiveTeamV1,LiveTeamV1];players:readonly LivePlayerV1[];
  communicationScopeV122?:Readonly<{sessionId:string;matchId:string;managerId:string}>;
  workloadV122?:LiveMatchWorkloadConfigV122;
  batterKnowledgeV122?:readonly BatterBeliefV122[];
  batterObservationV151?:LiveBatterObservationPolicyV151;
  emotionPolicyV1?:LiveEmotionPolicyV1;
  managerTacticsV1?:boolean;
  skipFieldPlayV1?:boolean;
  batterForecastPolicyV246?:ObservedPitchForecastPolicyV246;
  batterObservedRegionExperienceV222?:BatterObservedRegionExperiencePolicyV222;
  batterDirectionMotorV153?:ObservedDirectionMotorPolicyV153;
  batterReactiveDirectionPolicyV251?:ObservedReactiveDirectionGroupPolicyV251;
  batterNeutralReactivePolicyV272?:LiveNeutralReactivePolicyV272|Readonly<{version:'live_neutral_reactive_pair_policy_v273';sourceId:string}>;
  batterAutoDirectionPolicyV250?:LiveMatchAutoDirectionPolicyV250;
  /** Omission keeps the old match exact. Present: batters may pick a contact technique per swing. */
  batterTechniqueV1?:BatterTechniquePolicyV1;
  /** Omission keeps the speed-only lead exact. Present: leads answer the runner, the pitcher and the base. */
  runnerLeadV1?:LiveRunnerLeadPolicyV1;
  /** Omission keeps the instant catcher exchange exact. Present: mitt to release takes human time. */
  catcherThrowV1?:LiveCatcherThrowPolicyV1;
  /** Omission keeps the old steal race exact. Present: a shuffle, a running start, a slide, and a jump and tag that vary. */
  stealRaceV1?:LiveStealRacePolicyV1;
  /** Omission keeps the old square body column exact. Present: a side-on body that gives ground on an inside pitch. */
  hitByPitchV1?:LiveHitByPitchPolicyV1;
  /** Omission keeps positive-margin throws only. Present: close plays are thrown and far holders return the ball. */
  fieldThrowV1?:LiveFieldThrowPolicyV1;
  /** Omission keeps the old alignment and fielder motion exact. Present: real infield depth, a ready first step and low-ball reach. */
  fieldRangeV1?:LiveFieldRangePolicyV1;
  /** Omission keeps the runner's old read. Present: a throw to a cutoff counts as that cutoff's throw on. */
  runnerThrowReadV1?:LiveRunnerThrowReadPolicyV1;
  /** Omission keeps every leg braking into its bag. Present: a runner takes his bag at speed once the ball is through the infield. */
  runnerTurnV1?:LiveRunnerTurnPolicyV1;
  /** Omission keeps the fixed cover order. Present: who goes for the ball and who takes each bag are chosen together by the runs they save. Needs fieldRangeV1. */
  fieldCoverV1?:LiveFieldCoverPolicyV1;
  /** Omission keeps the out with the largest margin. Present: the out that leaves the fewest runs to come, weighted by its chance. */
  fieldRunValueV1?:LiveFieldRunValuePolicyV1;
  /** Omission keeps the authored outfield break and runner start. Present: both fitted to Statcast. Needs fieldRangeV1. */
  fieldKinematicsV1?:LiveFieldKinematicsPolicyV1;
  /** Runners and fielders start on the Statcast-fitted speed bands (first 5 ft .55 s). Omission keeps the authored bands. Needs fieldRangeV1 and fieldKinematicsV1. */
  locomotionStartV1?:LiveLocomotionStartPolicyV1;
  /** Calibration only: the next ball off the bat leaves with this velocity and spin instead, so the defense can be measured on
   * real batted balls apart from the batting. Omission keeps the struck ball. */
  battedBallReplaceV1?:Readonly<{velocity:Vec3;spin:Vec3}>;
  /** Fielders start where the 2025 league's did (Statcast). Omission keeps the authored spots. Needs fieldRangeV1. */
  fieldAlignmentV1?:LiveFieldAlignmentPolicyV1;
  /** The outfield break refitted to outfielders' own legs (34 ft in 3 s on MLB outfield bodies). Needs fieldKinematicsV1. */
  outfieldBreakV1?:LiveOutfieldBreakPolicyV1;
  /** The batter runs at once, and a forced runner does not wait for a forced man ahead to leave his bag. Omission keeps every runner waiting. */
  forcedRunV1?:LiveForcedRunPolicyV1;
  /** A receiver readies his glove for a glove toss at the height it leaves from. Omission readies it for a hand throw. */
  tossReceiveV1?:LiveTossReceivePolicyV1;
  /** A fielder going for a close ball crouches for it as early as for a sure one. Omission waits until it is judged reachable. */
  attemptCrouchV1?:LiveFieldAttemptCrouchPolicyV1;
  /** With fieldCoverV1: the cover plan gives no bag to a man seen going for the ball. Omission counts on him for one. */
  coverSeenV1?:LiveFieldCoverSeenPolicyV1;
  /** Each catch a relay adds must save a control step. Omission picks routes on time and direction risk alone. */
  relayStepV1?:LiveRelayStepPolicyV1;
  /** A runner on first goes as far as he can still get back from on a ball in the air. Omission keeps the authored halfway. */
  runnerSafeLeadV1?:LiveRunnerSafeLeadPolicyV1;
  /** Calibration: the fielders start turned about home toward the batter's pull side by these angles, so the defense meets
   * each side's batted balls where the league stands for them. Omission keeps one alignment for every batter. */
  fieldShadeV1?:Readonly<{infieldPullDegrees:number;outfieldPullDegrees:number;
    /** Against a left-handed batter the first baseman holds near his bag, so the second baseman turns this much further to fill the hole. */secondBaseLeftyExtraDegrees?:number}>;
  /** MATCH roots; per-play overrides are derived with the global pitch ordinal. */
  randomnessV152?:LiveRandomnessV152;
  measuredClips:readonly LiveMeasuredClipV1[];park?:Readonly<{fenceRadiusMeters:number;fenceHeightMeters:number;foulFenceRadiusMeters?:number;fenceShapeV1?:LiveFieldPlayInputV1['field']['fenceShapeV1'];groundMaterialV101?:BaseballGroundMaterial;
    poleEquipmentV148?:LiveFieldPlayInputV1['field']['poleEquipmentV148']}>}>;
export type LiveYawPracticeRequestV255=Readonly<{version:'live_observed_yaw_contact_frame_trial_v255';subjectId:string;technique:'BACKSPIN'|'TOPSPIN'|'HOOK'|'SLICE';clip:Readonly<{id:string;sourceSha256:string;bats:'R'|'L'}>;domain:Readonly<{plateZ:number;coordinateSystem:'LIVE_WORLD_METERS_V1'}>;policy:'FIXED_17_YAW_UNCALIBRATED_V255';thresholds:Readonly<{minimumComponent:number;minimumImprovement:number}>}>;
export type LivePitchCommandV1 = Readonly<{batting:'auto'|'balanced'|'contact'|'power'|'take'|'bunt';pitchType:string;pitchId?:string;location:string;managedTeam:0|1;
  /** Already received/understood instruction; the communication owner supplies soft acceptance. */
  swingInstructionV121?:SwingInstructionV121;
  battingDirectionRequestV149?:BattingDirectionRequestV149;
  observedSpinTrialV236?:LivePitchInputV1['observedSpinTrialV236']|LiveYawPracticeRequestV255;
  spinMotorPracticePolicyV239?:LivePitchInputV1['spinMotorPracticePolicyV239'];
  practiceSwingDecisionV241?:LivePitchInputV1['practiceSwingDecisionV241'];
  /** Explicit PLAY-scoped simulation intervention, not a player's knowledge. */
  randomnessV152?:LiveRandomnessV152;
  managerCommunicationV122?:LiveManagerCommunicationSourceV122;
  batterEvidenceV122?:Readonly<{evidence:BatterEvidenceV122;learningWeight:number}>;
  baserunning?:'conservative'|'balanced'|'aggressive'}>;
export type LiveMatchFrameV1 = Readonly<{tick:number;ball:Readonly<{position:Vec3;velocity:Vec3;spin:Vec3;orientation:Quaternion;visible:boolean}>|null;
  recoveryV115?:Readonly<{kind:'runner_action_recovery'|'athletic_action_recovery';officialEndTick:number;readOnly:true}>;
  bat:Readonly<{grip:Vec3;tip:Vec3;radiusProfile?:unknown}>|null;
  actors:readonly Readonly<{playerId:string;role:LivePositionV1|'batter'|'runner';team:number;position:Vec3;velocity:Vec3;retired?:boolean;bodyPoseV105?:LiveFielderBodyPoseV105;
    athleticV115?:Readonly<{kind:'jump'|'dive'|'feet_slide'|'head_slide';phase:string;fromSeconds?:number;throughSeconds?:number}>}>[];
  batterPlayerId:string;pitcherPlayerId:string;phase:'ready'|'pitch'|'batted'|'throw'|'held'|'bench';
  ballKind:'pitch'|'batted'|'throw';fairKnown:boolean;possessedBy:string|null;fieldObserverPlayerId?:string;homeRunConfirmed?:boolean;
  defensiveOpportunity?:LiveDefensiveOpportunityV1|null}>;
export type LiveLineScoreV1 = Readonly<{inning:number;away:number|null;home:number|null}>;
export type LiveIssuedPitchV1 = Readonly<{
  emotionMarksV1?:readonly Readonly<{playerId:string;emotion:string}>[];
  beforeMatch:CanonicalMatchState;match:CanonicalMatchState;frames:readonly LiveMatchFrameV1[];events:readonly unknown[];
  play:Readonly<{classification:string;call:'ball'|'called_strike'|'swinging_strike'|null;contact:unknown;
    /** Ticks for the observer. Present only with the catcher throw policy, and only when a runner went. */
    stealV1?:Readonly<{runnerId:string;fromBase:'first'|'second';targetBase:'second'|'third';catcherPlayerId:string;receiverPlayerId:string;
      runnerStartTick:number;catchTick:number;throwStartTick:number;throwArrivalTick:number;endTick:number;exchangeSeconds:number;popSeconds:number;safe:boolean}>;
    /** Ticks for the observer. Present only with the runner lead or catcher throw policy, and only on a pickoff throw. */
    pickoffV1?:Readonly<{runnerId:string;pitcherPlayerId:string;receiverPlayerId:string;base:'first';startTick:number;throwStartTick:number;throwArrivalTick:number;endTick:number;leadMeters:number;safe:boolean}>;
    /** Where each runner stood when the pitch was thrown. Present only with the runner lead policy. */
    runnerLeadsV1?:readonly Readonly<{runnerId:string;base:'first'|'second'|'third';meters:number}>[];
    contactMoment:BallWorldMoment|null;contactOrientation:Quaternion|null;outgoingBallMoment:BallWorldMoment|null;
    field:ReturnType<typeof simulateLiveFieldPlayV1>|null;rules:PlayableMatchRuleResultV1;diagnostics:unknown;localScoringV100?:LocalScoringV100}>;
  command:LivePitchCommandV1;
  requiresNextPitch:boolean;finished:boolean;batterPlayerId:string;pitcherPlayerId:string;pitchType:string;pitchId?:string;pitchName?:string;speedKmh:number;
  line:readonly LiveLineScoreV1[];hits:Readonly<{away:number;home:number;pendingAway:number;pendingHome:number}>|null;
  errors:Readonly<{away:number;home:number;pendingAway:number;pendingHome:number}>|null;
}>;
/** Internal Host conversion seam; official rule clocks never read these frames. */
export function buildLivePostPlayFramesV115(input:Readonly<{
  lastFrame:LiveMatchFrameV1;field:ReturnType<typeof simulateLiveFieldPlayV1>|null;
  readyFrame:LiveMatchFrameV1;defense:LiveTeamV1['defense'];battingTeam:0|1;ticksPerSecond:number;officialEndTick:number;
}>):LiveMatchFrameV1[]{
  const frames:LiveMatchFrameV1[]=[],source=input.field?.recoveryFramesV115?.filter(f=>
    f.tick>input.officialEndTick&&f.recoveryV115?.officialEndTick===input.officialEndTick)??[];
  if(input.field&&source.length){
    const converted=convertLiveFieldFramesV98({field:{...input.field,frames:source},readyFrame:input.readyFrame,
      defense:input.defense,battingTeam:input.battingTeam,ticksPerSecond:input.ticksPerSecond,rules:null});
    frames.push(...converted.map((frame,index)=>({...frame,recoveryV115:source[index].recoveryV115!})));
  }
  // Keep the established three seconds of bench walking after physical recovery.
  // Subtracting recovery from that window would silently shorten the walk.
  const last=frames.at(-1)??input.lastFrame,benchSource={...last},benchFromTick=source.length?last.tick:input.officialEndTick,duration=3,step=.055;
  delete benchSource.recoveryV115;
  // The post-play observer used one point for an entire team. Keep the same
  // bench side and walking window, with distinct places along the bench.
  // This is after official closure; it cannot reserve a live defensive base.
  const benchTargets=new Map<string,{x:number;z:number}>();
  for(const team of [0,1]){
    const actors=last.actors.filter(a=>a.team===team).slice().sort((a,b)=>a.position.z-b.position.z||a.position.x-b.position.x);
    actors.forEach((a,index)=>benchTargets.set(a.playerId,{x:team===0?-30:30,z:3+(index-(actors.length-1)/2)*.75}));
  }
  for(let dt=step;dt<=duration+step/2;dt+=step){const seconds=Math.min(dt,duration);
    frames.push({...benchSource,tick:benchFromTick+Math.round(seconds*input.ticksPerSecond),phase:'bench',ball:last.ball?{...last.ball,visible:false}:null,
      actors:last.actors.map(a=>{const target=benchTargets.get(a.playerId)!,dx=target.x-a.position.x,dz=target.z-a.position.z,length=Math.hypot(dx,dz),travel=Math.min(length,seconds*3.2);
        const position={x:a.position.x+dx/(length||1)*travel,y:a.position.y,z:a.position.z+dz/(length||1)*travel},
          velocity={x:travel<length?dx/(length||1)*3.2:0,y:0,z:travel<length?dz/(length||1)*3.2:0},
          offset={x:position.x-a.position.x,y:position.y-a.position.y,z:position.z-a.position.z},
          move=(point:Vec3)=>({x:point.x+offset.x,y:point.y+offset.y,z:point.z+offset.z}),pose=a.bodyPoseV105;
        return{...a,position,velocity,...(pose?{bodyPoseV105:{...pose,foot:move(pose.foot),hip:move(pose.hip),
          shoulder:move(pose.shoulder),head:move(pose.head),eye:move(pose.eye),eyeVelocity:velocity}}:{})};})});
  }
  return frames;
}
const positions:readonly LivePositionV1[]=['P','C','1B','2B','3B','SS','LF','CF','RF'];
const zero=():Vec3=>({x:0,y:0,z:0});
const baseSide=27.432/Math.sqrt(2);
/** Measured on 2025 MLB grounders replayed from the batter's side (2026-11-04): infield 4 degrees, outfield 0, and the second
 * baseman 6 more against a left-handed batter put the left, centre and right grounder hit rates within about 1.5 standard
 * errors of MLB; without it centre was .18 low and the right side .17 high. */
export const LIVE_FIELD_SHADE_CALIBRATION_V1=Object.freeze({infieldPullDegrees:4,outfieldPullDegrees:0,secondBaseLeftyExtraDegrees:6});
/** fieldShadeV1: the middle infielders, the third baseman and the outfielders turned about home toward the pull side, their
 * distance from home kept. The first baseman stays where the bag needs him, and the pitcher and catcher stay. */
function shadedPlacementsV1(base:Readonly<Record<LivePositionV1,Vec3>>,shade:Readonly<{infieldPullDegrees:number;outfieldPullDegrees:number;secondBaseLeftyExtraDegrees?:number}>,bats:'R'|'L'){
  const turn=(p:Vec3,deg:number)=>{const a=(bats==='R'?-deg:deg)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {x:p.x*c+p.z*s,y:p.y,z:-p.x*s+p.z*c};};
  return Object.fromEntries((Object.keys(base) as LivePositionV1[]).map(role=>[role,role==='2B'?turn(base[role],shade.infieldPullDegrees+(bats==='L'?shade.secondBaseLeftyExtraDegrees??0:0)):['3B','SS'].includes(role)?turn(base[role],shade.infieldPullDegrees)
    :['LF','CF','RF'].includes(role)?turn(base[role],shade.outfieldPullDegrees):base[role]])) as Record<LivePositionV1,Vec3>;
}
export const LIVE_MATCH_BASES_V1=Object.freeze({home:Object.freeze(zero()),first:Object.freeze({x:baseSide,y:0,z:baseSide}),
  second:Object.freeze({x:0,y:0,z:baseSide*2}),third:Object.freeze({x:-baseSide,y:0,z:baseSide})});
const placements:Readonly<Record<LivePositionV1,Vec3>>={P:{x:0,y:.9,z:18.44},C:{x:0,y:.85,z:-1.5},'1B':{x:23,y:.9,z:25},
  '2B':{x:13,y:.9,z:36},'3B':{x:-23,y:.9,z:25},SS:{x:-13,y:.9,z:36},LF:{x:-46,y:.9,z:76},CF:{x:0,y:.9,z:91},RF:{x:46,y:.9,z:76}};
/** Rubber top; actor/collider anchors remain independent of mound elevation. */
export const LIVE_MATCH_MOUND_SURFACE_V1=Object.freeze({x:placements.P.x,y:.254,z:placements.P.z});
export const LIVE_MATCH_PHYSICS_V1:AeroGroundBallPhysicsV1=Object.freeze({kind:'aero_ground_v1',
  air:Object.freeze({ticksPerSecond:1_000_000,integrationStepTicks:5000,gravityY:-9.80665,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS}),
  ground:Object.freeze({ticksPerSecond:1_000_000,gravityMps2:9.80665,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.28,
    material:BASEBALL_SURFACES_V101.grass})});
const frozen=<T>(v:T):T=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(frozen);Object.freeze(v);}return v;};
function assert(v:unknown,m:string):asserts v{if(!v)throw new Error('live baseball match: '+m);}
export type LiveBaseballUnresolvedV239=Readonly<{version:'live_baseball_unresolved_v239';phase:'PITCH'|'FIELD'|'RULE';code:'PITCH_NO_CALL'|'FIELD_INCOMPLETE'|'RULE_UNRESOLVED';detail:unknown}>;
const issuedUnresolvedV239=new WeakSet<Error>();
export function isLiveBaseballUnresolvedV239(error:unknown):error is Error&Readonly<{unresolvedV239:LiveBaseballUnresolvedV239}>{return error instanceof Error&&issuedUnresolvedV239.has(error)}
function unresolvedV239(message:string,phase:LiveBaseballUnresolvedV239['phase'],code:LiveBaseballUnresolvedV239['code'],detail:unknown,cause?:unknown):Error {
 const error=cause===undefined?new Error(message):new Error(message,{cause});
 const payload=frozen({version:'live_baseball_unresolved_v239' as const,phase,code,detail:structuredClone(detail)});
 Object.defineProperty(error,'unresolvedV239',{value:payload,enumerable:false,writable:false,configurable:false});issuedUnresolvedV239.add(error);return error;
}

/** A catalog is a bounded collection of independently inert measured clips.
 * Do not relax cloneInert's ordinary 100,000-node input boundary or copy all
 * 673 clips into every pitch. Descriptor reads reject getters before access. */
export function cloneMatchInputWithMeasuredCatalogV68(raw:LiveMatchInputV1):LiveMatchInputV1{
  assert(raw&&typeof raw==='object'&&!Array.isArray(raw)&&(Object.getPrototypeOf(raw)===Object.prototype||Object.getPrototypeOf(raw)===null),'inert match input required');
  const descriptors=Object.getOwnPropertyDescriptors(raw),catalogDescriptor=descriptors.measuredClips,other={};
  assert(catalogDescriptor&&catalogDescriptor.enumerable&&'value' in catalogDescriptor,'inert measured clip catalog required');
  for(const key of Reflect.ownKeys(raw))if(key!=='measuredClips')Object.defineProperty(other,key,Object.getOwnPropertyDescriptor(raw,key)!);
  const rest=cloneInert(other) as Omit<LiveMatchInputV1,'measuredClips'>,catalog=catalogDescriptor.value as unknown[];
  const measuredClips=cloneValidatedMeasuredCatalogV81(catalog);
  return {...rest,measuredClips};
}
export function resolveLiveMatchPlayerPhysicalV98(player:LivePlayerV1):LivePlayerPhysicalV1&LiveTraitPhysicalFieldsV1{
  const source=player.physical??LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
    p={...source,throwEffortBuildSecondsV103:source.throwEffortBuildSecondsV103??LIVE_THROW_EFFORT_POLICY_V103.defaultBuildSeconds};
  assert(p.basis==='EXPLICIT_AUTHORED_SI_V1','unknown player SI basis');
  const nonnegative=['timingStdSeconds','aimStdMeters','chaseMarginMeters','commandStdMeters','reactionSeconds','transferSeconds'] as const;
  const positive=['batLengthM','batMassKg','swingRate','releaseSpeedMps','topSpeedMps','accelerationMps2','gloveSpeedMps','gloveReachMeters',
    'gloveRadiusMeters','retentionCapacityJ','captureDissipationPowerW','throwSpeedMps'] as const;
  assert(nonnegative.every(k=>Number.isFinite(p[k])&&p[k]>=0)&&positive.every(k=>Number.isFinite(p[k])&&p[k]>0)
    &&Object.values(p.spinRadPerSecond).every(Number.isFinite),'invalid explicit player SI');
  assert(p.fieldingReactionScaleV98===undefined||Number.isFinite(p.fieldingReactionScaleV98)&&p.fieldingReactionScaleV98>=0&&p.fieldingReactionScaleV98<=4,
    'invalid fielding reaction scale V98');
  assert(Number.isFinite(p.throwEffortBuildSecondsV103)&&p.throwEffortBuildSecondsV103>=0&&p.throwEffortBuildSecondsV103<=5,
    'invalid throw effort preparation V103');
  assert(p.zoneJudgmentStdMeters===undefined||Number.isFinite(p.zoneJudgmentStdMeters)&&p.zoneJudgmentStdMeters>=0&&p.zoneJudgmentStdMeters<=.6,
    'invalid zone judgment SI');
  assert(p.plateVision===undefined||Number.isFinite(p.plateVision)&&p.plateVision>=1&&p.plateVision<=100,
    'invalid absolute plate vision');
  for(const [key,lo,hi] of [['pitchReleaseHeightMeters',.2,3.2],['pitchReleaseSideMeters',0,1.5],['pitchReleaseExtensionMeters',0,3.5]] as const)
    assert(p[key]===undefined||Number.isFinite(p[key])&&p[key]!>=lo&&p[key]!<=hi,'invalid pitch release SI: '+key);
  assert(p.baserunningSafetyMarginSeconds===undefined||Number.isFinite(p.baserunningSafetyMarginSeconds)&&p.baserunningSafetyMarginSeconds>=0&&p.baserunningSafetyMarginSeconds<=3,
    'invalid baserunning safety margin');
  assert(p.fieldingPursuitCostWeight===undefined||Number.isFinite(p.fieldingPursuitCostWeight)&&p.fieldingPursuitCostWeight>=.25&&p.fieldingPursuitCostWeight<=4,
    'invalid fielding pursuit cost weight');
  assert(p.baserunningTurnRadiusMeters===undefined||Number.isFinite(p.baserunningTurnRadiusMeters)&&p.baserunningTurnRadiusMeters>=.5&&p.baserunningTurnRadiusMeters<=10,
    'invalid baserunning turn radius SI');
  assert(p.baserunningLateralAccelerationMps2===undefined||Number.isFinite(p.baserunningLateralAccelerationMps2)&&p.baserunningLateralAccelerationMps2>=.5&&p.baserunningLateralAccelerationMps2<=20,
    'invalid baserunning lateral acceleration SI');
  resolveLiveFielderBodyModelV105(player.heightMeters,p.gloveReachMeters,Object.fromEntries(Object.keys(liveFielderBodyControlBoundsV105).filter(k=>p[k as keyof typeof liveFielderBodyControlBoundsV105]!==undefined).map(k=>[k,p[k as keyof typeof liveFielderBodyControlBoundsV105]])));
  validateLiveAthleticControlsV115(Object.fromEntries(Object.keys(liveAthleticControlBoundsV115).filter(k=>p[k as keyof typeof liveAthleticControlBoundsV115]!==undefined).map(k=>[k,p[k as keyof typeof liveAthleticControlBoundsV115]])));
  if(p.impactTrajectory!==undefined)validateImpactTrajectorySettingsV1(p.impactTrajectory);
  if(p.pitchRepertoire!==undefined)validatePitchRepertoireV77(p.pitchRepertoire,p.maximumPitchSpeedMps);
  assert(!(p.pitchRepertoire&&p.pitchRepertoireV78),'ambiguous V77 and V78 pitch ownership');
  if(p.pitchRepertoireV78!==undefined)validatePitchRepertoireV78(p.pitchRepertoireV78,p.maximumPitchSpeedMps);
  if(p.batterCourseProfileV79!==undefined)validateBatterCourseProfileV79(p.batterCourseProfileV79);
  if(p.batterCourseProfileV87!==undefined)validateBatterCourseProfileV87(p.batterCourseProfileV87);
  if(p.zoneRecognitionV87!==undefined)validateZoneRecognitionV87(p.zoneRecognitionV87);
  assert(p.minimumSpinRatio===undefined||Number.isFinite(p.minimumSpinRatio)&&p.minimumSpinRatio>=0&&p.minimumSpinRatio<=1,'invalid minimum spin ratio');
  if(p.pitchingMotion!==undefined)validatePitchingMotionV77(p.pitchingMotion);
  if(p.battingSetupV94!==undefined)resolveLiveBattingSetupV94({heightMeters:player.heightMeters,bats:player.bats,...p});
  return resolveLiveExecutionPhysicalV77(p,player.traitProfile);
}

const physical=resolveLiveMatchPlayerPhysicalV98;

/** A browser-neutral local Host. It executes the shared Core rather than
 * consuming a finite recording or delegating results to the former HTML game.
 * This is a separate local match, not authenticated Native SQLite history. */
/** Private, non-persistent continuation for the same configured worker game.
 * History is retained by the observer, never copied on every speculative pitch. */
export type LiveMatchContinuationV116=Readonly<{version:'live_match_continuation_v116';seed:number;innings:number;emotionV1?:unknown;
 match:CanonicalMatchState;pitchCount:number;nextTick:number;finished:boolean;
 hits:Readonly<{away:number;home:number;pendingAway:number;pendingHome:number}>;
 errors:Readonly<{away:number;home:number;pendingAway:number;pendingHome:number}>;
 battingOrderIndices:readonly number[];line:readonly Readonly<{inning:number;away:number|null;home:number|null}>[];
 workloadV122?:LiveMatchWorkloadContinuationV122;
 poleScopeBindingV148?:string;
 batterKnowledgeV122?:Readonly<{initialBinding:string;beliefs:readonly BatterBeliefV122[]}>;
 batterObservedMemoryV151?:Readonly<{policyBinding:string;memories:readonly BatterObservedMemoryV151[]}>;
 batterObservedRegionExperienceV222?:Readonly<{policyBinding:string;entries:readonly BatterObservedRegionEvidenceV222[]}>;
 randomnessBindingV152?:string;directionMotorBindingV153?:string;batterForecastBindingV246?:string;batterAutoDirectionBindingV250?:string;batterReactiveDirectionBindingV251?:string;batterNeutralReactiveBindingV272?:string;batterTechniqueBindingV1?:string}>;
const previewCapabilityV257=Symbol('private yaw practice preview');
const pairCapabilityV273=Symbol('private paired v248 preview');
const yawDiagnosticCapabilityV274=Symbol('private non-adopting paired yaw diagnostic');
const yawDiagnosticCapabilityV275=Symbol('private non-adopting paired pivot yaw diagnostic');
const yawDiagnosticCapabilityV276=Symbol('private non-adopting paired robust yaw diagnostic');
const authorizedYawPitchInputsV274=new WeakSet<object>();
const yawEvidenceByHostV274=new WeakMap<object,NonNullable<ReturnType<typeof takeYawDecisionEvidenceV274>>>();
async function consumeYawEvidenceV274(host:object|undefined){const evidence=host?yawEvidenceByHostV274.get(host):undefined;if(host)yawEvidenceByHostV274.delete(host);if(!evidence)return {status:'UNKNOWN' as const,reason:'DECISION_EVIDENCE_UNAVAILABLE'};return {status:'RECORDED' as const,planningRate:evidence.planningRate,summary:evidence.summary,inputHash:await evidence.inputHash,...(evidence.plannerInputHashV276?{plannerInputHashV276:await evidence.plannerInputHashV276,plannerInputHashScopeV276:'FULL_PLANNER_ARGUMENT_V276' as const}:{})};}
/** Identity check only; registration remains private to the paired Host. */
export function isAuthorizedYawPitchInputV274(raw:unknown):boolean{return raw!==null&&typeof raw==='object'&&authorizedYawPitchInputsV274.has(raw)}
const previewHostsV257=new WeakMap<object,{input:LiveMatchInputV1;host:ReturnType<typeof createLiveBaseballMatchWorkerInternalV257>}>();
const sealedPreviewRegistryV258=new WeakMap<object,Map<string,{contract:string;facade:{preview:()=>Promise<LiveYawPracticePreviewResultV257>}}>>();
const initializationLatchV258=new WeakMap<object,{failed:boolean;failure?:Promise<ReturnType<typeof failedYawOwnerV258>>;contract?:string}>();
const previewControlV258=new WeakMap<object,{state:()=>('NOT_STARTED'|'IN_FLIGHT'|'COMPLETED');evidence:()=>Promise<LiveYawPracticePreviewResultV257>|undefined}>();
export function createLiveBaseballMatchV1(raw:LiveMatchInputV1){
 const host=createLiveBaseballMatchWorkerV116(raw),view=Object.freeze({issuePitch:host.issuePitch,inspect:host.inspect});
 previewHostsV257.set(view,previewHostsV257.get(host)!);return view;
}
export function createLiveBaseballMatchWorkerV116(raw:LiveMatchInputV1,resume?:LiveMatchContinuationV116){if(Object.hasOwn(raw,'experimentalMatchPoliciesV1'))throw Error('HOLD: experimental policy requires experimental facade');return createLiveBaseballMatchWorkerInternalV257(raw,resume,undefined)}
function createLiveBaseballMatchWorkerInternalV257(raw:LiveMatchInputV1,resume:LiveMatchContinuationV116|undefined,capability:typeof previewCapabilityV257|typeof pairCapabilityV273|typeof yawDiagnosticCapabilityV274|typeof yawDiagnosticCapabilityV275|typeof yawDiagnosticCapabilityV276|undefined){
  const input=cloneMatchInputWithMeasuredCatalogV68(raw),innings=input.innings??9,tps=LIVE_MATCH_PHYSICS_V1.air.ticksPerSecond,
    matchPhysicsV101=input.park?.groundMaterialV101 ? createAeroGroundBallPhysicsProfile({...LIVE_MATCH_PHYSICS_V1,ground:{...LIVE_MATCH_PHYSICS_V1.ground,material:input.park.groundMaterialV101}}) : LIVE_MATCH_PHYSICS_V1;
  const observationPolicyV151=input.batterObservationV151===undefined?undefined:validateLiveBatterObservationPolicyV151(input.batterObservationV151);
  assert(input.batterForecastPolicyV246===undefined||observationPolicyV151!==undefined,'V246 forecast requires position-only observation policy');
  const forecastPolicyV246=input.batterForecastPolicyV246===undefined?undefined:forecastObservedPitchV246({originTick:0,ticksPerSecond:tps,cutoffTick:0,planeZ:0,maximumAfterReleaseSeconds:1,observations:[]},input.batterForecastPolicyV246).diagnostics.policy,
    forecastBindingV246=forecastPolicyV246===undefined?undefined:JSON.stringify(forecastPolicyV246,Object.keys(forecastPolicyV246).sort());
  const regionPolicyV222=input.batterObservedRegionExperienceV222===undefined?undefined:validateObservedRegionPolicyV222(input.batterObservedRegionExperienceV222);
  assert(regionPolicyV222===undefined||observationPolicyV151!==undefined,'region experience requires position-only observation policy');
  const directionMotorPolicyV153=input.batterDirectionMotorV153===undefined?undefined:validateObservedDirectionMotorV153(input.batterDirectionMotorV153),
    directionMotorBindingV153=directionMotorPolicyV153===undefined?undefined:JSON.stringify(directionMotorPolicyV153);
  assert(directionMotorPolicyV153===undefined||observationPolicyV151!==undefined,'direction motor requires position-only observation policy');
  const autoDirectionPolicyV250=input.batterAutoDirectionPolicyV250;
  if(autoDirectionPolicyV250!==undefined)assert(autoDirectionPolicyV250&&typeof autoDirectionPolicyV250==='object'&&!Array.isArray(autoDirectionPolicyV250)&&Object.keys(autoDirectionPolicyV250).sort().join('|')==='sourceId|version'&&autoDirectionPolicyV250.version==='live_match_auto_direction_policy_v250'&&typeof autoDirectionPolicyV250.sourceId==='string'&&autoDirectionPolicyV250.sourceId.length>0&&autoDirectionPolicyV250.sourceId.length<=200&&autoDirectionPolicyV250.sourceId.trim()===autoDirectionPolicyV250.sourceId&&observationPolicyV151!==undefined&&directionMotorPolicyV153!==undefined,'invalid match auto direction policy');
  const autoDirectionBindingV250=autoDirectionPolicyV250===undefined?undefined:JSON.stringify({version:autoDirectionPolicyV250.version,sourceId:autoDirectionPolicyV250.sourceId});
  const batterTechniqueV1=input.batterTechniqueV1===undefined?undefined:validateBatterTechniquePolicyV1(input.batterTechniqueV1),batterTechniqueBindingV1=batterTechniqueV1===undefined?undefined:JSON.stringify(batterTechniqueV1);
  assert(batterTechniqueV1===undefined||observationPolicyV151!==undefined&&directionMotorPolicyV153!==undefined,'batter technique requires observation and direction motor');
  const randomnessPolicyV152=input.randomnessV152===undefined?undefined:validateLiveRandomnessV152(input.randomnessV152,'MATCH'),
    randomnessBindingV152=randomnessPolicyV152===undefined?undefined:JSON.stringify(randomnessPolicyV152);
  const reactivePolicyV251=input.batterReactiveDirectionPolicyV251===undefined?undefined:validateObservedReactiveDirectionGroupPolicyV251(input.batterReactiveDirectionPolicyV251),
    reactiveBindingV251=reactivePolicyV251===undefined?undefined:JSON.stringify(reactivePolicyV251);
  assert(reactivePolicyV251===undefined||observationPolicyV151!==undefined&&directionMotorPolicyV153!==undefined&&randomnessPolicyV152!==undefined,'reactive direction policy requires observation, motor and independent randomness');
  const neutralPolicyV272=input.batterNeutralReactivePolicyV272;
  if(neutralPolicyV272!==undefined)assert(neutralPolicyV272!==null&&typeof neutralPolicyV272==='object'&&!Array.isArray(neutralPolicyV272)
    &&Object.keys(neutralPolicyV272).sort().join('|')==='sourceId|version'&&['live_neutral_reactive_policy_v272','live_neutral_reactive_pair_policy_v273'].includes(neutralPolicyV272.version)
    &&typeof neutralPolicyV272.sourceId==='string'&&neutralPolicyV272.sourceId.length>0&&neutralPolicyV272.sourceId.length<=200
    &&neutralPolicyV272.sourceId.trim()===neutralPolicyV272.sourceId,'invalid neutral reactive direction policy');
  assert(neutralPolicyV272===undefined||observationPolicyV151!==undefined&&directionMotorPolicyV153!==undefined&&randomnessPolicyV152!==undefined,'neutral reactive direction policy requires observation, motor and independent randomness');
  assert(!(neutralPolicyV272&&reactivePolicyV251),'neutral and explicit reactive direction policies cannot be combined');
  const neutralBindingV272=neutralPolicyV272===undefined?undefined:JSON.stringify({version:neutralPolicyV272.version,sourceId:neutralPolicyV272.sourceId,seed:input.seed});
  assert(randomnessPolicyV152===undefined||input.seed>=0&&input.seed<=0xffffffff,'randomness match seed must be uint32');
  assert(observationPolicyV151===undefined||observationPolicyV151.ticksPerSecond===tps,'batter observation clock differs from physics');
  assert(Number.isSafeInteger(input.seed)&&Number.isSafeInteger(innings)&&innings>0,'invalid seed/innings');
  assert(input.teams.length===2&&new Set(input.teams.map(t=>t.id)).size===2,'two unique teams required');
  const players=new Map(input.players.map(p=>[p.playerId,p]));
  const communicationScopeV122=input.communicationScopeV122;
  if(communicationScopeV122)assert(Object.keys(communicationScopeV122).sort().join('|')==='managerId|matchId|sessionId'
    &&Object.values(communicationScopeV122).every(s=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=200),'invalid manager communication scope');
  if(communicationScopeV122&&input.workloadV122)assert(communicationScopeV122.sessionId===input.workloadV122.sessionId
    &&communicationScopeV122.matchId===input.workloadV122.matchId&&communicationScopeV122.managerId===input.workloadV122.managerId,'workload and communication scope differ');
  assert(input.runnerLeadV1===undefined||input.runnerLeadV1?.version==='live_runner_lead_policy_v1','invalid runner lead policy');
  assert(input.catcherThrowV1===undefined||input.catcherThrowV1?.version==='live_catcher_throw_policy_v1','invalid catcher throw policy');
  assert(input.stealRaceV1===undefined||input.stealRaceV1?.version==='live_steal_race_policy_v1','invalid steal race policy');
  assert(input.hitByPitchV1===undefined||input.hitByPitchV1?.version==='live_hit_by_pitch_policy_v1','invalid hit by pitch policy');
  if(input.fieldThrowV1!==undefined)validateLiveFieldThrowPolicyV1(input.fieldThrowV1);
  if(input.fieldRangeV1!==undefined)validateLiveFieldRangePolicyV1(input.fieldRangeV1);
  if(input.runnerThrowReadV1!==undefined)validateLiveRunnerThrowReadPolicyV1(input.runnerThrowReadV1);
  if(input.runnerTurnV1!==undefined)validateLiveRunnerTurnPolicyV1(input.runnerTurnV1);
  if(input.fieldCoverV1!==undefined)validateLiveFieldCoverPolicyV1(input.fieldCoverV1);
  if(input.fieldRunValueV1!==undefined)validateLiveFieldRunValuePolicyV1(input.fieldRunValueV1);
  if(input.fieldKinematicsV1!==undefined)validateLiveFieldKinematicsPolicyV1(input.fieldKinematicsV1);
  if(input.forcedRunV1!==undefined)validateLiveForcedRunPolicyV1(input.forcedRunV1);
  if(input.tossReceiveV1!==undefined)validateLiveTossReceivePolicyV1(input.tossReceiveV1);
  if(input.attemptCrouchV1!==undefined)validateLiveFieldAttemptCrouchPolicyV1(input.attemptCrouchV1);
  if(input.coverSeenV1!==undefined){validateLiveFieldCoverSeenPolicyV1(input.coverSeenV1);if(!input.fieldCoverV1)throw Error('coverSeenV1 needs fieldCoverV1');}
  if(input.relayStepV1!==undefined)validateLiveRelayStepPolicyV1(input.relayStepV1);
  if(input.runnerSafeLeadV1!==undefined)validateLiveRunnerSafeLeadPolicyV1(input.runnerSafeLeadV1);
  if(input.fieldShadeV1!==undefined&&!(['infieldPullDegrees,outfieldPullDegrees','infieldPullDegrees,outfieldPullDegrees,secondBaseLeftyExtraDegrees'].includes(Object.keys(input.fieldShadeV1).sort().join())
    &&[input.fieldShadeV1.infieldPullDegrees,input.fieldShadeV1.outfieldPullDegrees,input.fieldShadeV1.secondBaseLeftyExtraDegrees??0].every(d=>Number.isFinite(d)&&Math.abs(d)<=20)))throw Error('invalid fieldShadeV1');
  if(input.outfieldBreakV1!==undefined){validateLiveOutfieldBreakPolicyV1(input.outfieldBreakV1);if(!input.fieldKinematicsV1)throw Error('outfieldBreakV1 needs fieldKinematicsV1');}
  if(input.fieldAlignmentV1!==undefined){validateLiveFieldAlignmentPolicyV1(input.fieldAlignmentV1);if(!input.fieldRangeV1)throw Error('fieldAlignmentV1 needs fieldRangeV1');}
  if(input.battedBallReplaceV1!==undefined&&![input.battedBallReplaceV1.velocity,input.battedBallReplaceV1.spin].every(v=>v&&[v.x,v.y,v.z].every(Number.isFinite)))throw Error('battedBallReplaceV1 needs finite velocity and spin');
  if(input.locomotionStartV1!==undefined){validateLiveLocomotionStartPolicyV1(input.locomotionStartV1);if(!input.fieldRangeV1||!input.fieldKinematicsV1)throw Error('locomotionStartV1 needs fieldRangeV1 and fieldKinematicsV1');}
  const placementsV1:Readonly<Record<LivePositionV1,Vec3>>=input.fieldRangeV1?Object.fromEntries((Object.keys(placements) as LivePositionV1[]).map(role=>[role,liveFieldPlacementV1(role,placements[role],input.fieldAlignmentV1)])) as Record<LivePositionV1,Vec3>:placements;
  assert(players.size===input.players.length&&input.players.every(p=>p.playerId&&p.name&&Number.isFinite(p.heightMeters)&&p.heightMeters>0&&['R','L'].includes(p.bats)
    &&(p.throws===undefined||['R','L'].includes(p.throws))),'unique physical players required');
  input.players.forEach(p=>{const source=physical(p);if(p.traitProfile!==undefined)validateLiveTraitProfileV1(p.traitProfile,source);});
  input.teams.forEach(t=>{
    assert(t.battingOrder.length===9&&new Set(t.battingOrder).size===9&&t.battingOrder.every(id=>players.has(id)),'nine-player batting order required');
    assert(positions.every(pos=>players.has(t.defense[pos]))&&new Set(positions.map(pos=>t.defense[pos])).size===9
      &&t.defense.P===t.pitcherId,'complete defense required');
  });
  assert(input.measuredClips.length>0,'OpenBiomechanics measured bat clips required');
  for(const player of input.players){const p=physical(player);
    assert(p.clipId===undefined||typeof p.clipId==='string'&&p.clipId.length>0,'invalid explicit measured clip identity');
    const candidates=input.measuredClips.filter(clip=>clip.side===player.bats&&(p.clipId===undefined?clip.defaultSelection!==false:clip.id===p.clipId));
    assert(candidates.length>0,'unknown measured clip or wrong batting side for '+player.playerId);
    if(p.impactTrajectory!==undefined&&p.impactTrajectory.method===undefined){const s=p.impactTrajectory;
      assert(candidates.every(clip=>clip.contactTimeSeconds*1e6-s.beforeSeconds*1e6>=clip.frames[0].tick
        &&clip.contactTimeSeconds*1e6+s.afterSeconds*1e6<=clip.frames.at(-1)!.tick),'impact adjustment window exceeds measured form for '+player.playerId);}
  }
  const park=input.park??{fenceRadiusMeters:110,fenceHeightMeters:3};
  assert(Number.isFinite(park.fenceRadiusMeters)&&park.fenceRadiusMeters>baseSide*2&&Number.isFinite(park.fenceHeightMeters)&&park.fenceHeightMeters>=0,'invalid park geometry');
  if(park.poleEquipmentV148!==undefined)createSourceFreePoleSessionV148(park.poleEquipmentV148);
  const poleScopeBindingV148=park.poleEquipmentV148?.poles.length?JSON.stringify([park,matchPhysicsV101],(_key,value)=>
    value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)):value):undefined;
  const fence=deriveLiveFieldFenceGeometryV1({bases:LIVE_MATCH_BASES_V1,...park}),fenceGeometry=frozen({
    center:{x:fence.fenceCenter.x,z:fence.fenceCenter.z},radiusMeters:fence.fenceRadiusMeters,heightMeters:fence.fenceHeightMeters,
    ...(fence.fenceVerticesV1?{shapeV1:{vertices:fence.fenceVerticesV1}}:{}),
    ...(park.poleEquipmentV148?.poles.length?{poleEquipmentV148:park.poleEquipmentV148}:{})});
  let match:CanonicalMatchState={ruleProfileId:asRuleProfileId('npb-2026'),inning:1,half:'top',outs:0,balls:0,strikes:0,
    bases:{first:null,second:null,third:null},score:{away:0,home:0},playId:0};
  let pitchCount=0,nextTick=tps,finished=false;
  const hits={away:0,home:0,pendingAway:0,pendingHome:0},errors={away:0,home:0,pendingAway:0,pendingHome:0};
  const battingOrderIndices=[0,0],history:LiveIssuedPitchV1[]=[],line:{inning:number;away:number|null;home:number|null}[]=[{inning:1,away:0,home:null}];
  if(resume!==undefined){
    const c=cloneInert(resume),integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0,
      counts=(v:typeof hits)=>v&&Object.keys(v).length===4&&Object.values(v).every(integer);
    assert(c?.poleScopeBindingV148===poleScopeBindingV148,'same-game pole geometry, material or physical profile differs');
    assert(c?.randomnessBindingV152===randomnessBindingV152,'same-game randomness policy differs');
    assert(c?.directionMotorBindingV153===directionMotorBindingV153,'same-game direction motor policy differs');
    assert(c?.batterAutoDirectionBindingV250===autoDirectionBindingV250,'same-game auto direction policy differs');
    assert(c?.batterTechniqueBindingV1===batterTechniqueBindingV1,'same-game batter technique policy differs');
    assert(c?.batterReactiveDirectionBindingV251===reactiveBindingV251,'same-game reactive direction policy differs');
    assert(c?.batterNeutralReactiveBindingV272===neutralBindingV272,'same-game neutral reactive policy differs');
    assert(c?.batterForecastBindingV246===forecastBindingV246,'same-game forecast policy differs');
    assert(c?.version==='live_match_continuation_v116'&&c.seed===input.seed&&c.innings===innings
      &&integer(c.pitchCount)&&integer(c.nextTick)&&c.nextTick>=tps&&typeof c.finished==='boolean'
      &&c.match?.ruleProfileId==='npb-2026'&&integer(c.match.inning)&&c.match.inning>=1
      &&['top','bottom'].includes(c.match.half)&&integer(c.match.outs)&&c.match.outs<=3
      &&integer(c.match.balls)&&c.match.balls<=3&&integer(c.match.strikes)&&c.match.strikes<=2
      &&integer(c.match.playId)&&integer(c.match.score?.away)&&integer(c.match.score?.home)
      &&c.match.bases&&Object.keys(c.match.bases).length===3
      &&['first','second','third'].every(k=>Object.hasOwn(c.match.bases,k))
      &&Object.values(c.match.bases).every(id=>id===null||players.has(id))
      &&counts(c.hits)&&counts(c.errors)&&Array.isArray(c.battingOrderIndices)&&c.battingOrderIndices.length===2
      &&c.battingOrderIndices.every(i=>integer(i)&&i<9)&&Array.isArray(c.line)&&c.line.length>0
      &&c.line.every(r=>integer(r.inning)&&r.inning>=1&&(r.away===null||integer(r.away))&&(r.home===null||integer(r.home))),
      'invalid same-game worker continuation V116');
    match=c.match;pitchCount=c.pitchCount;nextTick=c.nextTick;finished=c.finished;
    Object.assign(hits,c.hits);Object.assign(errors,c.errors);battingOrderIndices.splice(0,2,...c.battingOrderIndices);
    line.splice(0,line.length,...c.line.map(r=>({...r})));
  }
  assert(input.workloadV122!==undefined||resume?.workloadV122===undefined,'unexpected workload continuation');
  assert(resume===undefined||input.workloadV122===undefined||resume.workloadV122!==undefined,'missing workload continuation');
  const workloadOwnerV122=input.workloadV122===undefined?undefined:createLiveMatchWorkloadOwnerV122({config:input.workloadV122,
    playerIds:[...players.keys()],pitchCount,...(resume?.workloadV122===undefined?{}:{continuation:resume.workloadV122})});
  const knowledgeV122=new Map<string,BatterBeliefV122>(),beliefKeyV122=(b:string,p:string)=>JSON.stringify([b,p]),
    initialKnowledgeBindingV122=JSON.stringify(input.batterKnowledgeV122??[]);
  if(input.batterKnowledgeV122!==undefined){
    assert(Array.isArray(input.batterKnowledgeV122),'invalid explicit batter knowledge');
    for(const source of input.batterKnowledgeV122){const b=freezeBatterBeliefV122(source,{observerPlayerId:source.observerPlayerId,pitcherId:source.pitcherId,capturedAtTick:tps}),key=beliefKeyV122(b.observerPlayerId,b.pitcherId);
      assert(players.has(b.observerPlayerId)&&players.has(b.pitcherId)&&!knowledgeV122.has(key),'unknown or repeated batter knowledge participants');knowledgeV122.set(key,b);}
  }
  if(resume?.batterKnowledgeV122!==undefined){const saved=resume.batterKnowledgeV122;
    assert(input.batterKnowledgeV122!==undefined&&saved.initialBinding===initialKnowledgeBindingV122&&Array.isArray(saved.beliefs)&&saved.beliefs.length===knowledgeV122.size,'batter knowledge continuation differs');
    const seen=new Set<string>();for(const source of saved.beliefs){assert(source.capturedAtTick<=nextTick,'future knowledge continuation');
      const b=freezeBatterBeliefV122(source,{observerPlayerId:source.observerPlayerId,pitcherId:source.pitcherId,capturedAtTick:source.capturedAtTick}),key=beliefKeyV122(b.observerPlayerId,b.pitcherId);
      assert(knowledgeV122.has(key)&&!seen.has(key),'unknown knowledge continuation participant');knowledgeV122.set(key,b);seen.add(key);}
  }else assert(resume===undefined||input.batterKnowledgeV122===undefined,'missing batter knowledge continuation');
  const captureKnowledgeV122=()=>({initialBinding:initialKnowledgeBindingV122,beliefs:[...knowledgeV122.values()]});
  const observedMemoriesV151=new Map<string,BatterObservedMemoryV151>(),observationBindingV151=JSON.stringify(observationPolicyV151);
  if(resume?.batterObservedMemoryV151!==undefined){
    const saved=resume.batterObservedMemoryV151;
    assert(observationPolicyV151!==undefined&&saved.policyBinding===observationBindingV151&&Array.isArray(saved.memories),'batter observation memory policy differs');
    for(const rawMemory of saved.memories){const memory=validateBatterObservedMemoryV151(rawMemory),key=beliefKeyV122(memory.observerPlayerId,memory.pitcherId);
      assert(players.has(memory.observerPlayerId)&&players.has(memory.pitcherId)&&!observedMemoriesV151.has(key)
        &&memory.entries.length<=observationPolicyV151.memoryPolicy.maximumEntriesPerPair
        &&memory.entries.every(entry=>entry.availableTick<=nextTick&&entry.pitchOrdinal<=pitchCount),'invalid batter observation memory continuation');
      observedMemoriesV151.set(key,memory);}
  }else assert(resume===undefined||observationPolicyV151===undefined,'missing batter observation memory continuation');
  const captureObservedMemoryV151=()=>({policyBinding:observationBindingV151!,memories:[...observedMemoriesV151.values()]});
  const regionBindingV222=JSON.stringify({regionPolicyV222,observationPolicyV151}), regionEntriesV222=new Map<string,BatterObservedRegionEvidenceV222>();
  if(resume?.batterObservedRegionExperienceV222!==undefined){
    const saved=resume.batterObservedRegionExperienceV222;
    assert(regionPolicyV222!==undefined&&Object.keys(saved).sort().join('|')==='entries|policyBinding'
      &&saved.policyBinding===regionBindingV222&&Array.isArray(saved.entries),'region experience policy differs');
    const expected=[...observedMemoriesV151.values()].flatMap(memory=>memory.entries);
    assert(saved.entries.length===expected.length,'region experience count differs');
    for(const evidence of expected){const matches=saved.entries.filter(entry=>entry.evidenceId===evidence.evidenceId&&entry.observerPlayerId===evidence.observerPlayerId&&entry.pitcherId===evidence.pitcherId);
      assert(matches.length===1,'region experience evidence missing or duplicated');const entry=validateRegionEvidenceV222(matches[0],evidence);
      assert(!regionEntriesV222.has(entry.evidenceId),'duplicate region evidence identity');regionEntriesV222.set(entry.evidenceId,entry);}
  }else assert(resume===undefined||regionPolicyV222===undefined,'missing region experience continuation');
  const captureRegionV222=()=>({policyBinding:regionBindingV222,entries:[...regionEntriesV222.values()]});

  const emotionTrackerV1=input.emotionPolicyV1?createLiveEmotionTrackerV1({matchId:'match-'+input.seed,policy:input.emotionPolicyV1,saved:(resume as {emotionV1?:unknown}|undefined)?.emotionV1,
    players:input.teams.flatMap(team=>[...team.battingOrder,team.pitcherId].map(playerId=>({playerId,clubId:team.id,response:liveEmotionResponseFromTraitsV1(input.players.find(p=>p.playerId===playerId)?.traitProfile)})))}):undefined;
  const captureContinuationV116=():LiveMatchContinuationV116=>frozen({version:'live_match_continuation_v116',seed:input.seed,innings,...(emotionTrackerV1?{emotionV1:emotionTrackerV1.capture()}:{}),
    match:cloneInert(match),pitchCount,nextTick,finished,hits:{...hits},errors:{...errors},
    ...(poleScopeBindingV148===undefined?{}:{poleScopeBindingV148}),
    ...(randomnessBindingV152===undefined?{}:{randomnessBindingV152}),
    ...(directionMotorBindingV153===undefined?{}:{directionMotorBindingV153}),
    ...(autoDirectionBindingV250===undefined?{}:{batterAutoDirectionBindingV250:autoDirectionBindingV250}),
    ...(batterTechniqueBindingV1===undefined?{}:{batterTechniqueBindingV1}),
    ...(reactiveBindingV251===undefined?{}:{batterReactiveDirectionBindingV251:reactiveBindingV251}),
    ...(neutralBindingV272===undefined?{}:{batterNeutralReactiveBindingV272:neutralBindingV272}),
    ...(forecastBindingV246===undefined?{}:{batterForecastBindingV246:forecastBindingV246}),
    battingOrderIndices:[...battingOrderIndices],line:cloneInert(line),...(workloadOwnerV122?{workloadV122:workloadOwnerV122.capture()}: {}),
    ...(input.batterKnowledgeV122===undefined?{}:{batterKnowledgeV122:captureKnowledgeV122()}),
    ...(observationPolicyV151===undefined?{}:{batterObservedMemoryV151:captureObservedMemoryV151()}),
    ...(regionPolicyV222===undefined?{}:{batterObservedRegionExperienceV222:captureRegionV222()})});
  const offense=()=>match.half==='top'?0:1;
  const current=()=>{const team=offense();return {team,batterPlayerId:input.teams[team].battingOrder[battingOrderIndices[team]],pitcherPlayerId:input.teams[1-team].pitcherId};};
  let leadInstruction:'conservative'|'balanced'|'aggressive'='balanced';
  const pitcherToFirstMetersV1=Math.hypot(LIVE_MATCH_BASES_V1.first.x-placements.P.x,LIVE_MATCH_BASES_V1.first.z-placements.P.z);
  const leadOf=(name:'first'|'second'|'third',pitcherPlayerId:string)=>{
    const runner=physical(players.get(match.bases[name]!)!);
    if(input.runnerLeadV1===undefined)return leadMetersV1(runner,leadInstruction);
    const pitcher=players.get(pitcherPlayerId)!;
    return runnerLeadMetersV1({runner,pitcher:{...physical(pitcher),...(pitcher.throws===undefined?{}:{throws:pitcher.throws})},base:name,instruction:leadInstruction,pitcherToFirstMeters:pitcherToFirstMetersV1});
  };
  const readyFrame=():LiveMatchFrameV1=>{
    const c=current(),def=input.teams[1-c.team],batter=players.get(c.batterPlayerId)!;
    // The fielders stand where they will start the play from, so a shade does not jump them at contact.
    const standing=input.fieldShadeV1?shadedPlacementsV1(placementsV1,input.fieldShadeV1,batter.bats):placementsV1;
    return frozen({tick:nextTick,ball:{position:{x:0,y:1.8,z:16.4},velocity:zero(),spin:zero(),orientation:IDENTITY_QUATERNION,visible:false},bat:null,
      actors:[...positions.map(role=>({playerId:def.defense[role],role,team:1-c.team,position:{...standing[role],y:0},velocity:zero()})),
        {playerId:c.batterPlayerId,role:'batter' as const,team:c.team,position:resolveLiveBattingSetupV94({heightMeters:batter.heightMeters,bats:batter.bats,...batter.physical}).bodyPosition,velocity:zero()},
        ...(['first','second','third'] as const).flatMap(name=>match.bases[name]?[{playerId:match.bases[name]!,role:'runner' as const,team:c.team,
          position:leadPositionV1(LIVE_MATCH_BASES_V1,name,leadOf(name,c.pitcherPlayerId)),velocity:zero()}]:[])],
      batterPlayerId:c.batterPlayerId,pitcherPlayerId:c.pitcherPlayerId,phase:'ready',ballKind:'pitch',fairKnown:false,possessedBy:c.pitcherPlayerId});
  };
  const inspect=()=>frozen({version:33,authority:'LOCAL_BROWSER_CORE_HOST_V1' as const,nativeAuthentication:false,
    playerCalibration:'EXPLICIT_AUTHORED_SI_NOT_NAMED_LEAGUE_MEASUREMENTS' as const,match:cloneInert(match),frame:readyFrame(),...current(),pitchCount,finished,
    battingOrderIndices:[...battingOrderIndices],line:cloneInert(line),fenceGeometry,moundSurfacePosition:LIVE_MATCH_MOUND_SURFACE_V1,hits:{...hits},errors:{...errors},history:[...history],
    ...(workloadOwnerV122?{workloadV122:workloadOwnerV122.capture()}: {}),...(input.batterKnowledgeV122===undefined?{}:{batterKnowledgeV122:captureKnowledgeV122()}),
    ...(observationPolicyV151===undefined?{}:{batterObservedMemoryV151:captureObservedMemoryV151()}),
    ...(regionPolicyV222===undefined?{}:{batterObservedRegionExperienceV222:captureRegionV222()})});
  function issuePitch(rawCommand:LivePitchCommandV1):LiveIssuedPitchV1{
    const command=cloneInert(rawCommand);
    const yawPractice=command.observedSpinTrialV236?.version==='live_observed_yaw_contact_frame_trial_v255'?command.observedSpinTrialV236:undefined;
    assert(yawPractice===undefined||capability===previewCapabilityV257,'yaw trial requires private practice preview');
    assert(!finished,'game already finished');
    assert(command&&['auto','balanced','contact','power','take','bunt'].includes(command.batting)&&[0,1].includes(command.managedTeam),'invalid manager command');
    assert(command.baserunning===undefined||['conservative','balanced','aggressive'].includes(command.baserunning),'invalid manager baserunning command');
    const derivedRandomnessV152=randomnessPolicyV152===undefined?undefined:deriveLivePlayRandomnessV152(randomnessPolicyV152,pitchCount+1),
      requestedRandomnessV152=command.randomnessV152===undefined?undefined:validateLiveRandomnessV152(command.randomnessV152,'PLAY'),
      playRandomnessV152=requestedRandomnessV152===undefined?derivedRandomnessV152:validateLiveRandomnessV152({...requestedRandomnessV152,
        ...(derivedRandomnessV152?.overrides===undefined&&requestedRandomnessV152.overrides===undefined?{}
          :{overrides:{...derivedRandomnessV152?.overrides,...requestedRandomnessV152.overrides}})},'PLAY');
    leadInstruction=command.managedTeam===current().team?(command.baserunning??'balanced'):'balanced';
    const beforeMatch=cloneInert(match),c=current(),batter=players.get(c.batterPlayerId)!,pitcher=players.get(c.pitcherPlayerId)!,
      bp=physical(batter),pp=physical(pitcher),cp=physical(players.get(input.teams[1-c.team].defense.C)!),ready=readyFrame();
    const workloadCandidateV122=workloadOwnerV122?.candidateActivity(c.pitcherPlayerId,pitchCount+1),
      pitchWorkloadV122=workloadOwnerV122?.readForPitch(c.pitcherPlayerId);
    if(command.managerCommunicationV122)assert(communicationScopeV122!==undefined,'raw manager communication requires an explicit match scope');
    const knowledgeKeyV122=beliefKeyV122(c.batterPlayerId,c.pitcherPlayerId),priorBeliefV122=knowledgeV122.get(knowledgeKeyV122);
    let pendingBeliefV122=priorBeliefV122,batterEvidenceReceptionV122:Readonly<{status:string;evidenceId:string}>|undefined;
    if(command.batterEvidenceV122){const envelope=command.batterEvidenceV122,e=validateBatterEvidenceV122(envelope.evidence);
      assert(Number.isFinite(envelope.learningWeight)&&envelope.learningWeight>=0&&envelope.learningWeight<=1,'invalid evidence learning policy');
      const status=e.observerPlayerId!==c.batterPlayerId||e.pitcherId!==c.pitcherPlayerId?'NOT_APPLICABLE'
        :e.availableTick>nextTick?'NOT_ARRIVED':priorBeliefV122?.evidenceRefs.includes(e.evidenceId)?'ALREADY_APPLIED':'APPLIED';
      batterEvidenceReceptionV122={status,evidenceId:e.evidenceId};
      if(status==='APPLIED'){assert(priorBeliefV122!==undefined,'delivered evidence requires the observer own prior');
        pendingBeliefV122=assimilateBatterEvidenceV122(priorBeliefV122,e,{atTick:nextTick,learningWeight:envelope.learningWeight});}}
    const batterTechnique=resolveLiveTechnicalTraitsV75(batter.traitProfile),pitcherTechnique=resolveLiveTechnicalTraitsV75(pitcher.traitProfile);
    const batterPreference=resolveLiveTraitPreferencesV54(batter.traitProfile),pitcherPreference=resolveLiveTraitPreferencesV54(pitcher.traitProfile),
      managedOffense=command.managedTeam===c.team,personalBatting=({POWER:'power',BALANCED:'balanced',CONTACT:'contact'} as const)[batterPreference.swingMode],
      defenseLeadV1=c.team===0?beforeMatch.score.home-beforeMatch.score.away:beforeMatch.score.away-beforeMatch.score.home,
      intentionalWalkV1=input.managerTacticsV1!==undefined&&(command.managedTeam===1-c.team?command.location==='intentional':decideIntentionalWalkV1({inning:beforeMatch.inning,regulationInnings:innings,outs:beforeMatch.outs,firstOpen:beforeMatch.bases.first===null,runnerInScoringPosition:beforeMatch.bases.second!==null||beforeMatch.bases.third!==null,defenseLead:defenseLeadV1,balls:beforeMatch.balls,strikes:beforeMatch.strikes})),
      batting=intentionalWalkV1?'take':managedOffense&&command.batting!=='auto'?command.batting:personalBatting,
      pitchTypeCommand=command.managedTeam===1-c.team?command.pitchType:'auto',
      traitPreferences=command.batting==='auto'||batterPreference.swingMode!=='BALANCED'||pitcherPreference.pitchApproach!=='BALANCED'?{
        batting:{preference:batterPreference.swingMode,resolvedCommand:batting,source:managedOffense&&command.batting!=='auto'?'manager_command':'player_preference',
          overrideReason:managedOffense?(command.batting==='auto'?'manager_auto':'explicit_manager_batting'):'unmanaged_offense'},
        pitching:{preference:pitcherPreference.pitchApproach,pitchTypeCommand,source:pitchTypeCommand==='auto'?'player_preference':'manager_command',
          overrideReason:pitchTypeCommand!=='auto'?'explicit_manager_pitch':command.managedTeam===1-c.team?'manager_auto':'unmanaged_pitcher'},
      }:null;
    if(command.observedSpinTrialV236!==undefined)assert(managedOffense&&command.observedSpinTrialV236.subjectId===c.batterPlayerId,'spin trial subject must be the current managed batter');
    assert(!(reactivePolicyV251&&command.observedSpinTrialV236?.version==='live_observed_robust_contact_frame_trial_v248'),'reactive direction policy cannot be combined with robust trial');
    assert(!(neutralPolicyV272&&command.observedSpinTrialV236?.version==='live_observed_robust_contact_frame_trial_v248')||(neutralPolicyV272.version==='live_neutral_reactive_pair_policy_v273'&&capability===pairCapabilityV273),'neutral reactive direction policy cannot be combined with robust trial');
    if(command.spinMotorPracticePolicyV239!==undefined)assert(managedOffense&&command.spinMotorPracticePolicyV239.subjectId===c.batterPlayerId,'spin practice subject must be the current managed batter');
    if(command.practiceSwingDecisionV241!==undefined){const decision=parsePracticeSwingDecisionV241(command.practiceSwingDecisionV241);
      assert(managedOffense,'swing decision requires current managed offense');
      assert(command.managerCommunicationV122===undefined&&!(decision.mode==='SWING'&&command.batting==='take'),'conflicting swing decision');}
    const runningInstruction=command.managedTeam===c.team?(command.baserunning??'balanced'):'balanced',
      runningMarginAdjustment=runningInstruction==='aggressive'?-.25:runningInstruction==='conservative'?.25:0;
    const robinCatcherPlayer=players.get(input.teams[1-c.team].defense.C)!;const robinBodyModel=(command as any).robinSelection?resolveLiveFielderBodyModelV105(robinCatcherPlayer.heightMeters,cp.gloveReachMeters,Object.fromEntries(Object.keys(liveFielderBodyControlBoundsV105).filter(k=>(cp as any)[k]!==undefined).map(k=>[k,(cp as any)[k]]))):null;const robinReadyCatcher=ready.actors.find(a=>a.playerId===robinCatcherPlayer.playerId)!;
    const pitchInput:LivePitchInputV1={...((command as any).robinSelection?{robinLegacyRngV1:{matchSeed:input.seed,pitchIndex:pitchCount}}:{}),...((input as any).partialReferenceFallbackV1?{partialReferenceFallbackV1:(input as any).partialReferenceFallbackV1}:{}),...((input as any).causalCatcherObservationV1?{causalCatcherObservationV1:(input as any).causalCatcherObservationV1}:{}),originTick:nextTick,seed:(input.seed+Math.imul(pitchCount+1,0x9e3779b9))>>>0,
      ...(playRandomnessV152===undefined?{}:{randomnessV152:playRandomnessV152}),
      ...(managedOffense&&command.swingInstructionV121!==undefined?{swingInstructionV121:command.swingInstructionV121}:{}),
      ...(managedOffense&&command.battingDirectionRequestV149!==undefined?{battingDirectionRequestV149:command.battingDirectionRequestV149}:autoDirectionPolicyV250?{battingDirectionRequestV149:{version:'batting_direction_request_v149' as const,sourceId:autoDirectionPolicyV250.sourceId,mode:'AUTO' as const}}:{}),
      ...(command.observedSpinTrialV236===undefined||yawPractice!==undefined?{}:{observedSpinTrialV236:command.observedSpinTrialV236 as LivePitchInputV1['observedSpinTrialV236']}),
      ...(command.spinMotorPracticePolicyV239===undefined?{}:{spinMotorPracticePolicyV239:command.spinMotorPracticePolicyV239}),
      ...(command.practiceSwingDecisionV241===undefined?{}:{practiceSwingDecisionV241:command.practiceSwingDecisionV241}),
      ...(managedOffense&&command.managerCommunicationV122!==undefined?{managerCommunicationV122:{source:command.managerCommunicationV122,
        scope:{sessionId:communicationScopeV122!.sessionId,matchId:communicationScopeV122!.matchId,senderId:communicationScopeV122!.managerId,receiverId:c.batterPlayerId}}}:{}),
      ...(pitchWorkloadV122?{pitchWorkloadV122}:{}),
      ...(pendingBeliefV122?{batterBeliefV122:{belief:pendingBeliefV122,observerPlayerId:c.batterPlayerId,pitcherId:c.pitcherPlayerId}}:{}),
      ...(directionMotorPolicyV153===undefined?{}:{batterDirectionMotorV153:directionMotorPolicyV153}),
      ...(capability===yawDiagnosticCapabilityV274?{yawDiagnosticV274:{version:'live_yaw_paired_diagnostic_v274' as const}}:capability===yawDiagnosticCapabilityV275?{yawDiagnosticV274:{version:'live_yaw_paired_diagnostic_v275' as const}}:capability===yawDiagnosticCapabilityV276?{yawDiagnosticV274:{version:'live_yaw_paired_diagnostic_v276' as const}}:{}),
      ...(emotionTrackerV1?.influence(c.batterPlayerId)?{emotionInfluenceV1:emotionTrackerV1.influence(c.batterPlayerId)!.effects}:{}),
      ...(reactivePolicyV251===undefined?{}:{batterReactiveDirectionPolicyV251:reactivePolicyV251}),
      ...(batterTechniqueV1===undefined||capability!==undefined||command.observedSpinTrialV236!==undefined||command.spinMotorPracticePolicyV239!==undefined?{}:{batterTechniqueV1}),
      ...(neutralPolicyV272===undefined||capability===pairCapabilityV273?{}:{batterNeutralReactivePolicyV272:{version:'live_neutral_reactive_policy_v272' as const,sourceId:neutralPolicyV272.sourceId}}),
      ...(regionPolicyV222===undefined?{}:{batterObservedRegionExperienceV222:regionPolicyV222}),
      ...(forecastPolicyV246===undefined?{}:{batterForecastPolicyV246:forecastPolicyV246}),
      ...(observationPolicyV151?{batterObservationV151:observationPolicyV151,batterObservedMemoryV151:{
        memory:observedMemoriesV151.get(knowledgeKeyV122)??createEmptyBatterObservedMemoryV151({observerPlayerId:c.batterPlayerId,pitcherId:c.pitcherPlayerId}),
        observerPlayerId:c.batterPlayerId,pitcherId:c.pitcherPlayerId}}:{}),
      pitchSituationV111:{balls:beforeMatch.balls,strikes:beforeMatch.strikes,outs:beforeMatch.outs,
        occupiedBases:{first:beforeMatch.bases.first!==null,second:beforeMatch.bases.second!==null,third:beforeMatch.bases.third!==null}},
      batter:{...resolveLiveBatterSituationV1(bp,batter.traitProfile,{balls:beforeMatch.balls,strikes:beforeMatch.strikes,pitcherThrows:pitcher.throws??'R',batting}),heightMeters:batter.heightMeters,bats:batter.bats,...(batterTechnique?{technicalSkills:batterTechnique}:{})},pitcher:{...resolveLivePitcherSituationV1(pp,pitcher.traitProfile,{strikes:beforeMatch.strikes,runnersOn:Object.values(beforeMatch.bases).filter(Boolean).length}),...(pitcherTechnique?{technicalSkills:pitcherTechnique}:{}),heightMeters:pitcher.heightMeters,moundPosition:LIVE_MATCH_MOUND_SURFACE_V1,...(pitcher.throws===undefined?{}:{throws:pitcher.throws}),
        pitchApproach:pitcherPreference.pitchApproach},measuredClips:liveSpinRepertoireClipsV124({...bp,bats:batter.bats},input.measuredClips),
      catcher:{...((command as any).robinSelection?{robinBodyModelV1:robinBodyModel,robinBodyPositionV1:{...robinReadyCatcher.position,y:robinReadyCatcher.position.y+robinBodyModel!.hipHeightMeters}}:{}),gloveSpeedMps:cp.gloveSpeedMps,gloveReachMeters:cp.gloveReachMeters,gloveRadiusMeters:cp.gloveRadiusMeters,
        retentionCapacityJ:cp.retentionCapacityJ,captureDissipationPowerW:cp.captureDissipationPowerW,pocketRadiusMeters:.14,...(cp.defensiveDecisionSeconds===undefined?{}:{defensiveDecisionSeconds:cp.defensiveDecisionSeconds}),...(cp.zoneRecognitionV87===undefined?{}:{zoneRecognitionV87:cp.zoneRecognitionV87})},
      batting,pitchType:pitchTypeCommand,...(command.managedTeam===1-c.team&&command.pitchId!==undefined?{pitchId:command.pitchId}:{}),
      location:intentionalWalkV1?'outside':command.managedTeam===1-c.team?command.location:'auto',...(intentionalWalkV1?{intentionalBallV1:true}:{}),physics:matchPhysicsV101};
    if(capability===yawDiagnosticCapabilityV274||capability===yawDiagnosticCapabilityV275||capability===yawDiagnosticCapabilityV276)authorizedYawPitchInputsV274.add(pitchInput);
    let pitch:ReturnType<typeof simulateLivePitchV1>;
    try{pitch=((input as any).partialReferenceFallbackV1?((globalThis as any).__lateCutBodiesV1=lateCutBodiesV1(ready,input.players,matchPhysicsV101.ground.radiusM),((command as any).robinSelection?simulateRobinBridgeV1(pitchInput,(command as any).robinSelection):simulateLivePitchV1(pitchInput))):((command as any).robinSelection?simulateRobinBridgeV1(pitchInput,(command as any).robinSelection):simulateLivePitchV1(pitchInput)))}finally{if(capability===yawDiagnosticCapabilityV274||capability===yawDiagnosticCapabilityV275||capability===yawDiagnosticCapabilityV276){const evidence=takeYawDecisionEvidenceV274(pitchInput);if(evidence)yawEvidenceByHostV274.set(host,evidence);authorizedYawPitchInputsV274.delete(pitchInput)}}
    if((command as any).robinAutoSelectionV1)pitch={...pitch,diagnostics:{...pitch.diagnostics,robinAutoSelectionV1:(command as any).robinAutoSelectionV1} as typeof pitch.diagnostics};
    let looseAdmission:any=null;if(pitch.call===null&&!pitch.contact){const robinState=(command as any).robinSelection?(globalThis as any).__robinActualPitch:null;
      looseAdmission=resolveLoosePitchContinuationV2({pitch,input,ready,beforeMatch,team:c.team,physics:matchPhysicsV101,baserunning:runningInstruction,robin:robinState?{hiddenAfterSeconds:robinState.source.sampler.hiddenAfterT??null,legacyArrivedSeconds:robinState.legacyArrivedSeconds}:null});
      pitch={...pitch,frames:looseAdmission.releaseFrames,call:looseAdmission.call,endedAtTick:looseAdmission.endTick,diagnostics:{...pitch.diagnostics,looseDetailV2:looseAdmission.detail,loosePitchV1:{version:'loose_pitch_field_v2',scope:looseAdmission.scope,sourceProvenance:looseAdmission.sourceProvenance},...(looseAdmission.fallbackReason?{pitchFallbackV1:{reason:looseAdmission.fallbackReason}}:{})} as typeof pitch.diagnostics};}
    if((command as any).robinSelection){const robinState=(globalThis as any).__robinActualPitch;pitch={...pitch,diagnostics:{...pitch.diagnostics,loosePitchV1:{version:'loose_pitch_field_v2',scope:looseAdmission?.scope??'SECURED_OR_BATTED',sourceProvenance:{...robinState.provenance,matchSeed:input.seed,pitchOrdinal:pitchCount+1,requestedLocation:command.location,selection:(command as any).robinSelection,opticalPolicy:'hidden_through_legacy_arrival_then_impact_v1'}}} as typeof pitch.diagnostics};}
    // A runner going on this pitch: the race only matters if the pitch ends in the catcher's mitt.
    const stealIntent=decideStealV1({seed:input.seed,pitchOrdinal:pitchCount+1,match:beforeMatch,topSpeedOf:id=>physical(players.get(id)!).topSpeedMps,instruction:runningInstruction,runnerOf:id=>physical(players.get(id)!)});
    let stealRun:ReturnType<typeof resolveStealV1>|null=null;
    const lastPitchOut=beforeMatch.strikes>=2&&pitch.call!=='ball'&&beforeMatch.outs===2,forcedByWalk=beforeMatch.balls>=3&&pitch.call==='ball';
    if(stealIntent&&pitch.call!==null&&!pitch.contact&&!looseAdmission&&!lastPitchOut&&!forcedByWalk){
      const catcherPosition=ready.actors.find(a=>a.playerId===input.teams[1-c.team].defense.C)!.position,from=ready.actors.find(a=>a.playerId===stealIntent.runnerId)!.position,sp=physical(players.get(stealIntent.runnerId)!),
        catcherSkillV1=resolveLiveTechnicalTraitsV75(players.get(input.teams[1-c.team].defense.C)!.traitProfile)?.advanced_fielding??0;
      stealRun=resolveStealV1({seed:input.seed,pitchOrdinal:pitchCount+1,from,to:LIVE_MATCH_BASES_V1[stealIntent.target],catcher:catcherPosition,catchSeconds:(pitch.endedAtTick-nextTick)/tps,runner:sp,transferSeconds:input.catcherThrowV1&&catcherSkillV1>0?cp.transferSeconds*(1-.08*catcherSkillV1):cp.transferSeconds,throwSpeedMps:cp.throwSpeedMps,...(pp.deliverySecondsV1===undefined?{}:{deliverySeconds:pp.deliverySecondsV1}),...(input.catcherThrowV1?{catcherThrowV1:true as const}:{}),...(input.stealRaceV1?{stealRaceV1:true as const}:{}),...(input.fieldKinematicsV1?{kinematicsV1:input.fieldKinematicsV1}:{})});}
    // The catcher comes up and steps toward the bag while the ball goes from mitt to hand.
    const stealCatchSeconds=(pitch.endedAtTick-nextTick)/tps,catcherExchangeV1=(seconds:number)=>!stealRun||!input.catcherThrowV1?0:Math.min(1,Math.max(0,(seconds-stealCatchSeconds)/Math.max(.01,stealRun.exchangeSeconds))),
      catcherStepV1=(seconds:number)=>{const u=catcherExchangeV1(seconds);return LIVE_CATCHER_THROW_CALIBRATION_V1.steppedForwardMeters*u*u*(3-2*u);};
    const stealActors=(seconds:number)=>ready.actors.map(a=>stealRun&&a.playerId===stealIntent!.runnerId?{...a,position:stealRun.position(seconds),velocity:stealRun.velocity(seconds)}
      :stealRun&&input.catcherThrowV1&&a.playerId===input.teams[1-c.team].defense.C?{...a,position:{...a.position,z:a.position.z+catcherStepV1(seconds)}}:a);
    const frames:LiveMatchFrameV1[]=pitch.frames.map(f=>({...ready,tick:f.tick,ball:f.ball,bat:f.bat,phase:'pitch',possessedBy:f.ball.possessedBy==='catcher'?input.teams[1-c.team].defense.C:null,...(stealRun?{actors:stealActors((f.tick-nextTick)/tps)}:{})}));
    let stealEndTick=0,stealEvents:readonly any[]=[];
    const pitchOriginTickV1=nextTick;
    if(stealRun){
      const catcherId=input.teams[1-c.team].defense.C,start=ready.actors.find(a=>a.playerId===catcherId)!.position,to=LIVE_MATCH_BASES_V1[stealIntent!.target],
        end=Math.max(stealRun.runnerSeconds,stealRun.arrivalSeconds),last=frames.at(-1)!,step=tps/60;
      for(let tick=last.tick+step;tick<=nextTick+end*tps;tick+=step){const seconds=(tick-nextTick)/tps,flying=seconds>=stealRun.releaseSeconds,u=flying?Math.min(1,(seconds-stealRun.releaseSeconds)/(stealRun.arrivalSeconds-stealRun.releaseSeconds)):0,
        paced=!!input.catcherThrowV1,from=paced?{...start,z:start.z+catcherStepV1(seconds)}:start,
        ballPosition=flying?{x:from.x+(to.x-from.x)*u,y:paced?1.7-.7*u+1.2*u*(1-u):1.5-.5*u,z:from.z+(to.z-from.z)*u}:{...from,y:paced?1+.7*catcherExchangeV1(seconds):1};
        frames.push({...ready,tick:Math.round(tick),actors:stealActors(seconds),bat:null,phase:'pitch',possessedBy:flying&&u<1?null:catcherId,ballKind:flying?'throw':'pitch',
          ball:{...last.ball,tick:Math.round(tick),position:ballPosition,velocity:zero(),visible:flying,possessedBy:flying&&u<1?null:catcherId}} as LiveMatchFrameV1);}
      stealEndTick=nextTick+Math.ceil(end*tps);
      stealEvents=[{kind:'throw_release',tick:nextTick+Math.round(stealRun.releaseSeconds*tps),playerId:catcherId},{kind:stealRun.safe?'stolen_base':'caught_stealing',tick:stealEndTick,playerId:stealIntent!.runnerId}];
    }
    // A throw to first after the pitch, while the runner is still off the bag.
    const firstRunner=ready.actors.find(a=>a.playerId===beforeMatch.bases.first),countEnds=forcedByWalk||beforeMatch.strikes>=2&&pitch.call!=='ball',
      pickoffIntent=!stealRun&&!looseAdmission&&!pitch.contact&&pitch.call!==null&&!countEnds&&firstRunner?decidePickoffV1({seed:input.seed,pitchOrdinal:pitchCount+1,match:beforeMatch,leadMeters:Math.hypot(firstRunner.position.x-LIVE_MATCH_BASES_V1.first.x,firstRunner.position.z-LIVE_MATCH_BASES_V1.first.z),runnerThreat:physical(players.get(beforeMatch.bases.first!)!).runnerThreatV1??0}):null;
    let pickoffRun:ReturnType<typeof resolvePickoffV1>|null=null,pickoffEndTick=0,pickoffStartTickV1=0;
    if(pickoffIntent){
      const pitcherId=input.teams[1-c.team].defense.P,pitcherPosition=ready.actors.find(a=>a.playerId===pitcherId)!.position,sp=physical(players.get(pickoffIntent.runnerId)!),receiver=physical(players.get(input.teams[1-c.team].defense['1B'])!),
        last=frames.at(-1)!,startTick=last.tick+Math.round(.9*tps),base=LIVE_MATCH_BASES_V1.first;
      pickoffRun=resolvePickoffV1({seed:input.seed,pitchOrdinal:pitchCount+1,lead:firstRunner!.position,base,pitcher:pitcherPosition,pitcherTechnique:pp.pickoffTechniqueV1??0,throwSpeedMps:pp.throwSpeedMps,runner:sp,receiverGloveSpeedMps:receiver.gloveSpeedMps,...(input.runnerLeadV1?{leadRaceV1:pitcher.throws===undefined?{}:{throws:pitcher.throws}}:{})});
      const run=pickoffRun,step=tps/60;
      for(let tick=last.tick+step;tick<=startTick+run.endSeconds*tps;tick+=step){const seconds=(tick-startTick)/tps,flying=seconds>=run.moveSeconds,u=flying?Math.min(1,(seconds-run.moveSeconds)/(run.arrivalSeconds-run.moveSeconds)):0,
        ballPosition={x:pitcherPosition.x+(base.x-pitcherPosition.x)*u,y:1.5-.5*u,z:pitcherPosition.z+(base.z-pitcherPosition.z)*u};
        frames.push({...ready,tick:Math.round(tick),actors:ready.actors.map(a=>a.playerId===pickoffIntent.runnerId?{...a,position:run.position(Math.max(0,seconds))}:a),bat:null,phase:'pitch',possessedBy:flying&&u<1?null:pitcherId,ballKind:flying?'throw':'pitch',
          ball:{...last.ball,tick:Math.round(tick),position:ballPosition,velocity:zero(),visible:flying&&u<1,possessedBy:flying&&u<1?null:pitcherId}} as LiveMatchFrameV1);}
      pickoffEndTick=startTick+Math.ceil(run.endSeconds*tps);
      pickoffStartTickV1=startTick;
      stealEvents=[{kind:'throw_release',tick:startTick+Math.round(run.moveSeconds*tps),playerId:pitcherId},{kind:run.safe?'pickoff_safe':'picked_off',tick:pickoffEndTick,playerId:pickoffIntent.runnerId}];
    }
    if(looseAdmission)frames.push(...looseAdmission.frames);
    let field:ReturnType<typeof simulateLiveFieldPlayV1>|null=null,result={kind:'unresolved',reason:'not_settled',tick:0} as PlayableMatchRuleResultV1,outgoingBallMoment:BallWorldMoment|null=null;
    let scoringInput:LiveFieldPlayInputV1|null=null,fieldFallbackReason:string|null=null;
    if(pitch.contact&&pitch.contactMoment){
      const def=input.teams[1-c.team];
      const replaced=input.battedBallReplaceV1,
        outgoingMoment={...pitch.contactMoment,ball:{...pitch.contactMoment.ball,velocity:replaced?replaced.velocity:pitch.contact.exitVelocity,spin:replaced?replaced.spin:pitch.contact.exitSpin}};
      outgoingBallMoment=outgoingMoment;
      const fieldInput=buildLiveFieldPlayInputV95({ball:outgoingMoment,orientation:pitch.contactOrientation??IDENTITY_QUATERNION,
        physics:pitch.diagnostics.sourceDescriptor?.profile.air.aerodynamics.seamForce===undefined?matchPhysicsV101:pitch.diagnostics.sourceDescriptor.profile,
        seed:(input.seed+Math.imul(pitchCount+1,0x9e3779b9))>>>0,
        ...(playRandomnessV152===undefined?{}:{randomnessV152:playRandomnessV152}),
        field:{bases:LIVE_MATCH_BASES_V1,...park},defense:def.defense,placements:input.fieldShadeV1?shadedPlacementsV1(placementsV1,input.fieldShadeV1,players.get(c.batterPlayerId)!.bats):placementsV1,
        players:[...players.values()].map(player=>{const technicalSkills=resolveLiveTechnicalTraitsV75(player.traitProfile);return{
          playerId:player.playerId,heightMeters:player.heightMeters,physical:physical(player),...(technicalSkills?{technicalSkills}:{}),
          ...(player.traitProfile?{traitProfile:player.traitProfile}:{})};}),
        batterRunnerId:c.batterPlayerId,batterPosition:ready.actors.find(a=>a.playerId===c.batterPlayerId)!.position,
        occupiedBases:beforeMatch.bases,baserunning:runningInstruction,outs:beforeMatch.outs,maxPlaySeconds:45});
      const leadBy=new Map(ready.actors.filter(a=>a.role==='runner').map(a=>[a.playerId,a.position]));
      const runnerSpecs=fieldInput.runners.map(r=>leadBy.has(r.runnerId)?{...r,position:leadBy.get(r.runnerId)!}:r),fieldWithLeads={...fieldInput,...(input.fieldThrowV1?{fieldThrowPolicyV1:input.fieldThrowV1}:{}),...(input.fieldRangeV1?{fieldRangePolicyV1:input.fieldRangeV1}:{}),...(input.runnerThrowReadV1?{runnerThrowReadPolicyV1:input.runnerThrowReadV1}:{}),...(input.runnerTurnV1?{runnerTurnPolicyV1:input.runnerTurnV1}:{}),...(input.fieldCoverV1?{fieldCoverPolicyV1:input.fieldCoverV1}:{}),...(input.fieldRunValueV1?{fieldRunValuePolicyV1:input.fieldRunValueV1}:{}),...(input.fieldKinematicsV1?{fieldKinematicsPolicyV1:input.fieldKinematicsV1}:{}),...(input.locomotionStartV1?{locomotionStartPolicyV1:input.locomotionStartV1}:{}),...(input.outfieldBreakV1?{outfieldBreakPolicyV1:input.outfieldBreakV1}:{}),...(input.forcedRunV1?{forcedRunPolicyV1:input.forcedRunV1}:{}),...(input.tossReceiveV1?{tossReceivePolicyV1:input.tossReceiveV1}:{}),...(input.attemptCrouchV1?{attemptCrouchPolicyV1:input.attemptCrouchV1}:{}),...(input.coverSeenV1?{coverSeenPolicyV1:input.coverSeenV1}:{}),...(input.relayStepV1?{relayStepPolicyV1:input.relayStepV1}:{}),...(input.runnerSafeLeadV1?{runnerSafeLeadPolicyV1:input.runnerSafeLeadV1}:{}),runners:runnerSpecs,runnerTacticsV1:{context:{inning:beforeMatch.inning,regulationInnings:innings,battingRuns:beforeMatch.score[beforeMatch.half==='top'?'away':'home'],defendingRuns:beforeMatch.score[beforeMatch.half==='top'?'home':'away']}}};
      // Calibration of the plate appearance alone: the fielding world is skipped, and hits stop being meaningful.
      let fieldFailure:string|null=input.skipFieldPlayV1?'SKIPPED_FOR_PLATE_SAMPLING':null;
      if(fieldFailure===null)try{field=simulateLiveFieldPlayV1(fieldWithLeads);
        if(!field.end.complete)fieldFailure='FIELD_INCOMPLETE '+field.end.reason;
        else{result=reducePlayableMatchV1({match:beforeMatch,batterRunnerId:c.batterPlayerId,regulationInnings:innings,event:{kind:'field_play',facts:{...field.ruleFacts,buntAttempt:batting==='bunt'}}});
          if(result.kind==='unresolved')fieldFailure='RULE '+result.reason;}
      }catch(error){fieldFailure='FIELD_ERROR '+String((error as Error).message).slice(0,120);}
      if(fieldFailure===null)scoringInput=fieldWithLeads;
      else{
        // The world could not finish this play: settle it from the exit state so the game goes on.
        const simple=settleBattedBallV1({ball:outgoingMoment.ball,fenceRadiusMeters:park.fenceRadiusMeters,fenceHeightMeters:park.fenceHeightMeters,...(park.fenceShapeV1?{fenceShapeV1:park.fenceShapeV1}:{}),seed:input.seed,pitchOrdinal:pitchCount+1});
        field=null;fieldFallbackReason=fieldFailure;
        const contactTick=outgoingMoment.ball.tick,endTick=contactTick+Math.round(simple.seconds*tps);
        result=reducePlayableMatchV1({match:beforeMatch,batterRunnerId:c.batterPlayerId,regulationInnings:innings,event:{kind:'simple_batted',tick:endTick,outcome:simple.outcome}});
        for(let i=1;i<=60;i++){const u=i/60,p=simple.at(u*simple.seconds),tick=contactTick+Math.round(u*simple.seconds*tps);
          frames.push({...ready,tick,bat:null,phase:'field',possessedBy:null,ballKind:'batted',ball:{...outgoingMoment.ball,tick,position:p,visible:true,possessedBy:null}} as unknown as LiveMatchFrameV1);}
      }
      if(field)frames.push(...convertLiveFieldFramesV98({field,readyFrame:ready,defense:def.defense,battingTeam:c.team as 0|1,
        ticksPerSecond:tps,rules:result!,sampleBatAtTick:pitch.sampleBatAtTick}));
    }else{
      if(pitch.call===null)throw unresolvedV239('live baseball match: pitch ended without physical contact or secured count call','PITCH','PITCH_NO_CALL',{endedAtTick:pitch.endedAtTick,unsupportedReason:pitch.diagnostics.unsupportedReason,contact:pitch.contact,frames:pitch.frames,diagnostics:pitch.diagnostics});
      const hitByPitchV1=input.managerTacticsV1!==undefined&&!pickoffRun&&pitch.call==='ball'&&!pitch.diagnostics.swingOffered&&pitchHitsBatterV1(pitch.frames,ready.actors.find(a=>a.playerId===c.batterPlayerId)!.position,batter.heightMeters,input.hitByPitchV1?{ticksPerSecond:tps}:undefined);
      result=reducePlayableMatchV1({match:beforeMatch,batterRunnerId:c.batterPlayerId,regulationInnings:innings,event:hitByPitchV1?{kind:'hit_by_pitch',tick:pitch.endedAtTick}:pickoffRun?{kind:'loose_pitch',tick:pitch.endedAtTick,endTick:pickoffEndTick,call:pitch.call!,batterRuns:false,runners:(['first','second','third'] as const).flatMap((name,i)=>{const id=beforeMatch.bases[name];if(!id)return [];const out=id===pickoffIntent!.runnerId&&!pickoffRun!.safe;return [{runnerId:id,base:i+1,retired:out,scored:false,tick:pickoffEndTick,defenderId:out?input.teams[1-c.team].defense['1B']:null}];})}:stealRun?{kind:'loose_pitch',tick:pitch.endedAtTick,endTick:stealEndTick,call:pitch.call,batterRuns:false,runners:(['first','second','third'] as const).flatMap((name,i)=>{const id=beforeMatch.bases[name];if(!id)return [];const going=id===stealIntent!.runnerId;return [{runnerId:id,base:going&&stealRun!.safe?i+2:i+1,retired:going&&!stealRun!.safe,scored:false,tick:stealEndTick,defenderId:going?input.teams[1-c.team].defense[stealIntent!.target==='second'?'2B':'3B']:null}];})}:looseAdmission?{kind:'loose_pitch',tick:looseAdmission.eventTick,endTick:looseAdmission.endTick,call:pitch.call,batterRuns:looseAdmission.batterRuns,runners:looseAdmission.outcomes}:{kind:'pitch_call',tick:pitch.endedAtTick,call:pitch.call}});
    }
    if(result.kind==='unresolved')throw unresolvedV239('live baseball match: rule continuation unresolved: '+result.reason,'RULE','RULE_UNRESOLVED',{result,pitch:{endedAtTick:pitch.endedAtTick,contact:pitch.contact,diagnostics:pitch.diagnostics}});
    assert(result.kind==='applied','rule continuation unresolved: ');
    const rawForecastV151=pitch.diagnostics.batterObservationV151?.rawForecast,
      observedRegionV151=rawForecastV151?.prediction?classifyBatterCourseV79({position:rawForecastV151.prediction.position,
        zone:resolveLiveBattingSetupV94({...bp,heightMeters:batter.heightMeters,bats:batter.bats}).region}).courseId:null,
      observedEvidenceV151=rawForecastV151?createBatterObservedEvidenceV151({evidenceId:'observed-pitch:'+input.seed+':'+(pitchCount+1),
        observerPlayerId:c.batterPlayerId,pitcherId:c.pitcherPlayerId,pitchOrdinal:pitchCount+1,forecast:rawForecastV151,
        regionId:observedRegionV151===null?null:String(observedRegionV151)}):null,
      previousObservedMemoryV151=observedMemoriesV151.get(knowledgeKeyV122),
      nextObservedMemoryV151=observedEvidenceV151&&observedEvidenceV151.availableTick<=result.endedAtTick
        ?appendBatterObservedEvidenceV151(previousObservedMemoryV151??createEmptyBatterObservedMemoryV151({observerPlayerId:c.batterPlayerId,pitcherId:c.pitcherPlayerId}),
          observedEvidenceV151,observationPolicyV151!.memoryPolicy,result.endedAtTick):null;
    const nextRegionV222=regionPolicyV222&&nextObservedMemoryV151&&observedEvidenceV151
      ?createRegionSnapshotV222({evidence:observedEvidenceV151,...pitch.diagnostics.batterObservedRegionExperienceV222!.snapshot}):null;
    const localScoringV100=scoreLivePlayV100({before:beforeMatch,batterRunnerId:c.batterPlayerId,bunt:batting==='bunt',
      input:scoringInput,field,rules:result,regulationInnings:innings}),offenseKey=c.team===0?'away':'home',defenseKey=c.team===0?'home':'away',
      pendingOffense=c.team===0?'pendingAway':'pendingHome',pendingDefense=c.team===0?'pendingHome':'pendingAway';
    if(localScoringV100.hits!==null)hits[offenseKey]+=localScoringV100.hits;
    else if(result.batterAdvanced)hits[pendingOffense]++;
    errors[defenseKey]+=localScoringV100.errors.length;
    if(!localScoringV100.errorsComplete)errors[pendingDefense]++;
    // Truncate at the actual third out / walkoff, before starting bench movement.
    const acceptedFrames=frames.filter(f=>f.tick<=result.endedAtTick);
    if(!acceptedFrames.length)acceptedFrames.push(ready);
    if(result.halfChanged||result.gameOver){
      acceptedFrames.push(...buildLivePostPlayFramesV115({lastFrame:acceptedFrames.at(-1)!,field,readyFrame:ready,
        defense:input.teams[1-c.team].defense,battingTeam:c.team as 0|1,ticksPerSecond:tps,officialEndTick:result.endedAtTick}));
    }
    const row=line.find(r=>r.inning===beforeMatch.inning)!;
    row[beforeMatch.half==='top'?'away':'home']=(row[beforeMatch.half==='top'?'away':'home']??0)+result.scoredRunnerIds.length;
    if(workloadCandidateV122)workloadOwnerV122!.commitAfterAccepted(workloadCandidateV122);
    if(pendingBeliefV122&&command.batterEvidenceV122)knowledgeV122.set(knowledgeKeyV122,pendingBeliefV122);
    if(nextObservedMemoryV151)observedMemoriesV151.set(knowledgeKeyV122,nextObservedMemoryV151);
    if(nextRegionV222&&nextObservedMemoryV151){
      const retained=new Set(nextObservedMemoryV151.entries.map(entry=>entry.evidenceId));
      for(const [id,entry] of regionEntriesV222)if(entry.observerPlayerId===c.batterPlayerId&&entry.pitcherId===c.pitcherPlayerId&&!retained.has(id))regionEntriesV222.delete(id);
      regionEntriesV222.set(nextRegionV222.evidenceId,nextRegionV222);
    }
    const emotionOutcomeV1:LiveEmotionOutcomeV1|null=({home_run:'homer',base_hit:'hit',walk:'walk',hit_by_pitch:'walk',strikeout:'strikeout',ground_out:'out',fly_out:'out',foul_out:'out',fielders_choice:'out',reached_on_error:'out'} as Record<string,LiveEmotionOutcomeV1>)[localScoringV100.classification]??null;
    if(emotionTrackerV1&&emotionOutcomeV1){const b=beforeMatch.bases;
      emotionTrackerV1.observe({tick:result.endedAtTick,batterId:c.batterPlayerId,pitcherId:c.pitcherPlayerId,outcome:emotionOutcomeV1,inning:beforeMatch.inning,regulationInnings:innings,outs:beforeMatch.outs,
        runnersOn:[b.first,b.second,b.third].filter(x=>x!==null).length,scoringPosition:b.second!==null||b.third!==null,
        runDifference:c.team===0?beforeMatch.score.away-beforeMatch.score.home:beforeMatch.score.home-beforeMatch.score.away});}
    match=result.match;finished=result.gameOver;pitchCount++;
    if(result.batterAdvanced&&!result.batterRetainsTurnV1)battingOrderIndices[c.team]=(battingOrderIndices[c.team]+1)%9;
    if(result.halfChanged){let r=line.find(r=>r.inning===match.inning);if(!r){r={inning:match.inning,away:null,home:null};line.push(r);}r[match.half==='top'?'away':'home']=0;}
    nextTick=Math.max(result.endedAtTick,acceptedFrames.at(-1)!.tick)+2*tps;
    const record:LiveIssuedPitchV1=frozen({beforeMatch,match:cloneInert(match),frames:acceptedFrames,
      events:[...stealEvents,...(looseAdmission?[...looseAdmission.bodyEvents,...looseAdmission.facts]:field?.facts??[]),...result.outcomes.map(o=>({kind:'runner_out',...o})),{kind:'pitch_adjudicated',tick:result.endedAtTick,classification:result.classification}],
      command:cloneInert(command),play:{...(intentionalWalkV1&&result.classification==='walk'?{intentionalWalkV1:true}:{}),
        ...(stealRun&&input.catcherThrowV1?{stealV1:{runnerId:stealIntent!.runnerId,fromBase:stealIntent!.name as 'first'|'second',targetBase:stealIntent!.target as 'second'|'third',catcherPlayerId:input.teams[1-c.team].defense.C,
          receiverPlayerId:input.teams[1-c.team].defense[stealIntent!.target==='second'?'2B':'3B'],runnerStartTick:pitchOriginTickV1,catchTick:pitch.endedAtTick,throwStartTick:pitchOriginTickV1+Math.round(stealRun.releaseSeconds*tps),
          throwArrivalTick:pitchOriginTickV1+Math.round(stealRun.arrivalSeconds*tps),endTick:stealEndTick,exchangeSeconds:stealRun.exchangeSeconds,popSeconds:stealRun.arrivalSeconds-stealCatchSeconds-LIVE_CATCHER_THROW_CALIBRATION_V1.tagSeconds,safe:stealRun.safe}}:{}),
        ...(pickoffRun&&(input.runnerLeadV1||input.catcherThrowV1)?{pickoffV1:{runnerId:pickoffIntent!.runnerId,pitcherPlayerId:input.teams[1-c.team].defense.P,receiverPlayerId:input.teams[1-c.team].defense['1B'],base:'first' as const,
          startTick:pickoffStartTickV1,throwStartTick:pickoffStartTickV1+Math.round(pickoffRun.moveSeconds*tps),throwArrivalTick:pickoffStartTickV1+Math.round(pickoffRun.arrivalSeconds*tps),endTick:pickoffEndTick,
          leadMeters:Math.hypot(firstRunner!.position.x-LIVE_MATCH_BASES_V1.first.x,firstRunner!.position.z-LIVE_MATCH_BASES_V1.first.z),safe:pickoffRun.safe}}:{}),
        ...(input.runnerLeadV1?{runnerLeadsV1:(['first','second','third'] as const).flatMap(name=>{const id=beforeMatch.bases[name];if(!id)return [];
          const at=ready.actors.find(a=>a.playerId===id)!.position,from=LIVE_MATCH_BASES_V1[name];return [{runnerId:id,base:name,meters:Math.hypot(at.x-from.x,at.z-from.z)}];})}:{}),
        classification:result.classification,call:pitch.call,contact:fieldFallbackReason?{...pitch.contact,fieldFallbackV1:fieldFallbackReason} as typeof pitch.contact:pitch.contact,
        contactMoment:pitch.contactMoment,contactOrientation:pitch.contactOrientation,outgoingBallMoment,field,rules:result,localScoringV100,
        diagnostics:{...pitch.diagnostics,...(batterEvidenceReceptionV122?{batterEvidenceReceptionV122}:{}),
          ...(observationPolicyV151?{batterObservedMemoryUpdateV151:{status:nextObservedMemoryV151?'ACCEPTED_UNCLASSIFIED_OBSERVATION':'NO_DELIVERED_FORECAST_AT_CLOSURE',
            totalBefore:previousObservedMemoryV151?.totalObservations??0,totalAfter:nextObservedMemoryV151?.totalObservations??previousObservedMemoryV151?.totalObservations??0,
            evidence:observedEvidenceV151,pitchFamilyRecognized:false as const}}:{}),
          ...(traitPreferences?{traitPreferences}:{}),managerBaserunning:{instruction:runningInstruction,safetyMarginAdjustmentSeconds:runningMarginAdjustment,appliedToOffense:command.managedTeam===c.team}}},
      ...(emotionTrackerV1?{emotionMarksV1:emotionTrackerV1.marks()}:{}),requiresNextPitch:!finished,finished,batterPlayerId:c.batterPlayerId,pitcherPlayerId:c.pitcherPlayerId,pitchType:pitch.pitchType,
      ...(pitch.pitchId===undefined?{}:{pitchId:pitch.pitchId,pitchName:pitch.pitchName}),speedKmh:(pitch.diagnostics as any).loosePitchV1?.sourceProvenance?.legacySample?.acceleratedSpeedKmh??pitch.speedKmh,line:cloneInert(line),hits:{...hits},errors:{...errors}});
    history.push(record);return record;
  }
  const host=Object.freeze({issuePitch,inspect,captureContinuationV116});
  if(capability===undefined)previewHostsV257.set(host,{input,host});return host;
}


export type LiveYawPracticePreviewResultV257=Readonly<{status:'UNKNOWN';reason:'CORE_OBSERVATION_FAILED'|'HOST_BEFORE_CHANGED'|'HOST_BEFORE_UNVERIFIED'|'OWNER_INITIALIZATION_FAILED';yawMotionApplied:false;identityAuthority:'LOCAL_HOST_OBJECT_NOT_NATIVE';before:LiveMatchContinuationV116;revision:number;seed:number;request:LiveYawPracticeRequestV255;normalRecord:LiveIssuedPitchV1|null;trialRecord:LiveIssuedPitchV1|null;error:string}>|Readonly<{status:'HOLD';reason:'UNRESOLVED_LATE_POSSIBLE'|'CONFLICTING_PRACTICE_MODE';evidence:null;identityAuthority:'LOCAL_HOST_OBJECT_NOT_NATIVE';yawMotionApplied:false}>|Readonly<{status:'PROBE_ONLY';reason:'YAW_MOTION_NOT_CONNECTED';yawMotionApplied:false;identityAuthority:'LOCAL_HOST_OBJECT_NOT_NATIVE';before:LiveMatchContinuationV116;revision:number;seed:number;request:LiveYawPracticeRequestV255;normalRecord:LiveIssuedPitchV1;trialRecord:LiveIssuedPitchV1;continuationsEqual:true}>;
/** Non-committing seam only: V255 motion is intentionally not connected. */
/** Complete, side-effect-free comparison calculation; candidate adoption belongs to the practice owner. */
export function calculateLiveRobustEpisodePairV273(raw:Readonly<{configuration:LiveMatchInputV1;plan:LiveSpinEpisodePlanV242;slotIndex:number;before:LiveMatchContinuationV116;normalRequest:LiveBattingPracticeRequestV150}>) {
 const plan=cloneInert(raw.plan),declared=declareSpinPracticeEpisodesV242({scopeId:plan.scopeId,motor:plan.motor,criterion:plan.criterion,episodeSeeds:plan.episodes.map(x=>x.seed)});
 assert(encodeLiveSpinPracticeProofV239(plan)===encodeLiveSpinPracticeProofV239(declared),'paired episode declaration differs');
 const motor=plan.motor;assert(motor.version==='live_robust_contact_frame_motor_v248','paired episode requires robust motor');
 const configuration=deriveSpinEpisodeConfigurationV242(plan,raw.slotIndex,raw.configuration),before=cloneInert(raw.before),request=cloneInert(raw.normalRequest);
 assert(configuration.batterNeutralReactivePolicyV272?.version==='live_neutral_reactive_pair_policy_v273','paired policy required');
 assert(!Object.hasOwn(request,'observedSpinTrialV236')&&!Object.hasOwn(request,'spinMotorPracticePolicyV239'),'paired normal request contains trial');
 const selected=resolveLiveRobustContactFrameMotorPracticeV248({mode:'PRACTICE_EXPLICIT',subjectId:motor.subjectId,technique:motor.technique,clip:motor.clip,domain:motor.domain,motors:[motor]});assert(selected.status==='READY_PRACTICE','episode motor unavailable');
 const policy={version:'live_spin_motor_practice_policy_v239' as const,subjectId:motor.subjectId,motorId:motor.motorId,motorVersion:motor.motorVersion,clip:motor.clip},offense=before.match.half==='top'?0:1,normalCommand=commandFor({...request,spinMotorPracticePolicyV239:policy},offense);
 const normal=createLiveBaseballMatchWorkerInternalV257(configuration,before,pairCapabilityV273);assert(normal.inspect().batterPlayerId===motor.subjectId,'paired target differs');
 let normalRecord:LiveIssuedPitchV1,normalAfter:LiveMatchContinuationV116;
 try{normalRecord=normal.issuePitch(normalCommand);normalAfter=normal.captureContinuationV116()}catch(error){if(isLiveBaseballUnresolvedV239(error))return {kind:'NORMAL_HOLD' as const,unresolved:error.unresolvedV239};throw error}
 try{const trialHost=createLiveBaseballMatchWorkerInternalV257(configuration,before,pairCapabilityV273);const trialRecord=trialHost.issuePitch(commandFor({...request,spinMotorPracticePolicyV239:policy,observedSpinTrialV236:selected.request},offense));return {kind:'COMPLETE' as const,normalRecord,normalAfter,trialRecord,after:trialHost.captureContinuationV116(),inspection:trialHost.inspect()}}
 catch(error){if(isLiveBaseballUnresolvedV239(error))return {kind:'TRIAL_HOLD' as const,normalRecord,normalAfter,unresolved:error.unresolvedV239};throw Object.assign(new Error('paired trial failed',{cause:error}),{normalRecord,normalAfter})}
}
/** Non-adopting diagnostic pair: never returns a Host or candidate accepted by an owner. */
async function calculateLiveYawEpisodeDiagnosticInternalV275(raw:Readonly<{configuration:LiveMatchInputV1;plan:LiveSpinEpisodePlanV242;slotIndex:number;before:LiveMatchContinuationV116;normalRequest:LiveBattingPracticeRequestV150}>,capability:typeof yawDiagnosticCapabilityV274|typeof yawDiagnosticCapabilityV275|typeof yawDiagnosticCapabilityV276) {
 const plan=cloneInert(raw.plan),declared=declareSpinPracticeEpisodesV242({scopeId:plan.scopeId,motor:plan.motor,criterion:plan.criterion,episodeSeeds:plan.episodes.map(x=>x.seed)});
 assert(encodeLiveSpinPracticeProofV239(plan)===encodeLiveSpinPracticeProofV239(declared),'yaw diagnostic episode declaration differs');
 const motor=plan.motor;assert(motor.version==='live_contact_frame_motor_v244','yaw diagnostic requires V244 practice motor');
 const configuration=deriveSpinEpisodeConfigurationV242(plan,raw.slotIndex,raw.configuration),before=cloneInert(raw.before),request=cloneInert(raw.normalRequest);
 assert(configuration.batterNeutralReactivePolicyV272===undefined&&configuration.batterReactiveDirectionPolicyV251===undefined,'yaw diagnostic conflicts with active direction policy');
 assert(!Object.hasOwn(request,'observedSpinTrialV236')&&!Object.hasOwn(request,'spinMotorPracticePolicyV239'),'yaw diagnostic normal request contains trial');
 const selected=resolveLiveContactFrameMotorPracticeV244({mode:'PRACTICE_EXPLICIT',subjectId:motor.subjectId,technique:motor.technique,clip:motor.clip,domain:motor.domain,motors:[motor]});assert(selected.status==='READY_PRACTICE','yaw diagnostic motor unavailable');
 const policy={version:'live_spin_motor_practice_policy_v239' as const,subjectId:motor.subjectId,motorId:motor.motorId,motorVersion:motor.motorVersion,clip:motor.clip},offense=before.match.half==='top'?0:1,normalCommand=commandFor({...request,spinMotorPracticePolicyV239:policy},offense);
 const normal=createLiveBaseballMatchWorkerV116(configuration,before);assert(normal.inspect().batterPlayerId===motor.subjectId,'yaw diagnostic target differs');
 let normalRecord:LiveIssuedPitchV1,normalAfter:LiveMatchContinuationV116;
 try{normalRecord=normal.issuePitch(normalCommand);normalAfter=normal.captureContinuationV116()}catch(error){if(isLiveBaseballUnresolvedV239(error))return {status:'HOLD' as const,attempt:'NORMAL' as const,unresolved:error.unresolvedV239};throw error}
 const normalAfterSha256=await hashLiveSpinPracticeProofV239(normalAfter);
 let trialHost:ReturnType<typeof createLiveBaseballMatchWorkerInternalV257>|undefined;
 try{trialHost=createLiveBaseballMatchWorkerInternalV257(configuration,before,capability);const trialCommand=commandFor({...request,spinMotorPracticePolicyV239:policy,observedSpinTrialV236:selected.request},offense),trialRecord=trialHost.issuePitch(trialCommand),trialAfterSha256=await hashLiveSpinPracticeProofV239(trialHost.captureContinuationV116()),decisionEvidence=await consumeYawEvidenceV274(trialHost);return {status:'OBSERVED' as const,normalRecord,normalAfterSha256,trialRecord,trialAfterSha256,decisionEvidence}}
 catch(error){const decisionEvidence=await consumeYawEvidenceV274(trialHost);if(isLiveBaseballUnresolvedV239(error))return {status:'HOLD' as const,attempt:'TRIAL' as const,unresolved:error.unresolvedV239,normalRecord,normalAfterSha256,decisionEvidence};if(error instanceof Error&&'yawDiagnosticStatus' in error){const baselineV244Decision='baselineV244Decision' in error?error.baselineV244Decision:null;return error.yawDiagnosticStatus==='NO_TARGET'?{status:'NOT_EXECUTED' as const,reason:String(error.message),normalRecord,normalAfterSha256,baselineV244Decision,decisionEvidence}:{status:'HOLD' as const,attempt:'TRIAL' as const,reason:String(error.message),normalRecord,normalAfterSha256,baselineV244Decision,decisionEvidence};}throw Object.assign(new Error('yaw diagnostic trial failed',{cause:error}),{normalRecord,normalAfterSha256,decisionEvidence})}
}
export const calculateLiveYawEpisodeDiagnosticV274=(raw:Parameters<typeof calculateLiveYawEpisodeDiagnosticInternalV275>[0])=>calculateLiveYawEpisodeDiagnosticInternalV275(raw,yawDiagnosticCapabilityV274);
export const calculateLiveYawEpisodeDiagnosticV275=(raw:Parameters<typeof calculateLiveYawEpisodeDiagnosticInternalV275>[0])=>calculateLiveYawEpisodeDiagnosticInternalV275(raw,yawDiagnosticCapabilityV275);
export const calculateLiveYawEpisodeDiagnosticV276=(raw:Parameters<typeof calculateLiveYawEpisodeDiagnosticInternalV275>[0])=>calculateLiveYawEpisodeDiagnosticInternalV275(raw,yawDiagnosticCapabilityV276);
export function createLiveYawPracticePreviewV257(raw:Readonly<{host:object;request:LiveYawPracticeRequestV255;command:LivePitchCommandV1}>) {
 const found=previewHostsV257.get(raw?.host);assert(found,'yaw practice requires a local Host object');const owned=found;
 const request=cloneInert(raw.request),command=cloneInert(raw.command),keys=(v:unknown,k:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
 assert(keys(raw,['host','request','command'])&&keys(request,['version','subjectId','technique','clip','domain','policy','thresholds'])&&request.version==='live_observed_yaw_contact_frame_trial_v255'&&typeof request.subjectId==='string'&&request.subjectId.trim()===request.subjectId&&request.subjectId.length>0&&request.subjectId.length<=200&&['BACKSPIN','TOPSPIN','HOOK','SLICE'].includes(request.technique)&&keys(request.clip,['id','sourceSha256','bats'])&&typeof request.clip.id==='string'&&request.clip.id.trim()===request.clip.id&&request.clip.id.length>0&&request.clip.id.length<=200&&/^[a-f0-9]{64}$/.test(request.clip.sourceSha256)&&['R','L'].includes(request.clip.bats)&&keys(request.domain,['plateZ','coordinateSystem'])&&Number.isFinite(request.domain.plateZ)&&request.domain.coordinateSystem==='LIVE_WORLD_METERS_V1'&&request.policy==='FIXED_17_YAW_UNCALIBRATED_V255'&&keys(request.thresholds,['minimumComponent','minimumImprovement'])&&Number.isFinite(request.thresholds.minimumComponent)&&request.thresholds.minimumComponent>0&&Number.isFinite(request.thresholds.minimumImprovement)&&request.thresholds.minimumImprovement>0,'invalid yaw practice declaration');
 assert(!Object.hasOwn(command,'observedSpinTrialV236')&&!Object.hasOwn(command,'spinMotorPracticePolicyV239'),'yaw practice command conflict');
 const before=owned.host.captureContinuationV116(),current=owned.host.inspect(),player=owned.input.players.find(p=>p.playerId===current.batterPlayerId);assert(player&&current.batterPlayerId===request.subjectId&&command.managedTeam===current.team,'yaw practice subject differs');
 const physical=resolveLiveMatchPlayerPhysicalV98(player),clip=owned.input.measuredClips.find(c=>c.id===physical.clipId&&c.side===player.bats&&c.source.sha256===request.clip.sourceSha256);
 assert(physical.clipId===request.clip.id&&player.bats===request.clip.bats&&clip,'yaw practice clip differs');const setup=resolveLiveBattingSetupV94({...physical,heightMeters:player.heightMeters,bats:player.bats});assert(Object.is(setup.contactPlaneZ,request.domain.plateZ),'yaw practice domain differs');
 assert(owned.input.batterObservationV151!==undefined&&owned.input.batterDirectionMotorV153!==undefined,'yaw practice observation/motor missing');
 const late=physical.plateVision!==undefined&&lateEvidenceHeadroomV121(resolveLivePlateVisionV1(physical))>0;
 const conflicting=owned.input.batterReactiveDirectionPolicyV251!==undefined||owned.input.batterNeutralReactivePolicyV272!==undefined||physical.spinControlV123!==undefined||command.battingDirectionRequestV149!==undefined&&command.battingDirectionRequestV149.mode!=='AUTO';
 const original=encodeLiveSpinPracticeProofV239(before),seed=(owned.input.seed+Math.imul(before.pitchCount+1,0x9e3779b9))>>>0,contract=encodeLiveSpinPracticeProofV239({request,command});
 let registry=sealedPreviewRegistryV258.get(owned.host);if(!registry){registry=new Map();sealedPreviewRegistryV258.set(owned.host,registry)}const prior=registry.get(original);if(prior){assert(prior.contract===contract,'yaw practice opportunity conflict');return prior.facade}
 let cached:Promise<LiveYawPracticePreviewResultV257>|undefined,sealedUnknown=false,inFlight=false,started=false;
 const ensureCurrent=()=>assert(encodeLiveSpinPracticeProofV239(owned.host.captureContinuationV116())===original,'yaw practice Host before changed');
 function preview():Promise<LiveYawPracticePreviewResultV257>{if(cached&&(sealedUnknown||inFlight||initializationLatchV258.get(owned.host)?.failed))return cached;if(initializationLatchV258.get(owned.host)?.failed){sealedUnknown=true;cached=Promise.resolve(frozen({status:'UNKNOWN' as const,reason:'OWNER_INITIALIZATION_FAILED' as const,yawMotionApplied:false as const,identityAuthority:'LOCAL_HOST_OBJECT_NOT_NATIVE' as const,before,revision:before.pitchCount,seed,request,normalRecord:null,trialRecord:null,error:'owner initialization failed'}));return cached}ensureCurrent();if(cached)return cached;
  if(late||conflicting){const result=frozen({status:'HOLD' as const,reason:late?'UNRESOLVED_LATE_POSSIBLE' as const:'CONFLICTING_PRACTICE_MODE' as const,evidence:null,identityAuthority:'LOCAL_HOST_OBJECT_NOT_NATIVE' as const,yawMotionApplied:false as const});cached=Promise.resolve(result);return cached}
  started=true;inFlight=true;cached=Promise.resolve().then(()=>{let normalRecord:LiveIssuedPitchV1|null=null,normalAfter:LiveMatchContinuationV116|null=null,trialRecord:LiveIssuedPitchV1|null=null,trialAfter:LiveMatchContinuationV116|null=null,unknownReason:'CORE_OBSERVATION_FAILED'|'HOST_BEFORE_CHANGED'|'HOST_BEFORE_UNVERIFIED'='CORE_OBSERVATION_FAILED';
   const ensureDuring=()=>{let currentKey:string;try{currentKey=encodeLiveSpinPracticeProofV239(owned.host.captureContinuationV116())}catch(error){unknownReason='HOST_BEFORE_UNVERIFIED';throw error}if(currentKey!==original){unknownReason='HOST_BEFORE_CHANGED';throw Error('yaw practice Host before changed')}};
   try{ensureDuring();const normalHost=createLiveBaseballMatchWorkerInternalV257(owned.input,before,previewCapabilityV257),trialHost=createLiveBaseballMatchWorkerInternalV257(owned.input,before,previewCapabilityV257);assert(encodeLiveSpinPracticeProofV239(normalHost.captureContinuationV116())===original&&encodeLiveSpinPracticeProofV239(trialHost.captureContinuationV116())===original,'yaw practice private Host before differs');normalRecord=normalHost.issuePitch(command);normalAfter=normalHost.captureContinuationV116();trialRecord=trialHost.issuePitch({...command,observedSpinTrialV236:request});trialAfter=trialHost.captureContinuationV116();assert(encodeLiveSpinPracticeProofV239(normalAfter)===encodeLiveSpinPracticeProofV239(trialAfter)&&encodeLiveSpinPracticeProofV239(normalRecord.play)===encodeLiveSpinPracticeProofV239(trialRecord.play),'yaw practice no-motion pair differs');ensureDuring();
    return frozen({status:'PROBE_ONLY' as const,reason:'YAW_MOTION_NOT_CONNECTED' as const,yawMotionApplied:false as const,identityAuthority:'LOCAL_HOST_OBJECT_NOT_NATIVE' as const,before,revision:before.pitchCount,seed,request,normalRecord,trialRecord,continuationsEqual:true as const});
   }catch(error){sealedUnknown=true;return frozen({status:'UNKNOWN' as const,reason:unknownReason,yawMotionApplied:false as const,identityAuthority:'LOCAL_HOST_OBJECT_NOT_NATIVE' as const,before,revision:before.pitchCount,seed,request,normalRecord,trialRecord,error:String(error instanceof Error?error.message:error)});}}).finally(()=>{inFlight=false});return cached;
 }
 const facade=Object.freeze({preview});previewControlV258.set(facade,{state:()=>!started?'NOT_STARTED':inFlight?'IN_FLIGHT':'COMPLETED',evidence:()=>cached});registry.set(original,{contract,facade});return facade;
}

const sealedYawOwnersV258=new WeakMap<object,Map<string,{contract:string;owner:Promise<ReturnType<typeof sealYawOwnerViewV258>|ReturnType<typeof failedYawOwnerV258>>}>>();
function sealYawOwnerViewV258(owner:Awaited<ReturnType<typeof createSealedPracticeOwnerV256>>,before:LiveMatchContinuationV116){
 const view={before,revision:before.pitchCount};return Object.freeze({preview:()=>owner.preview('v255-opportunity',view),inspect:owner.inspect,snapshot:owner.snapshot});
}

function failedYawOwnerV258(before:LiveMatchContinuationV116|null,request:LiveYawPracticeRequestV255|null,command:LivePitchCommandV1|null,stage:'BEFORE_OR_CLONE'|'OWNER_INITIALIZATION',control?:{state:()=>('NOT_STARTED'|'IN_FLIGHT'|'COMPLETED');evidence:()=>Promise<LiveYawPracticePreviewResultV257>|undefined}){
 const coreState=control?.state()??'UNKNOWN',prior=control?.evidence();
 let cause:'BEFORE_OR_CLONE_FAILED'|'CRYPTO_UNAVAILABLE'|'OWNER_INITIALIZATION_FAILED'=stage==='BEFORE_OR_CLONE'?'BEFORE_OR_CLONE_FAILED':'OWNER_INITIALIZATION_FAILED';try{if(stage==='OWNER_INITIALIZATION'&&!globalThis.crypto?.subtle)cause='CRYPTO_UNAVAILABLE'}catch{/* The failure view must not depend on a working crypto accessor. */}
 const base=frozen({version:'sealed_yaw_initialization_failure_v258' as const,status:'UNKNOWN' as const,reason:'INITIALIZATION_FAILED' as const,cause,execution:'NOT_EXECUTED' as const,executionScope:'V258_EXECUTOR_ONLY' as const,stage,identity:'UNVERIFIED' as const,opportunityId:null,before,request,command,coreState,planned:1 as const,unresolved:1 as const,committed:0 as const,pending:0 as const});
 let savedEvidence:Readonly<{status:'UNKNOWN'|'PROBE_ONLY'|'HOLD';normalRecord:LiveIssuedPitchV1|null;trialRecord:LiveIssuedPitchV1|null}>|null=null;
 const snapshot=()=>frozen({...base,evidence:savedEvidence,authority:'CALLER_DECLARED_NOT_AUTHENTICATED' as const,slots:[{opportunityId:null,status:'UNKNOWN' as const}]});
 const result=prior?prior.then(observed=>{savedEvidence=frozen(observed.status==='HOLD'?{status:'HOLD' as const,normalRecord:null,trialRecord:null}:{status:observed.status,normalRecord:observed.normalRecord,trialRecord:observed.trialRecord});return frozen({...base,evidence:savedEvidence})},()=>frozen({...base,evidence:null})):Promise.resolve(frozen({...base,evidence:null}));
 return Object.freeze({preview:()=>result,inspect:snapshot,snapshot});
}
/** One local Host opportunity only. No commit authority or arbitrary executor is exposed. */
export async function createSealedYawPracticeV258(raw:Readonly<{host:object;request:LiveYawPracticeRequestV255;command:LivePitchCommandV1;displayLabel:string}>){
 assert(raw&&typeof raw==='object'&&Object.keys(raw).sort().join('|')==='command|displayLabel|host|request'&&typeof raw.displayLabel==='string'&&raw.displayLabel.length>0&&raw.displayLabel.length<=200&&raw.displayLabel.trim()===raw.displayLabel,'invalid sealed yaw declaration');
 const owned=previewHostsV257.get(raw.host);assert(owned,'sealed yaw requires a local Host object');
 let latch=initializationLatchV258.get(owned.host);if(!latch){latch={failed:false};initializationLatchV258.set(owned.host,latch)}
 if(latch.failed&&latch.failure){if(latch.contract!==undefined)assert(encodeLiveSpinPracticeProofV239({request:raw.request,command:raw.command})===latch.contract,'sealed yaw opportunity conflict');return latch.failure}
 let registry=sealedYawOwnersV258.get(owned.host);if(!registry){registry=new Map();sealedYawOwnersV258.set(owned.host,registry)}
 const unavailable=registry.get('BEFORE_UNAVAILABLE');if(unavailable)return unavailable.owner;
 let before:LiveMatchContinuationV116,anchor:string,request:LiveYawPracticeRequestV255,command:LivePitchCommandV1,contract:string,safeBefore:LiveMatchContinuationV116|null=null;
 try{before=owned.host.captureContinuationV116();anchor=encodeLiveSpinPracticeProofV239(before);safeBefore=before;request=cloneInert(raw.request);command=cloneInert(raw.command);contract=encodeLiveSpinPracticeProofV239({request,command})}catch{latch.failed=true;const prior=sealedPreviewRegistryV258.get(owned.host),only=prior?.size===1?prior.values().next().value:undefined;const owner=Promise.resolve(failedYawOwnerV258(safeBefore,null,null,'BEFORE_OR_CLONE',only?previewControlV258.get(only.facade):undefined));latch.failure=owner;registry.set('BEFORE_UNAVAILABLE',{contract:'UNAVAILABLE',owner});return owner}
 if(latch.failed&&latch.failure)return latch.failure;
 const direct=createLiveYawPracticePreviewV257({host:raw.host,request,command});
 const old=registry.get(anchor);if(old){assert(old.contract===contract,'sealed yaw opportunity conflict');return old.owner}
 const current=owned.host.inspect(),player=owned.input.players.find(p=>p.playerId===current.batterPlayerId);assert(player,'sealed yaw subject unavailable');const physical=resolveLiveMatchPlayerPhysicalV98(player),latePossible=physical.plateVision!==undefined&&lateEvidenceHeadroomV121(resolveLivePlateVisionV1(physical))>0;
 const promise=Promise.resolve().then(async()=>{const seed=(owned.input.seed+Math.imul(before.pitchCount+1,0x9e3779b9))>>>0;
  const plan={version:'sealed_practice_plan_v256' as const,initialBefore:before,initialRevision:before.pitchCount,slots:[{slotId:'v255-opportunity',configuration:owned.input,before,revision:before.pitchCount,seed,policy:request,source:{authority:'LOCAL_HOST_MODULE_NOT_NATIVE' as const,clip:request.clip},normalCommand:command,trialCommand:{...command,observedSpinTrialV236:request},latePossible}]};
  const owner=await createSealedPracticeOwnerV256(plan,async()=>{const observed=await direct.preview();
   if(observed.status==='UNKNOWN')return {proof:{version:'sealed_practice_unknown_proof_v258' as const,planner:'UNKNOWN' as const,execution:'NOT_APPLICABLE' as const,reason:observed.reason},normalRecord:observed.normalRecord,trialRecord:observed.trialRecord,normalAfter:null,trialAfter:null};
   if(observed.status==='HOLD')return {proof:{planner:'UNRESOLVED' as const,execution:'NOT_APPLICABLE' as const,reason:observed.reason},normalRecord:null,trialRecord:null,normalAfter:null,trialAfter:null};
   return {proof:{planner:'UNRESOLVED' as const,execution:'NOT_APPLICABLE' as const,reason:'YAW_MOTION_NOT_CONNECTED'},normalRecord:observed.normalRecord,trialRecord:observed.trialRecord,normalAfter:null,trialAfter:null};
  });try{if(encodeLiveSpinPracticeProofV239(owned.host.captureContinuationV116())!==anchor)owner.interrupt('v255-opportunity')}catch{owner.interrupt('v255-opportunity')}return sealYawOwnerViewV258(owner,before);
 }).catch(()=>{latch.failed=true;latch.contract=contract;const failed=failedYawOwnerV258(before,request,command,'OWNER_INITIALIZATION',previewControlV258.get(direct));latch.failure=Promise.resolve(failed);return failed});registry.set(anchor,{contract,owner:promise});return promise;
}
export async function readSealedYawPracticeV258(raw:unknown){
 if(!raw||typeof raw!=='object'||(raw as {version?:unknown}).version!=='sealed_yaw_initialization_failure_v258')return readSealedPracticeSnapshotV256(raw);
 const x=cloneInert(raw) as ReturnType<ReturnType<typeof failedYawOwnerV258>['snapshot']>;
 assert(Object.keys(x).sort().join('|')==='authority|before|cause|command|committed|coreState|evidence|execution|executionScope|identity|opportunityId|pending|planned|reason|request|slots|stage|status|unresolved|version'&&x.authority==='CALLER_DECLARED_NOT_AUTHENTICATED'&&x.status==='UNKNOWN'&&x.reason==='INITIALIZATION_FAILED'&&['BEFORE_OR_CLONE_FAILED','CRYPTO_UNAVAILABLE','OWNER_INITIALIZATION_FAILED'].includes(x.cause)&&x.execution==='NOT_EXECUTED'&&x.executionScope==='V258_EXECUTOR_ONLY'&&x.identity==='UNVERIFIED'&&x.opportunityId===null&&x.planned===1&&x.unresolved===1&&x.committed===0&&x.pending===0&&['BEFORE_OR_CLONE','OWNER_INITIALIZATION'].includes(x.stage)&&['NOT_STARTED','IN_FLIGHT','COMPLETED','UNKNOWN'].includes(x.coreState)&&(x.evidence===null||typeof x.evidence==='object'&&Object.keys(x.evidence).sort().join('|')==='normalRecord|status|trialRecord'&&['UNKNOWN','PROBE_ONLY','HOLD'].includes(x.evidence.status))&&Array.isArray(x.slots)&&x.slots.length===1&&Object.keys(x.slots[0]).sort().join('|')==='opportunityId|status'&&x.slots[0].opportunityId===null&&x.slots[0].status==='UNKNOWN','invalid sealed yaw failure snapshot');
 return frozen({...x,authority:'SELF_REPORTED_NOT_AUTHENTICATED' as const});
}

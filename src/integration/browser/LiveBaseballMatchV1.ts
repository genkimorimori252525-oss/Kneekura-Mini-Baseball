import { liveFielderBodyControlBoundsV105, resolveLiveFielderBodyModelV105, type LiveFielderBodyPoseV105 } from '../../core/sim/fielding/LiveFielderBodyGeometryV105';
import { BASEBALL_SURFACES_V101 } from '../../core/sim/ball/BaseballSurfaceCalibrationV101';
import {liveAthleticControlBoundsV115,validateLiveAthleticControlsV115} from '../../core/sim/LiveAthleticControlsV115';
import { LIVE_THROW_EFFORT_POLICY_V103 } from '../../core/sim/fielding/LiveThrowActionV103';
import type { BaseballGroundMaterial } from '../../core/sim/ball/BaseballGroundDynamics';
import { resolveLiveTechnicalTraitsV75 } from './LiveTraitProfilesV1';
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
import { simulateLivePitchV1, type LiveMeasuredClipV1, type LivePitchInputV1 } from './LivePitchV1';
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
export type LiveMatchInputV1 = Readonly<{seed:number;innings?:number;teams:readonly [LiveTeamV1,LiveTeamV1];players:readonly LivePlayerV1[];
  communicationScopeV122?:Readonly<{sessionId:string;matchId:string;managerId:string}>;
  workloadV122?:LiveMatchWorkloadConfigV122;
  batterKnowledgeV122?:readonly BatterBeliefV122[];
  batterObservationV151?:LiveBatterObservationPolicyV151;
  batterObservedRegionExperienceV222?:BatterObservedRegionExperiencePolicyV222;
  batterDirectionMotorV153?:ObservedDirectionMotorPolicyV153;
  /** MATCH roots; per-play overrides are derived with the global pitch ordinal. */
  randomnessV152?:LiveRandomnessV152;
  measuredClips:readonly LiveMeasuredClipV1[];park?:Readonly<{fenceRadiusMeters:number;fenceHeightMeters:number;groundMaterialV101?:BaseballGroundMaterial;
    poleEquipmentV148?:LiveFieldPlayInputV1['field']['poleEquipmentV148']}>}>;
export type LivePitchCommandV1 = Readonly<{batting:'auto'|'balanced'|'contact'|'power'|'take'|'bunt';pitchType:string;pitchId?:string;location:string;managedTeam:0|1;
  /** Already received/understood instruction; the communication owner supplies soft acceptance. */
  swingInstructionV121?:SwingInstructionV121;
  battingDirectionRequestV149?:BattingDirectionRequestV149;
  observedSpinTrialV236?:LivePitchInputV1['observedSpinTrialV236'];
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
  beforeMatch:CanonicalMatchState;match:CanonicalMatchState;frames:readonly LiveMatchFrameV1[];events:readonly unknown[];
  play:Readonly<{classification:string;call:'ball'|'called_strike'|'swinging_strike'|null;contact:unknown;
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
export function resolveLiveMatchPlayerPhysicalV98(player:LivePlayerV1):LivePlayerPhysicalV1{
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
export type LiveMatchContinuationV116=Readonly<{version:'live_match_continuation_v116';seed:number;innings:number;
 match:CanonicalMatchState;pitchCount:number;nextTick:number;finished:boolean;
 hits:Readonly<{away:number;home:number;pendingAway:number;pendingHome:number}>;
 errors:Readonly<{away:number;home:number;pendingAway:number;pendingHome:number}>;
 battingOrderIndices:readonly number[];line:readonly Readonly<{inning:number;away:number|null;home:number|null}>[];
 workloadV122?:LiveMatchWorkloadContinuationV122;
 poleScopeBindingV148?:string;
 batterKnowledgeV122?:Readonly<{initialBinding:string;beliefs:readonly BatterBeliefV122[]}>;
 batterObservedMemoryV151?:Readonly<{policyBinding:string;memories:readonly BatterObservedMemoryV151[]}>;
 batterObservedRegionExperienceV222?:Readonly<{policyBinding:string;entries:readonly BatterObservedRegionEvidenceV222[]}>;
 randomnessBindingV152?:string;directionMotorBindingV153?:string}>;
export function createLiveBaseballMatchV1(raw:LiveMatchInputV1){
 const host=createLiveBaseballMatchWorkerV116(raw);
 return Object.freeze({issuePitch:host.issuePitch,inspect:host.inspect});
}
export function createLiveBaseballMatchWorkerV116(raw:LiveMatchInputV1,resume?:LiveMatchContinuationV116){
  const input=cloneMatchInputWithMeasuredCatalogV68(raw),innings=input.innings??9,tps=LIVE_MATCH_PHYSICS_V1.air.ticksPerSecond,
    matchPhysicsV101=input.park?.groundMaterialV101 ? createAeroGroundBallPhysicsProfile({...LIVE_MATCH_PHYSICS_V1,ground:{...LIVE_MATCH_PHYSICS_V1.ground,material:input.park.groundMaterialV101}}) : LIVE_MATCH_PHYSICS_V1;
  const observationPolicyV151=input.batterObservationV151===undefined?undefined:validateLiveBatterObservationPolicyV151(input.batterObservationV151);
  const regionPolicyV222=input.batterObservedRegionExperienceV222===undefined?undefined:validateObservedRegionPolicyV222(input.batterObservedRegionExperienceV222);
  assert(regionPolicyV222===undefined||observationPolicyV151!==undefined,'region experience requires position-only observation policy');
  const directionMotorPolicyV153=input.batterDirectionMotorV153===undefined?undefined:validateObservedDirectionMotorV153(input.batterDirectionMotorV153),
    directionMotorBindingV153=directionMotorPolicyV153===undefined?undefined:JSON.stringify(directionMotorPolicyV153);
  assert(directionMotorPolicyV153===undefined||observationPolicyV151!==undefined,'direction motor requires position-only observation policy');
  const randomnessPolicyV152=input.randomnessV152===undefined?undefined:validateLiveRandomnessV152(input.randomnessV152,'MATCH'),
    randomnessBindingV152=randomnessPolicyV152===undefined?undefined:JSON.stringify(randomnessPolicyV152);
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

  const captureContinuationV116=():LiveMatchContinuationV116=>frozen({version:'live_match_continuation_v116',seed:input.seed,innings,
    match:cloneInert(match),pitchCount,nextTick,finished,hits:{...hits},errors:{...errors},
    ...(poleScopeBindingV148===undefined?{}:{poleScopeBindingV148}),
    ...(randomnessBindingV152===undefined?{}:{randomnessBindingV152}),
    ...(directionMotorBindingV153===undefined?{}:{directionMotorBindingV153}),
    battingOrderIndices:[...battingOrderIndices],line:cloneInert(line),...(workloadOwnerV122?{workloadV122:workloadOwnerV122.capture()}: {}),
    ...(input.batterKnowledgeV122===undefined?{}:{batterKnowledgeV122:captureKnowledgeV122()}),
    ...(observationPolicyV151===undefined?{}:{batterObservedMemoryV151:captureObservedMemoryV151()}),
    ...(regionPolicyV222===undefined?{}:{batterObservedRegionExperienceV222:captureRegionV222()})});
  const offense=()=>match.half==='top'?0:1;
  const current=()=>{const team=offense();return {team,batterPlayerId:input.teams[team].battingOrder[battingOrderIndices[team]],pitcherPlayerId:input.teams[1-team].pitcherId};};
  const readyFrame=():LiveMatchFrameV1=>{
    const c=current(),def=input.teams[1-c.team],batter=players.get(c.batterPlayerId)!;
    return frozen({tick:nextTick,ball:{position:{x:0,y:1.8,z:16.4},velocity:zero(),spin:zero(),orientation:IDENTITY_QUATERNION,visible:false},bat:null,
      actors:[...positions.map(role=>({playerId:def.defense[role],role,team:1-c.team,position:{...placements[role],y:0},velocity:zero()})),
        {playerId:c.batterPlayerId,role:'batter' as const,team:c.team,position:resolveLiveBattingSetupV94({heightMeters:batter.heightMeters,bats:batter.bats,...batter.physical}).bodyPosition,velocity:zero()},
        ...(['first','second','third'] as const).flatMap(name=>match.bases[name]?[{playerId:match.bases[name]!,role:'runner' as const,team:c.team,
          position:LIVE_MATCH_BASES_V1[name],velocity:zero()}]:[])],
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
    assert(!finished,'game already finished');
    assert(command&&['auto','balanced','contact','power','take','bunt'].includes(command.batting)&&[0,1].includes(command.managedTeam),'invalid manager command');
    assert(command.baserunning===undefined||['conservative','balanced','aggressive'].includes(command.baserunning),'invalid manager baserunning command');
    const derivedRandomnessV152=randomnessPolicyV152===undefined?undefined:deriveLivePlayRandomnessV152(randomnessPolicyV152,pitchCount+1),
      requestedRandomnessV152=command.randomnessV152===undefined?undefined:validateLiveRandomnessV152(command.randomnessV152,'PLAY'),
      playRandomnessV152=requestedRandomnessV152===undefined?derivedRandomnessV152:validateLiveRandomnessV152({...requestedRandomnessV152,
        ...(derivedRandomnessV152?.overrides===undefined&&requestedRandomnessV152.overrides===undefined?{}
          :{overrides:{...derivedRandomnessV152?.overrides,...requestedRandomnessV152.overrides}})},'PLAY');
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
      batting=managedOffense&&command.batting!=='auto'?command.batting:personalBatting,
      pitchTypeCommand=command.managedTeam===1-c.team?command.pitchType:'auto',
      traitPreferences=command.batting==='auto'||batterPreference.swingMode!=='BALANCED'||pitcherPreference.pitchApproach!=='BALANCED'?{
        batting:{preference:batterPreference.swingMode,resolvedCommand:batting,source:managedOffense&&command.batting!=='auto'?'manager_command':'player_preference',
          overrideReason:managedOffense?(command.batting==='auto'?'manager_auto':'explicit_manager_batting'):'unmanaged_offense'},
        pitching:{preference:pitcherPreference.pitchApproach,pitchTypeCommand,source:pitchTypeCommand==='auto'?'player_preference':'manager_command',
          overrideReason:pitchTypeCommand!=='auto'?'explicit_manager_pitch':command.managedTeam===1-c.team?'manager_auto':'unmanaged_pitcher'},
      }:null;
    if(command.observedSpinTrialV236!==undefined)assert(managedOffense&&command.observedSpinTrialV236.subjectId===c.batterPlayerId,'spin trial subject must be the current managed batter');
    const runningInstruction=command.managedTeam===c.team?(command.baserunning??'balanced'):'balanced',
      runningMarginAdjustment=runningInstruction==='aggressive'?-.25:runningInstruction==='conservative'?.25:0;
    const pitch=simulateLivePitchV1({originTick:nextTick,seed:(input.seed+Math.imul(pitchCount+1,0x9e3779b9))>>>0,
      ...(playRandomnessV152===undefined?{}:{randomnessV152:playRandomnessV152}),
      ...(managedOffense&&command.swingInstructionV121!==undefined?{swingInstructionV121:command.swingInstructionV121}:{}),
      ...(managedOffense&&command.battingDirectionRequestV149!==undefined?{battingDirectionRequestV149:command.battingDirectionRequestV149}:{}),
      ...(command.observedSpinTrialV236===undefined?{}:{observedSpinTrialV236:command.observedSpinTrialV236}),
      ...(managedOffense&&command.managerCommunicationV122!==undefined?{managerCommunicationV122:{source:command.managerCommunicationV122,
        scope:{sessionId:communicationScopeV122!.sessionId,matchId:communicationScopeV122!.matchId,senderId:communicationScopeV122!.managerId,receiverId:c.batterPlayerId}}}:{}),
      ...(pitchWorkloadV122?{pitchWorkloadV122}:{}),
      ...(pendingBeliefV122?{batterBeliefV122:{belief:pendingBeliefV122,observerPlayerId:c.batterPlayerId,pitcherId:c.pitcherPlayerId}}:{}),
      ...(directionMotorPolicyV153===undefined?{}:{batterDirectionMotorV153:directionMotorPolicyV153}),
      ...(regionPolicyV222===undefined?{}:{batterObservedRegionExperienceV222:regionPolicyV222}),
      ...(observationPolicyV151?{batterObservationV151:observationPolicyV151,batterObservedMemoryV151:{
        memory:observedMemoriesV151.get(knowledgeKeyV122)??createEmptyBatterObservedMemoryV151({observerPlayerId:c.batterPlayerId,pitcherId:c.pitcherPlayerId}),
        observerPlayerId:c.batterPlayerId,pitcherId:c.pitcherPlayerId}}:{}),
      pitchSituationV111:{balls:beforeMatch.balls,strikes:beforeMatch.strikes,outs:beforeMatch.outs,
        occupiedBases:{first:beforeMatch.bases.first!==null,second:beforeMatch.bases.second!==null,third:beforeMatch.bases.third!==null}},
      batter:{...bp,heightMeters:batter.heightMeters,bats:batter.bats,...(batterTechnique?{technicalSkills:batterTechnique}:{})},pitcher:{...pp,...(pitcherTechnique?{technicalSkills:pitcherTechnique}:{}),heightMeters:pitcher.heightMeters,moundPosition:LIVE_MATCH_MOUND_SURFACE_V1,...(pitcher.throws===undefined?{}:{throws:pitcher.throws}),
        pitchApproach:pitcherPreference.pitchApproach},measuredClips:liveSpinRepertoireClipsV124({...bp,bats:batter.bats},input.measuredClips),
      catcher:{gloveSpeedMps:cp.gloveSpeedMps,gloveReachMeters:cp.gloveReachMeters,gloveRadiusMeters:cp.gloveRadiusMeters,
        retentionCapacityJ:cp.retentionCapacityJ,captureDissipationPowerW:cp.captureDissipationPowerW,pocketRadiusMeters:.14,...(cp.defensiveDecisionSeconds===undefined?{}:{defensiveDecisionSeconds:cp.defensiveDecisionSeconds}),...(cp.zoneRecognitionV87===undefined?{}:{zoneRecognitionV87:cp.zoneRecognitionV87})},
      batting,pitchType:pitchTypeCommand,...(command.managedTeam===1-c.team&&command.pitchId!==undefined?{pitchId:command.pitchId}:{}),
      location:command.managedTeam===1-c.team?command.location:'auto',physics:matchPhysicsV101});
    const frames:LiveMatchFrameV1[]=pitch.frames.map(f=>({...ready,tick:f.tick,ball:f.ball,bat:f.bat,phase:'pitch',possessedBy:f.ball.possessedBy==='catcher'?input.teams[1-c.team].defense.C:null}));
    let field:ReturnType<typeof simulateLiveFieldPlayV1>|null=null,result:PlayableMatchRuleResultV1,outgoingBallMoment:BallWorldMoment|null=null;
    let scoringInput:LiveFieldPlayInputV1|null=null;
    if(pitch.contact&&pitch.contactMoment){
      const def=input.teams[1-c.team];
      const outgoingMoment={...pitch.contactMoment,ball:{...pitch.contactMoment.ball,velocity:pitch.contact.exitVelocity,spin:pitch.contact.exitSpin}};
      outgoingBallMoment=outgoingMoment;
      const fieldInput=buildLiveFieldPlayInputV95({ball:outgoingMoment,orientation:pitch.contactOrientation??IDENTITY_QUATERNION,
        physics:pitch.diagnostics.sourceDescriptor.profile.air.aerodynamics.seamForce===undefined?matchPhysicsV101:pitch.diagnostics.sourceDescriptor.profile,
        seed:(input.seed+Math.imul(pitchCount+1,0x9e3779b9))>>>0,
        ...(playRandomnessV152===undefined?{}:{randomnessV152:playRandomnessV152}),
        field:{bases:LIVE_MATCH_BASES_V1,...park},defense:def.defense,placements,
        players:[...players.values()].map(player=>{const technicalSkills=resolveLiveTechnicalTraitsV75(player.traitProfile);return{
          playerId:player.playerId,heightMeters:player.heightMeters,physical:physical(player),...(technicalSkills?{technicalSkills}:{}),
          ...(player.traitProfile?{traitProfile:player.traitProfile}:{})};}),
        batterRunnerId:c.batterPlayerId,batterPosition:ready.actors.find(a=>a.playerId===c.batterPlayerId)!.position,
        occupiedBases:beforeMatch.bases,baserunning:runningInstruction,outs:beforeMatch.outs,maxPlaySeconds:45});
      const {fielders,runners:runnerSpecs}=fieldInput;
      scoringInput=fieldInput;
      field=simulateLiveFieldPlayV1(fieldInput);
      if(!field.end.complete)throw new Error('live baseball match: physical field continuation unresolved: '+field.end.reason+' (pitch '+(pitchCount+1)+', seed '+input.seed+')',
        {cause:{outgoingMoment,fielders,runners:runnerSpecs,outs:beforeMatch.outs,field:{bases:LIVE_MATCH_BASES_V1,...park},end:field.end,diagnostics:field.diagnostics,facts:field.facts}});
      result=reducePlayableMatchV1({match:beforeMatch,batterRunnerId:c.batterPlayerId,regulationInnings:innings,event:{kind:'field_play',facts:{...field.ruleFacts,buntAttempt:batting==='bunt'}}});
      frames.push(...convertLiveFieldFramesV98({field,readyFrame:ready,defense:def.defense,battingTeam:c.team as 0|1,
        ticksPerSecond:tps,rules:result,sampleBatAtTick:pitch.sampleBatAtTick}));
    }else{
      assert(pitch.call!==null,'pitch ended without physical contact or secured count call');
      result=reducePlayableMatchV1({match:beforeMatch,batterRunnerId:c.batterPlayerId,regulationInnings:innings,event:{kind:'pitch_call',tick:pitch.endedAtTick,call:pitch.call}});
    }
    assert(result.kind==='applied','rule continuation unresolved: '+(result.kind==='unresolved'?result.reason:''));
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
    match=result.match;finished=result.gameOver;pitchCount++;
    if(result.batterAdvanced)battingOrderIndices[c.team]=(battingOrderIndices[c.team]+1)%9;
    if(result.halfChanged){let r=line.find(r=>r.inning===match.inning);if(!r){r={inning:match.inning,away:null,home:null};line.push(r);}r[match.half==='top'?'away':'home']=0;}
    nextTick=Math.max(result.endedAtTick,acceptedFrames.at(-1)!.tick)+2*tps;
    const record:LiveIssuedPitchV1=frozen({beforeMatch,match:cloneInert(match),frames:acceptedFrames,
      events:[...(field?.facts??[]),...result.outcomes.map(o=>({kind:'runner_out',...o})),{kind:'pitch_adjudicated',tick:result.endedAtTick,classification:result.classification}],
      command:cloneInert(command),play:{classification:result.classification,call:pitch.call,contact:pitch.contact,
        contactMoment:pitch.contactMoment,contactOrientation:pitch.contactOrientation,outgoingBallMoment,field,rules:result,localScoringV100,
        diagnostics:{...pitch.diagnostics,...(batterEvidenceReceptionV122?{batterEvidenceReceptionV122}:{}),
          ...(observationPolicyV151?{batterObservedMemoryUpdateV151:{status:nextObservedMemoryV151?'ACCEPTED_UNCLASSIFIED_OBSERVATION':'NO_DELIVERED_FORECAST_AT_CLOSURE',
            totalBefore:previousObservedMemoryV151?.totalObservations??0,totalAfter:nextObservedMemoryV151?.totalObservations??previousObservedMemoryV151?.totalObservations??0,
            evidence:observedEvidenceV151,pitchFamilyRecognized:false as const}}:{}),
          ...(traitPreferences?{traitPreferences}:{}),managerBaserunning:{instruction:runningInstruction,safetyMarginAdjustmentSeconds:runningMarginAdjustment,appliedToOffense:command.managedTeam===c.team}}},
      requiresNextPitch:!finished,finished,batterPlayerId:c.batterPlayerId,pitcherPlayerId:c.pitcherPlayerId,pitchType:pitch.pitchType,
      ...(pitch.pitchId===undefined?{}:{pitchId:pitch.pitchId,pitchName:pitch.pitchName}),speedKmh:pitch.speedKmh,line:cloneInert(line),hits:{...hits},errors:{...errors}});
    history.push(record);return record;
  }
  return Object.freeze({issuePitch,inspect,captureContinuationV116});
}


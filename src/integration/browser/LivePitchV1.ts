import {planLiveYawRobustV276} from './LiveYawRobustV276';
import {SEARCH_EVALUATIONS as YAW_ROBUST_SEARCH_EVALUATIONS} from '../../core/sim/contact/ObservedDirectionRegistrationV153';
import {planObservedYawPivotContactFrameV275} from '../../core/decision/batting/ObservedYawPivotContactFrameV275';
import {hashYawDecisionInputV274,summarizeYawDecisionV274} from './LiveYawDecisionEvidenceV274';
import {isAuthorizedYawPitchInputV274} from './LiveBaseballMatchV1';
import {planObservedYawContactFrameV255} from '../../core/decision/batting/ObservedYawContactFrameV255';
import {normalPitchContact} from "../../experimental/robin/bridge/normal-pitch-contact-v2";
import {parsePracticeSwingDecisionV241,resolvePracticeSwingDecisionV241,type PracticeSwingDecisionRequestV241} from './PracticeSwingDecisionV241';
import {validateLiveObservedRobustContactFrameTrialV248,type LiveObservedRobustContactFrameTrialV248} from './LiveRobustContactFrameMotorV248';
import {planLiveRobustContactFrameV247} from './LiveRobustContactFrameAdapterV247';
import {buildLiveBatReferenceExecutionV247} from './LiveBatReferenceExecutionV247';
import {validateLiveObservedContactFrameTrialV244,type LiveObservedContactFrameTrialV244} from './LiveContactFrameMotorV244';
import {planObservedContactFrameRegistrationV243} from '../../core/decision/batting/ObservedContactFrameRegistrationV243';
import {forecastObservedPitchV151} from '../../core/decision/batting/ObservedPitchForecastV151';
import {forecastObservedPitchV246,type ObservedPitchForecastPolicyV246} from '../../core/decision/batting/ObservedPitchForecastV246';
import type { Vec3 } from '../../core/model/geometry';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { createLivePlayRandomStreamsV152, validateLiveRandomnessV152, type LiveRandomnessV152 } from '../../core/rng/LiveRandomStreamsV152';
import { createSourceFreeBallKernel,type SourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { createAeroGroundBallPhysicsProfile,type AeroGroundBallPhysicsV1 } from '../../core/sim/ball/VersionedBattedBallPhysics';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { IDENTITY_QUATERNION, multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle, rotateVectorByQuaternion, type Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import { createReferenceBatKinematicsV1,type ReferenceBatKinematicsInputV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { sampleAuthoredBatEnvelopePoseV133, type ReferenceBatEnvelopeV133 } from '../../core/sim/contact/ReferenceBatEnvelopeV133';
import { validateImpactTrajectorySettingsV1, withReferenceImpactTrajectoryV1, DEFAULT_WHOLE_ARC_TRAJECTORY_V1 } from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';
import { createRigidBatStateFromBatterSwingState,measureRigidBatBallSurfaceSeparation,type BatRadiusProfile,
  type RigidBatPhysicalProperties,type RigidBatBallContactResult } from '../../core/sim/contact/RigidBatBallContact';
import { resolveWoodBatSpeedProfileBallContact } from '../../core/sim/contact/WoodBatSpeedResponseProfile';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../core/sim/contact/WoodBatProductionProfileV1';
import { resolveCatchRetention } from '../../core/sim/fielding/CatchRetention';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { resolveLiveBattingSetupV94 } from '../../core/sim/pitching/BattingSetupV94';
import { findFirstSourceContactV94 as firstContact, findSourceStrikeZoneContactV94 } from '../../core/sim/pitching/StrikeZoneVolumeV94';
import { registerMeasuredBatToFieldV1,MEASURED_BAT_FIELD_REGISTRATION_V1 } from './MeasuredBatFieldRegistrationV1';
import {resolveLivePlateVisionV1,type LivePhysicalAbilityControlsV1} from './LivePhysicalRosterV1';
import {resolveBatterApproachV121,lateEvidenceHeadroomV121,planSwingClockV121,type SwingInstructionV121} from '../../core/decision/batting/BatterApproachPolicyV121';
import {referenceElapsedSecondsV121,referencePhaseSecondsV121,referenceWorldTickAtSourceV121} from '../../core/sim/contact/ReferenceBatMotorV121';
import {evaluateBatSwingCapacityV121,validateBatSwingCapacityTargetV121} from './BatSwingCapacityV121';
import {validateSwingExecutionV122,referenceAccelerationBoundsV122,referenceRateScaleV122} from './LiveSwingExecutionV122';
import {resolveLiveManagerCommunicationV122,type LiveManagerCommunicationInputV122} from './LiveManagerCommunicationV122';
import {resolveLivePitchWorkloadExecutionV122,type LivePitchWorkloadExecutionInputV122} from './LiveWorkloadExecutionV122';
import {freezeBatterBeliefV122,resolveBatterIntentV122,type BatterBeliefV122} from '../../core/decision/batting/BatterIntentV122';
import {resolveBattingDirectionRequestV149,type BattingDirectionRequestV149} from '../../core/decision/batting/BattingDirectionRequestV149';
import {planNeutralReactiveDirectionV272} from '../../core/decision/batting/NeutralReactivePlannerV272';
import {recallBatterObservedMemoryV151,validateBatterObservedMemoryV151,type BatterObservedMemoryV151} from '../../core/decision/batting/BatterObservedMemoryV151';
import {recallObservedRegionV222,validateObservedRegionPolicyV222,type BatterObservedRegionExperiencePolicyV222} from '../../core/decision/batting/BatterObservedRegionExperienceV222';
import {meetLateLookV1,createLiveBatterPositionObserverV151,validateLiveBatterObservationPolicyV151,type LiveBatterObservationPolicyV151} from './LiveBatterObservationV151';
import {validateObservedDirectionMotorV153,createDirectionMotorPredictionV153,limitDirectionExecutionV153,type ObservedDirectionMotorPolicyV153} from './LiveDirectionMotorV153';
import {planObservedDirectionRegistrationV153,planObservedReactiveRegistrationV161,planObservedReactiveDirectionLotteryV251,validateObservedReactiveDirectionGroupPolicyV251,type ObservedReactiveDirectionGroupPolicyV251,type ObservedDirectionRegistrationInputV153,
  type ObservedReactiveRegistrationInputV161} from '../../core/sim/contact/ObservedDirectionRegistrationV153';
import {selectPredictionAt,resolveMotorStart} from '../../core/world/psychology/batting/BattingTiming';
import {validateLiveSwingEnvelopeV133,scaleLiveSwingEnvelopeV133,selectLiveSwingEnvelopeRateV133} from './LiveSwingEnvelopeV133';
import { resolvePitcherRepertoireV77, validatePitchingMotionV77, type PitchRepertoireV77, type PitchingMotionV77 } from './LivePitchAuthoringV77';
import { validatePitchRepertoireV78, samplePitchSpinExecutionV78, type PitchRepertoireV78, type PitchSnapshotV78 } from './LivePitchAuthoringV78';
import { solvePitchTunnelAimV1 } from './PitchTunnelAimV1';
import { resolveLivePitchReleasePlanV168, type LivePitchReleasePlanV168 } from './LivePitchReleasePlanV168';
import { createLivePitchQualityReleasePlanV177, validateLivePitchQualityRequestV177, type LivePitchQualityRequestV177 } from './LivePitchQualityRecipeV177';
import { validateTechnicalSkillControlsV75, type TechnicalSkillControlsV75 } from '../../core/sim/TechnicalSkillControlsV75';
import { classifyBatterCourseV79, validateBatterCourseProfileV79 } from './BatterCourseProfileV79';
import {expandBatterCourseProfileV87ToV79,resolveBatterCourseProfileV87} from './BatterCourseProfileV87';
import {recognizeZoneV87,selectZoneTargetV87,validateZoneRecognitionV87,type ZoneRecognitionV87} from './ZoneRecognitionV87';
import type { LiveBatPlaybackDescriptorV88 } from './LiveBatPlaybackV88';
import { planLivePitchTargetV111, resolveLivePitchCommandStdV111,shapeLiveCommandMissV1, type LivePitchSituationV111 } from './LivePitchTargetPlanV111';
import {validateLiveSpinControlV123,selectLiveSpinIntentV123,selectLiveSpinIntentOrNoneV123,findLiveSpinMotionClipV124} from './LiveSpinControlV123';
import {resolveLiveContextHitStrengthV1} from '../../core/sim/TechnicalSkillControlsV75';
import {selectBatterContactTechniqueV1,validateBatterTechniquePolicyV1,type BatterTechniquePolicyV1,type BatterTechniqueSelectionV1} from '../../core/decision/batting/BatterContactTechniqueV1';
import {observeBattedBallSpinV123} from '../../core/sim/contact/BattedBallSpinObservationV123';
import {validateLiveObservedSpinTrialRequestV236,resolveLiveObservedSpinTrialV236,type LiveObservedSpinTrialRequestV236} from './LiveObservedSpinTrialV236';
import {validateLiveSpinMotorPracticePolicyV239,type LiveSpinMotorPracticePolicyV239} from './LiveSpinMotorPracticeV239';
import {validateLiveObservedSpinComposeRequestV238,resolveLiveObservedSpinComposeV238,composeLiveObservedSpinAimV238,type LiveObservedSpinComposeRequestV238} from './LiveObservedSpinComposeV238';

export type LiveMeasuredClipV1=Readonly<{
  id:string;side:'R'|'L';source:Readonly<{sha256:string;repository?:string}>;contactTimeSeconds:number;
  normalization:Readonly<{batLengthM:number;sweetSpotT:number;positionScale?:number}>;
  frames:readonly Readonly<{tick:number;grip:Vec3;orientation:Quaternion}>[];
  /** Expanded catalogs keep legacy automatic choices; explicit IDs remain available. */
  defaultSelection?:boolean;
}>;
export type LiveNeutralReactivePolicyV272=Readonly<{version:'live_neutral_reactive_policy_v272';sourceId:string}>;
export type LiveYawDiagnosticV274=Readonly<{version:'live_yaw_paired_diagnostic_v274'|'live_yaw_paired_diagnostic_v275'|'live_yaw_paired_diagnostic_v276'}>;
export type LivePitchInputV1=Readonly<{
  originTick:number;seed:number;
  /** Optional paired-trial execution seed; affects only V79 direction intention. */
  directionTrialSeedV79?:number;
  randomnessV152?:LiveRandomnessV152;
  /** Read-only pitcher-lab request. Omission leaves normal record shape exact. */
  pitchCommandObservationV155?:true;
  /** One-pitch nominal spin/material plan. Omission/null retains the saved pitch. */
  pitchReleasePlanV168?:LivePitchReleasePlanV168|null;
  /** Automatic nominal release recipe; omission/null retains the saved pitch. */
  pitchQualityV177?:LivePitchQualityRequestV177|null;
  /** One-pitch operation. Omission retains the original saved-angle behavior. */
  battingDirectionRequestV149?:BattingDirectionRequestV149;
  swingInstructionV121?:SwingInstructionV121;
  managerCommunicationV122?:Pick<LiveManagerCommunicationInputV122,'scope'|'source'>;
  pitchWorkloadV122?:Omit<Extract<LivePitchWorkloadExecutionInputV122,{workload:unknown}>,'physics'>;
  batterBeliefV122?:Readonly<{belief:BatterBeliefV122;observerPlayerId:string;pitcherId:string}>;
  batterObservationV151?:LiveBatterObservationPolicyV151;
  batterForecastPolicyV246?:ObservedPitchForecastPolicyV246;
  batterObservedRegionExperienceV222?:BatterObservedRegionExperiencePolicyV222;
  observedSpinTrialV236?:LiveObservedSpinTrialRequestV236|LiveObservedSpinComposeRequestV238|LiveObservedContactFrameTrialV244|LiveObservedRobustContactFrameTrialV248;
  spinMotorPracticePolicyV239?:LiveSpinMotorPracticePolicyV239;
  yawDiagnosticV274?:LiveYawDiagnosticV274;
  practiceSwingDecisionV241?:PracticeSwingDecisionRequestV241;
  batterDirectionMotorV153?:ObservedDirectionMotorPolicyV153;
  batterReactiveDirectionPolicyV251?:ObservedReactiveDirectionGroupPolicyV251;
  batterNeutralReactivePolicyV272?:LiveNeutralReactivePolicyV272;
  /** Omission keeps every old swing exact. Present: the batter may pick a contact technique per swing. */
  batterTechniqueV1?:BatterTechniquePolicyV1;
  batterObservedMemoryV151?:Readonly<{memory:BatterObservedMemoryV151;observerPlayerId:string;pitcherId:string}>;
  /** Known before release. Omission preserves the original standalone target policy. */
  pitchSituationV111?:LivePitchSituationV111;
  emotionInfluenceV1?:Readonly<{swingDecisionShiftTicks:number;swingAggressionDelta:number}>;
  intentionalBallV1?:boolean;
  batter:LivePhysicalAbilityControlsV1 & Readonly<{heightMeters:number;bats:'R'|'L';batLengthM:number;batMassKg:number;swingRate:number;
    timingStdSeconds:number;aimStdMeters:number;chaseMarginMeters:number;clipId?:string;technicalSkills?:TechnicalSkillControlsV75}>;
  pitcher:Readonly<{releaseSpeedMps:number;spinRadPerSecond:Vec3;commandStdMeters:number;maximumPitchSpeedMps?:number;throws?:'R'|'L';
    heightMeters?:number;moundPosition?:Vec3;pitchReleaseHeightMeters?:number;pitchReleaseSideMeters?:number;pitchReleaseExtensionMeters?:number;
    pitchApproach?:'FASTBALL'|'BALANCED'|'BREAKING';velocitySpreadScaleV1?:number;pitchTunnelV1?:number;technicalSkills?:TechnicalSkillControlsV75;pitchRepertoire?:PitchRepertoireV77;pitchingMotion?:PitchingMotionV77;
    pitchRepertoireV78?:PitchRepertoireV78;minimumSpinRatio?:number;zoneRecognitionV87?:ZoneRecognitionV87;
    pitchQualityV177?:LivePitchQualityRequestV177|null}>;
  catcher?:Readonly<{gloveSpeedMps:number;gloveReachMeters:number;gloveRadiusMeters:number;retentionCapacityJ:number;captureDissipationPowerW:number;pocketRadiusMeters:number;defensiveDecisionSeconds?:number;zoneRecognitionV87?:ZoneRecognitionV87}>;
  measuredClips:readonly LiveMeasuredClipV1[];batting:'balanced'|'contact'|'power'|'take'|'bunt';pitchType:string;pitchId?:string;location:string;
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
const techniqueBlend=(u:number)=>{const t=clamp(u,0,1);return t*t*(3-2*t);};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('live pitch: '+message);}
/** World axes: home to centre field is +z, first-base side is +x. A pitcher
 * facing home therefore releases right-handed pitches on world -x. Heights
 * below are local authoring defaults, not measurements of a named pitcher. */
export function resolveLivePitchReleaseV1(p:LivePitchInputV1['pitcher']){
  const bodyHeight=p.heightMeters??1.83,
    rubber=p.moundPosition??{x:0,y:.254,z:18.44},
    explicit=p.heightMeters!==undefined||p.moundPosition!==undefined||p.pitchReleaseHeightMeters!==undefined
      ||p.pitchReleaseSideMeters!==undefined||p.pitchReleaseExtensionMeters!==undefined;
  assert(p.heightMeters===undefined||bounded(p.heightMeters,1.1,2.5),'invalid pitcher body height');
  assert(Object.values(rubber).every(Number.isFinite)&&rubber.z>=10&&rubber.z<=25&&rubber.y>=0&&rubber.y<=1,'invalid mound surface anchor');
  for(const [key,lo,hi] of [['pitchReleaseHeightMeters',.2,3.2],['pitchReleaseSideMeters',0,1.5],['pitchReleaseExtensionMeters',0,3.5]] as const)
    assert(p[key]===undefined||bounded(p[key]!,lo,hi),'invalid release geometry: '+key);
  const heightMeters=p.pitchReleaseHeightMeters??bodyHeight*.86,
    sideMeters=p.pitchReleaseSideMeters??bodyHeight*.25,
    extensionMeters=p.pitchReleaseExtensionMeters??1.54,
    position=explicit?{x:rubber.x+(p.throws==='L'?1:-1)*sideMeters,y:rubber.y+heightMeters,z:rubber.z-extensionMeters}
      :{x:p.throws==='L'?-.18:.18,y:1.83,z:16.9};
  return {position,rubberSurfacePosition:rubber,heightAboveRubberMeters:explicit?heightMeters:null,
    sideMagnitudeMeters:explicit?sideMeters:null,extensionTowardHomeMeters:explicit?extensionMeters:null,
    basis:explicit?'LOCAL_BODY_RATIO_WITH_OPTIONAL_AUTHORED_RELEASE_SI' as const:'LEGACY_DIRECT_PITCH_COMPATIBILITY' as const,
    measuredNamedPlayer:false as const};
}
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
type PrivateYawEvidenceV274=Readonly<{planningRate:number;summary:ReturnType<typeof summarizeYawDecisionV274>;inputHash:ReturnType<typeof hashYawDecisionInputV274>;plannerInputHashV276?:ReturnType<typeof hashYawDecisionInputV274>}>;
const pendingYawEvidenceV274=new WeakMap<object,PrivateYawEvidenceV274>();
/** One-shot read only for an already authorized Host input; this never grants authorization. */
export function takeYawDecisionEvidenceV274(raw:unknown):PrivateYawEvidenceV274|null{
 if(!isAuthorizedYawPitchInputV274(raw))return null;const key=raw as object,value=pendingYawEvidenceV274.get(key)??null;pendingYawEvidenceV274.delete(key);return value;
}
export function simulateLivePitchV1(raw:LivePitchInputV1, opticalExperiment?:Readonly<{version:'robin_optical_test_v1';hiddenAfterSeconds:number;kernel:SourceFreeBallKernel}>){
  if(opticalExperiment && (opticalExperiment.version!=='robin_optical_test_v1'||!Number.isFinite(opticalExperiment.hiddenAfterSeconds)||opticalExperiment.hiddenAfterSeconds<0||!raw.batterObservationV151||(opticalExperiment.kernel as unknown as {version?:string}).version!=='robin_original_linear_source_v1'))throw Error('Robin optical HOLD: invalid policy or missing observer');
  if(raw!==null&&typeof raw==='object'&&Object.hasOwn(raw,'yawDiagnosticV274')&&!isAuthorizedYawPitchInputV274(raw))throw Error('yaw diagnostic requires private paired Host');
  const input=cloneInert(raw),b=input.batter,p=input.pitcher,
    effectiveQualityV177=input.pitchQualityV177===undefined?p.pitchQualityV177:input.pitchQualityV177;
  assert(effectiveQualityV177===undefined||effectiveQualityV177===null,'legacy pitch quality V177 is not supported; use the original build');
  const neutralPolicyV272=input.batterNeutralReactivePolicyV272;
  if(neutralPolicyV272!==undefined)assert(neutralPolicyV272!==null&&typeof neutralPolicyV272==='object'&&!Array.isArray(neutralPolicyV272)
    &&Object.keys(neutralPolicyV272).sort().join('|')==='sourceId|version'&&neutralPolicyV272.version==='live_neutral_reactive_policy_v272'
    &&typeof neutralPolicyV272.sourceId==='string'&&neutralPolicyV272.sourceId.length>0&&neutralPolicyV272.sourceId.length<=200
    &&neutralPolicyV272.sourceId.trim()===neutralPolicyV272.sourceId,'invalid neutral reactive direction policy');
  assert(!(neutralPolicyV272&&input.batterReactiveDirectionPolicyV251!==undefined),'neutral and explicit reactive direction policies cannot be combined');
  assert(!(neutralPolicyV272&&input.observedSpinTrialV236?.version==='live_observed_robust_contact_frame_trial_v248'),'neutral reactive direction policy cannot be combined with robust trial');
  const baseProfile=createAeroGroundBallPhysicsProfile(input.physics),tps=baseProfile.air.ticksPerSecond,
    catcher=input.catcher??{gloveSpeedMps:7,gloveReachMeters:.95,gloveRadiusMeters:.14,retentionCapacityJ:350,captureDissipationPowerW:10000,pocketRadiusMeters:.18};
  let profile=baseProfile;
  const requestedRandomnessV152=input.randomnessV152===undefined?undefined:validateLiveRandomnessV152(input.randomnessV152,'PLAY'),
    directionAliasV152=requestedRandomnessV152!==undefined&&input.directionTrialSeedV79!==undefined
      &&requestedRandomnessV152.overrides?.batterDirection===undefined,
    effectiveRandomnessV152=directionAliasV152?validateLiveRandomnessV152({...requestedRandomnessV152,
      overrides:{...requestedRandomnessV152!.overrides,batterDirection:input.directionTrialSeedV79}},'PLAY'):requestedRandomnessV152,
    randomStreamsV152=effectiveRandomnessV152===undefined?undefined:createLivePlayRandomStreamsV152(input.seed,effectiveRandomnessV152);
  const executionV122=b.swingExecutionV122===undefined?undefined:validateSwingExecutionV122(b.swingExecutionV122);
  assert(input.pitchCommandObservationV155===undefined||input.pitchCommandObservationV155===true,'invalid read-only pitch command observation request');
  const observationPolicyV151=input.batterObservationV151===undefined?undefined:validateLiveBatterObservationPolicyV151(input.batterObservationV151);
  const meetLookV1=()=>observationPolicyV151?.meetLateLookV1?meetLateLookV1(b.timingStdSeconds,observationPolicyV151.meetLateLookV1):0,
    lateHeadroomV1=()=>b.plateVision===undefined?0:observationPolicyV151?.lateLookByMeetOnlyV1&&observationPolicyV151.meetLateLookV1?meetLookV1()
      :Math.max(lateEvidenceHeadroomV121(resolveLivePlateVisionV1(b)),meetLookV1());
  assert(input.batterForecastPolicyV246===undefined||observationPolicyV151!==undefined,'V246 forecast requires position-only observation policy');
  const directionMotorPolicyV153=input.batterDirectionMotorV153===undefined?undefined:validateObservedDirectionMotorV153(input.batterDirectionMotorV153);
  assert(directionMotorPolicyV153===undefined||observationPolicyV151!==undefined,'direction motor requires position-only observation policy');
  const techniquePolicyV1=input.batterTechniqueV1===undefined?undefined:validateBatterTechniquePolicyV1(input.batterTechniqueV1);
  assert(techniquePolicyV1===undefined||directionMotorPolicyV153!==undefined,'batter technique requires observation and direction motor');
  const reactivePolicyV251=input.batterReactiveDirectionPolicyV251===undefined?undefined:validateObservedReactiveDirectionGroupPolicyV251(input.batterReactiveDirectionPolicyV251);
  assert(reactivePolicyV251===undefined||observationPolicyV151!==undefined&&directionMotorPolicyV153!==undefined&&randomStreamsV152!==undefined,'reactive direction policy requires observation, motor and independent randomness');
  assert(neutralPolicyV272===undefined||observationPolicyV151!==undefined&&directionMotorPolicyV153!==undefined&&randomStreamsV152!==undefined,'neutral reactive direction policy requires observation, motor and independent randomness');
  assert(observationPolicyV151===undefined||observationPolicyV151.ticksPerSecond===tps,'batter observation clock differs from physics');
  assert(input.batterObservedMemoryV151===undefined||observationPolicyV151!==undefined,'observed memory requires explicit observation policy');
  const observedMemoryV151=input.batterObservedMemoryV151===undefined?undefined:validateBatterObservedMemoryV151(input.batterObservedMemoryV151.memory);
  if(observedMemoryV151)assert(observedMemoryV151.observerPlayerId===input.batterObservedMemoryV151!.observerPlayerId
    &&observedMemoryV151.pitcherId===input.batterObservedMemoryV151!.pitcherId,'observed memory participants differ');
  const regionPolicyV222=input.batterObservedRegionExperienceV222===undefined?undefined:validateObservedRegionPolicyV222(input.batterObservedRegionExperienceV222),
    rawSpinRequest=input.observedSpinTrialV236,
    spinTrialRequestV236=rawSpinRequest?.version==='live_observed_spin_trial_v236'?validateLiveObservedSpinTrialRequestV236(rawSpinRequest):undefined,
    spinComposeRequestV238=rawSpinRequest?.version==='live_observed_spin_compose_trial_v238'?validateLiveObservedSpinComposeRequestV238(rawSpinRequest):undefined,
    robustRequestV248=rawSpinRequest?.version==='live_observed_robust_contact_frame_trial_v248'?validateLiveObservedRobustContactFrameTrialV248(rawSpinRequest):undefined;
  let contactFrameRequestV244:LiveObservedContactFrameTrialV244|undefined=rawSpinRequest?.version==='live_observed_contact_frame_trial_v244'?validateLiveObservedContactFrameTrialV244(rawSpinRequest):undefined,
    anyFrameRequest:LiveObservedContactFrameTrialV244|LiveObservedRobustContactFrameTrialV248|undefined=contactFrameRequestV244??robustRequestV248;
  assert(!(reactivePolicyV251&&robustRequestV248),'reactive direction policy cannot be combined with robust trial');
  if(rawSpinRequest!==undefined&&!spinTrialRequestV236&&!spinComposeRequestV238&&!anyFrameRequest)throw Error('invalid observed spin trial version');
  const spinSubject=spinTrialRequestV236?.subjectId??spinComposeRequestV238?.subjectId??anyFrameRequest?.subjectId;
  if(spinSubject!==undefined){const known=[input.batterObservedMemoryV151?.observerPlayerId,input.batterBeliefV122?.observerPlayerId].filter((v):v is string=>v!==undefined);
    assert(known.every(id=>id===spinSubject),'spin trial subject differs from current batter observation');}
  assert(regionPolicyV222===undefined||observationPolicyV151!==undefined,'region experience requires position-only observation policy');
  const recallInputV151=observedMemoryV151?{atTick:input.originTick,
    draw:randomStreamsV152?.rng('batterBelief','recent-memory').uniform()??new SeedRoot(input.seed).streamRng(0,'batting','observed-prepitch-memory-v151').nextFloat(),
    priorWeight:b.batterApproachV122?.priorReliance??observationPolicyV151!.memoryPolicy.unprofiledPriorWeight}:null,
    legacyRecallV151=observedMemoryV151&&recallInputV151?recallBatterObservedMemoryV151(observedMemoryV151,recallInputV151):null,
    regionRecallV222=regionPolicyV222&&observedMemoryV151&&recallInputV151?recallObservedRegionV222(observedMemoryV151,recallInputV151):null,
    preparedRecallV151=legacyRecallV151&&regionRecallV222?{...legacyRecallV151,position:regionRecallV222.position,arrivalAfterReleaseSeconds:regionRecallV222.arrivalAfterReleaseSeconds}:legacyRecallV151;
  const envelopeSourceV133=b.swingEnvelopeV133===undefined?undefined:validateLiveSwingEnvelopeV133(b.swingEnvelopeV133,b.swingExecutionV122),
    spinPracticePolicyV239=input.spinMotorPracticePolicyV239===undefined?undefined:validateLiveSpinMotorPracticePolicyV239(input.spinMotorPracticePolicyV239),
    validatedSpinProfileV123=b.spinControlV123===undefined?undefined:validateLiveSpinControlV123(b.spinControlV123),spinProfileV123=spinPracticePolicyV239?undefined:validatedSpinProfileV123;
  if(spinPracticePolicyV239){assert(!spinTrialRequestV236,'spin practice cannot use legacy raw trial');
    assert(b.clipId===spinPracticePolicyV239.clip.id&&b.bats===spinPracticePolicyV239.clip.bats,'spin practice fixed clip differs');
    if(spinComposeRequestV238)assert(spinComposeRequestV238.clip.id===spinPracticePolicyV239.clip.id&&spinComposeRequestV238.clip.bats===spinPracticePolicyV239.clip.bats
      &&spinComposeRequestV238.clip.sourceSha256===spinPracticePolicyV239.clip.sourceSha256,'spin practice trial clip differs');
    if(anyFrameRequest)assert(anyFrameRequest.clip.id===spinPracticePolicyV239.clip.id&&anyFrameRequest.clip.bats===spinPracticePolicyV239.clip.bats&&anyFrameRequest.clip.sourceSha256===spinPracticePolicyV239.clip.sourceSha256,'contact-frame practice clip differs');
    const ids=[input.batterObservedMemoryV151?.observerPlayerId,input.batterBeliefV122?.observerPlayerId,spinSubject].filter((v):v is string=>v!==undefined);
    assert(ids.every(id=>id===spinPracticePolicyV239.subjectId),'spin practice subject differs');}
  // Freeze the player's own delivered joint prior before any actual pitch is
  // selected. This boundary never receives an opponent PitchCall or arsenal.
  const beliefV122=input.batterBeliefV122===undefined?undefined:freezeBatterBeliefV122(input.batterBeliefV122.belief,
    {observerPlayerId:input.batterBeliefV122.observerPlayerId,pitcherId:input.batterBeliefV122.pitcherId,capturedAtTick:input.originTick}),
    intentRngV122=new SeedRoot(input.directionTrialSeedV79??input.seed).streamRng(0,'batting','joint-belief-direction-v122'),
    intentV122=b.batterApproachV122===undefined?undefined:resolveBatterIntentV122({profile:b.batterApproachV122,belief:beliefV122,
      selectedAtTick:input.originTick,strikes:input.pitchSituationV111?.strikes??0,bats:b.bats,
      beliefDraw:randomStreamsV152?.rng('batterBelief','joint-hypothesis').uniform()??intentRngV122.nextFloat(),
      commitmentDraw:randomStreamsV152?.rng('batterDirection','commitment').uniform()??intentRngV122.nextFloat(),
      directionDraw:randomStreamsV152?.rng('batterDirection','choice').uniform()??intentRngV122.nextFloat()});
  const courseProfile=b.batterCourseProfileV87!==undefined?expandBatterCourseProfileV87ToV79(resolveBatterCourseProfileV87(b)):b.batterCourseProfileV79===undefined?undefined:validateBatterCourseProfileV79(b.batterCourseProfileV79);
  for(const actor of [b,p,catcher])if(actor.zoneRecognitionV87!==undefined)validateZoneRecognitionV87(actor.zoneRecognitionV87);
  assert(catcher.defensiveDecisionSeconds===undefined||Number.isFinite(catcher.defensiveDecisionSeconds)&&catcher.defensiveDecisionSeconds>=0,'invalid catcher recognition ability');
  if(b.technicalSkills!==undefined)validateTechnicalSkillControlsV75(b.technicalSkills);
  if(p.technicalSkills!==undefined)validateTechnicalSkillControlsV75(p.technicalSkills);
  if(p.pitchingMotion!==undefined)validatePitchingMotionV77(p.pitchingMotion);
  assert(Number.isSafeInteger(input.originTick)&&input.originTick>=0&&Number.isSafeInteger(input.seed)&&tps===profile.ground.ticksPerSecond,'invalid original clock or seed');
  assert(input.directionTrialSeedV79===undefined||Number.isSafeInteger(input.directionTrialSeedV79)&&input.directionTrialSeedV79>=0&&input.directionTrialSeedV79<=0xffffffff,'invalid V79 direction trial seed');
  assert(bounded(b.heightMeters,1.1,2.5)&&['R','L'].includes(b.bats)&&bounded(b.batLengthM,.2,3)&&bounded(b.batMassKg,.1,5)
    &&bounded(b.swingRate,.3,3)&&bounded(b.timingStdSeconds,0,.08)&&bounded(b.aimStdMeters,0,.35)&&bounded(b.chaseMarginMeters,0,.6),'invalid batter SI controls');
  assert(bounded(p.releaseSpeedMps,15,85)&&bounded(p.commandStdMeters,0,.6)&&p.spinRadPerSecond&&Object.values(p.spinRadPerSecond).every(Number.isFinite)
    &&norm(p.spinRadPerSecond)<=1200,'invalid pitcher SI controls');
  assert((p.maximumPitchSpeedMps===undefined||bounded(p.maximumPitchSpeedMps,15,85))&&(p.throws===undefined||['R','L'].includes(p.throws)),'invalid pitcher limit or throwing side');
  assert(p.pitchApproach===undefined||['FASTBALL','BALANCED','BREAKING'].includes(p.pitchApproach),'invalid pitch approach preference');
  assert(p.minimumSpinRatio===undefined||bounded(p.minimumSpinRatio,0,1),'invalid minimum spin ratio');
  assert(p.pitchTunnelV1===undefined||bounded(p.pitchTunnelV1,0,1),'invalid pitch tunnel skill');
  assert(!(p.pitchRepertoire&&p.pitchRepertoireV78),'ambiguous V77 and V78 pitch ownership');
  for(const [key,lo,hi] of [['maximumSweetSpotSpeedMps',.1,90],['targetSweetSpotSpeedMps',.1,90],['motorLatencySeconds',0,2],
    ['technicalTimingOffsetSeconds',-.5,.5],['sweetSpotT',.65,.9],['attackAngleDegrees',-80,80],['undercutAimMeters',-.05,.08],['pullAngleDegrees',-80,80],
    ['badBallControl',0,1],['preContactSeconds',.005,2],['followThroughSeconds',.005,2],['contactDepthMeters',.001,2],['zoneJudgmentStdMeters',0,.6]] as const)
    assert(b[key]===undefined||bounded(b[key]!,lo,hi),'invalid authored batter control: '+key);
  if(b.swingDecision)assert(['AUTO','TAKE','SWING'].includes(b.swingDecision.approach)&&bounded(b.swingDecision.threshold,0,1)
    &&bounded(b.swingDecision.aggressionWeight,0,1),'invalid authored swing decision');
  assert(bounded(catcher.gloveSpeedMps,.1,40)&&bounded(catcher.gloveReachMeters,.4,3)&&bounded(catcher.gloveRadiusMeters,.03,.3)
    &&bounded(catcher.retentionCapacityJ,1,2000)&&bounded(catcher.captureDissipationPowerW,10,1e6)&&bounded(catcher.pocketRadiusMeters,.02,1),'invalid catcher SI controls');
  assert(['balanced','contact','power','take','bunt'].includes(input.batting),'invalid batting command');
  let impactTrajectory=b.impactTrajectory===undefined?undefined:validateImpactTrajectorySettingsV1(b.impactTrajectory);
  const impactAngle=impactTrajectory===undefined?0:impactTrajectory.angleDegreesByLevel[impactTrajectory.level-1],
    localImpactWindow=impactTrajectory!==undefined&&impactTrajectory.method===undefined&&impactAngle!==0;
  assert(input.measuredClips.every(c=>c.defaultSelection===undefined||typeof c.defaultSelection==='boolean'),'invalid measured clip default selection');
  const r=random(input.seed),formRandom=randomStreamsV152?.rng('batterForm','clip-selection')??r,
    menuRandom=randomStreamsV152?.rng('pitchChoice','menu')??r,speedRandom=randomStreamsV152?.rng('pitchExecution','speed')??r,
    locationRandom=randomStreamsV152?.rng('pitchTarget','location')??r,targetRandom=randomStreamsV152?.rng('pitchTarget','requested-position')??r,
    commandRandom=randomStreamsV152?.rng('pitchExecution','command-error')??r,timingRandom=randomStreamsV152?.rng('batterExecution','timing-error')??r,
    aimRandom=randomStreamsV152?.rng('batterExecution','aim-error')??r,sweetSpotRandom=randomStreamsV152?.rng('batterExecution','sweet-spot')??r,
    clips=input.measuredClips.filter(c=>c.side===b.bats&&(b.clipId?c.id===b.clipId:c.defaultSelection!==false));
  assert(clips.length>0,'a measured OpenBiomechanics clip for the actual batting side is required');
  let clip=clips[Math.floor(formRandom.uniform()*clips.length)];
  if(spinPracticePolicyV239)assert(clip.id===spinPracticePolicyV239.clip.id&&clip.side===spinPracticePolicyV239.clip.bats&&clip.source.sha256===spinPracticePolicyV239.clip.sourceSha256,'spin practice clip identity differs');
  assert(clip.id.startsWith('obp-')&&clip.source.repository===openBiomechanics&&/^[a-f0-9]{64}$/.test(clip.source.sha256)
    &&Number.isFinite(clip.contactTimeSeconds)&&clip.frames.length>=2,'unsupported measured clip provenance');
  const pitchApproach=p.pitchApproach??'BALANCED',autoPitchWeights=pitchApproach==='FASTBALL'?[7,1,1,1]:pitchApproach==='BREAKING'?[1,3,3,3]:[1,1,1,1];
  let pitchType=input.pitchType,selectionDraw:number|null=null,selectedSnapshot:PitchSnapshotV78|null=null,ownedSelectionWeights:number[]|null=null;
  if(p.pitchRepertoireV78!==undefined){
    const owned=validatePitchRepertoireV78(p.pitchRepertoireV78,p.maximumPitchSpeedMps).pitches;
    if(input.pitchId!==undefined){
      selectedSnapshot=owned.find(row=>row.pitchId===input.pitchId)??null;
      assert(selectedSnapshot&&pitchType===selectedSnapshot.pitchType,'unknown owned pitch ID or mismatched classification');
    }else if(pitchType==='auto'){
      selectionDraw=menuRandom.uniform();ownedSelectionWeights=owned.map(row=>{const fast=['fastball','sinker','cutter'].includes(row.pitchType);
        // usageWeightV1: the pitcher's own mix (Statcast usage), scaled by the approach preference; omitted, the old weights.
        const approach=pitchApproach==='FASTBALL'?(fast?7:1):pitchApproach==='BREAKING'?(fast?1:3):1;return row.usageWeightV1===undefined?approach:approach*row.usageWeightV1;});
      const total=ownedSelectionWeights.reduce((n,w)=>n+w,0),draw=selectionDraw*total;let cumulative=0;
      selectedSnapshot=owned.at(-1)!;
      for(let i=0;i<owned.length;i++){cumulative+=ownedSelectionWeights[i];if(draw<cumulative){selectedSnapshot=owned[i];break;}}
    }else{
      const matches=owned.filter(row=>row.pitchType===pitchType);assert(matches.length===1,'unknown or ambiguous owned pitch classification');selectedSnapshot=matches[0];
    }
    pitchType=selectedSnapshot.pitchType;
    if(selectedSnapshot.seamForce!==undefined)profile=createAeroGroundBallPhysicsProfile({...baseProfile,air:{...baseProfile.air,
      aerodynamics:{...baseProfile.air.aerodynamics,seamForce:selectedSnapshot.seamForce}}});
  }else if(pitchType==='auto'){
    // One draw in the original stream. Neutral uses the exact prior formula;
    // preference changes only which existing pitch is selected, never its SI.
    selectionDraw=menuRandom.uniform();let choice=Math.floor(selectionDraw*4);
    if(pitchApproach!=='BALANCED'){
      const weightedDraw=selectionDraw*10;let cumulative=0;choice=3;
      for(let i=0;i<autoPitchWeights.length;i++){cumulative+=autoPitchWeights[i];if(weightedDraw<cumulative){choice=i;break;}}
    }
    pitchType=['fastball','slider','curve','changeup'][choice];
  }
  assert(selectedSnapshot!==null||['fastball','slider','curve','changeup','cutter','sinker','splitter'].includes(pitchType),'unsupported physical pitch type');
  assert(input.pitchId===undefined||selectedSnapshot!==null,'owned pitch ID requires a V78 repertoire');
  const selectedPitch=selectedSnapshot?{...selectedSnapshot,authored:true}:resolvePitcherRepertoireV77(p,p.throws??'R').find(row=>row.pitchType===pitchType)!;
  const requestedPitchQualityV177=input.pitchQualityV177===undefined?p.pitchQualityV177:input.pitchQualityV177,
    pitchQualityRequestV177=requestedPitchQualityV177===undefined||requestedPitchQualityV177===null?null:
      validateLivePitchQualityRequestV177(requestedPitchQualityV177);
  assert(pitchQualityRequestV177===null||input.pitchReleasePlanV168===undefined||input.pitchReleasePlanV168===null,
    'automatic pitch quality and explicit release plan cannot both be active');
  let pitchQualityV177:ReturnType<typeof createLivePitchQualityReleasePlanV177>|Readonly<{
    status:'NOT_APPLICABLE';reason:'OWNED_V78_PITCH_REQUIRED';pitchId:string|null;
    qualityState:LivePitchQualityRequestV177['qualityState'];recipeVersion:'kire_release_recipe_v177';
  }>|null=null;
  let pitchReleasePlanV168:ReturnType<typeof resolveLivePitchReleasePlanV168>|null=null;
  if(input.pitchReleasePlanV168!==undefined&&input.pitchReleasePlanV168!==null){
    assert(selectedSnapshot!==null,'release plan requires an owned V78 pitch');
    pitchReleasePlanV168=resolveLivePitchReleasePlanV168({selected:selectedSnapshot,request:input.pitchReleasePlanV168,
      ...(p.maximumPitchSpeedMps===undefined?{}:{maximumPitchSpeedMps:p.maximumPitchSpeedMps})});
  }
  const speedDrawV1=speedRandom.uniform(),speed=selectedPitch.releaseSpeedMps*(p.velocitySpreadScaleV1===undefined?.98+.02*speedDrawV1:.99+(speedDrawV1-.5)*.02*p.velocitySpreadScaleV1);
  let spin=pitchReleasePlanV168?.spinRadPerSecond??selectedPitch.spinRadPerSecond,
    nominalMaterialOrientationV168=pitchReleasePlanV168?.releaseOrientation??selectedSnapshot?.releaseOrientation;
  const battingSetupV94=resolveLiveBattingSetupV94(b),zone=battingSetupV94.region,middle=(zone.lowerY+zone.upperY)/2;
  let location=input.location==='auto'?['zone','zone','low','outside','inside'][Math.floor(locationRandom.uniform()*5)]:input.location;
  assert(['zone','low','outside','inside','high'].includes(location),'unsupported target location');
  const batterSide=b.bats==='R'?-1:1,target={x:(targetRandom.uniform()-.5)*.32,y:middle+(targetRandom.uniform()-.5)*(zone.upperY-zone.lowerY)*.7,z:battingSetupV94.plateFrontZ};
  if(location==='outside')target.x=-batterSide*(.25+targetRandom.uniform()*.25);
  if(input.intentionalBallV1)target.x=-batterSide*1.1;
  if(location==='inside')target.x=batterSide*(.19+targetRandom.uniform()*.2);
  if(location==='low')target.y=zone.lowerY-.06-targetRandom.uniform()*.16;
  if(location==='high')target.y=zone.upperY+.06+targetRandom.uniform()*.16;
  // Consume the legacy targeting draws first. The independent planning stream
  // must not shift the actual command/spin/swing error samples.
  const orderedLocationV1=observationPolicyV151?.pitchOrderPlanV1&&input.location!=='auto'&&!input.intentionalBallV1?input.location as 'zone'|'inside'|'outside'|'low'|'high':undefined,
    pitchTargetPlanV111=(input.location==='auto'||orderedLocationV1)&&input.pitchSituationV111!==undefined?planLivePitchTargetV111({
    zone,ballRadiusMeters:profile.ground.radiusM,pitcher:p,catcher,batter:b,situation:input.pitchSituationV111,
    ...(orderedLocationV1?{preferredLocationV1:orderedLocationV1}:{}),
    seed:randomStreamsV152?.seedFor('pitchTarget','target-plan-v111')??input.seed}):null;
  if(pitchTargetPlanV111){Object.assign(target,pitchTargetPlanV111.position);location=pitchTargetPlanV111.location;}
  // zoneRateV1 on the pitch (the share of these pitches whose centre crosses the zone): the plan keeps its in-or-out choice
  // for the count, leaned so the pitch reaches that share against the plan's own mean of one half. A pitch moved out leaves
  // the zone the way it breaks from the fastball (the fastball itself the way its spin lifts it), 3-16 cm past the edge; one
  // moved in comes to 3 cm inside the edge. Its own draws; omitted, nothing changes.
  const zoneIntentV1=selectedSnapshot?.zoneRateV1===undefined||input.intentionalBallV1?null:(()=>{
    const rate=selectedSnapshot.zoneRateV1,base=.5,rng=randomStreamsV152?.rng('pitchTarget','zone-intent-v1'),
      root=rng?null:new SeedRoot(input.seed).streamRng(0,'batting','zone-intent-v1'),draw=()=>rng?rng.uniform():root!.nextFloat(),
      planned={x:target.x,y:target.y},wasIn=Math.abs(target.x)<=zone.halfWidth&&target.y>=zone.lowerY&&target.y<=zone.upperY,u=draw(),margin=draw(),
      wantIn=wasIn?u<Math.min(1,rate/base):u<Math.max(0,(rate-base)/(1-base));
    if(wantIn===wasIn)return {rate,planned,moved:false as const,wantIn};
    if(wantIn){target.x=clamp(target.x,-zone.halfWidth+.03,zone.halfWidth-.03);target.y=clamp(target.y,zone.lowerY+.03,zone.upperY-.03);location='zone';
      return {rate,planned,moved:true as const,wantIn,direction:null};}
    // Break direction at the plate: this pitch against the fastball (or a spinless ball for the fastball), both sent the same way.
    const owned=p.pitchRepertoireV78===undefined?[]:validatePitchRepertoireV78(p.pitchRepertoireV78,p.maximumPitchSpeedMps).pitches,
      fast=owned.find(row=>row.pitchType==='fastball')??owned.find(row=>['sinker','cutter'].includes(row.pitchType)),
      release=resolveLivePitchReleaseV1(p).position,{seamForce:_zoneSeams,...zoneAero}=profile.air.aerodynamics,
      zoneAir=profile.air.aerodynamics.seamForce===undefined?profile.air:{...profile.air,aerodynamics:zoneAero},
      plateOf=(speed:number,spin:Vec3)=>{const guess=(release.z-target.z)/speed,
        velocity={x:(target.x-release.x)/guess,y:(target.y-release.y-profile.air.gravityY*guess*guess/2)/guess,z:-speed};
        let t=guess,at=sampleAerodynamicPitchStateAtElapsedSeconds({tick:input.originTick,position:release,velocity,spin},t,zoneAir);
        for(let i=0;i<3;i++){t+=(target.z-at.position.z)/at.velocity.z;at=sampleAerodynamicPitchStateAtElapsedSeconds({tick:input.originTick,position:release,velocity,spin},t,zoneAir);}
        return at.position;},
      own=plateOf(selectedSnapshot.releaseSpeedMps,selectedSnapshot.spinRadPerSecond),
      other=fast&&fast.pitchId!==selectedSnapshot.pitchId?plateOf(fast.releaseSpeedMps,fast.spinRadPerSecond):plateOf(selectedSnapshot.releaseSpeedMps,{x:0,y:0,z:0}),
      dx=own.x-other.x,dy=own.y-other.y,length=Math.hypot(dx,dy),ux=length>1e-6?dx/length:0,uy=length>1e-6?dy/length:-1;
    const sx=clamp(target.x,-zone.halfWidth,zone.halfWidth),sy=clamp(target.y,zone.lowerY,zone.upperY),
      reach=Math.min(ux>0?(zone.halfWidth-sx)/ux:ux<0?(-zone.halfWidth-sx)/ux:Infinity,uy>0?(zone.upperY-sy)/uy:uy<0?(zone.lowerY-sy)/uy:Infinity),
      past=.03+.13*margin;
    target.x=sx+(reach+past)*ux;target.y=sy+(reach+past)*uy;
    location=target.y<zone.lowerY?'low':target.y>zone.upperY?'high':target.x*batterSide>0?'inside':'outside';
    return {rate,planned,moved:true as const,wantIn,direction:{x:ux,y:uy}};
  })();
  // pitchTunnelV1 (0..1): a breaking ball thrown for a chase (low or outside) starts like a strike fastball. The look point is
  // the zone spot whose fastball path, shared to 7.25 m short of the plate, leaves this pitch closest to the planned spot; the
  // target moves that share of the way to where the tunnelled pitch ends. No draw is taken; spin, speed and air are unchanged.
  const pitchTunnelPlanV1=p.pitchTunnelV1===undefined||p.pitchTunnelV1===0||input.intentionalBallV1||!['low','outside'].includes(location)
    ||['fastball','sinker'].includes(pitchType)?null:(()=>{
    const owned=p.pitchRepertoireV78===undefined?null:validatePitchRepertoireV78(p.pitchRepertoireV78,p.maximumPitchSpeedMps).pitches,
      fast=owned?owned.find(row=>row.pitchType==='fastball')??owned.find(row=>['sinker','cutter'].includes(row.pitchType))??null
        :resolvePitcherRepertoireV77(p,p.throws??'R').find(row=>row.pitchType==='fastball')??null;
    if(!fast||fast.pitchType===pitchType)return null;
    const {seamForce:_seams,...meanAero}=profile.air.aerodynamics,air=profile.air.aerodynamics.seamForce===undefined?profile.air:{...profile.air,aerodynamics:meanAero},
      edge=.03,inZone=(q:{x:number;y:number})=>({x:clamp(q.x,-zone.halfWidth+edge,zone.halfWidth-edge),y:clamp(q.y,zone.lowerY+edge,zone.upperY-edge)}),
      endFrom=(look:{x:number;y:number})=>solvePitchTunnelAimV1({release:resolveLivePitchReleaseV1(p).position,target:{x:look.x,y:look.y,z:target.z},air,
        originTick:input.originTick,pitch:{speedMps:speed,spinRadPerSecond:spin},fastball:{speedMps:fast.releaseSpeedMps*.99,spinRadPerSecond:fast.spinRadPerSecond},share:1}).plate;
    let look=inZone(target),end=endFrom(look);
    look=inZone({x:target.x-(end.x-look.x),y:target.y-(end.y-look.y)});end=endFrom(look);
    const share=p.pitchTunnelV1,planned={x:target.x,y:target.y};
    target.x+=share*(end.x-target.x);target.y+=share*(end.y-target.y);
    return {share,planned,look,end,target:{x:target.x,y:target.y}};
  })();
  const {lowZoneTechnique,lowZoneTechniqueActive,lowZoneCommandStd,insideTechnique,insideTargetWeight,effectiveCommandStd}=
    resolveLivePitchCommandStdV111({position:target,zone,bats:b.bats,commandStdMeters:p.commandStdMeters,technicalSkills:p.technicalSkills,...(p.throws===undefined?{}:{throws:p.throws})});
  const requestedPosition={x:target.x,y:target.y},allowedCourseIds=Array.from({length:63},(_,index)=>{const column=Math.floor(index/7),row=index%7,x=-zone.halfWidth+(column-1.5)*zone.halfWidth*2/5;
    const allowed=location==='low'?row===0:location==='high'?row===6:location==='inside'?x*batterSide>=.19&&row>=1&&row<=5:location==='outside'?x*-batterSide>=.25&&row>=1&&row<=5:column>=2&&column<=6&&row>=1&&row<=5;
    return allowed?(column+1)*10+row:null;}).filter((id):id is number=>id!==null),
    catcherRequest=selectZoneTargetV87({role:'catcher',profile:catcher.zoneRecognitionV87,position:requestedPosition,zone,
      seed:randomStreamsV152?.seedFor('pitchTarget','catcher-target-v87')??input.seed,allowRetarget:input.location==='auto'&&!pitchTargetPlanV111,allowedCourseIds}),
    pitcherRequest=selectZoneTargetV87({role:'pitcher',profile:p.zoneRecognitionV87,position:catcherRequest.position,zone,
      seed:randomStreamsV152?.seedFor('pitchTarget','pitcher-target-v87')??input.seed,allowRetarget:input.location==='auto'&&!pitchTargetPlanV111,allowedCourseIds}),
    selectedTarget={...target,...pitcherRequest.position},pitcherRecognition=recognizeZoneV87({role:'pitcher',profile:p.zoneRecognitionV87,position:pitcherRequest.position,zone,
      seed:randomStreamsV152?.seedFor('pitchExecution','pitcher-recognition-v87')??input.seed,
      sourceTick:input.originTick,observationTick:input.originTick,planeZ:battingSetupV94.plateFrontZ,standardDeviationMeters:effectiveCommandStd,
      baselineErrorMeters:shapeLiveCommandMissV1({x:commandRandom.normal()*effectiveCommandStd,y:commandRandom.normal()*effectiveCommandStd},{target:pitcherRequest.position,zone,commandStdMeters:effectiveCommandStd,...(p.throws===undefined?{}:{throws:p.throws}),...(p.technicalSkills===undefined?{}:{technicalSkills:p.technicalSkills})}),abilityBasis:'commandStdMeters_and_command_techniques',reason:pitcherRequest.reason}),
    commanded={...selectedTarget,...pitcherRecognition.position};
  const releaseGeometry=resolveLivePitchReleaseV1(p),release=releaseGeometry.position,flightGuess=(release.z-commanded.z)/speed;
  // viewTimeTimingV1: the hitter sees the ball only until he commits, so a faster pitch leaves less of the flight to time it by;
  // the timing spread grows as (view at 40 m/s / this view) to the given power. The view is the flight less the commit time.
  const viewTimingScaleV1=observationPolicyV151?.viewTimeTimingV1===undefined?1:(()=>{const commit=observationPolicyV151.commitSwingSeconds??.26;
    return (Math.max(.05,(release.z-commanded.z)/40-commit)/Math.max(.05,flightGuess-commit))**observationPolicyV151.viewTimeTimingV1!;})();
  // viewTimeAimV1: the same shorter view also blurs where the ball will cross, so the aim spread grows by its own power.
  const viewAimScaleV1=observationPolicyV151?.viewTimeAimV1===undefined?1:(()=>{const commit=observationPolicyV151.commitSwingSeconds??.26;
    return (Math.max(.05,(release.z-commanded.z)/40-commit)/Math.max(.05,flightGuess-commit))**observationPolicyV151.viewTimeAimV1!;})();
  let vx=(commanded.x-release.x)/flightGuess,vy=(commanded.y-release.y-profile.air.gravityY*flightGuess*flightGuess/2)/flightGuess,
    vz=-Math.sqrt(Math.max(speed*speed-vx*vx-vy*vy,speed*speed*.5)),flightTime=flightGuess;
  let initial={tick:input.originTick,position:release,velocity:{x:vx,y:vy,z:vz},spin};
  // The inverse command uses mean aerodynamics and intended spin. Material
  // seam deflection is realized only by the released Source, not anticipated
  // and cancelled by a correction to the thrower's intended velocity.
  const {seamForce:_unanticipatedSeams,...meanAerodynamics}=profile.air.aerodynamics,
    inverseAir=profile.air.aerodynamics.seamForce===undefined?profile.air:{...profile.air,aerodynamics:meanAerodynamics};
  for(let i=0;i<3;i++){
    const at=sampleAerodynamicPitchStateAtElapsedSeconds(initial,flightTime,inverseAir,nominalMaterialOrientationV168);
    flightTime=clamp(flightTime+(commanded.z-at.position.z)/at.velocity.z,.12,1.6);
    vx+=(commanded.x-at.position.x)/flightTime;vy+=(commanded.y-at.position.y)/flightTime;
    const horizontal=Math.hypot(vx,vy);if(horizontal>speed*.65){vx*=speed*.65/horizontal;vy*=speed*.65/horizontal;}
    vz=-Math.sqrt(speed*speed-vx*vx-vy*vy);initial={...initial,velocity:{x:vx,y:vy,z:vz}};
  }
  if(pitchQualityRequestV177!==null){
    pitchQualityV177=selectedSnapshot===null?{status:'NOT_APPLICABLE',reason:'OWNED_V78_PITCH_REQUIRED',
      pitchId:input.pitchId??null,qualityState:pitchQualityRequestV177.qualityState,recipeVersion:'kire_release_recipe_v177'}:
      createLivePitchQualityReleasePlanV177({selected:selectedSnapshot,request:pitchQualityRequestV177,
        referenceReleaseVelocity:initial.velocity,windVelocityMps:profile.air.aerodynamics.windVelocityMps,throws:p.throws??'R',
        ...(profile.air.aerodynamics.seamForce===undefined?{}:{effectiveSeamForce:profile.air.aerodynamics.seamForce}),
        ...(p.maximumPitchSpeedMps===undefined?{}:{maximumPitchSpeedMps:p.maximumPitchSpeedMps})});
    if(pitchQualityV177.status==='APPLIED'){
      pitchReleasePlanV168=resolveLivePitchReleasePlanV168({selected:selectedSnapshot!,request:pitchQualityV177.plan,
        ...(p.maximumPitchSpeedMps===undefined?{}:{maximumPitchSpeedMps:p.maximumPitchSpeedMps})});
      spin=pitchReleasePlanV168.spinRadPerSecond;nominalMaterialOrientationV168=pitchReleasePlanV168.releaseOrientation;
      // Restart from the original command geometry. The first mean solve
      // supplies only the original nominal basis, never the future actual ball.
      vx=(commanded.x-release.x)/flightGuess;vy=(commanded.y-release.y-profile.air.gravityY*flightGuess*flightGuess/2)/flightGuess;
      vz=-Math.sqrt(Math.max(speed*speed-vx*vx-vy*vy,speed*speed*.5));flightTime=flightGuess;
      initial={tick:input.originTick,position:release,velocity:{x:vx,y:vy,z:vz},spin};
      for(let i=0;i<3;i++){
        const at=sampleAerodynamicPitchStateAtElapsedSeconds(initial,flightTime,inverseAir,nominalMaterialOrientationV168);
        flightTime=clamp(flightTime+(commanded.z-at.position.z)/at.velocity.z,.12,1.6);
        vx+=(commanded.x-at.position.x)/flightTime;vy+=(commanded.y-at.position.y)/flightTime;
        const horizontal=Math.hypot(vx,vy);if(horizontal>speed*.65){vx*=speed*.65/horizontal;vy*=speed*.65/horizontal;}
        vz=-Math.sqrt(speed*speed-vx*vx-vy*vy);initial={...initial,velocity:{x:vx,y:vy,z:vz}};
      }
    }
  }
  // The release plan uses intended spin. A reproduction failure is not known
  // before release and must not be compensated by the inverse command solver.
  const nominalReleaseVelocityV155=input.pitchCommandObservationV155?{...initial.velocity}:undefined;
  const spinExecution=p.minimumSpinRatio===undefined||p.minimumSpinRatio===1?{active:false,ratio:1,minimumSpinRatio:1,spin}:
    samplePitchSpinExecutionV78({seed:randomStreamsV152?.seedFor('pitchExecution','spin-reproduction-v78')??input.seed,nominalSpin:spin,minimumSpinRatio:p.minimumSpinRatio});
  if(spinExecution.active)initial={...initial,spin:spinExecution.spin};
  const pitchWorkloadV122=input.pitchWorkloadV122===undefined?null:resolveLivePitchWorkloadExecutionV122({...input.pitchWorkloadV122,
    physics:{velocity:initial.velocity,spin:initial.spin}});
  if(pitchWorkloadV122)initial={...initial,...pitchWorkloadV122.execution.physics};
  if(opticalExperiment){const built=(globalThis as any).__robinLateSource(commanded);(opticalExperiment as any).kernel=built.kernel;(opticalExperiment as any).hiddenAfterSeconds=built.hiddenAfterSeconds;}
  const horizon=Math.min(2.5,Math.max(.8,flightTime+.4,pitchWorkloadV122?(release.z+.85)/Math.max(.001,Math.abs(initial.velocity.z))*1.5+.2:0)),descriptor={kind:'aero_ground_continuous_source_kernel_v2' as const,
    initial:{originTick:input.originTick,elapsedSeconds:0,ball:initial},throughElapsedSeconds:horizon,profile,
    ...(nominalMaterialOrientationV168?{materialOrientationAtStart:nominalMaterialOrientationV168}:{})},kernel=opticalExperiment?.kernel??(()=>{const base=createSourceFreeBallKernel(descriptor),dv=(input as any).__normalForkDeltaV1??0;if(!dv)return base;const cut=.2,at=base.evaluateAt(cut),ball={...at.moment.ball,velocity:{...at.moment.ball.velocity,x:at.moment.ball.velocity.x+dv}},fork=createSourceFreeBallKernel({...descriptor,initial:{originTick:input.originTick,elapsedSeconds:cut,ball},...(at.materialOrientation?{materialOrientationAtStart:at.materialOrientation}:{})});
 const cells=[...base.cells.filter(c=>c.fromElapsedSeconds<cut).map(c=>({...c,throughElapsedSeconds:Math.min(c.throughElapsedSeconds,cut)})),...fork.cells];return {...base,cells,boundaries:[...base.boundaries.filter(q=>q.elapsedSeconds<=cut),...fork.boundaries.filter(q=>q.elapsedSeconds>cut)],evaluateAt:(t:number,side?:'incoming'|'outgoing')=>t<=cut?base.evaluateAt(t,side):fork.evaluateAt(t,side)};})(),
    plateTime=crossing(kernel,battingSetupV94.plateFrontZ),catchPlaneTime=crossing(kernel,-.85);
  assert(plateTime!==null&&catchPlaneTime!==null,'pitched ball did not cross the finite plate/catcher planes');
  if(!opticalExperiment&&(input as any).causalCatcherObservationV1==='fixed_release_100ms_v1'){
    if(plateTime<=.1)throw Error('HOLD: causal catcher observation follows plate crossing');
    if(kernel.boundaries.some((x:any)=>x.kind==='ground'&&x.elapsedSeconds<=.1))throw Error('HOLD: causal catcher observation follows ground contact');
  }
    const catcherObservationTime=opticalExperiment?.1:(input as any).causalCatcherObservationV1==='fixed_release_100ms_v1'?Math.min(.1,horizon):Math.min(.14,plateTime*.35),observedSample=(()=>{const current=kernel.evaluateAt(catcherObservationTime,'incoming');if(!opticalExperiment)return current;const previous=kernel.evaluateAt(catcherObservationTime-.04,'incoming').moment.ball.position,p=current.moment.ball.position;return {...current,moment:{...current.moment,ball:{...current.moment.ball,velocity:{x:(p.x-previous.x)/.04,y:(p.y-previous.y)/.04,z:(p.z-previous.z)/.04},spin:{x:0,y:0,z:0}}}};})(),
    positionObserverV151=observationPolicyV151===undefined?undefined:createLiveBatterPositionObserverV151({policy:observationPolicyV151,
      originTick:input.originTick,planeZ:battingSetupV94.contactPlaneZ,motorLatencySeconds:(b.motorLatencySeconds??0)+Math.max(0,-(input.emotionInfluenceV1?.swingDecisionShiftTicks??0))/tps,...(input.batterForecastPolicyV246===undefined?{}:{forecastPolicyV246:input.batterForecastPolicyV246})},seconds=>{
      if(seconds>horizon||(opticalExperiment&&seconds>=opticalExperiment.hiddenAfterSeconds))return null;const sample=kernel.evaluateAt(seconds).moment.ball;return {tick:sample.tick,position:sample.position};},regionPolicyV222!==undefined||spinTrialRequestV236!==undefined||spinComposeRequestV238!==undefined||anyFrameRequest!==undefined||techniquePolicyV1!==undefined),
    decisionTime=positionObserverV151?(positionObserverV151.decisionTick-input.originTick)/tps:catcherObservationTime,
    rawForecastV151=positionObserverV151?.forecastAt(positionObserverV151.decisionTick),
    forecastResultV246=input.batterForecastPolicyV246===undefined?undefined:positionObserverV151!.forecastAtV246!(positionObserverV151!.decisionTick),
    effectiveForecastV246=forecastResultV246?.forecast??rawForecastV151;
  // accelerationPriorWeightV1 (weight of the observed acceleration, 0..1): from a short look the hitter reads where the ball is
  // and how it moves, but bends its path by what he expects, the pitcher's fastball. The fastball is flown from the same release
  // and direction; past the last look the forecast takes w of the seen bend and 1-w of the fastball's. No force is invented: a
  // breaking ball that shares the fastball's tunnel misses the forecast by half the difference in bend times the time squared.
  // accelerationViewTimeV1 (seconds) instead makes w = look / (look + it), the look being the time from release to the last
  // sample, so the later look after the swing starts trusts the seen bend more and a longer flight reveals more of it.
  const accelerationWeightV1=observationPolicyV151?.accelerationPriorWeightV1,accelerationViewTimeV1=observationPolicyV151?.accelerationViewTimeV1,
    recognitionPolicyV2=observationPolicyV151?.pitchRecognitionV2,
    recognitionPolicyV1=recognitionPolicyV2===undefined?observationPolicyV151?.pitchRecognitionV1:undefined,
    fastBendPitchV1=accelerationWeightV1===undefined&&accelerationViewTimeV1===undefined&&recognitionPolicyV1===undefined&&recognitionPolicyV2===undefined?null:(()=>{
      const owned=p.pitchRepertoireV78===undefined?null:validatePitchRepertoireV78(p.pitchRepertoireV78,p.maximumPitchSpeedMps).pitches;
      return owned?owned.find(row=>row.pitchType==='fastball')??owned.find(row=>['sinker','cutter'].includes(row.pitchType))??null
        :resolvePitcherRepertoireV77(p,p.throws??'R').find(row=>row.pitchType==='fastball')??null;})(),
    bendForecastV1=<F extends Readonly<{status:string;observedThroughTick:number|null;prediction:Readonly<{position:Vec3;arrivalAfterReleaseSeconds:number;estimatedAcceleration:Vec3}>|null}>|null|undefined>(forecast:F,weightOverride?:number,
      expectedPitch:Readonly<{releaseSpeedMps:number;spinRadPerSecond:Vec3}>|null=fastBendPitchV1):F=>{
      if(!expectedPitch||forecast?.status!=='PREDICTED'||!forecast.prediction||forecast.observedThroughTick===null)return forecast;
      const t1=(forecast.observedThroughTick-input.originTick)/tps,t2=forecast.prediction.arrivalAfterReleaseSeconds,dt=t2-t1,
        weight=weightOverride!==undefined?weightOverride:accelerationViewTimeV1!==undefined?t1/(t1+accelerationViewTimeV1):accelerationWeightV1??1;
      if(!(dt>.005)||weight>=1)return forecast;
      const start={...initial,velocity:mul(initial.velocity,expectedPitch.releaseSpeedMps*.99/norm(initial.velocity)),spin:expectedPitch.spinRadPerSecond},
        s1=sampleAerodynamicPitchStateAtElapsedSeconds(start,t1,inverseAir),s2=sampleAerodynamicPitchStateAtElapsedSeconds(start,t2,inverseAir),
        seen=forecast.prediction.estimatedAcceleration,k=.5*(1-weight)*dt*dt,
        expectedX=2*(s2.position.x-s1.position.x-s1.velocity.x*dt)/(dt*dt),expectedY=2*(s2.position.y-s1.position.y-s1.velocity.y*dt)/(dt*dt);
      return {...forecast,prediction:{...forecast.prediction,position:{...forecast.prediction.position,
        x:forecast.prediction.position.x+k*(expectedX-seen.x),y:forecast.prediction.position.y+k*(expectedY-seen.y)}}} as F;
    },
    // pitchRecognitionV1 [chance, degrees, ms]: at the swing decision the hitter tells the pitch from the fastball he expects, or
    // does not. The cues are how far the ball's heading turned away from a fastball released the same way and how much later it
    // will arrive. Unrecognized (chance x exp(-hypot(turn/degrees, delay/ms))), he reads it as that fastball: its bend and its
    // arrival; recognized, he reads the ball itself. Replaces the fooled draw to the remembered location.
    recognitionV1=recognitionPolicyV1===undefined||!fastBendPitchV1||effectiveForecastV246?.status!=='PREDICTED'||!effectiveForecastV246.prediction
      ||effectiveForecastV246.observedThroughTick===null?null:(()=>{
      const t1=(effectiveForecastV246.observedThroughTick!-input.originTick)/tps,plane=battingSetupV94.contactPlaneZ,
        start={...initial,velocity:mul(initial.velocity,fastBendPitchV1.releaseSpeedMps*.99/norm(initial.velocity)),spin:fastBendPitchV1.spinRadPerSecond},
        fast=sampleAerodynamicPitchStateAtElapsedSeconds(start,t1,inverseAir),seen=kernel.evaluateAt(t1,'incoming').moment.ball.velocity,
        turnDegrees=Math.acos(clamp(dot(fast.velocity,seen)/(norm(fast.velocity)*norm(seen)),-1,1))*180/Math.PI;
      let fastArrival=t1+(plane-fast.position.z)/fast.velocity.z;
      for(let i=0;i<3;i++){const at=sampleAerodynamicPitchStateAtElapsedSeconds(start,fastArrival,inverseAir);fastArrival+=(plane-at.position.z)/at.velocity.z;}
      const delayMs=Math.abs(effectiveForecastV246.prediction!.arrivalAfterReleaseSeconds-fastArrival)*1000,
        [chance,degrees,ms]=recognitionPolicyV1 as readonly [number,number,number],
        missChance=Math.min(.95,chance*Math.exp(-Math.hypot(turnDegrees/degrees,delayMs/ms))),
        draw=randomStreamsV152?.rng('batterBelief','pitch-recognition').uniform()??new SeedRoot(input.seed).streamRng(0,'batting','pitch-recognition-v1').nextFloat();
      return {recognized:draw>=missChance,fastArrival,turnDegrees,delayMs,missChance,readPitch:fastBendPitchV1!};
    })(),
    // pitchRecognitionV2 [degrees, ms]: the hitter weighs every pitch the pitcher owns, each released the same way at 0.99 of its
    // speed, by its share times exp(-d^2/2): d = hypot(heading turn/degrees, lag at the same depth/ms), both visible by the last
    // look. The pitch drawn is what he reads: his own is read as it flies, another by that pitch's bend and arrival.
    recognitionV2=recognitionPolicyV2===undefined||effectiveForecastV246?.status!=='PREDICTED'||!effectiveForecastV246.prediction
      ||effectiveForecastV246.observedThroughTick===null?null:(()=>{
      const owned=p.pitchRepertoireV78===undefined?null:validatePitchRepertoireV78(p.pitchRepertoireV78,p.maximumPitchSpeedMps).pitches,
        candidates=owned?owned.map(row=>({id:row.pitchId,pitch:row as Readonly<{releaseSpeedMps:number;spinRadPerSecond:Vec3}>,prior:row.usageWeightV1??1}))
          :resolvePitcherRepertoireV77(p,p.throws??'R').filter(row=>['fastball','slider','curve','changeup'].includes(row.pitchType))
            .map(row=>({id:row.pitchType as string,pitch:row as Readonly<{releaseSpeedMps:number;spinRadPerSecond:Vec3}>,prior:1})),
        actualId=selectedSnapshot?selectedSnapshot.pitchId:pitchType,
        t1=(effectiveForecastV246.observedThroughTick!-input.originTick)/tps,plane=battingSetupV94.contactPlaneZ,
        seenBall=kernel.evaluateAt(t1,'incoming').moment.ball,[degrees,ms]=recognitionPolicyV2 as readonly [number,number],
        weighed=candidates.map(c=>{
          const start={...initial,velocity:mul(initial.velocity,c.pitch.releaseSpeedMps*.99/norm(initial.velocity)),spin:c.pitch.spinRadPerSecond},
            at=sampleAerodynamicPitchStateAtElapsedSeconds(start,t1,inverseAir),
            turnDegrees=Math.acos(clamp(dot(at.velocity,seenBall.velocity)/(norm(at.velocity)*norm(seenBall.velocity)),-1,1))*180/Math.PI,
            lagMs=Math.abs((seenBall.position.z-at.position.z)/at.velocity.z)*1000;
          return {...c,start,at,turnDegrees,lagMs,weight:c.prior*Math.exp(-.5*((turnDegrees/degrees)**2+(lagMs/ms)**2))};
        }),
        total=weighed.reduce((n,c)=>n+c.weight,0),
        draw=randomStreamsV152?.rng('batterBelief','pitch-recognition-v2').uniform()??new SeedRoot(input.seed).streamRng(0,'batting','pitch-recognition-v2').nextFloat();
      if(!(total>0))return null;
      let read=weighed[weighed.length-1],cumulative=0;
      for(const c of weighed){cumulative+=c.weight;if(draw*total<cumulative){read=c;break;}}
      let readArrival=t1+(plane-read.at.position.z)/read.at.velocity.z;
      for(let i=0;i<3;i++){const at=sampleAerodynamicPitchStateAtElapsedSeconds(read.start,readArrival,inverseAir);readArrival+=(plane-at.position.z)/at.velocity.z;}
      return {recognized:read.id===actualId,fastArrival:readArrival,readPitch:read.pitch,readId:read.id,actualId,
        posterior:weighed.map(c=>({id:c.id,share:c.weight/total,turnDegrees:c.turnDegrees,lagMs:c.lagMs}))};
    })(),
    recognitionUsedV1=recognitionV2??recognitionV1,
    readForecastV1=recognitionUsedV1&&!recognitionUsedV1.recognized?bendForecastV1(effectiveForecastV246,0,recognitionUsedV1.readPitch):bendForecastV1(effectiveForecastV246),
    readArrivalV1=recognitionUsedV1&&!recognitionUsedV1.recognized?recognitionUsedV1.fastArrival:effectiveForecastV246?.prediction?.arrivalAfterReleaseSeconds,
    // speedPerceptionV1 (sd of the relative speed error): one misread speed moves the expected arrival and, along the read path,
    // the height and side there together, so a ball read faster than it is comes later and lower than the bat (and the reverse).
    speedErrorV1=observationPolicyV151?.speedPerceptionV1===undefined||readArrivalV1===undefined||!readForecastV1?.prediction
      ||readForecastV1.observedThroughTick===null?null:(()=>{
      const r=randomStreamsV152?.rng('batterBelief','speed-perception-v1'),root=r?null:new SeedRoot(input.seed).streamRng(0,'batting','speed-perception-v1'),
        u1=Math.max(1e-12,r?r.uniform():root!.nextFloat()),u2=r?r.uniform():root!.nextFloat(),
        error=observationPolicyV151!.speedPerceptionV1!*Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2),
        t1=(readForecastV1.observedThroughTick-input.originTick)/tps,remaining=readArrivalV1-t1,shift=remaining/(1+clamp(error,-.5,.5))-remaining;
      return {error,shiftSeconds:shift};
    })(),
    perceivedForecastV1=speedErrorV1===null?readForecastV1:{...readForecastV1!,prediction:{...readForecastV1!.prediction!,position:{...readForecastV1!.prediction!.position,
      x:readForecastV1!.prediction!.position.x+readForecastV1!.prediction!.estimatedVelocity.x*speedErrorV1.shiftSeconds,
      y:readForecastV1!.prediction!.position.y+readForecastV1!.prediction!.estimatedVelocity.y*speedErrorV1.shiftSeconds}}},
    perceivedArrivalV1=readArrivalV1===undefined?undefined:readArrivalV1+(speedErrorV1?.shiftSeconds??0);
  if(opticalExperiment&&effectiveForecastV246?.status!=='PREDICTED')throw Error('Robin optical HOLD: no observed forecast');
  assert(!(input.managerCommunicationV122&&input.swingInstructionV121),'ambiguous received and raw manager instruction');
  const managerCommunicationV122=input.managerCommunicationV122===undefined?null:resolveLiveManagerCommunicationV122({...input.managerCommunicationV122,
    seed:randomStreamsV152?.seedFor('communication','manager-communication-v122')??input.seed,
    clock:{originTick:input.originTick,ticksPerSecond:tps},cutoff:{tick:quantizeEventTick(input.originTick,decisionTime,tps),elapsedSeconds:decisionTime}}),
    receivedInstructionV122=managerCommunicationV122?.status==='RECEIVED'?managerCommunicationV122.instruction:input.swingInstructionV121;
  const predictFromObservation=(sample:typeof observedSample,atSeconds:number,plane:number)=>{
    const observed=sample.moment.ball;
    let dt=Math.max(.001,(plane-observed.position.z)/observed.velocity.z),pred=observed;
    for(let i=0;i<3;i++){pred=sampleAerodynamicPitchStateAtElapsedSeconds(observed,dt,profile.air,sample.materialOrientation);dt=clamp(dt+(plane-pred.position.z)/pred.velocity.z,.001,horizon-atSeconds);}
    return {elapsedSeconds:atSeconds+dt,ball:sampleAerodynamicPitchStateAtElapsedSeconds(observed,dt,profile.air,sample.materialOrientation)};
  };
  const swingIntentV121=b.swingPolicyV121===undefined?null:resolveBatterApproachV121({policy:b.swingPolicyV121,mode:input.batting,
    strikes:input.pitchSituationV111?.strikes??0,draw:randomStreamsV152?.rng('batterApproach','effort').uniform()??new SeedRoot(input.seed).streamRng(0,'batting','continuous-intent-v121').nextFloat(),
    ...(receivedInstructionV122===undefined?{}:{instruction:receivedInstructionV122})});
  const yawDeferExecutionV274=input.yawDiagnosticV274!==undefined;
  if(yawDeferExecutionV274&&!randomStreamsV152)throw Object.assign(new Error('yaw diagnostic: INDEPENDENT_RANDOMNESS_REQUIRED'),{yawDiagnosticStatus:'HOLD'});
  const observedPredictionV122=positionObserverV151?{elapsedSeconds:speedErrorV1?perceivedArrivalV1!:recognitionUsedV1&&!recognitionUsedV1.recognized?recognitionUsedV1.fastArrival:effectiveForecastV246!.prediction?.arrivalAfterReleaseSeconds??decisionTime,
      ball:{tick:positionObserverV151.decisionTick,position:perceivedForecastV1!.prediction?.position??{x:0,y:middle,z:battingSetupV94.contactPlaneZ},
        velocity:effectiveForecastV246!.prediction?.estimatedVelocity??zero(),spin:zero()}}
      :predictFromObservation(observedSample,decisionTime,battingSetupV94.contactPlaneZ),
    priorV122=intentV122?.preparedPrediction??(preparedRecallV151?{x:preparedRecallV151.position.x,y:preparedRecallV151.position.y,
      arrivalAfterReleaseSeconds:preparedRecallV151.arrivalAfterReleaseSeconds}:null),
    requestedPriorWeightV151=intentV122?.preparedPrediction?(intentV122.priorWeight??0):preparedRecallV151?.priorWeight??0,
    currentObservationAvailableV151=positionObserverV151===undefined||effectiveForecastV246?.status==='PREDICTED',
    usablePriorV151=priorV122!==null&&priorV122!==undefined&&requestedPriorWeightV151>0,
    priorWeightV122=!currentObservationAvailableV151&&usablePriorV151?1:requestedPriorWeightV151,
    prediction=priorV122&&priorWeightV122>0?{...observedPredictionV122,
      elapsedSeconds:Math.max(decisionTime,observedPredictionV122.elapsedSeconds*(1-priorWeightV122)+priorV122.arrivalAfterReleaseSeconds*priorWeightV122),
      ball:{...observedPredictionV122.ball,position:{...observedPredictionV122.ball.position,
        x:observedPredictionV122.ball.position.x*(1-priorWeightV122)+priorV122.x*priorWeightV122,
        y:observedPredictionV122.ball.position.y*(1-priorWeightV122)+priorV122.y*priorWeightV122}}}:observedPredictionV122,
    // The swing decision keeps the remembered pitch (a hitter can still be fooled into chasing); the bat goes where it was seen.
    // Fooled or not, per swing: a fooled hitter puts the bat where he expected the pitch, otherwise where he saw it.
    // fooledViewPowerV1: a hitter leans on his expectation as much as his look is short. He times the swing for the pitch he
    // expects, so the look he gets is the expected arrival less the commit time and motor latency, whatever comes: a changeup
    // after fastballs gives the fastball's short look. The fooled chance grows as (the look at fooledViewReferenceV1, 0.44 s by default, / this look)^power.
    fooledChanceV1=observationPolicyV151?.priorFooledChanceV1===undefined||observationPolicyV151.fooledViewPowerV1===undefined?observationPolicyV151?.priorFooledChanceV1
      :(()=>{const lead=(observationPolicyV151.commitSwingSeconds??.26)+(b.motorLatencySeconds??0),expected=priorV122?.arrivalAfterReleaseSeconds??flightGuess;
        return Math.min(.95,observationPolicyV151.priorFooledChanceV1!*(Math.max(.05,(observationPolicyV151.fooledViewReferenceV1??.44)-lead)/Math.max(.05,expected-lead))**observationPolicyV151.fooledViewPowerV1!);})(),
    fooledV1=fooledChanceV1!==undefined&&currentObservationAvailableV151&&!!priorV122&&priorWeightV122>0
      &&(randomStreamsV152?.rng('batterBelief','fooled-placement').uniform()??new SeedRoot(input.seed).streamRng(0,'batting','fooled-placement-v1').nextFloat())<fooledChanceV1,
    placementPriorWeightV1=recognitionUsedV1?0:fooledChanceV1!==undefined&&currentObservationAvailableV151?(fooledV1&&!recognitionPolicyV1&&!recognitionPolicyV2?1:0)
      :observationPolicyV151?.priorPlacementShareV1===undefined||!currentObservationAvailableV151?priorWeightV122:priorWeightV122*observationPolicyV151.priorPlacementShareV1,
    placementPositionV1=placementPriorWeightV1===priorWeightV122||!priorV122?prediction.ball.position:{...observedPredictionV122.ball.position,
      x:observedPredictionV122.ball.position.x*(1-placementPriorWeightV1)+priorV122.x*placementPriorWeightV1,
      y:observedPredictionV122.ball.position.y*(1-placementPriorWeightV1)+priorV122.y*placementPriorWeightV1},
    controlFactor=swingIntentV121?1:input.batting==='power'?1.08:input.batting==='contact'?.92:1;
  let baselineTimingError=yawDeferExecutionV274?0:timingRandom.normal()*b.timingStdSeconds*viewTimingScaleV1*(swingIntentV121?1:input.batting==='contact'?.72:input.batting==='power'?1.15:1);
  const awkwardness=Math.max(0,Math.abs(prediction.ball.position.x)/.2159-1,(.55-prediction.ball.position.y)/.5,(prediction.ball.position.y-1.5)/.5),
    awkwardErrorFactor=b.badBallControl===undefined?1:1+awkwardness*(1-b.badBallControl),
    aimScale=b.aimStdMeters*(swingIntentV121?1:input.batting==='contact'?.7:input.batting==='power'?1.1:1)*awkwardErrorFactor*viewAimScaleV1;
  let baselineAimError=yawDeferExecutionV274?zero():{x:aimRandom.normal()*aimScale,y:aimRandom.normal()*aimScale*(observationPolicyV151?.aimVerticalScaleV1??1),z:aimRandom.normal()*aimScale*.3},
    sweetSpotT=clamp((b.sweetSpotT??(b.batLengthM-.1524)/b.batLengthM)+(yawDeferExecutionV274?0:(sweetSpotRandom.uniform()-.5)*.025),.65,.9);
  const heightScale=b.heightMeters/1.8;
  // visionJudgmentV1 [std at vision 70, points per factor e]: the ball-strike judgment spread comes from the 1-100 vision itself,
  // so each point counts for more than the maker's stored spread gives (100 points per e left a 100 eye barely better than 70).
  const visionJudgmentV1=observationPolicyV151?.visionJudgmentV1,
    judgmentStd=visionJudgmentV1?visionJudgmentV1[0]!*Math.exp(-(resolveLivePlateVisionV1(b)-70)/visionJudgmentV1[1]!):b.zoneJudgmentStdMeters??0,judgmentError={x:0,y:0};
  if(judgmentStd!==0){
    // An isolated recognition stream does not consume clip, pitch-command,
    // timing or aim draws. No identity/league enters this numerical model.
    const judgmentRng=new SeedRoot(randomStreamsV152?.seedFor('batterPerception','zone-judgment-v1')??input.seed).streamRng(0,'batting','zone-judgment-v1'),
      normal=()=>Math.sqrt(-2*Math.log(1-judgmentRng.nextFloat()))*Math.cos(2*Math.PI*judgmentRng.nextFloat());
    judgmentError.x=normal()*judgmentStd;judgmentError.y=normal()*judgmentStd;
  }
  const observationTick=positionObserverV151?.decisionTick??input.originTick+Math.round(decisionTime*tps),batterRecognition=recognizeZoneV87({role:'batter',profile:b.zoneRecognitionV87,position:prediction.ball.position,zone,
    seed:randomStreamsV152?.seedFor('batterPerception','zone-recognition-v87')??input.seed,
    sourceTick:effectiveForecastV246?.observedThroughTick??observationTick,observationTick,planeZ:battingSetupV94.contactPlaneZ,standardDeviationMeters:judgmentStd,baselineErrorMeters:judgmentError,abilityBasis:'zoneJudgmentStdMeters'}),
    judgmentPosition={...prediction.ball.position,...batterRecognition.position},recognitionAimOffset=batterRecognition.diagnostics.biasMeters,
    // undercutAimV1: a swing aims the sweet spot this far under the ball's centre, as hitters who lift the ball do.
    undercutV1=input.batting==='bunt'?0:b.undercutAimMeters??observationPolicyV151?.undercutAimV1??0,
    motorAimPosition=recognitionAimOffset.x===0&&recognitionAimOffset.y===0&&undercutV1===0?placementPositionV1:{...placementPositionV1,x:placementPositionV1.x+recognitionAimOffset.x,y:placementPositionV1.y+recognitionAimOffset.y-undercutV1};
  const inChaseEnvelope=Math.abs(judgmentPosition.x)<=zone.halfWidth+b.chaseMarginMeters
    &&judgmentPosition.y>=zone.lowerY-b.chaseMarginMeters&&judgmentPosition.y<=zone.upperY+b.chaseMarginMeters,
    zoneMargin=Math.min(zone.halfWidth-Math.abs(judgmentPosition.x),judgmentPosition.y-zone.lowerY,zone.upperY-judgmentPosition.y),
    swingScore=clamp((.5+zoneMargin/Math.max(.1,zone.halfWidth)+(b.swingDecision?(b.swingDecision.aggressionWeight-.5)*.2:0))*batterRecognition.diagnostics.targetWeight,0,1);
  const deliveredPredictionV151=currentObservationAvailableV151||usablePriorV151;
  const countBallsV1=input.pitchSituationV111?.balls??0,countStrikesV1=input.pitchSituationV111?.strikes??0,
    expansionV1=(countStrikesV1===2?observationPolicyV151?.twoStrikeExpansionV1??0:0)+(input.emotionInfluenceV1?.swingAggressionDelta??0);
  const visionThresholdShiftV1=observationPolicyV151?.visionSelectivityV1!==undefined?(resolveLivePlateVisionV1(b)-70)*observationPolicyV151.visionSelectivityV1:0;
  let swingOffered=deliveredPredictionV151&&input.batting!=='take'&&(!swingIntentV121||swingIntentV121.effort>0)&&(b.swingDecision?b.swingDecision.approach==='SWING'
      ||b.swingDecision.approach==='AUTO'&&inChaseEnvelope&&swingScore>=b.swingDecision.threshold+visionThresholdShiftV1-expansionV1:inChaseEnvelope&&batterRecognition.diagnostics.targetWeight>0);
  const countReadinessV1=observationPolicyV151?.countReadinessV1?.[countBallsV1]?.[countStrikesV1];
  if(swingOffered&&countReadinessV1!==undefined&&b.swingDecision?.approach!=='SWING'&&
    new SeedRoot(randomStreamsV152?.seedFor('batterPerception','count-readiness-v1')??input.seed).streamRng(0,'batting','count-readiness-v1').nextFloat()>=countReadinessV1)swingOffered=false;
  const practiceSwingDecisionV241=input.practiceSwingDecisionV241===undefined?undefined:resolvePracticeSwingDecisionV241({
    request:parsePracticeSwingDecisionV241(input.practiceSwingDecisionV241),managedOffense:true,explicitPractice:true,
    batting:input.batting,managerCommunicationPresent:input.managerCommunicationV122!==undefined,baselineOffer:swingOffered,
    effort:swingIntentV121?.effort??null,currentForecast:effectiveForecastV246??null,decisionCutoffTick:observationTick});
  if(practiceSwingDecisionV241)swingOffered=practiceSwingDecisionV241.offerAfterIntent;
  const learnedMotionClipV124=spinProfileV123===undefined?null:findLiveSpinMotionClipV124(spinProfileV123,b.bats,input.measuredClips),
    intentClipV124=learnedMotionClipV124??clip;
  const spinIntentInputV123=spinProfileV123===undefined?undefined:{profile:spinProfileV123,bats:b.bats,
    clip:{id:intentClipV124.id,sourceSha256:intentClipV124.source.sha256},observation:{observedTick:observationTick,availableTick:observationTick,decisionTick:observationTick},
    perceivedPosition:{x:judgmentPosition.x,y:judgmentPosition.y},zone,timeUntilContactSeconds:Math.max(0,prediction.elapsedSeconds-decisionTime),
    swingOffered,battingMode:input.batting},
    spinIntentV123=spinIntentInputV123===undefined?undefined:techniquePolicyV1?selectLiveSpinIntentOrNoneV123(spinIntentInputV123)??undefined:selectLiveSpinIntentV123(spinIntentInputV123),spinMotionV123=spinIntentV123?.motion;
  if(spinMotionV123){
    if(learnedMotionClipV124){
      assert(learnedMotionClipV124.id.startsWith('obp-')&&learnedMotionClipV124.source.repository===openBiomechanics
        &&/^[a-f0-9]{64}$/.test(learnedMotionClipV124.source.sha256)&&Number.isFinite(learnedMotionClipV124.contactTimeSeconds)
        &&learnedMotionClipV124.frames.length>=2,'unsupported learned measured clip provenance');
      clip=learnedMotionClipV124;
    }
    const arc=impactTrajectory??DEFAULT_WHOLE_ARC_TRAJECTORY_V1;
    impactTrajectory={...arc,method:'whole-arc-target',angleDegreesByLevel:[spinMotionV123.attackAngleDegrees,spinMotionV123.attackAngleDegrees,
      spinMotionV123.attackAngleDegrees,spinMotionV123.attackAngleDegrees]};
  }
  const observedSpinTrialV236=spinTrialRequestV236===undefined?undefined:resolveLiveObservedSpinTrialV236({request:spinTrialRequestV236,
    snapshot:positionObserverV151?.snapshotAt?.(positionObserverV151.decisionTick)??null,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:clip.side},
    swingOffered,battingMode:input.batting});
  const observedSpinComposeV238=spinComposeRequestV238===undefined?undefined:resolveLiveObservedSpinComposeV238({request:spinComposeRequestV238,
    snapshot:positionObserverV151?.snapshotAt?.(positionObserverV151.decisionTick)??null,clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:clip.side},
    decisionTick:observationTick,swingOffered,battingMode:input.batting});
  // Selected from what the batter has at commitment. The request it builds is the
  // ordinary V244 trial, so it can act only as a bat translation before contact.
  let techniqueSelectionV1:BatterTechniqueSelectionV1|null=null,techniqueSkipV1:string|null=null;
  if(techniquePolicyV1){
    const situation=input.pitchSituationV111,memory=input.batterObservedMemoryV151;
    if(rawSpinRequest!==undefined||spinPracticePolicyV239||input.yawDiagnosticV274!==undefined)techniqueSkipV1='TRIAL_OWNS_SWING';
    else if(!swingOffered||input.batting==='take'||input.batting==='bunt')techniqueSkipV1='NO_SWING';
    else if(spinMotionV123)techniqueSkipV1='SPIN_MOTOR_OWNS_SWING';
    else if(!situation||!memory)techniqueSkipV1='NO_BATTER_CONTEXT';
    else{
      techniqueSelectionV1=selectBatterContactTechniqueV1({bats:b.bats,perceived:{x:judgmentPosition.x,y:judgmentPosition.y},zone,balls:situation.balls,strikes:situation.strikes,outs:situation.outs,bases:situation.occupiedBases,
        swingMode:input.batting,plateAggression:b.swingDecision?.aggressionWeight??.5,approach:b.batterApproachV122??null,
        draw:new SeedRoot(randomStreamsV152?.seedFor('batterApproach','contact-technique-v1')??input.seed).streamRng(0,'batting','contact-technique-v1').nextFloat()});
      if(techniqueSelectionV1.technique)try{contactFrameRequestV244=anyFrameRequest=validateLiveObservedContactFrameTrialV244({version:'live_observed_contact_frame_trial_v244',subjectId:memory.observerPlayerId,technique:techniqueSelectionV1.technique,
        clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:clip.side},domain:{plateZ:battingSetupV94.contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1'},policy:'FIXED_25_UNCALIBRATED_V243',thresholds:techniquePolicyV1.thresholds});}
      catch{techniqueSkipV1='REQUEST_INVALID';}
    }
  }
  const techniqueRequestedV1=techniqueSelectionV1?.technique!=null&&contactFrameRequestV244!==undefined;
  const contactFrameSnapshotV244=anyFrameRequest?positionObserverV151?.snapshotAt?.(observationTick)??null:null;
  const contactFramePreCheckV244=()=>{
    if(!anyFrameRequest)return null;
    if(!swingOffered||input.batting==='take'||input.batting==='bunt')return 'NO_SWING';
    if(anyFrameRequest.clip.id!==clip.id||anyFrameRequest.clip.sourceSha256!==clip.source.sha256||anyFrameRequest.clip.bats!==clip.side)return 'CLIP_MISMATCH';
    if(!contactFrameSnapshotV244)return 'MISSING_DELIVERED_FORECAST';
    if(!Object.is(anyFrameRequest.domain.plateZ,contactFrameSnapshotV244.planeZ))return 'DOMAIN_MISMATCH';
    if(contactFrameSnapshotV244.cutoffTick!==observationTick)throw Error('contact frame v244: cutoff differs');
    const snapshot=contactFrameSnapshotV244,legacyForecast=forecastObservedPitchV151({originTick:snapshot.originTick,ticksPerSecond:snapshot.ticksPerSecond,cutoffTick:snapshot.cutoffTick,planeZ:snapshot.planeZ,maximumAfterReleaseSeconds:snapshot.maximumAfterReleaseSeconds,observations:snapshot.observations});
    const same=(a:unknown,b:unknown):boolean=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
    if(!same(legacyForecast,snapshot.forecast)||!same(legacyForecast.usedObservationIds,snapshot.observations.map(o=>o.observationId)))throw Error('contact frame v244: frozen legacy forecast differs');
    const snapshotV246=input.batterForecastPolicyV246===undefined?null:positionObserverV151!.snapshotAtV246!(observationTick)!;
    if(snapshotV246){const replay=forecastObservedPitchV246({originTick:snapshotV246.originTick,ticksPerSecond:snapshotV246.ticksPerSecond,cutoffTick:snapshotV246.cutoffTick,planeZ:snapshotV246.planeZ,maximumAfterReleaseSeconds:snapshotV246.maximumAfterReleaseSeconds,observations:snapshotV246.observations},snapshotV246.policy);if(!same(replay,snapshotV246.result)||!same(snapshotV246.result,forecastResultV246))throw Error('contact frame v244: frozen V246 forecast differs');}
    const forecast=snapshotV246?.result.forecast??legacyForecast;
    if(forecast.status!=='PREDICTED'||!forecast.prediction)return 'MISSING_DELIVERED_FORECAST';
    if(snapshot.originTick+Math.round(forecast.prediction.arrivalAfterReleaseSeconds*snapshot.ticksPerSecond)<=observationTick)return 'NO_FORWARD_CROSSING';
    return null;
  };
  // A managed trial still stops on a broken frozen forecast; a match just swings normally.
  const contactFramePreReasonV244=(()=>{try{return contactFramePreCheckV244();}catch(error){if(techniqueRequestedV1)return 'PRECHECK_FAILED';throw error;}})();
  // The course is chosen from the current perceived forecast. Neither a
  // future Source sample nor the eventual contact/result selects the ability.
  const predictedCourse=courseProfile===undefined?null:classifyBatterCourseV79({position:judgmentPosition,zone}),
    courseAverage=predictedCourse?.courseIndex===null||predictedCourse===null?null:courseProfile!.referenceAverages[predictedCourse.courseIndex],
    courseMotorActive=courseProfile!==undefined&&swingOffered&&input.batting!=='bunt',
    courseErrorScale=courseMotorActive&&courseAverage!==null?clamp(1-1.25*(courseAverage-.25)*courseProfile!.effectScale,.75,1.25):1;
  const directionIntent=(()=>{
    if(intentV122||input.battingDirectionRequestV149?.mode&&input.battingDirectionRequestV149.mode!=='AUTO')return null;
    if(!courseMotorActive||courseProfile!.directionWeights===undefined)return null;
    const draw=randomStreamsV152?.rng('batterDirection','legacy-course-direction').uniform()
      ??new SeedRoot(input.directionTrialSeedV79??input.seed).streamRng(0,'batting','direction-intent-v79').nextFloat();
    const target=draw*courseProfile!.directionWeights.reduce((sum,weight)=>sum+weight,0);
    let cumulative=0,sectorIndex=4;
    for(let i=0;i<5;i++){cumulative+=courseProfile!.directionWeights[i];if(target<cumulative){sectorIndex=i;break;}}
    const fieldAngleDegrees=-36+18*sectorIndex,pullAngleDegrees=-fieldAngleDegrees*(b.bats==='R'?1:-1);
    return {sectorIndex,fieldAngleDegrees,pullAngleDegrees,draw,stream:'direction-intent-v79' as const};
  })();
  const battingDirectionV149=input.battingDirectionRequestV149===undefined?undefined:resolveBattingDirectionRequestV149({
    request:input.battingDirectionRequestV149,bats:b.bats,selectedAtTick:observationTick,personalDirection:intentV122?.direction,
    legacyDirection:directionIntent,targetPullAnglesDegrees:b.batterApproachV122?.targetPullAnglesDegrees});
  const hitDirectionDegreesV1=battingDirectionV149?.direction.pullAngleDegrees??intentV122?.direction.pullAngleDegrees??directionIntent?.pullAngleDegrees??b.pullAngleDegrees??undefined;
  const predictedZoneHeight=(prediction.ball.position.y-zone.lowerY)/(zone.upperY-zone.lowerY),
    highHitWeight=techniqueBlend((predictedZoneHeight-.55)/.35),lowHitWeight=techniqueBlend((.45-predictedZoneHeight)/.35),
    highHitTechnique=b.technicalSkills?.high_zone_hitting??0,lowHitTechnique=b.technicalSkills?.low_zone_hitting??0,
    zoneHitStrength=swingOffered&&input.batting!=='bunt'?highHitTechnique*highHitWeight+lowHitTechnique*lowHitWeight+resolveLiveContextHitStrengthV1(b.technicalSkills,{bats:b.bats,perceivedX:judgmentPosition.x,...(zone.centerX===undefined?{}:{zoneCenterX:zone.centerX}),zoneHalfWidth:zone.halfWidth,pitchType,...(hitDirectionDegreesV1===undefined?{}:{pullAngleDegrees:hitDirectionDegreesV1})}):0,
    zoneHitErrorScale=zoneHitStrength>0?1/(1+.4*zoneHitStrength):1;
  let zoneTimingError=zoneHitStrength>0?baselineTimingError*zoneHitErrorScale:baselineTimingError,
    zoneAimError=zoneHitStrength>0?mul(baselineAimError,zoneHitErrorScale):baselineAimError,
    timingError=courseErrorScale===1?zoneTimingError:zoneTimingError*courseErrorScale,
    courseAimError=courseErrorScale===1?zoneAimError:mul(zoneAimError,courseErrorScale),
    aimError=batterRecognition.diagnostics.uncertaintyScale===1?courseAimError:{...courseAimError,x:courseAimError.x*batterRecognition.diagnostics.uncertaintyScale,y:courseAimError.y*batterRecognition.diagnostics.uncertaintyScale},
    desiredContactTime=Math.max(.055,(observedSpinTrialV236?.status==='APPLIED'?observedSpinTrialV236.contactArrivalAfterReleaseSeconds:prediction.elapsedSeconds)+timingError+(b.technicalTimingOffsetSeconds??0));
  const sourceContactTick=clip.contactTimeSeconds*1e6;
  let authoredEnvelopeV133=envelopeSourceV133&&input.batting!=='bunt'?scaleLiveSwingEnvelopeV133(envelopeSourceV133,heightScale,battingSetupV94.stanceOffsetZ):undefined;
  let envelopeV133=authoredEnvelopeV133&&swingOffered?authoredEnvelopeV133:undefined;
  const intendedPullAngleDegrees=battingDirectionV149?(battingDirectionV149.direction.pullAngleDegrees??undefined)
    :intentV122?(intentV122.direction.pullAngleDegrees??undefined):directionIntent?.pullAngleDegrees??b.pullAngleDegrees,
    reactiveMotorV161=input.battingDirectionRequestV149?.mode==='AUTO'&&battingDirectionV149?.direction.kind==='REACTIVE',
    directionMotorReasonV153=!swingOffered?'NO_SWING':input.batting==='bunt'?'BUNT_MOTOR':intendedPullAngleDegrees===undefined&&!reactiveMotorV161?'REACTIVE_NO_ANGLE_TARGET'
      :!effectiveForecastV246?.prediction?'NO_OBSERVED_VELOCITY':spinMotionV123?'QUALIFIED_SPIN_MOTOR_OWNS_REGISTRATION':null,
    directionMotorActiveV153=directionMotorPolicyV153!==undefined&&directionMotorReasonV153===null,
    planningSweetSpotT=directionMotorActiveV153?clamp(b.sweetSpotT??(b.batLengthM-.1524)/b.batLengthM,.65,.9):sweetSpotT,
    planningContactTime=directionMotorActiveV153?Math.max(.055,prediction.elapsedSeconds+(b.technicalTimingOffsetSeconds??0)):desiredContactTime;
  const fullFrames=registerMeasuredBatToFieldV1(clip.frames).map(f=>({tick:f.tick,grip:mul(f.grip,heightScale),orientation:f.orientation}));
  if(directionMotorActiveV153&&!authoredEnvelopeV133){
    // A declared operational bridge from the player's own fixed clip boundary
    // poses. No current prediction, direction or execution error sets the hold.
    const pose=(frame:typeof fullFrames[number],durationSeconds:number)=>({durationSeconds,
      grip:{...frame.grip,z:frame.grip.z+battingSetupV94.stanceOffsetZ},orientation:{...frame.orientation}});
    authoredEnvelopeV133={version:'reference_bat_envelope_v133',sourceId:'observed-direction-fixed-boundary-v153-not-measured',
      preparation:pose(fullFrames[0],.08),recovery:pose(fullFrames.at(-1)!, .12)} satisfies ReferenceBatEnvelopeV133;
    envelopeV133=authoredEnvelopeV133;
  }
  const probeInput:ReferenceBatKinematicsInputV1={provenance:{clipId:clip.id,sourceSha256:clip.source.sha256},frames:fullFrames,batLengthM:b.batLengthM,
      sweetSpotT:planningSweetSpotT,sourceTicksPerSecond:1e6,startTick:envelopeV133?input.originTick+Math.ceil(envelopeV133.preparation.durationSeconds*tps):input.originTick,ticksPerSecond:tps,playbackRate:1,
      ...(executionV122||directionMotorActiveV153?{executionInterpolationV122:'cubic-c1' as const}:{}),
      ...(envelopeV133?{executionEnvelopeV133:envelopeV133}:{}),
      transform:{rotation:IDENTITY_QUATERNION,translation:zero(),scale:1}},probe=createReferenceBatKinematicsV1(probeInput),
    // contactLeadAlignV1: aim the attack angle where bat and ball first touch, about a millisecond before the clip's
    // contact time, and from the approaching swing; 'outgoing' at the clip contact carries the recorded slowdown.
    contactLeadV1=observationPolicyV151?.contactLeadAlignV1,
    probeVelocity=contactLeadV1===undefined?probe.sampleAtSourceTick(sourceContactTick,'outgoing').sweetSpotVelocity
      :probe.sampleAtSourceTick(sourceContactTick-contactLeadV1*1e6,'incoming').sweetSpotVelocity,
    adjustedProbe=impactTrajectory===undefined?probe:createReferenceBatKinematicsV1(withReferenceImpactTrajectoryV1(probeInput,sourceContactTick,impactTrajectory));
  let rate=b.swingRate*controlFactor;
  if(b.targetSweetSpotSpeedMps!==undefined){assert(norm(probeVelocity)>1e-9,'measured reference has no finite contact speed');rate*=b.targetSweetSpotSpeedMps*(observationPolicyV151?.targetSpeedScaleV1??1)/norm(probeVelocity);}
  const batCapacityV121=b.batSwingCapacityV121===undefined?null:evaluateBatSwingCapacityV121({maximumSweetSpotSpeedMps:b.maximumSweetSpotSpeedMps??45,
    bat:{lengthM:b.batLengthM,massKg:b.batMassKg,sweetSpotT:b.sweetSpotT??(b.batLengthM-.1524)/b.batLengthM},model:b.batSwingCapacityV121}),
    // With the policy set, the ceiling is a speed at the ball: the motion's own bound
    // also covers the follow-through, which runs faster than contact.
    contactCeilingV121=(()=>{const ceiling=batCapacityV121?.effectiveMaxSweetSpotSpeedMps??b.maximumSweetSpotSpeedMps,room=observationPolicyV151?.swingSpeedRoomV1;return ceiling!==undefined&&room!==undefined&&b.targetSweetSpotSpeedMps!==undefined?Math.max(ceiling,b.targetSweetSpotSpeedMps*room):ceiling;})(),
    effectiveMaximumSpeedV121=contactCeilingV121===undefined||!observationPolicyV151?.contactSpeedCeilingV1?contactCeilingV121:contactCeilingV121*Math.max(1,adjustedProbe.maximumSweetSpotSpeedMps/norm(probeVelocity))**(observationPolicyV151.contactSpeedCeilingShareV1??1);
  if(batCapacityV121&&b.targetSweetSpotSpeedMps!==undefined){const check=validateBatSwingCapacityTargetV121(batCapacityV121,b.targetSweetSpotSpeedMps);
    assert(check.valid,'希望芯速度がこのバットの推定上限を超えています。'+String(check.proposedTargetSweetSpotSpeedMps)+' m/s以下へ調整してください。');}
  if(effectiveMaximumSpeedV121!==undefined&&!envelopeV133)rate=Math.min(rate,effectiveMaximumSpeedV121/adjustedProbe.maximumSweetSpotSpeedMps);
  assert(bounded(rate,.01,20),'authored motor rate is outside this finite reference model');
  let authoredRotation=IDENTITY_QUATERNION;
  const spinPullDeltaV123=spinMotionV123?.pullAngleDeltaDegrees??0;
  if(b.attackAngleDegrees!==undefined||intendedPullAngleDegrees!==undefined||spinPullDeltaV123!==0){
    const side=b.bats==='R'?1:-1,attack=b.attackAngleDegrees===undefined?Math.atan2(probeVelocity.y,Math.hypot(probeVelocity.x,probeVelocity.z)):b.attackAngleDegrees*Math.PI/180,
      basePull=intendedPullAngleDegrees===undefined?-Math.atan2(probeVelocity.x,probeVelocity.z):intendedPullAngleDegrees*side*Math.PI/180,
      pull=spinPullDeltaV123===0?basePull:basePull+spinPullDeltaV123*side*Math.PI/180;
    authoredRotation=betweenDirections(probeVelocity,{x:-Math.sin(pull)*Math.cos(attack),y:Math.sin(attack),z:Math.cos(pull)*Math.cos(attack)});
  }
  const compactWindow=swingIntentV121?(sourceContactTick-fullFrames[0].tick)/1e6/rate*(1-.5*swingIntentV121.compactness):Infinity,
    minimumSourceTick=Math.min(sourceContactTick-Math.min(b.preContactSeconds??Math.max(0,planningContactTime-.045),compactWindow)*rate*1e6,
    !localImpactWindow?Infinity:sourceContactTick-impactTrajectory!.beforeSeconds*1e6);
  let selectedFrames=fullFrames.filter(f=>f.tick>=minimumSourceTick);
  if(b.preContactSeconds!==undefined||localImpactWindow){const previous=fullFrames.filter(f=>f.tick<minimumSourceTick).at(-1);if(previous)selectedFrames=[previous,...selectedFrames];}
  if(b.followThroughSeconds!==undefined){const maximumSourceTick=Math.max(sourceContactTick+b.followThroughSeconds*rate*1e6,
      !localImpactWindow?-Infinity:sourceContactTick+impactTrajectory!.afterSeconds*1e6),
    last=selectedFrames.findIndex(f=>f.tick>=maximumSourceTick);if(last>=0)selectedFrames=selectedFrames.slice(0,last+1);}
  assert(selectedFrames.length>=2&&selectedFrames[0].tick<sourceContactTick&&selectedFrames.at(-1)!.tick>sourceContactTick,'measured swing does not bracket contact reference');
  const swingMotorV121=swingIntentV121&&swingIntentV121.effort>0?planSwingClockV121({requestedRate:rate,referenceMaximumSpeedMps:adjustedProbe.maximumSweetSpotSpeedMps,
    maximumSpeedMps:effectiveMaximumSpeedV121??adjustedProbe.maximumSweetSpotSpeedMps*rate,maximumClockAccelerationPerSecond:b.swingPolicyV121!.maximumClockAccelerationPerSecond,
    sourceContactPhaseSeconds:(sourceContactTick-selectedFrames[0].tick)/1e6,effort:swingIntentV121.effort}):null;
  if(swingMotorV121?.executable)rate=swingMotorV121.rate;
  else if(swingMotorV121)swingOffered=false;
  if(!swingOffered)envelopeV133=undefined;
  const rampSeconds=swingMotorV121?.executable?swingMotorV121.rampSeconds:0;
  if(executionV122&&input.batting!=='bunt'&&!envelopeV133){
    const trialInput:ReferenceBatKinematicsInputV1={...probeInput,frames:selectedFrames,playbackRate:rate,
      ...(rampSeconds>0?{motorRampSecondsV121:rampSeconds}:{}),transform:{rotation:authoredRotation,translation:zero(),scale:1}},
      adjustedTrial=impactTrajectory===undefined?trialInput:withReferenceImpactTrajectoryV1(trialInput,sourceContactTick,impactTrajectory),
      feasible=(value:number)=>{const trial=createReferenceBatKinematicsV1({...adjustedTrial,playbackRate:value});
        return referenceRateScaleV122(trial,executionV122)>=1&&(effectiveMaximumSpeedV121===undefined||trial.maximumSweetSpotSpeedMps<=effectiveMaximumSpeedV121);};
    if(!feasible(rate)){
      let lo=.01,hi=rate;
      assert(feasible(lo),'設定した加速度ではこの測定軌道を実行できません。加速度の上限を上げるか、別のスイング軌道を選択してください。');
      for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(feasible(mid))lo=mid;else hi=mid;}
      rate=lo;
    }
  }
  const radiusProfile:BatRadiusProfile={knots:[{t:0,radiusM:.019},{t:.06,radiusM:.014},
    {t:.42,radiusM:.014},{t:.7,radiusM:.03},{t:.94,radiusM:.033},{t:1,radiusM:.031}]},
    batPhysical:RigidBatPhysicalProperties={massKg:b.batMassKg,centerOfMassT:.65,transverseMomentOfInertiaKgM2:b.batMassKg*b.batLengthM*b.batLengthM*.075,
      axialMomentOfInertiaKgM2:b.batMassKg*.025*.025/2,radiusProfile},
    ballPhysical={massKg:profile.air.aerodynamics.ballMassKg,radiusM:profile.air.aerodynamics.ballRadiusM,rotationalInertiaFactor:profile.ground.inertiaRatio};
  const directionPredictionV153=directionMotorActiveV153?createDirectionMotorPredictionV153({rawPrediction:effectiveForecastV246!.prediction,
    perceivedPosition:motorAimPosition,perceivedArrivalSeconds:prediction.elapsedSeconds,originTick:input.originTick,ticksPerSecond:tps,availableTick:observationTick}):null,
    nominalRegistrationsV153=new Map<number,ReturnType<typeof planObservedDirectionRegistrationV153>|ReturnType<typeof planObservedReactiveRegistrationV161>|ReturnType<typeof planObservedReactiveDirectionLotteryV251>|ReturnType<typeof planNeutralReactiveDirectionV272>>(),
    nominalInputsV154=new Map<number,ObservedDirectionRegistrationInputV153|ObservedReactiveRegistrationInputV161>();
  let reactiveDrawV251:number|undefined,neutralDrawV272:number|undefined;
  const neutralDiagnosticV272=()=>({policy:neutralPolicyV272!,streamKey:'neutral-reactive-group-v271' as const,
    drawStatus:neutralDrawV272===undefined?'NOT_DRAWN' as const:'DRAWN' as const,drawUint32:neutralDrawV272??null});
  // This boundary has no execution errors, actual Source, late observation or
  // contact result. Even frame selection and nominal sweet spot precede errors.
  const nominalRegistrationAtRateV153=(candidateRate:number)=>{
    if(!directionMotorActiveV153||!swingOffered||!directionPredictionV153)return null;
    const cached=nominalRegistrationsV153.get(candidateRate);if(cached)return cached;
    const availableSwingSeconds=Math.max(0,planningContactTime-decisionTime-(b.motorLatencySeconds??0)-(envelopeV133?.preparation.durationSeconds??0)),
      earliestSourceTick=sourceContactTick-referencePhaseSecondsV121(availableSwingSeconds,rampSeconds)*candidateRate*1e6,
      // Use only existing measured keys that fit the remaining motor window.
      // Do not delay contact and then chase an extrapolated ball behind home.
      candidateBoundary=Math.min(earliestSourceTick,localImpactWindow?sourceContactTick-impactTrajectory!.beforeSeconds*1e6:Infinity);
    let candidateFrames=selectedFrames.filter(frame=>frame.tick>=candidateBoundary);
    if(localImpactWindow&&candidateFrames[0]?.tick>sourceContactTick-impactTrajectory!.beforeSeconds*1e6){
      const previous=selectedFrames.filter(frame=>frame.tick<candidateBoundary).at(-1);
      if(previous)candidateFrames=[previous,...candidateFrames];
    }
    if(candidateFrames.length<2||candidateFrames[0].tick>=sourceContactTick)return null;
    const startOffset=planningContactTime-referenceElapsedSecondsV121((sourceContactTick-candidateFrames[0].tick)/1e6/candidateRate,rampSeconds),
      plannedStart=input.originTick+Math.max(0,Math.round(startOffset*tps)),
      startTick=envelopeV133?Math.max(plannedStart,observationTick+Math.ceil((b.motorLatencySeconds??0)*tps)+Math.ceil(envelopeV133.preparation.durationSeconds*tps))
        :resolveMotorStart(plannedStart,observationTick,input.originTick,Math.ceil((b.motorLatencySeconds??0)*tps)),
      zeroReference:ReferenceBatKinematicsInputV1={...probeInput,frames:candidateFrames,sweetSpotT:planningSweetSpotT,startTick,playbackRate:candidateRate,
        ...(swingMotorV121?.executable?{motorRampSecondsV121:rampSeconds}:{}),
        transform:{rotation:authoredRotation,translation:zero(),scale:1}},
      point=createReferenceBatKinematicsV1(zeroReference).sampleAtSourceTick(sourceContactTick).sweetSpot,
      translated={...zeroReference,transform:{...zeroReference.transform,translation:sub(motorAimPosition,point)}},
      nominalReference=impactTrajectory===undefined?translated:withReferenceImpactTrajectoryV1(translated,sourceContactTick,impactTrajectory);
    if(referenceWorldTickAtSourceV121(nominalReference,sourceContactTick)>input.originTick+observationPolicyV151!.maximumForecastAfterReleaseSeconds*tps)return null;
    const nominalBaseV161={reference:nominalReference,contactSourceTick:sourceContactTick,prediction:directionPredictionV153,batPhysical,ballPhysical,
        limits:{...(effectiveMaximumSpeedV121===undefined?{}:{maximumSweetSpotSpeedMps:effectiveMaximumSpeedV121}),
          ...(executionV122?{maximumGripAccelerationMps2:executionV122.maximumGripAccelerationMps2,
            maximumAngularAccelerationRadPerSecond2:executionV122.maximumAngularAccelerationRadPerSecond2,
            maximumSweetSpotAccelerationMps2:executionV122.maximumSweetSpotAccelerationMps2}:{})}},
      nominalInputV154:ObservedDirectionRegistrationInputV153|ObservedReactiveRegistrationInputV161=reactiveMotorV161?nominalBaseV161:
        {...nominalBaseV161,desiredFieldAngleDegrees:-intendedPullAngleDegrees!*(b.bats==='R'?1:-1)},
      registration='desiredFieldAngleDegrees' in nominalInputV154?planObservedDirectionRegistrationV153(nominalInputV154):neutralPolicyV272
        ?planNeutralReactiveDirectionV272({registration:nominalInputV154,bats:b.bats,drawUint32:neutralDrawV272??=(randomStreamsV152!.rng('batterDirection','neutral-reactive-group-v271').uniform()*2**32)})
        :reactivePolicyV251
        ?planObservedReactiveDirectionLotteryV251({registration:nominalInputV154,bats:b.bats,policy:reactivePolicyV251,draw:reactiveDrawV251??=(randomStreamsV152!.rng('batterDirection','reactive-group-v251').uniform())})
        :planObservedReactiveRegistrationV161(nominalInputV154);
    nominalInputsV154.set(candidateRate,nominalInputV154);
    nominalRegistrationsV153.set(candidateRate,registration);return registration;
  };
  const resolveContactFrameAtRateV244=(rate:number,nominalReferenceV153:ReferenceBatKinematicsInputV1|null|undefined,forcedReasonV1?:string)=>{
    if(!contactFrameRequestV244)return null;
    const request=contactFrameRequestV244,base={version:'live_observed_spin_contact_frame_result_v244' as const,subjectId:request.subjectId,technique:request.technique,clip:request.clip,domain:request.domain,policy:request.policy,thresholds:request.thresholds,cutoffTick:observationTick,identityAuthority:'CALLER_DECLARED_NOT_AUTHENTICATED' as const,earnedQualification:false as const,humanCalibration:'NOT_MEASURED' as const};
    const none=(reason:string)=>({...base,status:'NO_TARGET' as const,reason,selectedDelta:null,selectedOrdinal:null,candidates:[],predictionScope:'DELIVERED_FORECAST_ONLY' as const,incidentSpin:'ZERO_OPERATIONAL_ASSUMPTION' as const});
    if(forcedReasonV1)return none(forcedReasonV1);
    if(contactFramePreReasonV244)return none(contactFramePreReasonV244);
    const nominalInput=nominalInputsV154.get(rate);if(!nominalReferenceV153||!nominalInput)return none('NOMINAL_REGISTRATION_UNAVAILABLE');
    const {desiredFieldAngleDegrees:_angle,...reactive}=nominalInput as ObservedDirectionRegistrationInputV153;
    const plan=planObservedContactFrameRegistrationV243({registration:{...reactive,reference:nominalReferenceV153},cutoffTick:observationTick,bats:b.bats,technique:request.technique,thresholds:request.thresholds});
    const compact=plan.candidates.map(candidate=>({ordinal:candidate.ordinal,delta:candidate.delta,norm:candidate.norm,component:candidate.component,improvement:candidate.improvement,status:candidate.prediction.status,reason:candidate.prediction.status==='FOUND'?null:candidate.prediction.reason,exclusionReason:candidate.exclusionReason}));
    const selected=plan.status==='PLANNED'?plan.candidates.find(candidate=>candidate.ordinal===plan.selectedOrdinal):undefined;
    if(plan.status==='PLANNED')assert(selected?.prediction.status==='FOUND','contact frame v244: selected prediction missing');
    return {...base,status:plan.status,reason:plan.reason,selectedDelta:plan.status==='PLANNED'?plan.delta:null,selectedOrdinal:plan.status==='PLANNED'?plan.selectedOrdinal:null,...(selected?{selectedPrediction:selected.prediction}:{}),candidates:compact,predictionScope:'DELIVERED_FORECAST_ONLY' as const,incidentSpin:'ZERO_OPERATIONAL_ASSUMPTION' as const,...('diagnostics' in plan?{selection:plan.diagnostics}:{}),...('normalComponent' in plan?{normalComponent:plan.normalComponent}:{})};
  };
  let frozenContactFrameV244:ReturnType<typeof resolveContactFrameAtRateV244>|undefined,contactFramePlanningRateV244:number|null=null;
  let robustPlanV248:ReturnType<typeof planLiveRobustContactFrameV247>|undefined;
  let robustRecipeV248:Parameters<typeof buildLiveBatReferenceExecutionV247>[0]|undefined;
  let yawRobustFixedRecipeV276:Parameters<typeof buildLiveBatReferenceExecutionV247>[0]|undefined;
  let robustSigmaV248:Readonly<{timingSeconds:number;aim:Vec3}>|undefined;
  let robustPreReasonV248:string|null=null;
  // A catcher's forecast must include a possible pitch bounce. This is a
  // separate prediction from the observed state; it never replaces the
  // released Source used by collision, spin, clock or rendering.
  const catcherForecast=createSourceFreeBallKernel({...descriptor,initial:observedSample.moment,
    ...(observedSample.materialOrientation?{materialOrientationAtStart:observedSample.materialOrientation}:{})}),
    catcherForecastTime=crossing(catcherForecast,-.85);
  if(catcherForecastTime===null&&!opticalExperiment) throw Error('catcher forecast did not reach its finite plane');
  const catcherPrediction={elapsedSeconds:catcherForecastTime??catcherObservationTime,ball:catcherForecast.evaluateAt(catcherForecastTime??catcherObservationTime).moment.ball},
    catcherRecognition=catcherForecastTime===null?({position:{x:0,y:middle,z:-.85},diagnostics:{reason:'no_capture_plane_forecast_waiting',predictionBasis:'OBSERVED_STATE_NO_FUTURE'}} as unknown as ReturnType<typeof recognizeZoneV87>):recognizeZoneV87({role:'catcher',profile:catcher.zoneRecognitionV87,position:catcherPrediction.ball.position,zone,
      seed:randomStreamsV152?.seedFor('catcherPerception','capture-recognition-v87')??input.seed,
      sourceTick:input.originTick+Math.round(catcherObservationTime*tps),observationTick:input.originTick+Math.round(catcherObservationTime*tps),
      planeZ:-.85,standardDeviationMeters:Math.min(.6,(catcher.defensiveDecisionSeconds??0)*.1),abilityBasis:'defensiveDecisionSeconds_authored_forecast_uncertainty',reason:'own_current_observed_forecast_at_capture_plane'}),
    catcherStart=(()=>{const q={x:0,y:middle,z:-.85},m=(catcher as any).normalBodyModelV1??(catcher as any).robinBodyModelV1,b=(catcher as any).normalBodyPositionV1??(catcher as any).robinBodyPositionV1;if(!m||!b)return q;const sh={x:b.x,y:b.y+m.shoulderHeightMeters-m.hipHeightMeters,z:b.z},v=sub(q,sh),n=norm(v),k=Math.min(1,(m.armReachMeters-1e-6)/(n||1));return add(sh,mul(v,k));})(),body=(catcher as any).normalBodyPositionV1??(catcher as any).robinBodyPositionV1??{x:0,y:.8,z:-1.2},reach=catcher.gloveReachMeters,
    catcherTarget=catcherForecastTime===null?{...catcherStart}:{...catcherRecognition.position,z:-.85};
  catcherTarget.y=Math.max(catcher.gloveRadiusMeters,catcherTarget.y);
  const planarReach=Math.sqrt(reach*reach-(catcherTarget.z-body.z)**2),fromBody={x:catcherTarget.x-body.x,y:catcherTarget.y-body.y,z:0};
  if(catcherForecastTime!==null&&norm(fromBody)>planarReach){const constrained=add(body,mul(fromBody,planarReach/norm(fromBody)));catcherTarget.x=constrained.x;catcherTarget.y=constrained.y;}
  if(opticalExperiment){const m=(catcher as any).robinBodyModelV1,sh={x:body.x,y:body.y+m.shoulderHeightMeters-m.hipHeightMeters,z:body.z},d=sub(catcherTarget,sh),n=norm(d),k=Math.min(1,(m.armReachMeters-1e-6)/(n||1)),q=add(sh,mul(d,k));catcherTarget.x=q.x;catcherTarget.y=q.y;catcherTarget.z=q.z;}
  if((catcher as any).normalBodyModelV1){const m=(catcher as any).normalBodyModelV1,sh={x:body.x,y:body.y+m.shoulderHeightMeters-m.hipHeightMeters,z:body.z},v=sub(catcherTarget,sh),n=norm(v),k=Math.min(1,(m.armReachMeters-1e-6)/(n||1)),q=add(sh,mul(v,k));catcherTarget.x=q.x;catcherTarget.y=q.y;catcherTarget.z=q.z;}
  const moveStart=catcherObservationTime,moveEnd=Math.max(moveStart+.025,catcherPrediction.elapsedSeconds-.025),moveDuration=moveEnd-moveStart,
    delta=sub(catcherTarget,catcherStart),distance=norm(delta),maximumGloveSpeedMps=catcher.gloveSpeedMps;
  if(distance>maximumGloveSpeedMps*moveDuration/1.5){const limited=add(catcherStart,mul(delta,maximumGloveSpeedMps*moveDuration/1.5/distance));catcherTarget.x=limited.x;catcherTarget.y=limited.y;}
  const finalDelta=sub(catcherTarget,catcherStart),gloveAt=(seconds:number)=>{
    const u=clamp((seconds-moveStart)/moveDuration,0,1),smooth=u*u*(3-2*u),ds=seconds>moveStart&&seconds<moveEnd?6*u*(1-u)/moveDuration:0;
    return {position:add(catcherStart,mul(finalDelta,smooth)),velocity:mul(finalDelta,ds)};
  };
  const buildReferenceAtRate=(rate:number)=>{
  const nominalRegistrationV153=nominalRegistrationAtRateV153(rate),nominalReferenceV153=nominalRegistrationV153?.reference;
  if(frozenContactFrameV244===undefined){try{frozenContactFrameV244=resolveContactFrameAtRateV244(rate,nominalReferenceV153);}catch(error){if(!techniqueRequestedV1)throw error;frozenContactFrameV244=resolveContactFrameAtRateV244(rate,null,'PLANNER_FAILED');}if(contactFrameRequestV244)contactFramePlanningRateV244=rate;}
  const contactFrameV244=frozenContactFrameV244;
  const startOffset=desiredContactTime-referenceElapsedSecondsV121((sourceContactTick-selectedFrames[0].tick)/1e6/rate,rampSeconds),
    plannedStartTick=input.originTick+Math.max(0,Math.round(startOffset*tps));
  let actualStartTick=envelopeV133?Math.max(plannedStartTick,observationTick+Math.ceil((b.motorLatencySeconds??0)*tps)+Math.ceil(envelopeV133.preparation.durationSeconds*tps))
      :swingMotorV121||executionV122||intentV122||spinMotionV123||battingDirectionV149||positionObserverV151?resolveMotorStart(plannedStartTick,observationTick,input.originTick,Math.ceil((b.motorLatencySeconds??0)*tps))
      :b.motorLatencySeconds===undefined?plannedStartTick:Math.max(plannedStartTick,input.originTick+Math.ceil((decisionTime+b.motorLatencySeconds)*tps)),
    motorDelaySeconds=(actualStartTick-plannedStartTick)/tps,
    referenceInput:ReferenceBatKinematicsInputV1={provenance:{clipId:clip.id,sourceSha256:clip.source.sha256},frames:selectedFrames,
      batLengthM:b.batLengthM,sweetSpotT,sourceTicksPerSecond:1e6,startTick:actualStartTick,ticksPerSecond:tps,playbackRate:rate,
      ...(swingMotorV121?.executable?{motorRampSecondsV121:rampSeconds}:{}),
      ...(executionV122||directionMotorActiveV153?{executionInterpolationV122:'cubic-c1' as const}:{}),
      ...(envelopeV133?{executionEnvelopeV133:envelopeV133}:{}),
      transform:{rotation:nominalReferenceV153?.transform.rotation??authoredRotation,translation:zero(),scale:1}};
  let referenceContactTick=referenceWorldTickAtSourceV121(referenceInput,sourceContactTick);
  const referenceZero=createReferenceBatKinematicsV1(referenceInput),point=referenceZero.sampleContinuous(referenceContactTick).sweetSpot;
  const nominalSweetSpotV153=nominalReferenceV153?createReferenceBatKinematicsV1(nominalReferenceV153).sampleAtSourceTick(sourceContactTick).sweetSpot:null,
    deltaV244=robustPlanV248?.status==='PLANNED'?robustPlanV248.selected.delta:contactFrameV244?.status==='PLANNED'?contactFrameV244.selectedDelta:null,
    nominalCenterV244=nominalSweetSpotV153&&deltaV244&&(deltaV244.x!==0||deltaV244.y!==0||deltaV244.z!==0)?{x:deltaV244.x===0?nominalSweetSpotV153.x:nominalSweetSpotV153.x+deltaV244.x,y:deltaV244.y===0?nominalSweetSpotV153.y:nominalSweetSpotV153.y+deltaV244.y,z:deltaV244.z===0?nominalSweetSpotV153.z:nominalSweetSpotV153.z+deltaV244.z}:nominalSweetSpotV153,
    composedV238=observedSpinComposeV238?.status==='APPLIED'?composeLiveObservedSpinAimV238(nominalSweetSpotV153??motorAimPosition,observedSpinComposeV238):null,
    intendedCenterV123=composedV238&&!composedV238.normalPathRetained?(nominalSweetSpotV153?add(composedV238.center,aimError):spinMotionV123?add(add(composedV238.center,aimError),{x:-(b.bats==='R'?1:-1)*spinMotionV123.contactOffsetMeters.pull,
    y:spinMotionV123.contactOffsetMeters.up,z:spinMotionV123.contactOffsetMeters.depth}):add(composedV238.center,aimError)):observedSpinTrialV236?.status==='APPLIED'?add(observedSpinTrialV236.aimedContact,aimError):nominalSweetSpotV153?add(nominalCenterV244!,aimError):spinMotionV123?add(add(motorAimPosition,aimError),{x:-(b.bats==='R'?1:-1)*spinMotionV123.contactOffsetMeters.pull,
    y:spinMotionV123.contactOffsetMeters.up,z:spinMotionV123.contactOffsetMeters.depth}):add(motorAimPosition,aimError);
  const translatedReference={...referenceInput,transform:{...referenceInput.transform,translation:sub(intendedCenterV123,point)}};
  let impactReference=impactTrajectory===undefined?translatedReference:withReferenceImpactTrajectoryV1(translatedReference,sourceContactTick,impactTrajectory);
  const robustExecutionV248=yawRobustFixedRecipeV276?buildLiveBatReferenceExecutionV247(yawRobustFixedRecipeV276,{timingSeconds:timingError,aim:aimError,actualSweetSpotT:sweetSpotT},{x:0,y:0,z:0}):robustPlanV248?.status==='PLANNED'&&robustRecipeV248?buildLiveBatReferenceExecutionV247(robustRecipeV248,{timingSeconds:timingError,aim:aimError,actualSweetSpotT:sweetSpotT},robustPlanV248.selected.delta):null;
  if(robustExecutionV248)impactReference=robustExecutionV248.reference;
  const saturationV153=robustExecutionV248?{reference:robustExecutionV248.reference,temporalScale:robustExecutionV248.temporalScale,holdStartTick:robustExecutionV248.motion.motionStartTickV133??robustExecutionV248.reference.startTick}:(nominalReferenceV153||partialFallbackV1)?limitDirectionExecutionV153(impactReference,{
    ...(effectiveMaximumSpeedV121===undefined?{}:{maximumSweetSpotSpeedMps:effectiveMaximumSpeedV121}),
    ...(executionV122?{maximumGripAccelerationMps2:executionV122.maximumGripAccelerationMps2,
      maximumAngularAccelerationRadPerSecond2:executionV122.maximumAngularAccelerationRadPerSecond2,
      maximumSweetSpotAccelerationMps2:executionV122.maximumSweetSpotAccelerationMps2}:{})}):null;
  if(saturationV153&&saturationV153.temporalScale<1){
    impactReference=saturationV153.reference;
    referenceInput={...referenceInput,startTick:impactReference.startTick,playbackRate:impactReference.playbackRate,
      ...(impactReference.motorRampSecondsV121===undefined?{}:{motorRampSecondsV121:impactReference.motorRampSecondsV121}),
      executionEnvelopeV133:impactReference.executionEnvelopeV133!};
    actualStartTick=referenceInput.startTick;motorDelaySeconds=(actualStartTick-plannedStartTick)/tps;
    referenceContactTick=referenceWorldTickAtSourceV121(referenceInput,sourceContactTick);
  }
  const uncorrectedReference=createReferenceBatKinematicsV1(impactReference),headroom=lateHeadroomV1();
  let lateEvidenceV121=headroom===0||opticalExperiment||!swingOffered||input.batting==='bunt'||observedSpinTrialV236?.status==='APPLIED'?null:(()=>{
    const throughTick=Math.floor(referenceContactTick),throughTime=(throughTick-input.originTick)/tps,
      observedTime=decisionTime+Math.max(0,(positionObserverV151?Math.min(prediction.elapsedSeconds,throughTime):Math.min(horizon,prediction.elapsedSeconds,throughTime))-decisionTime)*headroom/2,
      availableTick=positionObserverV151?quantizeEventTick(input.originTick,observedTime,tps):input.originTick+Math.ceil(observedTime*tps),
      correctionFromTick=Math.max(availableTick,actualStartTick),duration=(throughTick-correctionFromTick)/tps,
      prefixThroughV151=Math.min((availableTick-input.originTick)/tps,horizon),
      // The baseline and corrected bat have the same prefix before this cutoff.
      // If contact already closed that prefix, no later free-flight sample is observed.
      prefixContactV151=positionObserverV151?(opticalExperiment?normalPitchContact:firstContact)(kernel,seconds=>measureRigidBatBallSurfaceSeparation(
        kernel.evaluateAt(seconds,'incoming').moment.ball,createRigidBatStateFromBatterSwingState(
          uncorrectedReference.sampleContinuous(input.originTick+seconds*tps).state,batPhysical),ballPhysical),
        uncorrectedReference.maximumGripSpeedMps+uncorrectedReference.maximumAngularSpeedRadPerSecond*b.batLengthM,prefixThroughV151):null,
      lateRawForecastV151=positionObserverV151&&!prefixContactV151&&(availableTick-input.originTick)/tps<=horizon?positionObserverV151.forecastAt(availableTick):null,
      lateForecastResultV246=lateRawForecastV151&&input.batterForecastPolicyV246!==undefined?positionObserverV151!.forecastAtV246!(availableTick):null,
      lateEffectiveForecast=bendForecastV1(lateForecastResultV246?.forecast??lateRawForecastV151),
      latePrediction=positionObserverV151?{ball:{position:lateEffectiveForecast?.prediction?.position??placementPositionV1}}
        :predictFromObservation(kernel.evaluateAt(observedTime),observedTime,battingSetupV94.contactPlaneZ),
      earlyEvidence={predictionId:'release-observation-v121',observedTick:observationTick,availableTick:observationTick,position:placementPositionV1},
      lateObservedTick=positionObserverV151?(lateEffectiveForecast?.status==='PREDICTED'?lateEffectiveForecast.observedThroughTick!:observationTick)
        :input.originTick+Math.round(observedTime*tps),
      evidence=selectPredictionAt(lateObservedTick>observationTick?[earlyEvidence,{predictionId:'late-observation-v121',observedTick:lateObservedTick,availableTick,position:latePrediction.ball.position}]:[earlyEvidence],correctionFromTick)!,
      requestedOffset=sub(evidence.position,placementPositionV1),distance=norm(requestedOffset),
      budget=effectiveMaximumSpeedV121===undefined?0:Math.max(0,Math.min(uncorrectedReference.maximumGripSpeedMps,effectiveMaximumSpeedV121-uncorrectedReference.maximumSweetSpotSpeedMps))*(swingIntentV121?.controlPriority??1),
      accelerationBudget=executionV122?Math.max(0,Math.min(executionV122.maximumGripAccelerationMps2-referenceAccelerationBoundsV122(uncorrectedReference).maximumGripAccelerationMps2,
        executionV122.maximumSweetSpotAccelerationMps2-referenceAccelerationBoundsV122(uncorrectedReference).maximumSweetSpotAccelerationMps2)):Infinity,
      scale=duration>0&&distance>1e-9?Math.min(headroom,budget*duration/(1.5*distance),executionV122?executionV122.maximumCorrectionMeters/distance:Infinity,accelerationBudget*duration*duration/(6*distance)):0,
      offset=mul(requestedOffset,scale),applied=scale>0&&norm(offset)<=3;
    return {headroom,observedTick:lateObservedTick,availableTick,correctionFromTick,throughTick:Math.max(correctionFromTick,throughTick),selectedPredictionId:evidence.predictionId,
      contactPlaneZ:battingSetupV94.contactPlaneZ,requestedOffset,offset:applied?offset:zero(),applied,maximumCorrectionSpeedMps:budget,
      futureSourceUsed:false as const,decisionOrContactDepthForced:false as const,
      ...(positionObserverV151?{rawForecast:lateRawForecastV151,...(lateForecastResultV246?{effectiveForecastV246:lateForecastResultV246,effectiveSnapshotV246:positionObserverV151.snapshotAtV246!(availableTick)!}:{}),prefixClosedBeforeObservation:prefixContactV151!==null,
        prefixSearchedThroughElapsedSeconds:prefixThroughV151}:{}),
      deliveryModel:positionObserverV151?(input.batterForecastPolicyV246===undefined?'POSITION_ONLY_DELIVERED_OBSERVATIONS_V151' as const:'POSITION_ONLY_DELIVERED_OBSERVATIONS_V246_EXPERIMENT' as const):'LEGACY_INSTANT_SAMPLE_NO_INVENTED_MILLISECOND_GAIN' as const};
  })();
  let registeredReference:ReferenceBatKinematicsInputV1=lateEvidenceV121?.applied?{...impactReference,aimCorrectionV121:{availableTick:lateEvidenceV121.correctionFromTick,
    throughTick:lateEvidenceV121.throughTick,offset:lateEvidenceV121.offset}}:impactReference;
  let reference=createReferenceBatKinematicsV1(registeredReference),aimScaleV133=1;
  const certified=(motion:typeof reference)=>(effectiveMaximumSpeedV121===undefined||motion.maximumSweetSpotSpeedMps<=effectiveMaximumSpeedV121)
    &&(executionV122===undefined||referenceRateScaleV122(motion,executionV122)>=1);
  if(envelopeV133&&lateEvidenceV121?.applied&&!certified(reference)){
    const evidence=lateEvidenceV121,requestedOffset=evidence.offset;
    reference=uncorrectedReference;registeredReference=impactReference;aimScaleV133=0;
    if(certified(uncorrectedReference))for(let n=1;n<=8;n++){
      const factor=2**-n,trialInput={...impactReference,aimCorrectionV121:{availableTick:evidence.correctionFromTick,throughTick:evidence.throughTick,offset:mul(requestedOffset,factor)}};
      const trial=createReferenceBatKinematicsV1(trialInput);
      if(certified(trial)){reference=trial;registeredReference=trialInput;aimScaleV133=factor;break;}
    }
    lateEvidenceV121={...evidence,offset:aimScaleV133===0?zero():mul(requestedOffset,aimScaleV133),applied:aimScaleV133>0};
  }
  return {plannedStartTick,actualStartTick,motorDelaySeconds,referenceInput,referenceContactTick,lateEvidenceV121,registeredReference,reference,aimScaleV133,composedV238,contactFrameV244,
    executionSaturationV153:saturationV153?{temporalScale:saturationV153.temporalScale,holdStartTick:saturationV153.holdStartTick,
      executedStartTick:actualStartTick,nominalPlaybackRate:rate,executedPlaybackRate:referenceInput.playbackRate,
      spatialErrorRetained:true as const,ballRetargeted:false as const}:null};
  };
  let partialFallbackV1=false;
  let envelopeRateV133:ReturnType<typeof selectLiveSwingEnvelopeRateV133>=null;
  if(envelopeV133){
    envelopeRateV133=selectLiveSwingEnvelopeRateV133(rate,candidate=>{
      try {const nominal=directionMotorActiveV153?nominalRegistrationAtRateV153(candidate):null;
        if(directionMotorActiveV153&&!nominal?.reference)return false;
        const trial=nominal?.reference?createReferenceBatKinematicsV1(nominal.reference):buildReferenceAtRate(candidate).reference;
        return (executionV122===undefined||referenceRateScaleV122(trial,executionV122)>=1)
        &&(effectiveMaximumSpeedV121===undefined||trial.maximumSweetSpotSpeedMps<=effectiveMaximumSpeedV121);}
      catch(error){if(error instanceof Error&&(/reference C1 execution:|reference bat envelope:/.test(error.message)))return false;throw error;}
    });
    if(!envelopeRateV133&&(input as any).partialReferenceFallbackV1==='partial_reference_fallback_v1'&&directionMotorActiveV153&&(!contactFrameRequestV244||techniqueRequestedV1)&&!robustRequestV248&&effectiveMaximumSpeedV121!==undefined){
      const source=nominalInputsV154.get(rate),old=nominalRegistrationsV153.get(rate);
      if(source&&old&&source.reference&&source.reference.executionEnvelopeV133){
        const limits={maximumSweetSpotSpeedMps:effectiveMaximumSpeedV121,...(executionV122?{maximumGripAccelerationMps2:executionV122.maximumGripAccelerationMps2,maximumAngularAccelerationRadPerSecond2:executionV122.maximumAngularAccelerationRadPerSecond2,maximumSweetSpotAccelerationMps2:executionV122.maximumSweetSpotAccelerationMps2}:{})};
        const bounded=limitDirectionExecutionV153(source.reference,limits);
        if(bounded.holdStartTick<observationTick+Math.ceil((b.motorLatencySeconds??0)*tps))throw Error('HOLD: partial motion starts before permitted motor time');
        nominalRegistrationsV153.set(rate,{...old,reference:source.reference} as any);
        envelopeRateV133={rate,requestedRate:rate,candidates:[],method:'partial_reference_fallback_v1',globalMaximumGuaranteed:false} as any;partialFallbackV1=true;
      }else if(!source){envelopeRateV133={rate,requestedRate:rate,candidates:[],method:'partial_reference_fallback_v1',globalMaximumGuaranteed:false} as any;partialFallbackV1=true;}
    }
    if(partialFallbackV1&&techniqueRequestedV1){contactFrameRequestV244=undefined;anyFrameRequest=undefined;frozenContactFrameV244=undefined;techniqueSkipV1='PARTIAL_REFERENCE_FALLBACK';}
    if(!envelopeRateV133){
      const error=new Error('live pitch: 有限候補で実行可能な準備・回復を確認できません。準備・回復の時間を延ばすか、姿勢の移動量を小さくしてください。全速度での不可能判定ではありません。');
      if(directionMotorActiveV153||neutralPolicyV272!==undefined){
        // These are owned nominal inputs/results already computed above. This
        // failure sidecar has no actual World kernel, spin or contact outcome.
        const immutable=<T>(value:T):T=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){
          Object.values(value).forEach(immutable);Object.freeze(value);}return value;};
        Object.defineProperty(error,'directionMotorDiagnosticsV154',{value:immutable({version:'live_direction_motor_failure_v154' as const,
          decisionTick:observationTick,clipId:clip.id,sourceSha256:clip.source.sha256,planningContactTimeSeconds:planningContactTime,
          ...(neutralPolicyV272===undefined?{}:{neutralReactiveV272:neutralDiagnosticV272()}),
          limits:{maximumSweetSpotSpeedMps:effectiveMaximumSpeedV121??null,...(executionV122?{
            maximumGripAccelerationMps2:executionV122.maximumGripAccelerationMps2,
            maximumAngularAccelerationRadPerSecond2:executionV122.maximumAngularAccelerationRadPerSecond2,
            maximumSweetSpotAccelerationMps2:executionV122.maximumSweetSpotAccelerationMps2}:{})},
          rates:[...nominalRegistrationsV153].map(([candidateRate,registration])=>({rate:candidateRate,
            input:nominalInputsV154.get(candidateRate)!,diagnostics:registration.diagnostics}))})});
      }
      throw error;
    }
    rate=envelopeRateV133.rate;
  }
  let finalNominalReferenceV153=nominalRegistrationAtRateV153(rate)?.reference;
  let yawDiagnosticV274:Readonly<{version:'live_yaw_paired_diagnostic_v274'|'live_yaw_paired_diagnostic_v275'|'live_yaw_paired_diagnostic_v276';planningRate:number;selectedYawDegrees:number;selectedIndex:number;cutoffTick:number;selectedReference:ReferenceBatKinematicsInputV1;baselineV161Diagnostics:unknown;baselineV244Decision:unknown;translationMode:'YAW_ONLY_NO_TRANSLATION'|'YAW_WITH_NOMINAL_CENTER_COMPENSATION'|'YAW_ROBUST_NINE_SCENARIOS';robustEvidence?:unknown}>|undefined;
  if(input.yawDiagnosticV274!==undefined){
    assert(input.yawDiagnosticV274&&Object.keys(input.yawDiagnosticV274).join('|')==='version'&&(input.yawDiagnosticV274.version==='live_yaw_paired_diagnostic_v274'||input.yawDiagnosticV274.version==='live_yaw_paired_diagnostic_v275'||input.yawDiagnosticV274.version==='live_yaw_paired_diagnostic_v276'),'invalid yaw diagnostic policy');
    if(!(reactiveMotorV161&&contactFrameRequestV244&&spinPracticePolicyV239&&!neutralPolicyV272&&!reactivePolicyV251))throw Object.assign(new Error('yaw diagnostic: REACTIVE_V239_V244_REQUIRED'),{yawDiagnosticStatus:'HOLD'});
    const source=nominalInputsV154.get(rate),normal=nominalRegistrationsV153.get(rate);
    if(!source||!normal?.reference||'desiredFieldAngleDegrees' in source)throw Object.assign(new Error('yaw diagnostic: NOMINAL_BASELINE_UNAVAILABLE'),{yawDiagnosticStatus:'UNRESOLVED'});
    // Record the original V244 forecast independently; its translation is never applied to a different yaw.
    const baselineV244Decision=resolveContactFrameAtRateV244(rate,normal.reference);
    frozenContactFrameV244=null;contactFramePlanningRateV244=null;
    const decisionInput={version:'observed_yaw_contact_frame_trial_v255' as const,registration:source,baselineReference:normal.reference,cutoffTick:observationTick,bats:b.bats,technique:contactFrameRequestV244.technique,thresholds:contactFrameRequestV244.thresholds,directionMode:'REACTIVE' as const};
    const proof=hashYawDecisionInputV274(decisionInput);
    pendingYawEvidenceV274.set(raw,{planningRate:rate,summary:{status:'UNKNOWN',reason:'PLANNER_NOT_COMPLETED',candidates:[]},inputHash:proof});
    const isRobustV276=input.yawDiagnosticV274.version==='live_yaw_paired_diagnostic_v276';
    const robustContextV276={originTick:input.originTick,decisionTick:observationTick,decisionTimeSeconds:decisionTime,nominalArrivalSeconds:prediction.elapsedSeconds,technicalTimingOffsetSeconds:b.technicalTimingOffsetSeconds??0,latencySeconds:b.motorLatencySeconds,startMode:envelopeV133?'ENVELOPE' as const:'MOTOR' as const,contactSourceTick:sourceContactTick,rampSeconds,limits:source.limits??{},...(impactTrajectory===undefined?{}:{impactTrajectory})};
    const timingSigmaV276=b.timingStdSeconds*(swingIntentV121?1:input.batting==='contact'?.72:input.batting==='power'?1.15:1)*zoneHitErrorScale*courseErrorScale,aimSigmaV276=aimScale*zoneHitErrorScale*courseErrorScale,recognitionV276=batterRecognition.diagnostics.uncertaintyScale;
    const robustInputV276=isRobustV276?{decision:decisionInput,context:robustContextV276,sigma:{timingSeconds:timingSigmaV276,aim:{x:aimSigmaV276*recognitionV276,y:aimSigmaV276*recognitionV276,z:aimScale*.3*zoneHitErrorScale*courseErrorScale}},latePossible:lateHeadroomV1()>0,maximumEvaluations:250,maximumSearchSamples:250*YAW_ROBUST_SEARCH_EVALUATIONS}:undefined;
    const plannerInputHashV276=robustInputV276?hashYawDecisionInputV274(robustInputV276):undefined;
    if(plannerInputHashV276)pendingYawEvidenceV274.set(raw,{planningRate:rate,summary:{status:'UNKNOWN',reason:'PLANNER_NOT_COMPLETED',candidates:[]},inputHash:proof,plannerInputHashV276});
    const planned=robustInputV276?planLiveYawRobustV276(robustInputV276):input.yawDiagnosticV274.version==='live_yaw_paired_diagnostic_v275'?planObservedYawPivotContactFrameV275(decisionInput):planObservedYawContactFrameV255(decisionInput);
    pendingYawEvidenceV274.set(raw,{planningRate:rate,summary:summarizeYawDecisionV274(planned as Parameters<typeof summarizeYawDecisionV274>[0],contactFrameRequestV244.thresholds),inputHash:proof,...(plannerInputHashV276?{plannerInputHashV276}:{})});
    if(planned.status!=='PLANNED'||!planned.reference||planned.selectedYawDegrees===null)throw Object.assign(new Error('yaw diagnostic: '+planned.reason),{yawDiagnosticStatus:planned.status,baselineV244Decision});
    const selectedIndex=planned.candidates.findIndex(candidate=>Object.is(candidate.yawDegrees,planned.selectedYawDegrees));assert(selectedIndex>=0,'yaw diagnostic candidate missing');if(isRobustV276){assert('selectedRecipe' in planned&&planned.selectedRecipe,'robust yaw recipe missing');yawRobustFixedRecipeV276=planned.selectedRecipe;}
    yawDiagnosticV274={version:input.yawDiagnosticV274.version,planningRate:rate,selectedYawDegrees:planned.selectedYawDegrees,selectedIndex,cutoffTick:observationTick,selectedReference:planned.reference,baselineV161Diagnostics:normal.diagnostics,baselineV244Decision,translationMode:isRobustV276?'YAW_ROBUST_NINE_SCENARIOS':input.yawDiagnosticV274.version==='live_yaw_paired_diagnostic_v275'?'YAW_WITH_NOMINAL_CENTER_COMPENSATION':'YAW_ONLY_NO_TRANSLATION',...(isRobustV276?{robustEvidence:{version:'finite_nine_scenarios_v276',probability:false,wholeArc:'UNKNOWN',lateZero:'UNKNOWN',scenarioSummary:'scenarioSummary'in planned?planned.scenarioSummary.map(row=>({yawDegrees:row.candidate.yawDegrees,scenarios:row.values.map(v=>({status:v.status,...('reason'in v?{reason:v.reason}:{}),...('meets'in v?{meets:v.meets}:{})}))})):[]}}:{})};
    finalNominalReferenceV153=planned.reference;nominalRegistrationsV153.set(rate,{...normal,reference:planned.reference});
    // The choice is sealed before any execution-error draw; V152 streams keep the original per-key draws.
    baselineTimingError=timingRandom.normal()*b.timingStdSeconds*viewTimingScaleV1*(swingIntentV121?1:input.batting==='contact'?.72:input.batting==='power'?1.15:1);
    baselineAimError={x:aimRandom.normal()*aimScale,y:aimRandom.normal()*aimScale*(observationPolicyV151?.aimVerticalScaleV1??1),z:aimRandom.normal()*aimScale*.3};
    sweetSpotT=clamp((b.sweetSpotT??(b.batLengthM-.1524)/b.batLengthM)+(sweetSpotRandom.uniform()-.5)*.025,.65,.9);
    zoneTimingError=zoneHitStrength>0?baselineTimingError*zoneHitErrorScale:baselineTimingError;zoneAimError=zoneHitStrength>0?mul(baselineAimError,zoneHitErrorScale):baselineAimError;
    timingError=courseErrorScale===1?zoneTimingError:zoneTimingError*courseErrorScale;courseAimError=courseErrorScale===1?zoneAimError:mul(zoneAimError,courseErrorScale);
    aimError=batterRecognition.diagnostics.uncertaintyScale===1?courseAimError:{...courseAimError,x:courseAimError.x*batterRecognition.diagnostics.uncertaintyScale,y:courseAimError.y*batterRecognition.diagnostics.uncertaintyScale};
    desiredContactTime=Math.max(.055,(observedSpinTrialV236?.status==='APPLIED'?observedSpinTrialV236.contactArrivalAfterReleaseSeconds:prediction.elapsedSeconds)+timingError+(b.technicalTimingOffsetSeconds??0));
  }
  if(finalNominalReferenceV153)selectedFrames=[...finalNominalReferenceV153.frames];
  if(robustRequestV248){
    const source=nominalInputsV154.get(rate);
    robustPreReasonV248=contactFramePreReasonV244??(!finalNominalReferenceV153||!source?'NOMINAL_REGISTRATION_UNAVAILABLE':null);
    if(!robustPreReasonV248&&finalNominalReferenceV153&&source){
      const {desiredFieldAngleDegrees:_angle,...reactive}=source as ObservedDirectionRegistrationInputV153;
      const {startTick:_start,transform,impactTrajectory:_trajectory,...reference}=finalNominalReferenceV153;
      const center=createReferenceBatKinematicsV1(finalNominalReferenceV153).sampleAtSourceTick(sourceContactTick).sweetSpot;
      robustRecipeV248={originTick:input.originTick,decisionTick:observationTick,decisionTimeSeconds:decisionTime,nominalArrivalSeconds:prediction.elapsedSeconds,
        technicalTimingOffsetSeconds:b.technicalTimingOffsetSeconds??0,latencySeconds:b.motorLatencySeconds,startMode:envelopeV133?'ENVELOPE':'MOTOR',contactSourceTick:sourceContactTick,rampSeconds,
        reference:{...reference,rotation:transform.rotation},normalCenter:center,limits:reactive.limits??{},...(impactTrajectory===undefined?{}:{impactTrajectory})};
      const timingSigma=b.timingStdSeconds*(swingIntentV121?1:input.batting==='contact'?.72:input.batting==='power'?1.15:1)*zoneHitErrorScale*courseErrorScale,
        aimSigma=aimScale*zoneHitErrorScale*courseErrorScale,recognition=batterRecognition.diagnostics.uncertaintyScale;
      robustSigmaV248={timingSeconds:timingSigma,aim:{x:aimSigma*recognition,y:aimSigma*recognition,z:aimScale*.3*zoneHitErrorScale*courseErrorScale}};
      robustPlanV248=planLiveRobustContactFrameV247({recipe:robustRecipeV248,registration:{...reactive,reference:finalNominalReferenceV153},cutoffTick:observationTick,bats:b.bats,technique:robustRequestV248.technique,thresholds:robustRequestV248.thresholds,
        sigma:robustSigmaV248,maximumEvaluations:robustRequestV248.maximumEvaluations,maximumSearchSamples:robustRequestV248.maximumSearchSamples});
    }
  }
  // A planned offset that the motor cannot execute drops back to the normal swing of this same pitch.
  const buildReferenceOrNormalV1=()=>{
    try{const built=buildReferenceAtRate(rate);
      assert(effectiveMaximumSpeedV121===undefined||built.reference.maximumSweetSpotSpeedMps<=effectiveMaximumSpeedV121*(1+1e-10),'technique exceeds motor ceiling');
      assert(!executionV122||input.batting==='bunt'||referenceRateScaleV122(built.reference,executionV122)>=1-1e-9,'technique exceeds motor acceleration');return built;}
    catch(error){if(frozenContactFrameV244?.status!=='PLANNED')throw error;frozenContactFrameV244=resolveContactFrameAtRateV244(rate,null,'EXECUTION_REJECTED');return buildReferenceAtRate(rate);}
  };
  const {plannedStartTick,motorDelaySeconds,referenceInput,referenceContactTick,lateEvidenceV121,registeredReference,reference,aimScaleV133,composedV238,contactFrameV244,executionSaturationV153}=techniqueRequestedV1?buildReferenceOrNormalV1():buildReferenceAtRate(rate);
  const sameYawReferenceV274=(a:unknown,b:unknown):boolean=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&sameYawReferenceV274((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
  if((input as any).__normalForkDeltaV1){(globalThis as any).__normalForkEvidenceV1={delta:(input as any).__normalForkDeltaV1,clipId:clip.id,decisionTime,catcherObservationTime,glovePrefix:[0,.1,.18,.2].map(q=>gloveAt(q)),observedSample:kernel.evaluateAt(decisionTime).moment.ball,lateEvidence:lateEvidenceV121,referenceStartTick:referenceInput.startTick,held:reference.sampleContinuous(input.originTick+Math.round(.19*tps)).state,batPrefix:[0,.1,.18,.2].map(q=>reference.sampleContinuous(input.originTick+Math.round(q*tps)).state),sourcePrefix:[0,.1,.18,.2].map(q=>kernel.evaluateAt(q).moment.ball),sourceAfter:kernel.evaluateAt(.25).moment.ball};}
  assert(effectiveMaximumSpeedV121===undefined||reference.maximumSweetSpotSpeedMps<=effectiveMaximumSpeedV121*(1+1e-10),'adjusted reference exceeds declared motor ceiling');
  const executionBoundsV122=executionV122&&input.batting!=='bunt'?referenceAccelerationBoundsV122(reference):undefined;
  if(executionBoundsV122)assert(referenceRateScaleV122(reference,executionV122!)>=1-1e-9,'C1実行軌道が加速度上限を超えています。');
  const causalHeldPoseV1=(input as any).causalCatcherObservationV1==='fixed_release_100ms_v1'&&!authoredEnvelopeV133?{durationSeconds:.08,grip:{...fullFrames[0].grip,z:fullFrames[0].grip.z+battingSetupV94.stanceOffsetZ},orientation:{...fullFrames[0].orientation}}:undefined;
  const held=authoredEnvelopeV133?sampleAuthoredBatEnvelopePoseV133(authoredEnvelopeV133.preparation,b.batLengthM,sweetSpotT,input.originTick,selectedFrames[0].tick)
    :causalHeldPoseV1?sampleAuthoredBatEnvelopePoseV133(causalHeldPoseV1,b.batLengthM,sweetSpotT,input.originTick,selectedFrames[0].tick):reference.sampleContinuous(input.batting==='bunt'?referenceContactTick:input.originTick),
    buntTechnique=swingOffered&&input.batting==='bunt'?(b.technicalSkills?.bunting??0):0;
  // A dedicated, bounded bunt motor, planned once from the same observed
  // state as the batter's other decisions. No future contact/ball sample or
  // extra random draw steers the bat. The fixed axis is the authored bunt
  // face; its placement/timing error reuses the original motor-error draws.
  const buntMotor=(()=>{
    if(buntTechnique===0)return null;
    const precision=1/(1+.75*buntTechnique),
      yaw=aimScale>0?clamp(aimError.x/aimScale,-3,3)*.10*precision:0,
      elevation=aimScale>0?clamp(aimError.y/aimScale,-3,3)*.06*precision:0,
      axis={x:-batterSide*Math.cos(yaw)*Math.cos(elevation),y:Math.sin(elevation),z:Math.sin(yaw)*Math.cos(elevation)},
      startSweetSpot={x:0,y:middle,z:-.20},targetSweetSpot=add(motorAimPosition,mul(aimError,precision)),
      moveStartSeconds=decisionTime+(b.motorLatencySeconds??0),
      arrivalSeconds=Math.max(moveStartSeconds+.045,prediction.elapsedSeconds+timingError*precision+(b.technicalTimingOffsetSeconds??0)-.025),
      moveSeconds=arrivalSeconds-moveStartSeconds,
      maximumSpeedMps=Math.min(4,b.maximumSweetSpotSpeedMps??4),
      wantedDelta=sub(targetSweetSpot,startSweetSpot),wantedDistance=norm(wantedDelta),
      maximumTravelMeters=maximumSpeedMps*.65*moveSeconds/1.5,
      requestedDelta=wantedDistance>maximumTravelMeters?mul(wantedDelta,maximumTravelMeters/wantedDistance):wantedDelta,
      absorbStartSeconds=arrivalSeconds-.035,absorbSeconds=.16,
      requestedAbsorbMeters=Math.min(.12,maximumSpeedMps*.35*absorbSeconds/1.5),
      requestedAcceleration=6*norm(requestedDelta)/(moveSeconds*moveSeconds)+6*requestedAbsorbMeters/(absorbSeconds*absorbSeconds),
      accelerationScale=executionV122?Math.min(1,Math.min(executionV122.maximumGripAccelerationMps2,executionV122.maximumSweetSpotAccelerationMps2)/Math.max(Number.MIN_VALUE,requestedAcceleration)):1,
      delta=accelerationScale===1?requestedDelta:mul(requestedDelta,accelerationScale),absorbMeters=requestedAbsorbMeters*accelerationScale,
      maximumAccelerationMps2=requestedAcceleration*accelerationScale,
      maximumSurfaceSpeedMps=1.5*norm(delta)/moveSeconds+1.5*absorbMeters/absorbSeconds,
      sample=(seconds:number)=>{
        const u=clamp((seconds-moveStartSeconds)/moveSeconds,0,1),w=u*u*(3-2*u),
          dw=seconds>moveStartSeconds&&seconds<arrivalSeconds?6*u*(1-u)/moveSeconds:0,
          a=clamp((seconds-absorbStartSeconds)/absorbSeconds,0,1),aw=a*a*(3-2*a),
          ad=seconds>absorbStartSeconds&&seconds<absorbStartSeconds+absorbSeconds?6*a*(1-a)/absorbSeconds:0,
          sweetSpot=add(add(startSweetSpot,mul(delta,w)),{x:0,y:0,z:-absorbMeters*aw}),
          linearVelocity=add(mul(delta,dw),{x:0,y:0,z:-absorbMeters*ad}),
          grip=sub(sweetSpot,mul(axis,b.batLengthM*sweetSpotT));
        return {...held,sweetSpot,sweetSpotVelocity:linearVelocity,
          state:{pose:{grip,tip:add(grip,mul(axis,b.batLengthM))},linearVelocity,angularVelocity:zero()}};
      };
    return {sample,diagnostics:{calibrationId:'bounded-observed-bunt-motor-v75',strength:buntTechnique,
      observedAtElapsedSeconds:decisionTime,moveStartSeconds,arrivalSeconds,maximumSpeedMps,maximumSurfaceSpeedMps,
      desiredTargetSweetSpot:targetSweetSpot,reachableTargetSweetSpot:add(startSweetSpot,delta),axis,
      ...(executionV122?{maximumAccelerationMps2}:{}),
      positionErrorScale:precision,timingErrorScale:precision,absorbStartSeconds,absorbSeconds,absorbMeters,
      predictionBasis:'ONE_OBSERVED_STATE_FORECAST_NO_FUTURE_CONTACT',postContactResultOverride:false}};
  })();
  const batSample=(seconds:number)=>buntMotor?buntMotor.sample(seconds):swingOffered&&input.batting!=='bunt'?reference.sampleContinuous(input.originTick+seconds*tps)
      :authoredEnvelopeV133?sampleAuthoredBatEnvelopePoseV133(authoredEnvelopeV133.preparation,b.batLengthM,sweetSpotT,input.originTick+seconds*tps,selectedFrames[0].tick)
      :{...held,state:{...held.state,linearVelocity:zero(),angularVelocity:zero()}};
  const rigidAt=(seconds:number)=>createRigidBatStateFromBatterSwingState(batSample(seconds).state,batPhysical),
    batBound=buntMotor?.diagnostics.maximumSurfaceSpeedMps??(swingOffered&&input.batting!=='bunt'?reference.maximumGripSpeedMps+reference.maximumAngularSpeedRadPerSecond*b.batLengthM:0);
  const catcherHit=(opticalExperiment?normalPitchContact:firstContact)(kernel,t=>norm(sub(kernel.evaluateAt(t,'incoming').moment.ball.position,gloveAt(t).position))-catcher.gloveRadiusMeters-ballPhysical.radiusM,
      maximumGloveSpeedMps,horizon),catcherAt=catcherHit?.kind==='hit'?catcherHit.at:Math.min(horizon,catchPlaneTime+.05),
    batHit=(opticalExperiment?normalPitchContact:firstContact)(kernel,t=>measureRigidBatBallSurfaceSeparation(kernel.evaluateAt(t,'incoming').moment.ball,rigidAt(t),ballPhysical),batBound,catcherAt),
    officialStrikeZoneContactV94=swingOffered?null:findSourceStrikeZoneContactV94({kernel,volume:battingSetupV94.volume,ballRadiusMeters:ballPhysical.radiusM,
      throughElapsedSeconds:batHit?.kind==='hit'?Math.min(catcherAt,batHit.at):batHit?.kind==='unresolved'?Math.min(catcherAt,batHit.from):catcherAt});
  let normalRetentionCapture:any=null;
  let contact:RigidBatBallContactResult|null=null,contactMoment:BallWorldMoment|null=null,contactOrientation:Quaternion|null=null,
    call:'ball'|'called_strike'|'swinging_strike'|null=null,endElapsedSeconds=catcherAt,secureTick:number|null=null,unsupportedReason:string|null=null;
  if(batHit?.kind==='unresolved'){unsupportedReason='bat_contact_refinement_required';endElapsedSeconds=batHit.from;}
  else if(batHit?.kind==='hit'){
    const at=kernel.evaluateAt(batHit.at,'incoming'),impactBall=(opticalExperiment?.kernel as unknown as {legacyVelocityAt?:(t:number)=>Vec3}|undefined)?.legacyVelocityAt?{...at.moment.ball,velocity:(opticalExperiment!.kernel as unknown as {legacyVelocityAt:(t:number)=>Vec3}).legacyVelocityAt(batHit.at)}:at.moment.ball;const impactSample=batSample(batHit.at),heldV1=observationPolicyV151?.postContactHoldV1&&swingOffered&&input.batting!=='bunt'&&!buntMotor&&impactSample.sourceTick>sourceContactTick?(()=>{
      // Carry the clip's contact-moment velocities into the late pose, in the bat's own frame.
      const at=reference.sampleAtSourceTick(sourceContactTick,'incoming'),turn=multiplyQuaternions(impactSample.orientation,{w:at.orientation.w,x:-at.orientation.x,y:-at.orientation.y,z:-at.orientation.z}),
        linearVelocity=rotateVectorByQuaternion(at.state.linearVelocity,turn),angularVelocity=rotateVectorByQuaternion(at.state.angularVelocity,turn);
      return {state:{...impactSample.state,linearVelocity,angularVelocity},sweetSpotVelocity:add(linearVelocity,cross(angularVelocity,sub(impactSample.sweetSpot,impactSample.state.pose.grip)))};})():null,
      impactBat=heldV1?createRigidBatStateFromBatterSwingState(heldV1.state,batPhysical):rigidAt(batHit.at),impactSweetSpeed=norm((heldV1??impactSample).sweetSpotVelocity),impactLimit=observationPolicyV151?.impactSpeedLimitV1!==undefined&&b.targetSweetSpotSpeedMps!==undefined?b.targetSweetSpotSpeedMps*(observationPolicyV151.targetSpeedScaleV1??1)*observationPolicyV151.impactSpeedLimitV1:Infinity,impactScale=impactSweetSpeed>impactLimit?impactLimit/impactSweetSpeed:1;const impactBatScaled=impactScale===1?impactBat:{...impactBat,centerOfMassVelocity:mul(impactBat.centerOfMassVelocity,impactScale),angularVelocity:mul(impactBat.angularVelocity,impactScale)};
    contact=resolveWoodBatSpeedProfileBallContact(impactBall,impactBatScaled,ballPhysical,NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1);
    const vibrationV1=observationPolicyV151?.barrelVibrationLossV1;
    if(contact&&vibrationV1){
      // A wooden bat rings when struck away from its sweet spot and the ball keeps less of the bounce: the normal
      // restitution halves at the given distance toward the tip or the handle. The rigid bat alone loses nothing there.
      const pose=impactBatScaled.pose,axis=sub(pose.tip,pose.grip),length=norm(axis),along=dot(sub(contact.batSurfacePoint,pose.grip),axis)/length,
        offset=along-(b.sweetSpotT??(b.batLengthM-.1524)/b.batLengthM)*length,half=offset>0?vibrationV1[0]!:vibrationV1[1]!,keep=Math.max(vibrationV1[2]??0,.5**((offset/half)**2));
      if(keep<1)contact=resolveWoodBatSpeedProfileBallContact(impactBall,impactBatScaled,ballPhysical,{...NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
        normalRestitutionKnots:NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1.normalRestitutionKnots.map(k=>({...k,normalRestitution:k.normalRestitution*keep}))});
    }
    if(contact){contactMoment=at.moment;contactOrientation=at.materialOrientation??at.orientation;endElapsedSeconds=batHit.at;}
    else {unsupportedReason='separating_or_tangent_bat_contact_requires_continuation';endElapsedSeconds=batHit.at;}
  }else if(catcherHit?.kind==='unresolved'){unsupportedReason='catcher_contact_refinement_required';endElapsedSeconds=catcherHit.from;}
  else if(catcherHit?.kind==='hit'){
    const at=kernel.evaluateAt(catcherHit.at,'incoming'),glove=gloveAt(catcherHit.at),relative=sub(at.moment.ball.position,glove.position),normal=mul(relative,1/norm(relative)),
      retention=resolveCatchRetention({contactTick:at.moment.ball.tick,ball:at.moment.ball,glove:{tick:at.moment.ball.tick,...glove},contactNormal:normal,
        pocketOffsetMeters:Math.hypot(relative.x,relative.y),bodyStability:1},{ticksPerSecond:tps,ballMassKg:ballPhysical.massKg,ballRadiusMeters:ballPhysical.radiusM,
        pocketRadiusMeters:catcher.pocketRadiusMeters,centerRetentionCapacityJ:catcher.retentionCapacityJ,captureDissipationPowerW:catcher.captureDissipationPowerW,
        failedContactRestitution:.15,failedTangentialDamping:.6,failedSpinDamping:.4});
    normalRetentionCapture={retention,normal,gap:norm(relative)-catcher.gloveRadiusMeters-ballPhysical.radiusM};
    if(retention.outcome.kind==='secured'){
      secureTick=retention.outcome.secureTick;endElapsedSeconds=(secureTick-input.originTick)/tps;
      if(!swingOffered&&officialStrikeZoneContactV94?.kind==='unresolved')unsupportedReason='strike_zone_contact_refinement_required';
      else call=swingOffered?'swinging_strike':officialStrikeZoneContactV94?.kind==='hit'?'called_strike':'ball';
    }else unsupportedReason='catcher_retention_failed_live_ball_requires_successor';
  }else unsupportedReason='catcher_missed_live_ball_requires_successor';
  const opticalEnd=opticalExperiment?(opticalExperiment.kernel as unknown as {sampler:{endSeconds:number}}).sampler.endSeconds:null;
  if(opticalEnd!==null&&endElapsedSeconds>opticalEnd&&secureTick===null&&contactMoment===null){
    endElapsedSeconds=opticalEnd;call=null;unsupportedReason='robin_source_window_exhausted_requires_successor';
  }
  const endedAtTick=contactMoment?.ball.tick??quantizeEventTick(input.originTick,endElapsedSeconds,tps),times=new Set<number>([0,endElapsedSeconds]),
    referenceThroughTick=reference.motionThroughTickV133??referenceWorldTickAtSourceV121(registeredReference,selectedFrames.at(-1)!.tick);
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
        orientation:sample.materialOrientation??sample.orientation,visible:!owned&&(!opticalExperiment||seconds<opticalExperiment.hiddenAfterSeconds),possessedBy:owned?'catcher':null},bat:input.originTick+seconds*tps<=referenceThroughTick?{...bat,radiusProfile}:null};
  });
  const sampleBatAtTick=(atTick:number)=>{assert(Number.isFinite(atTick)&&atTick>=input.originTick,'bat observation precedes release');
    if(atTick>referenceThroughTick)return null;
    return {...batSample((atTick-input.originTick)/tps).state.pose,radiusProfile};};
  const {frames:_measuredFrames,...playbackReference}=registeredReference;
  const batPlaybackV88:LiveBatPlaybackDescriptorV88|undefined=swingOffered&&input.batting!=='bunt'?{
    version:88,originTick:input.originTick,battingSide:b.bats,heightScale,
    sourceFirstTick:selectedFrames[0].tick,sourceLastTick:selectedFrames.at(-1)!.tick,radiusProfile,reference:playbackReference,
  }:undefined;
  const nominalPlanV153=nominalRegistrationsV153.get(rate)?.diagnostics,
    nominalPlanForRecordV153=yawDiagnosticV274?null:nominalPlanV153?{...nominalPlanV153,...(neutralPolicyV272===undefined?{}:{neutralReactiveV272:neutralDiagnosticV272()}),candidates:nominalPlanV153.candidates.map(candidate=>{
      if(!candidate.certificates)return candidate;
      const {intervalCertificatesV154:_failureDetail,...certificates}=candidate.certificates;
      return {...candidate,certificates};
    })}:null;
  const techniqueSpinV1=(()=>{if(!techniquePolicyV1||!contact)return null;try{const o=observeBattedBallSpinV123({velocityMps:contact.exitVelocity,spinRadPerSecond:contact.exitSpin,bats:b.bats});
    return o.basisStatus==='DEFINED'?{backspin:o.backspinSignedRadPerSecond,slice:o.rightCurvingSpinRadPerSecond*(b.bats==='R'?1:-1),gyro:o.gyroRadPerSecond}:null;}catch{return null;}})(),
    techniquePlanV1=techniqueRequestedV1&&contactFrameV244?contactFrameV244:null,techniqueCandidateV1=techniquePlanV1?.candidates.find(row=>row.ordinal===techniquePlanV1.selectedOrdinal);
  ;(globalThis as any).__normalLooseDynamics={endElapsedSeconds,kernel,gloveAt,rigidAt,batBound,ballPhysical,sampleBatAtTick,batOriginTick:input.originTick,batTps:tps,batThroughSeconds:(referenceThroughTick-input.originTick)/tps,batBoundCovered:!(authoredEnvelopeV133&&!buntMotor&&(!swingOffered||input.batting==='bunt')),batStationaryAllTime:!buntMotor&&!swingOffered&&!authoredEnvelopeV133,catcherHit,batHit,retention:normalRetentionCapture?.retention,retentionNormal:normalRetentionCapture?.normal,retentionGap:normalRetentionCapture?.gap};return {frames,contact,contactMoment,contactOrientation,call,endedAtTick,clipId:clip.id,pitchType,
    ...(selectedSnapshot?{pitchId:selectedSnapshot.pitchId,pitchName:selectedSnapshot.name}:{}),speedKmh:(pitchWorkloadV122?norm(initial.velocity):speed)*3.6,sampleBatAtTick,
    diagnostics:{...((input as any).causalCatcherObservationV1==='fixed_release_100ms_v1'?{causalCatcherObservationV1:{version:'fixed_release_100ms_v1',basis:'EXPERIMENTAL_RELEASE_CLOCK_NOT_CALIBRATED'}}:{}),experimentalGloveAtEnd:gloveAt(endElapsedSeconds),experimentalEnd:endElapsedSeconds,authority:'LOCAL_CORE_PHYSICAL_EXPERIMENT_V1' as const,nativeAdmission:false as const,sourceDescriptor:(opticalExperiment?null:descriptor) as typeof descriptor,...(opticalExperiment?{experimentalSourceVersion:'robin_original_linear_source_v1' as const,experimentalAuthority:'DIAGNOSTIC_ONLY_HOLD_UNPROVEN_CONTACT' as const}:{}),
      ...(yawDiagnosticV274?{[yawDiagnosticV274.version==='live_yaw_paired_diagnostic_v276'?'yawDiagnosticV276':yawDiagnosticV274.version==='live_yaw_paired_diagnostic_v275'?'yawDiagnosticV275':'yawDiagnosticV274']:{...yawDiagnosticV274,executionRate:registeredReference.playbackRate,nominalRateMatchesExecution:Object.is(yawDiagnosticV274.planningRate,registeredReference.playbackRate),referenceComparison:sameYawReferenceV274(yawDiagnosticV274.selectedReference,registeredReference)?'EXACT' as const:'DEVIATED' as const,plannedStartTick,executedStartTick:registeredReference.startTick,motorRampSeconds:registeredReference.motorRampSecondsV121??0,registeredReference,lateApplied:lateEvidenceV121?.applied??false,executionSaturationV153,drawOrder:'SELECTION_THEN_V152_EXECUTION_DRAWS' as const,authority:'NON_ADOPTING_DIAGNOSTIC_ONLY' as const}}:{}),
      battingSetupV94,strikeZoneVolumeV94:battingSetupV94.volume,strikeZone:zone,officialStrikeZoneContactV94,
      ...(input.pitchCommandObservationV155?{pitchCommandObservationV155:{version:'live_pitch_command_observation_v155' as const,
        requestedTarget:{...target},selectedTarget:{...selectedTarget},commandedTarget:{...commanded},
        nominalReleaseVelocity:nominalReleaseVelocityV155!,executedReleaseVelocity:{...initial.velocity},
        inverseCompensationBasis:'INTENDED_SPIN_MEAN_AIR_EXCLUDES_UNANTICIPATED_SEAM' as const,postReleaseExecutionReaimed:false as const}}:{}),
      ...(techniquePolicyV1?{batterTechniqueV1:{version:'batter_technique_diagnostic_v1' as const,policySourceId:techniquePolicyV1.sourceId,technique:techniqueSelectionV1?.technique??null,
        selectionReason:techniqueSelectionV1?.reason??techniqueSkipV1,willingness:techniqueSelectionV1?.willingness??null,draw:techniqueSelectionV1?.draw??null,
        planStatus:techniqueSelectionV1?.technique==null?'NOT_TRIED' as const:techniquePlanV1?.status==='PLANNED'?'PLANNED' as const:'FELL_BACK' as const,planReason:techniquePlanV1?.reason??techniqueSkipV1,
        selectedOrdinal:techniquePlanV1?.selectedOrdinal??null,selectedDelta:techniquePlanV1?.selectedDelta??null,normalComponent:techniquePlanV1&&'normalComponent' in techniquePlanV1?techniquePlanV1.normalComponent??null:null,
        plannedComponent:techniqueCandidateV1?.component??null,plannedImprovement:techniqueCandidateV1?.improvement??null,battedSpin:techniqueSpinV1,
        actualFutureUsed:false as const,postContactResultOverride:false as const,humanCalibration:'NOT_MEASURED' as const}}:{}),
      ...(contactFrameV244&&!techniqueRequestedV1?{observedSpinContactFrameV244:{...contactFrameV244,nominalPlanningRate:contactFramePlanningRateV244,executedPlaybackRate:referenceInput.playbackRate,predictionExecutionScope:contactFrameV244.status!=='PLANNED'?'NO_TARGET':Object.is(contactFramePlanningRateV244,referenceInput.playbackRate)?'NOMINAL_RATE_ONLY_NOT_EXECUTION_PROOF':'NOMINAL_RATE_DIFFERS_NOT_EXECUTION_PROOF'}}:{}),
      ...(robustRequestV248?{observedSpinRobustContactFrameV248:{version:'live_observed_spin_robust_contact_frame_result_v248' as const,subjectId:robustRequestV248.subjectId,technique:robustRequestV248.technique,clip:robustRequestV248.clip,domain:robustRequestV248.domain,policy:robustRequestV248.policy,thresholds:robustRequestV248.thresholds,maximumEvaluations:robustRequestV248.maximumEvaluations,maximumSearchSamples:robustRequestV248.maximumSearchSamples,
        status:robustPlanV248?.status??'NO_TARGET',reason:robustPlanV248&&'reason' in robustPlanV248?robustPlanV248.reason:robustPreReasonV248??'EXPLICIT_UNCALIBRATED_PREDICTION',selectedOrdinal:robustPlanV248?.status==='PLANNED'?robustPlanV248.selected.ordinal:null,selectedDelta:robustPlanV248?.status==='PLANNED'?robustPlanV248.selected.delta:null,
        ...(robustRecipeV248?{nominalRecipe:robustRecipeV248}:{}),...(robustSigmaV248?{sigma:robustSigmaV248}:{}),...(robustPlanV248&&'candidates' in robustPlanV248?{candidates:robustPlanV248.candidates}:{}),...(robustPlanV248?{contactSearchCalls:robustPlanV248.contactSearchCalls,contactSearchSamples:robustPlanV248.contactSearchSamples,...('nominalContactSearchCalls' in robustPlanV248?{nominalContactSearchCalls:robustPlanV248.nominalContactSearchCalls,nominalContactSearchSamples:robustPlanV248.nominalContactSearchSamples}:{}),...('reservedCalls' in robustPlanV248?{reservedCalls:robustPlanV248.reservedCalls,reservedSamples:robustPlanV248.reservedSamples}:{})}:{}),
        nominalPlanningRate:rate,executedPlaybackRate:referenceInput.playbackRate,predictionExecutionScope:Object.is(rate,referenceInput.playbackRate)?'NOMINAL_RATE_ONLY_NOT_EXECUTION_PROOF':'NOMINAL_RATE_DIFFERS_NOT_EXECUTION_PROOF',lateObservationIncluded:false,randomSweetSpotVariationIncluded:false,actualFutureUsed:false,humanCalibration:'NOT_MEASURED',earnedQualification:false}}:{}),
      ...(observedSpinComposeV238?{observedSpinComposeV238:{...observedSpinComposeV238,...(observedSpinComposeV238.status==='APPLIED'?{status:'PLANNED' as const,registration:{preErrorDelta:composedV238!.preErrorDelta,normalPathRetained:composedV238!.normalPathRetained,
        actualExecutionDelta:null,actualExecutionDeltaReason:'MATCHED_NORMAL_RUN_REQUIRED' as const,finalExecutionPosition:reference.sampleContinuous(referenceContactTick).sweetSpot,
        executedContactTick:referenceContactTick,lateCorrection:lateEvidenceV121?.offset??null,clipId:clip.id,sourceSha256:clip.source.sha256}}:{})}}:{}),
      ...(observedSpinTrialV236?{observedSpinTrialV236:{...observedSpinTrialV236,...(observedSpinTrialV236.status==='APPLIED'?{registration:{clipId:clip.id,sourceSha256:clip.source.sha256,plannedContactTick:observedSpinTrialV236.contactTick,executedContactTick:referenceContactTick,executedSweetSpot:reference.sampleContinuous(referenceContactTick).sweetSpot,executionError:aimError,technicalTimingOffsetSeconds:b.technicalTimingOffsetSeconds??0,motorDelaySeconds,lateReaimed:false as const}}:{})}}:{}),
      ...(practiceSwingDecisionV241?{practiceSwingDecisionV241:{...practiceSwingDecisionV241,finalMotorAvailable:practiceSwingDecisionV241.offerAfterIntent?swingOffered:null}}:{}),
      ...(swingMotorV121?{swingIntentV121,swingMotorV121}:{}),...(lateEvidenceV121?{lateEvidenceV121}:{}),...(batCapacityV121?{batCapacityV121}:{}),
      ...(spinIntentV123?{spinIntentV123,battedSpinV123:contact?observeBattedBallSpinV123({velocityMps:contact.exitVelocity,
        spinRadPerSecond:contact.exitSpin,bats:b.bats}):null}:{}),
      ...(executionV122?{swingExecutionV122:{...executionV122,bounds:executionBoundsV122??{maximumGripAccelerationMps2:buntMotor?.diagnostics.maximumAccelerationMps2??0,
        maximumAngularAccelerationRadPerSecond2:0,maximumSweetSpotAccelerationMps2:buntMotor?.diagnostics.maximumAccelerationMps2??0},
        motor:input.batting==='bunt'?'BOUNDED_C1_BUNT':'C1_MEASURED_REFERENCE',playerLimitsMeasured:false as const,rawMeasuredKeysChanged:false as const}}:{}),
      ...(envelopeSourceV133?{swingEnvelopeV133:envelopeV133?{status:'APPLIED' as const,sourceId:envelopeSourceV133.sourceId,
        motionStartTick:reference.motionStartTickV133!,motionThroughTick:reference.motionThroughTickV133!,heightScaleAppliedOnce:true as const,
        rateSelection:envelopeRateV133!,lateAimScale:aimScaleV133,finalEnvelopeCertificateChecked:true as const,playerLimitsMeasured:false as const}
        :{status:'NOT_APPLIED' as const,sourceId:envelopeSourceV133.sourceId,reason:input.batting==='bunt'?'BUNT_MOTOR' as const:'NO_SWING' as const}}:{}),
      ...(managerCommunicationV122?{managerCommunicationV122}:{}),
      ...(battingDirectionV149?{battingDirectionV149}:{}),
      ...(directionMotorPolicyV153?{directionMotorV153:{policy:directionMotorPolicyV153,
        ...(neutralPolicyV272===undefined?{}:{neutralReactivePolicyV272:neutralPolicyV272,neutralReactiveV272:neutralDiagnosticV272()}),
        status:nominalRegistrationsV153.get(rate)?.reference?'PLANNED' as const:'NOT_APPLIED' as const,
        nominalPlan:nominalPlanForRecordV153,
        ...(nominalRegistrationsV153.get(rate)?.reference?{}:{reason:!swingOffered?'NO_SWING':directionMotorReasonV153??'NO_FEASIBLE_OBSERVED_REGISTRATION'}),
        boundarySource:authoredEnvelopeV133?.sourceId??null,boundaryCalibration:envelopeSourceV133?'EXPLICIT_AUTHOR_SOURCE' as const:'OPERATIONAL_NOT_MEASURED' as const,
        ...(directionMotorActiveV153?{executionAccelerationBounds:referenceAccelerationBoundsV122(reference)}:{}),
        executionSaturation:executionSaturationV153,
        executionErrorsAppliedAfterPlan:true as const,actualSourceUsedForPlan:false as const}}:{}),
      ...(randomStreamsV152?{randomnessV152:{...randomStreamsV152.captureTrace(),directionTrialAlias:input.directionTrialSeedV79===undefined?'NOT_PROVIDED'
        :directionAliasV152?'DIRECTION_ONLY_ALIAS':'EXPLICIT_DOMAIN_PRECEDENCE'}}:{}),
      ...(regionPolicyV222?{batterObservedRegionExperienceV222:{recall:regionRecallV222,snapshot:positionObserverV151!.snapshotAt!(positionObserverV151!.decisionTick)!}}:{}),
      ...(forecastResultV246?{batterObservedForecastV246:{snapshot:positionObserverV151!.snapshotAtV246!(observationTick)!,downstreamProjection:'V153_CONSTANT_ACCELERATION_AT_FORECAST_ANCHOR_NOT_CUBIC_TRAJECTORY' as const,humanCalibration:'NOT_MEASURED' as const}}:{}),
      ...(positionObserverV151?{batterObservationV151:{policy:observationPolicyV151!,decisionTick:positionObserverV151.decisionTick,
        rawForecast:rawForecastV151!,preparedRecall:preparedRecallV151,requestedPriorWeight:requestedPriorWeightV151,effectivePriorWeight:priorWeightV122,
        preparedAndObservedPrediction:prediction.ball.position,preparedAndObservedArrivalAfterReleaseSeconds:prediction.elapsedSeconds,
        preparedPredictionOwner:intentV122?.preparedPrediction?'EXPLICIT_BELIEF_V122':preparedRecallV151?'UNCLASSIFIED_EXPERIENCE_V151':'NONE',
        decisionStatus:deliveredPredictionV151?'DELIVERED_PREDICTION':'NO_DELIVERED_PREDICTION',
        finiteHeldPosePlaceholderOnly:!deliveredPredictionV151,
        memoryInput:'RAW_POSITION_FORECAST_BEFORE_PRIOR_MIXTURE' as const,classification:'UNCLASSIFIED_OBSERVED_FLIGHT' as const,
        humanCalibration:'NOT_MEASURED' as const}}:{}),
      ...(intentV122?{batterIntentV122:{...intentV122,belief:beliefV122??null,observedPrediction:observedPredictionV122.ball.position,
        preparedAndObservedPrediction:prediction.ball.position,actualSprayAngleDegrees:contact&&Math.hypot(contact.exitVelocity.x,contact.exitVelocity.z)>1e-9
          ?Math.atan2(contact.exitVelocity.x,contact.exitVelocity.z)*180/Math.PI:null,opponentPrivateStateUsed:false as const}}:{}),
      ...(pitchWorkloadV122?{pitchWorkloadV122:{...pitchWorkloadV122,nominalPlanRetained:true as const,timingApplication:'NOT_CONNECTED_RELEASE_ANCHORED_BROWSER_HOST' as const}}:{}),
      ...(pitchTargetPlanV111?{pitchTargetPlanV111:pitchTargetPlanV111.diagnostics}:{}),
      ...(pitchTunnelPlanV1?{pitchTunnelPlanV1}:{}),
      ...(zoneIntentV1?{zoneIntentV1}:{}),
      ...(recognitionV2?{pitchRecognitionV2:{recognized:recognitionV2.recognized,readId:recognitionV2.readId,actualId:recognitionV2.actualId,posterior:recognitionV2.posterior}}:{}),
      ...(batPlaybackV88===undefined?{}:{batPlaybackV88}),
      courseRecognitionV87:{batter:{...batterRecognition.diagnostics,requestedPosition:prediction.ball.position,selectedPosition:motorAimPosition,requestedCourseId:batterRecognition.diagnostics.predictedCourseId,selectedCourseId:batterRecognition.diagnostics.courseId,reason:!deliveredPredictionV151?'no_delivered_prediction_holding_pose':input.batting==='take'||b.swingDecision?.approach==='TAKE'?'manual_take_retained':b.swingDecision?.approach==='SWING'?'forced_swing_retained':'perceived_course_swing_and_aim'},
        pitcher:{...pitcherRecognition.diagnostics,requestedPosition,selectedPosition:pitcherRequest.position,requestedCourseId:classifyBatterCourseV79({position:requestedPosition,zone}).courseId,selectedCourseId:pitcherRequest.courseId,locationConstraint:input.location,selectedLocation:location,catcherRequestedPosition:catcherRequest.position,catcherRequestReason:catcherRequest.reason},
        catcher:{...catcherRecognition.diagnostics,requestedPosition:requestedPosition,selectedPosition:catcherRequest.position,requestedCourseId:classifyBatterCourseV79({position:requestedPosition,zone}).courseId,selectedCourseId:catcherRequest.courseId,requestPlaneZ:battingSetupV94.plateFrontZ,requestReason:catcherRequest.reason,captureTarget:catcherTarget}},
      ...(p.pitchingMotion===undefined?{}:{pitchingMotion:p.pitchingMotion}),
      ...(pitchQualityV177?{pitchQualityV177:{version:'live_pitch_quality_diagnostic_v177' as const,
        ...pitchQualityV177,request:pitchQualityRequestV177,
        requestSource:input.pitchQualityV177===undefined?'PITCHER_PROFILE' as const:'ONE_PITCH' as const,
        inverseCommandPasses:pitchQualityV177.status==='APPLIED'?2:1,
        baseSnapshotRetained:true as const,executionErrorsAfterNominalRecipe:true as const,
        forceProfileChanged:false as const,skillAdmission:false as const}}:{}),
      ...(pitchReleasePlanV168?{pitchReleasePlanV168:{version:'live_pitch_release_plan_v168' as const,
        ...pitchReleasePlanV168,baseSnapshotRetained:true as const,executionErrorsAfterNominalPlan:true as const,
        forceProfileChanged:false as const,skillAdmission:false as const}}:{}),
      ...(spinExecution.active?{spinExecution:{...spinExecution,nominalSpin:spin,nominalPlanRetained:true}}:{}),
      ...(buntMotor?{buntTechnique:buntMotor.diagnostics}:{}),
      ...(insideTargetWeight>0?{insideCommandTechnique:{calibrationId:'inside-command-v77',strength:insideTechnique,weight:insideTargetWeight,
        battingSide:b.bats,target,commanded,baselineStandardDeviationMeters:lowZoneCommandStd,effectiveStandardDeviationMeters:effectiveCommandStd,
        releaseVelocityOnly:true}}:{}),
      ...(courseProfile===undefined?{}:{courseV79:{version:'batter_course_profile_v79' as const,predictedCourse,
        predictedPosition:judgmentPosition,zone:{centerX:0,halfWidth:zone.halfWidth,lowerY:zone.lowerY,upperY:zone.upperY},
        referenceAverage:courseAverage,effectScale:courseProfile.effectScale,errorScale:courseErrorScale,motorActive:courseMotorActive,
        directionIntent,predictionMadeAtElapsedSeconds:decisionTime,postContactResultOverride:false as const}}),
      ...(zoneHitStrength>0?{zoneHittingTechnique:{calibrationId:'high-low-hitting-v77',highStrength:highHitTechnique*highHitWeight,
        lowStrength:lowHitTechnique*lowHitWeight,predictedHeightMeters:prediction.ball.position.y,errorScale:zoneHitErrorScale,
        baselineTimingErrorSeconds:baselineTimingError,baselineAimErrorMeters:baselineAimError,postContactResultOverride:false}}:{}),
      ...(selectedPitch.authored?{authoredPitch:{pitchType:selectedPitch.pitchType,releaseSpeedMps:selectedPitch.releaseSpeedMps,
        spinRadPerSecond:selectedPitch.spinRadPerSecond,...(selectedSnapshot?{snapshot:selectedSnapshot}:{}),sourceInitialOnly:true}}:{}),
      ...(lowZoneTechniqueActive?{lowZoneCommandTechnique:{calibrationId:'low-target-command-v75',strength:lowZoneTechnique,
        target,commanded,baselineStandardDeviationMeters:p.commandStdMeters,effectiveStandardDeviationMeters:effectiveCommandStd,
        targetRegion:'LOWER_THIRD_OR_BELOW',releaseVelocityOnly:true}}:{}),
      ...(input.pitchType==='auto'&&pitchApproach!=='BALANCED'?{pitchPreference:{preference:pitchApproach,weights:ownedSelectionWeights??autoPitchWeights,
        selectionDraw,basis:'LOCAL_PREFERENCE_OVER_EXISTING_AUTO_PITCH_MENU' as const}}:{}),
      sourceBallReanchored:false as const,sourceClockTicksPerSecond:tps,obpSourceSha256:clip.source.sha256,battingSide:b.bats,
      measuredClipId:clip.id,measuredBatCoordinateRegistration:MEASURED_BAT_FIELD_REGISTRATION_V1,
      ...(partialFallbackV1?{partialFallbackV1:{version:'partial_reference_fallback_v1',offerSemantics:'EXISTING_INTENT_BASED',accelerationAuthority:executionV122?'EXPLICIT_LIMITS':'UNSPECIFIED_NOT_ASSERTED'}}:{}),swingOffered,sweetSpotT,playbackRate:directionMotorActiveV153?referenceInput.playbackRate:rate,referenceStartTick:referenceInput.startTick,referenceThroughTick,predictionMadeAtElapsedSeconds:decisionTime,
      releaseGeometry,
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
      ...(impactTrajectory===undefined?{}:{impactTrajectory:{...impactTrajectory,contactSourceTick:sourceContactTick,
        timingBasis:'ORIGINAL_MEASURED_SOURCE_SECONDS' as const,
        model:impactTrajectory.method==='whole-arc-target'?'WHOLE_ARC_RIGID_CONTACT_PIVOT_TARGET' as const:'COMPACT_C2_RIGID_CONTACT_PIVOT' as const,
        speedCeilingRecomputed:true as const,launchAngleOrSpinOverridden:false as const}}),
      plannedReferenceStartTick:plannedStartTick,maximumOnTimeMotorLatencySeconds:envelopeV133
        ?(plannedStartTick-input.originTick)/tps-decisionTime-envelopeV133.preparation.durationSeconds
        :(plannedStartTick-input.originTick)/tps-decisionTime,
      desiredContactElapsedSeconds:desiredContactTime,selectedSourceFirstTick:selectedFrames[0].tick,selectedSourceLastTick:selectedFrames.at(-1)!.tick,
      referenceSpeedCalibration:'EXACT_ORIGINAL_SOURCE_COORDINATE_OUTGOING_HALF_OPEN_SEGMENT' as const,
      referenceContactSweetSpotSpeedMps:norm(reference.sampleAtSourceTick(sourceContactTick,'outgoing').sweetSpotVelocity),
      referenceContactSweetSpotVelocity:reference.sampleAtSourceTick(sourceContactTick,'outgoing').sweetSpotVelocity,
      referenceIncomingContactSweetSpotVelocity:reference.sampleAtSourceTick(sourceContactTick,'incoming').sweetSpotVelocity,
      referenceWorldSampleContactSweetSpotVelocity:reference.sampleContinuous(referenceContactTick).sweetSpotVelocity,
      predictionModel:positionObserverV151?'DELIVERED_POSITION_SAMPLES_FORECAST_NO_HUMAN_CALIBRATION' as const:'CURRENT_OBSERVED_STATE_AERO_FORECAST_NO_BODY_OR_NEURAL_CALIBRATION' as const,timingErrorSeconds:timingError,aimErrorMeters:aimError,
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

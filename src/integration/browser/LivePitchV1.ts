import type { Vec3 } from '../../core/model/geometry';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { createLivePlayRandomStreamsV152, validateLiveRandomnessV152, type LiveRandomnessV152 } from '../../core/rng/LiveRandomStreamsV152';
import { createSourceFreeBallKernel,type SourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { createAeroGroundBallPhysicsProfile,type AeroGroundBallPhysicsV1 } from '../../core/sim/ball/VersionedBattedBallPhysics';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import { sampleAerodynamicPitchStateAtElapsedSeconds } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { IDENTITY_QUATERNION, normalizeQuaternion, quaternionFromAxisAngle, type Quaternion } from '../../core/sim/pitching/BaseballOrientation';
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
import {recallBatterObservedMemoryV151,validateBatterObservedMemoryV151,type BatterObservedMemoryV151} from '../../core/decision/batting/BatterObservedMemoryV151';
import {recallObservedRegionV222,validateObservedRegionPolicyV222,type BatterObservedRegionExperiencePolicyV222} from '../../core/decision/batting/BatterObservedRegionExperienceV222';
import {createLiveBatterPositionObserverV151,validateLiveBatterObservationPolicyV151,type LiveBatterObservationPolicyV151} from './LiveBatterObservationV151';
import {validateObservedDirectionMotorV153,createDirectionMotorPredictionV153,limitDirectionExecutionV153,type ObservedDirectionMotorPolicyV153} from './LiveDirectionMotorV153';
import {planObservedDirectionRegistrationV153,planObservedReactiveRegistrationV161,type ObservedDirectionRegistrationInputV153,
  type ObservedReactiveRegistrationInputV161} from '../../core/sim/contact/ObservedDirectionRegistrationV153';
import {selectPredictionAt,resolveMotorStart} from '../../core/world/psychology/batting/BattingTiming';
import {validateLiveSwingEnvelopeV133,scaleLiveSwingEnvelopeV133,selectLiveSwingEnvelopeRateV133} from './LiveSwingEnvelopeV133';
import { resolvePitcherRepertoireV77, validatePitchingMotionV77, type PitchRepertoireV77, type PitchingMotionV77 } from './LivePitchAuthoringV77';
import { validatePitchRepertoireV78, samplePitchSpinExecutionV78, type PitchRepertoireV78, type PitchSnapshotV78 } from './LivePitchAuthoringV78';
import { resolveLivePitchReleasePlanV168, type LivePitchReleasePlanV168 } from './LivePitchReleasePlanV168';
import { createLivePitchQualityReleasePlanV177, validateLivePitchQualityRequestV177, type LivePitchQualityRequestV177 } from './LivePitchQualityRecipeV177';
import { validateTechnicalSkillControlsV75, type TechnicalSkillControlsV75 } from '../../core/sim/TechnicalSkillControlsV75';
import { classifyBatterCourseV79, validateBatterCourseProfileV79 } from './BatterCourseProfileV79';
import {expandBatterCourseProfileV87ToV79,resolveBatterCourseProfileV87} from './BatterCourseProfileV87';
import {recognizeZoneV87,selectZoneTargetV87,validateZoneRecognitionV87,type ZoneRecognitionV87} from './ZoneRecognitionV87';
import type { LiveBatPlaybackDescriptorV88 } from './LiveBatPlaybackV88';
import { planLivePitchTargetV111, resolveLivePitchCommandStdV111, type LivePitchSituationV111 } from './LivePitchTargetPlanV111';
import {validateLiveSpinControlV123,selectLiveSpinIntentV123,findLiveSpinMotionClipV124} from './LiveSpinControlV123';
import {observeBattedBallSpinV123} from '../../core/sim/contact/BattedBallSpinObservationV123';
import {validateLiveObservedSpinTrialRequestV236,resolveLiveObservedSpinTrialV236,type LiveObservedSpinTrialRequestV236} from './LiveObservedSpinTrialV236';
import {validateLiveObservedSpinComposeRequestV238,resolveLiveObservedSpinComposeV238,composeLiveObservedSpinAimV238,type LiveObservedSpinComposeRequestV238} from './LiveObservedSpinComposeV238';

export type LiveMeasuredClipV1=Readonly<{
  id:string;side:'R'|'L';source:Readonly<{sha256:string;repository?:string}>;contactTimeSeconds:number;
  normalization:Readonly<{batLengthM:number;sweetSpotT:number;positionScale?:number}>;
  frames:readonly Readonly<{tick:number;grip:Vec3;orientation:Quaternion}>[];
  /** Expanded catalogs keep legacy automatic choices; explicit IDs remain available. */
  defaultSelection?:boolean;
}>;
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
  batterObservedRegionExperienceV222?:BatterObservedRegionExperiencePolicyV222;
  observedSpinTrialV236?:LiveObservedSpinTrialRequestV236|LiveObservedSpinComposeRequestV238;
  batterDirectionMotorV153?:ObservedDirectionMotorPolicyV153;
  batterObservedMemoryV151?:Readonly<{memory:BatterObservedMemoryV151;observerPlayerId:string;pitcherId:string}>;
  /** Known before release. Omission preserves the original standalone target policy. */
  pitchSituationV111?:LivePitchSituationV111;
  batter:LivePhysicalAbilityControlsV1 & Readonly<{heightMeters:number;bats:'R'|'L';batLengthM:number;batMassKg:number;swingRate:number;
    timingStdSeconds:number;aimStdMeters:number;chaseMarginMeters:number;clipId?:string;technicalSkills?:TechnicalSkillControlsV75}>;
  pitcher:Readonly<{releaseSpeedMps:number;spinRadPerSecond:Vec3;commandStdMeters:number;maximumPitchSpeedMps?:number;throws?:'R'|'L';
    heightMeters?:number;moundPosition?:Vec3;pitchReleaseHeightMeters?:number;pitchReleaseSideMeters?:number;pitchReleaseExtensionMeters?:number;
    pitchApproach?:'FASTBALL'|'BALANCED'|'BREAKING';technicalSkills?:TechnicalSkillControlsV75;pitchRepertoire?:PitchRepertoireV77;pitchingMotion?:PitchingMotionV77;
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
export function simulateLivePitchV1(raw:LivePitchInputV1){
  const input=cloneInert(raw),b=input.batter,p=input.pitcher,baseProfile=createAeroGroundBallPhysicsProfile(input.physics),tps=baseProfile.air.ticksPerSecond,
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
  const directionMotorPolicyV153=input.batterDirectionMotorV153===undefined?undefined:validateObservedDirectionMotorV153(input.batterDirectionMotorV153);
  assert(directionMotorPolicyV153===undefined||observationPolicyV151!==undefined,'direction motor requires position-only observation policy');
  assert(observationPolicyV151===undefined||observationPolicyV151.ticksPerSecond===tps,'batter observation clock differs from physics');
  assert(input.batterObservedMemoryV151===undefined||observationPolicyV151!==undefined,'observed memory requires explicit observation policy');
  const observedMemoryV151=input.batterObservedMemoryV151===undefined?undefined:validateBatterObservedMemoryV151(input.batterObservedMemoryV151.memory);
  if(observedMemoryV151)assert(observedMemoryV151.observerPlayerId===input.batterObservedMemoryV151!.observerPlayerId
    &&observedMemoryV151.pitcherId===input.batterObservedMemoryV151!.pitcherId,'observed memory participants differ');
  const regionPolicyV222=input.batterObservedRegionExperienceV222===undefined?undefined:validateObservedRegionPolicyV222(input.batterObservedRegionExperienceV222),
    rawSpinRequest=input.observedSpinTrialV236,
    spinTrialRequestV236=rawSpinRequest?.version==='live_observed_spin_trial_v236'?validateLiveObservedSpinTrialRequestV236(rawSpinRequest):undefined,
    spinComposeRequestV238=rawSpinRequest?.version==='live_observed_spin_compose_trial_v238'?validateLiveObservedSpinComposeRequestV238(rawSpinRequest):undefined;
  if(rawSpinRequest!==undefined&&!spinTrialRequestV236&&!spinComposeRequestV238)throw Error('invalid observed spin trial version');
  const spinSubject=spinTrialRequestV236?.subjectId??spinComposeRequestV238?.subjectId;
  if(spinSubject!==undefined){const known=[input.batterObservedMemoryV151?.observerPlayerId,input.batterBeliefV122?.observerPlayerId].filter((v):v is string=>v!==undefined);
    assert(known.every(id=>id===spinSubject),'spin trial subject differs from current batter observation');}
  assert(regionPolicyV222===undefined||observationPolicyV151!==undefined,'region experience requires position-only observation policy');
  const recallInputV151=observedMemoryV151?{atTick:input.originTick,
    draw:randomStreamsV152?.rng('batterBelief','recent-memory').uniform()??new SeedRoot(input.seed).streamRng(0,'batting','observed-prepitch-memory-v151').nextFloat(),
    priorWeight:b.batterApproachV122?.priorReliance??observationPolicyV151!.memoryPolicy.unprofiledPriorWeight}:null,
    legacyRecallV151=observedMemoryV151&&recallInputV151?recallBatterObservedMemoryV151(observedMemoryV151,recallInputV151):null,
    regionRecallV222=regionPolicyV222&&observedMemoryV151&&recallInputV151?recallObservedRegionV222(observedMemoryV151,recallInputV151):null,
    preparedRecallV151=legacyRecallV151&&regionRecallV222?{...legacyRecallV151,position:regionRecallV222.position,arrivalAfterReleaseSeconds:regionRecallV222.arrivalAfterReleaseSeconds}:legacyRecallV151;
  const envelopeSourceV133=b.swingEnvelopeV133===undefined?undefined:validateLiveSwingEnvelopeV133(b.swingEnvelopeV133,b.swingExecutionV122);
  const spinProfileV123=b.spinControlV123===undefined?undefined:validateLiveSpinControlV123(b.spinControlV123);
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
  assert(!(p.pitchRepertoire&&p.pitchRepertoireV78),'ambiguous V77 and V78 pitch ownership');
  for(const [key,lo,hi] of [['maximumSweetSpotSpeedMps',.1,90],['targetSweetSpotSpeedMps',.1,90],['motorLatencySeconds',0,2],
    ['technicalTimingOffsetSeconds',-.5,.5],['sweetSpotT',.65,.9],['attackAngleDegrees',-80,80],['pullAngleDegrees',-80,80],
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
        return pitchApproach==='FASTBALL'?(fast?7:1):pitchApproach==='BREAKING'?(fast?1:3):1;});
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
  const speed=selectedPitch.releaseSpeedMps*(.98+.02*speedRandom.uniform());
  let spin=pitchReleasePlanV168?.spinRadPerSecond??selectedPitch.spinRadPerSecond,
    nominalMaterialOrientationV168=pitchReleasePlanV168?.releaseOrientation??selectedSnapshot?.releaseOrientation;
  const battingSetupV94=resolveLiveBattingSetupV94(b),zone=battingSetupV94.region,middle=(zone.lowerY+zone.upperY)/2;
  let location=input.location==='auto'?['zone','zone','low','outside','inside'][Math.floor(locationRandom.uniform()*5)]:input.location;
  assert(['zone','low','outside','inside','high'].includes(location),'unsupported target location');
  const batterSide=b.bats==='R'?-1:1,target={x:(targetRandom.uniform()-.5)*.32,y:middle+(targetRandom.uniform()-.5)*(zone.upperY-zone.lowerY)*.7,z:battingSetupV94.plateFrontZ};
  if(location==='outside')target.x=-batterSide*(.25+targetRandom.uniform()*.25);
  if(location==='inside')target.x=batterSide*(.19+targetRandom.uniform()*.2);
  if(location==='low')target.y=zone.lowerY-.06-targetRandom.uniform()*.16;
  if(location==='high')target.y=zone.upperY+.06+targetRandom.uniform()*.16;
  // Consume the legacy targeting draws first. The independent planning stream
  // must not shift the actual command/spin/swing error samples.
  const pitchTargetPlanV111=input.location==='auto'&&input.pitchSituationV111!==undefined?planLivePitchTargetV111({
    zone,ballRadiusMeters:profile.ground.radiusM,pitcher:p,catcher,batter:b,situation:input.pitchSituationV111,
    seed:randomStreamsV152?.seedFor('pitchTarget','target-plan-v111')??input.seed}):null;
  if(pitchTargetPlanV111){Object.assign(target,pitchTargetPlanV111.position);location=pitchTargetPlanV111.location;}
  const {lowZoneTechnique,lowZoneTechniqueActive,lowZoneCommandStd,insideTechnique,insideTargetWeight,effectiveCommandStd}=
    resolveLivePitchCommandStdV111({position:target,zone,bats:b.bats,commandStdMeters:p.commandStdMeters,technicalSkills:p.technicalSkills});
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
      baselineErrorMeters:{x:commandRandom.normal()*effectiveCommandStd,y:commandRandom.normal()*effectiveCommandStd},abilityBasis:'commandStdMeters_and_command_techniques',reason:pitcherRequest.reason}),
    commanded={...selectedTarget,...pitcherRecognition.position};
  const releaseGeometry=resolveLivePitchReleaseV1(p),release=releaseGeometry.position,flightGuess=(release.z-commanded.z)/speed;
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
  const horizon=Math.min(2.5,Math.max(.8,flightTime+.4,pitchWorkloadV122?(release.z+.85)/Math.max(.001,Math.abs(initial.velocity.z))*1.5+.2:0)),descriptor={kind:'aero_ground_continuous_source_kernel_v2' as const,
    initial:{originTick:input.originTick,elapsedSeconds:0,ball:initial},throughElapsedSeconds:horizon,profile,
    ...(nominalMaterialOrientationV168?{materialOrientationAtStart:nominalMaterialOrientationV168}:{})},kernel=createSourceFreeBallKernel(descriptor),
    plateTime=crossing(kernel,battingSetupV94.plateFrontZ),catchPlaneTime=crossing(kernel,-.85);
  assert(plateTime!==null&&catchPlaneTime!==null,'pitched ball did not cross the finite plate/catcher planes');
  const catcherObservationTime=Math.min(.14,plateTime*.35),observedSample=kernel.evaluateAt(catcherObservationTime),
    positionObserverV151=observationPolicyV151===undefined?undefined:createLiveBatterPositionObserverV151({policy:observationPolicyV151,
      originTick:input.originTick,planeZ:battingSetupV94.contactPlaneZ},seconds=>{
      if(seconds>horizon)return null;const sample=kernel.evaluateAt(seconds).moment.ball;return {tick:sample.tick,position:sample.position};},regionPolicyV222!==undefined||spinTrialRequestV236!==undefined||spinComposeRequestV238!==undefined),
    decisionTime=positionObserverV151?(positionObserverV151.decisionTick-input.originTick)/tps:catcherObservationTime,
    rawForecastV151=positionObserverV151?.forecastAt(positionObserverV151.decisionTick);
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
  const observedPredictionV122=positionObserverV151?{elapsedSeconds:rawForecastV151!.prediction?.arrivalAfterReleaseSeconds??decisionTime,
      ball:{tick:positionObserverV151.decisionTick,position:rawForecastV151!.prediction?.position??{x:0,y:middle,z:battingSetupV94.contactPlaneZ},
        velocity:rawForecastV151!.prediction?.estimatedVelocity??zero(),spin:zero()}}
      :predictFromObservation(observedSample,decisionTime,battingSetupV94.contactPlaneZ),
    priorV122=intentV122?.preparedPrediction??(preparedRecallV151?{x:preparedRecallV151.position.x,y:preparedRecallV151.position.y,
      arrivalAfterReleaseSeconds:preparedRecallV151.arrivalAfterReleaseSeconds}:null),
    requestedPriorWeightV151=intentV122?.preparedPrediction?(intentV122.priorWeight??0):preparedRecallV151?.priorWeight??0,
    currentObservationAvailableV151=positionObserverV151===undefined||rawForecastV151?.status==='PREDICTED',
    usablePriorV151=priorV122!==null&&priorV122!==undefined&&requestedPriorWeightV151>0,
    priorWeightV122=!currentObservationAvailableV151&&usablePriorV151?1:requestedPriorWeightV151,
    prediction=priorV122&&priorWeightV122>0?{...observedPredictionV122,
      elapsedSeconds:Math.max(decisionTime,observedPredictionV122.elapsedSeconds*(1-priorWeightV122)+priorV122.arrivalAfterReleaseSeconds*priorWeightV122),
      ball:{...observedPredictionV122.ball,position:{...observedPredictionV122.ball.position,
        x:observedPredictionV122.ball.position.x*(1-priorWeightV122)+priorV122.x*priorWeightV122,
        y:observedPredictionV122.ball.position.y*(1-priorWeightV122)+priorV122.y*priorWeightV122}}}:observedPredictionV122,
    controlFactor=swingIntentV121?1:input.batting==='power'?1.08:input.batting==='contact'?.92:1,
    baselineTimingError=timingRandom.normal()*b.timingStdSeconds*(swingIntentV121?1:input.batting==='contact'?.72:input.batting==='power'?1.15:1),
    awkwardness=Math.max(0,Math.abs(prediction.ball.position.x)/.2159-1,(.55-prediction.ball.position.y)/.5,(prediction.ball.position.y-1.5)/.5),
    awkwardErrorFactor=b.badBallControl===undefined?1:1+awkwardness*(1-b.badBallControl),
    aimScale=b.aimStdMeters*(swingIntentV121?1:input.batting==='contact'?.7:input.batting==='power'?1.1:1)*awkwardErrorFactor,
    baselineAimError={x:aimRandom.normal()*aimScale,y:aimRandom.normal()*aimScale,z:aimRandom.normal()*aimScale*.3},
    sweetSpotT=clamp((b.sweetSpotT??(b.batLengthM-.1524)/b.batLengthM)+(sweetSpotRandom.uniform()-.5)*.025,.65,.9),heightScale=b.heightMeters/1.8;
  const judgmentStd=b.zoneJudgmentStdMeters??0,judgmentError={x:0,y:0};
  if(judgmentStd!==0){
    // An isolated recognition stream does not consume clip, pitch-command,
    // timing or aim draws. No identity/league enters this numerical model.
    const judgmentRng=new SeedRoot(randomStreamsV152?.seedFor('batterPerception','zone-judgment-v1')??input.seed).streamRng(0,'batting','zone-judgment-v1'),
      normal=()=>Math.sqrt(-2*Math.log(1-judgmentRng.nextFloat()))*Math.cos(2*Math.PI*judgmentRng.nextFloat());
    judgmentError.x=normal()*judgmentStd;judgmentError.y=normal()*judgmentStd;
  }
  const observationTick=positionObserverV151?.decisionTick??input.originTick+Math.round(decisionTime*tps),batterRecognition=recognizeZoneV87({role:'batter',profile:b.zoneRecognitionV87,position:prediction.ball.position,zone,
    seed:randomStreamsV152?.seedFor('batterPerception','zone-recognition-v87')??input.seed,
    sourceTick:rawForecastV151?.observedThroughTick??observationTick,observationTick,planeZ:battingSetupV94.contactPlaneZ,standardDeviationMeters:judgmentStd,baselineErrorMeters:judgmentError,abilityBasis:'zoneJudgmentStdMeters'}),
    judgmentPosition={...prediction.ball.position,...batterRecognition.position},recognitionAimOffset=batterRecognition.diagnostics.biasMeters,
    motorAimPosition=recognitionAimOffset.x===0&&recognitionAimOffset.y===0?prediction.ball.position:{...prediction.ball.position,x:prediction.ball.position.x+recognitionAimOffset.x,y:prediction.ball.position.y+recognitionAimOffset.y};
  const inChaseEnvelope=Math.abs(judgmentPosition.x)<=zone.halfWidth+b.chaseMarginMeters
    &&judgmentPosition.y>=zone.lowerY-b.chaseMarginMeters&&judgmentPosition.y<=zone.upperY+b.chaseMarginMeters,
    zoneMargin=Math.min(zone.halfWidth-Math.abs(judgmentPosition.x),judgmentPosition.y-zone.lowerY,zone.upperY-judgmentPosition.y),
    swingScore=clamp((.5+zoneMargin/Math.max(.1,zone.halfWidth)+(b.swingDecision?(b.swingDecision.aggressionWeight-.5)*.2:0))*batterRecognition.diagnostics.targetWeight,0,1);
  const deliveredPredictionV151=currentObservationAvailableV151||usablePriorV151;
  let swingOffered=deliveredPredictionV151&&input.batting!=='take'&&(!swingIntentV121||swingIntentV121.effort>0)&&(b.swingDecision?b.swingDecision.approach==='SWING'
      ||b.swingDecision.approach==='AUTO'&&inChaseEnvelope&&swingScore>=b.swingDecision.threshold:inChaseEnvelope&&batterRecognition.diagnostics.targetWeight>0);
  const learnedMotionClipV124=spinProfileV123===undefined?null:findLiveSpinMotionClipV124(spinProfileV123,b.bats,input.measuredClips),
    intentClipV124=learnedMotionClipV124??clip;
  const spinIntentV123=spinProfileV123===undefined?undefined:selectLiveSpinIntentV123({profile:spinProfileV123,bats:b.bats,
    clip:{id:intentClipV124.id,sourceSha256:intentClipV124.source.sha256},observation:{observedTick:observationTick,availableTick:observationTick,decisionTick:observationTick},
    perceivedPosition:{x:judgmentPosition.x,y:judgmentPosition.y},zone,timeUntilContactSeconds:Math.max(0,prediction.elapsedSeconds-decisionTime),
    swingOffered,battingMode:input.batting}),spinMotionV123=spinIntentV123?.motion;
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
  const predictedZoneHeight=(prediction.ball.position.y-zone.lowerY)/(zone.upperY-zone.lowerY),
    highHitWeight=techniqueBlend((predictedZoneHeight-.55)/.35),lowHitWeight=techniqueBlend((.45-predictedZoneHeight)/.35),
    highHitTechnique=b.technicalSkills?.high_zone_hitting??0,lowHitTechnique=b.technicalSkills?.low_zone_hitting??0,
    zoneHitStrength=swingOffered&&input.batting!=='bunt'?highHitTechnique*highHitWeight+lowHitTechnique*lowHitWeight:0,
    zoneHitErrorScale=zoneHitStrength>0?1/(1+.4*zoneHitStrength):1,
    zoneTimingError=zoneHitStrength>0?baselineTimingError*zoneHitErrorScale:baselineTimingError,
    zoneAimError=zoneHitStrength>0?mul(baselineAimError,zoneHitErrorScale):baselineAimError,
    timingError=courseErrorScale===1?zoneTimingError:zoneTimingError*courseErrorScale,
    courseAimError=courseErrorScale===1?zoneAimError:mul(zoneAimError,courseErrorScale),
    aimError=batterRecognition.diagnostics.uncertaintyScale===1?courseAimError:{...courseAimError,x:courseAimError.x*batterRecognition.diagnostics.uncertaintyScale,y:courseAimError.y*batterRecognition.diagnostics.uncertaintyScale},
    desiredContactTime=Math.max(.055,(observedSpinTrialV236?.status==='APPLIED'?observedSpinTrialV236.contactArrivalAfterReleaseSeconds:prediction.elapsedSeconds)+timingError+(b.technicalTimingOffsetSeconds??0)),sourceContactTick=clip.contactTimeSeconds*1e6;
  let authoredEnvelopeV133=envelopeSourceV133&&input.batting!=='bunt'?scaleLiveSwingEnvelopeV133(envelopeSourceV133,heightScale,battingSetupV94.stanceOffsetZ):undefined;
  let envelopeV133=authoredEnvelopeV133&&swingOffered?authoredEnvelopeV133:undefined;
  const intendedPullAngleDegrees=battingDirectionV149?(battingDirectionV149.direction.pullAngleDegrees??undefined)
    :intentV122?(intentV122.direction.pullAngleDegrees??undefined):directionIntent?.pullAngleDegrees??b.pullAngleDegrees,
    reactiveMotorV161=input.battingDirectionRequestV149?.mode==='AUTO'&&battingDirectionV149?.direction.kind==='REACTIVE',
    directionMotorReasonV153=!swingOffered?'NO_SWING':input.batting==='bunt'?'BUNT_MOTOR':intendedPullAngleDegrees===undefined&&!reactiveMotorV161?'REACTIVE_NO_ANGLE_TARGET'
      :!rawForecastV151?.prediction?'NO_OBSERVED_VELOCITY':spinMotionV123?'QUALIFIED_SPIN_MOTOR_OWNS_REGISTRATION':null,
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
    probeVelocity=probe.sampleAtSourceTick(sourceContactTick,'outgoing').sweetSpotVelocity,
    adjustedProbe=impactTrajectory===undefined?probe:createReferenceBatKinematicsV1(withReferenceImpactTrajectoryV1(probeInput,sourceContactTick,impactTrajectory));
  let rate=b.swingRate*controlFactor;
  if(b.targetSweetSpotSpeedMps!==undefined){assert(norm(probeVelocity)>1e-9,'measured reference has no finite contact speed');rate*=b.targetSweetSpotSpeedMps/norm(probeVelocity);}
  const batCapacityV121=b.batSwingCapacityV121===undefined?null:evaluateBatSwingCapacityV121({maximumSweetSpotSpeedMps:b.maximumSweetSpotSpeedMps??45,
    bat:{lengthM:b.batLengthM,massKg:b.batMassKg,sweetSpotT:b.sweetSpotT??(b.batLengthM-.1524)/b.batLengthM},model:b.batSwingCapacityV121}),
    effectiveMaximumSpeedV121=batCapacityV121?.effectiveMaxSweetSpotSpeedMps??b.maximumSweetSpotSpeedMps;
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
  const directionPredictionV153=directionMotorActiveV153?createDirectionMotorPredictionV153({rawPrediction:rawForecastV151!.prediction,
    perceivedPosition:motorAimPosition,perceivedArrivalSeconds:prediction.elapsedSeconds,originTick:input.originTick,ticksPerSecond:tps,availableTick:observationTick}):null,
    nominalRegistrationsV153=new Map<number,ReturnType<typeof planObservedDirectionRegistrationV153>|ReturnType<typeof planObservedReactiveRegistrationV161>>(),
    nominalInputsV154=new Map<number,ObservedDirectionRegistrationInputV153|ObservedReactiveRegistrationInputV161>();
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
      registration='desiredFieldAngleDegrees' in nominalInputV154?planObservedDirectionRegistrationV153(nominalInputV154):planObservedReactiveRegistrationV161(nominalInputV154);
    nominalInputsV154.set(candidateRate,nominalInputV154);
    nominalRegistrationsV153.set(candidateRate,registration);return registration;
  };
  const buildReferenceAtRate=(rate:number)=>{
  const nominalRegistrationV153=nominalRegistrationAtRateV153(rate),nominalReferenceV153=nominalRegistrationV153?.reference;
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
    composedV238=observedSpinComposeV238?.status==='APPLIED'?composeLiveObservedSpinAimV238(nominalSweetSpotV153??motorAimPosition,observedSpinComposeV238):null,
    intendedCenterV123=composedV238&&!composedV238.normalPathRetained?(nominalSweetSpotV153?add(composedV238.center,aimError):spinMotionV123?add(add(composedV238.center,aimError),{x:-(b.bats==='R'?1:-1)*spinMotionV123.contactOffsetMeters.pull,
    y:spinMotionV123.contactOffsetMeters.up,z:spinMotionV123.contactOffsetMeters.depth}):add(composedV238.center,aimError)):observedSpinTrialV236?.status==='APPLIED'?add(observedSpinTrialV236.aimedContact,aimError):nominalSweetSpotV153?add(nominalSweetSpotV153,aimError):spinMotionV123?add(add(motorAimPosition,aimError),{x:-(b.bats==='R'?1:-1)*spinMotionV123.contactOffsetMeters.pull,
    y:spinMotionV123.contactOffsetMeters.up,z:spinMotionV123.contactOffsetMeters.depth}):add(motorAimPosition,aimError);
  const translatedReference={...referenceInput,transform:{...referenceInput.transform,translation:sub(intendedCenterV123,point)}};
  let impactReference=impactTrajectory===undefined?translatedReference:withReferenceImpactTrajectoryV1(translatedReference,sourceContactTick,impactTrajectory);
  const saturationV153=nominalReferenceV153?limitDirectionExecutionV153(impactReference,{
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
  const uncorrectedReference=createReferenceBatKinematicsV1(impactReference),headroom=b.plateVision===undefined?0:lateEvidenceHeadroomV121(resolveLivePlateVisionV1(b));
  let lateEvidenceV121=headroom===0||!swingOffered||input.batting==='bunt'||observedSpinTrialV236?.status==='APPLIED'?null:(()=>{
    const throughTick=Math.floor(referenceContactTick),throughTime=(throughTick-input.originTick)/tps,
      observedTime=decisionTime+Math.max(0,(positionObserverV151?Math.min(prediction.elapsedSeconds,throughTime):Math.min(horizon,prediction.elapsedSeconds,throughTime))-decisionTime)*headroom/2,
      availableTick=positionObserverV151?quantizeEventTick(input.originTick,observedTime,tps):input.originTick+Math.ceil(observedTime*tps),
      correctionFromTick=Math.max(availableTick,actualStartTick),duration=(throughTick-correctionFromTick)/tps,
      prefixThroughV151=Math.min((availableTick-input.originTick)/tps,horizon),
      // The baseline and corrected bat have the same prefix before this cutoff.
      // If contact already closed that prefix, no later free-flight sample is observed.
      prefixContactV151=positionObserverV151?firstContact(kernel,seconds=>measureRigidBatBallSurfaceSeparation(
        kernel.evaluateAt(seconds,'incoming').moment.ball,createRigidBatStateFromBatterSwingState(
          uncorrectedReference.sampleContinuous(input.originTick+seconds*tps).state,batPhysical),ballPhysical),
        uncorrectedReference.maximumGripSpeedMps+uncorrectedReference.maximumAngularSpeedRadPerSecond*b.batLengthM,prefixThroughV151):null,
      lateRawForecastV151=positionObserverV151&&!prefixContactV151&&(availableTick-input.originTick)/tps<=horizon?positionObserverV151.forecastAt(availableTick):null,
      latePrediction=positionObserverV151?{ball:{position:lateRawForecastV151?.prediction?.position??prediction.ball.position}}
        :predictFromObservation(kernel.evaluateAt(observedTime),observedTime,battingSetupV94.contactPlaneZ),
      earlyEvidence={predictionId:'release-observation-v121',observedTick:observationTick,availableTick:observationTick,position:prediction.ball.position},
      lateObservedTick=positionObserverV151?(lateRawForecastV151?.status==='PREDICTED'?lateRawForecastV151.observedThroughTick!:observationTick)
        :input.originTick+Math.round(observedTime*tps),
      evidence=selectPredictionAt(lateObservedTick>observationTick?[earlyEvidence,{predictionId:'late-observation-v121',observedTick:lateObservedTick,availableTick,position:latePrediction.ball.position}]:[earlyEvidence],correctionFromTick)!,
      requestedOffset=sub(evidence.position,prediction.ball.position),distance=norm(requestedOffset),
      budget=effectiveMaximumSpeedV121===undefined?0:Math.max(0,Math.min(uncorrectedReference.maximumGripSpeedMps,effectiveMaximumSpeedV121-uncorrectedReference.maximumSweetSpotSpeedMps))*(swingIntentV121?.controlPriority??1),
      accelerationBudget=executionV122?Math.max(0,Math.min(executionV122.maximumGripAccelerationMps2-referenceAccelerationBoundsV122(uncorrectedReference).maximumGripAccelerationMps2,
        executionV122.maximumSweetSpotAccelerationMps2-referenceAccelerationBoundsV122(uncorrectedReference).maximumSweetSpotAccelerationMps2)):Infinity,
      scale=duration>0&&distance>1e-9?Math.min(headroom,budget*duration/(1.5*distance),executionV122?executionV122.maximumCorrectionMeters/distance:Infinity,accelerationBudget*duration*duration/(6*distance)):0,
      offset=mul(requestedOffset,scale),applied=scale>0&&norm(offset)<=3;
    return {headroom,observedTick:lateObservedTick,availableTick,correctionFromTick,throughTick:Math.max(correctionFromTick,throughTick),selectedPredictionId:evidence.predictionId,
      contactPlaneZ:battingSetupV94.contactPlaneZ,requestedOffset,offset:applied?offset:zero(),applied,maximumCorrectionSpeedMps:budget,
      futureSourceUsed:false as const,decisionOrContactDepthForced:false as const,
      ...(positionObserverV151?{rawForecast:lateRawForecastV151,prefixClosedBeforeObservation:prefixContactV151!==null,
        prefixSearchedThroughElapsedSeconds:prefixThroughV151}:{}),
      deliveryModel:positionObserverV151?'POSITION_ONLY_DELIVERED_OBSERVATIONS_V151' as const:'LEGACY_INSTANT_SAMPLE_NO_INVENTED_MILLISECOND_GAIN' as const};
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
  return {plannedStartTick,actualStartTick,motorDelaySeconds,referenceInput,referenceContactTick,lateEvidenceV121,registeredReference,reference,aimScaleV133,composedV238,
    executionSaturationV153:saturationV153?{temporalScale:saturationV153.temporalScale,holdStartTick:saturationV153.holdStartTick,
      executedStartTick:actualStartTick,nominalPlaybackRate:rate,executedPlaybackRate:referenceInput.playbackRate,
      spatialErrorRetained:true as const,ballRetargeted:false as const}:null};
  };
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
    if(!envelopeRateV133){
      const error=new Error('live pitch: 有限候補で実行可能な準備・回復を確認できません。準備・回復の時間を延ばすか、姿勢の移動量を小さくしてください。全速度での不可能判定ではありません。');
      if(directionMotorActiveV153){
        // These are owned nominal inputs/results already computed above. This
        // failure sidecar has no actual World kernel, spin or contact outcome.
        const immutable=<T>(value:T):T=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){
          Object.values(value).forEach(immutable);Object.freeze(value);}return value;};
        Object.defineProperty(error,'directionMotorDiagnosticsV154',{value:immutable({version:'live_direction_motor_failure_v154' as const,
          decisionTick:observationTick,clipId:clip.id,sourceSha256:clip.source.sha256,planningContactTimeSeconds:planningContactTime,
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
  const finalNominalReferenceV153=nominalRegistrationAtRateV153(rate)?.reference;
  if(finalNominalReferenceV153)selectedFrames=[...finalNominalReferenceV153.frames];
  const {plannedStartTick,motorDelaySeconds,referenceInput,referenceContactTick,lateEvidenceV121,registeredReference,reference,aimScaleV133,composedV238,executionSaturationV153}=buildReferenceAtRate(rate);
  assert(effectiveMaximumSpeedV121===undefined||reference.maximumSweetSpotSpeedMps<=effectiveMaximumSpeedV121*(1+1e-10),'adjusted reference exceeds declared motor ceiling');
  const executionBoundsV122=executionV122&&input.batting!=='bunt'?referenceAccelerationBoundsV122(reference):undefined;
  if(executionBoundsV122)assert(referenceRateScaleV122(reference,executionV122!)>=1-1e-9,'C1実行軌道が加速度上限を超えています。');
  const held=authoredEnvelopeV133?sampleAuthoredBatEnvelopePoseV133(authoredEnvelopeV133.preparation,b.batLengthM,sweetSpotT,input.originTick,selectedFrames[0].tick)
    :reference.sampleContinuous(input.batting==='bunt'?referenceContactTick:input.originTick),
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
  // A catcher's forecast must include a possible pitch bounce. This is a
  // separate prediction from the observed state; it never replaces the
  // released Source used by collision, spin, clock or rendering.
  const catcherForecast=createSourceFreeBallKernel({...descriptor,initial:observedSample.moment,
    ...(observedSample.materialOrientation?{materialOrientationAtStart:observedSample.materialOrientation}:{})}),
    catcherForecastTime=crossing(catcherForecast,-.85);
  assert(catcherForecastTime!==null,'catcher forecast did not reach its finite plane');
  const catcherPrediction={elapsedSeconds:catcherForecastTime,ball:catcherForecast.evaluateAt(catcherForecastTime).moment.ball},
    catcherRecognition=recognizeZoneV87({role:'catcher',profile:catcher.zoneRecognitionV87,position:catcherPrediction.ball.position,zone,
      seed:randomStreamsV152?.seedFor('catcherPerception','capture-recognition-v87')??input.seed,
      sourceTick:input.originTick+Math.round(catcherObservationTime*tps),observationTick:input.originTick+Math.round(catcherObservationTime*tps),
      planeZ:-.85,standardDeviationMeters:Math.min(.6,(catcher.defensiveDecisionSeconds??0)*.1),abilityBasis:'defensiveDecisionSeconds_authored_forecast_uncertainty',reason:'own_current_observed_forecast_at_capture_plane'}),
    catcherStart={x:0,y:middle,z:-.85},body={x:0,y:.8,z:-1.2},reach=catcher.gloveReachMeters,
    catcherTarget={...catcherRecognition.position,z:-.85};
  catcherTarget.y=Math.max(catcher.gloveRadiusMeters,catcherTarget.y);
  const planarReach=Math.sqrt(reach*reach-(catcherTarget.z-body.z)**2),fromBody={x:catcherTarget.x-body.x,y:catcherTarget.y-body.y,z:0};
  if(norm(fromBody)>planarReach){const constrained=add(body,mul(fromBody,planarReach/norm(fromBody)));catcherTarget.x=constrained.x;catcherTarget.y=constrained.y;}
  const moveStart=catcherObservationTime,moveEnd=Math.max(moveStart+.025,catcherPrediction.elapsedSeconds-.025),moveDuration=moveEnd-moveStart,
    delta=sub(catcherTarget,catcherStart),distance=norm(delta),maximumGloveSpeedMps=catcher.gloveSpeedMps;
  if(distance>maximumGloveSpeedMps*moveDuration/1.5){const limited=add(catcherStart,mul(delta,maximumGloveSpeedMps*moveDuration/1.5/distance));catcherTarget.x=limited.x;catcherTarget.y=limited.y;}
  const finalDelta=sub(catcherTarget,catcherStart),gloveAt=(seconds:number)=>{
    const u=clamp((seconds-moveStart)/moveDuration,0,1),smooth=u*u*(3-2*u),ds=seconds>moveStart&&seconds<moveEnd?6*u*(1-u)/moveDuration:0;
    return {position:add(catcherStart,mul(finalDelta,smooth)),velocity:mul(finalDelta,ds)};
  };
  const catcherHit=firstContact(kernel,t=>norm(sub(kernel.evaluateAt(t,'incoming').moment.ball.position,gloveAt(t).position))-catcher.gloveRadiusMeters-ballPhysical.radiusM,
      maximumGloveSpeedMps,horizon),catcherAt=catcherHit?.kind==='hit'?catcherHit.at:Math.min(horizon,catchPlaneTime+.05),
    batHit=firstContact(kernel,t=>measureRigidBatBallSurfaceSeparation(kernel.evaluateAt(t,'incoming').moment.ball,rigidAt(t),ballPhysical),batBound,catcherAt),
    officialStrikeZoneContactV94=swingOffered?null:findSourceStrikeZoneContactV94({kernel,volume:battingSetupV94.volume,ballRadiusMeters:ballPhysical.radiusM,
      throughElapsedSeconds:batHit?.kind==='hit'?Math.min(catcherAt,batHit.at):batHit?.kind==='unresolved'?Math.min(catcherAt,batHit.from):catcherAt});
  let contact:RigidBatBallContactResult|null=null,contactMoment:BallWorldMoment|null=null,contactOrientation:Quaternion|null=null,
    call:'ball'|'called_strike'|'swinging_strike'|null=null,endElapsedSeconds=catcherAt,secureTick:number|null=null,unsupportedReason:string|null=null;
  if(batHit?.kind==='unresolved'){unsupportedReason='bat_contact_refinement_required';endElapsedSeconds=batHit.from;}
  else if(batHit?.kind==='hit'){
    const at=kernel.evaluateAt(batHit.at,'incoming');contact=resolveWoodBatSpeedProfileBallContact(at.moment.ball,rigidAt(batHit.at),ballPhysical,NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1);
    if(contact){contactMoment=at.moment;contactOrientation=at.materialOrientation??at.orientation;endElapsedSeconds=batHit.at;}
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
      if(!swingOffered&&officialStrikeZoneContactV94?.kind==='unresolved')unsupportedReason='strike_zone_contact_refinement_required';
      else call=swingOffered?'swinging_strike':officialStrikeZoneContactV94?.kind==='hit'?'called_strike':'ball';
    }else unsupportedReason='catcher_retention_failed_live_ball_requires_successor';
  }else unsupportedReason='catcher_missed_live_ball_requires_successor';
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
        orientation:sample.materialOrientation??sample.orientation,visible:!owned,possessedBy:owned?'catcher':null},bat:input.originTick+seconds*tps<=referenceThroughTick?{...bat,radiusProfile}:null};
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
    nominalPlanForRecordV153=nominalPlanV153?{...nominalPlanV153,candidates:nominalPlanV153.candidates.map(candidate=>{
      if(!candidate.certificates)return candidate;
      const {intervalCertificatesV154:_failureDetail,...certificates}=candidate.certificates;
      return {...candidate,certificates};
    })}:null;
  return {frames,contact,contactMoment,contactOrientation,call,endedAtTick,clipId:clip.id,pitchType,
    ...(selectedSnapshot?{pitchId:selectedSnapshot.pitchId,pitchName:selectedSnapshot.name}:{}),speedKmh:(pitchWorkloadV122?norm(initial.velocity):speed)*3.6,sampleBatAtTick,
    diagnostics:{authority:'LOCAL_CORE_PHYSICAL_EXPERIMENT_V1' as const,nativeAdmission:false as const,sourceDescriptor:descriptor,
      battingSetupV94,strikeZoneVolumeV94:battingSetupV94.volume,strikeZone:zone,officialStrikeZoneContactV94,
      ...(input.pitchCommandObservationV155?{pitchCommandObservationV155:{version:'live_pitch_command_observation_v155' as const,
        requestedTarget:{...target},selectedTarget:{...selectedTarget},commandedTarget:{...commanded},
        nominalReleaseVelocity:nominalReleaseVelocityV155!,executedReleaseVelocity:{...initial.velocity},
        inverseCompensationBasis:'INTENDED_SPIN_MEAN_AIR_EXCLUDES_UNANTICIPATED_SEAM' as const,postReleaseExecutionReaimed:false as const}}:{}),
      ...(observedSpinComposeV238?{observedSpinComposeV238:{...observedSpinComposeV238,...(observedSpinComposeV238.status==='APPLIED'?{status:'PLANNED' as const,registration:{preErrorDelta:composedV238!.preErrorDelta,normalPathRetained:composedV238!.normalPathRetained,
        actualExecutionDelta:null,actualExecutionDeltaReason:'MATCHED_NORMAL_RUN_REQUIRED' as const,finalExecutionPosition:reference.sampleContinuous(referenceContactTick).sweetSpot,
        executedContactTick:referenceContactTick,lateCorrection:lateEvidenceV121?.offset??null,clipId:clip.id,sourceSha256:clip.source.sha256}}:{})}}:{}),
      ...(observedSpinTrialV236?{observedSpinTrialV236:{...observedSpinTrialV236,...(observedSpinTrialV236.status==='APPLIED'?{registration:{clipId:clip.id,sourceSha256:clip.source.sha256,plannedContactTick:observedSpinTrialV236.contactTick,executedContactTick:referenceContactTick,executedSweetSpot:reference.sampleContinuous(referenceContactTick).sweetSpot,executionError:aimError,technicalTimingOffsetSeconds:b.technicalTimingOffsetSeconds??0,motorDelaySeconds,lateReaimed:false as const}}:{})}}:{}),
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
      swingOffered,sweetSpotT,playbackRate:directionMotorActiveV153?referenceInput.playbackRate:rate,referenceStartTick:referenceInput.startTick,referenceThroughTick,predictionMadeAtElapsedSeconds:decisionTime,
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

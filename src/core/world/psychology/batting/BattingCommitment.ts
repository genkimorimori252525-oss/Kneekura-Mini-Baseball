import { planBattingMotorV1, type BattingMotorPlanInputV1 } from './BattingMotorPlanV1';
import { calculateObservedSpinAimTrialV226, type ObservedSpinAimTrialInputV226 } from './ObservedSpinAimTrialV226';
import { calculateObservedSpinMotorPlanV123, readSpinMotorContextV123, type SpinMotorContextV123, type SpinMotorPlanV123 } from './SpinMotorPlanV123';
import type { EmotionResult } from '../EmotionTypes';
import { attempt, integer, obj, fail, text } from '../EmotionValidation';
import { cloneExecutionData } from '../execution/ExecutionValidation';
import type { BattingCommitment, BattingExecutionProposal, BattingExecutionRequest, BattingSource, BattingRepertoireValues } from './BattingTypes';
import { readBattingRequest, readBattingDecisionValues, readBattingRepertoireValues, numberValue } from './BattingValidation';
import { selectPredictionAt } from './BattingTiming';

export type BattingExecutionValues = Readonly<{
 decision: BattingSource['decisionModel'];
 motor: Pick<BattingSource,'motorLatencyTicks'|'technicalTimingOffsetTicks'|'maximumSweetSpotSpeedMps'>;
 repertoire: BattingRepertoireValues;
}>;
export type BattingExecutionCalculationInput = Readonly<{ nominalRequest: BattingExecutionRequest; effectiveValues: BattingExecutionValues }>;
export type BattingExecutionCalculation = BattingExecutionCalculationInput & Readonly<{
 algorithm: 'batting-execution-calculation-v1'; scheduledTick: number;
 status: BattingExecutionProposal['status']; commitment: BattingCommitment | null;
}>;
function nominalValues(s:BattingSource):BattingExecutionValues {
 return {decision:s.decisionModel,motor:{motorLatencyTicks:s.motorLatencyTicks,technicalTimingOffsetTicks:s.technicalTimingOffsetTicks,
  maximumSweetSpotSpeedMps:s.maximumSweetSpotSpeedMps},repertoire:{repertoireId:s.repertoireId,repertoireVersion:s.repertoireVersion,profiles:s.profiles,
   ...(Object.hasOwn(s,'sampledProfiles')?{sampledProfiles:s.sampledProfiles}:{})}};
}
function readValues(raw:unknown):BattingExecutionValues {
 const p='batting.effectiveValues',v=obj(raw,['decision','motor','repertoire'],p);
 const motor=obj(v.motor,['motorLatencyTicks','technicalTimingOffsetTicks','maximumSweetSpotSpeedMps'],p+'.motor');
 if(integer(motor.motorLatencyTicks,p+'.motor.motorLatencyTicks')===0)fail('INVALID_INPUT',p+'.motor.motorLatencyTicks');
 integer(motor.technicalTimingOffsetTicks,p+'.motor.technicalTimingOffsetTicks',true);
 numberValue(motor.maximumSweetSpotSpeedMps,p+'.motor.maximumSweetSpotSpeedMps',true);
 const decision=readBattingDecisionValues(v.decision,p+'.decision'),repertoire=readBattingRepertoireValues(v.repertoire,p+'.repertoire');
 // Effective parameter IDs retain the independently accepted model-value domain.
 for(const id of [decision.modelId,decision.version,repertoire.repertoireId,repertoire.repertoireVersion,
  ...repertoire.profiles.flatMap(row=>[row.profile.profileId,row.profile.version])]) {
  if(id!==id.trim())fail('INVALID_INPUT',p+'.parameterIdentity');
 }
 return {decision,motor:motor as BattingExecutionValues['motor'],repertoire};
}
/** Commit using observer predictions only; actual pitch geometry cannot enter this calculation.
 * Effective values are separate arguments: never an altered v1 Source or owner claim. */
type TrialResultV226 = Extract<ReturnType<typeof calculateObservedSpinAimTrialV226>, {ok:true}>['value'];
type TrialContextV226 = Omit<ObservedSpinAimTrialInputV226,'version'|'base'>;
type TrialResolverV226 = (input:BattingMotorPlanInputV1)=>ReturnType<typeof calculateObservedSpinAimTrialV226>;
function calculate(request:BattingExecutionRequest,values:BattingExecutionValues,spinContext?:SpinMotorContextV123,trialResolver?:TrialResolverV226):
 Pick<BattingExecutionProposal,'scheduledTick'|'status'|'commitment'> & Readonly<{spinMotorPlanV123?:SpinMotorPlanV123;observedSpinAimTrialV226?:TrialResultV226['trace']}> {
  if(spinContext&&trialResolver)fail('INVALID_INPUT','batting.ambiguousSpinTrial');
  const s=request.source,accepted=request.acceptedExecution.proposal;
  const scheduled=accepted.inputs.swingDecision,now=request.currentFrame.time.tick;
  const shell={scheduledTick:scheduled.tick};
  if(scheduled.status==='MISSED_WINDOW')return {...shell,status:'MISSED_WINDOW',commitment:null};
  if(now!==scheduled.tick)return {...shell,status:now<scheduled.tick?'WAITING':'MISSED_COMMITMENT',commitment:null};
  const prediction=selectPredictionAt(s.predictions,now);
  if(s.directive!=='TAKE' && prediction===null)return {...shell,status:'NO_OBSERVATION',commitment:null};
  if(s.directive!=='TAKE' && prediction!.validUntilTick<now)return {...shell,status:'STALE_PREDICTION',commitment:null};
  const score=s.directive==='TAKE'?null:Math.max(0,Math.min(1,prediction!.swingScore+
   (accepted.inputs.swingAggression-accepted.request.baseline.swingAggression)*values.decision.aggressionWeight));
  const shouldSwing=s.directive==='SWING' || (s.directive==='AUTO' && score!>=values.decision.threshold);
  const base:BattingCommitment={action:shouldSwing?'SWING':'TAKE',decisionTick:now,predictionId:s.directive==='TAKE'?null:prediction!.predictionId,
   adjustedSwingScore:score,profileId:null,profileVersion:null,preferredStartTick:null,motorStartTick:null,motorDelayTicks:0,
   technicalTimingOffsetTicks:values.motor.technicalTimingOffsetTicks,trajectory:null};
  if(!shouldSwing)return {...shell,status:'READY',commitment:base};
  const motorInput={decisionTick:now,aggression:accepted.inputs.swingAggression,geometry:{handedness:s.handedness,
   centerOfMass:s.centerOfMass,batPhysical:s.batPhysical,plateZ:s.plateZ,strikeZone:s.strikeZone,
   bodyReadyTick:s.bodyReadyTick,latestMotorStartTick:s.latestMotorStartTick},
   motor:values.motor,repertoire:values.repertoire,forecast:{observedTick:prediction!.observedTick,
    availableTick:prediction!.availableTick,validUntilTick:prediction!.validUntilTick,trajectory:prediction!.trajectory}};
  const spin=spinContext?calculateObservedSpinMotorPlanV123({...spinContext,base:motorInput}):null;
  if(spin&&!spin.ok)fail(spin.reason.code,spin.reason.path);
  const trial=trialResolver?trialResolver(motorInput):null;if(trial&&!trial.ok)fail(trial.reason.code,trial.reason.path);
  const trace=spin?.ok?{spinMotorPlanV123:spin.value}:trial?.ok?{observedSpinAimTrialV226:trial.value.trace}:{},
    plan=spin?.ok?spin.value.plan:trial?.ok?trial.value.plan:planBattingMotorV1(motorInput);
  if(plan.status!=='READY')return {...shell,...trace,status:plan.status,commitment:null};
  return {...shell,...trace,status:'READY',commitment:{...base,...plan.motion}};
 }

/** Legacy shape, validation and results remain unchanged. */
export function prepareBattingExecution(input:unknown):EmotionResult<BattingExecutionProposal> {
 return attempt(()=>{
  const request=readBattingRequest(input);
  return {algorithm:'emotion-batting-consumer-v1' as const,request,...calculate(request,nominalValues(request.source))};
 });
}
/** Pure explicit execution seam. Native ownership and original intent/geometry admission are separate. */
export function calculateBattingExecution(input:unknown):EmotionResult<BattingExecutionCalculation> {
 return attempt(()=>{
  const raw=obj(cloneExecutionData(input,'batting.calculation'),['nominalRequest','effectiveValues'],'batting.calculation');
  const nominalRequest=readBattingRequest(raw.nominalRequest),effectiveValues=readValues(raw.effectiveValues);
  return {algorithm:'batting-execution-calculation-v1' as const,nominalRequest,effectiveValues,...calculate(nominalRequest,effectiveValues)};
 });
}
export type BattingSpinExecutionCalculationV123=BattingExecutionCalculationInput&Readonly<{
 algorithm:'batting-spin-execution-calculation-v123';spinContext:SpinMotorContextV123;spinMotorPlanV123:SpinMotorPlanV123|null;
 scheduledTick:number;status:BattingExecutionProposal['status'];commitment:BattingCommitment|null;
}>;
/** Explicit opt-in calculation only. The original v1 Source stays byte-exact.
 * Native adoption must bind the fixed skill/model references and recompute this
 * same calculation at commit/replay; this result alone grants no authority. */
export function calculateBattingSpinExecutionV123(input:unknown):EmotionResult<BattingSpinExecutionCalculationV123>{
 return attempt(()=>{
  const p='batting.spinCalculationV123',raw=obj(cloneExecutionData(input,p),['nominalRequest','effectiveValues','spinContext'],p);
  const nominalRequest=readBattingRequest(raw.nominalRequest),effectiveValues=readValues(raw.effectiveValues),
   spinContext=readSpinMotorContextV123(raw.spinContext,nominalRequest.currentFrame.time.tick,effectiveValues.repertoire.profiles.length),
   {spinMotorPlanV123=null,...result}=calculate(nominalRequest,effectiveValues,spinContext);
  return {algorithm:'batting-spin-execution-calculation-v123' as const,nominalRequest,effectiveValues,spinContext,spinMotorPlanV123,...result};
 });
}
export type BattingObservedSpinAimTrialCalculationV226=BattingExecutionCalculationInput&Readonly<{
 algorithm:'batting-observed-spin-aim-trial-v226';trialContext:TrialContextV226;observedSpinAimTrialV226:TrialResultV226['trace']|null;
 scheduledTick:number;status:BattingExecutionProposal['status'];commitment:BattingCommitment|null;
}>;
/** Explicit uncalibrated trial. It cannot grant a qualification or change a
 * TAKE decision; the normal score/decision path remains the sole SWING owner. */
export function calculateBattingObservedSpinAimTrialV226(input:unknown):EmotionResult<BattingObservedSpinAimTrialCalculationV226>{
 return attempt(()=>{
  const p='batting.spinAimCalculationV226',raw=obj(cloneExecutionData(input,p),['nominalRequest','effectiveValues','trialContext'],p),
   nominalRequest=readBattingRequest(raw.nominalRequest),effectiveValues=readValues(raw.effectiveValues),
   trial=obj(raw.trialContext,['selectedProfile','pair','transform','trace'],p+'.trialContext'),
   profile=obj(trial.selectedProfile,['profileId','version'],p+'.profile'),pair=obj(trial.pair,['anchor','target'],p+'.pair'),
   trace=obj(trial.trace,['sourceId','observationIds','cutoffTick','coordinateSystem'],p+'.trace');
  text(profile.profileId,p+'.profileId');text(profile.version,p+'.profileVersion');text(trace.sourceId,p+'.sourceId');
  const anchor=obj(pair.anchor,['x','y','z'],p+'.anchor'),target=obj(pair.target,['x','y','z'],p+'.target');
  for(const point of [anchor,target])for(const key of ['x','y','z'])numberValue(point[key],p+'.'+key);
  if(anchor.z!==target.z||trial.transform!=='PLATE_XY_TRANSLATION_V1'||trace.coordinateSystem!=='NATIVE_RBOX_METERS_V1'
   ||!Array.isArray(trace.observationIds)||trace.observationIds.length<1||trace.observationIds.length>3
   ||trace.observationIds.some(id=>typeof id!=='string'||!id.length||id!==id.trim())||new Set(trace.observationIds).size!==trace.observationIds.length
   ||integer(trace.cutoffTick,p+'.cutoffTick')>nominalRequest.currentFrame.time.tick)fail('INVALID_INPUT',p+'.trialContext');
  const trialContext=trial as unknown as TrialContextV226,
   {observedSpinAimTrialV226=null,...result}=calculate(nominalRequest,effectiveValues,undefined,
    base=>calculateObservedSpinAimTrialV226({version:'observed_spin_aim_trial_v226',base,...trialContext}));
  return {algorithm:'batting-observed-spin-aim-trial-v226' as const,nominalRequest,effectiveValues,trialContext,observedSpinAimTrialV226,...result};
 });
}
export { calculateBattingObservation } from './BattingObservationCalculation';

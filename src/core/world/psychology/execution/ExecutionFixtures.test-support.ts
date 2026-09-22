import { appraisalInput, change, value } from '../appraisal/AppraisalFixtures.test-support';
import { createEmotionState } from '../EmotionState';
import { zeroEffects } from '../EmotionFixtures.test-support';
import type { EmotionDecisionEffects, EmotionKind } from '../EmotionTypes';
import type { EmotionExecutionRequest, EmotionRunnerSource } from './ExecutionTypes';
export { change, value };
/** All values are synthetic test units. No calibrated production defaults. */
export function request(active: EmotionKind | null = null, effects: Partial<EmotionDecisionEffects> = {}): EmotionExecutionRequest {
 const a=change(appraisalInput(),d=>{
  d.model.importanceGain=0; d.model.impactTickScale=10000;
  for(const row of d.model.rows){ row.bias=row.emotion===active?1:0; row.stabilityDamping=0;
   for(const key in row.responseWeights)row.responseWeights[key]=0;
   for(const key in row.situationWeights)row.situationWeights[key]=0;
   row.effectsAtFullPressure=row.emotion===active?{...zeroEffects(),...effects}:zeroEffects(); }
 });
 const frame={scope:a.importance.scope,contextId:a.importance.contextId,snapshotId:'world-0',worldRevision:10,time:a.importance.time};
 return {executionId:'execution-1',frame,beforeEmotion:value(createEmotionState({scope:frame.scope,policy:a.policy})),appraisal:a,
  baseline:{basis:'WITHOUT_EMOTION',sourceId:'baseline-1',revision:2,frame,
   swingDecision:{tick:120,earliestTick:110,latestTick:150},throwIntent:{tick:140,earliestTick:125,latestTick:160},
   defenseReplan:{tick:150,earliestTick:145,latestTick:180},swingAggression:0.5,throwAggression:0.4,minimumAdvanceSafetyMarginTicks:100},
  model:{modelId:'synthetic-execution',version:'test-v1',runningRiskTicksPerUnit:100,maximumAdvanceSafetyMarginTicks:200},runner:null};
}
export function runnerSource(r: EmotionExecutionRequest): EmotionRunnerSource {
 return {sourceId:'runner-source',revision:3,frame:r.frame,decision:{runnerId:r.frame.scope.playerId,
  perceivedWorld:{observerId:r.frame.scope.playerId,observationTime:100,attention:{target:{kind:'base',base:2},focusedSinceTick:90},
   ball:null,players:[],communications:[],knownContext:{currentBase:1,nextBase:2,forcedToAdvance:false,tagUp:{kind:'none'}}},
  perceivedCues:[{kind:'next_base_race',observedAt:100,confidence:1,runnerArrivalTick:1800,defenderControlTick:1880}],
  minimumCueConfidence:0.5,coachTrust:1,minimumAdvanceSafetyMarginTicks:100,decisionAbility:1,
  timingParameters:{minimumDecisionDelayTicks:5,maximumDecisionDelayTicks:10,fixedRecognitionOffsetTicks:0}},
  body:{tick:100,routeDistanceMeters:0,speedMps:0,driveDirection:0,bodyMode:'upright'},
  parameters:{ticksPerSecond:1000,reactionDelayTicks:10,accelerationMps2:4,brakingMps2:5,slideDecelerationMps2:6,topSpeedMps:8},endTick:2100};
}

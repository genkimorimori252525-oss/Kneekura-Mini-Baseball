import type { EmotionDecisionEffects,EmotionResult } from '../EmotionTypes';
import { attempt,readAppraisal } from '../EmotionValidation';
import { RESPONSE_AXES,SITUATION_AXES,type AppraisalComputation } from './AppraisalTypes';
import { readAppraisalInput } from './AppraisalValidation';
import { computeImportance } from './MatchImportance';
const clamp=(n:number):number=>Math.min(1,Math.max(0,n));
/** Signed rounding is symmetric. These are simulation ticks, never animation frames. */
const ticks=(n:number,scale:number):number=>{const r=Math.sign(n)*Math.round(Math.abs(n)*scale);return r===0?0:r;};
function effectsAt(e:EmotionDecisionEffects,scale:number):EmotionDecisionEffects {
 return {swingDecisionShiftTicks:ticks(e.swingDecisionShiftTicks,scale),throwIntentShiftTicks:ticks(e.throwIntentShiftTicks,scale),
  defenseReplanShiftTicks:ticks(e.defenseReplanShiftTicks,scale),swingAggressionDelta:e.swingAggressionDelta*scale,
  throwAggressionDelta:e.throwAggressionDelta*scale,runningRiskDelta:e.runningRiskDelta*scale};
}
/** No production default: supplied versioned coefficients are calibration, not permanent emotional player ratings. */
export function appraiseEmotion(input:unknown):EmotionResult<AppraisalComputation> {
 return attempt(()=>{
  const request=readAppraisalInput(input),importance=computeImportance(request.importance),{event,player,model}=request;
  const situation={positiveSurprise:Math.max(0,event.perceivedOutcome-event.expectedOutcome),negativeSurprise:Math.max(0,event.expectedOutcome-event.perceivedOutcome),
   tacticalDeviation:event.tacticalDeviation,recentSuccess:event.recentSuccess,recentFailure:event.recentFailure,hostility:event.hostility,
   longTermStrain:player.longTermStrain,personalStake:importance.components.personal,localLeverage:event.localLeverage};
  const candidates=model.rows.map(row=>{
   const drive=row.bias+SITUATION_AXES.reduce((sum,k)=>sum+situation[k]*row.situationWeights[k],0)
    +RESPONSE_AXES.reduce((sum,k)=>sum+player.response[k]*row.responseWeights[k],0);
   const pressure=clamp(drive*(1+model.importanceGain*importance.value));
   const effects=effectsAt(row.effectsAtFullPressure,pressure*(1-player.response.stability*row.stabilityDamping));
   const behavioralImpact=clamp(Math.max(Math.abs(effects.swingDecisionShiftTicks)/model.impactTickScale,
    Math.abs(effects.throwIntentShiftTicks)/model.impactTickScale,Math.abs(effects.defenseReplanShiftTicks)/model.impactTickScale,
    Math.abs(effects.swingAggressionDelta),Math.abs(effects.throwAggressionDelta),Math.abs(effects.runningRiskDelta)));
   return {emotion:row.emotion,candidateId:JSON.stringify(['appraisal-candidate-v1',request.appraisalId,row.emotion]),pressure,behavioralImpact,effects};
  });
  const appraisal=readAppraisal({scope:request.importance.scope,policyRef:{policyId:request.policy.policyId,version:request.policy.version},
   appraisalId:request.appraisalId,contextId:request.importance.contextId,appraisalModelVersion:JSON.stringify([model.modelId,model.version]),
   sourceSnapshotId:request.bundleId,evidenceEventIds:request.evidenceEventIds,expectedRevision:request.expectedRevision,time:request.importance.time,candidates},'derivedAppraisal');
  return {importance,situation,appraisal,provenance:request};
 });
}

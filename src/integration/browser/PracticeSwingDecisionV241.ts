import type { forecastObservedPitchV151 } from '../../core/decision/batting/ObservedPitchForecastV151';

/** A practice instruction, not a skill, a contact guarantee, or a roster setting. */
export type PracticeSwingDecisionRequestV241 = Readonly<{
  version:'practice_swing_decision_v241';sourceId:string;scope:'EXPLICIT_PRACTICE';mode:'AUTO'|'SWING'|'TAKE';
}>;
type Forecast = ReturnType<typeof forecastObservedPitchV151>;
function assert(value:unknown,message:string):asserts value {if(!value)throw Error('practice swing decision v241: '+message);}
export function parsePracticeSwingDecisionV241(raw:unknown):PracticeSwingDecisionRequestV241 {
  assert(raw!==null&&typeof raw==='object'&&!Array.isArray(raw),'invalid request');
  const value=raw as Record<string,unknown>, keys=['version','sourceId','scope','mode'];
  assert(Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key))
    &&value.version==='practice_swing_decision_v241'&&value.scope==='EXPLICIT_PRACTICE'
    &&typeof value.sourceId==='string'&&value.sourceId.length>0&&value.sourceId.length<=150&&value.sourceId.trim()===value.sourceId
    &&(value.mode==='AUTO'||value.mode==='SWING'||value.mode==='TAKE'),'invalid request');
  return Object.freeze({version:value.version,sourceId:value.sourceId,scope:value.scope,mode:value.mode} as PracticeSwingDecisionRequestV241);
}

/** Only the intent offer is changed. The caller must still run the unchanged
 * timing, latency, error, speed and motor constraints on the resulting offer. */
export function resolvePracticeSwingDecisionV241(input:Readonly<{
  request:unknown;managedOffense:boolean;explicitPractice:boolean;batting:string;managerCommunicationPresent:boolean;
  baselineOffer:boolean;effort:number|null;currentForecast:Forecast|null;decisionCutoffTick:number;
}>) {
  const request=parsePracticeSwingDecisionV241(input.request);
  assert(input.managedOffense===true&&input.explicitPractice===true,'explicit managed practice required');
  assert(input.managerCommunicationPresent===false,'manager communication conflicts with practice decision');
  assert(typeof input.baselineOffer==='boolean'&&Number.isSafeInteger(input.decisionCutoffTick)&&input.decisionCutoffTick>=0
    &&(input.effort===null||Number.isFinite(input.effort)&&input.effort>=0),'invalid decision inputs');
  assert(!(request.mode==='SWING'&&input.batting==='take'),'swing conflicts with batting take');
  const f=input.currentForecast;
  const currentDelivered=f!==null&&f.status==='PREDICTED'&&f.prediction!==null&&f.cutoffTick===input.decisionCutoffTick
    &&f.availableAtTick!==null&&f.availableAtTick<=input.decisionCutoffTick&&f.observedThroughTick!==null
    &&f.observedThroughTick<=input.decisionCutoffTick&&f.usedObservationIds.length>=2;
  const blockedReason=request.mode!=='SWING'?null:!currentDelivered?'NO_CURRENT_DELIVERED_PREDICTION':input.effort===0?'ZERO_EFFORT':null;
  const offerAfterIntent=request.mode==='AUTO'?input.baselineOffer:request.mode==='TAKE'?false:blockedReason===null;
  return Object.freeze({request,baselineOffer:input.baselineOffer,offerAfterIntent,blockedReason,finalMotorAvailable:null});
}

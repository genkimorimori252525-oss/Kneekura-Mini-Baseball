import { EMOTIONS } from '../EmotionTypes';
import { fail,fraction,integer,list,obj,readEffects,readKind,readPolicy,readScope,same,text } from '../EmotionValidation';
import { RESPONSE_AXES,SITUATION_AXES,type AppraisalInput,type AppraisalRow } from './AppraisalTypes';
import { numbers,readImportance,readStamp } from './ImportanceValidation';
export function readAppraisalInput(input:unknown):AppraisalInput {
 const v=obj(input,['importance','appraisalId','bundleId','evidenceEventIds','expectedRevision','policy','player','event','model'],'appraisalInput');
 const importance=readImportance(v.importance),time=importance.time;
 const m=obj(v.model,['modelId','version','maxSourceAgeTicks','importanceGain','impactTickScale','rows'],'model');
 const modelId=text(m.modelId,'model.modelId'),version=text(m.version,'model.version');
 const maxSourceAgeTicks=integer(m.maxSourceAgeTicks,'model.maxSourceAgeTicks'),impactTickScale=integer(m.impactTickScale,'model.impactTickScale');
 if(impactTickScale===0)fail('INVALID_INPUT','model.impactTickScale');
 if(modelId===importance.model.modelId&&version===importance.model.version)fail('POLICY_MISMATCH','model.identity');
 const rows=list(m.rows,(input,p):AppraisalRow=>{
  const r=obj(input,['emotion','bias','situationWeights','responseWeights','stabilityDamping','effectsAtFullPressure'],p);
  return {emotion:readKind(r.emotion,p+'.emotion'),bias:fraction(r.bias,p+'.bias',true),
   situationWeights:numbers(r.situationWeights,SITUATION_AXES,p+'.situationWeights',true),
   responseWeights:numbers(r.responseWeights,RESPONSE_AXES,p+'.responseWeights',true),stabilityDamping:fraction(r.stabilityDamping,p+'.stabilityDamping'),
   effectsAtFullPressure:readEffects(r.effectsAtFullPressure,p+'.effectsAtFullPressure')};
 },'model.rows');
 if(rows.length!==EMOTIONS.length||new Set(rows.map(r=>r.emotion)).size!==EMOTIONS.length)fail('INVALID_INPUT','model.rows');
 rows.sort((a,b)=>a.emotion<b.emotion?-1:a.emotion>b.emotion?1:0);
 // A saturated comparison scale would make different timing effects tie at impact=1.
 for(const row of rows) for(const key of ['swingDecisionShiftTicks','throwIntentShiftTicks','defenseReplanShiftTicks'] as const)
  if(Math.abs(row.effectsAtFullPressure[key])>impactTickScale)fail('INVALID_INPUT','model.impactTickScale');
 const model={modelId,version,maxSourceAgeTicks,impactTickScale,importanceGain:fraction(m.importanceGain,'model.importanceGain'),rows};
 const p=obj(v.player,['stamp','scope','response','longTermStrain'],'player');
 const player={stamp:readStamp(p.stamp,'player.stamp',time,maxSourceAgeTicks),scope:readScope(p.scope,'player.scope'),
  response:numbers(p.response,RESPONSE_AXES,'player.response'),longTermStrain:fraction(p.longTermStrain,'player.longTermStrain')};
 const e=obj(v.event,['stamp','scope','contextId','eventId','expectedOutcome','perceivedOutcome','tacticalDeviation','localLeverage','recentSuccess','recentFailure','hostility'],'event');
 const event={stamp:readStamp(e.stamp,'event.stamp',time,maxSourceAgeTicks),scope:readScope(e.scope,'event.scope'),
  contextId:text(e.contextId,'event.contextId'),eventId:text(e.eventId,'event.eventId'),expectedOutcome:fraction(e.expectedOutcome,'event.expectedOutcome'),
  perceivedOutcome:fraction(e.perceivedOutcome,'event.perceivedOutcome'),tacticalDeviation:fraction(e.tacticalDeviation,'event.tacticalDeviation'),
  localLeverage:fraction(e.localLeverage,'event.localLeverage'),recentSuccess:fraction(e.recentSuccess,'event.recentSuccess'),
  recentFailure:fraction(e.recentFailure,'event.recentFailure'),hostility:fraction(e.hostility,'event.hostility')};
 if(!same(player.scope,importance.scope)||!same(event.scope,importance.scope)||event.contextId!==importance.contextId)fail('SCOPE_MISMATCH','appraisalInput');
 const stamps=[importance.competition.stamp,importance.personal.stamp,importance.rivalry.stamp,player.stamp,event.stamp];
 if(new Set(stamps.map(s=>s.sourceId)).size!==stamps.length)fail('INVALID_INPUT','appraisalInput.sourceIds');
 const evidenceEventIds=list(v.evidenceEventIds,text,'evidenceEventIds');
 if(!evidenceEventIds.includes(event.eventId)||new Set(evidenceEventIds).size!==evidenceEventIds.length)fail('INVALID_INPUT','evidenceEventIds');
 evidenceEventIds.sort();
 return {importance,appraisalId:text(v.appraisalId,'appraisalId'),bundleId:text(v.bundleId,'bundleId'),evidenceEventIds,
  expectedRevision:integer(v.expectedRevision,'expectedRevision'),policy:readPolicy(v.policy,'policy'),player,event,model};
}

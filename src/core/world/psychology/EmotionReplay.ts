import type { ActiveEmotion, EmotionEvaluationEvent, EmotionResult, EmotionState, EmotionTransition } from './EmotionTypes';
import { readState } from './EmotionState';
import { evaluateEmotion } from './EmotionGate';
import { attempt, fail, integer, list, obj, readAppraisal, readKind, readTime, same } from './EmotionValidation';
function readEvent(input: unknown, path: string): EmotionEvaluationEvent {
  const v=obj(input,['kind','request','beforeRevision','afterRevision','transition','active','calmObservations'],path);
  if(v.kind!=='EmotionEvaluated')fail('INVALID_INPUT',path+'.kind');
  const transitions:readonly string[]=['NONE','ACTIVATED','MAINTAINED','CHANGED','CLEARED'];
  if(typeof v.transition!=='string'||!transitions.includes(v.transition))fail('INVALID_INPUT',path+'.transition');
  let active:ActiveEmotion|null=null;
  if(v.active!==null){const a=obj(v.active,['emotion','activatedAt'],path+'.active');
    active={emotion:readKind(a.emotion,path+'.active.emotion'),activatedAt:readTime(a.activatedAt,path+'.active.activatedAt')};}
  return {kind:'EmotionEvaluated',request:readAppraisal(v.request,path+'.request'),
    beforeRevision:integer(v.beforeRevision,path+'.beforeRevision'),afterRevision:integer(v.afterRevision,path+'.afterRevision'),
    transition:v.transition as EmotionTransition,active,calmObservations:integer(v.calmObservations,path+'.calmObservations')};
}
/** Snapshot + accepted history only. Authenticity of external event/snapshot IDs remains a host responsibility. */
export function replayEmotionEvents(checkpoint: unknown, input: unknown): EmotionResult<EmotionState> {
  return attempt(() => {
    let state=readState(checkpoint);
    const events=list(input,readEvent,'events');
    const seen=new Set(state.lastAppraisal?[state.lastAppraisal.appraisalId]:[]);
    for(let i=0;i<events.length;i++) {
      const event=events[i];
      if(seen.has(event.request.appraisalId))fail('DUPLICATE_APPRAISAL','events['+i+'].request.appraisalId');
      seen.add(event.request.appraisalId);
      const result=evaluateEmotion(state,event.request);
      if(!result.ok)fail(result.reason.code,'events['+i+'].'+result.reason.path);
      if(!same(result.event,event))fail('REPLAY_MISMATCH','events['+i+']');
      state=result.state;
    }
    return state;
  });
}

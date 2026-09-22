import type { EmotionResult } from '../EmotionTypes';
import { attempt, fail, same } from '../EmotionValidation';
import { cloneExecutionData, safeTickSum } from '../execution/ExecutionValidation';
import type { FieldingExecutionProposal, FieldingAcceptance, FieldingStatus } from './FieldingTypes';
import { readFieldingRequest } from './FieldingValidation';
import { validateThrowSource, planEmotionThrow } from './EmotionThrowPlan';
import { validateReplanSource, planEmotionReplan } from './EmotionDefenseReplan';

/** Consume an already accepted gate at its scheduled event; never reappraise at the later tick. */
export function prepareFieldingExecution(input: unknown): EmotionResult<FieldingExecutionProposal> {
 return attempt(()=>{
  const request=readFieldingRequest(input),{source,currentFrame,acceptedExecution}=request;
  const scheduled=source.kind==='THROW'?acceptedExecution.proposal.inputs.throwIntent:acceptedExecution.proposal.inputs.defenseReplan;
  if(source.kind==='THROW')validateThrowSource(source);else validateReplanSource(source);
  const now=currentFrame.time.tick;
  const status:FieldingStatus=scheduled.status==='MISSED_WINDOW'?'MISSED_WINDOW':now<scheduled.tick?'WAITING':now>scheduled.tick?'MISSED_COMMITMENT':'READY';
  const outcome=status!=='READY'?{status,plan:null}:source.kind==='THROW'
   ?planEmotionThrow(source,scheduled.tick,acceptedExecution.proposal.inputs.throwAggression):planEmotionReplan(source,scheduled.tick);
  return {algorithm:'emotion-fielding-consumers-v1',request,scheduledTick:scheduled.tick,...outcome};
 });
}
/** Pure adoption proposal. The host must compare current frame/gate, atomically save and deduplicate actionKey. */
export function acceptFieldingExecution(input:unknown,proposalInput:unknown):EmotionResult<FieldingAcceptance> {
 return attempt(()=>{
  const computed=prepareFieldingExecution(input);if(!computed.ok)fail(computed.reason.code,computed.reason.path);
  const proposal=computed.value;
  if(!same(proposal,cloneExecutionData(proposalInput,'proposal')))fail('REPLAY_MISMATCH','fielding.proposal');
  if(proposal.status!=='READY' || proposal.plan===null)fail('INCONSISTENT_STATE','fielding.proposal.notReady');
  return {kind:'FieldingExecutionAccepted',expectedFrame:proposal.request.currentFrame,
   afterWorldRevision:safeTickSum(proposal.request.currentFrame.worldRevision,1,'fielding.acceptance'),
   emotionRevision:proposal.request.currentEmotion.revision,
   actionKey:JSON.stringify(['fielding-v1',proposal.request.currentFrame.scope,proposal.request.acceptedExecution.executionId,proposal.request.source.kind]),proposal};
 });
}

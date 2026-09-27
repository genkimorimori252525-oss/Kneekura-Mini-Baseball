import type { EmotionResult } from '../EmotionTypes';
import { evaluateEmotion } from '../EmotionGate';
import { getEmotionInfluence,restoreEmotionState } from '../EmotionState';
import { attempt,fail,same } from '../EmotionValidation';
import type { AppliedAppraisal } from './AppraisalTypes';
import { appraiseEmotion } from './SourceAppraisal';
/** Atomic pure proposal. Only influence, never an unselected candidate's offer, goes to an eventual executor. */
export function evaluateAppraisedEmotion(stateInput:unknown,input:unknown,socialCueInput?:unknown):EmotionResult<AppliedAppraisal> {
 return attempt(()=>{
  const parsed=restoreEmotionState(stateInput);if(!parsed.ok)fail(parsed.reason.code,parsed.reason.path);
  const computed=appraiseEmotion(input,socialCueInput);if(!computed.ok)fail(computed.reason.code,computed.reason.path);
  const state=parsed.value,computation=computed.value;
  if(!same(state.policy,computation.provenance.policy))fail('POLICY_MISMATCH','appraisalInput.policy');
  if(state.lastAppraisal?.sourceSnapshotId===computation.appraisal.sourceSnapshotId)fail('DUPLICATE_APPRAISAL','appraisalInput.bundleId');
  const evaluated=evaluateEmotion(state,computation.appraisal);if(!evaluated.ok)fail(evaluated.reason.code,evaluated.reason.path);
  const influence=getEmotionInfluence(evaluated.state);if(!influence.ok)fail(influence.reason.code,influence.reason.path);
  return {computation,state:evaluated.state,event:evaluated.event,influence:influence.value};
 });
}

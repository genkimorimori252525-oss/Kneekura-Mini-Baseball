import type { EmotionResult } from '../EmotionTypes';
import { attempt, fail, same } from '../EmotionValidation';
import type { EmotionExecutionAcceptance } from './ExecutionTypes';
import { cloneExecutionData, safeTickSum } from './ExecutionValidation';
import { prepareEmotionExecution } from './ExecutionPreparation';
/**
 * Recompute against the host's CURRENT coherent request; do not trust a saved proposal's effects.
 * Returns a CAS receipt and entire recomputed proposal, not a database write. The host must compare
 * expectedFrame + beforeEmotionRevision and persist this bundle atomically, once per executionId.
 */
export function acceptEmotionExecution(currentInput:unknown,proposalInput:unknown):EmotionResult<EmotionExecutionAcceptance> {
 return attempt(()=>{
  const current=prepareEmotionExecution(currentInput);if(!current.ok)fail(current.reason.code,current.reason.path);
  const proposal=current.value,submitted=cloneExecutionData(proposalInput,'proposal');
  if(!same(proposal,submitted))fail('REPLAY_MISMATCH','proposal.currentSourceOrComputedResult');
  return {kind:'EmotionExecutionAccepted',executionId:proposal.request.executionId,expectedFrame:proposal.request.frame,
   afterWorldRevision:safeTickSum(proposal.request.frame.worldRevision,1,'acceptance.worldRevision'),
   beforeEmotionRevision:proposal.request.beforeEmotion.revision,afterEmotionRevision:proposal.appraisal.state.revision,proposal};
 });
}

import type { EmotionResult } from '../EmotionTypes';
import { attempt, fail, obj, same } from '../EmotionValidation';
import { cloneExecutionData, safeTickSum } from '../execution/ExecutionValidation';
import { prepareBattingExecution } from './BattingCommitment';
import type { BattingAcceptance } from './BattingTypes';

/** This is an atomic-adoption proposal, not an exactly-once storage service. */
export function acceptBattingExecution(current:unknown,submitted:unknown):EmotionResult<BattingAcceptance> {
 return attempt(()=>{
  const computed=prepareBattingExecution(current);if(!computed.ok)fail(computed.reason.code,computed.reason.path);
  const proposal=computed.value;
  if(!same(proposal,cloneExecutionData(submitted,'batting.submitted')))fail('REPLAY_MISMATCH','batting.proposal');
  if(proposal.status!=='READY' || proposal.commitment===null)fail('INCONSISTENT_STATE','batting.notReady');
  const r=proposal.request,s=r.source;
  return {kind:'BattingCommitmentAccepted',expectedFrame:r.currentFrame,
   afterWorldRevision:safeTickSum(r.currentFrame.worldRevision,1,'batting.acceptance'),emotionRevision:r.currentEmotion.revision,
   actionKey:JSON.stringify(['batting-v1',r.currentFrame.scope,s.playId,s.pitchOrdinal,s.ballId]),proposal};
 });
}
/** Verify saved data by deterministic recomputation, without creating a new emotion event or a new decision. */
export function checkedBattingAcceptance(input:unknown):BattingAcceptance {
 const a=obj(input,['kind','expectedFrame','afterWorldRevision','emotionRevision','actionKey','proposal'],'batting.accepted');
 const p=obj(a.proposal,['algorithm','request','scheduledTick','status','commitment'],'batting.accepted.proposal');
 const checked=acceptBattingExecution(p.request,p);if(!checked.ok)fail(checked.reason.code,checked.reason.path);
 if(!same(a,checked.value))fail('REPLAY_MISMATCH','batting.accepted');return checked.value;
}

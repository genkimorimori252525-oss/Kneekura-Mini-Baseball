import { fail, integer, obj, same, text, compareTime } from '../EmotionValidation';
import { restoreEmotionState } from '../EmotionState';
import { acceptEmotionExecution } from '../execution/ExecutionAcceptance';
import { cloneExecutionData, readFrame } from '../execution/ExecutionValidation';
import type { FieldingExecutionRequest } from './FieldingTypes';

/** Recompute the old acceptance for integrity, then bind it to the host's CURRENT gate/frame.
 * This does not establish that a receipt was ever persisted: the host owns authenticity. */
export function readFieldingRequest(input: unknown): FieldingExecutionRequest {
 const copy=cloneExecutionData(input,'fielding');
 const v=obj(copy,['currentFrame','currentEmotion','acceptedExecution','source'],'fielding');
 const currentFrame=readFrame(v.currentFrame,'fielding.currentFrame');
 const receipt=obj(v.acceptedExecution,['kind','executionId','expectedFrame','afterWorldRevision',
  'beforeEmotionRevision','afterEmotionRevision','proposal'],'fielding.acceptedExecution');
 const prior=obj(receipt.proposal,['boundary','algorithmVersion','request','appraisal','inputs','runner'],'fielding.acceptedExecution.proposal');
 const checked=acceptEmotionExecution(prior.request,prior);
 if(!checked.ok)fail(checked.reason.code,checked.reason.path);
 if(!same(checked.value,receipt))fail('REPLAY_MISMATCH','fielding.acceptedExecution');
 const acceptedExecution=checked.value,old=acceptedExecution.expectedFrame;
 const restored=restoreEmotionState(v.currentEmotion);
 if(!restored.ok)fail(restored.reason.code,restored.reason.path);
 const currentEmotion=restored.value;
 if(!same(currentEmotion,acceptedExecution.proposal.appraisal.state))fail('STALE_REVISION','fielding.currentEmotion');
 if(!same(currentFrame.scope,old.scope))fail('SCOPE_MISMATCH','fielding.currentFrame.scope');
 if(currentFrame.contextId!==old.contextId)fail('INCONSISTENT_STATE','fielding.currentFrame.contextId');
 if(compareTime(currentFrame.time,old.time)<0 || currentFrame.worldRevision<acceptedExecution.afterWorldRevision)
  fail('STALE_REVISION','fielding.currentFrame');
 if(currentFrame.snapshotId===old.snapshotId)fail('INCONSISTENT_STATE','fielding.currentFrame.snapshotId');
 const raw=v.source;
 if(raw===null || typeof raw!=='object' || Array.isArray(raw))fail('INVALID_INPUT','fielding.source');
 const s=raw as Record<string,unknown>;
 if(s.kind!=='THROW' && s.kind!=='REPLAN')fail('INVALID_INPUT','fielding.source.kind');
 text(s.sourceId,'fielding.source.sourceId');integer(s.revision,'fielding.source.revision');
 if(!same(readFrame(s.frame,'fielding.source.frame'),currentFrame))fail('INCONSISTENT_STATE','fielding.source.frame');
 const observed=integer(s.observationTick,'fielding.source.observationTick');
 const until=integer(s.validUntilTick,'fielding.source.validUntilTick');
 if(observed>currentFrame.time.tick || until<currentFrame.time.tick)
  fail('INVALID_INPUT','fielding.source.observationOrValidity');
 return {currentFrame,currentEmotion,acceptedExecution,source:s as unknown as FieldingExecutionRequest['source']};
}

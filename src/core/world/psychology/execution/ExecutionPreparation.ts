import type { EmotionResult } from '../EmotionTypes';
import { restoreEmotionState } from '../EmotionState';
import { evaluateAppraisedEmotion } from '../appraisal/AppraisalGate';
import { attempt, fail, obj, same, text } from '../EmotionValidation';
import type { EmotionExecutionProposal, EmotionExecutionRequest } from './ExecutionTypes';
import { bindFrame, readBaseline, readFrame, readModel } from './ExecutionValidation';
import { consumeGateInputs } from './ExecutionInputs';
import { readRunnerSource } from './RunnerSourceValidation';
import { executeEmotionRunner } from './EmotionRunnerExecution';
/** Pure proposal: a new appraisal/gate state is NOT persisted merely by preparing a decision. */
export function prepareEmotionExecution(input: unknown): EmotionResult<EmotionExecutionProposal> {
 return attempt(()=>{
  const v=obj(input,['executionId','frame','beforeEmotion','appraisal','baseline','model','runner'],'request');
  const frame=readFrame(v.frame,'request.frame'),baseline=readBaseline(v.baseline,frame),model=readModel(v.model);
  const before=restoreEmotionState(v.beforeEmotion);if(!before.ok)fail(before.reason.code,before.reason.path);
  if(!same(before.value.scope,frame.scope))fail('SCOPE_MISMATCH','request.beforeEmotion.scope');
  const result=evaluateAppraisedEmotion(before.value,v.appraisal);if(!result.ok)fail(result.reason.code,result.reason.path);
  const a=result.value,source=a.computation.provenance;
  bindFrame(source.importance.scope,source.importance.contextId,source.importance.time,frame);
  const runner=readRunnerSource(v.runner,frame,baseline);
  const inputs=consumeGateInputs(frame,baseline,model,a.influence);
  const request:EmotionExecutionRequest={executionId:text(v.executionId,'request.executionId'),frame,beforeEmotion:before.value,
   appraisal:source,baseline,model,runner};
  return {boundary:'SINGLE_GATE_EXECUTION_PROPOSAL',algorithmVersion:'emotion-decision-consumer-v1',request,appraisal:a,
   inputs,runner:executeEmotionRunner(runner,inputs)};
 });
}

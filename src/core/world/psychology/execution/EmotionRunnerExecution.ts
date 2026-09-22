import { decideRunnerMotionIntent } from '../../../sim/running/RunnerDecision';
import { buildRunnerMotionTrajectory } from '../../../sim/running/RunnerMotion';
import { fail } from '../EmotionValidation';
import { cloneExecutionData } from './ExecutionValidation';
import type { EmotionDecisionInputs, EmotionRunnerExecution, EmotionRunnerSource } from './ExecutionTypes';
/** Existing decision and physical movement owners remain authoritative; this layer adds no runner AI or physics. */
export function executeEmotionRunner(source:EmotionRunnerSource|null,inputs:EmotionDecisionInputs):EmotionRunnerExecution|null {
 if(source===null)return null;
 const compute=()=>{
  const decision=decideRunnerMotionIntent({...source.decision,minimumAdvanceSafetyMarginTicks:inputs.minimumAdvanceSafetyMarginTicks});
  if(decision.decisionTick<source.frame.time.tick)throw new Error('decision would backdate the source frame');
  const trajectory=buildRunnerMotionTrajectory(source.body,decision.motionIntent,source.endTick-source.body.tick,source.parameters);
  return {decision,trajectory};
 };
 let result:EmotionRunnerExecution;
 try {result=compute();}catch(error){if(!(error instanceof Error))throw error;fail('INVALID_INPUT','request.runner.coreInputOrTiming');}
 // Guard against non-finite arithmetic from otherwise finite extreme physical inputs.
 return cloneExecutionData(result,'execution.runner') as EmotionRunnerExecution;
}

import type { EmotionInfluence } from '../EmotionTypes';
import { fail } from '../EmotionValidation';
import type { AppliedDecisionTiming, DecisionTimingWindow, EmotionDecisionInputs, EmotionFreeDecisionBaseline, ExecutionFrame, ExecutionModel } from './ExecutionTypes';
import { safeTickSum } from './ExecutionValidation';
const unit=(v:number):number=>Math.max(0,Math.min(1,v));
function timing(w:DecisionTimingWindow,shift:number,now:number):AppliedDecisionTiming {
 const requested=safeTickSum(w.tick,shift,'execution.timing');
 const lower=Math.max(w.earliestTick,now),tick=Math.max(lower,requested);
 return {tick,requestedShiftTicks:shift,appliedShiftTicks:tick-w.tick,constrainedByEarliest:tick!==requested,
  status:tick>w.latestTick?'MISSED_WINDOW':'READY'};
}
/** Does not change skills or sample a baseball outcome. Positive risk reduces demanded safety, not physical ability. */
export function consumeGateInputs(frame:ExecutionFrame,b:EmotionFreeDecisionBaseline,m:ExecutionModel,influence:EmotionInfluence):EmotionDecisionInputs {
 if(b.minimumAdvanceSafetyMarginTicks>m.maximumAdvanceSafetyMarginTicks)fail('INVALID_INPUT','request.baseline.minimumAdvanceSafetyMarginTicks');
 const e=influence.effects;
 const riskShift=(e?.runningRiskDelta??0)*m.runningRiskTicksPerUnit;
 const roundedRisk=Math.sign(riskShift)*Math.round(Math.abs(riskShift));
 const margin=Math.max(0,Math.min(m.maximumAdvanceSafetyMarginTicks,safeTickSum(b.minimumAdvanceSafetyMarginTicks,-roundedRisk,'execution.safetyMargin')));
 const swingAggression=unit(b.swingAggression+(e?.swingAggressionDelta??0));
 const throwAggression=unit(b.throwAggression+(e?.throwAggressionDelta??0));
 return {basis:'SINGLE_EMOTION_GATE_APPLIED',swingDecision:timing(b.swingDecision,e?.swingDecisionShiftTicks??0,frame.time.tick),
  throwIntent:timing(b.throwIntent,e?.throwIntentShiftTicks??0,frame.time.tick),defenseReplan:timing(b.defenseReplan,e?.defenseReplanShiftTicks??0,frame.time.tick),
  swingAggression,throwAggression,minimumAdvanceSafetyMarginTicks:margin,
  realized:{swingAggressionDelta:swingAggression-b.swingAggression,throwAggressionDelta:throwAggression-b.throwAggression,safetyMarginDeltaTicks:margin-b.minimumAdvanceSafetyMarginTicks}};
}

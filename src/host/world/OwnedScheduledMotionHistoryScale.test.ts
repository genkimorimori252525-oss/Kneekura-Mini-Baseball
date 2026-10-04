import { it, expect } from 'vitest';
import { acquiredHistory, fixture, historySource } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory.test-support';
import { deriveCanonicalWholePlayHistory, type WholePlayHistoryStep } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory';
import { prepareBattedWorldPiecewiseFieldAcquisition, deriveBattedWorldPiecewiseFieldAcquisitionProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import type { PiecewiseFieldMotionStep } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';

it('reads 300 valid retained owned capture checkpoints without an aggregate clone ceiling', () => {
 const f = fixture(), original = acquiredHistory(f), first = original.steps[0];
 if (first.kind !== 'motion') throw new Error('fixture');
 const plan = prepareBattedWorldPiecewiseFieldAcquisition({response:f.response,geometry:f.geometry,field:first.field});
 const steps:WholePlayHistoryStep[]=[first,{source:historySource(1),previousSourceId:null,kind:'owned_acquisition_plan_v1',basis:first.source,horizon:plan.contactMoment,plan}];
 const inputs:PiecewiseFieldMotionStep[]=[];
 const ids:string[]=[];
 for(let i=0;i<=300;i++) {
  const step:PiecewiseFieldMotionStep={actors:{kind:'retained'},throughElapsedSeconds:plan.contactMoment.elapsedSeconds+(plan.secureElapsedSeconds-plan.contactMoment.elapsedSeconds)*i/600};
  inputs.push(step);
  const progress=deriveBattedWorldPiecewiseFieldAcquisitionProgress({plan,steps:inputs});
  expect(progress.kind).toBe('capturing');
  const source=historySource(i+2);
  steps.push({source,previousSourceId:historySource(i+1).sourceId,kind:'owned_motion_v2',startCursor:null,mode:'retained',field:first.field,operation:{kind:'acquisition',planSourceId:historySource(1).sourceId,previousStepSourceIds:[...ids],step,bridge:null,plan,progress}});
  ids.push(source.sourceId);
  if(i===3) expect(deriveCanonicalWholePlayHistory({...original,steps}).horizon).toEqual(progress.world.moment);
 }
 expect(() => deriveCanonicalWholePlayHistory({...original,steps})).not.toThrow();
});

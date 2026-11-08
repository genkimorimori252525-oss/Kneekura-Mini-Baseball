import { expect,it } from 'vitest';
import { resolveLiveGloveTossCapabilityV110,planLiveTransferActionV110 } from './LiveGloveTossV110';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
const skill={reactionSeconds:.13,decisionSeconds:.035,advancedFielding:0,gloveSpeedMps:13,throwSpeedMps:42};
it('uses absolute internal timing or learned fielding technique, never a league display grade',()=>{
 expect(resolveLiveGloveTossCapabilityV110(skill)).toMatchObject({capacityMps:13});
 const slow={...skill,reactionSeconds:.5,decisionSeconds:.2};
 expect(resolveLiveGloveTossCapabilityV110(slow)).toBeUndefined();
 expect(resolveLiveGloveTossCapabilityV110({...slow,advancedFielding:.5})).toBeDefined();
 expect(resolveLiveGloveTossCapabilityV110({...slow,advancedFielding:1})!.buildSeconds)
  .toBeLessThan(resolveLiveGloveTossCapabilityV110({...slow,advancedFielding:.5})!.buildSeconds);
});
it('can solve a short glove feed without consuming the ordinary transfer, while a ready receiver keeps a strong hand throw',()=>{
 const normal={releasePosition:{x:0,y:1.7,z:0},bodyVelocity:{x:0,y:0,z:0},capacityMps:42,
  spin:{x:0,y:0,z:0},target:{x:0,y:1,z:8},remainingTransferSeconds:.8,handPreparationSeconds:.1,
  receiverReadySeconds:1.3,deadlineSeconds:2,preferStrongestFeasibleV103:true,
  physics:{kind:'aero_ground_v1' as const,air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
   ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,
    material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}}},
  actor={position:{x:0,y:1,z:0},velocity:{x:0,y:0,z:0},glovePosition:{x:0,y:1,z:.3},gloveVelocity:{x:0,y:0,z:0},
   gloveSpeedMps:13,gloveReachMeters:1.3,gloveTossV110:resolveLiveGloveTossCapabilityV110(skill)};
 const toss=planLiveTransferActionV110(normal,actor);
 expect(toss.kind).toBe('planned');if(toss.kind!=='planned')throw new Error('expected physical feed');
 expect(toss.releaseStyleV110).toBe('glove_toss');expect(toss.releaseDelaySeconds).toBeLessThan(.5);
 expect(toss.commandSpeedMps).toBeLessThanOrEqual(13);expect(toss.forecast.arrivalErrorMeters).toBeLessThanOrEqual(.02);
 const noHandPath=planLiveTransferActionV110(normal,actor,2,false);
 expect(noHandPath.kind).toBe('planned');expect(noHandPath.releaseStyleV110).toBe('glove_toss');
 const ready=planLiveTransferActionV110({...normal,receiverReadySeconds:0},actor);
 expect(ready.releaseStyleV110).toBe('hand_throw');
 const quickReady=planLiveTransferActionV110({...normal,receiverReadySeconds:0},actor,2,true,true);
 expect(quickReady.kind).toBe('planned');expect(quickReady.releaseStyleV110).toBe('glove_toss');
 if(quickReady.kind==='planned'&&ready.kind==='planned')expect(quickReady.controlSeconds).toBeLessThan(ready.controlSeconds);
});

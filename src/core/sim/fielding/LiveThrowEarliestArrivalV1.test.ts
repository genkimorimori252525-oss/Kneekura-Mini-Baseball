import {expect,it} from 'vitest';
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from '../ball/BaseballAerodynamics';
import {planLiveThrowActionV103,type LiveThrowActionInputV103} from './LiveThrowActionV103';
import {LIVE_FIELD_THROW_EARLIEST_ARRIVAL_POLICY_V1,validateLiveFieldThrowEarliestArrivalPolicyV1} from './LiveFieldRangeV1';

// A double-play feed: 10 m to the man on the bag, the runner a second away; the fielder's own transfer, hand and charge as in
// std-bundle3 (seed 7101 #60).
const feed=(distance:number,extra:Partial<LiveThrowActionInputV103>={}):LiveThrowActionInputV103=>({releasePosition:{x:0,y:1.2,z:0},bodyVelocity:{x:0,y:0,z:0},
  capacityMps:35,spin:{x:120,y:0,z:0},target:{x:0,y:1.2,z:distance},remainingTransferSeconds:.38,handPreparationSeconds:.219,throwEffortBuildSecondsV103:.36,
  deadlineSeconds:1.6,preferStrongestFeasibleV103:true,
  physics:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
    ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,
      material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}},...extra});
const arrival=(r:ReturnType<typeof planLiveThrowActionV103>)=>{if(r.kind!=='planned')throw new Error(r.reason);return r.releaseDelaySeconds+r.flightSeconds;};

it('sends a short feed softer and sooner than the strongest throw',()=>{
  const strongest=planLiveThrowActionV103(feed(10)),earliest=planLiveThrowActionV103(feed(10,{preferEarliestArrivalV1:true}));
  if(strongest.kind!=='planned'||earliest.kind!=='planned')throw new Error('planned throws expected');
  expect(earliest.commandSpeedMps).toBeLessThan(strongest.commandSpeedMps-3);
  expect(arrival(earliest)).toBeLessThan(arrival(strongest));
});

it('keeps a long throw near full strength, where speed is what gets it there first',()=>{
  const earliest=planLiveThrowActionV103(feed(40,{preferEarliestArrivalV1:true,deadlineSeconds:3}));
  if(earliest.kind!=='planned')throw new Error(earliest.reason);
  expect(earliest.commandSpeedMps).toBeGreaterThan(25);
});

it('takes only a whole policy',()=>{
  expect(validateLiveFieldThrowEarliestArrivalPolicyV1(LIVE_FIELD_THROW_EARLIEST_ARRIVAL_POLICY_V1)).toBe(LIVE_FIELD_THROW_EARLIEST_ARRIVAL_POLICY_V1);
  expect(()=>validateLiveFieldThrowEarliestArrivalPolicyV1({...LIVE_FIELD_THROW_EARLIEST_ARRIVAL_POLICY_V1,extra:1} as any)).toThrow();
});

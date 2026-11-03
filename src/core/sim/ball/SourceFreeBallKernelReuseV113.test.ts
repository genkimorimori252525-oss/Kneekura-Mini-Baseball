import {expect,it,vi} from 'vitest';
import * as air from '../pitching/AerodynamicPitchTrajectory';
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from './BaseballAerodynamics';
import {createSourceFreeBallKernel,type SourceFreeBallDescriptorV2} from './SourceFreeBallKernel';
it('reuses the same airborne cell endpoint for its floor check without changing the source samples',()=>{
 const d:SourceFreeBallDescriptorV2={kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:0,elapsedSeconds:0,
  ball:{tick:0,position:{x:0,y:3,z:0},velocity:{x:1,y:0,z:20},spin:{x:120,y:0,z:0}}},throughElapsedSeconds:.01,
  profile:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
   ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,
    material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}}};
 const expected=air.sampleAerodynamicPitchStateAtElapsedSeconds(d.initial.ball,.01,d.profile.air),
  spy=vi.spyOn(air,'sampleAerodynamicPitchStateAtElapsedSeconds');
 try{const kernel=createSourceFreeBallKernel(d);expect(spy).toHaveBeenCalledTimes(2);
  expect(kernel.evaluateAt(.01).moment.ball).toEqual(expected);expect(kernel.boundaries).toEqual([]);
 }finally{spy.mockRestore();}
});

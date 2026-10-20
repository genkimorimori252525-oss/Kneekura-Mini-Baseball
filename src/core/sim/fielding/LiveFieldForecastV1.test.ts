import { expect,it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { createLiveFieldForecastV1,type LiveFieldForecastInputV1 } from './LiveFieldForecastV1';
const input=():LiveFieldForecastInputV1=>({observation:{tick:1234567,position:{x:0,y:1,z:0},velocity:{x:0,y:24,z:17},spin:{x:-180,y:0,z:0}},
  physics:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
    ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,
      material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}}});
it('predicts a high fly fifty metres away with the same aero-ground model, beyond gravity-only extrapolation',()=>{
  const i=input(),before=JSON.stringify(i),forecast=createLiveFieldForecastV1(i),groundTime=forecast.diagnostics.groundContactElapsedSeconds[0];
  expect(groundTime).toBeGreaterThan(3);expect(groundTime).toBeLessThan(8);
  const landing=forecast.sampleAtElapsedSeconds(groundTime),gravityOnlyRange=17*(24+Math.sqrt(24**2+2*9.81))/9.81;
  expect(landing.position.z).toBeGreaterThan(35);expect(landing.position.z).toBeLessThan(85);
  expect(Math.abs(landing.position.z-gravityOnlyRange)).toBeGreaterThan(5);expect(landing.velocity.y).toBeGreaterThan(0);
  expect(forecast.basis).toBe('EXPLICIT_SENSOR_PREDICTION_MODEL');expect(forecast.diagnostics.actualSourceRead).toBe(false);
  expect(JSON.stringify(i)).toBe(before);
});
it('predicts a fast rolling ball and its observed reflected heading without reading a future actual Source',()=>{
  const i=input(),fast={...i,observation:{...i.observation,position:{x:10,y:.0366,z:25},velocity:{x:-25,y:0,z:12},spin:{x:12/.0366,y:0,z:25/.0366}}},
    f=createLiveFieldForecastV1(fast),sample=f.sampleAtElapsedSeconds(1.2);
  expect(sample.position.x).toBeLessThan(0);expect(sample.position.z).toBeGreaterThan(35);expect(sample.position.y).toBe(.0366);
  expect(Math.hypot(sample.velocity.x,sample.velocity.z)).toBeLessThan(Math.hypot(25,12));expect(sample.phase).toBe('rolling');
  expect(f.diagnostics.venueReflectionPrediction).toBe('NOT_AVAILABLE_WITHOUT_VENUE_GEOMETRY');
});
it('shares one observation kernel between all nine defenders and preserves exact continuous query results',()=>{
  const i=input(),f=createLiveFieldForecastV1(i),expected=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',
    initial:{originTick:i.observation.tick,elapsedSeconds:0,ball:i.observation},throughElapsedSeconds:8,profile:i.physics});
  for(let defender=0;defender<9;defender++)for(const seconds of [0,.123456789,1.2,3.7,8]){
    const sample=f.sampleAtElapsedSeconds(seconds),original=expected.evaluateAt(seconds);
    expect(sample).toEqual({...original.moment.ball,orientation:original.orientation,phase:original.phase});
  }
  const perf=f.readPerformance();expect(perf.kernelBuildCount).toBe(1);expect(perf.queries).toBe(45);
  expect(perf.buildWallMilliseconds).toBeGreaterThanOrEqual(0);expect(perf.sampleWallMilliseconds).toBeGreaterThanOrEqual(0);
  expect(perf.maximumSampledSpeedMps).toBeGreaterThan(0);
});
it('keeps prediction isolated from future mutations and rejects requests beyond its finite evidence-free hypothesis',()=>{
  const i=input(),f=createLiveFieldForecastV1(i),before=f.sampleAtElapsedSeconds(2);Object.assign(i.observation.velocity,{z:-100});
  expect(f.sampleAtElapsedSeconds(2)).toEqual(before);expect(()=>f.sampleAtElapsedSeconds(8.001)).toThrow(/finite prediction/);
  expect(()=>f.sampleAtElapsedSeconds(-1)).toThrow();expect(()=>createLiveFieldForecastV1({...input(),horizonSeconds:9})).toThrow();
  expect(()=>createLiveFieldForecastV1({...input(),futureActualSource:{}} as unknown as LiveFieldForecastInputV1)).toThrow(/observation/);
});
it('does not let an unobserved seam phase grant fielders perfect knowledge of a knuckling ball',()=>{
  const base=input(),observation={...base.observation,velocity:{x:0,y:2,z:24},spin:{x:0,y:0,z:3}},
    physics={...base.physics,air:{...base.physics.air,aerodynamics:{...base.physics.air.aerodynamics,
      seamForce:{version:'baseball_seam_force_v1' as const,coefficientScale:1}}}},
    raw={observation,physics,horizonSeconds:.5},before=JSON.stringify(raw),prediction=createLiveFieldForecastV1(raw),
    mean=createLiveFieldForecastV1({...raw,physics:base.physics}),actual=createSourceFreeBallKernel({
      kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:observation.tick,elapsedSeconds:0,ball:observation},
      throughElapsedSeconds:.5,profile:physics,materialOrientationAtStart:{w:1,x:0,y:0,z:0}});
  expect(prediction.diagnostics.seamPrediction).toBe('UNOBSERVED_MATERIAL_PHASE_SEAM_AVERAGED');
  expect(prediction.sampleAtElapsedSeconds(.5)).toEqual(mean.sampleAtElapsedSeconds(.5));
  expect(prediction.sampleAtElapsedSeconds(.5).position).not.toEqual(actual.evaluateAt(.5).moment.ball.position);
  expect(JSON.stringify(raw)).toBe(before);expect(raw.physics.air.aerodynamics.seamForce.coefficientScale).toBe(1);
});
it('uses explicitly observed material phase without resetting it or reading the future actual Source',()=>{
  const base=input(),observation={...base.observation,spin:{x:8,y:2,z:3}},phase={w:Math.cos(.3),x:0,y:Math.sin(.3),z:0},
    physics={...base.physics,air:{...base.physics.air,aerodynamics:{...base.physics.air.aerodynamics,
      seamForce:{version:'baseball_seam_force_v1' as const,coefficientScale:1}}}},
    prediction=createLiveFieldForecastV1({observation,physics,horizonSeconds:.5,materialOrientationAtObservation:phase}),
    expected=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',
      initial:{originTick:observation.tick,elapsedSeconds:0,ball:observation},throughElapsedSeconds:.5,profile:physics,materialOrientationAtStart:phase});
  expect(prediction.diagnostics).not.toHaveProperty('seamPrediction');expect(prediction.diagnostics.actualSourceRead).toBe(false);
  for(const seconds of [0,.123,.5]){
    const sample=expected.evaluateAt(seconds,'outgoing');
    expect(prediction.sampleAtElapsedSeconds(seconds)).toEqual({...sample.moment.ball,orientation:sample.materialOrientation,phase:sample.phase});
  }
});
it('measures process CPU outside the browser-neutral helper while reusing one kernel for nine defenders',()=>{
  const cpu=process.cpuUsage(),started=performance.now(),builds:number[]=[],sampleTimes:number[]=[];
  for(let observation=0;observation<20;observation++){
    const f=createLiveFieldForecastV1(input());for(let defender=0;defender<9;defender++)for(const second of [.15,.5,1,2,3,4,5,6])f.sampleAtElapsedSeconds(second);
    const p=f.readPerformance();expect(p.kernelBuildCount).toBe(1);expect(p.queries).toBe(72);builds.push(p.buildWallMilliseconds);sampleTimes.push(p.sampleWallMilliseconds);
  }
  const used=process.cpuUsage(cpu);
  console.info(JSON.stringify({benchmark:'EXPLICIT_20_OBSERVATIONS_9_DEFENDERS_8_SECOND_HYPOTHESES',hypotheses:20,sharedQueries:1440,
    wallMilliseconds:performance.now()-started,processCpuUserMilliseconds:used.user/1000,processCpuSystemMilliseconds:used.system/1000,
    meanBuildWallMilliseconds:builds.reduce((a,b)=>a+b)/builds.length,mean72SamplesWallMilliseconds:sampleTimes.reduce((a,b)=>a+b)/sampleTimes.length}));
});

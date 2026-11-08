import { expect, it } from 'vitest';
import { observePitchBreakTiming, type TimedPitchState } from './PitchBreakTiming';

const state = (elapsedSeconds:number, x=0, vx=0, z=10-10*elapsedSeconds, vz=-10):TimedPitchState => ({
  elapsedSeconds, position:{x,y:1,z}, velocity:{x:vx,y:0,z:vz}, phase:'airborne' });
const request = (actual:readonly TimedPitchState[],baseline:readonly TimedPitchState[]) => ({ actual, baseline, planeZ:0,
  comparisonBasis:'SAME_RELEASE_ANALYTIC_OBSERVATION_FIXTURE_NOT_A_PHYSICAL_PITCH_MODEL' });
const times = [0,.25,.5,.75,1], baseline = times.map(time=>state(time)), constantAcceleration = times.map(time=>state(time,time*time,2*time));

it('observes constant lateral acceleration with interval-bracketed percent times and a separately labeled average acceleration', () => {
  const result=observePitchBreakTiming(request(constantAcceleration,baseline));
  expect(result.status).toBe('CLASSIFIED');expect(result.timeAlignment).toBe('COMMON_ELAPSED_TIME');
  expect(result.finalDeltaXYZ).toEqual({x:1,y:0,z:0});expect(result.finalXY.normMeters).toBe(1);
  expect(result.percentTimes.p10!.elapsedSeconds).toBeCloseTo(.3,12);
  expect(result.percentTimes.p50!.elapsedSeconds).toBeCloseTo(.7,12);
  expect(result.percentTimes.p90!.elapsedSeconds).toBeCloseTo(33/35,12);
  expect(result.percentTimes.p10!.bracket).toEqual({fromElapsedSeconds:.25,throughElapsedSeconds:.5,
    fromProjectionMeters:.0625,throughProjectionMeters:.25});
  expect(result.late20Percent.fromElapsedSeconds).toBe(.8);
  expect(result.late20Percent.deltaXY.x).toBeCloseTo(.35,12);
  expect(result.late20Percent.projectedFraction).toBeCloseTo(.35,12);
  expect(result.intervalAverageAcceleration).toHaveLength(4);
  for(const interval of result.intervalAverageAcceleration){expect(interval.actual).toEqual({x:2,y:0,z:0});expect(interval.baseline).toEqual({x:0,y:0,z:0});}
  expect(result.numericalConventions.accelerationMeaning).toBe('VELOCITY_DIFFERENCE_OVER_OBSERVATION_INTERVAL_NOT_INSTANTANEOUS_FORCE');
  expect(result.actualSpeedLoss.lossMps).toBeCloseTo(10-Math.sqrt(104),12);
});

it('separates early and late concentration at the same 70cm endpoint without claiming a physical fork model', () => {
  const grid=[0,.2,.4,.6,.8,1], smooth=(u:number)=>3*u*u-2*u*u*u,
    curve=(time:number,start:number)=>{const u=Math.max(0,Math.min(1,(time-start)/.4));return state(time,.7*smooth(u),u>0&&u<1?.7*6*u*(1-u)/.4:0);},
    base=grid.map(time=>state(time)),early=observePitchBreakTiming(request(grid.map(time=>curve(time,0)),base)),
    late=observePitchBreakTiming(request(grid.map(time=>curve(time,.6)),base));
  expect(early.finalDeltaXYZ.x).toBeCloseTo(.7,12);expect(late.finalDeltaXYZ.x).toBeCloseTo(.7,12);
  expect(early.percentTimes.p50!.elapsedSeconds).toBeCloseTo(.2,12);
  expect(late.percentTimes.p50!.elapsedSeconds).toBeCloseTo(.8,12);
  expect(early.late20Percent.projectedFraction).toBeCloseTo(0,12);
  expect(late.late20Percent.projectedFraction).toBeCloseTo(.5,12);
  expect(early.comparisonBasis).toContain('NOT_A_PHYSICAL_PITCH_MODEL');
});

it('keeps Z difference raw and out of all XY timing and concentration measurements', () => {
  const original=observePitchBreakTiming(request(constantAcceleration,baseline)),
    slowerZ=observePitchBreakTiming(request(times.map(time=>state(time,time*time,2*time,10-10*time+.4*time*time,-10+.8*time)),baseline));
  expect(slowerZ.finalZDeltaMeters).toBeCloseTo(.4,12);
  expect(slowerZ.percentTimes).toEqual(original.percentTimes);
  expect(slowerZ.late20Percent).toEqual(original.late20Percent);
  expect(slowerZ.raw.at(-1)!.deltaXYZ.z).toBeCloseTo(.4,12);
  expect(slowerZ.intervalAverageAcceleration[0].delta.z).toBeCloseTo(.8,12);
});

it.each([[.6,.8],[-1,0]])('projects onto the signed final XY direction (%s,%s) rather than a fixed field axis', (x,y) => {
  const rows=times.map(time=>({...state(time,x*time*time,2*x*time),position:{x:x*time*time,y:1+y*time*time,z:10-10*time},
    velocity:{x:2*x*time,y:2*y*time,z:-10}})),result=observePitchBreakTiming(request(rows,baseline));
  expect(result.status).toBe('CLASSIFIED');expect(result.finalXY.normMeters).toBeCloseTo(1,12);
  expect(result.finalXY.direction!.x).toBeCloseTo(x,12);expect(result.finalXY.direction!.y).toBeCloseTo(y,12);
  expect(result.percentTimes.p10!.elapsedSeconds).toBeCloseTo(.3,12);
  expect(result.percentTimes.p50!.elapsedSeconds).toBeCloseTo(.7,12);
  expect(result.late20Percent.xyIncrementMeters).toBeCloseTo(.35,12);
});

it('keeps raw and late increments for zero or sub-micrometre final XY displacement without inventing percent times', () => {
  for(const scale of [0,1e-7]){
    const result=observePitchBreakTiming(request(times.map(time=>state(time,time*time*scale,2*time*scale)),baseline));
    expect(result.status).toBe('SMALL_FINAL_DISPLACEMENT');
    expect(result.percentTimes).toEqual({p10:null,p50:null,p90:null});
    expect(result.late20Percent.projectedFraction).toBeNull();expect(result.raw).toHaveLength(5);
    expect(result.late20Percent.deltaXY.x).toBeCloseTo(.35*scale,15);
  }
});

it('marks a sign-reversing/nonmonotonic projection unclassified for percentages while retaining the late raw increase', () => {
  const grid=[0,.3,.6,1],xs=[0,.4,-.1,.7],result=observePitchBreakTiming(request(grid.map((time,index)=>state(time,xs[index])),grid.map(time=>state(time))));
  expect(result.status).toBe('NON_MONOTONIC_PROJECTION');
  expect(result.percentTimes).toEqual({p10:null,p50:null,p90:null});expect(result.late20Percent.projectedFraction).toBeNull();
  expect(result.late20Percent.deltaXY.x).toBeCloseTo(.4,12);
  expect(result.raw[2].projectedXYMeters).toBeCloseTo(-.1,12);
});

it('leaves grounded observations unclassified and labels only an explicitly virtual airborne baseline as ground ignored', () => {
  const actual=constantAcceleration.map(row=>({...row,position:{...row.position},velocity:{...row.velocity}})),
    groundedActual=actual.map((row,index)=>index===actual.length-1?{...row,phase:'sliding' as const}:row),
    groundedBaseline=baseline.map((row,index)=>index===baseline.length-1?{...row,phase:'rolling' as const}:row);
  for(const pair of [[groundedActual,baseline],[actual,groundedBaseline],[actual,groundedBaseline.map(row=>({...row,counterfactualGroundIgnored:true}))]] as const){
    const result=observePitchBreakTiming(request(pair[0],pair[1]));
    expect(result.status).toBe('UNCLASSIFIED');expect(result.percentTimes.p50).toBeNull();expect(result.raw).toHaveLength(5);
  }
  const virtual=observePitchBreakTiming(request(actual,baseline.map(row=>({...row,counterfactualGroundIgnored:true}))));
  expect(virtual.status).toBe('CLASSIFIED');
  expect(virtual.groundClassification).toMatchObject({baselineVirtualAirOnly:true,groundIgnored:true,samePhysicalBallClaim:false});
});

it('retains known ground events between airborne samples and suppresses all free-flight percentage classification', () => {
  for (const groundEvents of [{ actual:[.375], baseline:[] }, { actual:[], baseline:[.375] }]) {
    const source = { ...request(constantAcceleration, baseline), groundEvents }, before = structuredClone(source),
      result = observePitchBreakTiming(source);
    expect(result.raw.every(row => row.actual.phase === 'airborne' && row.baseline.phase === 'airborne')).toBe(true);
    expect(result.status).toBe('UNCLASSIFIED');expect(result.percentTimes).toEqual({ p10:null, p50:null, p90:null });
    expect(result.late20Percent.projectedFraction).toBeNull();
    expect(result.groundClassification.actualGroundEventSeconds).toStrictEqual(groundEvents.actual);
    expect(result.groundClassification.baselineGroundEventSeconds).toStrictEqual(groundEvents.baseline);
    expect(result.groundClassification.actualGroundObserved).toBe(groundEvents.actual.length > 0);
    expect(result.groundClassification.baselineGroundObserved).toBe(groundEvents.baseline.length > 0);
    expect(source).toStrictEqual(before);expect(Object.isFrozen(result.groundClassification.actualGroundEventSeconds)).toBe(true);
  }
});

it('keeps a declared virtual air-only baseline free of ignored physical ground events', () => {
  const virtual = baseline.map(row => ({ ...row, counterfactualGroundIgnored:true })),
    result = observePitchBreakTiming({ ...request(constantAcceleration, virtual), groundEvents:{ actual:[], baseline:[] } });
  expect(result.status).toBe('CLASSIFIED');expect(result.percentTimes.p50).not.toBeNull();
  expect(result.groundClassification).toMatchObject({ baselineVirtualAirOnly:true, groundIgnored:true,
    actualGroundEventSeconds:[], baselineGroundEventSeconds:[], actualGroundObserved:false, baselineGroundObserved:false });
});

it('owns frozen observation copies and never changes input data, velocities or phases', () => {
  const actual=constantAcceleration.map(row=>({...row,position:{...row.position},velocity:{...row.velocity}})),source=request(actual,baseline),
    before=JSON.stringify(source),result=observePitchBreakTiming(source);
  expect(JSON.stringify(source)).toBe(before);expect(Object.isFrozen(actual[0].position)).toBe(false);
  expect(Object.isFrozen(result)).toBe(true);expect(Object.isFrozen(result.raw)).toBe(true);
  expect(Object.isFrozen(result.raw[0].actual.position)).toBe(true);expect(Object.isFrozen(result.percentTimes.p50!.bracket)).toBe(true);
  actual[4].position.x=999;expect(result.finalDeltaXYZ.x).toBe(1);expect(result.raw[4].actual.position.x).toBe(1);
});

it('rejects mismatched clocks, release states, nonfinite fields and private extra inputs', () => {
  const valid=request(constantAcceleration,baseline);
  for(const source of [{...valid,actual:[]},{...valid,actual:constantAcceleration.slice(0,1),baseline:baseline.slice(0,1)},
    {...valid,baseline:baseline.slice(1)},{...valid,actual:constantAcceleration.map((row,index)=>index===0?{...row,elapsedSeconds:.01}:row)},
    {...valid,actual:constantAcceleration.map((row,index)=>index===2?{...row,elapsedSeconds:.25}:row)},
    {...valid,baseline:baseline.map((row,index)=>index===2?{...row,elapsedSeconds:.5001}:row)},
    {...valid,actual:constantAcceleration.map((row,index)=>index===0?{...row,position:{...row.position,x:.0001}}:row)},
    {...valid,actual:constantAcceleration.map((row,index)=>index===0?{...row,velocity:{...row.velocity,x:.0001}}:row)},
    {...valid,planeZ:Infinity},{...valid,comparisonBasis:''},{...valid,seed:1},
    {...valid,actual:constantAcceleration.map((row,index)=>index===2?{...row,velocity:{...row.velocity,x:NaN}}:row)},
    {...valid,actual:constantAcceleration.map((row,index)=>index===2?{...row,spin:{x:0,y:0,z:0}}:row)}])
    expect(()=>observePitchBreakTiming(source)).toThrow();
  let reads=0;const accessor={...valid};Object.defineProperty(accessor,'planeZ',{enumerable:true,get(){reads++;return 0;}});
  expect(()=>observePitchBreakTiming(accessor)).toThrow();expect(reads).toBe(0);
});

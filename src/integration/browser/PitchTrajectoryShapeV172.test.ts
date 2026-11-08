import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../core/model/geometry';
import { observePitchBreakTiming, type TimedPitchState } from './PitchBreakTiming';
import { observePitchTrajectoryShapeV172 } from './PitchTrajectoryShapeV172';

const r0:Vec3={x:1,y:2,z:21},forward:Vec3={x:0,y:0,z:-35};
function samples(position:(t:number)=>Vec3,velocity:(t:number)=>Vec3,intervals=1000):TimedPitchState[] {
  return Array.from({length:intervals+1},(_,index)=>{
    const elapsedSeconds=index/intervals;
    return {elapsedSeconds,position:position(elapsedSeconds),velocity:velocity(elapsedSeconds),phase:'airborne'};
  });
}
function gravityRows(initialVelocity:Vec3=forward):TimedPitchState[] {
  return samples(t=>({x:r0.x+initialVelocity.x*t,y:r0.y+initialVelocity.y*t-4.9*t*t,z:r0.z+initialVelocity.z*t}),
    t=>({...initialVelocity,y:initialVelocity.y-9.8*t}));
}

describe('V172 actual trajectory shape in the initial tangent normal plane',()=>{
  it('does not count straight drag deceleration as bending and keeps an end-stop angle undefined',()=>{
    const input={sourceSamples:samples(t=>({x:r0.x,y:r0.y,z:r0.z-35*(t-t*t/2)}),
      t=>({x:0,y:0,z:-35*(1-t)}),10),referenceElapsedSeconds:1},result=observePitchTrajectoryShapeV172(input);
    expect(result.status).toBe('SMALL_FINAL_DISPLACEMENT');
    expect(result.timing.finalNormalDisplacementMeters).toBe(0);
    expect(result.timing.percentTimes).toStrictEqual({p10:null,p50:null,p90:null});
    expect(result.timing.transitionIntervalSeconds).toBeNull();
    expect(result.raw.slice(0,-1).every(row=>row.velocityDirectionChangeRadians===0)).toBe(true);
    expect(result.raw.at(-1)!.velocityDirectionChangeRadians).toBeNull();
    expect(result.raw.at(-1)!.speedMps).toBe(0);
  });

  it('matches gravity-only quadratic timing while reporting real velocity direction and speed separately',()=>{
    const result=observePitchTrajectoryShapeV172({sourceSamples:gravityRows(),referenceElapsedSeconds:1});
    expect(result.status).toBe('CLASSIFIED');
    expect(result.timing.finalNormalDisplacementMeters).toBeCloseTo(4.9,13);
    for(const [key,fraction] of [['p10',.1],['p50',.5],['p90',.9]] as const)
      expect(result.timing.percentTimes[key]!.elapsedSeconds).toBeCloseTo(Math.sqrt(fraction),5);
    expect(result.timing.late20Percent.projectedFraction).toBeCloseTo(.36,13);
    expect(result.timing.transitionIntervalSeconds).toBeCloseTo(Math.sqrt(.9)-Math.sqrt(.1),5);
    expect(result.raw.at(-1)!.velocityDirectionChangeRadians).toBeCloseTo(Math.atan2(9.8,35),14);
    expect(result.raw.at(-1)!.speedMps).toBeCloseTo(Math.hypot(9.8,35),13);
    expect(result.metadata.referenceMeaning).toBe('ANALYSIS_COORDINATES_NOT_A_WORLD_BALL');
    expect(result.metadata.hiddenGroundEvents).toBe('NOT_INFERRED');
  });

  it('projects in three dimensions for a nonhorizontal initial tangent, without treating along-track slowing as turn',()=>{
    const initialVelocity={x:3,y:4,z:-12},result=observePitchTrajectoryShapeV172({sourceSamples:gravityRows(initialVelocity),referenceElapsedSeconds:1}),
      normal=result.raw.at(-1)!.normalDisplacementWorld,dot=normal.x*3+normal.y*4-normal.z*12;
    expect(dot).toBeCloseTo(0,12);
    expect(result.timing.finalNormalDisplacementMeters).toBeCloseTo(4.9*Math.sqrt(1-(4/13)**2),12);
    expect(result.timing.percentTimes.p50!.elapsedSeconds).toBeCloseTo(Math.sqrt(.5),5);
    const straight=samples(t=>({x:r0.x+3*(t-t*t/2),y:r0.y+4*(t-t*t/2),z:r0.z-12*(t-t*t/2)}),
      t=>({x:3*(1-t),y:4*(1-t),z:-12*(1-t)}));
    const drag=observePitchTrajectoryShapeV172({sourceSamples:straight,referenceElapsedSeconds:1});
    expect(drag.status).toBe('SMALL_FINAL_DISPLACEMENT');
    expect(drag.timing.finalNormalDisplacementMeters).toBeLessThan(1e-12);
  });

  it('retains the smooth equal-endpoint counterexample where gravity-residual timing reverses the net ordering',()=>{
    // Pure mathematical observations, not claimed as a realizable pitch.
    // G=5,D=1<T-independent G/3: upward air acceleration is 10-6t>0.
    const a=samples(t=>({x:r0.x,y:r0.y-t*t,z:r0.z-35*t}),t=>({x:0,y:-2*t,z:-35})),
      b=samples(t=>({x:r0.x,y:r0.y-t*t*t,z:r0.z-35*t}),t=>({x:0,y:-3*t*t,z:-35})),
      gravity=samples(t=>({x:r0.x,y:r0.y-5*t*t,z:r0.z-35*t}),t=>({x:0,y:-10*t,z:-35})),
      observeNet=(sourceSamples:TimedPitchState[])=>observePitchTrajectoryShapeV172({sourceSamples,referenceElapsedSeconds:1}),
      observeAir=(actual:TimedPitchState[])=>observePitchBreakTiming({actual,baseline:gravity,planeZ:0,comparisonBasis:'SYNTHETIC_AIRLESS_GRAVITY_REFERENCE'}),
      netA=observeNet(a),netB=observeNet(b),airA=observeAir(a),airB=observeAir(b);
    expect(netA.timing.finalNormalDisplacementMeters).toBeCloseTo(1,14);
    expect(netB.timing.finalNormalDisplacementMeters).toBeCloseTo(1,14);
    expect(airA.finalXY.normMeters).toBeCloseTo(4,14);expect(airB.finalXY.normMeters).toBeCloseTo(4,14);
    expect(netB.timing.percentTimes.p10!.elapsedSeconds).toBeGreaterThan(netA.timing.percentTimes.p10!.elapsedSeconds);
    expect(netB.timing.late20Percent.projectedFraction!).toBeGreaterThan(netA.timing.late20Percent.projectedFraction!);
    expect(airB.percentTimes.p10!.elapsedSeconds).toBeLessThan(airA.percentTimes.p10!.elapsedSeconds);
    expect(airB.late20Percent.projectedFraction!).toBeLessThan(airA.late20Percent.projectedFraction!);
  });

  it('retains ground and nonmonotonic classifications instead of filling missing thresholds',()=>{
    const grounded=gravityRows();grounded[grounded.length-1]={...grounded.at(-1)!,phase:'sliding'};
    const ground=observePitchTrajectoryShapeV172({sourceSamples:grounded,referenceElapsedSeconds:1});
    expect(ground.status).toBe('UNCLASSIFIED');expect(ground.groundClassification.actualGroundObserved).toBe(true);
    expect(ground.timing.percentTimes.p10).toBeNull();expect(ground.timing.late20Percent.projectedFraction).toBeNull();
    const reversed=samples(t=>({x:r0.x,y:r0.y+t*t*(1+2*Math.sin(2*Math.PI*t)),z:r0.z-35*t}),
      t=>({x:0,y:2*t*(1+2*Math.sin(2*Math.PI*t))+4*Math.PI*t*t*Math.cos(2*Math.PI*t),z:-35}));
    const nonmonotonic=observePitchTrajectoryShapeV172({sourceSamples:reversed,referenceElapsedSeconds:1});
    expect(nonmonotonic.status).toBe('NON_MONOTONIC_PROJECTION');
    expect(nonmonotonic.timing.percentTimes.p50).toBeNull();expect(nonmonotonic.timing.transitionIntervalSeconds).toBeNull();
  });

  it('rejects invalid clocks, nonfinite input and an undefined initial tangent',()=>{
    const rows=gravityRows(),observe=(sourceSamples:TimedPitchState[],referenceElapsedSeconds=1)=>
      observePitchTrajectoryShapeV172({sourceSamples,referenceElapsedSeconds});
    expect(()=>observe(rows,.5)).toThrow();
    expect(()=>observe(rows.map(row=>({...row,elapsedSeconds:row.elapsedSeconds+.1})))).toThrow();
    expect(()=>observe([{...rows[0],velocity:{x:0,y:0,z:0}},...rows.slice(1)])).toThrow();
    expect(()=>observe([{...rows[0],position:{...r0,x:NaN}},...rows.slice(1)])).toThrow();
    expect(()=>observe([{...rows[0],velocity:{x:Infinity,y:0,z:-35}},...rows.slice(1)])).toThrow();
  });

  it('does not mutate or freeze source arrays and never aliases caller frame vectors',()=>{
    const input={sourceSamples:gravityRows(),referenceElapsedSeconds:1},before=structuredClone(input),
      result=observePitchTrajectoryShapeV172(input);
    expect(input).toStrictEqual(before);
    expect(Object.isFrozen(input)).toBe(false);expect(Object.isFrozen(input.sourceSamples)).toBe(false);
    expect(Object.isFrozen(input.sourceSamples[0].position)).toBe(false);
    expect(result.frame.origin).not.toBe(input.sourceSamples[0].position);
    expect(result.frame.initialVelocity).not.toBe(input.sourceSamples[0].velocity);
    expect(Object.isFrozen(result)).toBe(true);expect(Object.isFrozen(result.frame.origin)).toBe(true);
    expect(Object.isFrozen(result.raw[0].normalDisplacementWorld)).toBe(true);
    expect(result.authority).toMatchObject({readOnly:true,physicalSourceModified:false,skillAdmission:false});
  });
});

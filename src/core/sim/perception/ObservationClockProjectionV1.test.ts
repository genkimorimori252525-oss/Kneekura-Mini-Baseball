import { expect, it } from 'vitest';
import { projectObservationClockV1 } from './ObservationClockProjectionV1';
import { playerObservationCalibrationFixture } from './PlayerObservationCalibrationFixtures.test-support';
import { isObservationRefreshDue, createObservationSample } from './Observation';
import { predictSpatialObservationMemory } from './ObservationMemory';
import { captureSpatialObservation } from './ObservationCapture';
import { evaluateObservationGeometry } from './ObservationGeometry';
import { composeObservationQuality } from './ObservationQuality';
import { SeedRoot } from '../../rng/SeedRoot';

it('preserves attended/peripheral same-seconds deadlines without mutating the original input',()=>{
  const original=playerObservationCalibrationFixture(),bytes=JSON.stringify(original),next=projectObservationClockV1(original,1_000_000);
  expect(next.refreshPolicy).toEqual({attendedIntervalTicks:10_000,peripheralIntervalTicks:40_000});
  expect(next.memoryDecayParameters).toEqual({...original.memoryDecayParameters,ticksPerSecond:1_000_000});
  for(const target of [{kind:'ball' as const},{kind:'player' as const,playerId:'other'}])for(const ms of [0,9,10,11,39,40,41]){
    const due=(clock:number,policy:typeof original.refreshPolicy)=>isObservationRefreshDue({target,attention:{target:{kind:'ball'},focusedSinceTick:clock},
      lastObservedAt:clock,currentTick:clock+ms*clock/1000,policy});
    expect(due(1_000_000,next.refreshPolicy)).toBe(due(1000,original.refreshPolicy));
  }
  expect(JSON.stringify(original)).toBe(bytes);expect(Object.isFrozen(next)).toBe(true);
});
it('preserves same-seconds memory position, velocity, confidence decay and floor',()=>{
  const original=playerObservationCalibrationFixture(),next=projectObservationClockV1(original,1_000_000);
  const truth={position:{x:1,y:2,z:3},velocity:{x:4,y:-5,z:6}};
  for(const elapsedMs of [0,1,10,500,1000,10000]){
    const old=predictSpatialObservationMemory(createObservationSample(truth,1000,.8),1000+elapsedMs,original.memoryDecayParameters);
    const projected=predictSpatialObservationMemory(createObservationSample(truth,1_000_000,.8),1_000_000+elapsedMs*1000,next.memoryDecayParameters);
    expect(projected.estimate).toEqual(old.estimate);expect(projected.confidence).toBe(old.confidence);
    expect(projected.sourceObservedAt).toBe(old.sourceObservedAt*1000);expect(projected.predictedAt).toBe(old.predictedAt*1000);
  }
});
it('preserves SI geometry, observation quality and captured noise distribution/sample for the same RNG',()=>{
  const original=playerObservationCalibrationFixture(),next=projectObservationClockV1(original,1_000_000);
  const observer={position:{x:0,y:1,z:0},velocity:{x:0,y:0,z:0},forward:{x:0,y:0,z:1}};
  const truth={position:{x:1,y:1,z:8},velocity:{x:2,y:3,z:4}};
  const run=(c:typeof original,clock:number)=>{
    const geometry=evaluateObservationGeometry(observer,truth,c.geometryParameters);
    const quality=composeObservationQuality({...geometry,occlusionVisibility:1,attentionQuality:1,observationDurationSeconds:.25,
      perceptionAbility:c.perceptionAbility},c.qualityParameters);
    const sample=captureSpatialObservation(truth,clock,quality.totalQuality,new SeedRoot(42).streamRng(1,'perception','clock-equivalence'),c.errorParameters);
    return {geometry,quality,sample};
  };
  const old=run(original,1000),projected=run(next,1_000_000);
  expect(projected.geometry).toEqual(old.geometry);expect(projected.quality).toEqual(old.quality);
  expect(projected.sample!.estimate).toEqual(old.sample!.estimate);expect(projected.sample!.confidence).toBe(old.sample!.confidence);
  for(const key of ['perceptionAbility','geometryParameters','qualityParameters','errorParameters'] as const)expect(next[key]).toEqual(original[key]);
});
it('rejects inexact/unsafe integer conversion and malformed clocks rather than rounding',()=>{
  const original=playerObservationCalibrationFixture();
  for(const target of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])expect(()=>projectObservationClockV1(original,target)).toThrow();
  expect(()=>projectObservationClockV1(original,999)).toThrow();
  expect(()=>projectObservationClockV1({...original,memoryDecayParameters:{...original.memoryDecayParameters,ticksPerSecond:1}},Number.MAX_SAFE_INTEGER)).toThrow();
  expect(()=>projectObservationClockV1({...original,extra:true} as never,1_000_000)).toThrow();
  expect(projectObservationClockV1(original,1000)).toEqual(original);
});

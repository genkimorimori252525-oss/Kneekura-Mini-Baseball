import {describe,it,expect} from 'vitest';
import {buildLiveBatReferenceExecutionV247,type LiveBatReferenceRecipeV247} from './LiveBatReferenceExecutionV247';

describe('pre-late reference execution',()=>{
 it('keeps fixed source and applies a declared synthetic sample without future input',()=>{
  const recipe:LiveBatReferenceRecipeV247={originTick:0,decisionTick:0,decisionTimeSeconds:0,nominalArrivalSeconds:.3,technicalTimingOffsetSeconds:0,startMode:'MOTOR',contactSourceTick:100000,rampSeconds:0,normalCenter:{x:0,y:1,z:0},limits:{},reference:{provenance:{clipId:'fixture',sourceSha256:'a'.repeat(64)},frames:[{tick:0,grip:{x:0,y:1,z:0},orientation:{x:0,y:0,z:0,w:1}},{tick:100000,grip:{x:.1,y:1,z:0},orientation:{x:0,y:0,z:0,w:1}}],batLengthM:.8,sweetSpotT:.75,sourceTicksPerSecond:1e6,ticksPerSecond:1e6,playbackRate:1,rotation:{x:0,y:0,z:0,w:1}}};
  const zero={x:0,y:0,z:0},normal=buildLiveBatReferenceExecutionV247(recipe,{timingSeconds:0,aim:zero},zero),shift=buildLiveBatReferenceExecutionV247(recipe,{timingSeconds:.01,aim:{x:.01,y:0,z:0}},zero);
  expect(normal.reference.provenance).toEqual(recipe.reference.provenance);expect(normal.contactTick).toBe(300000);expect(shift.contactTick).toBe(310000);expect(shift.motion.sampleContinuous(shift.contactTick).sweetSpot.x-normal.motion.sampleContinuous(normal.contactTick).sweetSpot.x).toBeCloseTo(.01,12);
  expect(normal.assumptions).toEqual({lateObservationIncluded:false,randomSweetSpotVariationIncluded:false});
 });
});

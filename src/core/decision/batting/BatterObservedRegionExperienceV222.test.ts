import { expect, it } from 'vitest';
import { forecastObservedPitchV151, type ObservedPitchPositionV151 } from './ObservedPitchForecastV151';
import { createBatterObservedEvidenceV151, createEmptyBatterObservedMemoryV151, appendBatterObservedEvidenceV151 } from './BatterObservedMemoryV151';
import { createRegionSnapshotV222, recallObservedRegionV222 } from './BatterObservedRegionExperienceV222';
const policy={version:'batter_observed_memory_policy_v151' as const,sourceId:'p',maximumEntriesPerPair:3,unprofiledPriorWeight:.25};
const sample=(id:string,t:number,x:number):ObservedPitchPositionV151=>({observationId:id,observedTick:t,availableTick:t,position:{x,y:1,z:10-t/10}});
const snapshot=(samples:ObservedPitchPositionV151[])=>{const input={originTick:0,ticksPerSecond:100,cutoffTick:samples.at(-1)!.availableTick,planeZ:0,maximumAfterReleaseSeconds:2,observations:samples};
 return { ...input,forecast:forecastObservedPitchV151(input) };};
const evidence=(id:string,ordinal:number,regionId:string|null,x:number)=>createBatterObservedEvidenceV151({evidenceId:id,observerPlayerId:'b',pitcherId:'p',pitchOrdinal:ordinal,
 forecast:snapshot([sample(id+'1',10,x),sample(id+'2',20,x)]).forecast,regionId})!;
it('V222 groups only available same-region evidence using the selected existing draw; null remains unknown',()=>{
 let m=createEmptyBatterObservedMemoryV151({observerPlayerId:'b',pitcherId:'p'});
 // Unique chronological ticks are required by the existing memory schema.
 const mk=(id:string,ordinal:number,regionId:string|null,x:number,t:number)=>{const s=snapshot([sample(id+'1',t,x),sample(id+'2',t+1,x)]);
   return createBatterObservedEvidenceV151({evidenceId:id,observerPlayerId:'b',pitcherId:'p',pitchOrdinal:ordinal,forecast:s.forecast,regionId})!;};
 const a=mk('a',1,'R',1,10),b=mk('b',2,'R',3,20),c=mk('c',3,null,5,30);
 for(const e of [a,b,c])m=appendBatterObservedEvidenceV151(m,e,policy,100);
 const first=recallObservedRegionV222(m,{atTick:100,draw:0,priorWeight:.25})!;
 expect(first.position.x).toBe(2);expect(first.memberEvidenceIds).toEqual(['a','b']);
 const unknown=recallObservedRegionV222(m,{atTick:100,draw:.9,priorWeight:.25})!;
 expect(unknown.regionId).toBeNull();expect(unknown.position.x).toBe(5);expect(unknown.memberEvidenceIds).toEqual(['c']);
 expect(recallObservedRegionV222(m,{atTick:0,draw:0,priorWeight:.25})).toBeNull();
 expect(recallObservedRegionV222(m,{atTick:20,draw:0,priorWeight:.25})!.memberEvidenceIds).toEqual(['a']);
});
it('V222 binds only the actual delivered samples and describes two-sample acceleration as assumption',()=>{
 const raw=snapshot([sample('e1',10,1),sample('e2',20,1)]),e=evidence('e',1,'R',1);
 const result=createRegionSnapshotV222({evidence:e,...raw});expect(result.samples.map(x=>x.observationId)).toEqual(raw.forecast.usedObservationIds);
 expect(result.accelerationBasis).toBe('TWO_SAMPLE_ZERO_ASSUMED');expect(result.familyId).toBeNull();
 expect(()=>createRegionSnapshotV222({evidence:e,...raw,observations:[sample('e1',10,1),sample('e2',20,2)]})).toThrow();
});

it('V222 keeps the third delivered sample and distinguishes estimated acceleration',()=>{
 const raw=snapshot([sample('e1',10,1),sample('e2',15,1),sample('e3',20,1)]);
 const e=createBatterObservedEvidenceV151({evidenceId:'e',observerPlayerId:'b',pitcherId:'p',pitchOrdinal:1,forecast:raw.forecast,regionId:'R'})!;
 const value=createRegionSnapshotV222({evidence:e,...raw});expect(value.accelerationBasis).toBe('THREE_SAMPLE_ESTIMATED');
 expect(value.samples).toHaveLength(3);expect(value.rawForecast.prediction!.estimatedVelocity).toEqual(raw.forecast.prediction!.estimatedVelocity);
 expect(()=>createRegionSnapshotV222({evidence:{...e,pitcherId:'foreign'},...raw,observations:[...raw.observations,{...sample('future',30,1),availableTick:31}]})).toThrow();
});

it('V222-review rejects a changed sign on a raw forecast zero',()=>{
 const raw=snapshot([sample('e1',10,1),sample('e2',20,1)]),e=evidence('e',1,'R',1);
 const forecast=structuredClone(raw.forecast);
 (forecast.prediction!.estimatedVelocity as {x:number}).x=-0;
 expect(Object.is(forecast.prediction!.estimatedVelocity.x,-0)).toBe(true);
 expect(()=>createRegionSnapshotV222({evidence:e,...raw,forecast})).toThrow(/forecast differs/);
});

import {expect,it} from 'vitest';
import {buildLiveFieldPerceivedStateV1,captureLiveFieldObservationSnapshotV1,type LiveFieldObservationSnapshotV1} from './LiveFieldPerceptionV1';

const v=(x=0,y=0,z=0)=>({x,y,z});
const snapshot=(elapsedSeconds=0):LiveFieldObservationSnapshotV1=>({elapsedSeconds,
 ball:{position:v(1,2,3),velocity:v(2,0,-1),spin:v(0,4,0),phase:'free',possessedBy:null},
 actors:[{playerId:'p',position:v(4,1,2),velocity:v(3,0,1),glovePosition:v(4,2,2),gloveVelocity:v(1,0,0)}],
 runners:[{runnerId:'r',position:v(0,0,3),velocity:v(1,0,0),currentBase:1,retired:false,scored:false}],outs:1});
const input=(snapshots:readonly LiveFieldObservationSnapshotV1[]=[snapshot()])=>({observerId:'p',elapsedSeconds:1,
 clock:{originTick:100,ticksPerSecond:1000},delaySeconds:.2,cadenceSeconds:.1,snapshots,
 knownContext:{outs:0,occupiedBases:[1] as readonly (1|2|3)[]}});

it('selects only the delayed cadence snapshot and predicts positions and glove from that observation',()=>{
 const a=snapshot(.6),b=snapshot(.8),future=snapshot(.9),raw=input([a,b,future]),before=JSON.stringify(raw),r=buildLiveFieldPerceivedStateV1(raw);
 expect(r.observationElapsedSeconds).toBe(.8);expect(r.observationTick).toBe(900);expect(r.ageSeconds).toBeCloseTo(.2);
 expect(r.actors[0].position.x).toBeCloseTo(4.6);expect(r.actors[0].glovePosition!.x).toBeCloseTo(4.2);
 expect(r.actors[0].observedPosition).toEqual(b.actors[0].position);expect(r.runners[0].position.x).toBeCloseTo(.2);
 expect(r.ball!.position.x).toBeCloseTo(1.4);expect(r.ball!.spin).toEqual(v(0,4,0));
 expect(r.world.ball!.sourceObservedAt).toBe(900);expect(r.world.observationTime).toBe(1100);
 expect(r.world.knownContext.outs).toBe(1);expect(JSON.stringify(raw)).toBe(before);
 expect(Object.isFrozen(r.actors[0].position)).toBe(true);
});
it('does not use initial world truth before any observation is available',()=>{
 const r=buildLiveFieldPerceivedStateV1({...input(),elapsedSeconds:.1,delaySeconds:.2});
 expect(r.observationElapsedSeconds).toBeNull();expect(r.ball).toBeNull();expect(r.actors).toEqual([]);expect(r.runners).toEqual([]);
 expect(r.world.ball).toBeNull();expect(r.world.knownContext.outs).toBe(0);
});
it('keeps cadence boundary noise within 1e-12 and reads no future payload',()=>{
 const future={elapsedSeconds:.21};let invoked=false;
 Object.defineProperty(future,'ball',{enumerable:true,get(){invoked=true;throw Error('future world read');}});
 const r=buildLiveFieldPerceivedStateV1({...input([snapshot(.2),future as LiveFieldObservationSnapshotV1]),elapsedSeconds:.3,delaySeconds:.1,cadenceSeconds:.02});
 expect(r.observationElapsedSeconds).toBe(.2);expect(invoked).toBe(false);
});
it('drops hidden intent/motion/callback/world fields without reading them and detaches every retained reference',()=>{
 const raw=snapshot() as unknown as Record<string,unknown>;let invoked=false;
 Object.defineProperty(raw,'world',{enumerable:true,get(){invoked=true;throw Error('hidden world');}});
 const runner=(raw.runners as Record<string,unknown>[])[0];Object.defineProperty(runner,'leg',{enumerable:true,get(){invoked=true;throw Error('future motion');}});
 const a=captureLiveFieldObservationSnapshotV1(raw);expect(invoked).toBe(false);expect('world'in a).toBe(false);expect('leg'in a.runners[0]).toBe(false);
 (raw.ball as {position:{x:number}}).position.x=999;expect(a.ball.position.x).toBe(1);
 const r=buildLiveFieldPerceivedStateV1(input([a]));expect(JSON.stringify(r)).not.toMatch(/motion|callback|worldTruth|leg/);
});
it('rejects getters on allowed data fields and malformed clocks, duplicate actors, times and vectors',()=>{
 const raw=snapshot();let invoked=false;Object.defineProperty(raw.ball,'position',{enumerable:true,get(){invoked=true;return v();}});
 expect(()=>captureLiveFieldObservationSnapshotV1(raw)).toThrow();expect(invoked).toBe(false);
 for(const patch of [{elapsedSeconds:NaN},{delaySeconds:-1},{cadenceSeconds:0},{clock:{originTick:0,ticksPerSecond:0}}])
  expect(()=>buildLiveFieldPerceivedStateV1({...input(),...patch})).toThrow();
 expect(()=>captureLiveFieldObservationSnapshotV1({...snapshot(),actors:[snapshot().actors[0],snapshot().actors[0]]})).toThrow();
 expect(()=>captureLiveFieldObservationSnapshotV1({...snapshot(),ball:{...snapshot().ball,velocity:v(Infinity)}})).toThrow();
});
it('does not change the perceived input when only hidden future plans change',()=>{
 const a=snapshot(),b={...snapshot(),futureIntent:()=>v(999),world:{forceOut:true}};
 expect(buildLiveFieldPerceivedStateV1(input([a]))).toEqual(buildLiveFieldPerceivedStateV1(input([b])));
});
it('accepts plain null-prototype data while excluding nonenumerable/symbol extras without following cycles',()=>{
 const raw=Object.assign(Object.create(null),snapshot());let invoked=false;
 Object.defineProperty(raw,'hidden',{get(){invoked=true;throw Error('hidden');}});raw[Symbol('world')]=raw;
 raw.actors[0].world=raw;const result=captureLiveFieldObservationSnapshotV1(raw);
 expect(invoked).toBe(false);expect(Reflect.ownKeys(result)).not.toContain('hidden');expect(JSON.stringify(result)).not.toMatch(/world/);
 Object.defineProperty(raw.ball,'velocity',{value:raw.ball.velocity,enumerable:false});expect(()=>captureLiveFieldObservationSnapshotV1(raw)).toThrow();
});

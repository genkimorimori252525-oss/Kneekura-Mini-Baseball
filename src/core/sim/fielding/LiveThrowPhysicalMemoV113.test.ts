import {expect,it} from 'vitest';
import {internLiveThrowPhysicalNamespaceV113,exactLiveThrowPhysicalKeyV113,getLiveThrowPhysicalMemoStatsV113,memoizeLiveThrowPhysicalV113,withLiveThrowPhysicalMemoV113} from './LiveThrowPhysicalMemoV113';

it('reuses exact owned values only within a synchronous scope and restores nested/throwing scopes',()=>{
 let calls=0;const compute=()=>({number:++calls}),key=()=>exactLiveThrowPhysicalKeyV113({x:1});
 expect(getLiveThrowPhysicalMemoStatsV113()).toBeNull();
 memoizeLiveThrowPhysicalV113('shooting',key,compute);memoizeLiveThrowPhysicalV113('shooting',key,compute);expect(calls).toBe(2);
 withLiveThrowPhysicalMemoV113(()=>{
  const one=memoizeLiveThrowPhysicalV113('shooting',key,compute),two=memoizeLiveThrowPhysicalV113('shooting',key,compute);
  expect(two).toBe(one);expect(Object.isFrozen(one)).toBe(true);
  expect(()=>withLiveThrowPhysicalMemoV113(()=>{expect(memoizeLiveThrowPhysicalV113('shooting',key,compute)).not.toBe(one);throw Error('inner');})).toThrow('inner');
  expect(memoizeLiveThrowPhysicalV113('shooting',key,compute)).toBe(one);
  expect(getLiveThrowPhysicalMemoStatsV113()).toMatchObject({hits:2,misses:1,entries:1});
 });
 expect(getLiveThrowPhysicalMemoStatsV113()).toBeNull();
 withLiveThrowPhysicalMemoV113(()=>{memoizeLiveThrowPhysicalV113('shooting',key,compute);expect(getLiveThrowPhysicalMemoStatsV113()!.hits).toBe(0);});
});

it('preserves IEEE754 distinctions, material presence, and all physical key components',()=>{
 const key=exactLiveThrowPhysicalKeyV113;
 expect(key({x:0})).not.toBe(key({x:-0}));expect(key({x:1})).not.toBe(key({x:1+Number.EPSILON}));
 expect(key({material:undefined})).not.toBe(key({}));expect(key({x:1,y:2})).toBe(key({y:2,x:1}));
 const raw={position:[0,1,0],velocity:[2,3,4],spin:[120,0,0],seconds:.5,material:{w:1,x:0,y:0,z:0},air:{gravityY:-9.81}};
 for(const name of Object.keys(raw)){
  const next=structuredClone(raw);if(name==='seconds')next.seconds+=Number.EPSILON;
  else if(name==='air')next.air.gravityY=-9.8;
  else if(name==='material')next.material.w=1-Number.EPSILON;
  else {const values=next[name as 'position'|'velocity'|'spin'];values[0]+=Number.EPSILON*Math.max(1,Math.abs(values[0]));}
  expect(key(next)).not.toBe(key(raw));
 }
});

it('bounds total entries and verification kernels without dropping logical computations',()=>{
 withLiveThrowPhysicalMemoV113(()=>{
  let calls=0;for(let i=0;i<6;i++)memoizeLiveThrowPhysicalV113('verification',()=>String(i),()=>({n:++calls}));
  expect(getLiveThrowPhysicalMemoStatsV113()).toMatchObject({entries:1,verificationEntries:1,misses:6,evictions:5});
  for(let i=0;i<4;i++)memoizeLiveThrowPhysicalV113('shooting',()=>String(i),()=>++calls);
  expect(getLiveThrowPhysicalMemoStatsV113()!.entries).toBe(3);expect(calls).toBe(10);
 },{maximumEntries:3,maximumVerificationEntries:1});
 expect(()=>withLiveThrowPhysicalMemoV113(()=>0,{maximumEntries:0})).toThrow(/bound/);
});

it('retains at most 128 compact verifications inside the unchanged 2048-entry default scope',()=>{
 withLiveThrowPhysicalMemoV113(()=>{
  for(let i=0;i<129;i++)memoizeLiveThrowPhysicalV113('verification',()=>String(i),()=>({boundaries:[],verified:{n:i}}));
  expect(getLiveThrowPhysicalMemoStatsV113()).toMatchObject({maximumEntries:2048,maximumVerificationEntries:128,
   entries:128,verificationEntries:128,misses:129,evictions:1});
  expect(memoizeLiveThrowPhysicalV113('verification',()=> '128',()=>({boundaries:[],verified:{n:-1}}))).toMatchObject({verified:{n:128}});
 });
 expect(getLiveThrowPhysicalMemoStatsV113()).toBeNull();
});

it('interns exact bounded physical namespaces without recycling ids or crossing scopes',()=>{
 let keyCalls=0,calls=0;
 const key=(n:number)=>()=>{keyCalls++;return exactLiveThrowPhysicalKeyV113({physics:n});};
 expect(internLiveThrowPhysicalNamespaceV113(key(1))).toBeNull();expect(keyCalls).toBe(0);
 withLiveThrowPhysicalMemoV113(()=>{
  const one=internLiveThrowPhysicalNamespaceV113(key(1))!;
  expect(internLiveThrowPhysicalNamespaceV113(key(1))).toBe(one);
  const read=(namespace:typeof one)=>memoizeLiveThrowPhysicalV113('shooting',()=> 'state',()=>++calls,namespace);
  expect(read(one)).toBe(1);expect(read(one)).toBe(1);
  const adjacent=internLiveThrowPhysicalNamespaceV113(key(1+Number.EPSILON))!;
  expect(adjacent.id).not.toBe(one.id);expect(read(adjacent)).toBe(2);
  internLiveThrowPhysicalNamespaceV113(key(2));
  const reissued=internLiveThrowPhysicalNamespaceV113(key(1))!;
  expect(reissued.id).toBeGreaterThan(adjacent.id);expect(read(reissued)).toBe(3);
  withLiveThrowPhysicalMemoV113(()=>{
   const inner=internLiveThrowPhysicalNamespaceV113(key(1))!;
   expect(read(inner)).toBe(4);expect(read(one)).toBe(5);expect(read(inner)).toBe(4);
  });
  expect(read(one)).toBe(1);
  expect(getLiveThrowPhysicalMemoStatsV113()).toMatchObject({maximumEntries:2048,namespaceEntries:2,namespaceEvictions:2});
 },{maximumNamespaces:2});
 expect(getLiveThrowPhysicalMemoStatsV113()).toBeNull();
 withLiveThrowPhysicalMemoV113(()=>{expect(getLiveThrowPhysicalMemoStatsV113()!.namespaceEntries).toBe(0);});
 expect(()=>withLiveThrowPhysicalMemoV113(()=>0,{maximumNamespaces:0})).toThrow(/bound/);
});

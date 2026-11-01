import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {calculateBaseballSeamCoefficientV1,validateBaseballMaterialOrientationV1,validateBaseballSeamForceV1} from './BaseballSeamForceV1';
import {createSourceFreeBallKernel} from './SourceFreeBallKernel';
import type {Quaternion} from '../pitching/BaseballOrientation';
import type {BaseballSeamForceV1} from './BaseballSeamForceV1';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/baseball-seam-validation-v113.json',import.meta.url),'utf8'));
/** Golden values came only from the frozen V111 Core (generator/provenance in fixture).
 * Float64 bit encoding preserves signed zero and does not round result numbers. */
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_key,v:unknown)=>{
 if(typeof v!=='number')return v;const bytes=Buffer.allocUnsafe(8);bytes.writeDoubleBE(v);return 'f64:'+bytes.toString('hex');
})).digest('hex');
const q=()=>({w:.6541431638256116,x:-.3207507891966091,y:.033712266409371645,z:.6841630913338683});
const profile=(scale=1):BaseballSeamForceV1=>({version:'baseball_seam_force_v1',coefficientScale:scale});
const failure=(run:()=>unknown)=>{try{run();return null;}catch(e){return (e as Error).message;}};

it('avoids clone property allocations for exact flat finite objects without changing values',()=>{
 const define=Object.defineProperty;let currentCalls=0;
 Object.defineProperty=((...args:Parameters<typeof define>)=>{currentCalls++;return Reflect.apply(define,Object,args);}) as typeof define;
 try{expect(validateBaseballMaterialOrientationV1(q())).toStrictEqual(fixture.normalizedMaterial);
  expect(validateBaseballSeamForceV1(profile())).toStrictEqual(fixture.validatedProfile);
 }finally{Object.defineProperty=define;}
 expect(fixture.originalClonePropertyAllocations).toBe(6);expect(currentCalls).toBe(0);
});

it('matches the frozen seam force bit for bit across deterministic raw quaternions, signs and scales',()=>{
 const materials:Quaternion[]=[],forces:{x:number;y:number;z:number}[]=[];
 let seed=0x913e7;const draw=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<300;i++){
  const raw={w:(draw()-.5)*5,x:(draw()-.5)*5,y:(draw()-.5)*5,z:(draw()-.5)*5},d={x:draw()-.5,y:draw()-.5,z:draw()-.5},length=Math.hypot(d.x,d.y,d.z),
   direction={x:d.x/length,y:d.y/length,z:d.z/length};
  for(const sign of [1,-1])for(const scale of [0,.01,.5,1,2]){
   const material={w:raw.w*sign,x:raw.x*sign,y:raw.y*sign,z:raw.z*sign},p=profile(scale);
   materials.push(validateBaseballMaterialOrientationV1(material));
   forces.push(calculateBaseballSeamCoefficientV1(direction,material,p));
  }
 }
 expect(materials).toHaveLength(3000);expect(digest(materials)).toBe(fixture.materialSha256);expect(digest(forces)).toBe(fixture.forceSha256);
});

it('preserves fallback rejection and rechecks mutable objects without invoking accessors',()=>{
 let getterCalls=0;
 const accessor=Object.defineProperty(q(),'x',{enumerable:true,get(){getterCalls++;return 0;}}),hidden=Object.defineProperty(q(),'hidden',{value:1}),
  symbol=Object.assign(q(),{[Symbol('hidden')]:1}),inherited=Object.assign(Object.create({other:1}),q()),cycle=Object.assign(q(),{self:null as unknown});cycle.self=cycle;
 const invalidMaterial=[undefined,null,[],accessor,hidden,symbol,inherited,cycle,{...q(),extra:0},{...q(),x:NaN},{...q(),x:Infinity},{w:0,x:0,y:0,z:0}];
 expect(invalidMaterial.map(raw=>failure(()=>validateBaseballMaterialOrientationV1(raw)))).toStrictEqual(fixture.materialErrors);
 const pAccessor=Object.defineProperty(profile(),'coefficientScale',{enumerable:true,get(){getterCalls++;return 1;}}),
  pCycle=Object.assign(profile(),{self:null as unknown});pCycle.self=pCycle;
 const invalidProfile=[undefined,null,[],pAccessor,pCycle,Object.assign(profile(),{[Symbol('s')]:1}),Object.defineProperty(profile(),'x',{value:0}),
  Object.assign(Object.create({x:1}),profile()),{...profile(),extra:0},{...profile(),version:'bad'},profile(-1),profile(2.01),profile(NaN)];
 expect(invalidProfile.map(raw=>failure(()=>validateBaseballSeamForceV1(raw)))).toStrictEqual(fixture.profileErrors);
 expect(getterCalls).toBe(0);
 const mutable=q(),before=validateBaseballMaterialOrientationV1(mutable);mutable.x+=.3;
 expect(validateBaseballMaterialOrientationV1(mutable)).toStrictEqual(fixture.changedMaterial);expect(validateBaseballMaterialOrientationV1(mutable)).not.toStrictEqual(before);
 mutable.w=NaN;expect(()=>validateBaseballMaterialOrientationV1(mutable)).toThrow();
 const p=profile();validateBaseballSeamForceV1(p);(p as {coefficientScale:number}).coefficientScale=3;expect(()=>validateBaseballSeamForceV1(p)).toThrow();
 for(const raw of [Object.assign(Object.create(null),q()),Object.freeze(q())])expect(validateBaseballMaterialOrientationV1(raw)).toStrictEqual(fixture.normalizedMaterial);
 for(const raw of [Object.assign(Object.create(null),profile()),Object.freeze(profile())])expect(validateBaseballSeamForceV1(raw)).toStrictEqual(fixture.validatedProfile);
});

it('preserves complete continuous kernel samples and physical boundaries with seam force',()=>{
 for(const scale of [0,1,2]){
  const physics=structuredClone(fixture.physics) as Parameters<typeof createSourceFreeBallKernel>[0]['profile'];(physics.air.aerodynamics as {seamForce:BaseballSeamForceV1}).seamForce=profile(scale);
  const initial={originTick:10,elapsedSeconds:0,ball:{tick:10,position:{x:0,y:.15,z:0},velocity:{x:5,y:-2,z:8},spin:{x:35,y:-17,z:12}}},
   descriptor={kind:'aero_ground_continuous_source_kernel_v2' as const,initial,throughElapsedSeconds:.12,profile:physics,materialOrientationAtStart:q() as Quaternion},
   actual=createSourceFreeBallKernel(descriptor),samples=[];
  for(const t of [0,.00000035,.005,.031234567,.08,.12])for(const side of ['incoming','outgoing'] as const)samples.push(actual.evaluateAt(t,side));
  expect(digest({boundaries:actual.boundaries,cells:actual.cells,samples})).toBe(fixture.kernelSha256[scale]);
 }
},15000);

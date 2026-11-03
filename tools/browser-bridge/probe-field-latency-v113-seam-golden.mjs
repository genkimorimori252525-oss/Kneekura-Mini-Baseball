// Regenerate only from the frozen pre-optimization Core; never import current source.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
assert.equal(process.versions.node.split('.')[0],'24');
const source='../../outputs/ばせぼーるlv111_TBD_vs_LAD_制球とカウント配球版.html',
 htmlSha='eeded1571556cea2292e93168fdf10b2bf4860e0336d629862c5610ac49aaa90',
 coreSha='7d71db66c9dad924ad3628bdd644b965fba1c79f901c89e3cb4f0009eef6d0ab',
 sha=v=>createHash('sha256').update(v).digest('hex'),bytes=readFileSync(source);
assert.equal(sha(bytes),htmlSha);
const embedded=[...bytes.toString('utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore ='));
assert(embedded.endsWith('\n'));const core=embedded.slice(0,-1);assert.equal(sha(core),coreSha);
const marker='return __toCommonJS(browser_exports);';assert.equal(core.split(marker).length,2);
const old=new Function(core.replace(marker,`return {material:validateBaseballMaterialOrientationV1,profile:validateBaseballSeamForceV1,
 coefficient:calculateBaseballSeamCoefficientV1,kernel:createSourceFreeBallKernel,physics:LIVE_MATCH_PHYSICS_V1};`)+';return KneekuraNativeMatchCore;')();
const digest=value=>sha(JSON.stringify(value,(_key,v)=>{if(typeof v!=='number')return v;const bytes=Buffer.allocUnsafe(8);bytes.writeDoubleBE(v);return 'f64:'+bytes.toString('hex');}));
const q=()=>({w:.6541431638256116,x:-.3207507891966091,y:.033712266409371645,z:.6841630913338683}),
 profile=(coefficientScale=1)=>({version:'baseball_seam_force_v1',coefficientScale}),
 failure=run=>{try{run();return null;}catch(e){return e.message;}};
let seed=0x913e7;const draw=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},materials=[],forces=[];
for(let i=0;i<300;i++){
 const raw={w:(draw()-.5)*5,x:(draw()-.5)*5,y:(draw()-.5)*5,z:(draw()-.5)*5},d={x:draw()-.5,y:draw()-.5,z:draw()-.5},length=Math.hypot(d.x,d.y,d.z),direction={x:d.x/length,y:d.y/length,z:d.z/length};
 for(const sign of [1,-1])for(const scale of [0,.01,.5,1,2]){const material={w:raw.w*sign,x:raw.x*sign,y:raw.y*sign,z:raw.z*sign};materials.push(old.material(material));forces.push(old.coefficient(direction,material,profile(scale)));}
}
let getterCalls=0;
const accessor=Object.defineProperty(q(),'x',{enumerable:true,get(){getterCalls++;return 0;}}),hidden=Object.defineProperty(q(),'hidden',{value:1}),symbol=Object.assign(q(),{[Symbol('hidden')]:1}),inherited=Object.assign(Object.create({other:1}),q()),cycle=Object.assign(q(),{self:null});cycle.self=cycle;
const invalidMaterial=[undefined,null,[],accessor,hidden,symbol,inherited,cycle,{...q(),extra:0},{...q(),x:NaN},{...q(),x:Infinity},{w:0,x:0,y:0,z:0}],
 pAccessor=Object.defineProperty(profile(),'coefficientScale',{enumerable:true,get(){getterCalls++;return 1;}}),pCycle=Object.assign(profile(),{self:null});pCycle.self=pCycle;
const invalidProfile=[undefined,null,[],pAccessor,pCycle,Object.assign(profile(),{[Symbol('s')]:1}),Object.defineProperty(profile(),'x',{value:0}),Object.assign(Object.create({x:1}),profile()),{...profile(),extra:0},{...profile(),version:'bad'},profile(-1),profile(2.01),profile(NaN)],
 materialErrors=invalidMaterial.map(raw=>failure(()=>old.material(raw))),profileErrors=invalidProfile.map(raw=>failure(()=>old.profile(raw)));
assert.equal(getterCalls,0);
const kernelSha256={};for(const scale of [0,1,2]){
 const physics=structuredClone(old.physics);physics.air.aerodynamics.seamForce=profile(scale);
 const descriptor={kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:10,elapsedSeconds:0,ball:{tick:10,position:{x:0,y:.15,z:0},velocity:{x:5,y:-2,z:8},spin:{x:35,y:-17,z:12}}},throughElapsedSeconds:.12,profile:physics,materialOrientationAtStart:q()},kernel=old.kernel(descriptor);
 const samples=[];for(const t of [0,.00000035,.005,.031234567,.08,.12])for(const side of ['incoming','outgoing'])samples.push(kernel.evaluateAt(t,side));
 kernelSha256[scale]=digest({boundaries:kernel.boundaries,cells:kernel.cells,samples});
}
const changed=q();changed.x+=.3;
const define=Object.defineProperty;let originalClonePropertyAllocations=0;
Object.defineProperty=(...args)=>{originalClonePropertyAllocations++;return Reflect.apply(define,Object,args);};
try{old.material(q());old.profile(profile());}finally{Object.defineProperty=define;}
const fixture={schemaVersion:1,provenance:{source,htmlSha256:htmlSha,coreSha256:coreSha,runtime:process.version,generator:'tools/browser-bridge/probe-field-latency-v113-seam-golden.mjs',command:'<pinned Node24> tools/browser-bridge/probe-field-latency-v113-seam-golden.mjs',sourceOnly:'frozen V111 Core, no current product imports',originalDirectComparisonReceipt:'09455a',encoding:'SHA-256 of JSON.stringify traversal; each number replaced by f64: plus big-endian IEEE754 hex, preserving signed zero',randomCases:300,signs:[1,-1],scales:[0,.01,.5,1,2]},physics:old.physics,originalClonePropertyAllocations,normalizedMaterial:old.material(q()),changedMaterial:old.material(changed),validatedProfile:old.profile(profile()),materialErrors,profileErrors,materialSha256:digest(materials),forceSha256:digest(forces),kernelSha256};
mkdirSync('src/core/sim/ball/fixtures',{recursive:true});writeFileSync('src/core/sim/ball/fixtures/baseball-seam-validation-v113.json',JSON.stringify(fixture,null,2)+'\n');
console.log(JSON.stringify({forceCases:forces.length,materialSha256:fixture.materialSha256,forceSha256:fixture.forceSha256,kernelSha256}));

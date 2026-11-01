import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),old=await readFile('docs/verification/releases/v120/ordinary-profile-1/frozen-core.js','utf8'),
 current=await readFile('dist/native-match-core-browser.js','utf8'),seam='return __toCommonJS(browser_exports);',
 expose=code=>new Function(code.replace(seam,'return {profile:createAeroGroundBallPhysicsProfile,sample:sampleAerodynamicPitchStateAtElapsedSeconds,kernel:createSourceFreeBallKernel};')+';return KneekuraNativeMatchCore;')(),
 a=expose(old),b=expose(current),input=JSON.parse(await readFile('docs/verification/releases/v120/slow-field-capture/field-input-3.json','utf8'));
assert(input.physics);let samples=0,kernelSamples=0;
for(const coefficient of [true,false])for(const material of [false,true])for(const vacuum of [false,true]){
 const raw=structuredClone(input.physics),aero=raw.air.aerodynamics;
 if(!coefficient){delete aero.coefficientProfile;delete aero.airKinematicViscosityM2PerSecond;delete aero.spinDecay;}
 if(material)aero.seamForce={version:'baseball_seam_force_v1',coefficientScale:.6};else delete aero.seamForce;
 if(vacuum)aero.airDensityKgM3=0;
 Object.assign(aero.windVelocityMps,{x:3,y:-1,z:4});
 const pa=a.profile(raw),pb=b.profile(raw);
 for(const velocity of [{x:30,y:7,z:20},{x:-10,y:-8,z:30}])for(const spin of [{x:100,y:20,z:-30},{x:0,y:0,z:0}]){
  const state={tick:123456,position:{x:2,y:5,z:1},velocity,spin,...(material?{materialOrientation:{w:.5,x:.5,y:.5,z:.5}}:{})};
  for(const t of [0,.0000002,.0000007,.0019999999,.004,.0133333,.321,.713]){
   assert.deepStrictEqual(b.sample(state,t,pb.air),a.sample(state,t,pa.air));samples++;
  }
 }
 const ball={tick:123456,position:{x:0,y:.4,z:0},velocity:{x:12,y:-2,z:6},spin:{x:0,y:12,z:-50}},
  d={kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:123456,elapsedSeconds:0,ball},
   throughElapsedSeconds:.8,profile:raw,...(material?{materialOrientationAtStart:{w:.5,x:.5,y:.5,z:.5}}:{})},
  ka=a.kernel(d),kb=b.kernel(d);
 assert.deepStrictEqual(kb.boundaries,ka.boundaries);
 for(const t of [0,.0000002,.0033333,.1,.3,.8]){assert.deepStrictEqual(kb.evaluateAt(t),ka.evaluateAt(t));kernelSamples++;}
}
const profileFolder=process.argv[3]??'docs/verification/releases/v120/ordinary-profile-4',
 profileSummary=JSON.parse(await readFile(profileFolder+'/summary.json','utf8'));
assert.equal(profileSummary.sourceCoreSha256,sha(current),'field result must use this exact Core');
assert.equal(profileSummary.inputSha256,sha(await readFile('docs/verification/releases/v120/slow-field-capture/field-input-3.json')));
const keys=['frames','facts','ruleFacts','end','finalRunners','recoveryFramesV115'],
 reference=JSON.parse(await readFile('docs/verification/releases/v120/ordinary-profile-1/result.json','utf8')),
 candidate=JSON.parse(await readFile(profileFolder+'/result.json','utf8'));
for(const key of keys)assert.deepStrictEqual(candidate[key],reference[key],key);
const report={pass:true,oldCoreSha256:sha(old),sourceCoreSha256:sha(current),samples,kernelSamples,fullOrdinaryFieldKeys:keys,
 equality:'assert.deepStrictEqual; no tolerance, rounding, coefficient or integration step changes'};
await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

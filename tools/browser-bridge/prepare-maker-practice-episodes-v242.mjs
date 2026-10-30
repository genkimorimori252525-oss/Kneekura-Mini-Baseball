import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve,relative,isAbsolute } from 'node:path';
import { buildPinnedLiveCore,verifyPinnedLiveCore } from '../verification/live-debug-core.mjs';
import { prepareDirectionMakerHtml } from '../verification/prepare-maker-direction.mjs';
const root=process.cwd(),out=resolve(process.argv[2]??''),rel=relative(root,out);
assert(process.argv.length===3&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');
await mkdir(out,{recursive:false});const sha=b=>createHash('sha256').update(b).digest('hex'),basePath='work/maker-observed-spin-v238-candidate-03/maker.html';
const userPath='C:/Users/genki/Downloads/にーくら選手とバット (2).json',paths=[basePath,userPath,'docs/demos/baseball-maker-ball-comparison-v69.js','docs/demos/baseball-maker-batting-practice-v150.js','docs/demos/baseball-maker-pitcher-v92.js','tools/verification/prepare-maker-direction.mjs','tools/browser-bridge/prepare-maker-practice-episodes-v242.mjs','docs/demos/baseball-maker-contact-session-v240.js','docs/demos/baseball-maker-spin-practice-v239.js'];
const pins=Object.fromEntries(await Promise.all(paths.map(async p=>{const b=await readFile(p);return[p,{bytes:b.length,sha256:sha(b)}]})));
assert.equal(pins[basePath].sha256,'aaf9241c672202ebaeb6d8f197b604fe8714f53cbbdd8c76162050d3d0a6a368');
assert.equal(pins[userPath].bytes,59857);assert.equal(pins[userPath].sha256,'e0123a572d66bf6bd5fa92af6c9ffbe6fe47fbcf27d00135c9441bf95927b3ce');
const native=await buildPinnedLiveCore({root,out:resolve(out,'native'),target:'native'}),workbench=await buildPinnedLiveCore({root,out:resolve(out,'workbench'),target:'workbench'});
const [n,w,base,comparison,practice,pitcher]=await Promise.all([verifyPinnedLiveCore({root,manifestPath:resolve(out,'native/manifest.json')}),verifyPinnedLiveCore({root,manifestPath:resolve(out,'workbench/manifest.json')}),
 readFile(basePath,'utf8'),readFile(paths[2],'utf8'),readFile(paths[3],'utf8'),readFile(paths[4],'utf8')]);
assert.equal(native.entry.sha256,sha(n.code));assert.equal(workbench.entry.sha256,sha(w.code));
const retainedFlag='globalThis.KneekuraObservedRegionEnabledV222=true;\n';assert.equal(base.split(retainedFlag).length,2,'one prior V222 flag required');
const helperBase=base.replace(retainedFlag,'');
const built=prepareDirectionMakerHtml({html:helperBase,nativeCode:n.code,workbenchCode:w.code,comparisonSource:comparison,practiceSource:practice,pitcherSource:pitcher});
assert.equal(built.embeddedGameCount,2);assert.equal(built.workbenchCount,1);assert.equal(built.pitcherUiCount,1);
const marker='globalThis.KneekuraBattingPracticeBuildV150=';assert.equal(built.html.split(marker).length,2);
const renderer=await readFile('docs/demos/baseball-maker-contact-session-v240.js','utf8'),spinPanel=await readFile('docs/demos/baseball-maker-spin-practice-v239.js','utf8');
assert.equal(built.html.split(practice).length,2);
let html=built.html.replace(practice,practice+'\n'+renderer+'\n'+spinPanel).replace(marker,'globalThis.KneekuraObservedRegionEnabledV222=true;\n'+marker);
assert.equal((html.match(/globalThis\.KneekuraObservedRegionEnabledV222=true/g)??[]).length,1);
assert(html.includes('batterObservedRegionExperienceV222:core.AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222'),'V222 region was not preserved');
assert(html.includes('KneekuraNativeContactDescriptorEnvelopeV229'),'accepted V229 report was not preserved');
for(const [p,pin] of Object.entries(pins)){const b=await readFile(p);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256,'input changed: '+p)}
const report={boundary:'V242_LOCAL_EPISODE_PRACTICE_NOT_NATIVE_QUALIFICATION',basePath,baseSha256:pins[basePath].sha256,htmlSha256:sha(html),
 native: native.entry,workbench:workbench.entry,comparisonSha256:pins[paths[2]].sha256,practiceSha256:pins[paths[3]].sha256,pitcherSha256:pins[paths[4]].sha256,
 inputPins:pins,observedRegionV222:true,contactEnvelopeV229Retained:true,oldBuildCompatibilityAssumed:false,oldWorkbenchSha256:'157eacbc6e6bfb8d31e20934cff8662a3ec6a972c5465ad7532bc67c0ff41056',
 subject:'1-b0',bats:'L',clipId:'obp-23_5',previewClipNotUsed:'obp-103_5',trialDeclarations:[{technique:'BACKSPIN',delta:{x:0,y:0.01}},{technique:'TOPSPIN',delta:{x:0,y:-0.01}},
  {technique:'SLICE',delta:{x:0.01,y:0}},{technique:'HOOK',delta:{x:-0.01,y:0}}],domainRule:'NORMAL_SUBJECT_CONTACT_PLANE_WITHOUT_CONTACT_DEPTH',zeroProbe:{technique:'TOPSPIN',delta:{x:0,y:0}},
 trialAuthority:'EXPLICIT_UNCALIBRATED_TRIAL_ONLY',earnedQualification:false,newNativeContact:0};
await writeFile(resolve(out,'maker.html'),html,{flag:'wx'});await writeFile(resolve(out,'manifest.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({candidate:resolve(out,'maker.html'),htmlSha256:report.htmlSha256,native:report.native,workbench:report.workbench,trialDeclarations:report.trialDeclarations}));

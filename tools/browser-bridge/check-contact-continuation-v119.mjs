import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const code=await readFile('dist/native-match-core-browser.js','utf8'),sha=b=>createHash('sha256').update(b).digest('hex'),
 baseline=JSON.parse(await readFile('docs/verification/releases/v119/baseline.json','utf8')),
 pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8')),
 input=JSON.parse(await readFile(baseline.fixture.path,'utf8')),seam='return __toCommonJS(browser_exports);';
assert.equal(code.split(seam).length,2);
const api=new Function(code.replace(seam,'return {simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')();
const changed=Object.keys(pins.inputs).filter(p=>pins.inputs[p]!==baseline.nativeInputs[p]).sort();
assert.deepEqual(changed,['src/core/sim/fielding/LiveFieldDecisionV1.ts','src/integration/browser/LiveBaseballMatchV1.ts']);
const observed=[];
for(const [label,variant] of [['original',input],['repeat',input],['render-only',{...input,frameSeconds:.11}]]){
 const before=JSON.stringify(variant),at=performance.now(),r=api.simulate(variant);
 assert(r.end.complete,JSON.stringify(r.diagnostics.unresolvedDetail));assert.equal(JSON.stringify(variant),before);
 assert.equal(r.diagnostics.renderFramesOwnPhysics,false);
 let minimumSampledHipGap=Infinity;
 for(const f of r.frames)for(let i=0;i<f.fielders.length;i++)for(let j=i+1;j<f.fielders.length;j++){
  const a=f.fielders[i].position,b=f.fielders[j].position;
  minimumSampledHipGap=Math.min(minimumSampledHipGap,Math.hypot(a.x-b.x,a.z-b.z)-.48);
 }
 assert(minimumSampledHipGap>=.02-1e-7,'sampled fielders must retain physical clearance');
 assert(r.diagnostics.fielderSeparation.minimumPlannedStepGapMeters>=.02-1e-7);
 const row={label,wallMs:performance.now()-at,end:r.end,minimumSampledHipGap,
  minimumPlannedStepGapMeters:r.diagnostics.fielderSeparation.minimumPlannedStepGapMeters,
  facts:r.facts,ruleFacts:r.ruleFacts,bodyContacts:r.facts.filter(f=>f.kind==='body_contact').length,
  stateSha256:sha(JSON.stringify({facts:r.facts,rules:r.ruleFacts,end:r.end,finalRunners:r.finalRunners})),
  finalCover:r.frames.at(-1).fielders.filter(f=>f.intent==='base_cover').map(f=>({playerId:f.playerId,base:f.targetBase,position:f.position}))};
 observed.push(row);if(label==='original')await writeFile(resolve(out,'field-result.json'),JSON.stringify(r));
}
assert.equal(observed[0].stateSha256,observed[1].stateSha256);
assert.equal(observed[0].stateSha256,observed[2].stateSha256);
const report={pass:true,sourceCoreSha256:sha(code),fixtureSha256:baseline.fixture.sha256,changedNativePaths:changed,
 originalFailureRetained:'numerical_contact_refinement_required/contact_departure',contactPhysicsAndRuleInputsUnchanged:true,cases:observed};
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:true,sourceCoreSha256:report.sourceCoreSha256,cases:observed.map(({label,end,bodyContacts,minimumSampledHipGap,wallMs})=>({label,end,bodyContacts,minimumSampledHipGap,wallMs}))}));

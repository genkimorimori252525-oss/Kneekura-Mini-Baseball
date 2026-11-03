import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]);mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),html=readFileSync('../../outputs/ばせぼーるlv111_TBD_vs_LAD_制球とカウント配球版.html','utf8'),
 embedded=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore =')),
 old=embedded.slice(0,-1),current=readFileSync('dist/native-match-core-browser.js','utf8');
assert.equal(hash(old),'7d71db66c9dad924ad3628bdd644b965fba1c79f901c89e3cb4f0009eef6d0ab');
const expose=code=>new Function(code.replace('return __toCommonJS(browser_exports);','return {simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')().simulate;
const before=expose(old),after=expose(current),cases=[];
for(const file of ['fly-probes/deep-RF-17-22-25.json','fly-probe-fourth/middle-RF-16-21-24.json']){
 const {input}=JSON.parse(readFileSync('docs/verification/releases/v95-investigation/'+file,'utf8')),
  a=before(input),b=after(input),pick=r=>({end:r.end,runner:r.finalRunners.find(x=>x.runnerId==='runner-2'),facts:r.facts,ruleFacts:r.ruleFacts,frames:r.frames});
 assert.deepEqual(pick(a),pick(b),'Legacy results must match the frozen Core');
 cases.push({file,legacyInputHasSeams:!!input.physics.air.aerodynamics.seamForce,runner:pick(a).runner,complete:a.end.complete,
  identicalFramesFactsRules:true,existingExpectedBase:2,passesExistingExpectedBase:pick(a).runner.base===2});
 console.log(JSON.stringify(cases.at(-1)));
}
writeFileSync(resolve(out,'report.json'),JSON.stringify({baselineSha256:hash(old),currentSha256:hash(current),cases},null,2)+'\n');

import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});const original=await readFile('dist/native-match-core-browser.js','utf8'),
 input=JSON.parse(await readFile('docs/verification/cooperative-defense-v120/performance/close-first-weak-input.json','utf8')),rows=[];
for(const bypass of [false,true]){
 let code=original.replace('const liveFieldArrivalSecondsV12 = (actor, target, radius = 0.28) => {',
  'const liveFieldArrivalSecondsV12 = (actor, target, radius = 0.28) => {_stats.calls++;'+(bypass?'return liveFieldArrivalSecondsV1(actor,target,radius);':''));
 assert.notEqual(code,original);code=code.replace('if (cached !== void 0) return cached;\n      const value = liveFieldArrivalSecondsV1(actor, target, radius);',
  'if(cached!==void 0){_stats.hits++;return cached;}\n      const value = liveFieldArrivalSecondsV1(actor, target, radius);');
 const stats={calls:0,hits:0},api=new Function('_stats',code.replace('return __toCommonJS(browser_exports);','return {simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')(stats);
 for(let n=0;n<3;n++){stats.calls=stats.hits=0;const t=performance.now(),r=api.simulate(input);
  rows.push({bypass,n,ms:performance.now()-t,...stats,hash:createHash('sha256').update(JSON.stringify([r.frames,r.facts,r.ruleFacts,r.end,r.finalRunners])).digest('hex')});}
}
assert.equal(new Set(rows.map(r=>r.hash)).size,1);await writeFile(out+'/report.json',JSON.stringify({diagnosticOnly:true,rows},null,2)+'\n');console.log(JSON.stringify(rows));

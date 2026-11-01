import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const code=await readFile('dist/native-match-core-browser.js','utf8'),seam='return __toCommonJS(browser_exports);',debug=process.argv.includes('--capture-rejection'),captured=[],
 instrumented=debug?code.replace('clearanceOptionCacheV120.set(key, safe);','if(!safe&&t<1.1)_captureRejectedV120({query:q,proof,playerId:f.spec.playerId,t}); clearanceOptionCacheV120.set(key, safe);'):code,
 api=new Function('_captureRejectedV120',instrumented.replace(seam,'return {...__toCommonJS(browser_exports),simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')(
  value=>{if(captured.length<20)captured.push(value);}),
 sha=b=>createHash('sha256').update(b).digest('hex'),rows=[];
for(const name of ['close-normal','close-first-weak','close-both-weak','separate-first-weak','first-base-dive-carry']){
 const input=JSON.parse(await readFile('docs/verification/cooperative-defense-v120/performance/'+name+'-input.json','utf8')),at=performance.now(),
  result=api.simulate({...input,recordDecisionTraceV118:true});
 const row={name,wallMs:performance.now()-at,end:result.end,actions:result.diagnostics.athleticDecisionsV115,
  contacts:result.facts.filter(f=>['glove_contact','catch_secured','body_contact','throw_release','controlled_base_contact'].includes(f.kind)),
  safety:result.diagnostics.aiTelemetry.athleticSafetyV120??[],unresolvedDetail:result.diagnostics.unresolvedDetail};
 await writeFile(resolve(out,name+'.json'),JSON.stringify({input,result,summary:row}));rows.push(row);
 if(debug)await writeFile(resolve(out,'rejected-clearance.json'),JSON.stringify(captured));
 console.log(JSON.stringify({name,end:row.end,actions:row.actions,safety:row.safety.slice(-3)}));
}
await writeFile(resolve(out,'report.json'),JSON.stringify({sourceCoreSha256:sha(code),cases:rows,allComplete:rows.every(r=>r.end.complete),pairDives:rows.filter(r=>r.actions.filter(a=>a.kind==='dive').length>=2).map(r=>r.name)},null,2)+'\n');
assert(rows.every(r=>r.end.complete),'all fixture physical continuations required');

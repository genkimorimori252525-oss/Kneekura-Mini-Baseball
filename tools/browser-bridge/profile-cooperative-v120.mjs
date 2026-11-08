import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const code=await readFile('dist/native-match-core-browser.js','utf8'),api=new Function(code.replace('return __toCommonJS(browser_exports);','return {simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')(),
 input=JSON.parse(await readFile('docs/verification/cooperative-defense-v120/performance/close-first-weak-input.json','utf8'));
const rows=[];for(let i=0;i<3;i++){const at=performance.now(),r=api.simulate(input);assert(r.end.complete);rows.push({wallMs:performance.now()-at,end:r.end});}
await writeFile(out+'/result.json',JSON.stringify({diagnosticOnly:true,rows},null,2)+'\n');

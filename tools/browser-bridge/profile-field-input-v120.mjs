import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[3]);await mkdir(out,{recursive:true});
const code=await readFile('dist/native-match-core-browser.js','utf8'),bytes=await readFile(process.argv[2]),input=JSON.parse(bytes),override=process.argv[4]===undefined?null:Number(process.argv[4]);
assert(override===null||[2048,4096,8192].includes(override));
const entry=override===null?'simulateLiveFieldPlayV1':`raw=>withLiveThrowPhysicalMemoV113(()=>simulateLiveFieldPlayScopedV113(raw),{maximumEntries:${override}})`,
 api=new Function(code.replace('return __toCommonJS(browser_exports);',`return {simulate:${entry}};`)+';return KneekuraNativeMatchCore;')(),at=performance.now(),
 result=api.simulate(input),wallMs=performance.now()-at,sha=b=>createHash('sha256').update(b).digest('hex');
await writeFile(out+'/result.json',JSON.stringify(result));
await writeFile(out+'/summary.json',JSON.stringify({diagnosticOnly:true,existingMemoOptionOverride:override,sourceCoreSha256:sha(code),inputSha256:sha(bytes),wallMs,end:result.end,
 actions:result.diagnostics.athleticDecisionsV115,throws:result.facts.filter(f=>f.kind==='throw_release'),factCount:result.facts.length},null,2)+'\n');
assert(result.end.complete);console.log(JSON.stringify({wallMs,end:result.end}));

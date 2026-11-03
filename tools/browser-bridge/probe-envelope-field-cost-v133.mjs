import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const out=resolve(process.argv[2]);await mkdir(out);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const prior=JSON.parse(await readFile('docs/verification/spin-trial-v124/integrity.json','utf8'));
const artifact=prior.artifacts.find(row=>row.path.includes('ばせぼーる')),html=await readFile(artifact.path,'utf8');
assert.equal(sha(html),artifact.sha256);
const oldCode=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).map(s=>s.endsWith('\n')?s.slice(0,-1):s)
 .find(s=>sha(s)===prior.sourceCoreSha256);assert(oldCode);
const newCode=await readFile('dist/native-match-core-browser.js','utf8');
function expose(code){
 const seam='return __toCommonJS(browser_exports);';assert.equal(code.split(seam).length,2);
 // Read-only access to the actual bundled function. No function body, input,
 // clock, RNG, adjudication or Source is replaced by this diagnostic.
 return new Function(code.replace(seam,'return {...__toCommonJS(browser_exports),__fieldCostProbeV133:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')().__fieldCostProbeV133;
}
const functions={old:expose(oldCode),current:expose(newCode)};
const inputBytes=await readFile('docs/verification/swing-envelope-v133/nine-control-final/last-field-input.json');
const source=JSON.parse(inputBytes),before=JSON.stringify(source),cases=[];let expected;
for(const version of ['old','current','current','old']){
 const at=performance.now(),cpu=process.cpuUsage(),record=functions[version](structuredClone(source)),wallMs=performance.now()-at,
  spent=process.cpuUsage(cpu),serialized=JSON.stringify(record),recordSha=sha(serialized);
 if(expected===undefined)expected=serialized;else assert.equal(serialized,expected,'old/current field full-record mismatch');
 assert.equal(JSON.stringify(source),before);
 cases.push({version,wallMs,cpuMs:(spent.user+spent.system)/1000,recordSha,bytes:Buffer.byteLength(serialized)});
}
const report={pass:true,boundary:'ONE_IDENTICAL_FIELD_INPUT_ABBA_COST_DIAGNOSTIC_NOT_NINE_INNING_OR_FPS_PROOF',
 previousCoreSha256:sha(oldCode),sourceCoreSha256:sha(newCode),inputSha256:sha(inputBytes),fullRecordExact:true,cases};
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));

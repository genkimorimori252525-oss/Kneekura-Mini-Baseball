import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]);mkdirSync(out,{recursive:true});
const code=readFileSync('dist/native-match-core-browser.js','utf8'),input=JSON.parse(readFileSync('docs/verification/releases/v113/slow-field-input.json','utf8')),
 baseline=JSON.parse(readFileSync('docs/verification/releases/v113/slow-after-2/result.json','utf8')),
 sha=x=>createHash('sha256').update(x).digest('hex'),needle='return __toCommonJS(browser_exports);';
assert.equal(code.split(needle).length,2);
const simulate=new Function(code.replace(needle,'return {simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')().simulate,
 before=JSON.stringify(input),start=performance.now(),result=simulate(input),wallMs=performance.now()-start;
assert(result.end.complete);assert.equal(JSON.stringify(input),before);
const fields=['end','facts','ruleFacts','frames'],proof=Object.fromEntries(fields.map(k=>[k,{baseline:sha(JSON.stringify(baseline[k])),current:sha(JSON.stringify(result[k]))}]));
for(const k of fields)assert.equal(proof[k].current,proof[k].baseline,'All actual '+k+' unchanged');
writeFileSync(resolve(out,'report.json'),JSON.stringify({pass:true,sourceCoreSha256:sha(code),wallMs,end:result.end,proof,
 originalV111TimeoutSeconds:360,comparison:'intermediate V113 exact-memo result, final Core numerical equivalence',
 timing:'functional concurrent full-nine run; not an isolated benchmark'},null,2)+'\n');
console.log(JSON.stringify({pass:true,wallMs,end:result.end,framesFactsRulesExact:true}));

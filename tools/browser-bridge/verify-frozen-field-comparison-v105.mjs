import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const path=process.argv[2];assert(path,'comparison log path required');
const log=await readFile(path,'utf8'),rows=log.split(/\r?\n/).filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)),
  baseline=rows.find(r=>r.baseline==='FROZEN_V104_NATIVE_CORE'),
  comparisons=rows.filter(r=>r.comparison==='CURRENT_VS_FROZEN_V104_EXACT');
assert.equal(baseline?.sha256,'35a50ab7730b1f4a78390cbca0506774269ec3f6c67dbd7b90a9abe7e8686052');
assert.equal(baseline.instrumentation,'EXPOSE_EXISTING_SIMULATOR_AT_RETURN_ONLY');
assert.equal(comparisons.length,2);assert(comparisons.every(r=>r.sameFactsRulesEndRunners===true));
assert.deepEqual(comparisons.map(r=>r.sha256),[
  'dff3a71a0f924223d7ce4370ccbd58d2b074cba11569a0ca856281e83c40c9c3',
  '2d9f1872a973f64df32e00c9c62ac8545848ea632dd654c5a5fdb302b54cd7b6',
]);
assert(log.includes('Tests  2 failed | 24 skipped (26)'),'original assertion failures must remain visible');
console.log(JSON.stringify({comparisonStatus:'PASS_EXACT_TWO_CASES',
  underlyingSuiteStatus:'FAIL_TWO_PRE_V105_ASSERTIONS_PRESERVED_NOT_V99_BASELINE_NINE',
  log:path,logSha256:createHash('sha256').update(log).digest('hex'),baseline,comparisons},null,2));

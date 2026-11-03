import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder=process.argv[2],mode=process.argv[3],names=['close-normal','close-first-weak','close-both-weak','separate-first-weak','first-base-dive-carry','old-slowest'],
 sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8')),
 config=await json(folder+'/configuration.json'),core=sha(await readFile(config.candidateCore)),rows=[];
assert.deepEqual(config.budgets,{p95Factor:1.25,p95OffsetMs:25,maximumFactor:1.25,maximumOffsetMs:50,maximumRetainedHeapBytes:64*1024*1024});
for(const name of names){
 const before=await json(folder+'/baseline-'+name+'.json'),after=await json(folder+'/'+mode+'-'+name+'.json');
 assert.equal(after.sourceCoreSha256,core);assert.equal(after.inputSha256,before.inputSha256);
 const p95Budget=before.p95===null?null:before.p95*1.25+25,maximumBudget=before.maximum*1.25+50,
  retainedHeapBudget=before.retainedHeapBytes+64*1024*1024,
  checks={p95:p95Budget===null?null:after.p95<=p95Budget,maximum:after.maximum<=maximumBudget,
   retainedHeap:after.retainedHeapBytes<=retainedHeapBudget,complete:after.allComplete};
 rows.push({name,repetitions:after.repetitions,before:{p95:before.p95,maximum:before.maximum,end:before.end},
  after:{p95:after.p95,maximum:after.maximum,retainedHeapBytes:after.retainedHeapBytes,end:after.end},
  budgets:{p95:p95Budget,maximum:maximumBudget,retainedHeapBytes:retainedHeapBudget},checks,
  pass:Object.values(checks).every(v=>v!==false)});
}
const report={pass:rows.every(r=>r.pass),sourceCoreSha256:core,mode,budgetUnchanged:true,peakHeapMeasured:false,
 methods:config.methodology,passed:rows.filter(r=>r.pass).length,total:rows.length,rows};
await writeFile(folder+'/verdict-'+mode+'.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,passed:report.passed,total:report.total}));if(!report.pass)process.exitCode=1;

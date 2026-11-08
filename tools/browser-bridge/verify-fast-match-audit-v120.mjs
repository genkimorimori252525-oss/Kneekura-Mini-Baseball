import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='docs/verification/fast-match-parity-2026-10-26',json=async p=>JSON.parse(await readFile(p,'utf8')),
 sha=v=>createHash('sha256').update(v).digest('hex'),
 main=await json(base+'/run-2/report.json'),one=await json(base+'/numeric-1/report.json'),five=await json(base+'/numeric-5/report.json'),
 continuation=await json(base+'/continuation-1/report.json'),normal=await json(base+'/run-2/normal-prefix.json'),node=await json(base+'/run-2/node-prefix.json'),
 core='5b8aae080ef0fc600f171653ce5aa5315a181d50b8b38bb0e136c26459603912';
assert.equal(main.pass,false);assert.equal(main.cases.length,4);assert(main.failure.includes('ERR_ASSERTION'));
for(const r of [main,one,five,continuation])assert.equal(r.sourceCoreSha256,core);
assert(one.inputTransportExact&&five.inputTransportExact);assert.equal(one.changedStructure,0);assert.equal(five.changedStructure,0);
assert(one.changedNumbers>0&&five.changedNumbers>0);assert.equal(one.pass,false);assert.equal(five.pass,false);
assert.notEqual(one.mathProbes.node[1],one.mathProbes.chrome[1]);
assert(continuation.pass&&continuation.compared===8&&continuation.fieldPlays===2);
assert(continuation.seedAlias2To32Confirmed&&continuation.crossConfigurationContinuationAccepted);
assert.equal(normal.length,12);assert.equal(node.length,12);assert.equal(normal.filter(r=>r.field).length,4);
for(const c of main.cases){assert(c.match);if(c.fullRecordDigests){
 if(c.jobs)for(const digests of c.fullRecordDigests)assert.deepEqual(digests,normal.slice(0,8).map(r=>r.full));
 else assert.deepEqual(c.fullRecordDigests,normal.map(r=>r.full));
}}
for(const key of ['rules','scoring','after','ticks'])assert.deepEqual(node.map(r=>r[key]),normal.map(r=>r[key]));
assert.equal(normal.filter((r,i)=>r.full!==node[i].full).length,12);assert.equal(normal.filter((r,i)=>r.facts!==node[i].facts).length,1);
const pins=await json('dist/native-match-core-browser.js.inputs.json');assert.equal(pins.entrySha256,core);
assert.equal(sha(await readFile('dist/native-match-core-browser.js')),core);
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(path)),hash,path);
const candidate=await json('docs/verification/releases/v120/candidate-integrity.json');
for(const r of candidate.artifacts)assert.equal(sha(await readFile(r.path)),r.sha256,r.path);
const receipts=[];
for(const [id,result]of [['3f28a013d7c843958d7169945a40559c','FAIL'],['3bc1779274fd486b85febee0c8fdcc01','FAIL'],
 ['a270df7492cd4f118e84ec0b591868c7','FAIL'],['a669cdeca37c43aaab874a2670e7f7a2','FAIL'],['cdc0eebce3ee484599eed226a584afb3','PASS']]){
 const path='docs/ai-continuity/verification-receipts/MB-20261026-FAST-MATCH-PARITY-AUDIT_'+id+'.json',r=await json(path);
 assert.equal(r.task_id,'MB-20261026-FAST-MATCH-PARITY-AUDIT');assert.equal(r.result,result);assert.equal(sha(await readFile(r.output_path)),r.output_sha256);
 receipts.push({path,result,sha256:sha(await readFile(path))});
}
const report={auditEvidenceConsistent:true,validationScope:'audit findings and preserved product integrity; not universal simulation parity',
 sourceCoreSha256:core,nativeInputsUnchanged:Object.keys(pins.inputs).length,candidateArtifactsUnchanged:candidate.artifacts.length,
 sameChromePrefixParity:true,normalFastComparedPitches:12,fieldPlays:4,independentWorkerControl:{jobs:2,pitchesEach:8},
 sameNodeContinuationParity:true,crossRuntimeStrictParity:false,observedCrossRuntimeRulesScoringAndTicksMatchPitches:12,
 fullNineInningCrossModeComparison:false,hundredGameSimulationExecuted:false,calibrationCertified:false,
 receipts,limits:['finite fixed prefix only','not all seeds, browser versions, architectures or pitch types','no new player parameter calibration',
  'timing/FPS and peak memory not measured','V120 performance goal and psychology connection remain unresolved']};
await writeFile(base+'/SUMMARY.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

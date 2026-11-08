import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=resolve(process.argv[2]??'docs/verification/releases/v84/fielding-matrix');
await mkdir(output,{recursive:true});
const bundled=await build({entryPoints:['src/core/sim/fielding/LiveFieldPlayDiagnosticsV1.ts'],bundle:true,write:false,
 format:'cjs',platform:'node',target:'es2022',logLevel:'silent'}),module={exports:{}};
// Run trusted compiled repository code in the Node realm. A separate vm realm
// magnifies prototype/clone checks and is unsuitable for this timing harness.
new Function('module','exports','require',bundled.outputFiles[0].text)(module,module.exports,createRequire(import.meta.url));
const api=module.exports,report={pass:false,scope:'Default 20-scenario physical diagnostics; result counts are observations, not probability targets.',cases:[]};
try{
 for(const scenario of api.CANONICAL_FIELDING_SCENARIOS_V1){
  const {input,roleMap}=api.buildCanonicalFieldingPlayInputV1(scenario,'default'),d=api.diagnoseLiveFieldPlayV1(input,undefined,roleMap);
  report.cases.push({id:scenario.id,category:scenario.category,end:d.end,outs:d.outsRecorded,anomalies:d.anomalies});
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  assert(d.end.complete,scenario.id+' complete');assert.equal(d.anomalies.length,0,scenario.id+' anomalies');
 }
 report.infieldOuts=report.cases.filter(c=>['infield_grounder','slow_roller','double_play'].includes(c.category)).reduce((s,c)=>s+c.outs,0);
 report.totalOuts=report.cases.reduce((s,c)=>s+c.outs,0);report.pass=true;
 console.log(JSON.stringify({pass:true,infieldOuts:report.infieldOuts,totalOuts:report.totalOuts,cases:report.cases.map(c=>[c.id,c.outs])}));
}finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');}

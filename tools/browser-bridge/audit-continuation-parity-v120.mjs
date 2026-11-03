import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]),capture='docs/verification/fast-match-parity-2026-10-26/run-2',
 code=await readFile('dist/native-match-core-browser.js','utf8'),sha=v=>createHash('sha256').update(v).digest('hex');
function canonical(v){return JSON.stringify(v,(_key,x)=>x===undefined?{$auditSpecial:'undefined'}:
 typeof x==='number'&&(!Number.isFinite(x)||Object.is(x,-0))?{$auditSpecial:Object.is(x,-0)?'-0':String(x)}:x);}
function restore(v){
 if(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&Object.hasOwn(v,'$auditSpecial'))
  return v.$auditSpecial==='-0'?-0:v.$auditSpecial==='undefined'?undefined:v.$auditSpecial==='NaN'?NaN:v.$auditSpecial==='Infinity'?Infinity:-Infinity;
 if(Array.isArray(v))return v.map(restore);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,restore(x)]));return v;
}
const config=restore(JSON.parse(await readFile(capture+'/configuration.json','utf8'))),expected=JSON.parse(await readFile(capture+'/node-prefix.json','utf8')),
 api=new Function(code+';return KneekuraNativeMatchCore;')(),report={pass:false,sourceCoreSha256:sha(code),compared:0,fieldPlays:0,mode:'same-Node-capture-resume-every-pitch',
 completeGames:0,populationGames:0,doesNotCertifyCrossRuntimeParity:true};
await mkdir(out,{recursive:false});
try{
 let continuation;
 for(const row of expected.slice(0,8)){
  const host=api.createLiveBaseballMatchWorkerV116(config,continuation),r=host.issuePitch(row.command);
  assert.equal(sha(canonical(r)),row.full);report.compared++;if(r.play.field)report.fieldPlays++;
  continuation=host.captureContinuationV116();
 }
 const command=expected[0].command,a=api.createLiveBaseballMatchV1({...config,seed:1234}),b=api.createLiveBaseballMatchV1({...config,seed:1234+2**32});
 assert.equal(sha(canonical(a.issuePitch(command))),sha(canonical(b.issuePitch(command))));report.seedAlias2To32Confirmed=true;
 const changed={...config,park:{...config.park,fenceHeightMeters:(config.park?.fenceHeightMeters??3)+1}};
 api.createLiveBaseballMatchWorkerV116(changed,continuation);report.crossConfigurationContinuationAccepted=true;
 report.pass=true;
}catch(e){report.failure=String(e.stack??e);process.exitCode=1;}
await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

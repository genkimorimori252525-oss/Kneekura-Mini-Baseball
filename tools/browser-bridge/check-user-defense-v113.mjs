import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),coreSha=sha(await readFile('dist/native-match-core-browser.js')),
 report={pass:false,sourceCoreSha256:coreSha,cases:[],concurrentFunctionalFullMatchRuns:true};
try{
 for(const pitch of [14,18,35,44]){
  const inputPath='docs/verification/releases/v113/user-capture-3/pitch-'+pitch+'-field-input.json',bytes=await readFile(inputPath),input=JSON.parse(bytes),dir=resolve(out,'pitch-'+pitch),
   child=spawnSync(process.execPath,['tools/browser-bridge/probe-user-defense-v113.mjs',inputPath,dir],{encoding:'utf8',timeout:90000});
  assert.equal(child.status,0,child.stderr??child.error?.message);
  const r=JSON.parse(await readFile(resolve(dir,'result.json'),'utf8')),s=JSON.parse(await readFile(resolve(dir,'summary.json'),'utf8'));
  assert.equal(s.coreSha256,coreSha);assert(r.end.complete);assert.equal(sha(await readFile(inputPath)),sha(bytes));
  const row={pitch,end:r.end,wallMs:s.wallMs,roleTransitions:r.diagnostics.aiTelemetry.roleTransitions,
   contacts:r.diagnostics.aiTelemetry.contactDiagnostics,memo:r.diagnostics.throwPhysicalMemoV113,
   firstMovements:r.diagnostics.aiTelemetry.firstMovementV98,controlledBases:r.ruleFacts.controlledBaseContacts.map(f=>f.base)};
  if(pitch===18)assert.deepEqual(row.controlledBases,[2,1]);
  if(pitch===35||pitch===44){
   const id=pitch===35?'0-b2':'0-b7',spec=input.fielders.find(f=>f.playerId===id);
   assert(row.roleTransitions.some(t=>t.handlerId===id&&t.source==='forecast_attempt'));
   const initial=r.frames[0].fielders.find(f=>f.playerId===id),cross=r.frames.find(f=>
    (initial.position.x-f.ball.position.x)*f.ball.velocity.x+(initial.position.z-f.ball.position.z)*f.ball.velocity.z<0)?.elapsedSeconds??input.ball.elapsedSeconds+2,
    attempted=r.frames.filter(f=>f.elapsedSeconds<cross).map(f=>f.fielders.find(a=>a.playerId===id)).filter(a=>a.intent==='intercept');
   assert(attempted.length>0);row.maximumAttemptMovementBeforePassing=Math.max(...attempted.map(a=>Math.hypot(a.position.x-initial.position.x,a.position.z-initial.position.z)));
   assert(row.maximumAttemptMovementBeforePassing>.1);
   const first=row.firstMovements.find(f=>f.playerId===id);assert(first.firstMovementCommand.elapsedSeconds+1e-10>=input.ball.elapsedSeconds+spec.reactionSeconds+(spec.fieldingCognition?.decisionSeconds??0));
  }
  for(const f of r.diagnostics.bodyGeometryV105?.contacts??[])assert(f.reachMarginMeters>=-1e-7);
  report.cases.push(row);
 }
 report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;}
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,cases:report.cases.length,error:report.error}));

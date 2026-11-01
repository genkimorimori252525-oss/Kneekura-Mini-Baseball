import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder=process.argv[2]??'docs/verification/releases/v109/investigation';await mkdir(folder,{recursive:true});
const html=await readFile('../../outputs/ばせぼーるlv108_TBD_vs_LAD_一塁送球判断版.html','utf8'),
 oldCode=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('var KneekuraNativeMatchCore ='))[1],
 code=await readFile('dist/native-match-core-browser.js','utf8'),api=s=>new Function(s+';return KneekuraNativeMatchCore;')(),
 old=api(oldCode),current=api(code),request=JSON.parse(await readFile('docs/demos/field-double-play-v106.json','utf8')),
 report={diagnosticOnly:true,oldHtmlSha256:createHash('sha256').update(html).digest('hex'),cases:[]};
assert.equal(report.oldHtmlSha256,'5bc87f8251418dbdd836fe928aaa510e8799f0f771e3a79908604fc92f640ed9');
for(const [label,ssX,arm]of [['original',-13,null],['distant-shortstop',-16,null],['more-distant-shortstop',-20,null],['strong-arm',-13,65]]){
 const r=structuredClone(request);r.fieldInput.placements.SS.x=ssX;
 if(arm!==null)r.fieldInput.players.find(p=>p.playerId===r.fieldInput.defense['2B']).physical.throwSpeedMps=arm;
 const versions=[];
 for(const [version,engine]of [[108,old],[109,current]]){
  const start=performance.now(),result=engine.runFieldPracticeV98(r),f=result.field,first=f.facts.find(x=>x.kind==='throw_release'),
   frame=first?[...f.frames].reverse().find(x=>x.elapsedSeconds<=first.elapsedSeconds):null,
   receiver=frame?.fielders.find(x=>x.playerId===first.receiverPlayerId),base=r.fieldInput.field.bases.second;
  versions.push({version,generationMs:performance.now()-start,end:f.end,outs:result.rules?.match?.outs,
   firstReceiverDistanceAtRelease:receiver?Math.hypot(receiver.position.x-base.x,receiver.position.z-base.z):null,
   facts:f.facts.filter(x=>['throw_release','catch_secured','controlled_base_contact','runner_base_touch'].includes(x.kind)),
   efforts:f.diagnostics.throwEffortCommandsV103,timing:f.diagnostics.aiTelemetry.receiveTimingV99,
   cancellations:f.diagnostics.throwEffortCancellationsV103});
 }
 report.cases.push({label,request:r,versions});
}
await writeFile(folder+'/receiver-timed-comparison.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.cases.map(c=>({label:c.label,versions:c.versions.map(r=>({version:r.version,outs:r.outs,firstReceiverDistanceAtRelease:r.firstReceiverDistanceAtRelease,
 release:r.facts.find(f=>f.kind==='throw_release'),firstEffort:r.efforts[0],end:r.end}))})),null,2));

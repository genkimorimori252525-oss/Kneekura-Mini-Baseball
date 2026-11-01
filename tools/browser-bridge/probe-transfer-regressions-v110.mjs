import {readFile,writeFile,mkdir} from 'node:fs/promises';
const out=process.argv[2];if(!out)throw Error('new evidence folder required');await mkdir(out,{recursive:true});
const code=await readFile('dist/native-match-core-browser.js','utf8'),api=new Function(code+';return KneekuraNativeMatchCore;')(),rows=[];
for(const id of ['default','late','rf','rf-weak']){
 const request=JSON.parse(await readFile('docs/demos/'+(['default','late'].includes(id)?'field-double-play-v106.json':'field-rf-ground-v107.json'),'utf8'));
 if(id==='late')request.fieldInput.placements.SS.x=-16;
 if(id==='rf-weak')request.fieldInput.players.find(p=>p.playerId===request.fieldInput.defense.RF).physical.throwSpeedMps=20;
 const r=api.runFieldPracticeV98(request),f=r.field;rows.push({id,request,result:r});
 console.log(JSON.stringify({id,end:f.end,retired:f.finalRunners.filter(a=>a.retired).length,
  facts:f.facts.filter(a=>['catch_secured','throw_release'].includes(a.kind)),
  commands:f.diagnostics.throwEffortCommandsV103,cancellations:f.diagnostics.throwEffortCancellationsV103,
  hands:f.diagnostics.handPreparationProofs,decisions:f.diagnostics.aiTelemetry.holderDecisions.slice(-5),
  throws:f.diagnostics.throwDecisions.slice(-8)}));
}
await writeFile(out+'/report.json',JSON.stringify(rows,null,2)+'\n',{flag:'wx'});

import {readFile,writeFile,mkdir} from 'node:fs/promises';
const out=process.argv[2];if(!out)throw Error('new evidence folder required');await mkdir(out,{recursive:true});
const code=await readFile('dist/native-match-core-browser.js','utf8'),api=new Function(code+';return KneekuraNativeMatchCore;')(),
 base=JSON.parse(await readFile('docs/demos/field-double-play-v106.json','utf8')),rows=[];
for(const [id,x,z,shift]of [['slower',-12,14,false],['shift',-18,21,true],['slower-shift',-12,14,true]]){
 const request=structuredClone(base),i=request.fieldInput;i.ball.ball.velocity={x,y:-2,z};
 if(shift)i.placements['3B']={...i.placements['3B'],x:-18,z:23};
 const r=api.runFieldPracticeV98(request),f=r.field,roles=Object.keys(i.defense),role=id=>roles.find(k=>i.defense[k]===id),
  row={id,request,end:f.end,retired:f.finalRunners.filter(a=>a.retired).length,
   catches:f.facts.filter(a=>a.kind==='catch_secured').map(a=>({role:role(a.playerId),t:a.elapsedSeconds})),
   releases:f.facts.filter(a=>a.kind==='throw_release').map(a=>({from:role(a.playerId),to:role(a.receiverPlayerId),t:a.elapsedSeconds,base:a.base})),
   commands:f.diagnostics.throwEffortCommandsV103,baseContacts:f.ruleFacts.controlledBaseContacts};
 rows.push(row);console.log(JSON.stringify({id,end:row.end,retired:row.retired,catches:row.catches,releases:row.releases}));
}
await writeFile(out+'/report.json',JSON.stringify(rows,null,2)+'\n',{flag:'wx'});

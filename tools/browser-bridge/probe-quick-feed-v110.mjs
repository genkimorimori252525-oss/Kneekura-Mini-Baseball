import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.argv[2]??'docs/verification/releases/v110/investigation';await mkdir(out,{recursive:true});
const html=await readFile('../../outputs/にーくら野球メーカー_v109_受球同期の軽送球版.html','utf8'),
 expected='3fd26b8f4c72765f04b89c3d2aada411809bee19496601f2f9f399ec84c72064';
assert.equal(createHash('sha256').update(html).digest('hex'),expected);
const code=process.argv[3]==='current'?await readFile('dist/native-match-core-browser.js','utf8'):
 [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('var KneekuraMakerCore ='))?.[1];
// The maker and normal Host expose different entry objects over the same Core.
let api;
if(code)api=new Function(code+';return typeof KneekuraNativeMatchCore!=="undefined"?KneekuraNativeMatchCore:KneekuraMakerCore;')();
else{
 const normal=await readFile('../../outputs/ばせぼーるlv109_TBD_vs_LAD_受球同期の軽送球版.html','utf8'),
  core=[...normal.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('var KneekuraNativeMatchCore ='))[1];
 api=new Function(core+';return KneekuraNativeMatchCore;')();
}
const request=JSON.parse(await readFile('docs/demos/field-double-play-v106.json','utf8')),result=api.runFieldPracticeV98(request),f=result.field,
 holder=request.fieldInput.defense['2B'],secure=f.facts.find(x=>x.kind==='catch_secured'&&x.playerId===holder),
 release=f.facts.find(x=>x.kind==='throw_release'&&x.playerId===holder),
 report={makerSha256:expected,source:process.argv[3]==='current'?'current':'frozen-v109',request,result};
await writeFile(out+'/second-force.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({secure,release,delay:release.elapsedSeconds-secure.elapsedSeconds,
 profile:result.input.fielders.find(x=>x.playerId===holder),effort:f.diagnostics.throwEffortCommandsV103[0],
 transfer:f.diagnostics.transferTimingV101,hand:f.diagnostics.handPreparationProofs.filter(x=>x.playerId===holder),
 receiving:f.diagnostics.aiTelemetry.receiveTimingV99.filter(x=>x.throwerPlayerId===holder).slice(0,8),
 timeline:f.frames.filter(x=>x.elapsedSeconds>=secure.elapsedSeconds&&x.elapsedSeconds<=release.elapsedSeconds).map(x=>{
 const a=x.fielders.find(x=>x.playerId===holder);return {t:x.elapsedSeconds,crouch:a.bodyPoseV105.crouchMeters,
 forward:a.bodyPoseV105.forward,glove:a.glove,intent:a.intent};})},null,2));

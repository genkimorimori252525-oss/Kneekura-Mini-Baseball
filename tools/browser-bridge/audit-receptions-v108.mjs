import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.argv[2]??'docs/verification/releases/v108/investigation/receptions-baseline';await mkdir(out,{recursive:true});
const bundle=await readFile('dist/native-match-core-browser.js','utf8'),api=new Function(bundle+';return KneekuraNativeMatchCore;')(),
 bases=JSON.parse(await readFile('docs/verification/releases/v108/investigation/maker-v107-base-requests/report.json','utf8')).requests,
 sha=s=>createHash('sha256').update(s).digest('hex'),report={bundleSha256:sha(bundle),cases:[]};
for(const team of ['0','1'])for(const [label,direction,pitch]of [['SS',-18,0],['2B',18,0],['3B',-40,0],['1B',40,0],['bounce-low',-18,-.04],['bounce-mid',-18,-.08],['bounce-deep',-18,-.12],['bounce-rolling',-18,-.25]]){
 const r=structuredClone(bases[team]),a=direction*Math.PI/180,speed=27.5;r.fieldInput.maxPlaySeconds=15;
 r.fieldInput.ball.ball.velocity={x:Math.sin(a)*speed,y:-1.8,z:Math.cos(a)*speed};
 if(pitch)r.executionPerturbationsV95={throwErrors:[{releaseOrdinal:0,yawRadians:0,pitchRadians:pitch}]};
 const started=performance.now(),result=api.runFieldPracticeV98(r),f=result.field,
 releases=f.facts.filter(f=>f.kind==='throw_release'),after=releases[0]?.elapsedSeconds??Infinity,
 groundFrames=f.frames.filter(x=>x.elapsedSeconds>after&&x.ball.visible&&x.ball.phase!=='airborne'),
 groundContactsAfterRelease=f.facts.filter(f=>f.kind==='ground_contact'&&f.elapsedSeconds>after).length,
 contacts=f.diagnostics.aiTelemetry.contactDiagnostics.map(c=>({...c,afterThrow:c.elapsedSeconds>after}));
 const row={label,team,generationMs:performance.now()-started,end:f.end,outs:result.rules?.match?.outs,
 request:r,contacts,groundContactsAfterRelease,groundAfterRelease:groundFrames.length,field:f};report.cases.push(row);}
await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.cases.map(({label,team,generationMs,end,outs,contacts,groundContactsAfterRelease,groundAfterRelease})=>({label,team,generationMs,end,outs,contacts,groundContactsAfterRelease,groundAfterRelease})),null,2));

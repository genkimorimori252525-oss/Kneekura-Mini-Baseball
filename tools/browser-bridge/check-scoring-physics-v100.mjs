import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const oldHtml=await readFile('../../outputs/ばせぼーるlv99_TBD_vs_LAD_守備連携と送球判断版.html','utf8'),
 oldCore=[...oldHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore =')),
 newCore=await readFile('dist/native-match-core-browser.js','utf8'),measured=JSON.parse(await readFile('docs/demos/measured-bat-motions.json','utf8')),
 roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],teams=[0,1].map(t=>({id:'team-'+t,name:'Team '+t,battingOrder:Array.from({length:9},(_,i)=>t+'-b'+i),pitcherId:t+'-p0',defense:Object.fromEntries(roles.map((r,i)=>[r,i===0?t+'-p0':t+'-b'+(i-1)]))})),
 input={seed:2468,innings:9,teams,players:[0,1].flatMap(t=>[...Array.from({length:9},(_,i)=>({playerId:t+'-b'+i,name:'Player '+t+'-'+i,heightMeters:1.8,bats:i%3===0?'L':'R'})),{playerId:t+'-p0',name:'Pitcher '+t,heightMeters:1.88,bats:'R'}]),measuredClips:measured.clips},
 contexts=[oldCore,newCore].map(source=>{const ctx=vm.createContext({inputJson:JSON.stringify(input),performance:{now:()=>0}});vm.runInContext('var structuredClone=v=>JSON.parse(JSON.stringify(v));\n'+source+'\nvar host=KneekuraNativeMatchCore.createLiveBaseballMatchV1(JSON.parse(inputJson));',ctx);return ctx;}),report={pass:false,rows:[]};
for(let i=0;i<12;i++){
 const texts=contexts.map(ctx=>vm.runInContext(`(()=>{const r=host.issuePitch({managedTeam:0,batting:'balanced',pitchType:'auto',location:'auto'});const {localScoringV100,...play}=r.play;return JSON.stringify({...r,play,hits:null,errors:null});})()`,ctx));
 assert.equal(texts[1],texts[0],'v99 physical/rule/presentation result changed at pitch '+(i+1));const r=JSON.parse(texts[1]);
 report.rows.push({pitch:i+1,classification:r.play.classification,field:!!r.play.field,sha256:createHash('sha256').update(texts[1]).digest('hex')});
}
report.pass=true;await writeFile(resolve(out,'physical-equivalence.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,pitches:report.rows.length,fieldPlays:report.rows.filter(r=>r.field).length}));

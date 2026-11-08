import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
if(process.argv[3]==='profile'){
 const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads'),fs=require('node:fs'),inspector=require('node:inspector');const session=new inspector.Session();session.connectToMainThread();session.post('Profiler.enable',()=>session.post('Profiler.start',()=>{parentPort.postMessage('ready');setTimeout(()=>session.post('Profiler.stop',(error,result)=>{fs.writeFileSync(workerData,JSON.stringify(error?{error:String(error)}:result.profile));session.disconnect();parentPort.postMessage('done');}),30000);}));`,{eval:true,workerData:resolve(out,'cpu-profile.json')});
 await once(worker,'message');
}
let code=await readFile('dist/native-match-core-browser.js','utf8');
for(const [needle,insert]of[
 ['const frames = pitch.frames.map',"observer({phase:'after_pitch',pitchCount,pitch});\nconst frames = pitch.frames.map"],
 ['field = simulateLiveFieldPlayV1(fieldInput);',"observer({phase:'before_field',pitchCount,fieldInput});\nfield = simulateLiveFieldPlayV1(fieldInput);\nobserver({phase:'after_field',pitchCount,end:field.end});"],
 ['while (time < max && !terminal) {',"while (time < max && !terminal) { observer({phase:'field_step',time,controlThrough});"],
 ['plan(time, controlThrough);',"observer({phase:'plan_start',time});plan(time, controlThrough);observer({phase:'plan_end',time});"],
]){assert.equal(code.split(needle).length,2);code=code.replace(needle,insert);}
const observer=event=>{appendFileSync(resolve(out,'phases.jsonl'),JSON.stringify({phase:event.phase,pitch:event.pitchCount===undefined?null:event.pitchCount+1,time:event.time,at:performance.now()})+'\n');if(event.pitchCount!==undefined)writeFileSync(resolve(out,event.phase+'-'+(event.pitchCount+1)+'.json'),JSON.stringify(event));};
const api=new Function('observer',code+';return KneekuraNativeMatchCore;')(observer),clips=JSON.parse(await readFile('docs/demos/measured-bat-motions.json','utf8')).clips,
 roles=['P','C','1B','2B','3B','SS','LF','CF','RF'],teams=[0,1].map(t=>({id:'team-'+t,name:'Team '+t,battingOrder:Array.from({length:9},(_,i)=>t+'-b'+i),pitcherId:t+'-p0',defense:Object.fromEntries(roles.map((r,i)=>[r,i===0?t+'-p0':t+'-b'+(i-1)]))})),
 players=[0,1].flatMap(t=>[...Array.from({length:9},(_,i)=>({playerId:t+'-b'+i,name:'Player '+t+'-'+i,heightMeters:1.8,bats:i%3===0?'L':'R'})),{playerId:t+'-p0',name:'Pitcher '+t,heightMeters:1.88,bats:'R'}]),
 host=api.createLiveBaseballMatchV1({seed:2468,innings:9,teams,players,measuredClips:clips});
for(const batting of ['power','balanced'])host.issuePitch({managedTeam:0,batting,pitchType:'auto',location:'auto'});
console.log('both pitches completed');

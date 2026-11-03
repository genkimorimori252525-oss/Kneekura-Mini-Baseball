import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const inputPath=resolve(process.argv[2]),out=resolve(process.argv[3]);
await mkdir(out,{recursive:true});
const code=await readFile(process.argv[4]??'dist/native-match-core-browser.js','utf8'),needle='return __toCommonJS(browser_exports);';
assert.equal(code.split(needle).length,2);
const api=new Function(code.replace(needle,'return {...__toCommonJS(browser_exports),simulateFieldV113:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')();
const input=JSON.parse(await readFile(inputPath,'utf8'));
const started=performance.now(),result=api.simulateFieldV113({...input,recordInitialMovementV98:true}),wallMs=performance.now()-started;
await writeFile(resolve(out,'result.json'),JSON.stringify(result));
const firstCatch=result.facts.find(f=>f.kind==='catch_secured'),through=firstCatch?.elapsedSeconds??result.end.elapsedSeconds,
 frames=result.frames.filter(f=>f.elapsedSeconds<=through),initial=frames[0];
const summary={coreSha256:createHash('sha256').update(code).digest('hex'),inputPath,wallMs,end:result.end,firstCatch,
 roleTransitions:result.diagnostics.aiTelemetry.roleTransitions,firstMovement:result.diagnostics.aiTelemetry.firstMovementV98,
 fielders:input.fielders.map(spec=>{
  const actorFrames=frames.map(f=>({time:f.elapsedSeconds,ball:f.ball,actor:f.fielders.find(a=>a.playerId===spec.playerId)}));
  const first=actorFrames[0].actor;let closest=null,maxSpeed=0;
  for(const f of actorFrames){
   const a=f.actor,gap=Math.hypot(a.glove.x-f.ball.position.x,a.glove.y-f.ball.position.y,a.glove.z-f.ball.position.z);
   maxSpeed=Math.max(maxSpeed,Math.hypot(a.velocity.x,a.velocity.y,a.velocity.z));
   if(!closest||gap<closest.gap)closest={gap,time:f.time,actor:a,ball:f.ball};
  }
  return {playerId:spec.playerId,position:spec.defensivePosition,start:first,closest,maxSpeed,
   snapshots:actorFrames.filter((_,i)=>i%9===0).map(f=>({time:f.time,position:f.actor.position,velocity:f.actor.velocity,glove:f.actor.glove,intent:f.actor.intent,ball:f.ball.position}))};
 })};
await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({wallMs,end:result.end,firstCatch,fielders:summary.fielders.map(f=>({id:f.playerId,position:f.position,maxSpeed:f.maxSpeed,gap:f.closest.gap,at:f.closest.time,intent:f.closest.actor.intent}))}));

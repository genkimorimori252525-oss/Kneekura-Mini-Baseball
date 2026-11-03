import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const html=await readFile('../../outputs/ばせぼーるlv116_TBD_vs_LAD_動作検証と先読み生成版.html','utf8'),
 code=process.argv[3]?await readFile(process.argv[3],'utf8'):[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore =')).slice(0,-1),
 input=JSON.parse(await readFile('docs/verification/releases/v117/replay-v116-2/field-input.json','utf8')),
 seam='const forecasts = defenders.map((f) => ({ f, predicted: forecast(f, t) }));',rows=[],horizons=[];
assert.equal(code.split(seam).length,2);
const trace=x=>{if(x.t<input.ball.elapsedSeconds+2.8&&(!rows.length||x.t-rows.at(-1).t>=.15))rows.push(x);},
 patched=code.replace(seam,seam+'\n_traceV117({t,rows:forecasts.map(({f,predicted:p})=>({id:f.spec.playerId,position:at(f.body,t),prediction:p?{point:p.point,eta:p.eta,intercepted:p.intercepted,attempt:p.attempt}:null}))});')
 .replace('const lateness = Math.max(travel, wait + postureTime) - h;', 'const lateness = Math.max(travel, wait + postureTime) - h; if(t===start&&f.spec.defensivePosition==="1B"&&h<3)_horizonV117({h,point:p,travel,wait,postureTime,lateness,horizontalReach:horizontalReachAt(p.y)});'),
 api=new Function('_traceV117','_horizonV117',patched.replace('return __toCommonJS(browser_exports);','return {simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')(trace,x=>horizons.push(x)),
 at=performance.now(),result=api.simulate({...input,recordInitialMovementV98:true});
const firstCatch=result.facts.find(f=>f.kind==='catch_secured'),through=firstCatch?.elapsedSeconds??result.end.elapsedSeconds,
 fielders=input.fielders.map(spec=>{
  const frames=result.frames.filter(f=>f.elapsedSeconds<=through),initial=frames[0].fielders.find(f=>f.playerId===spec.playerId),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  let closest=null;for(const f of frames){const a=f.fielders.find(f=>f.playerId===spec.playerId),gap=dist(a.glove,f.ball.position);
   if(!closest||gap<closest.gap)closest={gap,time:f.elapsedSeconds,actor:a,ball:f.ball};}
  return{id:spec.playerId,role:spec.defensivePosition,spec,maximumMovement:Math.max(...frames.map(f=>dist(f.fielders.find(a=>a.playerId===spec.playerId).position,initial.position))),closest};
 });
await writeFile(resolve(out,'trace.json'),JSON.stringify(rows,null,2));await writeFile(resolve(out,'horizons.json'),JSON.stringify(horizons,null,2));await writeFile(resolve(out,'result.json'),JSON.stringify(result));
const report={pass:result.end.complete,coreSha256:createHash('sha256').update(code).digest('hex'),wallMs:performance.now()-at,firstCatch,end:result.end,fielders,roleTransitions:result.diagnostics.aiTelemetry.roleTransitions};
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,wallMs:report.wallMs,firstCatch,fielders:fielders.map(f=>({id:f.id,role:f.role,move:f.maximumMovement,gap:f.closest.gap,at:f.closest.time}))}));
const contrasts=[];
for(const [label,change]of [['quick-response',{reactionSeconds:.13,fieldingCognition:{decisionSeconds:.035,pursuitCostWeight:1}}],['reaction-zero',{reactionSeconds:0,fieldingCognition:{decisionSeconds:0,pursuitCostWeight:1}}]]){
 const variant=structuredClone(input),first=variant.fielders.find(f=>f.defensivePosition==='1B');Object.assign(first,change);
 const x=api.simulate({...variant,recordInitialMovementV98:true});
 contrasts.push({label,onlyFirstBasemanResponseChanged:true,firstCatch:x.facts.find(f=>f.kind==='catch_secured'),facts:x.facts,
  end:x.end,roleTransitions:x.diagnostics.aiTelemetry.roleTransitions,initialMovement:x.diagnostics.aiTelemetry.firstMovementV98,
  pitcherFrames:x.frames.filter((_,i)=>i%10===0).map(f=>({t:f.elapsedSeconds,fielder:f.fielders.find(a=>a.playerId===variant.fielders.find(a=>a.defensivePosition==='P').playerId)}))});
}
await writeFile(resolve(out,'response-contrasts.json'),JSON.stringify(contrasts,null,2));

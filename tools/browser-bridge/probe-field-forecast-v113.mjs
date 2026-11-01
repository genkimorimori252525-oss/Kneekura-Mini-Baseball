import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const input=JSON.parse(await readFile(process.argv[2],'utf8')),out=resolve(process.argv[3]);await mkdir(out,{recursive:true});
let code=await readFile('dist/native-match-core-browser.js','utf8');
const patches=[
 ['const postureTime = f.spec.bodyModelV105 ?', 'const postureTime = f.spec.bodyModelV105 ?'],
 ['if ((f.spec.bodyModelV105 ? horizontalReachAt(p.y) >= 0', '_forecastTraceV113({id:f.spec.playerId,t,h,p,bodyPos,bodyVel,wait,travel,postureTime,reach:horizontalReachAt(p.y)});\n if ((f.spec.bodyModelV105 ? horizontalReachAt(p.y) >= 0'],
 ['const forecasts = defenders.map((f) => ({ f, predicted: forecast(f, t) }));','if(t-start>1.25)throw new Error("DIAGNOSTIC_STOP_V113");\n const forecasts = defenders.map((f) => ({ f, predicted: forecast(f, t) }));'],
 ['return __toCommonJS(browser_exports);','return {...__toCommonJS(browser_exports),simulateFieldV113:simulateLiveFieldPlayV1};']
];
for(const [from,to] of patches){assert.equal(code.split(from).length,2,from);code=code.replace(from,to);}
const records=[];const trace=r=>{if(['0-b2','0-b7','1-b1'].includes(r.id)&&r.t<=input.ball.elapsedSeconds+.001)records.push(r);};
const api=new Function('_forecastTraceV113',code+';return KneekuraNativeMatchCore;')(trace);
try{api.simulateFieldV113(input);throw new Error('diagnostic stop missing');}catch(e){assert.match(e.message,/DIAGNOSTIC_STOP_V113/);}
await writeFile(resolve(out,'forecast.json'),JSON.stringify(records));
console.log(JSON.stringify([...new Set(records.map(r=>r.id))].map(id=>({id,near:records.filter(r=>r.id===id&&r.h<=1.5).sort((a,b)=>a.travel-a.h-(b.travel-b.h)).slice(0,4)}))));

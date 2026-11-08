import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const version=Number(arg('--helper','66')),sourcePath=resolve(arg('--source','../../outputs/v66-audit-source-18.json')),
 evidence=resolve(arg('--out','../../outputs/verification-v66-swing-running')),
 plain=x=>JSON.parse(JSON.stringify(x)),sha=x=>createHash('sha256').update(x).digest('hex'),
 angular=(a,b)=>Math.hypot(Math.atan2(Math.sin(a.yaw-b.yaw),Math.cos(a.yaw-b.yaw)),a.pitch-b.pitch),
 pose=v=>({eye:plain(v.eye),yaw:v.yaw,pitch:v.pitch}),
 oldLimits={impactMaxMotionRadians:.025,impactMaxSpeedRadPerSecond:.18},
 report={pass:false,helperVersion:version,phase:'load',cases:[],failures:[],rateContract:'COMPOSED_INTERVAL_SPEED_LE_MAX_2_5_OR_SAME_INTERVAL_ZERO_COUPLING_BASE_PLUS_1E_8',strictInheritedBaseLimit:true,existingBaseNumericalOvershoots:[]},factories={};
const demand=(condition,message)=>{if(!condition)report.failures.push(message);};
function at(controller,record,batter,seconds,prep,previousRecord=null,capSeconds=seconds){
 const origin=record.frames[0].tick,tps=record.play.diagnostics.sourceClockTicksPerSecond;
 let frame=record.beforeFrame??record.frames[0];
 for(const f of record.frames){if(f.tick>origin+capSeconds*tps)break;frame=f;}
 return controller.observe({record,frame,sceneMs:prep+seconds*1000,preparationMs:prep,batter,previousRecord});
}
function clockFor(record){
 const d=record.play.diagnostics,o=record.frames[0].tick,tps=d.sourceClockTicksPerSecond,
  start=(d.referenceStartTick-o)/tps,impact=(d.referenceContactTick-o)/tps,through=(d.referenceThroughTick-o)/tps,
  runner=record.frames.find(f=>f.actors.some(a=>a.playerId===record.batterPlayerId&&a.role==='runner'&&Math.hypot(a.velocity?.x??0,a.velocity?.z??0)>.01)),
  runStart=runner?(runner.tick-o)/tps:null,end=Math.max(through+.8,(runStart??0)+.6);
 return{start,impact,through,runStart,times:[...new Set([...Array.from({length:Math.ceil(end*500)+1},(_,i)=>i*.002),start,impact,through,through+.4,...(runStart===null?[]:[runStart,runStart+.14,runStart+.4])])].filter(t=>t>=0).sort((a,b)=>a-b)};
}
async function capture(){
 const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'),
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{const p=await browser.newPage();await p.goto(pathToFileURL(resolve('docs/demos/releases/v65/game.html')).href);await p.waitForFunction(()=>window.liveMatchPlayback);
  await p.evaluate(()=>{const el=document.getElementById('auto-overhead');el.checked=false;el.dispatchEvent(new Event('change'));for(let i=0;i<18;i++){const choice=document.getElementById('pitch-choice');choice.value=i<3?'auto':'curve';choice.dispatchEvent(new Event('change'));document.getElementById('next-pitch').click();liveMatchPlayback.stop();}});
  const source=await p.evaluate(()=>{const s=liveMatchPlayback.inspect();return{records:s.host.history,players:s.physicalRoster.players,prep:s.presentation.timing.preparationMs,error:s.error};});assert.equal(source.error,null);
  await p.evaluate(()=>{liveMatchPlayback.newGame();document.getElementById('managed-team').value='0';document.getElementById('batting-choice').value='bunt';document.getElementById('next-pitch').click();liveMatchPlayback.stop();});source.bunt=await p.evaluate(()=>liveMatchPlayback.inspect().lastResult);
  await writeFile(sourcePath,JSON.stringify(source)+'\n');return source;
 }finally{await browser.close();}
}
try{
 await mkdir(evidence,{recursive:true});for(const v of [...new Set([59,61,63,version])]){const math=Object.create(Math);math.random=()=>{throw Error('random camera movement forbidden');};const context={Math:math},text=await readFile('tools/browser-bridge/live-camera-tuning-batter-view-v'+v+'.js','utf8');runInNewContext(text,context);factories[v]=context.KneekuraCameraTuningBatterView;if(v===version)report.helperSha256=sha(text);}
 const source=args.includes('--capture')?await capture():JSON.parse(await readFile(sourcePath,'utf8')),sourceHash=sha(JSON.stringify(source)),
  swings=source.records.map((record,index)=>({record,index})).filter(({record})=>record.play.diagnostics.swingOffered),
  takes=source.records.filter(record=>!record.play.diagnostics.swingOffered),personFor=r=>{const p=source.players.find(p=>p.playerId===r.batterPlayerId);return{...p,height:p.heightMeters,hand:r.play.diagnostics.battingSide};};
 assert(swings.length>=4&&takes.length>0);report.sourceSha256=sourceHash;report.sourceRecords=source.records.length;report.sourcePath=sourcePath;
 report.phase='actual-running-regression';
 for(const {record:r,index}of swings){const batter=personFor(r),clock=clockFor(r),prev=source.records[index-1]??null,
  zero=factories[version].create({swingHeadCoupling:0}),coupled=factories[version].create({swingHeadCoupling:.025}),strong=factories[version].create({swingHeadCoupling:.08}),
  oldZero=factories[63].create({swingHeadCoupling:0}),v59=factories[59].create(),restore=factories[version].create({...oldLimits,swingUsesAbsoluteVision:false,swingHeadCoupling:0}),
  v61=factories[61].create(),absolute=factories[version].create({...oldLimits,swingUsesAbsoluteVision:true,swingHeadCoupling:0}),
  row={pitch:index,side:batter.hand,curve:r.pitchType==='curve',timingErrorSeconds:r.play.diagnostics.timingErrorSeconds,...Object.fromEntries(['start','impact','through','runStart'].map(k=>[k,clock[k]])),maximumCoupledDifferenceRadians:0,maximumImpactDifferenceRadians:0,maximumOutputSpeedRadPerSecond:0,maximumRateOverInheritedBudgetRadPerSecond:0,carryoverAfterThrough400msRadians:0,runStartCoupledRadians:null,runPlus140msCoupledRadians:null,bodyEyeExact:true,zeroMatchesPrevious63:true,boundaryStrength:{gain:.08,maximumDifferenceRadians:0,maximumOutputSpeedRadPerSecond:0,maximumRateOverInheritedBudgetRadPerSecond:0,carryoverAfterThrough400msRadians:0}};
  let last=null,impactView=null;
  for(const t of clock.times){const z=at(zero,r,batter,t,source.prep,prev),c=at(coupled,r,batter,t,source.prep,prev),maximum=at(strong,r,batter,t,source.prep,prev),prior=at(oldZero,r,batter,t,source.prep,prev),old59=at(v59,r,batter,t,source.prep,prev),restored=at(restore,r,batter,t,source.prep,prev),old61=at(v61,r,batter,t,source.prep,prev),absoluteView=at(absolute,r,batter,t,source.prep,prev),difference=angular(c,z),boundaryDifference=angular(maximum,z);
   assert.deepEqual(plain(c.eye),plain(z.eye),'head coupling must not move/delay body-eye position');
   assert.deepEqual(plain(maximum.eye),plain(z.eye),'maximum coupling must not move/delay body-eye position');
   assert.deepEqual(pose(z),pose(prior),'uncoupled controller must retain v63 baseline');
   assert.deepEqual(pose(restored),pose(old59),'explicit old limits and coupling0 restore v59 swing');
   assert.deepEqual(pose(absoluteView),pose(old61),'explicit absolute vision and old limits retain v61');
   row.maximumCoupledDifferenceRadians=Math.max(row.maximumCoupledDifferenceRadians,difference);
   row.boundaryStrength.maximumDifferenceRadians=Math.max(row.boundaryStrength.maximumDifferenceRadians,boundaryDifference);
   if(t>=clock.impact&&t<=clock.through)row.maximumImpactDifferenceRadians=Math.max(row.maximumImpactDifferenceRadians,difference);
   if(t>=clock.through+.4){row.carryoverAfterThrough400msRadians=Math.max(row.carryoverAfterThrough400msRadians,difference);row.boundaryStrength.carryoverAfterThrough400msRadians=Math.max(row.boundaryStrength.carryoverAfterThrough400msRadians,boundaryDifference);}
   if(t===clock.runStart)row.runStartCoupledRadians=difference;
   if(clock.runStart!==null&&t===clock.runStart+.14)row.runPlus140msCoupledRadians=difference;
   if(last){const dt=t-last.t;if(dt>1e-10){const speed=angular(c,last.c)/dt,baseSpeed=angular(z,last.z)/dt,strongSpeed=angular(maximum,last.maximum)/dt,budget=Math.max(2.5,baseSpeed);if(speed>row.maximumOutputSpeedRadPerSecond){row.maximumOutputSpeedRadPerSecond=speed;row.maximumSpeedWindow={fromSeconds:last.t,toSeconds:t,fromYaw:last.c.yaw,fromPitch:last.c.pitch,toYaw:c.yaw,toPitch:c.pitch,baseSpeedRadPerSecond:baseSpeed,headResponse:c.tuning?.swingHeadResponse??null};}row.boundaryStrength.maximumOutputSpeedRadPerSecond=Math.max(row.boundaryStrength.maximumOutputSpeedRadPerSecond,strongSpeed);row.maximumRateOverInheritedBudgetRadPerSecond=Math.max(row.maximumRateOverInheritedBudgetRadPerSecond,speed-budget);row.boundaryStrength.maximumRateOverInheritedBudgetRadPerSecond=Math.max(row.boundaryStrength.maximumRateOverInheritedBudgetRadPerSecond,strongSpeed-budget);if(baseSpeed>2.5+1e-8){report.strictInheritedBaseLimit=false;report.existingBaseNumericalOvershoots.push({pitch:index,fromSeconds:last.t,toSeconds:t,baseSpeedRadPerSecond:baseSpeed,composedDefaultSpeedRadPerSecond:speed,composedMaximumGainSpeedRadPerSecond:strongSpeed});}}}
   if(t===clock.impact)impactView=c;
   if(impactView&&t>=clock.impact&&t<=clock.through)row.maximumImpactMotionRadians=Math.max(row.maximumImpactMotionRadians??0,angular(c,impactView));
   last={t,c,z,maximum};
  }
  demand(row.carryoverAfterThrough400msRadians===0,'pitch '+index+': swing head coupling carries into established runner/field gaze: '+row.carryoverAfterThrough400msRadians+' rad');
  demand(row.maximumRateOverInheritedBudgetRadPerSecond<=1e-8,'pitch '+index+': default response exceeds same-interval inherited rate budget: '+row.maximumRateOverInheritedBudgetRadPerSecond);
  demand(row.boundaryStrength.maximumRateOverInheritedBudgetRadPerSecond<=1e-8,'pitch '+index+': maximum response exceeds same-interval inherited rate budget: '+row.boundaryStrength.maximumRateOverInheritedBudgetRadPerSecond);
  demand(row.boundaryStrength.carryoverAfterThrough400msRadians===0,'pitch '+index+': maximum head coupling carries into established runner/field gaze: '+row.boundaryStrength.carryoverAfterThrough400msRadians+' rad');
  report.cases.push(row);
 }
 const curves=report.cases.filter(c=>c.curve);report.coverage={left:report.cases.filter(c=>c.side==='L').length,right:report.cases.filter(c=>c.side==='R').length,earlyCurves:curves.filter(c=>c.timingErrorSeconds<0).length,lateCurves:curves.filter(c=>c.timingErrorSeconds>=0).length};
 assert(report.coverage.left&&report.coverage.right&&report.coverage.earlyCurves&&report.coverage.lateCurves,'actual left/right and early/late curve coverage');
 demand(report.cases.some(c=>c.maximumImpactDifferenceRadians>1e-5),'actual bat-derived impact head response must remain visible');
 report.phase='take-bunt-and-rewind';assert(source.bunt,'actual bunt record required');
 for(const r of [...takes.slice(0,2),source.bunt]){const batter=personFor(r),clock=clockFor(r);for(const absolute of[false,true]){const old=factories[63].create({swingUsesAbsoluteVision:absolute,swingHeadCoupling:0}),now=factories[version].create({swingUsesAbsoluteVision:absolute,swingHeadCoupling:.08});for(const t of clock.times)assert.deepEqual(pose(at(now,r,batter,t,source.prep)),pose(at(old,r,batter,t,source.prep)),'taking/bunting cannot acquire swing body response');}}
 report.takeAndBuntUnchanged=true;
 const chosen=swings.find(({record})=>record.play.diagnostics.battingSide==='R')??swings[0],r=chosen.record,batter=personFor(r),clock=clockFor(r);
 for(const cap of[.12,clock.start+.012,clock.impact-.01]){const clean=plain(r),poison=plain(r),origin=poison.frames[0].tick,tps=poison.play.diagnostics.sourceClockTicksPerSecond;for(const f of poison.frames)if(f.tick>origin+cap*tps)for(const key of['bat','ball','actors','possessedBy','ballKind','homeRunConfirmed','phase'])Object.defineProperty(f,key,{get(){throw Error('unavailable future '+key);}});Object.defineProperty(poison.play,'contactMoment',{get(){throw Error('future contact payload');}});Object.defineProperty(poison,'result',{get(){throw Error('future official result');}});assert.deepEqual(plain(at(factories[version].create(),poison,batter,clock.through+.6,source.prep,null,cap)),plain(at(factories[version].create(),clean,batter,clock.through+.6,source.prep,null,cap)),'unavailable future samples cannot drive head response');}
 const seek=factories[version].create();for(const t of[clock.through+.6,clock.impact,.1,clock.start,clock.through,.12,clock.through+.4])assert.deepEqual(plain(at(seek,r,batter,t,source.prep)),plain(at(factories[version].create(),r,batter,t,source.prep)),'seek and replay must not retain future head response');
 report.futurePayloadAndSeek=true;assert.equal(sha(JSON.stringify(source)),sourceHash,'verification cannot mutate Source physics, rules, bat or runner data');
 report.summary={swings:report.cases.length,...report.coverage,maximumOutputSpeedRadPerSecond:Math.max(...report.cases.map(c=>c.maximumOutputSpeedRadPerSecond)),maximumCarryoverRadians:Math.max(...report.cases.map(c=>c.carryoverAfterThrough400msRadians)),maximumImpactDifferenceRadians:Math.max(...report.cases.map(c=>c.maximumImpactDifferenceRadians)),strictInheritedBaseLimit:report.strictInheritedBaseLimit,existingBaseOvershootIntervals:report.existingBaseNumericalOvershoots.length,maximumExistingBaseSpeedRadPerSecond:Math.max(0,...report.existingBaseNumericalOvershoots.map(r=>r.baseSpeedRadPerSecond)),maximumRateOverInheritedBudgetRadPerSecond:Math.max(...report.cases.flatMap(c=>[c.maximumRateOverInheritedBudgetRadPerSecond,c.boundaryStrength.maximumRateOverInheritedBudgetRadPerSecond]))};
 assert.equal(report.failures.length,0,report.failures.join('\n'));report.pass=true;report.phase='complete';console.log(JSON.stringify({pass:true,helperVersion:version,...report.summary}));
}catch(error){report.error=String(error.stack??error);console.error(report.error);process.exitCode=1;}
finally{await mkdir(evidence,{recursive:true});await writeFile(resolve(evidence,'swing-running-check.json'),JSON.stringify(report,null,2)+'\n');}

// Diagnostic only. Instruments the pinned bundle in memory; no public API or source edits.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {once} from 'node:events';
const expectedCore='3d0ef3a2477816a3157e59f9a8235e1459913fa35f74f791541c8cee8e885a37',
 source='docs/verification/releases/v113/slow-user110-field-input.json',
 expectedInput='344818f3abace15d032aeecab17eb8759d6f92eb8db2255891109276981296ce',
 sha=v=>createHash('sha256').update(v).digest('hex');
assert.equal(process.versions.node.split('.')[0],'24','Use pinned Node24');
if(isMainThread){
 assert(process.argv.length>=3&&process.argv.length<=4,'Usage: node check-seam-command-v113.mjs <new-evidence-directory> [timeout-ms]');
 const out=resolve(process.argv[2]),root=resolve('docs/verification/releases/v113'),timeoutMs=Number(process.argv[3]??60000);
 assert.equal(dirname(out),root,'Evidence must be a new direct child of releases/v113');
 assert(Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=120000);
 const code=readFileSync('dist/native-match-core-browser.js'),bytes=readFileSync(source);
 assert.equal(sha(code),expectedCore,'Pinned latest Core');assert.equal(sha(bytes),expectedInput,'Pinned raw user110 input');
 mkdirSync(out,{recursive:false});
 const physicsSource='src/core/sim/ball/fixtures/baseball-seam-validation-v113.json',physicsBytes=readFileSync(physicsSource),
  aero=JSON.parse(physicsBytes).physics.air.aerodynamics,v=(x=0,y=0,z=0)=>({x,y,z}),
  synthetic={ball:{originTick:0,elapsedSeconds:0,ball:{tick:0,position:v(0,.2,0),velocity:v(1,-1,5),spin:v()}},
   physics:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:4000,gravityY:-9.81,
    aerodynamics:{...aero,seamForce:{version:'baseball_seam_force_v1',coefficientScale:1}}},
    ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,
     material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}},
   field:{bases:{home:v(),first:v(19.39,0,19.39),second:v(0,0,38.78),third:v(-19.39,0,19.39)},fenceRadiusMeters:110,fenceHeightMeters:2},
   fielders:[v(0,1,10),v(0,1,-2),v(20,1,20),v(-20,1,20),v(12,1,35),v(-12,1,35),v(-35,1,65),v(0,1,75),v(35,1,65)]
    .map((position,i)=>({playerId:'f'+i,position,reactionSeconds:.08,topSpeedMps:7,accelerationMps2:6,gloveSpeedMps:8,gloveReachMeters:1.3,gloveRadiusMeters:.1,
     transferSeconds:.25,throwEffortBuildSecondsV103:.6,throwSpeedMps:34,catchRetention:{ticksPerSecond:1e6,ballMassKg:.145,ballRadiusMeters:.0366,
      pocketRadiusMeters:.3,centerRetentionCapacityJ:150,captureDissipationPowerW:3000,failedContactRestitution:.2,failedTangentialDamping:.4,failedSpinDamping:.2}})),
   runners:[{runnerId:'batter',initialBase:0,topSpeedMps:3,accelerationMps2:3,reactionSeconds:.1}],outs:0,maxPlaySeconds:18,seed:101,
   orientation:{w:1,x:0,y:0,z:0}},
  cases=[{name:'raw-user110',input:JSON.parse(bytes),requireActual:false},
   {name:'public-canonical-effort-fixture-with-seams',input:synthetic,requireActual:true}],
  manifest={runtime:process.version,node:process.execPath,coreSha256:sha(code),inputPath:source,inputSha256:sha(bytes),timeoutMs,
   syntheticBasis:'LiveThrowEffortIntegrationV103.test.ts fixture(.6,34), plus seam scale1 / explicit identity orientation',
   syntheticPhysicsSource:physicsSource,syntheticPhysicsSourceSha256:sha(physicsBytes),syntheticInputSha256:sha(JSON.stringify(synthetic)),
   memoryInstrumentationOnly:true,productSourcesChanged:false,fullArgumentsWritten:false};
 writeFileSync(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 const started=performance.now(),results=[];
 for(const scenario of cases){
  const worker=new Worker(new URL(import.meta.url),{workerData:{code:code.toString('utf8'),input:scenario.input,requireActual:scenario.requireActual}}),ready=once(worker,'message'),
   result=new Promise(resolveResult=>{worker.on('message',m=>{if(m.kind==='result'||m.kind==='failure')resolveResult(m);});worker.once('error',e=>resolveResult({kind:'failure',error:String(e),stack:e.stack}));});
  await ready;worker.postMessage('go');let timer;
  const remaining=Math.max(0,timeoutMs-(performance.now()-started)),
   outcome=await Promise.race([result,new Promise(resolveTimeout=>{timer=setTimeout(()=>resolveTimeout({kind:'timeout'}),remaining);})]);
  clearTimeout(timer);await worker.terminate();const row={name:scenario.name,...outcome};results.push(row);
  writeFileSync(resolve(out,scenario.name+'.json'),JSON.stringify(row,null,2)+'\n');
  if(outcome.kind!=='result')break;
 }
 assert.equal(sha(readFileSync('dist/native-match-core-browser.js')),expectedCore,'Core unchanged during check');
 assert.equal(sha(readFileSync(source)),expectedInput,'Raw input unchanged during check');
 assert.equal(sha(readFileSync(physicsSource)),manifest.syntheticPhysicsSourceSha256,'Frozen fixture unchanged during check');
 const pass=results.length===2&&results.every(r=>r.kind==='result'&&r.pass)&&results[1].actualReleaseChecks==='EXERCISED',
  report={pass,results,wallMs:performance.now()-started,manifest};
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({out,pass,wallMs:report.wallMs,cases:results.map(r=>({name:r.name,kind:r.kind,end:r.end,counts:r.counts,actualReleaseChecks:r.actualReleaseChecks}))}));
 assert.equal(pass,true,'Both raw mean-policy and synthetic full-execution checks must pass');
}else{
 const input=workerData.input,before=JSON.stringify(input),originalScale=input.physics.air.aerodynamics.seamForce.coefficientScale,
  stack=[],counts={},records={refreshes:[],finalSolves:[],releaseSources:[]};let lastDirection=null;
 assert(originalScale>0);
 const count=name=>counts[name]=(counts[name]??0)+1,
  norm=v=>Math.hypot(v.x,v.y,v.z),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),
  sameVector=(a,b)=>['x','y','z'].every(k=>Object.is(a[k],b[k])),
  averaged=(physics,phase)=>{assert.equal(physics.air.aerodynamics.seamForce?.coefficientScale??0,0,'Candidate keeps unknown seam averaged');assert.equal(phase,undefined,'Unknown material phase must not enter candidate solve');
   const {seamForce:_ignored,...actual}=physics.air.aerodynamics,{seamForce:_original,...expected}=input.physics.air.aerodynamics;
   assert.deepEqual(actual,expected,'Wind/drag/Magnus/spin decay and every other air field retained');assert.deepEqual(physics.ground,input.physics.ground);},
  full=(physics,phase)=>{assert.deepEqual(physics,input.physics,'Execution retains complete authored physics');assert(phase&&['w','x','y','z'].every(k=>Number.isFinite(phase[k])),'Execution retains material phase');};
 function trace(name,args,invoke){
  const a=args[0],candidate=stack.includes('planLiveTransferActionV110'),forecast=stack.includes('createLiveFieldForecastV1');
  if(name==='planLiveRelayV1'){averaged(a.physics,a.materialOrientationAtRelease);count('meanRelayComparisons');}
  if(name==='planLiveTransferActionV110'){averaged(a.physics,a.materialOrientationAtRelease);count(stack.includes('estimateLiveDefenseControlV95')?'meanRunnerComparisons':stack.includes('planLiveRelayV1')?'meanRelayLegs':'meanDirectOrDpComparisons');}
  if(name==='planLiveThrowActionV103'&&!candidate){full(a.physics,a.materialOrientationAtRelease);count('fullRefreshAttempts');}
  if(name==='planLiveThrowV1'){
   if(candidate){averaged(a.physics,a.materialOrientationAtRelease);count('meanThrowSolves');}
   else{full(a.physics,a.materialOrientationAtRelease);count(stack.includes('planLiveThrowActionV103')?'fullRefreshSolves':'fullFinalSolves');}
  }
  if(name==='createSourceFreeBallKernel'){
   if(candidate||forecast){averaged(a.profile,a.materialOrientationAtStart);count('meanPredictionKernels');}
   else{full(a.profile,a.materialOrientationAtStart);count(stack.includes('planLiveThrowV1')?'fullVerificationKernels':'fullWorldKernels');}
  }
  stack.push(name);let result;
  try{result=invoke();}finally{stack.pop();}
  if(name==='planLiveThrowActionV103'&&!candidate)records.refreshes.push({kind:result.kind,capacityMps:a.capacityMps,
   commandSpeedMps:result.commandSpeedMps,chargeElapsedSeconds:a.chargeElapsedSeconds,remainingChargeSeconds:result.remainingChargeSeconds,flightSeconds:result.flightSeconds});
  if(name==='planLiveThrowV1'&&!candidate&&!stack.includes('planLiveThrowActionV103')){
   records.finalSolves.push({kind:result.kind,maximumThrowSpeedMps:a.maximumThrowSpeedMps,relativeReleaseSpeedMps:result.relativeReleaseSpeedMps,flightSeconds:result.flightSeconds});
   if(result.kind==='planned')assert(result.relativeReleaseSpeedMps<=a.maximumThrowSpeedMps+1e-10,'Full final solve respects issued cap');
  }
  if(name==='applyLiveThrowDirectionV1'){lastDirection={input:a,result};count('actualDirectionCommands');}
  if(name==='createSourceFreeBallKernel'&&!candidate&&!forecast&&!stack.includes('planLiveThrowV1')&&lastDirection){
   assert(sameVector(a.initial.ball.velocity,lastDirection.result.velocity),'Actual launch uses admitted direction velocity');
   records.releaseSources.push({elapsedSeconds:a.initial.elapsedSeconds,seamScale:a.profile.air.aerodynamics.seamForce.coefficientScale,
    materialOrientationPresent:!!a.materialOrientationAtStart,relativeSpeedMps:norm(sub(a.initial.ball.velocity,lastDirection.input.bodyVelocity))});lastDirection=null;
  }
  return result;
 }
 try{
  let code=workerData.code;const end='return __toCommonJS(browser_exports);';assert.equal(code.split(end).length,2,'Unique export hook');
  const names=['estimateLiveDefenseControlV95','planLiveRelayV1','planLiveTransferActionV110','planLiveThrowActionV103','planLiveThrowV1','createLiveFieldForecastV1','createSourceFreeBallKernel','applyLiveThrowDirectionV1'];
  for(const name of names)assert.equal([...code.matchAll(new RegExp('(?:function '+name+'[(]|var '+name+' =)','g'))].length,1,'Unique existing function hook '+name);
  const wrappers=names.map(name=>`const original_${name}=${name};${name}=(...args)=>trace(${JSON.stringify(name)},args,()=>original_${name}(...args));`).join('\n');
  code=code.replace(end,wrappers+'\nreturn {simulateField:simulateLiveFieldPlayV1};');
  const api=new Function('trace',code+';return KneekuraNativeMatchCore;')(trace);
  parentPort.postMessage({kind:'ready'});await once(parentPort,'message');
  const result=api.simulateField(input),d=result.diagnostics,releases=result.facts.filter(f=>f.kind==='throw_release');
  assert.equal(JSON.stringify(input),before,'Input immutable');assert.equal(result.end.complete,true,'Physical field simulation completed');
  if(workerData.requireActual){assert((counts.fullRefreshAttempts??0)>0);assert((counts.fullFinalSolves??0)>0);assert(releases.length>0,'Synthetic actual releases required, no vacuous success');}
  else{assert((counts.meanRelayComparisons??0)>0);assert((counts.meanDirectOrDpComparisons??0)>0);}
  assert.equal(records.releaseSources.length,releases.length,'Every actual release has a full-material Source');
  assert.equal(d.throwDirectionCommands.length,releases.length);
  const checks=releases.map((f,i)=>{
   const command=d.throwEffortCommandsV103.filter(c=>c.playerId===f.playerId&&c.from<=f.elapsedSeconds+1e-12).at(-1),
    raw=input.fielders.find(p=>p.playerId===f.playerId),direction=d.throwDirectionCommands[i],relativeSpeedMps=norm(sub(direction.actual.velocity,direction.bodyVelocity)),
    readiness=d.aiTelemetry.receiveTimingV99.filter(r=>r.throwerPlayerId===f.playerId&&r.receiverPlayerId===f.receiverPlayerId&&Math.abs(r.elapsedSeconds-f.elapsedSeconds)<=1e-10).at(-1);
   assert(command&&raw&&readiness,'Actual release requires command/raw capacity/readiness evidence');assert.equal(readiness.allow,true);
   assert(command.capacitySpeedMps<=raw.throwSpeedMps+1e-10);assert(command.commandSpeedMps<=command.capacitySpeedMps+1e-10);
   assert(relativeSpeedMps<=command.commandSpeedMps+1e-10);assert(f.elapsedSeconds+1e-10>=command.readyAt,'Actual accumulated charge ready');
   assert.equal(records.releaseSources[i].elapsedSeconds,f.elapsedSeconds);
   return{playerId:f.playerId,receiverPlayerId:f.receiverPlayerId,elapsedSeconds:f.elapsedSeconds,relativeSpeedMps,
    commandSpeedMps:command.commandSpeedMps,capacitySpeedMps:command.capacitySpeedMps,rawThrowSpeedMps:raw.throwSpeedMps,
    readyAt:command.readyAt,readinessAllow:readiness.allow,source:records.releaseSources[i]};
  });
  parentPort.postMessage({kind:'result',pass:true,end:result.end,counts,checks,records,inputUnchanged:true,
   actualReleaseChecks:releases.length?'EXERCISED':'NOT_EXERCISED_NO_RELEASE',
   diagnostics:{runnerThrowPredictionV113:d.runnerThrowPredictionV113,throwComparisonV113:d.throwComparisonV113},
   factsSha256:sha(JSON.stringify(result.facts)),rulesSha256:sha(JSON.stringify(result.ruleFacts)),framesSha256:sha(JSON.stringify(result.frames))});
 }catch(error){parentPort.postMessage({kind:'failure',error:String(error),stack:error.stack,counts,records});}
}

import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);
const prefixOnly=process.argv.includes('--prefix-only');
if(!artifactArg||!evidenceArg)throw Error('requires HTML and NEW evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(evidence,{recursive:false});
const packetBytes=await readFile('docs/demos/live-game-roster-v2.json'),packet=JSON.parse(packetBytes),pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));
const sourceInputCount=Object.keys(pins.inputs).length;
assert.equal(sourceInputCount,108,'current v51 Core includes the new fielder-avoidance module');
const report={artifact,sha256:sha(await readFile(artifact)),packetSha256:sha(packetBytes),nativeBundleSha256:pins.entrySha256,views:[]};
report.mode=prefixOnly?'final-presentation-prefix':'normal-nine-inning-game';
const fullProof=prefixOnly?JSON.parse(await readFile('../../outputs/verification-v51-game-final/game-check.json','utf8')):null;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
let page;
const verifyPins=async()=>{assert.equal(sourceInputCount,108);for(const required of ['src/core/sim/fielding/LiveFieldPlayV1.ts','src/core/sim/fielding/LiveFielderAvoidanceV1.ts','src/integration/browser/LiveBaseballMatchV1.ts'])assert(Object.hasOwn(pins.inputs,required),'required Core source pin '+required);for(const [p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,p);
 assert.equal(sha(await readFile('dist/native-match-core-browser.js')),pins.entrySha256);};
const hashes=p=>p.evaluate(async()=>{const out=[];for(const r of window.liveMatchPlayback.inspect().host.history.slice(0,8)){
 const b=new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}));
 out.push([...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join(''));}return out;});
const snap=p=>p.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{count:s.generatedPitches,history:JSON.stringify(s.host.history),physicalRoster:s.physicalRoster,error:s.error};});
const seek=(pitch,ms)=>page.evaluate(({pitch,ms})=>{window.liveMatchPlayback.seekPitch(pitch);window.liveMatchPlayback.seekPresentationMs(ms);},{pitch,ms});
async function exportCurrentGame(requireField){
 const expected=await page.evaluate(()=>JSON.parse(JSON.stringify(window.liveMatchPlayback.inspect().host.history.map(record=>({
  requiredBodyDistanceMeters:record.play.field?record.play.field.model.bodyRadiusMeters*2:null,
  field:record.play.field?{facts:record.play.field.facts,ruleFacts:record.play.field.ruleFacts,end:record.play.field.end,
   finalFrame:record.play.field.frames.at(-1),finalRunners:record.play.field.finalRunners,diagnostics:record.play.field.diagnostics}:null
 })))));
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export-game').click()]);
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(exported.pitches.length,expected.length,'export preserves every actual issued pitch');
 let fields=0;
 for(const [index,record]of exported.pitches.entries()){
  assert.deepEqual(record.play.field,expected[index].field,'actual field export '+index);
  if(record.play.field){fields++;assert(record.play.field.finalFrame);assert(Array.isArray(record.play.field.finalRunners));assert(record.play.field.diagnostics);
   const separation=record.play.field.diagnostics.fielderSeparation;
   assert(separation&&separation.planCount>0,'actual issued fielder separation proof '+index);
   assert.equal(separation.basis,'CONTINUOUS_ISSUED_BODY_COMMANDS_AND_PROJECTED_MAXIMUM_BRAKING');
   assert(separation.minimumPlannedStepGapMeters>=.02,'issued step clearance '+index);assert(separation.minimumStoppingGapMeters>=.02,'maximum braking reserve '+index);
   const actors=record.play.field.finalFrame.fielders;assert.equal(actors.length,9);assert.equal(separation.actorCounts.length,9);
   for(let a=0;a<actors.length;a++)for(let b=a+1;b<actors.length;b++)assert(Math.hypot(actors[a].position.x-actors[b].position.x,actors[a].position.z-actors[b].position.z)>=expected[index].requiredBodyDistanceMeters,'actual exported final body spacing '+index+':'+actors[a].playerId+':'+actors[b].playerId);
   assert.equal(Object.hasOwn(record.play.field,'frames'),false,'full field frame history remains omitted');}
 }
 assert(exported.omittedFields.includes('field frames'));
 if(requireField)assert(fields>0,'actual completed game must exercise field snapshot export');
 return{exported,coverage:{pitches:expected.length,fields,finalSnapshotSourceExact:true,fullFieldFramesOmitted:true}};
}
async function presentationPrefix(){
 // Generate one additional issued pitch only when the first eight have no
 // count pitch with both earlier history and an actual secure catch.
 const findCases=()=>page.evaluate(()=>{
  const h=window.liveMatchPlayback.inspect().host.history,marks=h.findIndex((r,p)=>r.play.classification==='count'&&h.slice(0,p).some(o=>o.beforeMatch.playId===r.beforeMatch.playId));
  const held=h.flatMap((r,pitch)=>{const frame=r.frames.findIndex(f=>f.possessedBy);return frame<0?[]:[{pitch,frame}];})[0];
  const field=h.findIndex(r=>r.play.classification!=='foul'&&r.frames.some(f=>f.ballKind==='batted'));
  const bat=h.flatMap((r,pitch)=>{const first=r.frames.find(f=>f.ballKind==='batted')?.tick??Infinity,
   frame=r.frames.findLastIndex(f=>f.phase==='pitch'&&f.bat&&f.tick<first);return frame<0?[]:[{pitch,frame}];})[0];
  return{marks,held,field,bat};
 });
 let cases=await findCases();if(cases.marks<0){await page.evaluate(()=>{const a=window.liveMatchPlayback;a.seekPitch(a.inspect().generatedPitches-1);document.getElementById('next-pitch').click();a.stop();});cases=await findCases();}
 assert(cases.marks>=0&&cases.held&&cases.field>=0&&cases.bat,'actual presentation coverage');
 const sourceBefore=await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().host.history));
 const read=()=>page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{frame:s.currentFrame,rendered:s.rendered,presentation:s.presentation};});
 await page.locator('[data-camera="catcher"]').click();await page.locator('#auto-overhead').uncheck();
 const samples=await page.evaluate(p=>{const r=window.liveMatchPlayback.inspect().host.history[p];return{
  flight:r.frames.findIndex(f=>f.phase==='pitch'&&f.ball&&!f.possessedBy),held:r.frames.findIndex(f=>f.possessedBy),first:r.frames[0].tick};},cases.marks),fades=[];
 assert(samples.flight>=0&&samples.held>=0);
 for(const [stage,ms,frame,opacity]of [['ready',0,null,1],['release',1500,null,.06],['flight',null,samples.flight,.06],['held',null,samples.held,1]]){
  if(ms!==null)await seek(cases.marks,ms);else await page.evaluate(({pitch,frame})=>window.liveMatchPlayback.seekPitch(pitch,frame),{pitch:cases.marks,frame});
  const s=await read();assert.equal(s.presentation.pitchMarksOpacity,opacity);const chart=s.presentation.chart.chartMarks,world=s.rendered.historyMarks;
  assert(chart.length>0&&world.length>0,'retained history at '+stage);for(const mark of [...chart,...world])assert(mark.alpha>0&&mark.alpha<=opacity);
  assert.equal(s.rendered.zoneCorners.length,4);fades.push({stage,opacity,chartAlpha:chart.map(m=>m.alpha),worldAlpha:world.map(m=>m.alpha)});
 }
 const firstBatted=await page.evaluate(p=>window.liveMatchPlayback.inspect().host.history[p].frames.findIndex(f=>f.ballKind==='batted'),cases.field);
 await page.evaluate(({pitch,frame})=>window.liveMatchPlayback.seekPitch(pitch,frame),{pitch:cases.field,frame:firstBatted});
 const follow=(await read()).presentation.catcherFollow;assert(follow&&follow.delaySeconds>=1&&follow.delaySeconds<=2);
 const firstTick=await page.evaluate(p=>window.liveMatchPlayback.inspect().host.history[p].frames[0].tick,cases.field),
  beforeMs=1540+(follow.startTick-firstTick)/1000+follow.delaySeconds*500,afterMs=follow.cutoverAtMs+1,followChecks=[];
 assert(Number.isFinite(afterMs));
 for(const automatic of [false,true]){
  await seek(cases.field,beforeMs);await page.locator('[data-camera="catcher"]').click();await page.locator('#auto-overhead').setChecked(automatic);
  const before=await read(),eye=before.rendered.cameraEye,target=before.frame.ball.position;assert.equal(before.rendered.camera,'catcher');
  assert.deepEqual(before.presentation.catcherFollow.target,target);
  const yaw=Math.atan2(target.x-eye.x,target.z-eye.z),pitch=-Math.atan2(target.y-eye.y,Math.hypot(target.x-eye.x,target.z-eye.z));
  assert(Math.abs(Math.atan2(Math.sin(before.rendered.cameraYaw-yaw),Math.cos(before.rendered.cameraYaw-yaw)))<1e-9);assert(Math.abs(before.rendered.cameraPitch-pitch)<1e-9);
  await seek(cases.field,afterMs);const after=await read();assert.equal(after.rendered.camera,automatic?'overhead':'catcher');
  await seek(cases.field+1,0);assert.equal((await read()).rendered.camera,'catcher');followChecks.push({automatic,delaySeconds:follow.delaySeconds,cutoverAtMs:follow.cutoverAtMs,after:after.rendered.camera});
 }
 await page.locator('#auto-overhead').uncheck();
 for(const camera of ['overhead','mound','batter','catcher','runner']){
  await page.evaluate(scene=>window.liveMatchPlayback.seekPitch(scene.pitch,scene.frame),cases.held);await page.locator('[data-camera="'+camera+'"]').click();
  const held=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect(),c=document.getElementById('ball-overlay');return{held:!!s.currentFrame.possessedBy,dot:s.rendered.ballDotDisplay,
   painted:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)};});assert(held.held);assert.equal(held.dot,null);assert.equal(held.painted,false);
 }
 const animation=[];
 for(const appearance of ['retro','point']){
  await page.evaluate(scene=>window.liveMatchPlayback.seekPitch(scene.pitch,scene.frame),cases.bat);await page.locator('[data-appearance="'+appearance+'"]').click();await page.locator('[data-camera="mound"]').click();
  const a=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect(),r=s.lastResult,c=document.getElementById('bat-overlay'),clips=JSON.parse(document.getElementById('v33-measured-bats').textContent).clips;return{
   actual:s.presentation.actorAnimation,expected:window.KneekuraLiveActorAnimation.observe({record:r,frame:s.currentFrame,sceneMs:s.presentation.elapsedMs,preparationMs:1540,measuredClip:clips.find(c=>c.id===r.play.diagnostics.measuredClipId)}),
   rig:s.rendered.batterRig,mode:s.rendered.batDisplayMode,near:s.rendered.nearRunnerHiddenActors,
   painted:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)};});
  assert.deepEqual(a.actual,a.expected);assert.equal(a.mode,'approved-four-frame');assert.equal(a.rig.includesIllustratedBat,true);assert.equal(a.painted,false);assert(Array.isArray(a.near));
  assert.equal(await page.locator('#actor-labels [data-actor="BAT"]').count(),0,'standing batter name remains hidden');animation.push({appearance,rig:a.rig});
 }
 assert.equal(await page.evaluate(()=>JSON.stringify(window.liveMatchPlayback.inspect().host.history)),sourceBefore,'display checks preserve exact Source history');
 return{actualPitches:await page.evaluate(()=>window.liveMatchPlayback.inspect().generatedPitches),fades,followChecks,heldHiddenCameras:5,animation};
}
try{
 await verifyPins();assert.equal(report.packetSha256,'a2fdb7835bada8dddcd2599e72f0034e540bebb360febb8cd25279f2ba1e6ccd');
 assert(packet.entries.every(e=>e.physical.zoneJudgmentStdMeters===.025),'all twenty v2 profiles declare the sensory SI');
 assert((await readFile(artifact,'utf8')).includes(await readFile('dist/native-match-core-browser.js','utf8')));
 if(prefixOnly){assert.equal(fullProof.status,'PASS');assert.equal(fullProof.nativeBundleSha256,pins.entrySha256);assert.equal(fullProof.packetSha256,report.packetSha256);assert.equal(fullProof.sourceInputs,sourceInputCount);}
 const maker=await browser.newPage();await maker.goto(pathToFileURL(resolve('../../outputs/にーくら野球メーカー_公開能力編集版.html')).href);
 assert.deepEqual(await maker.evaluate(()=>window.baseballMaker.getLiveRoster()),packet);await maker.close();
 let desktopHashes;
 for(const width of [1200,390]){
  page=await browser.newPage({viewport:{width,height:860},acceptDownloads:true});page.setDefaultTimeout(30000);
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:)/.test(r.url()))requests.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.evaluate(()=>document.fonts.ready);
  await page.locator('details.settings > summary').click();await page.locator('#fixed-seed').check();await page.locator('[data-camera="overhead"]').click();
  const initial=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{roster:s.physicalRoster,embedded:JSON.parse(document.getElementById('v40-physical-roster').textContent),fallback:s.legacyResultFallback};});
  assert.equal(initial.fallback,false);assert.deepEqual(initial.embedded,packet);assert.deepEqual(initial.roster.active,packet);assert.deepEqual(initial.roster.pending,packet);
  assert.equal(initial.roster.players.length,20);assert.equal(initial.roster.audit.players.length,20);
  for(const entry of packet.entries){const p=initial.roster.players.find(p=>p.playerId===entry.playerId),audit=initial.roster.audit.players.find(p=>p.playerId===entry.playerId);
   assert(p&&audit.sourceId===entry.sourceId);assert.equal(p.heightMeters,entry.heightMeters);
   for(const [key,value]of Object.entries(entry.physical))assert.deepEqual(p.physical[key],value,entry.playerId+'.'+key);
  }
  await page.evaluate(()=>{for(let i=0;i<8;i++){document.getElementById('next-pitch').click();const s=window.liveMatchPlayback.inspect();if(s.error)throw Error(s.error);}window.liveMatchPlayback.stop();});
  const prefix=await hashes(page);assert.equal(prefix.length,8);if(width===1200)desktopHashes=prefix;else assert.deepEqual(prefix,desktopHashes,'new Source identical desktop/mobile prefix');
  const view={width,prefixHashes:prefix,physicalPlayers:initial.roster.players,physicalAudit:initial.roster.audit};
  if(prefixOnly){assert.deepEqual(prefix,fullProof.views[0].prefixHashes,'final build preserves saved current-Source prefix');view.presentation=await presentationPrefix();
   await page.screenshot({path:resolve(evidence,'final-mound-'+width+'.png'),fullPage:true});
  }else if(width===1200){
   await page.exposeFunction('qaProgress',progress=>console.log(JSON.stringify({phase:'normal-nine-inning-game',...progress})));
   const finished=await page.evaluate(async()=>{
    const timer=setInterval(()=>{const s=window.liveMatchPlayback.inspect();window.qaProgress({pitches:s.generatedPitches,inning:s.host.match.inning,half:s.host.match.half,score:s.host.match.score});},5000);
    try{await window.liveMatchPlayback.finish();const s=window.liveMatchPlayback.inspect();return{error:s.error,errorDetails:s.errorDetails,
     finished:s.host.finished,match:s.host.match,pitches:s.generatedPitches,fallback:s.legacyResultFallback};}finally{clearInterval(timer);}
   });
   await writeFile(resolve(evidence,'game-completion.json'),JSON.stringify(finished,null,2)+'\n');
   assert.equal(finished.error,null,'normal HTML must complete without Source exception');assert.equal(finished.fallback,false);assert.equal(finished.finished,true);assert(finished.match.inning>=9);
   const compact=await page.evaluate(async()=>{
    const s=window.liveMatchPlayback.inspect(),{history,frame,...state}=s.host,records=[];
    for(const [index,r]of history.entries()){
     const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({frames:r.frames,play:r.play,events:r.events,match:r.match}))),d=r.play.diagnostics;
     let observedFielderSpacing=null;
     if(r.play.field){const field=r.play.field;let minimumMeters=Infinity,closest=null,tripleClusterFrameCount=0;
      for(const f of field.frames){let maximumNeighbors=0;for(let a=0;a<f.fielders.length;a++){const p=f.fielders[a];maximumNeighbors=Math.max(maximumNeighbors,f.fielders.filter(q=>Math.hypot(p.position.x-q.position.x,p.position.z-q.position.z)<2).length);
       for(let b=a+1;b<f.fielders.length;b++){const q=f.fielders[b],distanceMeters=Math.hypot(p.position.x-q.position.x,p.position.z-q.position.z);if(distanceMeters<minimumMeters){minimumMeters=distanceMeters;closest={elapsedSeconds:f.elapsedSeconds,playerId:p.playerId,otherPlayerId:q.playerId,playerIntent:p.intent,otherPlayerIntent:q.intent};}}}
       if(maximumNeighbors>=3)tripleClusterFrameCount++;}
      observedFielderSpacing={basis:'ALL_ACTUAL_FIELD_FRAMES_NOT_CONTINUOUS_PROOF',frameCount:field.frames.length,requiredBodyDistanceMeters:field.model.bodyRadiusMeters*2,minimumMeters,closest,tripleClusterFrameCount};}
     records.push({index,observedFielderSpacing,batterPlayerId:r.batterPlayerId,pitcherPlayerId:r.pitcherPlayerId,speedKmh:r.speedKmh,pitchType:r.pitchType,command:r.command,
      beforeMatch:r.beforeMatch,match:r.match,classification:r.play.classification,call:r.play.call,rules:r.play.rules,
      events:r.events,fieldFacts:r.play.field?.facts??[],ruleFacts:r.play.field?.ruleFacts??null,fieldEnd:r.play.field?.end??null,
      fieldFinalFrame:r.play.field?.frames.at(-1)??null,fieldFinalRunners:r.play.field?.finalRunners??null,fieldDiagnostics:r.play.field?.diagnostics??null,
      description:window.KneekuraLivePlayDescription.describe(r),individualControls:d.individualControls,
      sourceRelease:d.sourceDescriptor.initial.ball,catcherSI:d.catcherSI,zoneJudgment:d.zoneJudgment,swingOffered:d.swingOffered,swingScore:d.swingScore,frameCount:r.frames.length,
      sourceClockTicksPerSecond:d.sourceClockTicksPerSecond,firstTick:r.frames[0].tick,lastTick:r.frames.at(-1).tick,
      coreHash:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')});
    }return{state,records};
   });
   await writeFile(resolve(evidence,'normal-game-records.json'),JSON.stringify(compact,null,2)+'\n');
   assert.equal(compact.records.length,finished.pitches);assert.deepEqual(compact.records.slice(0,8).map(r=>r.coreHash),prefix);
   const spacing=compact.records.filter(r=>r.observedFielderSpacing);assert(spacing.length>0);
   for(const r of spacing)assert(r.observedFielderSpacing.minimumMeters>=r.observedFielderSpacing.requiredBodyDistanceMeters,'all actual field frames body spacing '+r.index+':'+JSON.stringify(r.observedFielderSpacing));
   view.fielderSpacing={fieldPlays:spacing.length,observedFrames:spacing.reduce((sum,r)=>sum+r.observedFielderSpacing.frameCount,0),minimumObservedMeters:Math.min(...spacing.map(r=>r.observedFielderSpacing.minimumMeters)),overlaps:0,triplesObserved:spacing.reduce((sum,r)=>sum+r.observedFielderSpacing.tripleClusterFrameCount,0)};
   const byId=Object.fromEntries(initial.roster.players.map(p=>[p.playerId,p])),tikao=compact.records.filter(r=>r.pitcherPlayerId==='1-p0'),snell=compact.records.filter(r=>r.pitcherPlayerId==='0-p0');
   assert(tikao.length>0&&snell.length>0,'actual both starting pitchers');
   for(const r of tikao)assert(r.speedKmh<=151,'Tikao actual pitch exceeds 151 km/h: '+r.speedKmh);
   for(const r of snell){assert.equal(r.individualControls.throwingSide,'L');assert(r.sourceRelease.position.x<0,'Snell actual Source release must be left handed');}
   for(const r of compact.records){
    const b=byId[r.batterPlayerId].physical,p=byId[r.pitcherPlayerId].physical,c=r.individualControls;
    assert.equal(c.maximumPitchSpeedMps,p.maximumPitchSpeedMps??null);assert.equal(c.throwingSide,byId[r.pitcherPlayerId].throws);
    for(const key of ['maximumSweetSpotSpeedMps','targetSweetSpotSpeedMps','motorLatencySeconds','technicalTimingOffsetSeconds','sweetSpotT','attackAngleDegrees','pullAngleDegrees','badBallControl','swingDecision','preContactSeconds','followThroughSeconds','contactDepthMeters','zoneJudgmentStdMeters'])
     assert.deepEqual(c[key],b[key]??null,'actual individual consumer '+r.index+':'+key);
    const j=r.zoneJudgment;assert.equal(j.standardDeviationMeters,b.zoneJudgmentStdMeters);assert.equal(j.stream,'zone-judgment-v1');
    assert.equal(j.basis,'AUTHORED_XY_COURSE_ESTIMATE_ERROR_NOT_CHASE_PREFERENCE');
    assert.deepEqual(j.estimatedPosition,{...j.observedForecastPosition,x:j.observedForecastPosition.x+j.errorMeters.x,y:j.observedForecastPosition.y+j.errorMeters.y});
    const zone={halfWidth:.2159,lowerY:byId[r.batterPlayerId].heightMeters*.27,upperY:byId[r.batterPlayerId].heightMeters*.535},pos=j.estimatedPosition,
     margin=Math.min(zone.halfWidth-Math.abs(pos.x),pos.y-zone.lowerY,zone.upperY-pos.y),
     score=Math.max(0,Math.min(1,.5+margin/Math.max(.1,zone.halfWidth)+(b.swingDecision?(b.swingDecision.aggressionWeight-.5)*.2:0))),
     envelope=Math.abs(pos.x)<=zone.halfWidth+b.chaseMarginMeters&&pos.y>=zone.lowerY-b.chaseMarginMeters&&pos.y<=zone.upperY+b.chaseMarginMeters,
     offered=r.command.batting!=='take'&&(b.swingDecision?b.swingDecision.approach==='SWING'||b.swingDecision.approach==='AUTO'&&envelope&&score>=b.swingDecision.threshold:envelope);
    assert.equal(r.swingScore,score,'actual decision score consumes the estimated course');assert.equal(r.swingOffered,offered);
    assert(!/^\d+アウト$|インプレーの進塁/.test(r.description.label),'generic final result label');
    if(r.classification==='live_ball')assert.equal(r.description.scoring.officialHit,null);
   }
   const thirds=compact.records.filter(r=>r.description.thirdOut);assert(thirds.length>=17,'completed nine innings need actual half-ending out records');
   const thirdChecks=[];
   for(const r of thirds){const officialMs=1540+(r.rules.endedAtTick-r.firstTick)/1000;
    await seek(r.index,officialMs+1);const before=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{text:document.getElementById('result-text').textContent,result:s.presentation.resultDisplay};});
    assert.equal(before.result.thirdOut,true);assert.equal(before.result.change,false);assert.equal(before.text,r.description.label);
    await seek(r.index,officialMs+1101);const after=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{text:document.getElementById('result-text').textContent,result:s.presentation.resultDisplay};});
    // The final game may show the final score instead of the next-half banner.
    assert(after.result.change);if(r.index!==compact.records.length-1)assert.equal(after.text,'チェンジ（3アウト）');
    thirdChecks.push({pitch:r.index,play:before.text,after:after.text,outsAfter:after.result.outsAfter});
   }
   const foul=compact.records.find(r=>r.classification==='foul'&&r.events.some(e=>e.kind==='play_end'&&e.reason==='foul_dead_ball'));assert(foul,'actual dead-ball foul required');
   const dead=foul.events.find(e=>e.kind==='play_end'&&e.reason==='foul_dead_ball'),duration=1540+Math.max((foul.lastTick-foul.firstTick)/1000,(dead.tick-foul.firstTick)/1000+1500);
   await seek(foul.index,1540+(dead.tick-foul.firstTick)/1000+1);const foulView=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{stop:s.presentation.foulStop,duration:s.presentation.durationMs,label:document.getElementById('result-text').textContent};});
   assert.deepEqual(foulView.stop,{deadTick:dead.tick,holdMs:1500,source:'CORE_FOUL_DEAD_BALL'});assert.equal(foulView.duration,duration);assert.equal(foulView.label,'ファウル');
   assert(compact.records.some(r=>r.zoneJudgment.errorMeters.x!==0||r.zoneJudgment.errorMeters.y!==0),'declared sensory error actually sampled');
   view.completed={...finished,thirdChecks,foul:{pitch:foul.index,...foulView},tikaoPitchCount:tikao.length,tikaoMaximumKmh:Math.max(...tikao.map(r=>r.speedKmh)),snellPitchCount:snell.length};
   const desktopExport=await exportCurrentGame(true);view.export=desktopExport.coverage;
   await writeFile(resolve(evidence,'normal-game-export.json'),JSON.stringify(desktopExport.exported,null,2)+'\n');

   view.presentation=await presentationPrefix();
   await page.screenshot({path:resolve(evidence,'desktop-actual-foul.png'),fullPage:true});
  }else{
   const before=await snap(page),edited=structuredClone(packet),entry=edited.entries.find(e=>e.playerId==='0-b0');entry.heightMeters+=.01;
   const upload=async value=>{await page.locator('#physical-roster-file').setInputFiles({name:'qa-roster.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
    await page.waitForFunction(()=>document.getElementById('physical-roster-status').dataset.error!==undefined);};
   await upload(edited);assert.equal(await page.locator('#physical-roster-status').getAttribute('data-error'),'false');const pending=await snap(page);
   assert.equal(pending.count,8);assert.equal(pending.history,before.history);assert.deepEqual(pending.physicalRoster.active,before.physicalRoster.active);assert.deepEqual(pending.physicalRoster.pending,edited);
   const invalidChecks=[];
   for(const kind of ['duplicate','out-of-bounds']){const invalid=structuredClone(edited);if(kind==='duplicate')invalid.entries[1].playerId=invalid.entries[0].playerId;else invalid.entries[0].heightMeters=9;
    await page.locator('#physical-roster-file').evaluate(el=>delete document.getElementById('physical-roster-status').dataset.error);await upload(invalid);
    assert.equal(await page.locator('#physical-roster-status').getAttribute('data-error'),'true');const rejected=await snap(page);
    assert.equal(rejected.history,pending.history);assert.equal(rejected.count,8);assert.deepEqual(rejected.physicalRoster,pending.physicalRoster);invalidChecks.push(kind);
   }
   await page.locator('#new-game').click();const restarted=await snap(page);assert.equal(restarted.count,0);assert.deepEqual(restarted.physicalRoster.active,edited);
   assert.equal(restarted.physicalRoster.players.find(p=>p.playerId==='0-b0').heightMeters,entry.heightMeters);
   const rendered=await page.evaluate(()=>window.liveMatchPlayback.inspect().rendered.actors.find(a=>a.id==='BAT'));assert.equal(rendered.height,entry.heightMeters,'new physical height feeds actor renderer');
   await page.evaluate(()=>{document.getElementById('next-pitch').click();window.liveMatchPlayback.stop();});
   const afterOne=await snap(page);assert.equal(afterOne.count,1);assert.equal(afterOne.error,null);
   const mobileExport=await exportCurrentGame(false),exported=mobileExport.exported;
   assert.equal(mobileExport.coverage.pitches,1);assert.deepEqual(exported.configuration.players,restarted.physicalRoster.players);assert.deepEqual(exported.configuration.physicalRoster,edited);
   await writeFile(resolve(evidence,'edited-game-export.json'),JSON.stringify(exported,null,2)+'\n');
   await writeFile(resolve(evidence,'edited-configuration.json'),JSON.stringify(exported.configuration,null,2)+'\n');
   view.import={beforeCount:8,pendingOnly:true,invalidAtomic:invalidChecks,newGameCount:0,exportAfterOnePitch:mobileExport.coverage,editedPlayerId:'0-b0',heightMeters:entry.heightMeters,renderedHeight:rendered.height,exportedActualConfiguration:true};
   await page.screenshot({path:resolve(evidence,'mobile-edited-roster.png'),fullPage:true});
  }
  assert.equal(await page.evaluate(()=>window.liveMatchPlayback.inspect().error),null);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  view.pageErrors=errors;view.networkRequests=requests;report.views.push(view);await page.close();page=null;
 }
 await verifyPins();report.sourceInputs=sourceInputCount;report.status='PASS';await writeFile(resolve(evidence,'game-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',mode:report.mode,sourceInputs:sourceInputCount,viewports:report.views.map(v=>v.width),completedPitches:report.views[0].completed?.pitches??null}));
}catch(error){report.status='FAIL';report.error=error.stack;
 if(page)try{const raw=await page.evaluate(()=>{const s=window.liveMatchPlayback.inspect();return{generatedPitches:s.generatedPitches,selectedPitch:s.selectedPitch,error:s.error,errorDetails:s.errorDetails,hostMatch:s.host.match,lastResult:s.lastResult};});
  await writeFile(resolve(evidence,'failure-raw.json'),JSON.stringify(raw,null,2)+'\n');report.failure={pitchCount:raw.generatedPitches,error:raw.error,raw:'failure-raw.json'};}catch(rawError){report.failureReadError=String(rawError);}
 await writeFile(resolve(evidence,'game-check.json'),JSON.stringify(report,null,2)+'\n');throw error;
}finally{await browser.close();}

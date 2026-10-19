import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const normal=resolve('../../outputs/ばせぼーるlv78_TBD_vs_LAD_球種と縫い目物理版.html'),lab=resolve('../../outputs/カメラワーク調整室_v78.html'),
 proof=resolve('docs/verification/releases/v78/game'),sha=b=>createHash('sha256').update(b).digest('hex'),stamp=new Date().toISOString().replaceAll(/[:.]/g,'-'),
 report={pass:false,phase:'load',startedAt:new Date().toISOString(),faults:[],checks:[],scope:'Real offline normal/lab HTML, V77 six-pitch exactness, authored pitch JSON and history, one nine-inning game, lab 1200/390 settings and same-roster session replay.'};
let browser;await mkdir(proof,{recursive:true});
const checkpoint=async phase=>{report.phase=phase;await writeFile(resolve(proof,'game-check-'+stamp+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({phase,elapsedMs:Date.now()-Date.parse(report.startedAt)}));};
const track=page=>{const item={label:'page-'+report.faults.length,errors:[],external:[]};report.faults.push(item);page.on('pageerror',e=>item.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))item.external.push(r.url());});return item;};
async function open(page,path,workbench=false){page.setDefaultTimeout(120000);await page.goto(pathToFileURL(path).href,{timeout:60000});await page.waitForFunction(w=>w?globalThis.KneekuraCameraLab?.inspect().ready:globalThis.liveMatchPlayback,workbench,{timeout:60000});}
async function generate(page,count){return page.evaluate(n=>{document.getElementById('auto-overhead').checked=false;for(let i=0;i<n;i++){document.getElementById('next-pitch').click();liveMatchPlayback.stop();const s=liveMatchPlayback.inspect();if(s.error)throw Error(s.error);}const s=liveMatchPlayback.inspect();return {pitches:s.generatedPitches,finished:s.host.finished};},count);}
async function importRoster(page,packet){await page.locator('#physical-roster-status').evaluate(e=>delete e.dataset.error);await page.locator('#physical-roster-file').setInputFiles({name:'v78-integration.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});await page.waitForFunction(()=>document.getElementById('physical-roster-status').dataset.error!==undefined);assert.equal(await page.locator('#physical-roster-status').getAttribute('data-error'),'false',await page.locator('#physical-roster-status').textContent());}
try{
 const normalBytes=await readFile(normal),labBytes=await readFile(lab),pinsBytes=await readFile(normal+'.bundle-inputs.json'),pins=JSON.parse(pinsBytes),normalMetaBytes=await readFile(normal+'.build.json'),normalMeta=JSON.parse(normalMetaBytes),labMetaBytes=await readFile(lab+'.build.json'),labMeta=JSON.parse(labMetaBytes);
 const hashes={normal:sha(normalBytes),lab:sha(labBytes),normalMetadata:sha(normalMetaBytes),labMetadata:sha(labMetaBytes),pins:sha(pinsBytes)};
 assert.equal(hashes.normal,normalMeta.sha256);assert.equal(hashes.lab,labMeta.sha256);assert.equal(pins.entrySha256,normalMeta.sourceCoreSha256);assert.equal(labMeta.sourceCoreSha256,pins.entrySha256);
 for(const[p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,'start Source pin '+p);
 for(const[name,h]of Object.entries(normalMeta.helpers))assert.equal(sha(await readFile('tools/browser-bridge/'+name)),h,'start helper '+name);
 report.hashesAtStart=hashes;report.coreSha256=pins.entrySha256;report.sourceInputCount=Object.keys(pins.inputs).length;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 const old=await browser.newPage({viewport:{width:1200,height:860}});track(old);await open(old,resolve('docs/demos/releases/v77/game.html'));await generate(old,6);const baseline=await old.evaluate(()=>liveMatchPlayback.inspect().host.history);await old.close();
 const page=await browser.newPage({viewport:{width:1200,height:860}});track(page);await open(page,normal);await generate(page,6);
 assert.deepEqual(await page.evaluate(()=>liveMatchPlayback.inspect().host.history),baseline,'default complete Source/bat/field/rules V77 exact');report.baseline={records:6,historySha256:sha(JSON.stringify(baseline)),exact:true};await checkpoint('authored-roster');
 const packet=await page.evaluate(()=>{
  const core=KneekuraNativeMatchCore,catalog=JSON.parse(document.getElementById('v40-roster-catalog').textContent),roster=structuredClone(liveMatchPlayback.inspect().physicalRoster.active),base=JSON.stringify(roster);
  for(const entry of roster.entries.filter(e=>catalog.players.some(p=>p.playerId===e.playerId&&p.role==='P'))){
   const physical=entry.physical,throws=entry.throws??catalog.players.find(p=>p.playerId===entry.playerId).throws??'R',make=(presetId,pitchId)=>core.createPitchSnapshotFromPresetV78({presetId,pitchId,physical,throws}),
    one=make('two_seam','qa-fast'),a=make('sweeper','qa-sweep-a'),b={...make('sweeper','qa-sweep-b'),name:'二つ目のスイーパー',releaseSpeedMps:a.releaseSpeedMps*.96},
    first=core.appendPitchLibraryRevisionV78({library:{version:'pitch_library_v78',records:[]},originalId:'qa-original',name:'独自の曲がる球',pitchType:'sweeper',releaseSpeedMps:a.releaseSpeedMps*.98,spinRadPerSecond:{x:12,y:-120,z:30},releaseOrientation:{w:Math.cos(.3),x:Math.sin(.3),y:0,z:0},seamForce:{version:'baseball_seam_force_v1',coefficientScale:1}}),
    original=core.createPitchSnapshotFromLibraryV78({library:first.library,originalId:'qa-original',revision:1,pitchId:'qa-original'});
   delete physical.pitchRepertoire;physical.pitchRepertoireV78={version:'pitch_repertoire_v78',pitches:[one,a,b,original]};physical.minimumSpinRatio=.8;
  }
  if(base!==JSON.stringify(liveMatchPlayback.inspect().physicalRoster.active))throw Error('packet authoring mutated active roster');return roster;
 });
 const takePacket=structuredClone(packet);for(const entry of takePacket.entries)entry.physical.swingDecision={...entry.physical.swingDecision,approach:'TAKE'};
 await importRoster(page,takePacket);assert.notEqual(await page.evaluate(()=>JSON.stringify(liveMatchPlayback.inspect().physicalRoster.active)),JSON.stringify(takePacket),'pending roster waits for new game');await page.evaluate(()=>liveMatchPlayback.newGame());
 report.authored=[];
 for(const id of ['qa-fast','qa-sweep-a','qa-sweep-b','qa-original']){
  const observed=await page.evaluate(pitchId=>{
   const before=liveMatchPlayback.inspect(),pitcher=before.physicalRoster.players.find(p=>p.playerId===before.host.pitcherPlayerId),row=pitcher.physical.pitchRepertoireV78.pitches.find(p=>p.pitchId===pitchId);
   document.getElementById('managed-team').value=String(before.host.match.half==='top'?1:0);document.getElementById('pitch-choice').value='v78:'+pitchId;document.getElementById('next-pitch').click();liveMatchPlayback.stop();
   let s=liveMatchPlayback.inspect();if(s.error)throw Error(s.error);const record=s.lastResult,prep=s.presentation.timing.preparationMs;
   liveMatchPlayback.seekPresentationMs(prep+100);const ball=liveMatchPlayback.observePitchBallAtPresentationMs(prep+100),descriptor=record.play.diagnostics.sourceDescriptor,
    expected=KneekuraNativeMatchCore.createSourceBallMaterialHistoryV1({initialMaterialOrientation:descriptor.materialOrientationAtStart,spans:[{descriptor,throughElapsedSeconds:descriptor.throughElapsedSeconds,side:'incoming'}]}).evaluateAt(.1,'incoming');
   const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);if(!equal(ball.position,expected.moment.ball.position)||!equal(ball.orientation,expected.orientation))throw Error('rendered pitch observation differs from original Source');
   liveMatchPlayback.seekFrame(record.frames.length-1);s=liveMatchPlayback.inspect();if(s.error)throw Error(s.error);
   return {pitchId:record.pitchId,pitchName:record.pitchName,command:record.command,row,contact:record.play.contact!==null,diagnostic:record.play.diagnostics.spinExecution,sourceProfile:descriptor.profile.air.aerodynamics.seamForce,materialAtRelease:descriptor.materialOrientationAtStart,chart:s.presentation.chart.history,caption:document.getElementById('chart-caption').textContent,ballMatchesSource:true};
  },id);
  assert.equal(observed.pitchId,id);assert.equal(observed.command.pitchId,id);assert.equal(observed.command.pitchType,observed.row.pitchType);assert.equal(observed.pitchName,observed.row.name);assert.equal(observed.contact,false);assert(observed.chart.some(r=>r.pitchType===observed.pitchName));assert.match(observed.caption,new RegExp(observed.pitchName));assert(observed.diagnostic.ratio>=.8&&observed.diagnostic.ratio<1);assert.deepEqual(observed.sourceProfile,observed.row.seamForce);assert.deepEqual(observed.materialAtRelease,observed.row.releaseOrientation);report.authored.push(observed);await checkpoint('authored-'+id);
 }
 await importRoster(page,packet);await page.evaluate(()=>liveMatchPlayback.newGame());
 await page.locator('#save-physical-roster').evaluate(button=>button.closest('details').open=true);
 const downloadPromise=page.waitForEvent('download',{timeout:15000});await page.locator('#save-physical-roster').click();const download=await downloadPromise;assert.deepEqual(JSON.parse(await readFile(await download.path(),'utf8')),packet);report.savedRosterExact=true;
 await checkpoint('nine-innings');const began=Date.now();await page.locator('#pitch-choice').selectOption('auto');
 for(let batch=0;batch<60;batch++){
  const status=await generate(page,12);report.nineInningsProgress={...status,elapsedMs:Date.now()-began};await checkpoint(status.finished?'nine-innings-complete':'nine-innings-progress');if(status.finished)break;
 }
 report.game=await page.evaluate(()=>{const s=liveMatchPlayback.inspect(),records=s.host.history,fields=records.filter(r=>r.play.field);return {finished:s.host.finished,match:s.host.match,pitches:records.length,contacts:records.filter(r=>r.play.contact).length,fields:fields.length,allFieldComplete:fields.every(r=>r.play.field.end.complete),roster:JSON.stringify(s.physicalRoster.active),fallback:s.legacyResultFallback,error:s.error,ownedOnly:records.every(r=>r.pitchId&&s.physicalRoster.active.entries.find(e=>e.playerId===r.pitcherPlayerId).physical.pitchRepertoireV78.pitches.some(p=>p.pitchId===r.pitchId)),seamPitches:records.filter(r=>r.play.diagnostics.sourceDescriptor.profile.air.aerodynamics.seamForce?.coefficientScale>0).length};});
 report.game.elapsedMs=Date.now()-began;assert(report.game.finished&&report.game.allFieldComplete);assert.equal(report.game.error,null);assert.equal(report.game.fallback,false);assert(report.game.ownedOnly);assert.equal(report.game.roster,JSON.stringify(packet));delete report.game.roster;
 await checkpoint('width-and-lab');
 for(const width of [1200,390]){
  const p=await browser.newPage({viewport:{width,height:860}});track(p);await open(p,lab,true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const frame=p.frames().find(f=>f!==p.mainFrame());assert(frame,'embedded actual match');await importRoster(frame,packet);await p.evaluate(()=>KneekuraCameraLab.newGame({seed:'V78-LAB-REPLAY',innings:9}));
  await p.evaluate(()=>{const w=document.querySelector('iframe').contentWindow,s=w.liveMatchPlayback.inspect(),team=document.getElementById('cmd-managed-team');team.value=String(s.host.match.half==='top'?1:0);team.dispatchEvent(new Event('change'));document.getElementById('cmd-pitch-choice').value='v78:qa-original';document.getElementById('cmd-pitch-choice').dispatchEvent(new Event('change'));KneekuraCameraLab.nextPitch();KneekuraCameraLab.pause();});
  const before=await p.evaluate(()=>{const w=document.querySelector('iframe').contentWindow,api=KneekuraCameraLab;api.setCamera('mound');api.setSettings('B',{pitchTrackingGain:.31});api.seek(1700);const s=api.inspect();return {settings:api.exportSettings(),session:api.exportSession(),history:w.liveMatchPlayback.inspect().host.history,ui:s.uiCommands,selected:s.selectedPitch,scene:s.sceneMs};});
  assert.equal(before.history[0].pitchId,'qa-original');assert.equal(before.ui[0]['pitch-choice'],'v78:qa-original');
  const after=await p.evaluate(async value=>{const api=KneekuraCameraLab;api.setSettings('B',{pitchTrackingGain:.5});api.importSettings(JSON.parse(JSON.stringify(value.settings)));await api.importSession(JSON.parse(JSON.stringify(value.session)));api.selectPitch(0);api.seek(value.scene);const w=document.querySelector('iframe').contentWindow;return {settings:api.exportSettings(),session:api.exportSession(),history:w.liveMatchPlayback.inspect().host.history,state:api.inspect(),chart:w.liveMatchPlayback.inspect().presentation.chart};},before);
  assert.deepEqual(after.history,before.history);assert.deepEqual(after.settings,before.settings);assert.equal(after.state.generatedPitches,1);assert.equal(after.state.selectedPitch,0);assert.equal(after.state.camera,'mound');assert.equal(after.session.scenario.commands[0]['pitch-choice'],'v78:qa-original');
  await p.screenshot({path:resolve(proof,'lab-'+width+'.png'),fullPage:true});report.checks.push({width,overflow:false,authoredId:'qa-original',settingsRoundTrip:true,sessionReplayExact:true,sessionScope:'SAME_ALREADY_LOADED_ROSTER'});await p.close();
 }
 for(const f of report.faults){assert.equal(f.errors.length,0,JSON.stringify(f));assert.equal(f.external.length,0,JSON.stringify(f));}
 for(const[p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,'Source changed during browser verification');
 for(const[name,h]of Object.entries(normalMeta.helpers))assert.equal(sha(await readFile('tools/browser-bridge/'+name)),h,'helper changed during verification');
 report.hashesAtEnd={normal:sha(await readFile(normal)),lab:sha(await readFile(lab)),normalMetadata:sha(await readFile(normal+'.build.json')),labMetadata:sha(await readFile(lab+'.build.json')),pins:sha(await readFile(normal+'.bundle-inputs.json'))};assert.deepEqual(report.hashesAtEnd,hashes);
 report.pass=true;await checkpoint('complete');await writeFile(resolve(proof,'game-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,baseline:report.baseline,game:report.game}));
}catch(error){report.error=String(error.stack??error);await checkpoint(report.phase);await writeFile(resolve(proof,'game-check.json'),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser?.close();}

import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const file=resolve(process.argv[2]??'docs/demos/releases/v82/maker.html');
const directory=process.argv[3]?resolve(process.argv[3]):null,sha=value=>createHash('sha256').update(value).digest('hex'),artifactSha256=sha(await readFile(file));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
const cases=[],report={pass:false,file,artifactSha256,cases};
try{
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(pathToFileURL(file).href,{timeout:60000});
  await page.waitForFunction(()=>globalThis.KneekuraPitchMenuV80&&globalThis.KneekuraPitcherMakerV78);
  await page.locator('#tab-pitcher').click();
  assert.equal(await page.locator('#pitcher-remove-v82').count(),1,'selected pitch removal must be available beside the owned pitches');
  assert(await page.locator('#pitcher-remove-v82').isVisible(),'removal must remain visible with pitch details closed');
  assert.equal(await page.locator('#pitcher-pitch-details').evaluate(node=>node.open),false);
  const initial=await page.evaluate(()=>({roster:baseballMaker.getLiveRoster(),library:KneekuraPitchLibraryV78.exportState(),season:KneekuraCourseSeasonsV79.getState(),pitcher:KneekuraPitcherMakerV78.inspect(),menu:KneekuraPitchMenuV80.inspect()}));
  assert.equal(initial.menu.ownedPitchIds.length,7);assert.equal(initial.menu.candidates.length,24);
  assert.equal(await page.locator('#pitcher-cards > .pitcher-card svg').count(),7);
  for(const hand of ['R','L']){
   await page.evaluate(({roster,hand})=>{const next=structuredClone(roster);next.entries.find(entry=>entry.playerId===KneekuraPitcherMakerV78.inspect().pitcherId).throws=hand;baseballMaker.importLiveRoster(next);},{roster:initial.roster,hand});
   assert.match(await page.locator('#pitcher-direction-arm-v80').textContent(),hand==='R'?/← 三塁側/:/一塁側 →/);
   assert.match(await page.locator('#pitcher-direction-glove-v80').textContent(),hand==='R'?/一塁側 →/:/← 三塁側/);
  }
  await page.evaluate(raw=>baseballMaker.importLiveRoster(raw),initial.roster);
  const removed=await page.evaluate(()=>{const before=baseballMaker.getLiveRoster(),state=KneekuraPitcherMakerV78.inspect(),player=KneekuraBaseballWorkbench.applyLivePhysicalRosterV1({players:KneekuraLiveGameRosterCatalog.players,roster:before}).players.find(player=>player.playerId===state.pitcherId),expected=KneekuraBaseballWorkbench.resolvePitcherRepertoireV78(player.physical).filter(row=>row.pitchId!==state.pitchId).map(({authored,...row})=>row);KneekuraPitcherMakerV78.removePitch();return{roster:baseballMaker.getLiveRoster(),state:KneekuraPitcherMakerV78.inspect(),expected};});
  const removedEntry=removed.roster.entries.find(entry=>entry.playerId===initial.pitcher.pitcherId);
  assert.deepEqual(removedEntry.physical.pitchRepertoireV78.pitches,removed.expected);
  assert.equal(removed.state.pitchId,removed.expected[0].pitchId);assert(removed.state.canUndoPitchRemoval);
  const surrounding=structuredClone(removed.roster),originalSurrounding=structuredClone(initial.roster);
  for(const packet of [surrounding,originalSurrounding]){const physical=packet.entries.find(entry=>entry.playerId===initial.pitcher.pitcherId).physical;delete physical.pitchRepertoire;delete physical.pitchRepertoireV78;}
  assert.deepEqual(surrounding,originalSurrounding,'removal changes only the selected pitcher repertoire');
  assert.deepEqual(await page.evaluate(()=>KneekuraPitchLibraryV78.exportState()),initial.library);
  assert.deepEqual(await page.evaluate(()=>KneekuraCourseSeasonsV79.getState()),initial.season);
  await page.locator('#pitcher-undo-remove-v82').click();
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),initial.roster,'undo restores the exact legacy snapshot');
  assert.equal(await page.evaluate(()=>KneekuraPitcherMakerV78.inspect().pitchId),initial.pitcher.pitchId);

  await page.evaluate(()=>document.getElementById('pitcher-pitch-details').open=true);
  const savedName=await page.locator('#pitcher-pitch-name').inputValue();
  await page.locator('#pitcher-pitch-name').fill('未保存の名前');
  const dirtyBefore=await page.evaluate(()=>({roster:baseballMaker.getLiveRoster(),id:KneekuraPitcherMakerV78.inspect().pitcherId,pitchId:KneekuraPitcherMakerV78.inspect().pitchId,pending:KneekuraPitcherMakerV78.inspect().pending}));
  await page.locator('#pitcher-remove-v82').click();
  await page.locator('#pitcher-pitch-reset').click();
  await page.locator('#pitcher-player').selectOption(await page.locator('#pitcher-player option').nth(1).getAttribute('value'));
  const rejected=await page.evaluate(()=>{const errors=[];for(const action of [()=>KneekuraPitchLibraryV78.addPreset('fastball'),()=>KneekuraPitcherMakerV78.selectPitch('slider')]){try{action();errors.push(null);}catch(error){errors.push(error.message);}}return{errors,roster:baseballMaker.getLiveRoster(),state:KneekuraPitcherMakerV78.inspect(),playerValue:document.getElementById('pitcher-player').value,name:document.getElementById('pitcher-pitch-name').value};});
  assert(rejected.errors.every(Boolean),'API mutations must preserve pending drafts');
  assert.deepEqual(rejected.roster,dirtyBefore.roster);assert.deepEqual(rejected.state.pending,dirtyBefore.pending);
  assert.equal(rejected.state.pitcherId,dirtyBefore.id);assert.equal(rejected.playerValue,dirtyBefore.id);assert.equal(rejected.state.pitchId,dirtyBefore.pitchId);assert.equal(rejected.name,'未保存の名前');
  await page.locator('#pitcher-discard-inputs-v82').click();
  assert.equal(await page.locator('#pitcher-pitch-name').inputValue(),savedName);
  assert.equal(await page.evaluate(()=>KneekuraPitcherMakerV78.inspect().pending.length),0);
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),dirtyBefore.roster);
  await page.locator('#pitcher-public-speed').fill('1');await page.locator('#pitcher-public-speed').dispatchEvent('change');
  assert((await page.evaluate(()=>KneekuraPitcherMakerV78.inspect().pending.length))>0);
  await page.locator('#pitcher-discard-inputs-v82').click();
  assert.equal(await page.evaluate(()=>KneekuraPitcherMakerV78.inspect().pending.length),0);
  assert.notEqual(await page.locator('#pitcher-public-speed').inputValue(),'1');

  const copied=await page.evaluate(()=>{const library=KneekuraPitchLibraryV78;library.appendRevision({originalId:'recovery-test',name:'保管した球',pitchType:'fastball',releaseSpeedMps:30,spinRadPerSecond:{x:100,y:0,z:0}});const first=library.copyToPlayer({originalId:'recovery-test',revision:1}),second=library.copyToPlayer({originalId:'recovery-test',revision:1});KneekuraPitcherMakerV78.selectPitch(second.pitchId);const before=baseballMaker.getLiveRoster(),history=library.exportState();KneekuraPitcherMakerV78.removePitch();const after=baseballMaker.getLiveRoster();KneekuraPitcherMakerV78.undoPitchRemoval();return{first,second,before,after,restored:baseballMaker.getLiveRoster(),history,historyAfter:library.exportState()};});
  assert.notEqual(copied.first.pitchId,copied.second.pitchId);assert.deepEqual(copied.restored,copied.before);assert.deepEqual(copied.historyAfter,copied.history);
  assert(copied.after.entries.find(entry=>entry.playerId===initial.pitcher.pitcherId).physical.pitchRepertoireV78.pitches.some(row=>row.pitchId===copied.first.pitchId));
  assert(!copied.after.entries.find(entry=>entry.playerId===initial.pitcher.pitcherId).physical.pitchRepertoireV78.pitches.some(row=>row.pitchId===copied.second.pitchId));
  const stale=await page.evaluate(()=>{const api=KneekuraPitcherMakerV78,result=[],other=KneekuraLiveGameRosterCatalog.players.find(player=>player.playerId!==api.inspect().pitcherId).playerId;
   function rejectUndo(label){const before=JSON.stringify({roster:baseballMaker.getLiveRoster(),library:KneekuraPitchLibraryV78.exportState(),season:KneekuraCourseSeasonsV79.getState()});let error='';try{api.undoPitchRemoval();}catch(e){error=e.message;}result.push({label,error,unchanged:before===JSON.stringify({roster:baseballMaker.getLiveRoster(),library:KneekuraPitchLibraryV78.exportState(),season:KneekuraCourseSeasonsV79.getState()}),canUndo:api.inspect().canUndoPitchRemoval});}
   api.removePitch();api.applyPatches([{playerId:api.inspect().pitcherId,path:'physical.minimumSpinRatio',value:.9}]);rejectUndo('confirmed edit');
   api.removePitch();api.applyPatches([{playerId:other,path:'physical.minimumSpinRatio',value:.8}]);rejectUndo('other player edit');
   api.removePitch();KneekuraPitchLibraryV78.appendRevision({originalId:'recovery-test',name:'次の版',pitchType:'fastball',releaseSpeedMps:30,spinRadPerSecond:{x:100,y:0,z:0}});rejectUndo('library edit');
   api.removePitch();KneekuraCourseSeasonsV79.command({kind:'create',seasonId:'recovery-undo-test',name:'取消の検証'});rejectUndo('season edit');
   api.removePitch();baseballMaker.importLiveRoster(baseballMaker.getLiveRoster());rejectUndo('roster import');api.removePitch();api.selectPlayer(other);rejectUndo('player change');return result;});
  assert(stale.every(row=>row.error&&row.unchanged&&!row.canUndo),JSON.stringify(stale));
  await page.evaluate(({roster,id})=>{baseballMaker.importLiveRoster(roster);KneekuraPitcherMakerV78.selectPlayer(id);},{roster:copied.before,id:initial.pitcher.pitcherId});
  const last=await page.evaluate(()=>{const api=KneekuraPitcherMakerV78,count=()=>api.getRoster().entries.find(entry=>entry.playerId===api.inspect().pitcherId).physical.pitchRepertoireV78.pitches.length;while(count()>1)api.removePitch();const before=JSON.stringify(baseballMaker.getLiveRoster());let error='';try{api.removePitch();}catch(e){error=e.message;}return{error,unchanged:before===JSON.stringify(baseballMaker.getLiveRoster()),count:count()};});
  assert.equal(last.count,1);assert(last.unchanged);assert.match(last.error,/最低1球/);
  assert(await page.locator('#pitcher-remove-v82').isDisabled());assert(await page.locator('#pitcher-pitch-reset').isDisabled());assert.match(await page.locator('#pitcher-remove-note-v82').textContent(),/最低1球/);
  await page.locator('#pitcher-undo-remove-v82').click();assert.equal(await page.evaluate(()=>KneekuraPitchMenuV80.inspect().ownedPitchIds.length),2);
  const roundTrip=await page.evaluate(()=>{const state=baseballMaker.getState();baseballMaker.importState(JSON.parse(JSON.stringify(state)));return{before:state.livePhysicalRoster,after:baseballMaker.getLiveRoster()};});
  assert.deepEqual(roundTrip.after,roundTrip.before);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  cases.push({width,visibleRemoval:true,exactUndo:true,dirtyRecovery:true,staleUndoRejected:true,lastPitchRetained:true,libraryHistoryUnchanged:true,jsonCompatible:true});
  await page.close();
 }
 assert.equal(sha(await readFile(file)),artifactSha256,'artifact remains unchanged during recovery checks');report.pass=true;console.log(JSON.stringify(report));
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await browser.close();if(directory){await mkdir(directory,{recursive:true});await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2)+'\n');}}

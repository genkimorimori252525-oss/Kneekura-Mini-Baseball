import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const file=resolve(process.argv[2]??'../../outputs/にーくら野球メーカー_v86_入力確定とエラー表示修正版.html'),
 directory=resolve(process.argv[3]??'docs/verification/releases/v86/drafts-browser');
const sha=value=>createHash('sha256').update(value).digest('hex'),artifactSha256=sha(await readFile(file)),meta=JSON.parse(await readFile(file+'.build.json'));
assert.equal(artifactSha256,meta.sha256);await mkdir(directory,{recursive:true});
const report={pass:false,file,artifactSha256,scope:'Headless Chrome at 1200/390px; maker draft preservation, correction, and cross-panel status events.',cases:[],faults:[]};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const near=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-8,`${label}: ${actual} vs ${expected}`);

async function openPitcher(page){
 await page.locator('#tab-pitcher').click();
 await page.evaluate(()=>{document.getElementById('pitcher-pitch-details').open=true;document.getElementById('pitcher-delivery-details').open=true;document.querySelector('.pitcher-seam-details').open=true;});
}
async function values(page){
 return page.evaluate(()=>{
  const api=KneekuraPitcherMakerV78,state=api.inspect(),roster=baseballMaker.getLiveRoster(),
   player=KneekuraBaseballWorkbench.applyLivePhysicalRosterV1({players:KneekuraLiveGameRosterCatalog.players,roster}).players.find(row=>row.playerId===state.pitcherId),
   row=KneekuraBaseballWorkbench.resolvePitcherRepertoireV78(player.physical).find(row=>row.pitchId===state.pitchId),
   control=KneekuraBaseballWorkbench.projectLivePublicAbilitiesV1({roster,reference:KneekuraLivePublicAbilityReference,playerId:state.pitcherId}).abilities.find(row=>row.id==='control').value;
  return {state,roster,player,row,control,rpm:KneekuraBaseballWorkbench.pitchSpinToControlsV77(row.spinRadPerSecond).spinRpm,
   inputs:Object.fromEntries(['pitcher-pitch-name','pitcher-pitch-rpm','pitcher-seam-enabled','pitcher-release-height','pitcher-motion-duration','pitcher-public-control'].map(id=>{
    const node=document.getElementById(id);return [id,{value:node.type==='checkbox'?node.checked:node.value,customError:node.validity.customError,validationMessage:node.validationMessage,ariaInvalid:node.getAttribute('aria-invalid')}];
   })),status:document.getElementById('pitcher-status').textContent,statusError:document.getElementById('pitcher-status').classList.contains('error')};
 });
}
async function rawInput(page,id,value){
 await page.evaluate(({id,value})=>{const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},{id,value});
}
async function change(page,id,value){await rawInput(page,id,value);await page.locator('#'+id).dispatchEvent('change');}
async function capture(page,name){await page.locator('#pitcher-panel').screenshot({path:resolve(directory,`${page.viewportSize().width}-${name}.png`)});}
async function feedback(page,id,action=false){
 return page.locator('#'+id).evaluate((input,action)=>{
  const parent=input.closest(action?'details,section':'label,.control'),note=parent?.querySelector(':scope > p[data-maker-local-message]');
  return {found:!!note,hidden:note?.hidden??true,error:note?.classList.contains('error')??false,text:note?.textContent??'',
   described:!!note&&input.getAttribute('aria-describedby')?.split(/\s+/).includes(note.id),ariaInvalid:input.getAttribute('aria-invalid')};
 },action);
}
function localError(current,label){assert(current.found,label+' has local feedback');assert.equal(current.hidden,false,label+' feedback visible');assert.equal(current.error,true,label+' feedback is error');assert(current.text.trim(),label+' feedback contains cause');}
function cleared(current){
 assert.equal(current.state.pending.length,0,JSON.stringify(current.state.pending));assert.equal(current.state.error,null,current.status);assert.equal(current.statusError,false,current.status);
 for(const [id,input]of Object.entries(current.inputs)){assert.equal(input.customError,false,id+' custom error');assert.notEqual(input.ariaInvalid,'true',id+' aria-invalid');}
}
async function preservePitchDraft(page,kind){
 const name='v86 draft '+kind;await rawInput(page,'pitcher-pitch-name',name);const initial=await values(page);
 assert(initial.state.pending.some(row=>row.id==='pitcher-pitch-name'));await page.locator('#tab-player').click();
 if(kind==='base-player-selection'){
  const next=await page.locator('#live-roster-player option').nth(1).getAttribute('value');await page.locator('#live-roster-player').selectOption(next);
 }else{
  const id=kind==='base-public-invalid'?'public-ability-control':await page.locator('#live-roster-fields [data-roster-path="heightMeters"]').getAttribute('id'),original=await page.locator('#'+id).inputValue();
  await rawInput(page,id,'');assert.equal(await page.locator('#'+id).evaluate(input=>input.validity.customError),true,'base invalid value is held');
  let current=await values(page);assert.equal(current.inputs['pitcher-pitch-name'].value,name,'base failure preserves pitch name');
  assert(current.state.pending.some(row=>row.id==='pitcher-pitch-name'),'base failure preserves pitch pending');
  await rawInput(page,id,original);assert.equal(await page.locator('#'+id).evaluate(input=>input.validity.customError),false,'base correction clears its error');
 }
 await openPitcher(page);const current=await values(page);assert.equal(current.state.pitcherId,initial.state.pitcherId);assert.equal(current.inputs['pitcher-pitch-name'].value,name);
 assert(current.state.pending.some(row=>row.id==='pitcher-pitch-name'),'status/selection preserves pending');
 await page.locator('#pitcher-pitch-apply').click();const saved=await values(page);assert.equal(saved.row.name,name,'preserved name is saved');cleared(saved);
 return {kind,draftName:name,pitcherId:saved.state.pitcherId,draftRetained:true,correctedAndSaved:true};
}
const scenarios=[
 ['checkbox-mode-tab-save',async page=>{
  await page.locator('#pitcher-seam-enabled').check();assert.equal((await values(page)).inputs['pitcher-seam-enabled'].value,true);
  await page.locator('#maker-mode-ai').click();await page.locator('#maker-mode-human').click();await page.locator('#tab-player').click();await openPitcher(page);
  let current=await values(page);assert.equal(current.inputs['pitcher-seam-enabled'].value,true,'unsaved checkbox survives mode and tab refresh');
  assert(current.state.pending.some(row=>row.id==='pitcher-seam-enabled'));await page.locator('#pitcher-pitch-apply').click();current=await values(page);
  assert(current.row.seamForce,'ON checkbox was stored as a seam model');cleared(current);return {checkboxRetained:true,seamSaved:true};
 }],
 ['auto-input-before-change',async page=>{
  await rawInput(page,'pitcher-release-height','1.95');await page.locator('#maker-mode-ai').click();await page.locator('#maker-mode-human').click();await page.locator('#tab-player').click();await openPitcher(page);
  assert.equal((await values(page)).inputs['pitcher-release-height'].value,'1.95','uncommitted numeric input survives refresh');
  await page.locator('#pitcher-release-height').dispatchEvent('change');const saved=await values(page);near(saved.player.physical.pitchReleaseHeightMeters,1.95,'release height saved');cleared(saved);
  return {numericInputRetained:true,correctValueSaved:true};
 }],
 ...['base-public-invalid','base-internal-invalid','base-player-selection'].map(kind=>[kind,page=>preservePitchDraft(page,kind)]),
 ['multiple-auto-errors-corrected',async page=>{
  await change(page,'pitcher-release-height','99');await change(page,'pitcher-motion-duration','1');
  let current=await values(page);assert(current.state.pending.length>=2,'both invalid fields are retained');
  await capture(page,'two-auto-errors');
  for(const id of ['pitcher-release-height','pitcher-motion-duration']){const local=await feedback(page,id);localError(local,id);assert.equal(local.ariaInvalid,'true');assert.equal(local.described,true,id+' describes local error');}
  await change(page,'pitcher-release-height','1.95');current=await values(page);near(current.player.physical.pitchReleaseHeightMeters,1.95,'first corrected field commits despite other error');
  assert.equal(current.inputs['pitcher-release-height'].customError,false);assert.equal(current.inputs['pitcher-motion-duration'].value,'1','other invalid draft remains visible');
  await capture(page,'remaining-auto-error');
  assert.equal((await feedback(page,'pitcher-release-height')).error,false,'corrected field clears its local error');localError(await feedback(page,'pitcher-motion-duration'),'uncorrected motion');
  await change(page,'pitcher-motion-duration','1800');current=await values(page);near(current.player.physical.pitchingMotion.preparationMs,1800,'second corrected field saved');cleared(current);
  assert.equal((await feedback(page,'pitcher-motion-duration')).error,false,'last corrected field clears local error');
  return {errorsRetained:true,independentCorrection:true,pendingCleared:true};
 }],
 ['pitch-and-public-groups',async page=>{
  await rawInput(page,'pitcher-pitch-rpm','2300');await change(page,'pitcher-public-control','75');await page.locator('#pitcher-pitch-apply').click();
  const current=await values(page);near(current.rpm,2300,'pitch rpm saved');near(current.control,75,'public control saved');cleared(current);
  return {pitchAndPublicValuesSaved:true,noCrossGroupDeadlock:true};
 }],
 ['pitch-error-localization-and-correction',async page=>{
  await rawInput(page,'pitcher-pitch-rpm','');await page.locator('#pitcher-pitch-apply').click();
  await capture(page,'pitch-group-error');
  const group=await feedback(page,'pitcher-pitch-apply',true);localError(group,'pitch settings group');
  let current=await values(page);assert(current.state.pending.some(row=>row.id==='pitcher-pitch-rpm'),'empty rpm remains an identified draft');
  await rawInput(page,'pitcher-pitch-rpm','2200');await page.locator('#pitcher-pitch-apply').click();current=await values(page);near(current.rpm,2200,'corrected rpm saved');cleared(current);
  assert.equal((await feedback(page,'pitcher-pitch-apply',true)).error,false,'successful save clears group error');
  assert.equal((await feedback(page,'pitcher-pitch-rpm')).error,false,'successful save clears rpm error');
  await capture(page,'pitch-group-corrected');
  return {groupErrorNearSettings:true,correctedRpmSaved:true,pendingAndLocalErrorsCleared:true};
 }]
];

try{
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),faults={width,errors:[],external:[]};page.setDefaultTimeout(10000);report.faults.push(faults);
  page.on('pageerror',error=>faults.errors.push(String(error)));page.on('request',request=>{if(!/^(file:|data:|blob:|about:)/.test(request.url()))faults.external.push(request.url());});
  for(const [name,check]of scenarios){
   const result={width,name,pass:false};report.cases.push(result);
   try{
    await page.goto(pathToFileURL(file).href,{timeout:60000});await page.waitForFunction(()=>globalThis.KneekuraPitcherMakerV78&&globalThis.KneekuraMakerGuidesV85);await openPitcher(page);
    result.observed=await check(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);result.pass=true;
   }catch(error){result.error=String(error.stack??error);try{result.state=await values(page);await page.screenshot({path:resolve(directory,`failure-${width}-${name}.png`)});}catch(snapshotError){result.snapshotError=String(snapshotError);}}
  }
  assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);await page.close();
 }
 assert.equal(sha(await readFile(file)),artifactSha256,'artifact unchanged during checks');
 const failed=report.cases.filter(row=>!row.pass);assert.equal(failed.length,0,failed.map(row=>`${row.width}/${row.name}: ${row.error.split('\n')[0]}`).join('\n'));
 report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await browser.close();await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,artifactSha256,cases:report.cases.length,failed:report.cases.filter(row=>!row.pass).map(row=>({width:row.width,name:row.name,error:row.error.split('\n')[0]})),output:directory}));}

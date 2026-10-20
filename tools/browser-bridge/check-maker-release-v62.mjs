import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg]=process.argv.slice(2);assert(artifactArg&&evidenceArg,'requires maker HTML and evidence directory');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),sha=b=>createHash('sha256').update(b).digest('hex'),
  keys=['pitchReleaseHeightMeters','pitchReleaseSideMeters','pitchReleaseExtensionMeters'],
  report={artifact,views:[],scope:'Maker inputs, physical roster validation and real JSON downloads/reload; match execution is separately verified'};
await mkdir(evidence,{recursive:true});let browser;
try{
 const bytes=await readFile(artifact),meta=JSON.parse(await readFile(artifact+'.build.json','utf8')),
   manifestBytes=await readFile(artifact+'.bundle-inputs.json'),manifest=JSON.parse(manifestBytes),
   roster=JSON.parse(await readFile(meta.liveRosterPath,'utf8')),catalog=JSON.parse(await readFile(meta.liveRosterCatalogPath,'utf8')),
   previous=JSON.parse(await readFile('docs/demos/live-game-roster-v61.json','utf8'));
 assert.equal(sha(bytes),meta.sha256);assert.equal(sha(manifestBytes),meta.bundleInputManifestSha256);
 assert.equal(sha(await readFile(meta.liveRosterPath)),meta.liveRosterSha256);assert.equal(sha(await readFile(meta.liveRosterCatalogPath)),meta.liveRosterCatalogSha256);
 for(const [path,expected]of Object.entries(manifest.inputs))assert.equal(sha(await readFile(path)),expected,'maker bundle input '+path);
 report.sha256=meta.sha256;report.manifest={inputs:Object.keys(manifest.inputs).length,sourceHashesMatch:true};
 assert.equal(roster.entries.length,20);assert.equal(catalog.players.length,20);assert.equal(catalog.fields.length,47);
 for(const entry of roster.entries){
  const old=previous.entries.find(e=>e.playerId===entry.playerId),withoutRelease=structuredClone(entry.physical);
  for(const key of keys){assert(Number.isFinite(withoutRelease[key]));delete withoutRelease[key];}
  assert.deepEqual(withoutRelease,old.physical,'all existing SI, public vision and trait controls are retained');
  assert.equal(entry.physical.pitchReleaseHeightMeters,Number((entry.heightMeters*.86).toFixed(6)));
  assert.equal(entry.physical.pitchReleaseSideMeters,Number((entry.heightMeters*.25).toFixed(6)));
  assert.equal(entry.physical.pitchReleaseExtensionMeters,1.54);
 }
 for(const key of keys)assert.equal(catalog.fields.filter(f=>f.path===key&&f.section==='pitcher').length,1);
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860},acceptDownloads:true}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:)/.test(r.url()))external.push(r.url());});
  await page.goto(pathToFileURL(artifact).href);await page.waitForFunction(()=>globalThis.baseballMaker?.getLiveRoster()?.entries.length===20);
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),roster);
  await page.locator('#tab-player').click();await page.locator('#live-roster-internals').evaluate(e=>e.open=true);
  const coverage=[];
  for(const identity of catalog.players){
   await page.locator('#live-roster-player').selectOption(identity.playerId);
   const entry=roster.entries.find(e=>e.playerId===identity.playerId);
   for(const key of keys){const input=page.locator('[data-roster-path="'+key+'"]');assert(await input.isEnabled());assert.equal(Number(await input.inputValue()),entry.physical[key]);}
   coverage.push(identity.playerId);
  }
  const selected=catalog.players.find(p=>p.role==='P').playerId;await page.locator('#live-roster-player').selectOption(selected);
  const edits={pitchReleaseHeightMeters:1.234567,pitchReleaseSideMeters:.654321,pitchReleaseExtensionMeters:1.876543};
  for(const [key,value]of Object.entries(edits)){const input=page.locator('[data-roster-path="'+key+'"]');await input.fill(String(value));assert.equal(await input.evaluate(e=>e.validationMessage),'');}
  const edited=await page.evaluate(()=>baseballMaker.getLiveRoster());for(const [key,value]of Object.entries(edits))assert.equal(edited.entries.find(e=>e.playerId===selected).physical[key],value);
  assert.equal(edited.entries.find(e=>e.playerId===selected).physical.plateVision,roster.entries.find(e=>e.playerId===selected).physical.plateVision);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export-live-roster').click()]),saved=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.deepEqual(saved,edited);await page.locator('#live-roster-file').setInputFiles({name:'release-edits.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),saved);
  const [fullDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#save-json').click()]),full=JSON.parse(await readFile(await fullDownload.path(),'utf8'));
  await page.reload();await page.waitForFunction(()=>globalThis.baseballMaker?.getLiveRoster()?.entries.length===20);
  await page.evaluate(state=>baseballMaker.importState(state),full);assert.deepEqual(await page.evaluate(()=>baseballMaker.getState()),full);
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),saved);
  const rejected=await page.evaluate(key=>{const prior=baseballMaker.getState(),bad=structuredClone(prior);bad.livePhysicalRoster.entries[0].physical[key]=-1;
   let message=null;try{baseballMaker.importState(bad);}catch(error){message=error.message;}
   return {message,unchanged:JSON.stringify(prior)===JSON.stringify(baseballMaker.getState())};},keys[0]);
  assert(rejected.message&&rejected.unchanged);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await page.locator('#tab-player').click();await page.locator('#live-roster-internals').evaluate(e=>e.open=true);await page.locator('#live-roster-player').selectOption(selected);
  await page.locator('[data-roster-path="pitchReleaseHeightMeters"]').scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:resolve(evidence,'maker-release-'+width+'.png')});
  report.views.push({width,coverage,edits,realDownloadAndReload:true,invalidImportAtomic:rejected,pageErrors:errors,external});await page.close();
 }
 report.pass=true;console.log(JSON.stringify({pass:true,sha256:report.sha256,widths:[1200,390],players:20,releaseSI:3,existingValuesPreserved:true}));
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await writeFile(resolve(evidence,'maker-release-check.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();}

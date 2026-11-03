import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const path=resolve(process.argv[2]??'../../outputs/にーくら野球メーカー_v79_63コースとシーズン成績版.html'),
 dir=resolve(process.argv[3]??'docs/verification/releases/v79/pitch-views');
const sha=b=>createHash('sha256').update(b).digest('hex'),bytes=await readFile(path),html=bytes.toString('utf8'),
 meta=JSON.parse(await readFile(path+'.build.json')),pinBytes=await readFile(path+'.bundle-inputs.json'),pins=JSON.parse(pinBytes),
 old=JSON.parse(await readFile('docs/demos/releases/v78.1/maker.html.build.json')),
 core=await readFile('dist/batting-workbench-core.js'),reference=await readFile('docs/demos/measured-bat-library-v1.json');
assert.equal(sha(bytes),meta.sha256,'artifact matches V79 metadata');assert(meta.courseSeasons&&meta.pitchViews,'V79 course and inherited pitch views are enabled');
assert.equal(sha(pinBytes),meta.bundleInputManifestSha256,'V79 source manifest matches metadata');
assert.equal(pins.entrySha256,meta.coreSha256,'V79 entry matches source pins');assert.equal(sha(core),meta.coreSha256,'current V79 bundle matches metadata');
assert(html.includes(core.toString('utf8')),'artifact embeds the pinned V79 bundle');
for(const file of ['src/integration/browser/BatterCourseProfileV79.ts','src/integration/browser/BatterCourseWorkbenchV79.ts',
 'src/integration/browser/LiveSeasonV79.ts','src/integration/browser/LiveCourseScoringV79.ts'])assert(Object.hasOwn(pins.inputs,file),'V79 source pinned: '+file);
for(const [file,hash]of Object.entries(pins.inputs))assert.equal(sha(await readFile(file)),hash,file);
assert.equal(Object.keys(pins.inputs).length,meta.bundleInputCount,'V79 source count');
const inheritedFiles={pitchViewsUiSha256:'docs/demos/baseball-maker-pitcher-views-v78.js',pitcherUiSha256:'docs/demos/baseball-maker-pitcher-v78.js',
 pitcherCssSha256:'docs/demos/baseball-maker-pitcher-v78.css',pitcherAdapterSha256:'tools/browser-bridge/maker-pitcher-renderer-v77.js',
 liveRosterSha256:meta.liveRosterPath,liveRosterCatalogSha256:meta.liveRosterCatalogPath,
 referenceSha256:'docs/demos/measured-bat-library-v1.json',libraryDecoderSha256:'tools/browser-bridge/measured-bat-library-v1.js'};
for(const [key,file]of Object.entries(inheritedFiles)){
 assert.equal(meta[key],old[key],'V78.1 inherited '+key);const source=await readFile(file);assert.equal(sha(source),meta[key],file);
 if(['pitchViewsUiSha256','pitcherUiSha256','pitcherCssSha256'].includes(key))assert(html.includes(source.toString('utf8')),'unchanged inherited UI embedded: '+file);
}
assert.equal(meta.publicReferenceSha256,old.publicReferenceSha256,'public ability reference unchanged');
assert.equal(meta.referenceClips,673);assert.equal(meta.referenceClips,old.referenceClips);assert.equal(meta.gamePlayers,20);
assert(html.includes(JSON.stringify(reference.toString('utf8')).replace(/</g,'\\u003c')),'artifact embeds the unchanged 673-trial source');
const authoredRoster=JSON.parse(await readFile(meta.liveRosterPath)),authoredCatalog=JSON.parse(await readFile(meta.liveRosterCatalogPath));
await mkdir(dir,{recursive:true});const report={pass:false,artifact:path,sha256:meta.sha256,coreSha256:meta.coreSha256,
 sourceCount:Object.keys(pins.inputs).length,v79SourcePinsMatched:true,inheritedPitchViewsUiAndDataUnchanged:true,referenceClips:673,cases:[],faults:[]};
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),faults={width,errors:[],external:[]};report.faults.push(faults);
  page.on('pageerror',e=>faults.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))faults.external.push(r.url());});
  await page.goto(pathToFileURL(path).href,{timeout:60000});await page.waitForFunction(()=>globalThis.KneekuraPitcherTrajectoryViewsV78?.inspect,undefined,{timeout:60000});
  const inherited=await page.evaluate(()=>({roster:KneekuraLiveGameRosterData,catalog:KneekuraLiveGameRosterCatalog,clips:KneekuraReferenceBatMotions.clips.length,profiles:baseballMaker.getLiveRoster().entries.filter(row=>row.physical.batterCourseProfileV79!==undefined).length}));
  assert.deepEqual(inherited.roster,authoredRoster);assert.deepEqual(inherited.catalog,authoredCatalog);assert.equal(inherited.clips,673);assert.equal(inherited.profiles,0,'viewing V79 preserves omitted course profiles');
  await page.locator('#tab-pitcher').click();await page.locator('#pitcher-trajectory-details > summary').click();
  assert.equal(await page.locator('#pitcher-perspective-plots canvas').count(),4);
  const roster=await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster()));
  for(const pitch of ['fastball','curve']){
   await page.evaluate(p=>KneekuraPitcherMakerV78.selectPitch(p),pitch);
   await page.locator('#pitcher-run').click();await page.waitForFunction(()=>KneekuraPitcherTrajectoryViewsV78.inspect().ready||KneekuraPitcherTrajectoryViewsV78.inspect().error);
   const first=await page.evaluate(()=>({views:KneekuraPitcherTrajectoryViewsV78.inspect(),result:JSON.stringify(KneekuraPitcherMakerV78.exportResult())}));
   assert(first.views.ready,first.views.error);assert.equal(first.views.views.length,4);
   const pixels=await page.locator('#pitcher-perspective-plots canvas').evaluateAll(canvases=>canvases.map(canvas=>{
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let green=0,gray=0;
    for(let i=0;i<data.length;i+=4){if(data[i]<60&&data[i+1]>90&&data[i+1]<160&&data[i+2]<110)green++;if(Math.abs(data[i]-137)<8&&Math.abs(data[i+1]-150)<8&&Math.abs(data[i+2]-142)<8)gray++;}
    return {id:canvas.id,green,gray,width:canvas.getBoundingClientRect().width,png:canvas.toDataURL()};
   }));
   assert(pixels.every(p=>p.green>40&&p.gray>20&&p.width>150),JSON.stringify(pixels.map(({png,...p})=>p)));
   assert.notEqual(pixels[2].png,pixels[3].png);await page.locator('#pitcher-views-fit').uncheck();
   assert.equal(await page.evaluate(()=>JSON.stringify(KneekuraPitcherMakerV78.exportResult())),first.result);
   await page.locator('#pitcher-views-fit').check();
   assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),roster);
   const final=await page.evaluate(()=>KneekuraPitcherTrajectoryViewsV78.inspect());
   assert.equal(JSON.stringify(final.actual),JSON.stringify(first.views.actual));assert.equal(JSON.stringify(final.baseline),JSON.stringify(first.views.baseline));
   report.cases.push({width,pitch,points:first.views.actual.length,viewNames:first.views.views.map(v=>v.name),pixels:pixels.map(({png,...p})=>p),sourceAndRosterUnchanged:true});
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.mouse.move(width-1,1);await page.keyboard.press('Escape');
  await page.locator('#pitcher-perspective-plots').screenshot({path:dir+'/views-'+width+'.png'});
  await page.evaluate(()=>KneekuraPitcherMakerV78.selectPitch('slider'));
  await page.waitForFunction(()=>!KneekuraPitcherTrajectoryViewsV78.inspect().ready);
  assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),roster);
  assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);await page.close();
 }
 assert.equal(sha(await readFile(path)),meta.sha256);report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await writeFile(dir+'/pitch-views-check.json',JSON.stringify(report,null,2)+'\n');await browser?.close();}
console.log(JSON.stringify({pass:true,cases:report.cases.length,sha256:meta.sha256,v79SourcePinsMatched:true,inheritedPitchViewsUiAndDataUnchanged:true}));

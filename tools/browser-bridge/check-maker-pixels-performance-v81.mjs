import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const artifact=resolve(process.argv[2]),out=resolve(process.argv[3]),baseline=process.argv[4]?JSON.parse(await readFile(process.argv[4])):null,sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});const report={pass:false,artifact,sha256:sha(await readFile(artifact)),cases:[],faults:[],scope:'Same-time maker ball/bat/ordinary composite pixels and actual shared Core trials, simulated PC/mobile viewports.'};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),fault={width,errors:[],external:[]};report.faults.push(fault);page.on('pageerror',e=>fault.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))fault.external.push(r.url());});
  const start=Date.now();await page.goto(pathToFileURL(artifact).href,{timeout:60000});await page.waitForFunction(()=>KneekuraBatterComparisonV70?.inspect().ready&&KneekuraPitcherMakerV78&&!KneekuraPitcherMakerV78.inspect().loading,undefined,{timeout:60000});await page.evaluate(()=>document.fonts.ready);
  const startupMs=Date.now()-start;
  const row=await page.evaluate(async()=>{
   const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join(''),json=async value=>digest(new TextEncoder().encode(JSON.stringify(value))),canvasHash=async id=>{const c=document.getElementById(id);return digest(c.getContext('2d').getImageData(0,0,c.width,c.height).data);},captures=[],trials=[],before=JSON.stringify(baseballMaker.getLiveRoster());
   document.getElementById('tab-bat').click();await KneekuraBallComparison.run();KneekuraBallComparison.seek(0);
   const comparison=KneekuraBallComparison.getResult();if(!comparison)throw Error(KneekuraBallComparison.inspect().error??'comparison unavailable');
   trials.push({kind:'batter',hash:await json(KneekuraBallComparison.inspect().metrics)});
   for(let level=1;level<=4;level++)for(const seconds of [.1,.3,.5,1,2]){const e=document.getElementById('comparison-level');e.value=level;e.dispatchEvent(new Event('change'));KneekuraBallComparison.seek(seconds);const state=KneekuraBatterComparisonV70.inspect();if(state.error)throw Error(state.error);captures.push({kind:'batter',level,seconds,hash:await canvasHash('comparison-canvas-batter'),scene:state.renderer.sceneSeconds,ball:state.renderer.ballSeconds,hostUnchanged:state.renderer.hostUnchanged});}
   document.getElementById('tab-pitcher').click();
   for(const pitch of ['fastball','curve']){KneekuraPitcherMakerV78.selectPitch(pitch);await KneekuraPitcherMakerV78.run();KneekuraPitcherMakerV78.seek(0);trials.push({kind:'pitcher',pitch,hash:await json(KneekuraPitcherMakerV78.exportResult())});
    for(const seconds of [0,1,1.55,1.7,1.85,2.1]){KneekuraPitcherMakerV78.seek(seconds);const state=KneekuraPitcherMakerV78.inspect();if(state.error)throw Error(state.error);captures.push({kind:'pitcher',pitch,seconds,hash:await canvasHash('pitcher-canvas'),scene:state.renderer.sceneSeconds,ball:state.renderer.ballSeconds,hostUnchanged:state.renderer.hostUnchanged});}
   }
   if(before!==JSON.stringify(baseballMaker.getLiveRoster()))throw Error('observation changed roster');
   return {clips:KneekuraReferenceBatMotions.clips.length,trials,captures,rosterHash:await json(baseballMaker.getLiveRoster()),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(row.clips,673);assert(!row.overflow);assert(row.captures.every(c=>c.hostUnchanged));if(baseline)assert.deepEqual(row,baseline.cases.find(c=>c.width===width).observations,'maker same-time/source '+width);
  report.cases.push({width,startupMs,observations:row});assert.deepEqual(fault.errors,[]);assert.deepEqual(fault.external,[]);await page.screenshot({path:resolve(out,'maker-'+width+'.png')});await page.close();console.log(JSON.stringify({width,captures:row.captures.length,compared:!!baseline}));
 }
 assert.equal(sha(await readFile(artifact)),report.sha256);report.pass=true;
}catch(e){report.error=String(e.stack??e);throw e;}finally{await browser?.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}

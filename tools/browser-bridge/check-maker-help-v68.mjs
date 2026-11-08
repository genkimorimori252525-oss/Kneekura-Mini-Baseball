import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const repo=process.cwd(),out=resolve(repo,'docs/verification/releases/v68/maker-help');
await mkdir(out,{recursive:true});
const js=await readFile('docs/demos/baseball-maker-help-v68.js','utf8'),css=await readFile('docs/demos/baseball-maker-light-v68.css','utf8'),catalog=JSON.parse(await readFile('docs/demos/live-game-roster-catalog-v62.json','utf8'));
const report={pass:false,helpSha256:createHash('sha256').update(js).digest('hex'),cssSha256:createHash('sha256').update(css).digest('hex'),widths:[],errors:[]};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of[1200,390]){
  const page=await browser.newPage({viewport:{width,height:860}});page.on('pageerror',e=>report.errors.push(String(e)));
  await page.setContent('<html><head><style>body{margin:0;padding:12px}.control{margin-bottom:12px}label{display:block}input{height:24px}'+css+'</style></head><body><div class="control"><label for="pursuit">旧表示 (m)<output id="kept-output">12 m</output></label><input id="pursuit" aria-describedby="existing-note" data-roster-path="fieldingPursuitCostWeight" value="1"></div><div class="control"><label for="custom">新しい弾道</label><input id="custom" data-help="上にすると当てる付近だけ上向きになります。元のフォームと時刻は残します。" data-help-label="当てる付近の角度" value="5"></div><div id="dynamic"></div></body></html>');
  await page.addScriptTag({content:js});
  const before=await page.evaluate(()=>{let changes=0;document.getElementById('pursuit').addEventListener('change',()=>changes++);globalThis.fixtureChanges=()=>changes;KneekuraMakerHelp.install();KneekuraMakerHelp.install();return{state:KneekuraMakerHelp.inspect(),label:document.querySelector('label[for=pursuit]').textContent,output:document.getElementById('kept-output').textContent,value:document.getElementById('pursuit').value,icons:document.querySelectorAll('.maker-help-button').length};});
  assert.equal(before.state.delayMs,1000);assert.equal(before.icons,2);assert(before.label.includes('遠くの球を追う慎重さ (m)'));assert.equal(before.output,'12 m');assert.equal(before.value,'1');
  await page.locator('#pursuit').hover();await page.waitForTimeout(650);assert.equal((await page.evaluate(()=>KneekuraMakerHelp.inspect())).visible,false);
  await page.waitForTimeout(500);assert.equal((await page.evaluate(()=>KneekuraMakerHelp.inspect())).visible,true);assert((await page.locator('#maker-help-tooltip-v68').innerText()).includes('大きいほど慎重'));
  assert((await page.locator('#pursuit').getAttribute('aria-describedby')).includes('maker-help-tooltip-v68'));
  await page.keyboard.press('Escape');assert.equal((await page.evaluate(()=>KneekuraMakerHelp.inspect())).visible,false);assert.equal(await page.locator('#pursuit').getAttribute('aria-describedby'),'existing-note');
  await page.locator('#custom').locator('..').locator('.maker-help-button').click();assert.equal((await page.evaluate(()=>KneekuraMakerHelp.inspect())).visible,true);
  const rect=await page.locator('#maker-help-tooltip-v68').boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width&&rect.y>=0&&rect.y+rect.height<=860,'tooltip stays within viewport');
  await page.locator('#custom').focus();await page.locator('#custom').blur();assert.equal((await page.evaluate(()=>KneekuraMakerHelp.inspect())).visible,false);
  await page.evaluate(fields=>{const d=document.getElementById('dynamic');for(const[f,i]of fields.map((f,i)=>[f,i])){const wrapper=document.createElement('div');wrapper.className='control';const label=document.createElement('label');label.htmlFor='field-'+i;label.textContent=f.label+' ('+(f.unit||'比')+')';const input=document.createElement('input');input.id=label.htmlFor;input.dataset.rosterPath=f.path;input.value='1';wrapper.append(label,input);d.append(wrapper);}},catalog.fields);
  await page.waitForTimeout(60);const dynamic=await page.evaluate(()=>({icons:document.querySelectorAll('#dynamic .maker-help-button').length,state:KneekuraMakerHelp.inspect(),fields:[...document.querySelectorAll('#dynamic [data-roster-path]')].map(x=>({path:x.dataset.rosterPath,value:x.value}))}));assert.equal(dynamic.icons,catalog.fields.length);assert(dynamic.fields.every(x=>x.value==='1'));
  await page.evaluate(()=>{for(let i=0;i<10;i++)KneekuraMakerHelp.decorate();});await page.waitForTimeout(50);assert.equal(await page.locator('.maker-help-button').count(),catalog.fields.length+2);
  await page.locator('#pursuit').fill('2');await page.locator('#pursuit').dispatchEvent('change');assert.equal(await page.evaluate(()=>fixtureChanges()),1);
  await page.evaluate(()=>{document.getElementById('dynamic').replaceChildren();});await page.waitForTimeout(30);assert.equal(await page.locator('.maker-help-button').count(),2);
  await page.locator('#custom').focus();await page.waitForTimeout(1100);assert.equal((await page.evaluate(()=>KneekuraMakerHelp.inspect())).visible,true);await page.locator('#custom').blur();assert.equal((await page.evaluate(()=>KneekuraMakerHelp.inspect())).visible,false);
  await page.locator('#custom').locator('..').locator('.maker-help-button').click();await page.screenshot({path:resolve(out,'help-fixture-'+width+'.png')});
  await page.keyboard.press('Escape');
  const nested=await page.evaluate(()=>{const label=document.createElement('label');label.append(document.createTextNode('この選手の打ち方'));const select=document.createElement('select');select.id='nested-select';select.dataset.help='実測フォームを選びます。';for(let i=0;i<495;i++){const option=document.createElement('option');option.value=String(i);option.textContent='フォーム番号'+i;select.append(option);}label.append(select);document.body.append(label);KneekuraMakerHelp.decorate(label);return{label:label.textContent,button:label.nextElementSibling.getAttribute('aria-label')};});assert.equal(nested.button,'この選手の打ち方の説明');await page.locator('#nested-select').locator('..').locator('..').locator('.maker-help-button').last().click();const nestedTip=await page.locator('#maker-help-tooltip-v68').innerText();assert(nestedTip.startsWith('この選手の打ち方\n'));assert(!nestedTip.includes('フォーム番号'));report.nested495OptionsHeading=true;await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  report.widths.push({width,fieldCount:catalog.fields.length,controls:catalog.fields.length+2,delayMs:1000,outputPreserved:true,sourceValuesPreserved:true,existingChangeHandlerPreserved:true,noDuplicateIcons:true,mutationRebuild:true,keyboardAndClick:true,clamped:true});await page.close();
 }
 const touch=await browser.newPage({viewport:{width:390,height:640},hasTouch:true,isMobile:true});await touch.setContent('<style>'+css+'</style><div class=control><label for=touch-control>触って確認</label><input id=touch-control data-help=タップするとすぐ説明を表示します。></div>');await touch.addScriptTag({content:js});await touch.evaluate(()=>KneekuraMakerHelp.install());await touch.locator('.maker-help-button').tap();assert.equal((await touch.evaluate(()=>KneekuraMakerHelp.inspect())).visible,true);report.actualTouchImmediate=true;await touch.close();
 assert.deepEqual(report.errors,[]);report.pass=true;console.log(JSON.stringify(report));
}catch(e){report.error=String(e.stack||e);await writeFile(resolve(out,'help-fixture-failure-'+Date.now()+'.json'),JSON.stringify(report,null,2)+'\n');throw e;}finally{await writeFile(resolve(out,'help-fixture-check.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}

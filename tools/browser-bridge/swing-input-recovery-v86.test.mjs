import {expect,test} from 'vitest';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const baselinePath='docs/demos/baseball-maker-swing-v68.js';
const sourcePath=process.env.SWING_RECOVERY_SOURCE??'docs/demos/baseball-maker-swing-v86.js';
const source=readFileSync(resolve(sourcePath),'utf8');
const settings={level:2,angleDegreesByLevel:[-10,0,10,20],beforeSeconds:.1,afterSeconds:.06,method:'whole-arc-target'};

test('returning an unfinished angle to its saved value clears the draft message without saving again',()=>{
 const start=source.includes(' function settingDraftFor()')?source.indexOf(' function settingDraftFor()'):source.indexOf(' function settingsFromControls()'),end=source.indexOf(" $('swing-reset')",start);
 expect(start).toBeGreaterThan(-1);expect(end).toBeGreaterThan(start);
 const nodes=new Map(),saved=structuredClone(settings),before=JSON.stringify(saved);
 for(const [id,value]of [['swing-search',''],['swing-clip',''],['swing-enabled',''],['swing-form-class','all'],
  ['swing-method','whole-arc-target'],['swing-grade','2'],['swing-before-ms','100'],['swing-after-ms','60'],
  ...settings.angleDegreesByLevel.map((value,index)=>['swing-angle-'+(index+1),String(value)])]){
  nodes.set(id,{value,min:id.includes('angle')?'-30':'0',max:id.includes('angle')?'30':'1000',disabled:false,
   validity:{badInput:false},listeners:{},addEventListener(type,handler){this.listeners[type]=handler;}});
 }
 const status={textContent:'保存しています。',classList:{toggle(){}}};nodes.set('swing-editor-status',status);
 let commits=0;const context=vm.createContext({$:id=>nodes.get(id),root:{},settingDrafts:new Map(),committingPlayerId:null,connectedPreview:true,wholeArcUI:true,
  current:{id:'batter-1',settings:structuredClone(settings),entry:{physical:{impactTrajectory:saved}}},
  commit:()=>{commits++;},refresh:()=>{status.textContent='保存しています。';}});
 vm.runInContext(source.slice(start,end),context);
 const angle=nodes.get('swing-angle-3');angle.value='';angle.listeners.input();
 expect(status.textContent).toContain('入力途中');
 angle.value='10';angle.listeners.input();angle.listeners.change();
 expect(status.textContent).not.toContain('入力途中');
 expect(commits).toBe(0);expect(JSON.stringify(saved)).toBe(before);
});

test('Chrome clears the unfinished-angle message while retaining the complete roster and trajectory',async()=>{
 const artifact=resolve(process.env.SWING_RECOVERY_ARTIFACT??'../../outputs/にーくら野球メーカー_v85_設定解説と比較切替版.html');
 const baseline=readFileSync(resolve(baselinePath),'utf8'),html=readFileSync(artifact,'utf8');
 expect(html.includes(baseline)||html.includes(source)).toBe(true);
 const candidate=html.includes(baseline)?html.replace(baseline,()=>source):html,server=createServer((request,response)=>{
  response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(candidate);
 });
 await new Promise(accept=>server.listen(0,'127.0.0.1',accept));
 const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-accelerated-2d-canvas']});
  const page=await browser.newPage({viewport:{width:1200,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto('http://127.0.0.1:'+server.address().port,{timeout:60000});
  await page.waitForFunction(()=>globalThis.KneekuraSwingMaker?.getPreviewSource().ready);
  await page.locator('#tab-bat').click();
  await page.evaluate(()=>{const source=KneekuraSwingMaker.getPreviewSource();KneekuraSwingMaker.setTrajectory({...source.settings,method:'whole-arc-target'});});
  const before=await page.evaluate(()=>({roster:JSON.stringify(baseballMaker.getLiveRoster()),settings:JSON.stringify(KneekuraSwingMaker.inspect().settings)}));
  const angle=page.locator('#swing-angle-3'),saved=await angle.inputValue();
  await angle.fill('');expect(await page.locator('#swing-editor-status').textContent()).toContain('入力途中');
  await angle.fill(saved);await angle.blur();
  expect(await page.locator('#swing-editor-status').textContent()).not.toContain('入力途中');
  expect(await page.locator('#swing-editor-status').getAttribute('class')).not.toContain('error');
  const after=await page.evaluate(()=>({roster:JSON.stringify(baseballMaker.getLiveRoster()),settings:JSON.stringify(KneekuraSwingMaker.inspect().settings)}));
  expect(after).toEqual(before);
  await angle.fill('');
  await page.evaluate(()=>KneekuraSwingMaker.refresh());
  expect(await angle.inputValue()).toBe('');expect(await page.locator('#swing-editor-status').textContent()).toContain('入力途中');
  expect(await page.evaluate(()=>{try{KneekuraSwingMaker.assertNoPending();return false;}catch{return true;}})).toBe(true);
  const second=page.locator('#swing-angle-1'),secondSaved=await second.inputValue();await second.fill('');
  await angle.fill(saved);expect(await second.inputValue()).toBe('');
  await page.locator('#swing-revert-swing-angle-1').click();
  expect(await second.inputValue()).toBe(secondSaved);
  expect(await page.locator('#swing-editor-status').textContent()).not.toContain('入力途中');
  expect(await page.evaluate(()=>KneekuraSwingMaker.inspect().pending)).toEqual([]);
  await page.evaluate(()=>KneekuraSwingMaker.assertNoPending());
  expect(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster()))).toBe(before.roster);
  await angle.fill('');
  const mass=page.locator('#swing-bat-mass'),massValue=Number(await mass.inputValue());await mass.fill(String(massValue+.001));
  expect(await angle.inputValue()).toBe('');
  expect(await page.locator('#swing-editor-status').textContent()).toContain('入力途中');
  await page.locator('#swing-revert-swing-angle-3').click();
  expect(await page.evaluate(()=>KneekuraSwingMaker.inspect().pending)).toEqual([]);
  expect(await page.evaluate(()=>JSON.stringify(KneekuraSwingMaker.inspect().settings))).toBe(before.settings);
  await angle.fill('');await second.fill(String(Number(secondSaved)+1));
  await page.locator('#swing-revert-swing-angle-3').click();
  expect(await second.inputValue()).toBe(String(Number(secondSaved)+1));
  expect(await page.evaluate(()=>KneekuraSwingMaker.inspect().pending)).toEqual([]);
  await page.evaluate(()=>KneekuraSwingMaker.assertNoPending());
  await page.locator('#swing-method').selectOption('local-window-offset');
  const beforeMs=page.locator('#swing-before-ms'),savedMs=await beforeMs.inputValue();
  await beforeMs.evaluate(input=>{for(let node=input.parentElement;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;});
  await beforeMs.fill('');await page.evaluate(()=>KneekuraSwingMaker.refresh());expect(await beforeMs.inputValue()).toBe('');
  await beforeMs.fill(savedMs);await beforeMs.blur();
  expect(await page.evaluate(()=>KneekuraSwingMaker.inspect().pending)).toEqual([]);
  expect(await page.locator('#swing-editor-status').textContent()).not.toContain('入力途中');
  const originalPlayer=await page.locator('#swing-player-select').inputValue();
  const nextPlayer=await page.locator('#swing-player-select').evaluate(select=>[...select.options].find(option=>option.value!==select.value).value);
  await page.locator('#swing-player-select').selectOption(nextPlayer);
  expect(await page.evaluate(()=>KneekuraSwingMaker.inspect().playerId)).toBe(nextPlayer);
  expect(await page.locator('#live-roster-player').inputValue()).toBe(nextPlayer);
  const nextSettings=await page.evaluate(()=>KneekuraSwingMaker.inspect().settings);
  await page.locator('#swing-player-select').selectOption(originalPlayer);await angle.fill('');
  await page.locator('#swing-player-select').selectOption(nextPlayer);
  expect(await page.evaluate(()=>KneekuraSwingMaker.inspect().settings)).toEqual(nextSettings);
  expect(await angle.inputValue()).toBe(String(nextSettings.angleDegreesByLevel[2]));
  expect(await page.evaluate(()=>KneekuraSwingMaker.inspect().pending)).toContainEqual({playerId:originalPlayer,id:'swing-angle-3',raw:'',invalid:true});
  await page.locator('#swing-player-select').selectOption(originalPlayer);expect(await angle.inputValue()).toBe('');
  await page.locator('#swing-revert-swing-angle-3').click();await page.locator('#swing-player-select').selectOption(nextPlayer);
  const expected=structuredClone(nextSettings);expected.angleDegreesByLevel[2]+=1;
  await angle.fill(String(expected.angleDegreesByLevel[2]));await angle.blur();
  expect(await page.evaluate(()=>KneekuraSwingMaker.inspect().settings)).toEqual(expected);
  expect(await page.evaluate(()=>KneekuraSwingMaker.inspect().pending)).toEqual([]);
  expect(errors).toEqual([]);
 }finally{await browser?.close();await new Promise(accept=>server.close(accept));}
},90000);

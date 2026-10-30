import { expect,test } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { applyPresentationUiPerformanceV81 } from './presentation-ui-performance-v81.mjs';

const source=readFileSync(new URL('../../docs/demos/releases/v79/game.html',import.meta.url),'utf8');
const section=(html,start,end)=>{const from=html.indexOf(start),through=html.indexOf(end,from);if(from<0||through<0)throw Error('test section missing');return html.slice(from,through);};
const labelSection=html=>section(html,html.includes(' const labelNodesV81=')?' const labelNodesV81=':' function labels(){',' function chooseCamera(){');
const frameSection=html=>section(html,' function setSceneTime(value){',' function sceneEnded(){');

function frameHarness(html,frames){
  let reads=0;
  const observed=frames.map(tick=>({get tick(){reads++;return tick;}}));
  const context={result:{frames:observed},sceneMs:0,frameIndex:-1,timing:{preparationMs:1000},activeResult(){return this.result;},sceneTiming:()=>({first:100,durationMs:10000})};
  context.activeResult=()=>context.result;
  vm.createContext(context);vm.runInContext(frameSection(html),context);
  return {seek(value){context.setSceneTime(value);return {index:context.frameIndex,sceneMs:context.sceneMs};},ready(){context.result=null;},reads:()=>reads};
}

class FakeStyle {
  constructor(stats){this.values=new Map();this.stats=stats;return new Proxy(this,{get(target,key){if(key in target){const value=target[key];return typeof value==='function'?value.bind(target):value;}return target.getPropertyValue(String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));},set(target,key,value){target.setProperty(String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value);return true;}});}
  setProperty(key,value){this.stats.styleWrites++;value=String(value);if(key==='color'&&value==='#ff7777')value='rgb(255, 119, 119)';
    if(['left','top'].includes(key)&&value.endsWith('px')){const number=parseFloat(value);if(!Number.isFinite(number))return;value=Number(number.toFixed(6))+'px';}
    if(value==='')this.values.delete(key);else this.values.set(key,value);}
  getPropertyValue(key){return this.values.get(key)??'';}
  removeProperty(key){const previous=this.getPropertyValue(key);this.stats.styleWrites++;this.values.delete(key);return previous;}
}
class FakeElement {
  constructor(stats,host){this.stats=stats;this.host=host;this.style=new FakeStyle(stats);this.children=[];this.parentElement=null;this.text='';this.dataset=new Proxy({},{set:(target,key,value)=>{stats.dataWrites++;target[key]=String(value);return true;}});}
  get childNodes(){return this.children;}
  get textContent(){return this.text;}
  set textContent(value){this.stats.textWrites++;this.text=value===null?'':String(value);}
  append(child){if(child.parentElement)child.parentElement.removeChild(child);this.children.push(child);child.parentElement=this;this.stats.inserts++;}
  insertBefore(child,before){if(child.parentElement)child.parentElement.removeChild(child);const index=before===null?this.children.length:this.children.indexOf(before);if(index<0)throw Error('invalid fake reference');this.children.splice(index,0,child);child.parentElement=this;this.stats.inserts++;}
  removeChild(child){const index=this.children.indexOf(child);if(index<0)throw Error('invalid fake child');this.children.splice(index,1);child.parentElement=null;this.stats.removes++;return child;}
  replaceChildren(){this.stats.replaces++;for(const child of this.children)child.parentElement=null;this.children=[];}
  getBoundingClientRect(){this.stats.measurements++;const scale=Number(this.host.style.getPropertyValue('--kneekura-name-scale')),
    base=parseFloat(this.style.getPropertyValue('--kneekura-name-base-font')),font=base*scale;
    return {width:(this.text.length*.57*this.host.fontWidthFactor+.56)*font,height:1.39*font*this.host.fontHeightFactor};}
}
function labelHarness(html){
  const stats={created:0,styleWrites:0,dataWrites:0,textWrites:0,inserts:0,removes:0,replaces:0,measurements:0};
  const host=new FakeElement(stats);host.host=host;host.clientWidth=600;host.clientHeight=432;host.fontWidthFactor=host.fontHeightFactor=1;
  const context={labelHost:host,window:{KneekuraNameDisplayControls:{inspect:()=>({scale:context.nameScale})}},nameScale:1,
    document:{createElement(tag){expect(tag).toBe('span');stats.created++;return new FakeElement(stats,host);}}};
  vm.createContext(context);vm.runInContext(labelSection(html),context);
  return {host,stats,render({labels=true,rows=[],scale=1,live=false,running=false,width=600,height=432,fontWidth=1,fontHeight=1}={}){
    host.clientWidth=width;host.clientHeight=height;host.fontWidthFactor=fontWidth;host.fontHeightFactor=fontHeight;
    context.nameScale=scale;context.state={labels};context.observed={liveObservation:live,liveBatterRunStarted:running};context.labelPositions=structuredClone(rows);context.labels();
    return {hostStyle:[...host.style.values],nodes:host.children.map(node=>({text:node.textContent,data:{...node.dataset},style:[...node.style.values]})),positions:structuredClone(context.labelPositions)};
  }};
}
const row=(id,role='fielder',extra={})=>({id,role,name:id==='BAT'?'打者':'選手'+id,fontPx:14,nameAnchor:{x:230,y:200},...extra});

test('requires each exact v79 patch marker once and preserves unrelated source',()=>{
  const patched=applyPresentationUiPerformanceV81(source);
  expect(patched).not.toBe(source);expect(()=>applyPresentationUiPerformanceV81(patched)).toThrow();expect(()=>applyPresentationUiPerformanceV81(null)).toThrow();
  expect(()=>applyPresentationUiPerformanceV81(source+frameSection(source))).toThrow();
  expect(()=>applyPresentationUiPerformanceV81(source.replace(' function labels(){',' function labelsChanged(){'))).toThrow();
  const removeSections=html=>html.replace(labelSection(html),'__LABELS__').replace(frameSection(html),'__FRAMES__');
  expect(removeSections(patched)).toBe(removeSections(source));
});
test('preserves frame clamp, before-first, equal-tick last-wins and backward seek semantics',()=>{
  const patched=applyPresentationUiPerformanceV81(source),ticks=[100,100,100,110,200,200,300,1000,1000];
  for(const frames of [ticks,[],[100]]){
    const before=frameHarness(source,frames),after=frameHarness(patched,frames);
    for(const value of [-Infinity,-10,0,999,1000,1000.005,1000.01,1000.1,1000.2,1001,10000,Infinity,NaN,1000])expect(after.seek(value)).toEqual(before.seek(value));
    before.ready();after.ready();expect(after.seek(100)).toEqual(before.seek(100));
  }
});
test('bounds frame lookup work logarithmically without caching a seek position',()=>{
  const frames=Array.from({length:100000},(_,i)=>i+100),after=frameHarness(applyPresentationUiPerformanceV81(source),frames);
  expect(after.seek(Infinity).index).toBe(frames.length-1);expect(after.reads()).toBeLessThanOrEqual(17);
  const previous=after.reads();expect(after.seek(1000).index).toBe(0);expect(after.reads()-previous).toBeLessThanOrEqual(17);
});
test('matches label DOM/style order and boxes across roles, hidden BAT, resize, scale and font loading',()=>{
  const before=labelHarness(source),after=labelHarness(applyPresentationUiPerformanceV81(source)),base=[row('LF','LF',{fontPx:2}),row('BAT','batter'),row('R1','runner'),row('P','P',{fontPx:99})];
  const scenes=[{rows:base},{rows:base},{rows:[row('BAT','runner'),row('P','P'),row('LF','LF')],live:true,running:true},
    {rows:[row('BAT','batter'),row('P','runner'),row('LF','LF')],live:true},{rows:base,scale:1.8,width:390,height:281},
    {rows:base,scale:.7,width:840,height:500,fontWidth:1.4,fontHeight:1.3},{rows:base,scale:.7,width:840,height:500,fontWidth:.8,fontHeight:.9},
    {rows:base,width:0,height:0},{rows:base,width:600,height:0},{rows:base},
    {labels:false,rows:base},{labels:false,rows:base},{rows:[]},{rows:[row('P','runner'),row('P','P'),row('BAT','runner')],live:true,running:true},
    {rows:[row('P','P',{name:'名前が変更された選手'}),row('LF','LF')]}];
  for(const scene of scenes)expect(after.render(scene)).toEqual(before.render(scene));
});
test('reuses actor nodes and skips equal DOM writes while measuring current font and host dimensions every draw',()=>{
  const after=labelHarness(applyPresentationUiPerformanceV81(source)),rows=[row('P','P',{fontPx:14.123456789}),row('R1','runner',{fontPx:14.123456789})];after.render({rows});
  const nodes=[...after.host.children],first={...after.stats};after.render({rows});
  expect(after.host.children).toEqual(nodes);expect(after.stats.created).toBe(2);expect(after.stats.replaces).toBe(0);
  for(const key of ['styleWrites','dataWrites','textWrites','inserts','removes'])expect(after.stats[key]).toBe(first[key]);
  expect(after.stats.measurements-first.measurements).toBe(2);
  after.render({rows:rows.toReversed()});expect(after.host.children).toEqual(nodes);
});

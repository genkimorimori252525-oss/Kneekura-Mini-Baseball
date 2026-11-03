import {expect,test} from 'vitest';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=version=>readFileSync(new URL(`../../docs/demos/baseball-maker-pitcher-views-v${version}.js`,import.meta.url),'utf8');
const oldSource=source(85),newSource=source(92),green='#18824d',gray='#89968e';

function element(tag='div'){
 const attrs={},listeners={},calls=[],context={calls,path:[]};
 for(const name of ['fillRect','beginPath','moveTo','lineTo','stroke','fill','arc','fillText','save','restore','rect','clip']){
  context[name]=(...args)=>{
   if(name==='beginPath')context.path=[];
   if(['moveTo','lineTo','arc','rect'].includes(name))context.path.push([name,...args]);
   calls.push({name,args,strokeStyle:name==='stroke'?context.strokeStyle:undefined,
    fillStyle:['fill','fillRect','fillText'].includes(name)?context.fillStyle:undefined,lineWidth:name==='stroke'?context.lineWidth:undefined,
    path:['stroke','fill'].includes(name)?structuredClone(context.path):null});
  };
 }
 return {tagName:tag.toUpperCase(),children:[],dataset:{},checked:false,open:true,
  append(...children){this.children.push(...children);},setAttribute(key,value){attrs[key]=String(value);},getAttribute:key=>attrs[key]??null,
  addEventListener(type,listener){(listeners[type]??=[]).push(listener);},
  dispatchEvent(event){for(const listener of listeners[event.type]??[])listener(event);},getContext:()=>context};
}

function trialFixture({hand=1,center=0}={}){
 const actual=t=>({position:{x:hand*(.62-t*.65),y:1.98-t*2,z:17.2-t*40}}),
  baseline=t=>({position:{x:hand*(.62+t*1.8),y:1.98-t*2.5,z:17.2-t*39}});
 return {input:{batter:{heightMeters:1.8}},metrics:{flightSeconds:(17.2-.15)/40,measurementPlaneZ:.15,
  strikeZone:{centerX:center,halfWidth:.216,lowerY:.5,upperY:1.1}},
  pitch:{diagnostics:{sourceDescriptor:{throughElapsedSeconds:.7}}},sampleAtPitchElapsedSeconds:actual,sampleBaselineAtPitchElapsedSeconds:baseline};
}

function environment(script,trial){
 const document=element('document'),side=element('canvas'),details=element('details'),comparison=element('button'),summary=element('summary');
 comparison.setAttribute('aria-pressed','false');side.closest=()=>details;details.querySelector=()=>summary;
 document.getElementById=id=>id==='pitcher-plot-side'?side:id==='pitcher-comparison-on'?comparison:null;
 document.createElement=element;document.createTextNode=text=>({textContent:text});document.head=element('head');
 const root={document,requestAnimationFrame:()=>{},KneekuraPitcherMakerV78:{getResult:()=>trial}};
 vm.runInNewContext(script,{globalThis:root});
 const api=root.KneekuraPitcherTrajectoryViewsV78;api.refresh();
 const grid=details.children.find(node=>node.id==='pitcher-perspective-plots'),plots=grid.children.map(figure=>figure.children[1]),
  fit=details.children.find(node=>node.children.some(child=>child.id==='pitcher-views-fit')).children[0];
 return {root,document,details,comparison,plots,fit,api};
}

function render(env,fit,comparison){
 env.fit.checked=fit;env.comparison.setAttribute('aria-pressed',String(comparison));
 for(const plot of env.plots)plot.getContext('2d').calls.length=0;
 env.details.dispatchEvent({type:'toggle'});
 return env.plots.map(plot=>({id:plot.id,calls:structuredClone(plot.getContext('2d').calls)}));
}
const stroke=(drawing,color)=>drawing.calls.filter(call=>call.name==='stroke'&&call.strokeStyle===color);
const point=row=>({x:row[1],y:row[2]});
function crossing(a,b,c,d){
 const denominator=(a.x-b.x)*(c.y-d.y)-(a.y-b.y)*(c.x-d.x),ab=a.x*b.y-a.y*b.x,cd=c.x*d.y-c.y*d.x;
 return {x:(ab*(c.x-d.x)-(a.x-b.x)*cd)/denominator,y:(ab*(c.y-d.y)-(a.y-b.y)*cd)/denominator};
}

test('rear chart fixes the projected plate center at canvas center with equal x/y scale',()=>{
 for(const hand of [-1,1])for(const center of [-.12,0,.12])for(const fit of [false,true]){
  const env=environment(newSource,trialFixture({hand,center})),model=env.api.inspect(),view=model.views.find(view=>view.id==='behind'),
   drawing=render(env,fit,false)[0],zone=stroke(drawing,'#b1c6b8')[0].path.slice(0,4).map(point),
   plateCenter=crossing(zone[0],zone[2],zone[1],zone[3]);
  expect(plateCenter.x).toBeCloseTo(300,9);expect(plateCenter.y).toBeCloseTo(180,9);
  expect(view.camera.eye).toEqual({x:0,y:1.98,z:20.44});
  expect(view.camera.target).toEqual({x:center,y:.8,z:.15});
  const raw=view.actual[0],drawn=stroke(drawing,green)[0].path.map(point),
   sx=(drawn.at(-1).x-drawn[0].x)/(raw.at(-1).x-raw[0].x),sy=(drawn.at(-1).y-drawn[0].y)/(raw.at(-1).y-raw[0].y);
  expect(sx).toBeCloseTo(sy,10);
  const anchor=env.api.project(view.camera.target,view.camera);
  expect(drawn[0].x+(anchor.x-raw[0].x)*sx).toBeCloseTo(300,9);
  expect(drawn[0].y+(anchor.y-raw[0].y)*sy).toBeCloseTo(180,9);
  const points=[...view.actual.flat(),...view.baseline.flat(),...view.zone.filter(Boolean)],
   spanX=2*Math.max(...points.map(p=>Math.abs(p.x-anchor.x))),spanY=2*Math.max(...points.map(p=>Math.abs(p.y-anchor.y))),
   expected=fit?Math.min(24,560/Math.max(.01,spanX),320/Math.max(.01,spanY)):1;
  expect(sx).toBeCloseTo(expected,10);
  if(fit)for(const p of points){
   expect(300+(p.x-anchor.x)*sx).toBeGreaterThanOrEqual(20-1e-8);expect(300+(p.x-anchor.x)*sx).toBeLessThanOrEqual(580+1e-8);
   expect(180+(p.y-anchor.y)*sy).toBeGreaterThanOrEqual(20-1e-8);expect(180+(p.y-anchor.y)*sy).toBeLessThanOrEqual(340+1e-8);
  }
 }
});

test('old automatic fit reproduces the off-center plate; v92 keeps the same observation/API',()=>{
 const trial=trialFixture(),old=environment(oldSource,trial),current=environment(newSource,trial),
  zone=stroke(render(old,true,false)[0],'#b1c6b8')[0].path.slice(0,4).map(point),plateCenter=crossing(zone[0],zone[2],zone[1],zone[3]);
 expect(Math.abs(plateCenter.x-300)).toBeGreaterThan(1);
 expect(JSON.stringify(current.api.inspect())).toBe(JSON.stringify(old.api.inspect()));
 expect(Object.keys(current.api)).toEqual(Object.keys(old.api));expect(Object.isFrozen(current.api)).toBe(true);
});

test('catcher and both batter charts retain the v85 drawings for every fit/comparison state',()=>{
 for(const hand of [-1,1]){
  const trial=trialFixture({hand}),old=environment(oldSource,trial),current=environment(newSource,trial);
  for(const fit of [false,true])for(const comparison of [false,true]){
   expect(render(current,fit,comparison).slice(1)).toEqual(render(old,fit,comparison).slice(1));
  }
 }
});

test('comparison ON/OFF keeps actual drawings and Core trial stable, including symmetric rear fit',()=>{
 const trial=trialFixture(),before=JSON.stringify(trial),env=environment(newSource,trial),model=JSON.stringify(env.api.inspect());
 for(const fit of [false,true]){
  const off=render(env,fit,false),on=render(env,fit,true),restored=render(env,fit,false);
  for(let i=0;i<4;i++){
   expect(stroke(off[i],gray)).toHaveLength(0);expect(stroke(on[i],gray).length).toBeGreaterThan(0);
   expect(stroke(on[i],green)).toEqual(stroke(off[i],green));
  }
  expect(restored).toEqual(off);
 }
 expect(JSON.stringify(env.api.inspect())).toBe(model);expect(JSON.stringify(trial)).toBe(before);
 const text=env.details.children.filter(node=>node.tagName==='P').map(node=>node.textContent).join('');
 expect(text).toContain('投手後方は本塁中央を固定');expect(text).toContain('図の外側は切れて表示');
});

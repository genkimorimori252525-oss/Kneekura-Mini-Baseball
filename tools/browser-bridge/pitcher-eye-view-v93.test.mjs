import {expect,test} from 'vitest';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=version=>readFileSync(new URL(`../../docs/demos/baseball-maker-pitcher-views-v${version}.js`,import.meta.url),'utf8');
const oldSource=source(92),newSource=source(93),green='#18824d',gray='#89968e',
 helperSource=readFileSync(new URL('./live-pitcher-body-head-view-v77.js',import.meta.url),'utf8');

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

function trialFixture({hand=1,center=0,height=1.83,headMotionScale=1,preparationMs=1540,extension=1.54}={}){
 const release={x:hand*height*.25,y:.254+height*.86,z:18.44-extension},
  actual=t=>({position:{x:release.x-t*.65,y:release.y-t*2,z:release.z-t*40}}),
  baseline=t=>({position:{x:release.x+t*1.8,y:release.y-t*2.5,z:release.z-t*39}}),pitchingMotion={headMotionScale,preparationMs};
 return {input:{batter:{heightMeters:1.8},pitcher:{heightMeters:height,throws:hand===1?'L':'R',moundPosition:{x:0,y:.254,z:18.44},pitchingMotion}},
  metrics:{flightSeconds:(release.z-.15)/40,measurementPlaneZ:.15,
  strikeZone:{centerX:center,halfWidth:.216,lowerY:.5,upperY:1.1}},
  pitch:{diagnostics:{pitchingMotion,sourceDescriptor:{throughElapsedSeconds:.7}}},sampleAtPitchElapsedSeconds:actual,sampleBaselineAtPitchElapsedSeconds:baseline};
}

function environment(script,trial){
 const document=element('document'),side=element('canvas'),details=element('details'),comparison=element('button'),summary=element('summary');
 comparison.setAttribute('aria-pressed','false');side.closest=()=>details;details.querySelector=()=>summary;
 document.getElementById=id=>id==='pitcher-plot-side'?side:id==='pitcher-comparison-on'?comparison:null;
 document.createElement=element;document.createTextNode=text=>({textContent:text});document.head=element('head');
 const root={document,requestAnimationFrame:()=>{},KneekuraPitcherMakerV78:{getResult:()=>trial}};
 vm.runInNewContext(helperSource,{globalThis:root});
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

test('pitcher-eye chart fixes the plate center at canvas center with equal x/y scale',()=>{
 for(const hand of [-1,1])for(const center of [-.12,0,.12])for(const fit of [false,true]){
  const env=environment(newSource,trialFixture({hand,center})),model=env.api.inspect(),view=model.views.find(view=>view.id==='behind'),
   drawing=render(env,fit,false)[0],zone=stroke(drawing,'#b1c6b8')[0].path.slice(0,4).map(point),
   plateCenter=crossing(zone[0],zone[2],zone[1],zone[3]);
  expect(plateCenter.x).toBeCloseTo(300,9);expect(plateCenter.y).toBeCloseTo(180,9);
  const pitcher=trialFixture({hand,center}).input.pitcher;
  const expectedEye={x:hand*.02,y:.254+pitcher.heightMeters*.92-.1,z:18.44-.42};
  for(const key of ['x','y','z'])expect(view.camera.eye[key]).toBeCloseTo(expectedEye[key],12);
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

test('v93 changes only behind camera and keeps the observed Core paths and public API',()=>{
 const trial=trialFixture(),old=environment(oldSource,trial),current=environment(newSource,trial),a=current.api.inspect(),b=old.api.inspect();
 expect(a.views[0].name).toBe('投手の目 → 本塁');expect(a.views[0].camera.eye).not.toEqual(b.views[0].camera.eye);
 for(const key of ['actual','baseline'])expect(JSON.stringify(a[key])).toBe(JSON.stringify(b[key]));
 expect(JSON.stringify(a.views.slice(1))).toBe(JSON.stringify(b.views.slice(1)));
 expect(Object.keys(current.api)).toEqual(Object.keys(old.api));expect(Object.isFrozen(current.api)).toBe(true);
});

test('catcher and both batter charts retain v92 drawings for every fit/comparison state',()=>{
 for(const hand of [-1,1]){
  const trial=trialFixture({hand}),old=environment(oldSource,trial),current=environment(newSource,trial);
  for(const fit of [false,true])for(const comparison of [false,true]){
   expect(render(current,fit,comparison).slice(1)).toEqual(render(old,fit,comparison).slice(1));
  }
 }
});

test('comparison ON/OFF keeps actual drawings and Core trial stable, including symmetric eye fit',()=>{
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
 expect(text).toContain('ボールを離す瞬間の目位置を固定');expect(text).toContain('身長・左右投げ・投球動作の設定に対応');expect(text).toContain('図の外側は切れて表示');
});

test('eye uses the existing head helper exactly at release for height, hand and authored motion',()=>{
 for(const height of [1.4,1.83,2.1])for(const hand of [-1,1])for(const headMotionScale of [0,1,2])for(const preparationMs of [800,2400]){
  const trial=trialFixture({height,hand,headMotionScale,preparationMs}),root={};
  vm.runInNewContext(helperSource,{globalThis:root});vm.runInNewContext(newSource,{globalThis:root});
  const helper=root.KneekuraPitcherBodyHeadView,before=JSON.stringify(helper.inspectSettings()),pitcher=trial.input.pitcher,
   expected=helper.observe({record:{play:{diagnostics:trial.pitch.diagnostics}},frame:{phase:'pitch'},sceneMs:preparationMs,preparationMs,
    pitcherActor:{position:{x:0,y:0,z:18.44},player:{heightMeters:height,throws:pitcher.throws}},moundSurfacePosition:pitcher.moundPosition});
  expect(root.KneekuraPitcherTrajectoryViewsV78.observe(trial).views[0].camera.eye).toEqual(expected.eye);
  expect(JSON.stringify(helper.inspectSettings())).toBe(before);
 }
});

test('helper absence is an explicit Japanese error and observe never reconfigures the helper',()=>{
 const root={};vm.runInNewContext(newSource,{globalThis:root});
 expect(()=>root.KneekuraPitcherTrajectoryViewsV78.observe(trialFixture())).toThrow('投手の目位置を計算する既存の表示部品が読み込まれていません。');
 vm.runInNewContext(helperSource,{globalThis:root});const helper=root.KneekuraPitcherBodyHeadView;
 helper.configure({enabled:false,scale:.75});const before=JSON.stringify(helper.inspectSettings());
 expect(root.KneekuraPitcherTrajectoryViewsV78.observe(trialFixture()).views[0].camera.eye).toEqual({x:0,y:.254+1.83*.92,z:18.44});
 expect(JSON.stringify(helper.inspectSettings())).toBe(before);
});

test('near clipping keeps finite visible coordinates and never labels a clipped point as release',()=>{
 for(const hand of [-1,1])for(const fit of [false,true]){
  const trial=trialFixture({hand,extension:0}),env=environment(newSource,trial),model=env.api.inspect(),view=model.views[0],drawing=render(env,fit,true)[0];
  expect(env.api.project(model.actual[0],view.camera)).toBeNull();
  expect(view.actual[0].length).toBeGreaterThan(1);expect(view.actual.flat().length).toBeLessThan(model.actual.length);
  for(const p of [...view.actual.flat(),...view.baseline.flat(),...view.zone.filter(Boolean)])expect([p.x,p.y,p.depth].every(Number.isFinite)).toBe(true);
  for(const color of [green,gray]){
   expect(stroke(drawing,color)).toHaveLength(1);
   for(const row of stroke(drawing,color)[0].path)expect(row.slice(1).every(Number.isFinite)).toBe(true);
  }
  const target=env.api.project(view.camera.target,view.camera),near={...view.camera.eye};
  expect(env.api.project(near,view.camera)).toBeNull();expect(target.x).toBeCloseTo(300,10);expect(target.y).toBeCloseTo(180,10);
 }
});

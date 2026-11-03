import {expect,test} from 'vitest';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=version=>readFileSync(new URL(`../../docs/demos/baseball-maker-pitcher-views-v${version}.js`,import.meta.url),'utf8');
const oldSource=source(93),newSource=source(94),green='#18824d',gray='#89968e',
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
test('normal mound optics are fixed on a 600 by 432 canvas and ignore trajectory fitting',()=>{
 for(const hand of [-1,1]){
  const env=environment(newSource,trialFixture({hand})),view=env.api.inspect().views[0],camera=view.camera;
  expect(env.plots[0].width).toBe(600);expect(env.plots[0].height).toBe(432);
  expect(camera.camera).toBe('mound');expect(camera.f).toBe(1600);expect(camera.cx).toBe(300);expect(camera.cy).toBe(192);
  expect(camera.yaw).toBe(Math.atan2(-camera.eye.x,-camera.eye.z));
  expect(camera.pitch).toBe(Math.atan2(camera.eye.y-1.03,Math.hypot(camera.eye.x,camera.eye.z)));
  expect(render(env,true,false)[0]).toEqual(render(env,false,false)[0]);
  const actual=stroke(render(env,true,false)[0],green)[0].path.map(point);
  expect(actual).toEqual(view.actual[0].map(p=>({x:p.x,y:p.y})));
 }
});

test('projection retains depth, shared x/y focal length and natural near clipping',()=>{
 const root={};vm.runInNewContext(newSource,{globalThis:root});const api=root.KneekuraPitcherTrajectoryViewsV78,
  camera={camera:'mound',eye:{x:0,y:1.03,z:18.44},yaw:Math.PI,pitch:0,f:1600,cx:300,cy:192},
  target=api.project({x:0,y:1.03,z:0},camera),right=api.project({x:1,y:1.03,z:0},camera),up=api.project({x:0,y:2.03,z:0},camera),
  home=api.project({x:0,y:0,z:0},camera),nearGround=api.project({x:0,y:0,z:10},camera);
 expect(target.x).toBeCloseTo(300,10);expect(target.y).toBe(192);
 expect(Math.abs(right.x-target.x)).toBeCloseTo(Math.abs(up.y-target.y),10);
 expect(nearGround.y).toBeGreaterThan(home.y);expect(nearGround.scale).toBeGreaterThan(home.scale);
 expect(api.project(camera.eye,camera)).toBeNull();expect(api.project({x:0,y:1.03,z:20},camera)).toBeNull();
});

test('v94 preserves shared Core paths, the public API and the other legacy chart observations',()=>{
 const trial=trialFixture(),old=environment(oldSource,trial),current=environment(newSource,trial),a=current.api.inspect(),b=old.api.inspect();
 expect(a.views[0].name).toBe('投手の目 → 本塁');expect(a.views[0].camera.eye).toEqual(b.views[0].camera.eye);
 for(const key of ['actual','baseline'])expect(JSON.stringify(a[key])).toBe(JSON.stringify(b[key]));
 expect(JSON.stringify(a.views.slice(1))).toBe(JSON.stringify(b.views.slice(1)));
 expect(Object.keys(current.api)).toEqual(Object.keys(old.api));expect(Object.isFrozen(current.api)).toBe(true);
});

test('catcher and both batter charts retain v93 drawings for every legacy fit/comparison state',()=>{
 for(const hand of [-1,1]){
  const trial=trialFixture({hand}),old=environment(oldSource,trial),current=environment(newSource,trial);
  for(const fit of [false,true])for(const comparison of [false,true]){
   expect(render(current,fit,comparison).slice(1)).toEqual(render(old,fit,comparison).slice(1));
  }
 }
});

test('comparison ON/OFF keeps actual drawings and Core trial stable with fixed pitcher optics',()=>{
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
 expect(text).toContain('投手目線は試合と同じ倍率で固定');expect(text).toContain('身長・左右投げ・投球動作の設定に対応');expect(text).toContain('図の外側は切れて表示');
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
  expect(env.api.project(view.camera.eye,view.camera)).toBeNull();
 }
});

test('field context uses the ordinary home pentagon, batter boxes and converging ground lines',()=>{
 const env=environment(newSource,trialFixture()),view=env.api.inspect().views[0],drawing=render(env,true,false)[0];
 expect(view.field.geometry.homePlate).toEqual([{x:0,z:0},{x:.2159,z:.2159},{x:.2159,z:.4318},{x:-.2159,z:.4318},{x:-.2159,z:.2159}]);
 expect(view.field.home).toHaveLength(5);expect(view.field.boxes).toHaveLength(2);expect(view.field.boxes.every(box=>box.length===4)).toBe(true);
 // The cross-line at the rubber lies behind the release eye and is clipped.
 expect(view.field.ground).toHaveLength(7);expect(stroke(drawing,'#e0e9e3')).toHaveLength(7);
 expect(stroke(drawing,'#b1c6b8').length).toBeGreaterThanOrEqual(6);
 for(const path of [...view.field.home,...view.field.boxes.flat(),...view.field.ground])for(const p of path)expect([p.x,p.y,p.depth].every(Number.isFinite)).toBe(true);
 expect(view.zoneVolume).toBeNull();
});

test('a canonical volume draws both pentagonal faces and five height edges without altering other views',()=>{
 const legacy=trialFixture(),trial=trialFixture();trial.metrics.strikeZoneVolumeV94={version:94,platePolygon:[{x:0,z:0},{x:.2159,z:.2159},{x:.2159,z:.4318},{x:-.2159,z:.4318},{x:-.2159,z:.2159}],lowerY:.5,upperY:1.1};
 const before=JSON.stringify(trial),env=environment(newSource,trial),view=env.api.inspect().views[0],old=environment(newSource,legacy).api.inspect();
 expect(view.zoneVolume.edges).toHaveLength(15);expect(view.zoneVolume.volume).toEqual(trial.metrics.strikeZoneVolumeV94);
 expect(JSON.stringify(env.api.inspect().views.slice(1))).toBe(JSON.stringify(old.views.slice(1)));
 expect(stroke(render(env,true,false)[0],'#b1c6b8')).toHaveLength(20);expect(JSON.stringify(trial)).toBe(before);
});

test('only an explicit resolved stance moves batter-eye z and leaves catcher and physical paths unchanged',()=>{
 const legacy=trialFixture(),trial=trialFixture();trial.input.batter.battingSetupV94={boxPosition:'front'};trial.metrics.battingSetupV94={cameraOffsetZ:.3};
 const root={};vm.runInNewContext(helperSource,{globalThis:root});vm.runInNewContext(newSource,{globalThis:root});const a=root.KneekuraPitcherTrajectoryViewsV78.observe(legacy),b=root.KneekuraPitcherTrajectoryViewsV78.observe(trial);
 for(const id of ['batter-right','batter-left'])expect(b.views.find(view=>view.id===id).camera.eye.z).toBe(-.95+.3);
 expect(JSON.stringify(a.views[1])).toBe(JSON.stringify(b.views[1]));expect(JSON.stringify(a.actual)).toBe(JSON.stringify(b.actual));expect(JSON.stringify(a.baseline)).toBe(JSON.stringify(b.baseline));
});

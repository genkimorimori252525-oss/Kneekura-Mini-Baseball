import {expect,test} from 'vitest';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const mainSource=readFileSync(new URL('../../docs/demos/baseball-maker-pitcher-v86.js',import.meta.url),'utf8');
const viewsSource=readFileSync(new URL('../../docs/demos/baseball-maker-pitcher-views-v85.js',import.meta.url),'utf8');
const gray='#89968e',green='#18824d';

function canvasContext(){
 const calls=[],c={calls,path:[]};
 for(const method of ['fillRect','beginPath','moveTo','lineTo','stroke','fill','arc','fillText','strokeRect','save','restore','rect','clip']){
  c[method]=(...args)=>{
   if(method==='beginPath')c.path=[];else if(['moveTo','lineTo','arc','rect'].includes(method))c.path.push([method,...args]);
   calls.push([method,['stroke','strokeRect'].includes(method)?c.strokeStyle:null,['fill','fillRect','fillText','arc'].includes(method)?c.fillStyle:null,
    ['stroke','strokeRect'].includes(method)?c.lineWidth:null,...args,...(['stroke','fill'].includes(method)?[structuredClone(c.path)]:[])]);
  };
 }
 return c;
}
function element(tag='div'){
 const attrs={},listeners={},context=canvasContext();
 return {tagName:tag.toUpperCase(),children:[],dataset:{},checked:false,open:true,
  append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},
  setAttribute(key,value){attrs[key]=String(value);},getAttribute:key=>attrs[key]??null,
  addEventListener(type,listener){(listeners[type]??=[]).push(listener);},
  dispatchEvent(event){for(const listener of listeners[event.type]??[])listener(event);},getContext:()=>context};
}
function trialFixture(){
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const actual=t=>({position:{x:.5-t*.4,y:2-t*2,z:17.2-t*40}}),baseline=t=>({position:{x:.5-t*.2,y:2-t*2.5,z:17.2-t*39}});
 const flightSeconds=(17.2-.15)/40;
 return freeze({input:{batter:{heightMeters:1.8}},fixedInitial:{position:{x:.5,y:2,z:17.2}},
  metrics:{flightSeconds,measurementPlaneZ:.15,strikeZone:{centerX:0,halfWidth:.216,lowerY:.5,upperY:1.1},
   platePosition:actual(flightSeconds).position,baselinePlatePosition:baseline((17.2-.15)/39).position,
   releaseSpeedKmh:144,speedKmh:135,spinRpm:2200,horizontalBreakCm:-8,verticalBreakCm:14,baselineGroundIgnored:true},
  pitch:{diagnostics:{sourceDescriptor:{throughElapsedSeconds:.7}}},sampleAtPitchElapsedSeconds:actual,sampleBaselineAtPitchElapsedSeconds:baseline});
}
function environment(){
 const nodes=new Map(),document=element('document');
 document.getElementById=id=>nodes.get(id)??null;document.createElement=element;document.createTextNode=text=>({textContent:text});document.head=element('head');
 for(const id of ['pitcher-comparison-off','pitcher-comparison-on','pitcher-plot-side','pitcher-plot-top','pitcher-zone','pitcher-metrics']){
  const node=element(id.includes('plot')||id==='pitcher-zone'?'canvas':'div');node.id=id;nodes.set(id,node);
 }
 nodes.get('pitcher-comparison-off').setAttribute('aria-pressed','true');nodes.get('pitcher-comparison-on').setAttribute('aria-pressed','false');
 const details=element('details'),summary=element('summary');details.querySelector=()=>summary;nodes.get('pitcher-plot-side').closest=()=>details;
 const root={document,requestAnimationFrame:()=>{},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;}}};
 return {root,document,nodes,details};
}
const strokes=(node,color)=>node.getContext('2d').calls.filter(call=>call[0]==='stroke'&&call[1]===color);
const coloredDrawing=(node,color)=>node.getContext('2d').calls.filter(call=>['stroke','fill'].includes(call[0])&&(call[1]===color||call[2]===color));
const clear=nodes=>{for(const node of nodes)node.getContext('2d').calls.length=0;};

test('one comparison control starts OFF and redraws side, top and plate without changing the trial or domains',()=>{
 expect(()=>new vm.Script(mainSource)).not.toThrow();
 expect(mainSource).toMatch(/id="pitcher-comparison-off"[^>]*aria-pressed="true"/);
 expect(mainSource).toMatch(/id="pitcher-comparison-on"[^>]*aria-pressed="false"/);
 expect((mainSource.match(/id="pitcher-comparison-on"/g)??[])).toHaveLength(1);
 const start=mainSource.indexOf(' function comparisonVisible()'),end=mainSource.indexOf(' function populate()',start);
 expect(start).toBeGreaterThan(-1);expect(end).toBeGreaterThan(start);
 const env=environment(),trial=trialFixture(),before=JSON.stringify(trial),events=[];
 env.document.addEventListener('kneekura:pitcher-comparison-change-v85',event=>events.push(event.detail));
 const context=vm.createContext({root:env.root,document:env.document,$:id=>env.nodes.get(id),trial});
 vm.runInContext(mainSource.slice(start,end),context);
 const plots=['pitcher-plot-side','pitcher-plot-top','pitcher-zone'].map(id=>env.nodes.get(id));
 vm.runInContext('drawPlots();drawMetrics();',context);
 const off=plots.map(node=>structuredClone(node.getContext('2d').calls));
 for(const node of plots)expect(coloredDrawing(node,gray)).toHaveLength(0);
 clear(plots);vm.runInContext('setComparisonVisible(true);',context);
 expect(env.nodes.get('pitcher-comparison-on').getAttribute('aria-pressed')).toBe('true');
 expect(env.nodes.get('pitcher-comparison-off').getAttribute('aria-pressed')).toBe('false');
 for(const node of plots)expect(coloredDrawing(node,gray).length).toBeGreaterThan(0);
 for(let n=0;n<2;n++)expect(strokes(plots[n],green)).toEqual(off[n].filter(call=>call[0]==='stroke'&&call[1]===green));
 const actualPoint=calls=>calls.filter(call=>call[0]==='arc'&&call[2]==='#157b48');
 expect(actualPoint(plots[2].getContext('2d').calls)).toEqual(actualPoint(off[2]));
 clear(plots);vm.runInContext('setComparisonVisible(false);',context);
 expect(plots.map(node=>node.getContext('2d').calls)).toEqual(off);
 expect(events).toEqual([{visible:true},{visible:false}]);expect(JSON.stringify(trial)).toBe(before);
 expect(mainSource).toContain("$('pitcher-comparison-off').onclick=()=>setComparisonVisible(false)");
 expect(mainSource).toContain("$('pitcher-comparison-on').onclick=()=>setComparisonVisible(true)");
});

test('all four perspective charts share the default OFF state and toggle only gray drawing with stable fit',()=>{
 const env=environment(),trial=trialFixture(),before=JSON.stringify(trial);
 env.root.KneekuraPitcherMakerV78=Object.freeze({getResult:()=>trial});
 vm.runInNewContext(viewsSource,{globalThis:env.root});
 const api=env.root.KneekuraPitcherTrajectoryViewsV78;api.refresh();
 const grid=env.details.children.find(node=>node.id==='pitcher-perspective-plots'),plots=grid.children.map(figure=>figure.children[1]);
 expect(plots).toHaveLength(4);for(const node of plots)expect(strokes(node,gray)).toHaveLength(0);
 clear(plots);env.details.dispatchEvent({type:'toggle'});
 const off=plots.map(node=>structuredClone(node.getContext('2d').calls)),model=JSON.stringify(api.inspect());
 const toggle=visible=>{env.nodes.get('pitcher-comparison-on').setAttribute('aria-pressed',String(visible));env.document.dispatchEvent({type:'kneekura:pitcher-comparison-change-v85',detail:{visible}});};
 clear(plots);toggle(true);
 for(let n=0;n<plots.length;n++){
  expect(strokes(plots[n],gray).length).toBeGreaterThan(0);
  expect(strokes(plots[n],green)).toEqual(off[n].filter(call=>call[0]==='stroke'&&call[1]===green));
 }
 expect(JSON.stringify(api.inspect())).toBe(model);clear(plots);toggle(false);
 expect(plots.map(node=>node.getContext('2d').calls)).toEqual(off);expect(JSON.stringify(trial)).toBe(before);
 const fit=env.details.children.find(node=>node.children?.some(child=>child.id==='pitcher-views-fit')).children[0];
 fit.checked=false;clear(plots);fit.dispatchEvent({type:'change'});
 const unfitOff=plots.map(node=>structuredClone(node.getContext('2d').calls));clear(plots);toggle(true);
 for(let n=0;n<plots.length;n++)expect(strokes(plots[n],green)).toEqual(unfitOff[n].filter(call=>call[0]==='stroke'&&call[1]===green));
 clear(plots);toggle(false);expect(plots.map(node=>node.getContext('2d').calls)).toEqual(unfitOff);
 expect(Object.isFrozen(api)).toBe(true);
});

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {applyNamePresentationV60} from './name-presentation-v60.mjs';

const helper=await readFile('tools/browser-bridge/live-name-display-controls-v60.js','utf8');
const events=[],sandbox={CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent:event=>events.push(event)};
vm.runInNewContext(helper,sandbox);
const api=sandbox.KneekuraNameDisplayControls;
assert.equal(api.inspect().scale,1);assert.equal(api.configure({scale:2.5}).scale,2.5);assert.equal(api.configure({scale:.5}).scale,.5);
let getters=0;
for(const bad of [{scale:NaN},{scale:Infinity},{scale:0},{scale:3},{scale:'1'},{other:1},[],Object.create({scale:1}),
 Object.defineProperty({},'scale',{enumerable:true,get(){getters++;return 1;}}),{[Symbol('scale')]:1}])assert.throws(()=>api.configure(bad));
assert.equal(api.inspect().scale,.5);assert.equal(events.length,2);assert.equal(getters,0);
assert.equal(api.normalizeSettings().scale,1);api.configure({scale:1});
const source=await readFile('docs/demos/releases/v59/game.html','utf8'),game=applyNamePresentationV60(source);
assert.throws(()=>applyNamePresentationV60(game),/SHA mismatch/);
assert(game.includes('.actor-labels{position:absolute;inset:0;pointer-events:none;z-index:1;'));
assert(game.includes('.ball-overlay{z-index:2}'));
const ballStart=' function paintBallOverlay(',ballEnd='  return {draw,paintBallOverlay';
assert.equal(game.slice(game.indexOf(ballStart),game.indexOf(ballEnd)),source.slice(source.indexOf(ballStart),source.indexOf(ballEnd)));
const styles=()=>({setProperty(key,value){this[key]=value;}});
const labelHost={clientWidth:600,clientHeight:432,style:styles(),children:[],replaceChildren(){this.children=[];},append(el){this.children.push(el);}};
const document={createElement(){return {dataset:{},style:styles(),getBoundingClientRect(){const font=parseFloat(this.style['--kneekura-name-base-font'])*Number(labelHost.style['--kneekura-name-scale']);return {width:this.textContent.length*font,height:font*1.39};}};}};
const actors=()=>[
 {id:'P',role:'P',name:'同名',fontPx:11,nameAnchor:{x:300,y:220}},
 {id:'1B',role:'1B',name:'同名',fontPx:11,nameAnchor:{x:300,y:220}},
 {id:'R1',role:'runner',name:'同名',fontPx:11,nameAnchor:{x:300,y:220}},
 {id:'BAT',role:'batter',name:'打者',fontPx:11,nameAnchor:{x:300,y:220}}
];
const context={window:sandbox,document,labelHost,observed:{liveObservation:true,liveBatterRunStarted:false}};
const labelSource=game.slice(game.indexOf(' function labels(){'),game.indexOf(' function chooseCamera(){'));
vm.createContext(context);vm.runInContext(labelSource,context);
const cases=[];
for(const camera of ['overhead','batter','catcher','runner','mound','fielder']){
 context.state={camera,labels:true};context.labelPositions=actors();context.labels();
 assert.equal(labelHost.children.length,3);assert.equal(labelHost.children.at(-1).dataset.actor,'R1');
 assert.equal(labelHost.children.at(-1).style.color,'#ff7777');
 assert.equal(labelHost.children[0].style.left,labelHost.children[1].style.left);
 assert.equal(labelHost.children[0].style.top,labelHost.children[1].style.top);
 assert.equal(labelHost.children[0].style.top,labelHost.children[2].style.top);
 assert.equal(context.labelPositions[0].labelBox.x+context.labelPositions[0].labelBox.w/2,300);
 cases.push(camera);
}
const one=context.labelPositions[0].labelBox;
api.configure({scale:2});context.labelPositions=actors();context.labels();
assert.equal(context.labelPositions[0].labelBox.w,one.w*2);assert.equal(context.labelPositions[0].labelBox.h,one.h*2);
context.labelPositions[3].role='runner';context.observed.liveBatterRunStarted=true;context.labels();
assert.equal(labelHost.children.length,4);assert.equal(labelHost.children.at(-1).dataset.actor,'BAT');
// Copying labels is a read-only painter; it preserves order and must not call
// any Source/Host/camera operation. No such operation is present in its context.
const calls=[],paintHost={children:[{dataset:{actor:'P',role:'P'},textContent:'投手',getBoundingClientRect:()=>({left:110,top:100,width:60,height:20})},
 {dataset:{actor:'R1',role:'runner'},textContent:'走者',getBoundingClientRect:()=>({left:110,top:100,width:60,height:20})}],
 getBoundingClientRect:()=>({left:10,top:20,width:600,height:432})};
sandbox.document={getElementById:()=>paintHost};sandbox.getComputedStyle=()=>({display:'block',visibility:'visible',backgroundColor:'rgba(0,0,0,.68)',fontSize:'11px',paddingLeft:'3px',paddingTop:'1px',lineHeight:'12.65px',font:'500 11px sans-serif',color:'#f4f4ed'});
const paintContext={save:()=>calls.push('save'),restore:()=>calls.push('restore'),setTransform:(...args)=>calls.push(['transform',...args]),fillRect:(...args)=>calls.push(['rect',...args]),fillText:(...args)=>calls.push(['text',...args])};
const painted=api.paintToCanvas(paintContext,1200,864);
assert.equal(painted.count,2);assert.equal(painted.rects[0].x,200);assert.equal(painted.rects[0].y,160);assert.equal(painted.rects[1].actor,'R1');
assert.equal(calls.filter(call=>call[0]==='text').length,3);assert.equal(calls.at(-1),'restore');
assert.throws(()=>api.paintToCanvas(paintContext,0,864));
console.log(JSON.stringify({pass:true,api:'STRICT_PRESENTATION_ONLY',cameras:cases,overlap:'ORIGINAL_ANCHOR',runnerPriority:true,scaleBounds:[.5,2.5],defaultScale:1,ballRendererUnchanged:true,canvasLabels:painted.count}));

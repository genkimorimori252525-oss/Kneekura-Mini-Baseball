import {expect,test} from 'vitest';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {applyPresentationRenderControlsV84} from './presentation-render-controls-v84.mjs';
import {presentationControlsSourceV84} from './presentation-cadence-v84.mjs';
const original=readFileSync(new URL('../../docs/demos/releases/v83/game.html',import.meta.url),'utf8');
function renderer(html,q){
 const root={};vm.runInNewContext(presentationControlsSourceV84,{globalThis:root});root.KneekuraPresentationControlsV84.configure({qualityScale:q});
 const start=html.indexOf('function makeBroadcastRenderer(canvas,labelHost){'),end=html.indexOf("\n'use strict';\nconst freeze=o=>",start);
 const commands=[],ctx={globalAlpha:1,globalCompositeOperation:'source-over',filter:'none',shadowOffsetX:0,shadowOffsetY:0,
  setTransform(...v){commands.push(['transform',...v]);},fillRect(...v){commands.push(['rect',...v,this.fillStyle]);},beginPath(){},arc(...v){commands.push(['arc',...v,this.fillStyle,this.globalAlpha]);},fill(){}};
 let source=html.slice(start,end);source=source.replace('return {draw,paintBallOverlay',`return {probe:{configure:(c,o,s)=>{cam=c;observed=o;state=s;updateProjectionV81();},ground,paintWorldCell,flushWorld,begin:()=>{anchors=[];sceneDepth=new Map();rasterCells=new Map();fieldMarkCells=[];},inspect:()=>({anchors,depth:[...sceneDepth],cells:[...rasterCells]})},draw,paintBallOverlay`);
 root.KneekuraBallSurface={};root.KneekuraPitchSymbols={};
 const api=vm.runInNewContext('('+source+')',{window:root,globalThis:root,freeze:x=>x})( {width:1200,height:864,getContext:()=>ctx},{}).probe;
 api.configure({eye:{x:0,y:100,z:-35},yaw:0,pitch:Math.atan2(100,85),f:470,cx:300,cy:224},
  {liveObservation:true,livePark:{center:{x:0,z:0},radiusMeters:110,heightMeters:3}},{camera:'overhead',detail:false,glow:.2});api.begin();
 return {api,commands,controls:root.KneekuraPresentationControlsV84};
}
test('quality 1 preserves the exact existing park commands and observations',()=>{
 const before=renderer(original,1),after=renderer(applyPresentationRenderControlsV84(original),1);before.api.ground();after.api.ground();
 expect(JSON.stringify(after.commands)).toBe(JSON.stringify(before.commands));expect(JSON.stringify(after.api.inspect())).toBe(JSON.stringify(before.api.inspect()));
});
test('quality 1.2 increases actual spatial samples with aligned unique depth ownership',()=>{
 const after=renderer(applyPresentationRenderControlsV84(original),1.2);after.api.ground();const d=after.api.inspect();
 expect(d.anchors.length).toBeGreaterThan(16000);expect(new Set(d.depth.map(([key])=>key)).size).toBe(d.depth.length);
 for(const [x,y]of d.anchors)expect(after.controls.grid.aligned(x)&&after.controls.grid.aligned(y)).toBe(true);
 after.api.paintWorldCell(20/3,20/3,4,'#fff',1,'actor');after.api.paintWorldCell(20/3,20/3,3,'#f00',1,'bat');after.api.flushWorld();
 expect(after.api.inspect().cells.find(([,v])=>v.x===20/3&&v.y===20/3)?.[1].owner).toBe('bat');
});
test('quality patch fails closed and preserves the embedded Core and PNG bytes',()=>{
 const next=applyPresentationRenderControlsV84(original);expect(()=>applyPresentationRenderControlsV84(next)).toThrow();
 const core=html=>[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore ='));
 expect(core(next)).toBe(core(original));expect([...next.matchAll(/data:image\/png;base64,[A-Za-z0-9+/=]+/g)].map(m=>m[0])).toEqual([...original.matchAll(/data:image\/png;base64,[A-Za-z0-9+/=]+/g)].map(m=>m[0]));
});

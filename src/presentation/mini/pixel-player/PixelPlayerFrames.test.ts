import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compilePixelPlayerAsset } from './PixelPlayerAsset';
import { selectPixelFrame, visualBatDistance } from './PixelPlayerFrameSelector';
import { selectPitchFrame } from './PixelPlayerPitching';

const load = () => compilePixelPlayerAsset(JSON.parse(readFileSync('assets/pixel-players/players/b1-test.pixel.json','utf8')));
it('provides four distinct explicit right/left swings, preserving small faceless head and two legs', () => {
  const asset=load();
  for (const hand of ['R','L'] as const) {
    const frames=asset.frames.filter(f=>f.action==='batting'&&f.hand===hand);
    expect(frames.map(f=>f.phase)).toEqual([0,1,2,3]);
    expect(new Set(frames.map(f=>JSON.stringify(f.rgba))).size).toBe(4);
    for(const f of frames) expect(f.parts.map(p=>p.name)).toEqual(expect.arrayContaining(['head','leg-left','leg-right','bat']));
  }
});
it('selects exact contact against painted bat cells, refusing physics-to-sprite correction', () => {
  const asset=load();
  const placement={root:{x:80,y:70},scale:1 as const};
  const frame=selectPixelFrame(asset,{action:'batting',direction:'FRONT_LEFT',hand:'R',phase:0,contact:{x:73,y:62}},placement);
  expect(frame.phase).toBe(2);
  expect(visualBatDistance(frame,asset.width,placement,{x:73,y:62})).toBeLessThanOrEqual(1);
  expect(()=>selectPixelFrame(asset,{action:'batting',direction:'FRONT_LEFT',hand:'R',phase:2,contact:{x:30,y:20}},placement)).toThrow(/contact/);
});
it('maps canonical pitch markers without changing frame one or rounding release', () => {
  const normal={readyAtUs:0,motionStartUs:100000,gatherEndUs:250000,strideStartUs:400000,releaseUs:537000,followThroughEndUs:800000};
  const quick={...normal,gatherEndUs:200000,strideStartUs:300000,releaseUs:437000,followThroughEndUs:700000};
  expect([0,100000,154999].map(t=>selectPitchFrame(t,normal))).toEqual([0,0,0]);
  expect([0,100000,154999].map(t=>selectPitchFrame(t,quick))).toEqual([0,0,0]);
  expect([155000,400000,536999,537000].map(t=>selectPitchFrame(t,normal))).toEqual([1,2,2,3]);
  expect(()=>selectPitchFrame(10,{...normal,releaseUs:200000})).toThrow();
});
it('rejects contact when a later opaque part hides every painted bat cell',()=>{
 const source=JSON.parse(readFileSync('assets/pixel-players/players/b1-test.pixel.json','utf8'));
 const frame=source.frames.find((f:{id:string})=>f.id==='batting-R-2');
 frame.parts.push({name:'opaque-overlay',mirrorSafe:true,rows:Array(24).fill('U'.repeat(24))});
 const compiled=compilePixelPlayerAsset(source);
 expect(()=>selectPixelFrame(compiled,{action:'batting',direction:'FRONT_LEFT',hand:'R',phase:2,contact:{x:73,y:62}},{root:{x:80,y:70},scale:1})).toThrow(/contact/);
});

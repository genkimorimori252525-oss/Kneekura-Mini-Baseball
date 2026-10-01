import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compilePixelPlayerAsset } from './PixelPlayerAsset';
import { buildPixelPlayerScene, type PixelActorObservation } from './PixelPlayerScene';
import { createPixelReviewCamera, projectPixelCamera } from './PixelPlayerCamera';
import { simulateContactVerticalSlice } from '../../../core/sim/plateAppearance/ContactVerticalSlice';
import { buildMiniPresentationTimeline } from '../MiniPresentationTimeline';
import type { CanonicalPresentationSample } from '../model';

const asset = ()=>compilePixelPlayerAsset(JSON.parse(readFileSync('assets/pixel-players/players/b1-test.pixel.json','utf8')));
const actor=(hand:'R'|'L'='R'):PixelActorObservation=>({playerId:'b',role:'batter',name:'浅野',position:{x:hand==='R'?-.97:.97,y:0,z:.72},height:1.8,facing:{x:hand==='R'?-1:1,z:1},facts:{action:'batting',direction:hand==='R'?'FRONT_LEFT':'FRONT_RIGHT',hand,phase:0}});
const world={tick:137000,defenders:[],runners:[],ball:null};
it('projects both batter boxes without mirroring world; hides own body in Batter POV',()=>{
 const camera=createPixelReviewCamera('PITCHER_POV','R');
 const r=buildPixelPlayerScene(world,[actor('R')],asset(),camera,[]);
 const l=buildPixelPlayerScene(world,[actor('L')],asset(),camera,[]);
 expect(r.players[0].placement.root.x).toBeGreaterThan(75);
 expect(l.players[0].placement.root.x).toBeLessThan(75);
 expect(r.players[0].frameId).toBe('batting-R-0');
 expect(l.players[0].frameId).toBe('batting-L-0');
 expect(buildPixelPlayerScene(world,[actor()],asset(),createPixelReviewCamera('BATTER_POV','R'),[]).players).toHaveLength(0);
 // Full body feet remain within the independently projected review box bounds.
 const p=r.players[0];
 const near=projectPixelCamera({x:-1.59,y:0,z:.72},camera)!;
 const inner=projectPixelCamera({x:-.37,y:0,z:.72},camera)!;
 expect(p.bodyBounds.x).toBeGreaterThanOrEqual(inner.x-1);
 expect(p.bodyBounds.x+p.bodyBounds.width).toBeLessThanOrEqual(near.x+1);
});
it('keeps names off a defined strike zone and uses depth-scaled labels',()=>{
 const zone={x:72,y:48,width:6,height:12};
 const far=buildPixelPlayerScene(world,[actor()],asset(),createPixelReviewCamera('PITCHER_POV','R'),[],zone);
 expect(far.labels.every(l=>l.bounds.x+l.bounds.width<=72||l.bounds.x>=78||l.bounds.y+l.bounds.height<=48||l.bounds.y>=60)).toBe(true);
 const close=buildPixelPlayerScene(world,[{...actor(),position:{x:0,y:0,z:14}}],asset(),createPixelReviewCamera('PITCHER_POV','R'),[]);
 expect(close.players[0].placement.labelScale).toBeGreaterThan(far.players[0].placement.labelScale);
});
it('retains immutable canonical physical contact, exact cut and replay IDs with rendering enabled/disabled',()=>{
 const input={pitch:{tick:137000,position:{x:0,y:1,z:.06},velocity:{x:0,y:-1.5,z:-35},spin:{x:0,y:0,z:0}},swing:{pose:{grip:{x:-.42,y:1,z:0},tip:{x:.42,y:1,z:0}},linearVelocity:{x:0,y:0,z:22},angularVelocity:{x:0,y:0,z:0}},defenders:[],runners:[],durationTicks:110000,cadenceTicks:55000};
 const disabled=simulateContactVerticalSlice(input), enabled=simulateContactVerticalSlice(input);
 const before=JSON.stringify(enabled);
 const camera=createPixelReviewCamera('PITCHER_POV','R');
 const frames=enabled.snapshots.map(s=>buildPixelPlayerScene(s,[{...actor(),batterState:{handedness:'R',action:'normal_swing',bat:input.swing.pose}}],asset(),camera,enabled.events));
 expect(frames[0].players[0].frameId).toBe('batting-R-2');
 expect(frames[0].physicalBatVisible).toBe(false);
 expect(frames[0].observedBats[0].grip).toEqual(projectPixelCamera(input.swing.pose.grip,camera));
 expect(frames[0].players[0].contactDistance).toBeLessThanOrEqual(1);
 expect(JSON.stringify(enabled)).toBe(before);
 expect(enabled).toEqual(disabled);
 expect(enabled.snapshots.map(s=>buildPixelPlayerScene(s,[{...actor(),batterState:{handedness:'R',action:'normal_swing',bat:input.swing.pose}}],asset(),camera,enabled.events).players[0].frameId)).toEqual(frames.map(f=>f.players[0].frameId));
 const samples:CanonicalPresentationSample[]=enabled.snapshots.map(s=>({world:s,batter:{action:'normal_swing',handedness:'R',bat:input.swing.pose}}));
 const timeline=buildMiniPresentationTimeline(samples,enabled.events);
 expect(timeline.slice(0,2).map(f=>[f.tick,f.cameraMode])).toEqual([[137000,'BATTER_POV'],[137000,'FIELD_OVERHEAD']]);
});
it('keeps authored pitching motion readable in distant Batter POV without bitmap shrinking',()=>{
 const camera=createPixelReviewCamera('BATTER_POV','R');
 const p={playerId:'p',role:'pitcher' as const,name:'森',position:{x:0,y:0,z:18.44},height:1.86,facing:{x:0,z:-1},facts:{action:'pitching' as const,direction:'FRONT' as const,hand:'R' as const,phase:0 as const}};
 const a=buildPixelPlayerScene(world,[p],asset(),camera,[]);
 const b=buildPixelPlayerScene(world,[{...p,facts:{...p.facts,phase:2}}],asset(),camera,[]);
 expect(a.players[0].placement.lod).toBe(1);
 expect(a.players[0].frameId).toBe('compact-pitching-FRONT-R-0');
 expect(b.players[0].frameId).toBe('compact-pitching-FRONT-R-2');
 expect(a.cells).not.toEqual(b.cells);
});

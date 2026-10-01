import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {compilePixelPlayerAsset} from './PixelPlayerAsset';
import {buildPixelPlayerScene,type PixelActorObservation} from './PixelPlayerScene';
import {createPixelReviewCamera,projectPixelCamera} from './PixelPlayerCamera';
import {simulateContactVerticalSlice} from '../../../core/sim/plateAppearance/ContactVerticalSlice';
const load=()=>compilePixelPlayerAsset(JSON.parse(readFileSync('assets/pixel-players/players/b1-recovery.pixel.json','utf8')));
const world={tick:137000,defenders:[],runners:[],ball:null};
const batter=(hand:'R'|'L'):PixelActorObservation=>({playerId:'b',role:'batter',name:'浅野',position:{x:hand==='R'?-.97:.97,y:0,z:.72},height:1.8,facing:{x:hand==='R'?-1:1,z:1},facts:{action:'batting',direction:hand==='R'?'FRONT_LEFT':'FRONT_RIGHT',hand,phase:0}});
it.each(['R','L'] as const)('preserves exact contact with detailed %s artwork at broadcast framing',hand=>{
 const camera={...createPixelReviewCamera('PITCHER_POV',hand),focalLength:400,centerY:48};
 const contact=simulateContactVerticalSlice({pitch:{tick:137000,position:{x:0,y:1,z:.06},velocity:{x:0,y:-1.5,z:-35},spin:{x:0,y:0,z:0}},swing:{pose:{grip:{x:-.42,y:1,z:0},tip:{x:.42,y:1,z:0}},linearVelocity:{x:0,y:0,z:22},angularVelocity:{x:0,y:0,z:0}},defenders:[],runners:[],durationTicks:110000,cadenceTicks:55000});
 const before=JSON.stringify(contact);
 const s=buildPixelPlayerScene(world,[batter(hand)],load(),camera,contact.events);
 expect(s.players[0].frameId).toBe(`batting-${hand}-2`);
 expect(s.players[0].placement.scale).toBe(1);
 expect(s.players[0].contactDistance).toBeLessThanOrEqual(1);
 expect(s.physicalBatVisible).toBe(false);
 expect(JSON.stringify(contact)).toBe(before);
 // Both boots, rather than the bat-inclusive body rectangle, fit in each box.
 const left=projectPixelCamera({x:hand==='R'?-1.5875:.3683,y:0,z:.72},camera)!;
 const right=projectPixelCamera({x:hand==='R'?-.3683:1.5875,y:0,z:.72},camera)!;
 const bounds=s.players[0].bodyBounds;
 expect(bounds.x).toBeGreaterThanOrEqual(Math.min(left.x,right.x)-1);
 expect(bounds.x+bounds.width).toBeLessThanOrEqual(Math.max(left.x,right.x)+1);
});
it('keeps dense named art layers editable without palette or frame collateral changes',()=>{
 const a=load();expect(a.referenceHeight).toBe(38);
 const f=a.frames.find(f=>f.id==='batting-R-0')!;
 expect(f.bodyBounds.height).toBeGreaterThan(32);
 expect(f.parts.map(p=>p.name)).toContain('head-and-cap');
 expect(f.rgba.filter((_,i)=>i%4===3&&f.rgba[i]===255).length).toBeGreaterThan(500);
});

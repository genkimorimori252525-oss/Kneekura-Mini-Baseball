import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { compilePixelPlayerAsset } from './PixelPlayerAsset';
import { buildPixelPlayerReplay } from './PixelPlayerReplay';
import type { CanonicalPresentationSample } from '../model';
const sample=(tick:number):CanonicalPresentationSample=>({world:{tick,defenders:[],runners:[],ball:null},batter:{handedness:'R',action:'idle',bat:null}});
it('requires exact release samples without manufacturing or rounding them',()=>{
 const samples=[sample(0),sample(55000),sample(110000),sample(165000),sample(192000),sample(220000)];
 const assets=compilePixelPlayerAsset(JSON.parse(readFileSync('assets/pixel-players/players/b1-test.pixel.json','utf8')));
 const actors=new Map(samples.map(s=>[s.world.tick,[{playerId:'p',role:'pitcher' as const,name:'森',position:{x:0,y:0,z:0},height:1.8,facing:{x:0,z:1},facts:{action:'pitching' as const,direction:'FRONT' as const,hand:'R' as const,phase:0 as const}}]]));
 const timing=new Map([['p',{readyAtUs:0,motionStartUs:0,gatherEndUs:80000,strideStartUs:110000,releaseUs:192000,followThroughEndUs:300000}]]);
 const run=(ss:readonly CanonicalPresentationSample[])=>buildPixelPlayerReplay(ss,[],actors,assets,'PITCHER_POV',timing);
 expect(run(samples).map(f=>[f.tick,f.scene.players[0].frameId])).toEqual([[0,'pitching-FRONT-R-0'],[55000,'pitching-FRONT-R-1'],[110000,'pitching-FRONT-R-2'],[165000,'pitching-FRONT-R-2'],[192000,'pitching-FRONT-R-3'],[220000,'pitching-FRONT-R-3']]);
 expect(()=>run(samples.filter(s=>s.world.tick!==192000))).toThrow(/exact release/);
 expect(()=>buildPixelPlayerReplay(samples,[],new Map(),assets)).toThrow(/actor/);
});
it.each(['R','L'] as const)('renders ordinary idle -> swing -> exact contact for %s batter',hand=>{
 const assets=compilePixelPlayerAsset(JSON.parse(readFileSync('assets/pixel-players/players/b1-test.pixel.json','utf8')));
 const samples=[sample(0),sample(55000),sample(137000)].map((s,i)=>({...s,batter:{handedness:hand,action:i===0?'idle' as const:'normal_swing' as const,bat:null}}));
 const actors=new Map(samples.map((s,i)=>[s.world.tick,[{playerId:'b',role:'batter' as const,name:'打者',position:{x:hand==='R'?-.97:.97,y:0,z:.72},height:1.8,facing:{x:hand==='R'?-1:1,z:1},facts:{action:'batting' as const,direction:hand==='R'?'FRONT_LEFT' as const:'FRONT_RIGHT' as const,hand,phase:i as 0|1|2}}]]));
 const frames=buildPixelPlayerReplay(samples,[{tick:137000,sequence:0,kind:'BatBallContact',payload:{liveBattedBall:true,point:{x:0,y:1,z:0}}}],actors,assets,'PITCHER_POV');
 expect(frames.slice(0,3).map(f=>f.scene.players[0].frameId)).toEqual([`idle-stance-${hand}`,`batting-${hand}-1`,`batting-${hand}-2`]);
 expect(frames[3].cameraMode).toBe('FIELD_OVERHEAD');
});

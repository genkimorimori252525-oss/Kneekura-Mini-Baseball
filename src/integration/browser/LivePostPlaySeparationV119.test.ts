import {expect,it} from 'vitest';
import {buildLivePostPlayFramesV115,type LiveMatchFrameV1} from './LiveBaseballMatchV1';

it('does not collapse separated teammates onto the same bench destination after official closure',()=>{
 const last={tick:100,phase:'field',ball:null,actors:[
  {playerId:'one',team:0,position:{x:-29,y:1,z:2.5},velocity:{x:0,y:0,z:0}},
  {playerId:'two',team:0,position:{x:-29,y:1,z:3.5},velocity:{x:0,y:0,z:0}}
 ]} as unknown as LiveMatchFrameV1,before=JSON.stringify(last);
 const frames=buildLivePostPlayFramesV115({lastFrame:last,readyFrame:last,field:null,defense:{} as never,battingTeam:1,ticksPerSecond:1000000,officialEndTick:100});
 for(const frame of frames){const [a,b]=frame.actors;
  expect(Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)).toBeGreaterThanOrEqual(.5);
  expect(frame.phase).toBe('bench');expect(frame.tick).toBeGreaterThan(100);
 }
 expect(frames.at(-1)!.tick).toBe(3000100);expect(JSON.stringify(last)).toBe(before);
});

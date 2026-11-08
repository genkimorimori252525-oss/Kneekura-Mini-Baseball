import { readFileSync } from 'node:fs';
import type { LiveMatchInputV1, LivePositionV1 } from './LiveBaseballMatchV1';
export function liveMatchFixture(seed=1234):LiveMatchInputV1{
  const roles:LivePositionV1[]=['P','C','1B','2B','3B','SS','LF','CF','RF'];
  const teams=([0,1] as const).map(t=>({id:'team-'+t,name:'Team '+t,battingOrder:Array.from({length:9},(_,i)=>t+'-b'+i),pitcherId:t+'-p0',
    defense:Object.fromEntries(roles.map((r,i)=>[r,i===0?t+'-p0':t+'-b'+(i-1)])) as Record<LivePositionV1,string>}));
  const measured=JSON.parse(readFileSync('docs/demos/measured-bat-motions.json','utf8'));
  return {seed,innings:9,teams:teams as unknown as LiveMatchInputV1['teams'],players:[0,1].flatMap(t=>[
    ...Array.from({length:9},(_,i)=>({playerId:t+'-b'+i,name:'Player '+t+'-'+i,heightMeters:1.8,bats:(i%3===0?'L':'R') as 'L'|'R'})),
    {playerId:t+'-p0',name:'Pitcher '+t,heightMeters:1.88,bats:'R' as const}]),measuredClips:measured.clips};
}

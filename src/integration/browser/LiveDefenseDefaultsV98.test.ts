import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applyLivePhysicalRosterV1} from './LivePhysicalRosterV1';
const read=(file:string)=>JSON.parse(readFileSync(new URL('../../../docs/demos/'+file,import.meta.url),'utf8'));
it('keeps every V62 authored value and only adds the approved field-only multiplier to initial LAD players',()=>{
  const old=read('live-game-roster-v62.json'),next=read('live-game-roster-v98.json'),catalog=read('live-game-roster-catalog-v77.json'),
    baseline=applyLivePhysicalRosterV1({players:catalog.players,roster:old}),updated=applyLivePhysicalRosterV1({players:catalog.players,roster:next});
  expect(next.entries).toHaveLength(20);
  for(const entry of next.entries){
    const player=catalog.players.find((p:{playerId:string})=>p.playerId===entry.playerId), prior=old.entries.find((e:{playerId:string})=>e.playerId===entry.playerId),copy=structuredClone(entry);
    if(player.teamName==='LAD'){expect(copy.physical.fieldingReactionScaleV98).toBe(.8);delete copy.physical.fieldingReactionScaleV98;}
    else expect(copy.physical.fieldingReactionScaleV98).toBeUndefined();
    expect(copy).toEqual(prior);
  }
  for(let i=0;i<updated.players.length;i++){
    const p=updated.players[i],q=baseline.players[i];
    expect(p.physical.reactionSeconds).toBe(q.physical.reactionSeconds);
    expect(p.traitProfile).toEqual(q.traitProfile);
  }
  const reloaded=applyLivePhysicalRosterV1({players:updated.players,roster:old});
  expect(reloaded.players.every(p=>(p.physical.fieldingReactionScaleV98??1)===1)).toBe(true);
});

import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {applyLivePhysicalRosterV1,type LivePhysicalRosterInputV1} from './LivePhysicalRosterV1';
import type {LivePublicAbilityReferenceV1} from './LivePublicAbilitiesV1';
const reference=JSON.parse(readFileSync('docs/demos/live-public-ability-reference-v1.json','utf8')) as LivePublicAbilityReferenceV1;
const baseline=JSON.parse(readFileSync('docs/demos/live-game-roster-v98.json','utf8')) as LivePhysicalRosterInputV1;
it('preserves asymmetric relationship controls through ordinary roster JSON without changing base SI',()=>{
 const packet=structuredClone(baseline) as any,a=packet.entries[0],b=packet.entries[1];
 a.physical.fieldRelationshipsV99=[{toPlayerId:b.playerId,trust:20,coordination:80}];
 b.physical.fieldRelationshipsV99=[{toPlayerId:a.playerId,trust:90,coordination:30}];
 const loaded=applyLivePhysicalRosterV1({players:reference.players,roster:JSON.parse(JSON.stringify(packet))});
 expect(loaded.players.find(p=>p.playerId===a.playerId)!.physical.fieldRelationshipsV99).toEqual(a.physical.fieldRelationshipsV99);
 expect(loaded.players.find(p=>p.playerId===b.playerId)!.physical.fieldRelationshipsV99).toEqual(b.physical.fieldRelationshipsV99);
 for(const [i,e] of packet.entries.entries())for(const k of ['transferSeconds','throwSpeedMps','reactionSeconds','retentionCapacityJ'])
  expect(e.physical[k]).toEqual((baseline.entries[i].physical as any)[k]);
 a.physical.fieldRelationshipsV99[0].trust=101;
 expect(()=>applyLivePhysicalRosterV1({players:reference.players,roster:packet})).toThrow();
});

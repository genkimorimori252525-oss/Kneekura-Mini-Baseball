import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {simulateLiveFieldPlayV1,type LiveFieldPlayInputV1} from './LiveFieldPlayV1';
it('hands an exactly completed recovery to the ordinary motor without a residual downward glove drift',()=>{
 const input=JSON.parse(readFileSync('docs/verification/cooperative-defense-v120/performance/close-first-weak-input.json','utf8')) as LiveFieldPlayInputV1,
  edited=structuredClone(input),rear=edited.fielders.find(f=>f.defensivePosition==='SS')!;
 Object.assign(rear,{position:{...rear.position,x:1.2,z:36},reactionSeconds:.4});
 const result=simulateLiveFieldPlayV1(edited);
 expect(result.diagnostics.athleticDecisionsV115.some(a=>a.playerId===rear.playerId&&a.kind==='dive')).toBe(true);
 expect(result.end.complete,JSON.stringify(result.diagnostics.unresolvedDetail)).toBe(true);
},60000);

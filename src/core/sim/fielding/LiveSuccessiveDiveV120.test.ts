import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {simulateLiveFieldPlayV1,type LiveFieldPlayInputV1} from './LiveFieldPlayV1';
// Retention .01J is an explicit boundary intervention, never an MLB error
// frequency or a production ability adjustment. All failed searches are kept.
const fixture=(name:string)=>JSON.parse(readFileSync(new URL('./__fixtures__/successive-dive-'+name+'-v120.json',import.meta.url),'utf8')) as LiveFieldPlayInputV1;
const physical=(r:ReturnType<typeof simulateLiveFieldPlayV1>)=>({facts:r.facts,ruleFacts:r.ruleFacts,end:r.end,finalRunners:r.finalRunners});
it('allows an actual front dive to fail before a rear player independently dives and secures',()=>{
 const input=fixture('first-failed-rear-dive-secured'),r=simulateLiveFieldPlayV1(input),dives=r.diagnostics.athleticDecisionsV115.filter(a=>a.kind==='dive'),
  first=dives.find(a=>a.playerId==='f3')!,rear=dives.find(a=>a.playerId==='f5')!,touch=r.facts.find(f=>f.kind==='glove_contact'&&f.playerId==='f3')!,
  secure=r.facts.find(f=>f.kind==='catch_secured'&&f.playerId==='f5')!;
 expect(r.end.complete,JSON.stringify(r.diagnostics.unresolvedDetail)).toBe(true);
 expect(first).toBeDefined();expect(rear).toBeDefined();expect(touch).toBeDefined();expect(secure).toBeDefined();
 expect(rear.fromSeconds).toBeGreaterThan(touch.elapsedSeconds);expect(rear.fromSeconds).toBeLessThan(first.throughSeconds);
 expect(secure.elapsedSeconds).toBeGreaterThan(rear.fromSeconds);
 expect(r.facts.some(f=>f.kind==='catch_secured'&&f.playerId==='f3')).toBe(false);
 expect(r.facts.filter(f=>f.kind==='throw_release'&&f.playerId==='f5').every(f=>f.elapsedSeconds>=rear.throughSeconds)).toBe(true);
 const variation={...input,frameSeconds:1/30};
 if(input.recordDecisionTraceV118)delete variation.recordDecisionTraceV118;else variation.recordDecisionTraceV118=true;
 const altered=simulateLiveFieldPlayV1(variation);
 expect(physical(altered)).toEqual(physical(r));
 const reordered=simulateLiveFieldPlayV1({...input,fielders:input.fielders.slice().reverse()});
 expect(physical(reordered)).toEqual(physical(r));
},60000);
it('keeps the first baseman carry estimate behind his own committed recovery boundary',()=>{
 const input=JSON.parse(readFileSync('docs/verification/cooperative-defense-v120/performance/first-base-dive-carry-input.json','utf8')) as LiveFieldPlayInputV1,
  r=simulateLiveFieldPlayV1(input),id=input.fielders.find(f=>f.defensivePosition==='1B')!.playerId,
  action=r.diagnostics.athleticDecisionsV115.find(a=>a.playerId===id&&a.kind==='dive')!,
  rows=r.diagnostics.aiTelemetry.postActionEstimatesV120!.filter(a=>a.playerId===id&&a.observerId===id&&a.elapsedSeconds<action.throughSeconds);
 expect(r.end.complete).toBe(true);expect(action).toBeDefined();expect(rows.length).toBeGreaterThan(0);
 expect(rows.every(a=>a.knowledge==='self'&&a.readySeconds===action.throughSeconds&&a.arrivalSeconds>=action.throughSeconds)).toBe(true);
 const touch=r.facts.find(f=>f.kind==='controlled_base_contact'&&f.playerId===id&&f.base===1)!;
 expect(touch.elapsedSeconds).toBeGreaterThan(action.throughSeconds);
 expect(r.facts.some(f=>f.kind==='throw_release'&&f.playerId===id)).toBe(false);
},60000);
it('continues real recovery when both committed divers fail retention',()=>{
 const r=simulateLiveFieldPlayV1(fixture('both-failed'));
 expect(r.end.complete,JSON.stringify(r.diagnostics.unresolvedDetail)).toBe(true);
 for(const id of ['f3','f5']){
  expect(r.diagnostics.athleticDecisionsV115.some(a=>a.kind==='dive'&&a.playerId===id)).toBe(true);
  expect(r.facts.some(f=>f.kind==='glove_contact'&&f.playerId===id)).toBe(true);
  expect(r.facts.some(f=>f.kind==='catch_secured'&&f.playerId===id)).toBe(false);
 }
 expect(r.facts.some(f=>f.kind==='catch_secured'&&!['f3','f5'].includes(f.playerId!))).toBe(true);
},60000);

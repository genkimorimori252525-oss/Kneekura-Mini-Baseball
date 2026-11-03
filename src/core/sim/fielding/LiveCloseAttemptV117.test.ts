import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {simulateLiveFieldPlayV1,type LiveFieldPlayInputV1} from './LiveFieldPlayV1';

const fixture=():LiveFieldPlayInputV1=>JSON.parse(readFileSync(new URL('./__fixtures__/first-ground-v117.json',import.meta.url),'utf8'));
const first=(input:LiveFieldPlayInputV1)=>input.fielders.find(f=>f.defensivePosition==='1B')!;

it('attempts a nearby low crossing despite a slightly late forecast without changing the real capture or ability',()=>{
 const input=fixture(),before=JSON.stringify(input),id=first(input).playerId,result=simulateLiveFieldPlayV1(input),
  beforePassing=result.frames.filter(f=>f.elapsedSeconds<input.ball.elapsedSeconds+1.6);
 expect(beforePassing.some(f=>f.fielders.find(a=>a.playerId===id)!.intent==='intercept')).toBe(true);
 expect(result.diagnostics.aiTelemetry.roleTransitions.some(r=>r.handlerId===id&&r.source==='forecast_attempt')).toBe(true);
 expect(result.facts.find(f=>f.kind==='catch_secured')!.playerId).not.toBe(id);
 expect(JSON.stringify(input)).toBe(before);
});

it('keeps the cautious preference even with an individually aggressive cost baseline',()=>{
 const base=fixture(),id=first(base).playerId,input={...base,fielders:base.fielders.map(f=>f.playerId!==id?f:{...f,
  fieldingCognition:{...f.fieldingCognition!,pursuitCostWeight:1,cautious:true}})},result=simulateLiveFieldPlayV1(input);
 expect(result.frames.filter(f=>f.elapsedSeconds<base.ball.elapsedSeconds+1.6).some(f=>f.fielders.find(a=>a.playerId===id)!.intent==='intercept')).toBe(false);
 expect(result.facts.find(f=>f.kind==='catch_secured')!.playerId).not.toBe(id);
});

it('does not pull a distant first baseman into every passing ball',()=>{
 const base=fixture(),id=first(base).playerId,input={...base,fielders:base.fielders.map(f=>f.playerId!==id?f:{...f,position:{...f.position,x:36}})},
  result=simulateLiveFieldPlayV1(input);
 expect(result.frames.filter(f=>f.elapsedSeconds<base.ball.elapsedSeconds+1.6).some(f=>f.fielders.find(a=>a.playerId===id)!.intent==='intercept')).toBe(false);
 expect(result.end.complete).toBe(true);
});

it('does not create an early motor response or extend the glove when an attempt is issued',()=>{
 const input=fixture(),spec=first(input),result=simulateLiveFieldPlayV1(input),response=spec.reactionSeconds+spec.fieldingCognition!.decisionSeconds;
 for(const frame of result.frames.filter(f=>f.elapsedSeconds<input.ball.elapsedSeconds+response))
  expect(frame.fielders.find(f=>f.playerId===spec.playerId)!.position).toEqual(spec.position);
 for(const frame of result.frames){const f=frame.fielders.find(f=>f.playerId===spec.playerId)!,s=f.bodyPoseV105!.shoulder;
  expect(Math.hypot(f.glove.x-s.x,f.glove.y-s.y,f.glove.z-s.z)).toBeLessThanOrEqual(spec.bodyModelV105!.armReachMeters+1e-7);}
});

it('allows the better reaction to turn the same opportunity into a real catch',()=>{
 const base=fixture(),id=first(base).playerId,input={...base,fielders:base.fielders.map(f=>f.playerId!==id?f:{...f,reactionSeconds:.13,
  fieldingCognition:{...f.fieldingCognition!,decisionSeconds:.035}})},result=simulateLiveFieldPlayV1(input);
 expect(result.facts.find(f=>f.kind==='catch_secured')!.playerId).toBe(id);expect(result.end.complete).toBe(true);
});

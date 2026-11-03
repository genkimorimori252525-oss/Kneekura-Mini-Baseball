import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { runFieldPracticeV98 } from './FieldPracticeWorkbenchV98';
const frozen=readFileSync('docs/demos/field-rf-ground-v107.json','utf8');
const request=()=>JSON.parse(frozen);
it('attempts the actual close RF-to-first throw without changing the arm or forcing an out',()=>{
 const input=request(),before=JSON.stringify(input),r=runFieldPracticeV98(input),
  release=r.field.facts.find(f=>f.kind==='throw_release'&&f.playerId===input.fieldInput.defense.RF)!;
 expect(release).toMatchObject({base:1,reason:'force_play'});
 expect(r.field.facts.some(f=>f.kind==='catch_secured'&&f.playerId===release.receiverPlayerId&&f.tick>release.tick)).toBe(true);
 expect(r.field.end.complete).toBe(true);
 // The runner wins this close race. A willingness decision must not turn it
 // into a scripted out or suppress a physically completed safe play.
 expect(r.field.finalRunners[0].retired).toBe(false);
 expect(r.input.fielders.find(f=>f.playerId===release.playerId)!.throwSpeedMps).toBe(45);
 expect(JSON.stringify(input)).toBe(before);
});
it('distinguishes weak arms, cautious preferences and a slower runner through the same physical race',()=>{
 const weak=request(),id=weak.fieldInput.defense.RF;
 weak.fieldInput.players.find((p:{playerId:string})=>p.playerId===id).physical.throwSpeedMps=20;
 expect(runFieldPracticeV98(weak).field.facts.some(f=>f.kind==='throw_release'&&f.playerId===id&&f.base===1&&f.reason==='force_play')).toBe(false);
 const cautious=request();cautious.fieldInput.players.find((p:{playerId:string})=>p.playerId===id).physical.fieldingPursuitCostWeight=1/.65;
 expect(runFieldPracticeV98(cautious).field.facts.some(f=>f.kind==='throw_release'&&f.playerId===id&&f.base===1&&f.reason==='force_play')).toBe(false);
 const slower=request();slower.fieldInput.players.find((p:{playerId:string})=>p.playerId===slower.fieldInput.batterRunnerId).physical.topSpeedMps=6;
 const out=runFieldPracticeV98(slower);
 expect(out.field.ruleFacts.controlledBaseContacts.some(c=>c.base===1)).toBe(true);
 expect(out.field.finalRunners[0].retired).toBe(true);
});

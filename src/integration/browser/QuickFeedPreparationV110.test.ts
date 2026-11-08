import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { runFieldPracticeV98 } from './FieldPracticeWorkbenchV98';
const frozen=readFileSync('docs/demos/field-double-play-v106.json','utf8');
it('prepares Benz-to-Raipoa during transfer and issues a genuine gentle feed within about half a second',()=>{
 const request=JSON.parse(frozen),before=JSON.stringify(request),r=runFieldPracticeV98(request),f=r.field,
  holder=request.fieldInput.defense['2B'],secure=f.facts.find(x=>x.kind==='catch_secured'&&x.playerId===holder)!,
  release=f.facts.find(x=>x.kind==='throw_release'&&x.playerId===holder)!,command=f.diagnostics.throwEffortCommandsV103[0],
  transfer=r.input.fielders.find(x=>x.playerId===holder)!.transferSeconds;
 expect(release).toMatchObject({base:2,receiverPlayerId:request.fieldInput.defense.SS});
 expect(release.elapsedSeconds-secure.elapsedSeconds).toBeLessThanOrEqual(.55);
 expect(['hand_throw','glove_toss']).toContain(command.releaseStyleV110);
 if(command.releaseStyleV110==='hand_throw')expect(command.chargeFrom).toBeGreaterThanOrEqual(secure.elapsedSeconds+transfer-1e-10);
 expect(command.from).toBeLessThan(secure.elapsedSeconds+transfer);
 expect(command.chargeFrom).toBeGreaterThanOrEqual(secure.elapsedSeconds);
 expect(command.commandSpeedMps).toBeLessThan(25);
 expect(f.facts.some(x=>x.kind==='catch_secured'&&x.playerId===release.receiverPlayerId&&x.tick>release.tick)).toBe(true);
 expect(f.ruleFacts.controlledBaseContacts.map(x=>x.base)).toEqual([2,1]);expect(r.match.outs).toBe(2);
 expect(f.end.complete).toBe(true);expect(JSON.stringify(request)).toBe(before);
 console.info(JSON.stringify({benchmark:'V110_BENZ_QUICK_FEED',secure:secure.elapsedSeconds,release:release.elapsedSeconds,
 delay:release.elapsedSeconds-secure.elapsedSeconds,speed:command.commandSpeedMps,chargeFrom:command.chargeFrom}));
});
it('preserves a slower authored transfer instead of granting every player a half-second release',()=>{
 const request=JSON.parse(frozen),holder=request.fieldInput.defense['2B'];
 const physical=request.fieldInput.players.find((p:{playerId:string})=>p.playerId===holder).physical;
 physical.transferSeconds=.8;physical.defensiveDecisionSeconds=.14;
 const r=runFieldPracticeV98(request),f=r.field,secure=f.facts.find(x=>x.kind==='catch_secured'&&x.playerId===holder)!,
  release=f.facts.find(x=>x.kind==='throw_release'&&x.playerId===holder)!;
 expect(r.input.fielders.find(x=>x.playerId===holder)!.transferSeconds).toBe(.8);
 if(release)expect(release.elapsedSeconds-secure.elapsedSeconds).toBeGreaterThanOrEqual(.8-1e-10);
 expect(f.end.complete).toBe(true);
});
it('lets an internally skilled player bypass a long hand transfer with an actual glove toss',()=>{
 const request=JSON.parse(frozen),holder=request.fieldInput.defense['2B'];
 request.fieldInput.players.find((p:{playerId:string})=>p.playerId===holder).physical.transferSeconds=.8;
 const r=runFieldPracticeV98(request),f=r.field,secure=f.facts.find(x=>x.kind==='catch_secured'&&x.playerId===holder)!,
  release=f.facts.find(x=>x.kind==='throw_release'&&x.playerId===holder)!,command=f.diagnostics.throwEffortCommandsV103[0];
 console.info(JSON.stringify({benchmark:'V110_GLOVE_FEED',command,secure:secure.elapsedSeconds,release:release?.elapsedSeconds,end:f.end}));
 expect(command.releaseStyleV110).toBe('glove_toss');expect(release.elapsedSeconds-secure.elapsedSeconds).toBeLessThan(.8);
 expect(command.commandSpeedMps).toBeLessThanOrEqual(r.input.fielders.find(x=>x.playerId===holder)!.gloveSpeedMps);
 expect(release.position!.y).toBeLessThan(1.4);expect(f.end.complete).toBe(true);
 expect(f.facts.some(x=>x.kind==='catch_secured'&&x.playerId===release.receiverPlayerId&&x.tick>release.tick)).toBe(true);
});

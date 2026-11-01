import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { runFieldPracticeV98 } from './FieldPracticeWorkbenchV98';
const frozen=readFileSync('docs/demos/field-double-play-v106.json','utf8');
it('connects an early lighter 4-6 throw to actual receipt, second-base contact and a real 6-3 out',()=>{
 const request=JSON.parse(frozen),before=JSON.stringify(request),r=runFieldPracticeV98(request),f=r.field,
  release=f.facts.find(x=>x.kind==='throw_release')!,effort=f.diagnostics.throwEffortCommandsV103[0],
  secure=f.facts.find(x=>x.kind==='catch_secured'&&x.playerId===release.receiverPlayerId&&x.tick>release.tick)!,
  touch=f.ruleFacts.controlledBaseContacts.find(x=>x.base===2)!;
 expect(release).toMatchObject({playerId:request.fieldInput.defense['2B'],receiverPlayerId:request.fieldInput.defense.SS,base:2});
 expect(['RECEIVER_TIMED_EARLY_RELEASE','GLOVE_TOSS_EARLY_RELEASE']).toContain(effort.reason);expect(effort.commandSpeedMps).toBeLessThanOrEqual(effort.capacitySpeedMps);
 const frame=[...f.frames].reverse().find(x=>x.elapsedSeconds<=release.elapsedSeconds)!,
  receiver=frame.fielders.find(x=>x.playerId===release.receiverPlayerId)!,base=request.fieldInput.field.bases.second;
 expect(Math.hypot(receiver.position.x-base.x,receiver.position.z-base.z)).toBeGreaterThan(1.5);
 expect(secure.tick).toBeGreaterThan(release.tick);expect(touch.tick).toBeGreaterThanOrEqual(secure.tick);
 expect(f.facts.filter(x=>x.kind==='throw_release').map(x=>x.base)).toEqual([2,1]);
 expect(f.end.complete).toBe(true);expect(r.match.outs).toBe(2);expect(JSON.stringify(request)).toBe(before);
});
it('times a gentle feed to a more distant shortstop without waiting for them to touch the base',()=>{
 const request=JSON.parse(frozen);request.fieldInput.placements.SS.x=-16;
 const r=runFieldPracticeV98(request),f=r.field,release=f.facts.find(x=>x.kind==='throw_release')!,effort=f.diagnostics.throwEffortCommandsV103[0],
  frame=[...f.frames].reverse().find(x=>x.elapsedSeconds<=release.elapsedSeconds)!,
  receiver=frame.fielders.find(x=>x.playerId===release.receiverPlayerId)!,base=request.fieldInput.field.bases.second;
 expect(['RECEIVER_TIMED_EARLY_RELEASE','GLOVE_TOSS_EARLY_RELEASE']).toContain(effort.reason);expect(effort.commandSpeedMps).toBeLessThan(25);
 expect(release.elapsedSeconds).toBeLessThan(2.6);expect(Math.hypot(receiver.position.x-base.x,receiver.position.z-base.z)).toBeGreaterThan(4);
 const firstOut=f.finalRunners.find(x=>x.runnerId===request.fieldInput.occupiedBases.first)!,
  batter=f.finalRunners.find(x=>x.runnerId===request.fieldInput.batterRunnerId)!,
  returnThrow=f.facts.find(x=>x.kind==='throw_release'&&x.base===1)!,
  returnReceipt=f.facts.find(x=>x.kind==='catch_secured'&&x.playerId===returnThrow?.receiverPlayerId&&x.tick>returnThrow.tick)!,
  batterTouch=f.ruleFacts.runnerTouches.find(x=>x.runnerId===batter.runnerId&&x.base===1)!;
 expect(f.ruleFacts.controlledBaseContacts.some(x=>x.base===2)).toBe(true);expect(firstOut.retired).toBe(true);
 expect(returnThrow).toBeDefined();expect(returnReceipt).toBeDefined();
 expect(batterTouch.tick).toBeLessThan(returnReceipt.tick);expect(batter.retired).toBe(false);
 expect(f.diagnostics.throwEffortCommandsV103.some(c=>c.base===1&&c.plannedControlAtSeconds>c.runnerDeadlineAtSeconds)).toBe(true);
 expect(f.end.complete).toBe(true);expect(r.match.outs).toBe(1);
});
it('uses a stronger arm for a quick low-effort feed while preserving its actual capacity',()=>{
 const request=JSON.parse(frozen),id=request.fieldInput.defense['2B'];
 request.fieldInput.players.find((p:{playerId:string})=>p.playerId===id).physical.throwSpeedMps=65;
 const r=runFieldPracticeV98(request),effort=r.field.diagnostics.throwEffortCommandsV103[0];
 expect(r.input.fielders.find(f=>f.playerId===id)!.throwSpeedMps).toBe(65);
 expect(['RECEIVER_TIMED_EARLY_RELEASE','GLOVE_TOSS_EARLY_RELEASE']).toContain(effort.reason);expect(effort.commandSpeedMps).toBeLessThan(40);
 expect(effort.requiredChargeSeconds).toBeLessThan(.2);expect(r.field.end.complete).toBe(true);expect(r.match.outs).toBe(2);
});

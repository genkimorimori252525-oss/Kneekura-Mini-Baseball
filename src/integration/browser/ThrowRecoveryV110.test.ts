import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { runFieldPracticeV98 } from './FieldPracticeWorkbenchV98';

it('retrieves an actual reverse rebound after the strong 5-4 feed exceeds receiver retention',()=>{
 const request=JSON.parse(readFileSync('docs/demos/field-double-play-v106.json','utf8'));
 request.fieldInput.ball.ball.velocity={x:-12,y:-2,z:14};
 request.fieldInput.placements['3B']={...request.fieldInput.placements['3B'],x:-18,z:23};
 const thrower=request.fieldInput.defense['3B'],receiver=request.fieldInput.defense['2B'];
 request.fieldInput.players.find((p:{playerId:string})=>p.playerId===thrower).physical.throwSpeedMps=65;
 const before=JSON.stringify(request),r=runFieldPracticeV98(request),f=r.field,
  release=f.facts.find(x=>x.kind==='throw_release'&&x.playerId===thrower)!,
  failed=f.diagnostics.aiTelemetry.contactDiagnostics.find(c=>c.playerId===receiver&&c.elapsedSeconds>release.elapsedSeconds&&c.retention?.outcome==='live-ball')!;
 expect(release).toMatchObject({base:2,receiverPlayerId:receiver});
 expect(failed).toBeDefined();
 expect(failed.retention!.retentionLoadJ).toBeGreaterThan(failed.retention!.effectiveCapacityJ);
 const rebounded=f.frames.find(x=>x.elapsedSeconds>failed.elapsedSeconds)!,incoming=failed.retention!.ballVelocity;
 expect(rebounded.ball.velocity.x*incoming.x+rebounded.ball.velocity.z*incoming.z).toBeLessThan(0);
 const recovered=f.facts.find(x=>x.kind==='catch_secured'&&x.elapsedSeconds>failed.elapsedSeconds);
 expect(recovered).toBeDefined();
 expect(f.frames.some(x=>x.elapsedSeconds>=recovered!.elapsedSeconds&&x.ball.possessedBy===recovered!.playerId)).toBe(true);
 expect(f.end).toMatchObject({complete:true,reason:'live_action_complete'});
 expect(f.end.elapsedSeconds).toBeGreaterThan(recovered!.elapsedSeconds);
 expect(r.input.fielders.find(x=>x.playerId===thrower)!.throwSpeedMps).toBe(65);
 expect(JSON.stringify(request)).toBe(before);
 console.info(JSON.stringify({benchmark:'V110_REVERSE_REBOUND_RECOVERY',release:release.elapsedSeconds,
  failed:failed.elapsedSeconds,loadJ:failed.retention!.retentionLoadJ,capacityJ:failed.retention!.effectiveCapacityJ,
  recovered:recovered?.elapsedSeconds,by:recovered?.playerId,end:f.end}));
});

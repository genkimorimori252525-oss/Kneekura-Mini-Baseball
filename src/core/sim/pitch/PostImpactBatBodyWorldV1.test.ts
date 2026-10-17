import { expect,it } from 'vitest';
import { controlledBatBodyPitchFixture } from './ControlledBatBodyPitchWorldFixtures.test-support';
import { queryPostImpactBatBodyWorldV1,type PostImpactBatBodyWorldInputV1 } from './PostImpactBatBodyWorldV1';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
const fixture=():PostImpactBatBodyWorldInputV1=>({version:'post_impact_bat_body_world_v1',control:{version:'post_impact_bat_body_control_v1',world:controlledBatBodyPitchFixture(),recoveryEndTick:1299999,maximumSweetSpotSpeedMps:20,maximumBodySpeedMps:5},throughTick:1299999});
it('continues the actual outgoing impulse to a real integer boundary with bat/body/palm and pitcher hand retained',()=>{
  const p={...fixture(),throughTick:1200000},before=JSON.stringify(p),r=queryPostImpactBatBodyWorldV1(p);
  expect(r.kind).toBe('moving');if(r.kind==='unresolved')throw new Error(r.reason);
  expect(r.moment.elapsedSeconds).toBe((p.throughTick-r.moment.originTick)/1e6);expect(r.coverage.originalOtherActorCount).toBe(9);expect(r.coverage.retainedOtherActorCount).toBe(7);
  expect(r.coverage.pitcherHandRetained).toBe(true);expect(r.coverage.actualBatPartCount).toBe(2);expect(r.departures.length).toBeGreaterThan(0);
  expect(r.descriptor.initial.elapsedSeconds).not.toBe((r.descriptor.initial.ball.tick-r.moment.originTick)/1e6);
  expect(r.descriptor.initial.ball.position.z).toBeLessThan(r.moment.ball.position.z);expect(r.coverage.sourceMomentReanchored).toBe(false);
  expect(JSON.stringify(p)).toBe(before);
});
it('keeps the same source across different query horizons, including actual spin/orientation',()=>{
  const p=fixture(),full=queryPostImpactBatBodyWorldV1(p),short=queryPostImpactBatBodyWorldV1({...p,throughTick:1200000});
  if(full.kind==='unresolved'||short.kind==='unresolved')throw new Error('unexpected unresolved physical fixture');
  expect(short.kind).toBe('moving');expect(short.descriptor).toEqual(full.descriptor);
  expect(short.moment).toEqual(createSourceFreeBallKernel(full.descriptor).evaluateAt(short.moment.elapsedSeconds,'incoming').moment);
  expect(Object.values(short.moment.ball.spin).every(Number.isFinite)).toBe(true);
});
it('stops at an actual retained actor before the requested horizon',()=>{
  const p=fixture(),original=queryPostImpactBatBodyWorldV1(p);if(original.kind==='unresolved')throw new Error(original.reason);
  const center=original.moment.ball.position,radiusM=.03,primitive={role:'body' as const,radius:radiusM,startTick:0,endTick:1500000,ticksPerSecond:1000000,startCenter:center,startVelocity:{x:0,y:0,z:0},acceleration:{x:0,y:0,z:0}};
  Object.assign(p.control.world.pitch,{otherActors:[...p.control.world.pitch.otherActors,{playerId:'post-impact-obstacle',primitive}]});
  const obstacles=p.control.world.batterControl.bat.body.obstacles;
  Object.assign(p.control.world.batterControl.bat.body,{obstacles:[...obstacles.slice(0,-1),{center,radiusM},obstacles.at(-1)!]});
  Object.assign(p.control.world.pitch.anchors,{obstacles:[...p.control.world.pitch.anchors.obstacles,{center,radiusM}]});
  const r=queryPostImpactBatBodyWorldV1(p);expect(r.kind).toBe('boundary');if(r.kind==='unresolved')throw new Error(r.reason);
  expect(r.moment.elapsedSeconds).toBeLessThan(original.moment.elapsedSeconds);
  expect('contacts'in r&&r.contacts.some(c=>c.kind==='actor'&&c.playerId==='post-impact-obstacle')).toBe(true);
});
it('keeps the first real ground boundary instead of pretending the controller lease was fully executed',()=>{
  const r=queryPostImpactBatBodyWorldV1(fixture());expect(r.kind,JSON.stringify(r)).toBe('boundary');
  expect('contacts'in r&&r.contacts.some(c=>c.kind==='ground'),JSON.stringify(r)).toBe(true);
});
it('refuses injected departure evidence and queries outside finite control',()=>{
  const p=fixture();expect(()=>queryPostImpactBatBodyWorldV1({...p,departure:{}}as never)).toThrow(/invalid input/);
  expect(()=>queryPostImpactBatBodyWorldV1({...p,throughTick:p.throughTick+1})).toThrow(/finite recovery/);
});

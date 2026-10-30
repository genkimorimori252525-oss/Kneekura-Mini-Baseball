import { expect,it } from 'vitest';
import { controlledBatBodyPitchFixture } from './ControlledBatBodyPitchWorldFixtures.test-support';
import { queryControlledBatBodyPitchWorldV1 } from './ControlledBatBodyPitchWorldV1';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';

it('resolves a real tapered-bat impulse against the exact same Source ball and retains all other colliders',()=>{
  const p=controlledBatBodyPitchFixture(),before=structuredClone(p),r=queryControlledBatBodyPitchWorldV1(p);
  expect(r.kind).toBe('bat_contact');if(r.kind!=='bat_contact')throw new Error(JSON.stringify(r));
  expect(r.witness.signedGapMeters).toBeLessThanOrEqual(0);
  expect(r.moment.ball).toEqual(createSourceFreeBallKernel(p.pitch.descriptor).evaluateAt(r.moment.elapsedSeconds,'incoming').moment.ball);
  expect(r.contact.ballCenter).toEqual(r.moment.ball.position);expect(r.contact.normalImpulseNs).toBeGreaterThan(0);
  expect(r.contact.exitVelocity.z).toBeGreaterThan(0);expect(Object.values(r.contact.exitSpin).every(Number.isFinite)).toBe(true);
  expect(r.coverage).toMatchObject({originalActorCount:9,retainedActorCount:7,replacedActorCount:2,addedBat:true,sourceBallReanchored:false,physicalExecutionAdmitted:false});
  expect(r.postImpactBatControlRequiresSuccessor).toBe(true);expect(p).toEqual(before);
});
it('uses the moving body sphere instead of leaving its old stationary collider in the world',()=>{
  const p=structuredClone(controlledBatBodyPitchFixture());Object.assign(p.pitch.anchors.release.velocity,{y:1});
  const r=queryControlledBatBodyPitchWorldV1(p);expect(r.kind).toBe('actor_contact');if(r.kind!=='actor_contact')throw new Error(JSON.stringify(r));
  expect(r.contact.role).toBe('body');expect(r.moment.ball.position.z).toBeLessThan(-.2);
  expect(r.contact.center.z).toBe(-.5);
});
it('preserves a nonzero initial palm attachment rather than snapping the hand onto the reference point',()=>{
  const p=structuredClone(controlledBatBodyPitchFixture());
  Object.assign(p.batterControl.bat.body.handCenter,{x:.57});
  // The fixture shares the actual original hand-center object with its actor.
  const r=queryControlledBatBodyPitchWorldV1(p);expect(r.kind).toBe('bat_contact');if(r.kind!=='bat_contact')throw new Error(JSON.stringify(r));
  expect(r.actorsAtContact.hand.position.y).toBeCloseTo(1.69,10);
});
it('does not skip an earlier unrelated actor to manufacture a bat hit',()=>{
  const p=structuredClone(controlledBatBodyPitchFixture()),center={x:.08,y:1.52+2.5*.02-9.81*.02*.02/2,z:17.84-40*.02};
  const extra={playerId:'blocking-actor',primitive:{role:'body' as const,radius:.05,startTick:0,endTick:1500000,ticksPerSecond:1000000,
    startCenter:center,startVelocity:{x:0,y:0,z:0},acceleration:{x:0,y:0,z:0}}};
  Object.assign(p.pitch,{otherActors:[...p.pitch.otherActors,extra]});Object.assign(p.pitch.anchors,{obstacles:[...p.pitch.anchors.obstacles,{center,radiusM:.05}]});
  const old=p.batterControl.bat.body.obstacles;Object.assign(p.batterControl.bat.body,{obstacles:[...old.slice(0,-1),{center,radiusM:.05},old.at(-1)!]});
  const r=queryControlledBatBodyPitchWorldV1(p);expect(r.kind).toBe('scene_result');
  if(r.kind!=='scene_result'||r.physical.kind!=='boundary')throw new Error(JSON.stringify(r));
  expect(r.physical.moment.elapsedSeconds).toBeLessThan(.03);
  expect(r.physical.contacts).toContainEqual(expect.objectContaining({kind:'actor',playerId:'blocking-actor'}));
});
it.each(['missing-hand','wrong-body-radius','mass','obstacle-drop','expired-control'] as const)('refuses %s',fault=>{
  const p=structuredClone(controlledBatBodyPitchFixture());
  if(fault==='missing-hand')Object.assign(p.pitch,{otherActors:p.pitch.otherActors.filter(a=>!(a.playerId==='b'&&a.primitive.role==='tag_hand'))});
  if(fault==='wrong-body-radius')Object.assign(p.pitch.otherActors[0].primitive,{radius:.1});
  if(fault==='mass')Object.assign(p.ball,{massKg:.2});
  if(fault==='obstacle-drop')Object.assign(p.batterControl.bat.body,{obstacles:p.batterControl.bat.body.obstacles.slice(1)});
  if(fault==='expired-control')Object.assign(p.pitch,{throughTick:1300001});
  expect(()=>queryControlledBatBodyPitchWorldV1(p)).toThrow();
});

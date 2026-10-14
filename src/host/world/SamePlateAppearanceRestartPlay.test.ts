import { expect,it } from 'vitest';
import { createRequire } from 'node:module';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaRestartPlayInput, samePaRestartPlayTable } from './SamePlateAppearanceRestartPlaySource';
import { deriveSamePaRestartPlay, bindSamePaRestartPlayToPitch } from './SamePlateAppearanceRestartPlayProof';
import { assertSamePaRestartPlayStorage, samePaRestartPlaySchema } from './SamePlateAppearanceRestartPlayStorage';
const ref=(owner:string,id=owner)=>({owner,sourceId:id,sourceHash:hash(id),snapshotHash:hash(id)}) as any;
import { restartFixture } from './SamePlateAppearanceRestartPlay.test-support';
it('declares actual Play at owned foul reset with explicit custody and actual plate/body contact',()=>{
  const f=restartFixture(),play=f.derive();expect(play.state).toBe('live');expect(play.occurredAt).toEqual({originTick:100,elapsedSeconds:0,tick:100});
  expect(play.footContacts).toHaveLength(2);expect(play.custodyContact.tick).toBe(100);expect(play.worldHash).toBe(hash(f.reset.resetWorld));
});
it.each(['wrong_cut','backdated','wrong_pitch','wrong_person','airborne_feet','detached_ball','missing_reset','unretired'])('rejects %s instead of manufacturing restart',kind=>{
  const f=restartFixture(),source=structuredClone(f.source) as any;
  if(kind==='wrong_cut')f.b.view.cut.stage='field_active';
  if(kind==='backdated')source.custody.ball.tick=99;
  if(kind==='wrong_pitch')source.physicalPitchSourceId='other';
  if(kind==='wrong_person')source.personId='other';
  if(kind==='airborne_feet')f.body.actor.bodyOriginHeightMeters=2;
  if(kind==='detached_ball')source.custody.ball.position.x=4;
  if(kind==='missing_reset')f.b.view.cut.resetReference=null;
  if(kind==='unretired')f.reset.retirement.basis.completedAtTick=101;
  expect(()=>deriveSamePaRestartPlay(source,f.originals,f.b,f.reset,f.action,f.posture)).toThrow();
});
it('binds exact accepted action/posture to executed release without moving Play clock',()=>{
  const f=restartFixture(),play=f.derive(),release={releaseAtUs:1000,position:{x:1,y:1.6,z:17},velocity:{x:2,y:0,z:-30},spin:{x:0,y:100,z:0}};
  const right:any={source:{sourceId:'right',sourceVersion:'test-v1',actionReference:f.source.actionReference,postureReference:f.source.postureReference},lineage:play.lineage};
  const launch:any={source:{sourceId:'next-pitch',sourceVersion:'test-v1',actionReference:f.source.actionReference,viewReference:f.source.viewReference,rightReference:reference('pa_physical_v1_rights',right)},
    lineage:play.lineage,delivery:{timeline:{readyAtUs:100,releaseUs:1000},release},trajectory:{start:{tick:1000,position:release.position,velocity:release.velocity,spin:release.spin},parameters:{ticksPerSecond:1_000_000}}};
  const bound=bindSamePaRestartPlayToPitch(play,launch,right);expect(bound.occurredAt).toEqual(play.occurredAt);expect(bound.release).toEqual(release);expect(bound.playDeclaration.sourceVersion).toBe('test-v1');
  expect(()=>bindSamePaRestartPlayToPitch(play,{...launch,source:{...launch.source,sourceId:'other'}},right)).toThrow();
  expect(()=>bindSamePaRestartPlayToPitch(play,launch,{...right,source:{...right.source,postureReference:ref('batting_observation_v1_postures','other')}})).toThrow();
  expect(()=>bindSamePaRestartPlayToPitch(play,{...launch,trajectory:{...launch.trajectory,start:{...launch.trajectory.start,tick:99}}},right)).toThrow();
});
it('requires exact Source fields and exact namespace/indexes',()=>{
  const f=restartFixture();expect(()=>samePaRestartPlayInput({...f.source,occurredAt:99})).toThrow();expect(()=>samePaRestartPlayInput({...f.source,custody:{...f.source.custody,kind:'inferred'}})).toThrow();
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new DatabaseSync(':memory:');
  try{expect(assertSamePaRestartPlayStorage(db)).toBe(false);db.exec(samePaRestartPlaySchema);expect(assertSamePaRestartPlayStorage(db)).toBe(true);
    db.exec('CREATE TEMP TABLE '+samePaRestartPlayTable+'(x)');expect(()=>assertSamePaRestartPlayStorage(db)).toThrow();}finally{db.close();}
});

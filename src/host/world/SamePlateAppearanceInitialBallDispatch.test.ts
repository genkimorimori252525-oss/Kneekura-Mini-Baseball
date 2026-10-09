import { afterEach,expect,it,vi } from 'vitest';
import { dispatchOwnerFixture } from './SamePlateAppearanceDispatchOwner.test-support';
import { openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import * as initial from './SqliteSamePlateAppearanceInitialBallStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readSamePaInitialPitchLiveBindingFromSqlite } from './SamePlateAppearanceInitialPitchLiveBindingFromSqlite';
const fixtures: ReturnType<typeof dispatchOwnerFixture>[]=[]; const stores:{close():void}[]=[];
afterEach(()=>{stores.splice(0).forEach(s=>s.close());fixtures.splice(0).forEach(f=>f.close());vi.restoreAllMocks();});
/** Focused real dispatch adapter/storage test. Actor/model and initial-owner
 * readers are mocked by this small fixture; this is not Native qualification. */
it('executes and replays the existing canonical pitch consumer with its separate initial Play binding',()=>{
  const f=dispatchOwnerFixture();fixtures.push(f);
  const owner=openSqliteSamePlateAppearanceDispatchStore(f.path,{...f.authority,readAcceptedPhysicalPitch:id=>f.accepted.get(id)});stores.push(owner);
  const action=owner.acceptAction('action');if(action.kind!=='action_prepared')throw new Error('action pending');
  const cs=owner.acceptCalibrationSet(f.calibrations.map(s=>s.sourceId));if(cs.kind!=='execution_calibration_set')throw new Error('calibration pending');
  const actionReference=reference('pa_dispatch_v1_action_plans',action);
  f.accepted.set('consumers',{...f.base,sourceId:'consumers',capability:'same_pa_consumer_set_v1',actionReference,participantInputs:f.roles.map(role=>({member:role.member,
    calibrationReferences:cs.calibrations.filter(c=>c.source.member.playerId===role.member.playerId).map(c=>({route:c.source.route,calibrationReference:reference('pa_dispatch_v1_execution_calibrations',c)}))}))});
  const consumer=owner.acceptConsumerSet('consumers');if(consumer.kind!=='consumer_set_prepared')throw new Error('consumers pending');
  const consumerSetReference=reference('pa_dispatch_v1_consumer_sets',consumer);
  f.accepted.set('episode',{...f.base,sourceId:'episode',capability:'same_pa_first_pitch_episode_v1',actionReference,consumerSetReference});
  const episode=owner.acceptEpisode('episode');if(episode.kind!=='prospective_episode_prepared')throw new Error('episode pending');
  f.accepted.set('right',{...f.base,sourceId:'right',capability:'same_pa_first_pitch_right_v1',actionReference,consumerSetReference,episodeReference:reference('pa_dispatch_v1_episodes',episode),prefixReference:f.view.source.prefixReference});
  const right=owner.acceptRight('right');if(right.kind!=='immutable_right_prepared')throw new Error('right pending');
  const setup:any={source:{sourceId:'setup',actionReference,firstPhysicalPitchSourceId:f.source.firstPhysicalPitchSourceId,custody:{kind:'explicit_initial_secure_custody_v1',role:'tag_hand',ball:{tick:100,position:{x:.2,y:1.1,z:18},velocity:{x:0,y:0,z:0},spin:{x:0,y:0,z:0}}}},lineage:action.lineage};
  const play:any={source:{sourceId:'play',sourceVersion:'test-v1'},setupReference:reference('pa_initial_ball_v1_setups',setup),occurredAt:{originTick:100,elapsedSeconds:0,tick:100}};
  vi.spyOn(initial,'readSamePaInitialPlayFromSqlite').mockReturnValue({setup,play});
  f.accepted.set(f.source.firstPhysicalPitchSourceId,{sourceId:f.source.firstPhysicalPitchSourceId,sourceVersion:'test-v1',capability:'same_pa_physical_pitch_v2',
    actionReference,rightReference:reference('pa_dispatch_v1_rights',right),initialPlayReference:reference('pa_initial_ball_v1_plays',play)});
  const pitch=owner.acceptPhysicalPitch(f.source.firstPhysicalPitchSourceId);if(pitch.kind==='pending')throw new Error('pitch pending');
  expect(pitch.result.resolution.kind).toBe('recorded');expect(pitch.initialLiveBallBinding?.release).toEqual(pitch.result.delivery.release);
  expect(pitch.initialLiveBallBinding?.occurredAt).toEqual(play.occurredAt);
  const before=hash(f.db.prepare('SELECT * FROM pa_dispatch_v1_pitch_actions').all());
  f.accepted.clear();expect(owner.acceptPhysicalPitch(f.source.firstPhysicalPitchSourceId)).toEqual(pitch);
  expect(hash(f.db.prepare('SELECT * FROM pa_dispatch_v1_pitch_actions').all())).toBe(before);
  f.db.exec('BEGIN; PRAGMA query_only=1');try{
    const value=readSamePaInitialPitchLiveBindingFromSqlite(f.db,pitch.source.sourceId);expect(value?.release).toEqual(pitch.result.delivery.release);
  }finally{f.db.exec('PRAGMA query_only=0; ROLLBACK');}
});

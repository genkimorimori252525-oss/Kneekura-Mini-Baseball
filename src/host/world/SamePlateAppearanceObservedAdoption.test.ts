import { expect,it } from 'vitest';
import { mkdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { prepareSamePaSceneBodies } from './SamePlateAppearanceSceneBodies.test-support';
import { prepareSamePaInitialPlayFixture,samePaInitialPlayDefenders } from './SamePlateAppearanceInitialBallFixture.test-support';
import { readSamePaFirstPitchCalculation,openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import type { SamePaNativeObservedLaunchCalculation } from './SamePlateAppearanceDispatchExecution';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { rawCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { controlledHeldPitchFixture } from '../../core/sim/pitch/ControlledHeldPitchFixtures.test-support';
import type { ControlledHeldPitchAnchorsV1 } from '../../core/sim/pitch/ControlledHeldPitchV1';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import type { AcceptedSamePaObservedPhysicalPitch } from './SamePlateAppearanceDispatchSource';
const actualTables=['pa_dispatch_v1_consumer_actions','pa_dispatch_v1_pitch_actions','pa_dispatch_v1_pitch_heads','pa_dispatch_v1_consumptions','pa_dispatch_v1_episode_admissions'];

it('adopts the observed initial pitch once with real Native Play/custody/continuous hand control and five owned rows, without inventing a result',()=>{
  const f=directNativeDispatchFixture({originalDefenders:samePaInitialPlayDefenders(),profile:{ruleProfileId:NPB_2026_RULE_PROFILE.id}},
    {ticksPerSecond:1e6,integrationStepTicks:2000,gravityY:-9.81,aerodynamics:REFERENCE_BASEBALL_AERODYNAMICS});
  const sources=new Map<string,unknown>(),get=(id:string)=>sources.get(id),s=f.acceptedAction.source;
  const owner=openSqliteSamePlateAppearanceDispatchStore(f.path,{readAcceptedConsumerSet:get,readAcceptedEpisode:get,readAcceptedRight:get,readAcceptedPhysicalPitch:get});
  try{
    const sceneBodies=prepareSamePaSceneBodies(f);
    const initial=prepareSamePaInitialPlayFixture(f,sources,sceneBodies,{custodyRole:'tag_hand',
      venue:{pitcherPlate:{region:{center:{x:0,z:18},halfSize:{x:.4,z:.2},rotationRadians:0},surfaceHeightMeters:.95-.88},
        rulePolicy:{version:'closed_interior_venue_legal_regions_v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,rulesRevision:NPB_2026_RULE_PROFILE.rulesRevision,
          regions:[{regionId:'explicit-prototype-interior',classification:'inside_playable_region',minimum:{x:-100,y:-1,z:-5},maximum:{x:100,y:10,z:150}}]}},
      officialPerson:{sourceId:'observed:umpire-person',sourceVersion:'synthetic-v1',capability:'accepted_original_umpire_person_v1',careerId:f.actor.binding.careerId,
        officialId:'observed:plate-umpire',personId:'observed:person-umpire'},
      assignmentPolicy:{sourceId:'observed:play-policy',sourceVersion:'synthetic-v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,kind:'accepted_original_live_ball_action_v1'}},'observed');
    const roles=deriveSamePaDispatchRoles(f.actor,f.view),base={sourceVersion:'observed-test-v1',enrollmentReference:s.enrollmentReference,
      viewReference:s.viewReference,firstPhysicalPitchSourceId:s.firstPhysicalPitchSourceId};
    const cs={...base,sourceId:'observed:consumers',capability:'same_pa_consumer_set_v1',actionReference:f.request.actionReference,
      participantInputs:roles.map(role=>({member:role.member,calibrationReferences:role.routes.map(route=>({route,
        calibrationReference:reference('pa_dispatch_v1_execution_calibrations',f.acceptedCalibrations.calibrations.find(c=>c.source.member.playerId===role.member.playerId&&c.source.route===route)!)}))}))};
    sources.set(cs.sourceId,cs);const c=owner.acceptConsumerSet(cs.sourceId);if(c.kind!=='consumer_set_prepared')throw new Error('consumer pending');
    const es={...base,sourceId:'observed:episode',capability:'same_pa_first_pitch_episode_v1',actionReference:f.request.actionReference,consumerSetReference:reference('pa_dispatch_v1_consumer_sets',c)};
    sources.set(es.sourceId,es);const e=owner.acceptEpisode(es.sourceId);if(e.kind!=='prospective_episode_prepared')throw new Error('episode pending');
    const rs={...base,sourceId:'observed:right',capability:'same_pa_first_pitch_right_v1',actionReference:f.request.actionReference,consumerSetReference:es.consumerSetReference,
      episodeReference:reference('pa_dispatch_v1_episodes',e),prefixReference:f.view.source.prefixReference};
    sources.set(rs.sourceId,rs);const r=owner.acceptRight(rs.sourceId);if(r.kind!=='immutable_right_prepared')throw new Error('right pending');
    const planned=readSamePaFirstPitchCalculation(f.path,f.request) as SamePaNativeObservedLaunchCalculation;
    expect(planned.kind).toBe('native_observed_launch_calculation_only');
    const hand=initial.setup.primitives.find(p=>p.primitive.role==='tag_hand')!.primitive;
    const anchors:ControlledHeldPitchAnchorsV1={initialBall:initial.setup.source.custody.ball,initialHand:{position:hand.startCenter,velocity:hand.startVelocity},
      shoulder:{x:0,y:1.4,z:18},armReachM:.8,handRadiusM:hand.radius,ballRadiusM:initial.setup.ballRadiusMeters,release:planned.calculation.delivery.release,
      releaseAcceleration:{x:0,y:-9.81,z:0},followThroughEndTick:planned.calculation.delivery.timeline.followThroughEndUs,obstacles:[]};
    const declaration:AcceptedSamePaObservedPhysicalPitch={sourceId:s.firstPhysicalPitchSourceId,sourceVersion:'controlled-observed-test-v1',capability:'same_pa_observed_physical_pitch_v1',
      rightReference:reference('pa_dispatch_v1_rights',r),actionReference:f.request.actionReference,initialPlayReference:initial.initialPlayReference,custodyMotion:controlledHeldPitchFixture(anchors)};
    const broken=structuredClone(declaration) as any;broken.custodyMotion.held.at(-1).handCenter.z+=.01;sources.set(broken.sourceId,broken);
    const before=rawCensus(f.db);expect(()=>owner.acceptObservedPitch(broken.sourceId)).toThrow(/canonical release/);expect(rawCensus(f.db)).toEqual(before);
    sources.set(declaration.sourceId,declaration);const pitch=owner.acceptObservedPitch(declaration.sourceId);
    if(pitch.kind==='pending')throw new Error('observed adoption pending');
    expect(pitch.kind).toBe('same_pa_first_pitch_launched_v1');expect(pitch.result).not.toHaveProperty('resolution');
    expect(pitch.beforeTimeline.events).toEqual([]);expect(pitch.beforeTimeline.status).toEqual({kind:'active',count:{balls:0,strikes:0}});
    expect(pitch.initialLiveBallBinding.release).toEqual(planned.calculation.delivery.release);
    expect(pitch.result.trajectory.releaseOrientation).toEqual(pitch.initialLiveBallBinding.motion.releaseOrientation);
    expect(pitch.initialLiveBallBinding.motion.releaseContact.authority).toBe('CURRENT_OWNED_HOLDER_CONSTRAINT');
    expect(actualTables.map(t=>f.db.prepare('SELECT count(*) AS n FROM '+t).get()!.n)).toEqual([1,1,1,1,1]);
    const after=rawCensus(f.db);expect(after.filter(row=>!actualTables.includes(String(row.table)))).toEqual(before.filter(row=>!actualTables.includes(String(row.table))));
    owner.close();const reopened=openSqliteSamePlateAppearanceDispatchStore(f.path);
    try{expect(reopened.acceptObservedPitch(declaration.sourceId)).toEqual(pitch);}finally{reopened.close();}
    expect(rawCensus(f.db)).toEqual(after);
    const output=process.env.BASEBALL_OBSERVED_ADOPTION_EVIDENCE;
    if(output){mkdirSync(output,{recursive:false});f.db.prepare('VACUUM INTO ?').run(join(output,'launch.sqlite'));
      for(const [name,value]of Object.entries({declaration,expected:pitch,reference:reference('pa_dispatch_v1_pitch_actions',pitch)}))writeFileSync(join(output,name+'.json'),JSON.stringify(value),{flag:'wx'});}
  }finally{owner.close();f.close();}
},480_000);

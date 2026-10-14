import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { createPitchTrajectoryFromRelease } from '../../core/sim/pitch/CanonicalPitchRelease';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaOfficialSourceReference as originalRef } from './SamePlateAppearanceCatchCommunicationSource';
import { samePaInitialSetupInput, samePaInitialVenueInput, samePaInitialPlayInput, initialBallTables as tables } from './SamePlateAppearanceInitialBallSource';
import { deriveSamePaInitialSetup, deriveSamePaInitialPlay, bindSamePaInitialPlayToPitch } from './SamePlateAppearanceInitialBallProof';
import { assertSamePaInitialBallStorage, samePaInitialBallSchema } from './SamePlateAppearanceInitialBallStorage';
import { samePaDispatchSourceInput } from './SamePlateAppearanceDispatchSource';
const zero = { x:0,y:0,z:0 };
const ref = (owner:string,id=owner) => ({ owner,sourceId:id,sourceHash:hash(id),snapshotHash:hash(id) });
/** Pure owner-boundary fixtures: accepted physical measurements are explicit.
 * These small inputs do not qualify the historical Native artifact. */
const fixture = () => {
  const person = { sourceId:'pitcher-person',personId:'person-p',careerId:'career',playerId:'p' };
  const actor:any = { source:{ sourceId:'actor',gameId:'game' },binding:{careerId:'career',gameDay:2,fixtureEventId:'fixture'},
    defenderBindings:[{playerId:'p',personId:'person-p',personLinkSourceId:'pitcher-person'}],defenderPersons:[person],
    world:{tick:100,defenders:[{playerId:'p',registeredPosition:'P',position:{x:0,z:18},velocity:{x:0,z:0}}]},match:{playId:1,ruleProfileId:NPB_2026_RULE_PROFILE.id} };
  const lineage:any = { enrollmentReference:ref('same_pa_enrollments'),actorReference:ref('physical_plate_appearance_actors'),firstPhysicalPitchSourceId:'pitch',careerId:'career',gameId:'game',playId:1 };
  const action:any = { source:{ sourceId:'action',viewReference:ref('reserved_pa_execution_views'),batterModelReference:ref('world_player_batting_models'),pitcherPlayerId:'p',
    nominalPitch:{ delivery:{readyAtUs:100},batter:{ballRadiusMeters:.04} } },lineage };
  const body = { source:{sourceId:'body',playerId:'p',careerId:'career',atDay:2,role:'pitcher'},person,actor:{bodyOriginHeightMeters:1,
    primitives:[{role:'left_foot',radius:.1,offset:{x:-.1,y:-1,z:0}},{role:'right_foot',radius:.1,offset:{x:.1,y:-1,z:0}},
      {role:'body',radius:.2,offset:zero},{role:'glove',radius:.1,offset:{x:-.2,y:.1,z:0}},{role:'tag_hand',radius:.1,offset:{x:.2,y:.1,z:0}}] } };
  const posture:any = { kind:'batting_invocation_posture',physicalPitchSourceId:'pitch',lineage,
    source:{sourceId:'posture',capability:'owned_batting_invocation_posture_v1',viewReference:action.source.viewReference,actionReference:reference('pa_dispatch_v1_action_plans',action),
      modelReference:action.source.batterModelReference,geometry:{startedAtTick:100,ticksPerSecond:1_000_000,validUntilTick:20_000_000}},
    model:{equipment:{values:{ball:{radiusM:.04,massKg:.145}}}},sceneBodies:[body] };
  const venue = samePaInitialVenueInput({sourceId:'venue',sourceVersion:'test-v1',capability:'same_pa_initial_ball_venue_v1',careerId:'career',gameId:'game',playId:1,
    fixtureEventId:'fixture',venueId:'venue-id',availableAtDay:1,pitcherPlate:{region:{center:{x:0,z:18},halfSize:{x:.4,z:.2},rotationRadians:0},surfaceHeightMeters:0},
    rulePolicy:{version:'closed_interior_venue_legal_regions_v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,rulesRevision:NPB_2026_RULE_PROFILE.rulesRevision,
      regions:[{regionId:'inside',classification:'inside_playable_region',minimum:{x:-5,y:-1,z:10},maximum:{x:5,y:5,z:25}}]} });
  const source = samePaInitialSetupInput({sourceId:'setup',sourceVersion:'test-v1',capability:'same_pa_initial_ball_setup_v1',enrollmentReference:lineage.enrollmentReference,
    viewReference:action.source.viewReference,actionReference:reference('pa_dispatch_v1_action_plans',action),postureReference:reference('batting_observation_v1_postures',posture),
    venueReference:originalRef(venue),firstPhysicalPitchSourceId:'pitch',pitcherPlayerId:'p',custody:{kind:'explicit_initial_secure_custody_v1',role:'tag_hand',ball:{tick:100,position:{x:.2,y:1.1,z:18},velocity:zero,spin:zero}}});
  const derive = () => deriveSamePaInitialSetup(source,venue,actor,action,posture);
  const play = (setup:ReturnType<typeof derive>) => {
    const official:any = {sourceId:'person-u',sourceVersion:'test-v1',capability:'accepted_original_umpire_person_v1',careerId:'career',officialId:'umpire',personId:'person-u'};
    const assignment:any = {sourceId:'assignment',sourceVersion:'test-v1',capability:'same_pa_explicit_live_ball_assignment_v1',role:'plate_umpire',enrollmentReference:lineage.enrollmentReference,
      gameId:'game',playId:1,physicalPitchSourceId:'pitch',officialId:'umpire',personId:'person-u',personReference:originalRef(official),policy:{sourceId:'policy',sourceVersion:'test-v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,kind:'accepted_original_live_ball_action_v1'}};
    const source = samePaInitialPlayInput({sourceId:'play',sourceVersion:'test-v1',capability:'same_pa_initial_play_v1',setupReference:reference(tables.setup,setup),assignmentReference:originalRef(assignment),officialId:'umpire',personId:'person-u',declaration:'play'});
    return deriveSamePaInitialPlay(source,setup,{assignment,person:official});
  };
  return {source,venue,actor,action,posture,body,derive,play};
};
afterEach(() => vi.restoreAllMocks());
it('accepts explicit secure custody only with actual authenticated foot/plate contact and independent Play',() => {
  const f=fixture(),setup=f.derive(); expect(setup.footContacts).toHaveLength(2); expect(setup.custodyContact.tick).toBe(100);
  expect(setup).not.toHaveProperty('state'); const play=f.play(setup); expect(play.state).toBe('live'); expect(play.occurredAt).toEqual({originTick:100,elapsedSeconds:0,tick:100});
});
it.each(['airborne_feet','off_plate','wrong_person','moving_pitcher','foreign_venue','wrong_ball_clock','detached_ball'])( 'rejects original initial %s',kind => {
  const f=fixture();
  if(kind==='airborne_feet') f.body.actor.bodyOriginHeightMeters=2;
  if(kind==='off_plate') f.actor.world.defenders[0].position.x=4;
  if(kind==='wrong_person') f.actor.defenderBindings[0].personId='other';
  if(kind==='moving_pitcher') f.actor.world.defenders[0].velocity.x=1;
  if(kind==='foreign_venue') f.actor.binding.fixtureEventId='other';
  const source=structuredClone(f.source); if(kind==='wrong_ball_clock') (source.custody.ball as any).tick=101;
  if(kind==='detached_ball') (source.custody.ball.position as any).x=4;
  expect(()=>deriveSamePaInitialSetup(source,f.venue,f.actor,f.action,f.posture)).toThrow();
});
it('keeps original pre-pitch clock and exact executed release vectors under the existing canonical release abstraction',() => {
  const f=fixture(),setup=f.derive(),play=f.play(setup);
  const release={releaseAtUs:1_000_100,position:{x:1,y:1.6,z:17},velocity:{x:2,y:0,z:-30},spin:{x:0,y:100,z:0}};
  const delivery:any={timeline:{readyAtUs:100,releaseUs:release.releaseAtUs},release};
  const trajectory=createPitchTrajectoryFromRelease(release,zero,release.releaseAtUs+800_000);
  const input={sourceId:'pitch',actionReference:f.source.actionReference,playReference:reference(tables.play,play),delivery,trajectory};
  const bound=bindSamePaInitialPlayToPitch(play,setup,input);
  expect(bound.occurredAt).toEqual(play.occurredAt); expect(bound.release).toEqual(release); expect(bound.initialCustody.ball.position).not.toEqual(release.position);
  expect(()=>bindSamePaInitialPlayToPitch(play,setup,{...input,trajectory:{...trajectory,start:{...trajectory.start,velocity:zero}}})).toThrow();
  expect(()=>bindSamePaInitialPlayToPitch(play,setup,{...input,sourceId:'foreign'})).toThrow();
});
it('preserves exact old pitch source shape while requiring initial Play in v2',() => {
  const old={sourceId:'pitch',sourceVersion:'test-v1',capability:'same_pa_physical_pitch_v1',rightReference:ref('pa_dispatch_v1_rights'),actionReference:ref('pa_dispatch_v1_action_plans')};
  expect(samePaDispatchSourceInput(old)).toEqual(old);
  expect(()=>samePaDispatchSourceInput({...old,initialPlayReference:ref(tables.play)})).toThrow();
  expect(()=>samePaDispatchSourceInput({...old,capability:'same_pa_physical_pitch_v2'})).toThrow();
  expect(samePaDispatchSourceInput({...old,capability:'same_pa_physical_pitch_v2',initialPlayReference:ref(tables.play)}).capability).toBe('same_pa_physical_pitch_v2');
});
it('requires the complete exact two-table namespace and rejects shadowing',() => {
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db=new DatabaseSync(':memory:');
  try { expect(assertSamePaInitialBallStorage(db)).toBe(false); db.exec(samePaInitialBallSchema[tables.setup]); expect(()=>assertSamePaInitialBallStorage(db)).toThrow();
    db.exec(samePaInitialBallSchema[tables.play]); expect(assertSamePaInitialBallStorage(db)).toBe(true);
    db.exec('CREATE TEMP TABLE '+tables.setup+'(x)'); expect(()=>assertSamePaInitialBallStorage(db)).toThrow(); } finally {db.close();}
});

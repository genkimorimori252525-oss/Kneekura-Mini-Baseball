import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaOfficialSourceReference as originalRef } from './SamePlateAppearanceCatchCommunicationSource';
import { samePaInitialVenueInput } from './SamePlateAppearanceInitialBallSource';
import { samePaRestartPlayInput } from './SamePlateAppearanceRestartPlaySource';
import { deriveSamePaRestartPlay } from './SamePlateAppearanceRestartPlayProof';
const zero={x:0,y:0,z:0},ref=(owner:string,id=owner)=>({owner,sourceId:id,sourceHash:hash(id),snapshotHash:hash(id)}) as any;
/** Explicit small owner-boundary inputs. These tests do not certify a long
 * historical Native fixture or invent the prior flight/controller history. */
export const restartFixture=()=>{
  const person={sourceId:'pitcher-person',personId:'person-p',careerId:'career',playerId:'p'};
  const world:any={tick:100,ball:null,runners:[],defenders:[{playerId:'p',registeredPosition:'P',position:{x:0,z:18},velocity:{x:0,z:0}}]};
  const actor:any={source:{sourceId:'actor',gameId:'game'},binding:{careerId:'career',gameDay:2,fixtureEventId:'fixture'},world:{...world,tick:0},
    defenderBindings:[{playerId:'p',personId:'person-p',personLinkSourceId:'pitcher-person'}],defenderPersons:[person],match:{playId:1,ruleProfileId:NPB_2026_RULE_PROFILE.id}};
  const lineage:any={enrollmentReference:ref('same_pa_enrollments'),actorReference:ref('physical_plate_appearance_actors'),firstPhysicalPitchSourceId:'old-pitch',careerId:'career',gameId:'game',playId:1};
  const reset:any={kind:'same_pa_lifecycle_reset',source:{sourceId:'reset',sourceVersion:'test-v1',outcomeReference:ref('pa_lifecycle_v1_outcomes')},lineage,
    resetWorld:world,timeline:{status:{kind:'active'}},retirement:{atTick:100,basis:{completedAtTick:90}}};
  const resetReference=reference('pa_lifecycle_v1_resets',reset),bodyCut:any={origin:'foul_reset',worldReference:resetReference,originalWorld:world,originalWorldHash:hash(world),completedAtTick:100};
  const view:any={kind:'same_pa_lifecycle_view',source:{sourceId:'view',sourceVersion:'test-v1',prefixReference:ref('pa_lifecycle_v1_work_prefixes')},lineage,coverageHash:hash('coverage'),
    cut:{stage:'foul_reset_ready',evaluationTick:100,pitchOrdinal:3,physicalWorld:world,bodyCut,outcomeReference:reset.source.outcomeReference,resetReference,timeline:reset.timeline}};
  const viewReference=reference('pa_lifecycle_v1_execution_views',view);
  const action:any={source:{sourceId:'action',sourceVersion:'test-v1',viewReference,batterModelReference:ref('world_player_batting_models'),nominalPitch:{delivery:{readyAtUs:100},batter:{ballRadiusMeters:.04}}},
    lineage,physicalWorld:world,bodyCut,physicalPitchSourceId:'next-pitch',pitchOrdinal:4};
  const body:any={source:{sourceId:'body',playerId:'p',careerId:'career',atDay:2,role:'pitcher'},person,actor:{bodyOriginHeightMeters:1,
    primitives:[{role:'left_foot',radius:.1,offset:{x:-.1,y:-1,z:0}},{role:'right_foot',radius:.1,offset:{x:.1,y:-1,z:0}},
      {role:'body',radius:.2,offset:zero},{role:'glove',radius:.1,offset:{x:-.2,y:.1,z:0}},{role:'tag_hand',radius:.1,offset:{x:.2,y:.1,z:0}}]}};
  const posture:any={kind:'batting_invocation_posture',physicalPitchSourceId:'next-pitch',lineage,source:{sourceId:'posture',sourceVersion:'test-v1',capability:'owned_in_flight_batting_posture_v1',
    viewReference,actionReference:reference('pa_physical_v1_action_plans',action),modelReference:action.source.batterModelReference,
    geometry:{startedAtTick:100,ticksPerSecond:1_000_000,validUntilTick:20_000_000}},model:{equipment:{values:{ball:{radiusM:.04,massKg:.145}}}},sceneBodies:[body]};
  const venue=samePaInitialVenueInput({sourceId:'venue',sourceVersion:'test-v1',capability:'same_pa_initial_ball_venue_v1',careerId:'career',gameId:'game',playId:1,
    fixtureEventId:'fixture',venueId:'venue-id',availableAtDay:1,pitcherPlate:{region:{center:{x:0,z:18},halfSize:{x:.4,z:.2},rotationRadians:0},surfaceHeightMeters:0},
    rulePolicy:{version:'closed_interior_venue_legal_regions_v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,rulesRevision:NPB_2026_RULE_PROFILE.rulesRevision,
      regions:[{regionId:'inside',classification:'inside_playable_region',minimum:{x:-5,y:-1,z:10},maximum:{x:5,y:5,z:25}}]}});
  const official:any={sourceId:'person-u',sourceVersion:'test-v1',capability:'accepted_original_umpire_person_v1',careerId:'career',officialId:'u',personId:'person-u'};
  const assignment:any={sourceId:'assignment',sourceVersion:'test-v1',capability:'same_pa_explicit_live_ball_assignment_v1',role:'plate_umpire',enrollmentReference:lineage.enrollmentReference,
    gameId:'game',playId:1,physicalPitchSourceId:'next-pitch',officialId:'u',personId:'person-u',personReference:originalRef(official),policy:{sourceId:'policy',sourceVersion:'test-v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,kind:'accepted_original_live_ball_action_v1'}};
  const source=samePaRestartPlayInput({sourceId:'restart',sourceVersion:'test-v1',capability:'same_pa_foul_restart_play_v1',enrollmentReference:lineage.enrollmentReference,viewReference,resetReference,
    actionReference:reference('pa_physical_v1_action_plans',action),postureReference:reference('batting_observation_v1_postures',posture),physicalPitchSourceId:'next-pitch',
    venueReference:originalRef(venue),pitcherPlayerId:'p',custody:{kind:'explicit_reset_secure_custody_v1',role:'tag_hand',ball:{tick:100,position:{x:.2,y:1.1,z:18},velocity:zero,spin:zero}},
    assignmentReference:originalRef(assignment),officialId:'u',personId:'person-u',declaration:'play'});
  const b:any={actor,view},originals={venue,assignment,person:official};
  const derive=()=>deriveSamePaRestartPlay(source,originals,b,reset,action,posture);
  return{source,originals,b,reset,action,posture,body,derive};
};

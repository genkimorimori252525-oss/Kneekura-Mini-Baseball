import type { DatabaseSync } from 'node:sqlite';
import { composeDefenderPhysicalPrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { findBallWorldFootBaseContact } from '../../core/sim/ball/BallWorldFootBaseContact';
import { findMovingSphereContactTime } from '../../core/sim/collision/MovingSphereContact';
import { deriveBallWorldVenueLegalCoverage } from '../../core/rules/BallWorldVenueLegalCoverage';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaLifecycleResetFromSqlite } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import type { SamePaLifecycleReset } from './SamePlateAppearanceLifecycleOutcome';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import { readSamePaPhysicalActionFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import type { SamePaPhysicalAction, SamePaPhysicalLaunch, SamePaPhysicalRight } from './SamePlateAppearancePhysicalEpisode';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import type { DurableBattingInvocationPosture } from './NativeBattingPerception';
import { samePaInitialVenueInput, type AcceptedSamePaInitialVenue } from './SamePlateAppearanceInitialBallSource';
import { samePaLiveBallAssignmentInput, type SamePaLiveBallOriginals } from './SamePlateAppearanceLiveBallStateSource';
import { samePaOfficialPersonInput, assertSamePaAcceptedOfficialSource } from './SamePlateAppearanceCatchCommunicationSource';
import { assertNoSamePaCatchReviewSeal } from './SamePlateAppearanceCatchReviewSeal';
import { samePaRestartPlayTable as table, type AcceptedSamePaRestartPlay } from './SamePlateAppearanceRestartPlaySource';
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('restart Play original ownership or physical cut differs');};
const zero=Object.freeze({x:0,y:0,z:0});
export type SamePaRestartPlayOriginals = SamePaLiveBallOriginals & Readonly<{venue:AcceptedSamePaInitialVenue}>;
export const samePaRestartPlayOriginalsInput=(source:AcceptedSamePaRestartPlay,raw:SamePaRestartPlayOriginals)=>{
  const venue=samePaInitialVenueInput(raw.venue),assignment=samePaLiveBallAssignmentInput(raw.assignment,source.assignmentReference.sourceId);
  const person=samePaOfficialPersonInput(raw.person,assignment.personReference.sourceId);
  assertSamePaAcceptedOfficialSource(venue,source.venueReference);assertSamePaAcceptedOfficialSource(assignment,source.assignmentReference);
  assertSamePaAcceptedOfficialSource(person,assignment.personReference);return freeze({venue,assignment,person});
};
/** Rule-system reset supplies the discontinuous world. This proves one original
 * stationary instant only; it never adds a return throw or hand-to-release path. */
export const deriveSamePaRestartPlay=(source:AcceptedSamePaRestartPlay,raw:SamePaRestartPlayOriginals,b:SamePaLifecycleViewBasis,
  reset:SamePaLifecycleReset,action:SamePaPhysicalAction,posture:DurableBattingInvocationPosture)=>{
  const originalInputs=samePaRestartPlayOriginalsInput(source,raw),{venue,assignment,person}=originalInputs;
  const {actor,view}=b,c=view.cut,at=c.evaluationTick,world=reset.resetWorld;
  same(source.enrollmentReference,view.lineage.enrollmentReference);same(source.viewReference,reference('pa_lifecycle_v1_execution_views',view));
  same(source.resetReference,reference('pa_lifecycle_v1_resets',reset));same(c.resetReference,source.resetReference);
  same(c.outcomeReference,reset.source.outcomeReference);same(c.physicalWorld,world);same(c.bodyCut.worldReference,source.resetReference);
  same(c.bodyCut.originalWorld,world);same(c.bodyCut.originalWorldHash,hash(world));same(reset.lineage,view.lineage);same(action.lineage,view.lineage);same(posture.lineage,view.lineage);
  same(source.actionReference,reference('pa_physical_v1_action_plans',action));same(source.postureReference,reference('batting_observation_v1_postures',posture));
  same(action.source.viewReference,source.viewReference);same(action.bodyCut,c.bodyCut);same(action.physicalWorld,world);
  same(posture.source.viewReference,source.viewReference);same(posture.source.actionReference,source.actionReference);same(posture.source.modelReference,action.source.batterModelReference);
  same(assignment.enrollmentReference,source.enrollmentReference);
  if(c.stage!=='foul_reset_ready'||c.timeline.status.kind!=='active'||reset.timeline.status.kind!=='active'||world.tick!==at||c.bodyCut.completedAtTick!==at
    ||c.bodyCut.origin!=='foul_reset'||reset.retirement.atTick!==at||reset.retirement.basis.completedAtTick>at
    ||posture.source.capability!=='owned_in_flight_batting_posture_v1'||posture.physicalPitchSourceId!==source.physicalPitchSourceId
    ||action.physicalPitchSourceId!==source.physicalPitchSourceId||action.pitchOrdinal!==c.pitchOrdinal+1
    ||posture.source.geometry.startedAtTick!==at||posture.source.geometry.ticksPerSecond!==1_000_000||posture.source.geometry.validUntilTick<at
    ||action.source.nominalPitch.delivery.readyAtUs<at||source.custody.ball.tick!==at
    ||assignment.gameId!==view.lineage.gameId||assignment.playId!==view.lineage.playId||assignment.physicalPitchSourceId!==source.physicalPitchSourceId
    ||assignment.officialId!==source.officialId||assignment.personId!==source.personId||person.officialId!==source.officialId||person.personId!==source.personId
    ||person.careerId!==view.lineage.careerId||assignment.policy.ruleProfileId!==actor.match.ruleProfileId
    ||venue.careerId!==actor.binding.careerId||venue.gameId!==view.lineage.gameId||venue.playId!==view.lineage.playId
    ||venue.fixtureEventId!==actor.binding.fixtureEventId||venue.availableAtDay>actor.binding.gameDay||venue.rulePolicy.ruleProfileId!==actor.match.ruleProfileId)
    throw new Error('restart Play requires exact original foul reset, next pitch and plate umpire');
  const pitchers=world.defenders.filter(d=>d.registeredPosition==='P'),pitcher=pitchers[0];
  const binding=actor.defenderBindings.find(d=>d.playerId===source.pitcherPlayerId),pitcherPerson=actor.defenderPersons.find(p=>p.playerId===source.pitcherPlayerId);
  const bodies=posture.sceneBodies.filter(b=>b.source.playerId===source.pitcherPlayerId),body=bodies[0];
  if(pitchers.length!==1||pitcher.playerId!==source.pitcherPlayerId||pitcher.velocity.x!==0||pitcher.velocity.z!==0||!binding||!pitcherPerson||bodies.length!==1
    ||body.source.role!=='pitcher'||body.source.careerId!==actor.binding.careerId||body.source.atDay>actor.binding.gameDay
    ||body.person.personId!==binding.personId||body.person.sourceId!==binding.personLinkSourceId)throw new Error('restart Play original pitcher body differs');
  same(body.person,pitcherPerson);
  const ball=source.custody.ball,equipment=posture.model.equipment.values.ball;
  if(!(equipment.radiusM>0)||!(equipment.massKg>0)||equipment.radiusM!==action.source.nominalPitch.batter.ballRadiusMeters)throw new Error('restart Play original ball equipment differs');
  if(world.ball!==null&&world.ball!==undefined)same(world.ball,{position:ball.position,velocity:ball.velocity,spin:ball.spin});
  const clock={startTick:at,endTick:at,ticksPerSecond:1_000_000};
  const primitives=body.actor.primitives.map(shape=>({playerId:pitcher.playerId,primitive:composeDefenderPhysicalPrimitiveSegment({ ...clock,
    startPosition:{x:pitcher.position.x,y:body.actor.bodyOriginHeightMeters,z:pitcher.position.z},startVelocity:zero,acceleration:zero},
    {...clock,role:shape.role,radius:shape.radius,startOffset:shape.offset,offsetVelocity:zero,offsetAcceleration:zero})}));
  const feet=primitives.filter(a=>a.primitive.role==='left_foot'||a.primitive.role==='right_foot');
  if(feet.length!==2||new Set(feet.map(a=>a.primitive.role)).size!==2)throw new Error('restart Play original pitcher feet missing');
  const footContacts=feet.map(actor=>findBallWorldFootBaseContact({actor,originTick:at,searchStartElapsedSeconds:0,searchEndElapsedSeconds:0,
    base:venue.pitcherPlate.region,baseSurfaceHeightMeters:venue.pitcherPlate.surfaceHeightMeters})).filter(v=>v!==null);
  if(!footContacts.length)throw new Error('restart Play actual pitcher plate contact missing');
  const holders=primitives.filter(a=>a.primitive.role===source.custody.role);if(holders.length!==1)throw new Error('restart Play original custody primitive missing');
  const p=holders[0].primitive,custodyContact=findMovingSphereContactTime({tick:at,center:ball.position,velocity:ball.velocity,radius:equipment.radiusM},
    {tick:at,center:p.startCenter,velocity:p.startVelocity,radius:p.radius},0,{ticksPerSecond:1_000_000});
  if(!custodyContact)throw new Error('restart Play custody has no actual body contact');
  const legalAt=(position:typeof ball.position,radius:number)=>{const moment={originTick:at,elapsedSeconds:0,ball:{tick:at,position,velocity:zero,spin:zero}};
    return deriveBallWorldVenueLegalCoverage({policy:venue.rulePolicy,originTick:at,ticksPerSecond:1_000_000,ballRadiusMeters:radius,
      segments:[{startElapsedSeconds:0,endElapsedSeconds:0,basis:moment,endpoint:moment,acceleration:zero}]});};
  const legalCoverage=[legalAt(ball.position,equipment.radiusM),...primitives.filter(a=>['body','left_foot','right_foot'].includes(a.primitive.role)).map(a=>legalAt(a.primitive.startCenter,a.primitive.radius))];
  if(legalCoverage.length!==4||legalCoverage.some(v=>v.intervals[0].end.classification!=='inside_playable_region'))throw new Error('restart Play original pitcher or ball playable interior missing');
  return freeze({kind:'same_pa_foul_restart_play_v1' as const,source,lineage:view.lineage,originalInputs,state:'live' as const,
    occurredAt:{originTick:at,elapsedSeconds:0,tick:at},resetHash:hash(reset),resetReference:source.resetReference,
    prefixReference:view.source.prefixReference,prefixCoverageHash:view.coverageHash,physicalPitchSourceId:source.physicalPitchSourceId,
    bodyReference:reference('world_player_body_materializations',body),worldHash:hash(world),pitcherPerson,
    equipmentHash:hash(posture.model.equipment),ballRadiusMeters:equipment.radiusM,ballMassKg:equipment.massKg,primitives,footContacts,custodyContact,legalCoverage});
};
export type SamePaRestartPlay=ReturnType<typeof deriveSamePaRestartPlay>;
export const deriveSamePaRestartPlayFromSqlite=(db:DatabaseSync,source:AcceptedSamePaRestartPlay,raw:SamePaRestartPlayOriginals,current:boolean)=>{
  const b=(current?readCurrentSamePaLifecycleViewFromSqlite:readHistoricalSamePaLifecycleViewFromSqlite)(db,source.viewReference);
  if(current)assertNoSamePaCatchReviewSeal(db,b.view.lineage.gameId,b.view.lineage.playId);
  const reset=readSamePaLifecycleResetFromSqlite(db,source.resetReference),action=readSamePaPhysicalActionFromSqlite(db,source.actionReference);
  const posture=readBattingPerceptionFromSqlite(db,'posture',source.postureReference);if(posture.kind!=='batting_invocation_posture')throw new Error('restart Play original posture missing');
  const prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',b.view.source.prefixReference.sourceId);
  if(!prefix||prefix.kind!=='same_pa_lifecycle_prefix')throw new Error('restart Play complete reset journal missing');
  same(reference('pa_lifecycle_v1_work_prefixes',prefix),b.view.source.prefixReference);same(prefix.source.eventReferences.at(-1),source.resetReference);
  const value=deriveSamePaRestartPlay(source,raw,b,reset,action,posture);
  const fixture=db.prepare('SELECT * FROM main.official_fixtures WHERE game_id=?').get(b.actor.source.gameId);
  if(!fixture||hash(fixture)!==b.actor.fixtureHash||fixture.venue_id!==value.originalInputs.venue.venueId||fixture.fixture_event_id!==value.originalInputs.venue.fixtureEventId)
    throw new Error('restart Play original fixture differs');
  return value;
};
/** The actual launch and its owned right choose the action/posture. This only
 * binds the prior accepted Play; its occurrence never moves to release time. */
export const bindSamePaRestartPlayToPitch=(play:SamePaRestartPlay,launch:SamePaPhysicalLaunch,right:SamePaPhysicalRight)=>{
  same(play.lineage,launch.lineage);same(right.lineage,play.lineage);same(launch.source.actionReference,play.source.actionReference);
  same(launch.source.viewReference,play.source.viewReference);same(launch.source.rightReference,reference('pa_physical_v1_rights',right));
  same(right.source.actionReference,play.source.actionReference);same(right.source.postureReference,play.source.postureReference);
  const {release,timeline}=launch.delivery;
  if(launch.source.sourceId!==play.physicalPitchSourceId||timeline.readyAtUs<play.occurredAt.tick||release.releaseAtUs!==timeline.releaseUs
    ||release.releaseAtUs<play.occurredAt.tick||launch.trajectory.parameters.ticksPerSecond!==1_000_000||launch.trajectory.start.tick!==release.releaseAtUs)
    throw new Error('restart Play canonical pitch scope or clock differs');
  same(launch.trajectory.start.position,release.position);same(launch.trajectory.start.velocity,release.velocity);same(launch.trajectory.start.spin,release.spin);
  return freeze({kind:'same_pa_restart_pitch_live_binding_v1' as const,playReference:reference(table,play),playDeclaration:{...reference(table,play),sourceVersion:play.source.sourceVersion},resetReference:play.resetReference,
    occurredAt:play.occurredAt,custody:play.source.custody,physicalPitchReference:reference('pa_physical_v1_launches',launch),
    actionReference:play.source.actionReference,postureReference:play.source.postureReference,release,trajectoryHash:hash(launch.trajectory)});
};

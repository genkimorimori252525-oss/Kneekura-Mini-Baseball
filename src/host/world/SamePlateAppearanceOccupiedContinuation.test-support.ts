import { expect } from 'vitest';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { completeSamePaTerminalFixture } from './SamePlateAppearanceTerminalLifecycleFixture.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { ref } from './NativeBattingModelStanceFixtures.test-support';
import { openSqlitePlayerBodyCapabilityMaterializationStore } from './SqlitePlayerBodyCapabilityMaterializationStore';
import { openSqlitePlayerBattingModelStore } from './SqlitePlayerBattingModelStore';
import { openSqlitePlayerRunnerDecisionMotionModelStore, type AcceptedPlayerRunnerDecisionMotionModel } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import { openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import { openSqliteSamePlateAppearanceOccupiedRunnerHoldStore } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { input as runnerFixture } from './PrePitchRunnerFixtures.test-support';
import type { AcceptedBodySource, AcceptedPoseSource, BodyMaterializationRequest } from './PlayerBodyCapabilityMaterialization';
import type { AcceptedPlayerBattingModelV1 } from './PlayerBattingModel';
import type { AcceptedSamePaOccupiedRunnerHold } from './SamePlateAppearanceOccupiedRunnerHold';
import type { AcceptedSamePaFirstPitchAction } from './SamePlateAppearanceDispatchSource';

/** One extension of PL01's genuinely completed walk. Every new numerical value
 * is a separately accepted synthetic Source using the existing body/batting,
 * runner and dispatch recipes. No archive, state, pitch or count is transplanted.
 * This helper is authored for the parent's single combined Native run. */
export const continueSamePaOccupiedWalkFixture = (h: ReturnType<typeof samePaPhysicalLifecycleFixture>,
  completed: ReturnType<typeof completeSamePaTerminalFixture>, label: string) => {
  const { f } = h, { db, path } = f, track = f.x.f.track;
  if (!('activation' in completed.transition.official)) throw new Error('occupied fixture needs the real continuing transition');
  const activation = completed.transition.official.activation;
  expect(completed.endpoint.timeline.status.kind).toBe('walk');
  expect(activation.nextMatchState.bases).toEqual({first:f.actor.binding.playerId,second:null,third:null});
  // away-2 is the separately registered next batter in this existing fixture.
  // Its actual Match and World come only from the completed application.
  const nextBinding = f.x.f.participation.readPregameBinding(f.actor.source.gameId,'away-2');
  if (!nextBinding) throw new Error('occupied fixture next original batting participant missing');
  const actorSource = {sourceId:label+':actor',sourceVersion:'fixture-only-v1',gameId:f.actor.source.gameId,
    playerId:nextBinding.playerId,activationApplicationId:completed.transition.source.applicationId};
  f.x.accepted.set(actorSource.sourceId,actorSource);
  const actor = f.x.actors.accept(actorSource.sourceId), originals = readSamePaOriginalParticipants(db,actor);
  expect(actor.match).toEqual(activation.nextMatchState);
  expect(actor.world).toEqual(completed.transition.official.nextWorld);
  expect(actor.binding).toEqual(nextBinding); expect(originals).toHaveLength(11);
  expect(actor.world.runners).toEqual([{playerId:f.actor.binding.playerId,position:completed.endpoint.baseCenters.first,velocity:{x:0,z:0}}]);
  expect(originals.find(p=>p.role==='runner')).toMatchObject({binding:f.actor.binding,person:f.actor.person,startingBase:1});
  const officialBefore = json(db.prepare('SELECT * FROM matches WHERE match_id=?').get(actor.source.gameId));
  const accepted = new Map<string,unknown>();
  const save = <T extends {sourceId:string}>(source:T):T => {accepted.set(source.sourceId,source);return source;};

  // Fresh next-batter measurements/parameters reuse only the explicit synthetic
  // numerical recipe. Each Source belongs to this batter's original Person.
  const scope = {careerId:actor.person.careerId,playerId:actor.person.playerId,personId:actor.person.personId,personLinkSourceId:actor.person.sourceId};
  const common = {...scope,acceptedAtDay:actor.binding.gameDay};
  const body:AcceptedBodySource = {...f.body,...common,sourceId:label+':batter-body',sourceVersion:'fixture-only-v1'};
  const pose:AcceptedPoseSource = {...f.pose,...common,sourceId:label+':batter-pose',sourceVersion:'fixture-only-v1',bodyRef:ref(body)};
  const bodySource:BodyMaterializationRequest = {...scope,sourceId:label+':batter-body-composition',sourceVersion:'fixture-only-v1',atDay:actor.binding.gameDay,
    role:'batter',bodyRef:ref(body),poseRef:ref(pose),reachCalibrationRef:ref(f.reach),fieldingModelRef:null,releaseGeometryRef:null};
  const bodyOwner = track(openSqlitePlayerBodyCapabilityMaterializationStore(path,{
    readAcceptedMaterialization:id=>id===bodySource.sourceId?bodySource:null,readAcceptedBody:id=>id===body.sourceId?body:null,
    readAcceptedPose:id=>id===pose.sourceId?pose:null,readAcceptedReachCalibration:id=>id===f.reach.sourceId?f.reach:null,
  }));
  const bodyResult = bodyOwner.accept(bodySource.sourceId);
  if (bodyResult.kind!=='materialized') throw new Error('occupied fixture next batter body pending');
  const capability = {...f.capability,...common,sourceId:label+':batter-capability',sourceVersion:'fixture-only-v1'};
  const repertoire = {...f.repertoire,...common,sourceId:label+':batter-repertoire',sourceVersion:'fixture-only-v1'};
  const decision = {...f.decision,...common,sourceId:label+':batter-decision',sourceVersion:'fixture-only-v1'};
  const equipment = {...f.equipment,...common,sourceId:label+':batter-equipment',sourceVersion:'fixture-only-v1'};
  const observation = {...f.observation,...common,sourceId:label+':batter-observation',sourceVersion:'fixture-only-v1'};
  const prediction = {...f.prediction,...common,sourceId:label+':batter-prediction',sourceVersion:'fixture-only-v1'};
  const modelSource:AcceptedPlayerBattingModelV1 = {...common,sourceId:label+':batter-model',sourceVersion:'fixture-only-v1',
    bodyMaterializationRef:ref(bodySource),bodyRef:ref(body),poseRef:ref(pose),capabilityRef:ref(capability),repertoireRef:ref(repertoire),
    decisionModelRef:ref(decision),equipmentRef:ref(equipment),observationCalibrationRef:ref(observation),predictionCalibrationRef:ref(prediction)};
  const batting = track(openSqlitePlayerBattingModelStore(path,{
    readAcceptedModel:id=>id===modelSource.sourceId?modelSource:null,readAcceptedCapability:id=>id===capability.sourceId?capability:null,
    readAcceptedRepertoire:id=>id===repertoire.sourceId?repertoire:null,readAcceptedDecisionModel:id=>id===decision.sourceId?decision:null,
    readAcceptedEquipment:id=>id===equipment.sourceId?equipment:null,readAcceptedObservationCalibration:id=>id===observation.sourceId?observation:null,
    readAcceptedPredictionCalibration:id=>id===prediction.sourceId?prediction:null,
  })).accept(modelSource.sourceId);
  expect(batting.person).toEqual(actor.person); expect(batting.bodyMaterialization).toEqual(bodyResult.value);

  // The walked runner keeps its own original body/pose/reach and receives a
  // distinct runner-role composition. No next-batter body is reused for it.
  const runnerBinding = f.actor.binding;
  const runnerBodySource:BodyMaterializationRequest = {...f.scope,sourceId:label+':runner-body-composition',sourceVersion:'fixture-only-v1',
    atDay:actor.binding.gameDay,role:'runner',bodyRef:ref(f.body),poseRef:ref(f.pose),reachCalibrationRef:ref(f.reach),fieldingModelRef:null,releaseGeometryRef:null};
  f.requests.set(runnerBodySource.sourceId,runnerBodySource);
  const runnerBody = f.materializations.accept(runnerBodySource.sourceId);
  if (runnerBody.kind!=='materialized') throw new Error('occupied fixture original runner body pending');
  expect(runnerBody.value.person).toEqual(f.actor.person); expect(runnerBody.value.body).toEqual(f.body); expect(runnerBody.value.pose).toEqual(f.pose);
  const runnerModelSource:AcceptedPlayerRunnerDecisionMotionModel = {sourceId:label+':runner-model',sourceVersion:'explicit-existing-core-fixture-v1',
    capability:'runner_decision_motion_v1',careerId:runnerBinding.careerId,playerId:runnerBinding.playerId,personLinkSourceId:runnerBinding.personLinkSourceId,
    acceptedAtDay:runnerBinding.gameDay,decision:{minimumCueConfidence:0.5,coachTrust:1,minimumAdvanceSafetyMarginTicks:50_000,decisionAbility:0.8,
      timingParameters:{minimumDecisionDelayTicks:30_000,maximumDecisionDelayTicks:180_000,fixedRecognitionOffsetTicks:10_000}},motion:runnerFixture().parameters};
  const runnerModel = track(openSqlitePlayerRunnerDecisionMotionModelStore(path,{readAcceptedModel:id=>id===runnerModelSource.sourceId?runnerModelSource:null})).accept(runnerModelSource.sourceId);
  expect(runnerModel.person).toEqual(f.actor.person);

  // The ten prior participants retain their real settled AFTER. Only the new
  // batter may need a baseline, using the existing explicit fixture policy.
  for (const p of completed.settled.participants) expect(readActualRoleWorkloadState(db,actor.binding.careerId,p.playerId)).toEqual(p.projectedState);
  if (!readActualRoleWorkloadState(db,actor.binding.careerId,actor.binding.playerId,undefined,actor.binding.personLinkSourceId)) {
    const baseline = {...f.x.f.baseline,sourceId:label+':new-batter-baseline',playerId:actor.binding.playerId,personLinkSourceId:actor.binding.personLinkSourceId};
    track(openSqlitePlayerWorkloadRecoveryStore(path,f.x.f.links,{readAcceptedBaseline:id=>id===baseline.sourceId?baseline:null,readAcceptedActivity:()=>null})).initialize(baseline.sourceId);
  }
  const enrollmentSource = save({sourceId:label+':enrollment',sourceVersion:'fixture-only-v1',capability:'reserved_same_pa_enrollment_v2' as const,
    actorReference:reference('physical_plate_appearance_actors',actor),firstPhysicalPitchSourceId:label+':pitch',executionBasis:'reserved_cumulative_actual_role_total_v1' as const,
    participantBaselineReferences:originals.map(({binding:b})=>{
      const state=readActualRoleWorkloadState(db,b.careerId,b.playerId,undefined,b.personLinkSourceId);
      const baseline=db.prepare('SELECT source_id FROM world_player_workload_baselines WHERE career_id=? AND player_id=?').get(b.careerId,b.playerId);
      if(!state||!baseline)throw new Error('occupied fixture actual participant baseline missing');
      return{playerId:b.playerId,baselineSourceId:String(baseline.source_id),revision:state.revision,stateHash:hash(state)};
    })});
  const enrollment = track(openSqliteSamePlateAppearanceEnrollmentStore(path,{readAcceptedEnrollment:id=>accepted.get(id)})).accept(enrollmentSource.sourceId);
  if(enrollment.kind!=='reserved')throw new Error('occupied fixture enrollment pending');
  expect(enrollment.participants).toHaveLength(11);
  const execution = track(openSqliteSamePlateAppearanceExecutionStore(path,{readAcceptedPrefix:id=>accepted.get(id),readAcceptedTotal:id=>accepted.get(id),readAcceptedView:id=>accepted.get(id)}));
  const prefixSource = save({sourceId:label+':prefix',sourceVersion:'fixture-only-v1',capability:'reserved_same_pa_empty_prefix_v1',enrollmentReference:reference('same_pa_enrollments',enrollment)});
  const prefix = execution.acceptPrefix(prefixSource.sourceId); if(prefix.kind!=='empty_prefix')throw new Error('occupied fixture initial prefix pending');
  const totals=prefix.lineage.participantReferences.map(participantReference=>save({sourceId:label+':total:'+participantReference.playerId,sourceVersion:'fixture-only-v1',
    capability:'reserved_same_pa_cumulative_total_v1',enrollmentReference:prefixSource.enrollmentReference,prefixReference:reference('reserved_pa_work_prefixes',prefix),
    participantReference,effortUnits:0,provenance:{assessmentSourceId:label+':zero-assessment:'+participantReference.playerId,assessmentVersion:'fixture-only-v1',
      calibrationSourceId:label+':explicit-empty-total-declaration',calibrationVersion:'fixture-only-zero-total-v1'}}));
  const totalSet=execution.acceptTotalSet(totals.map(s=>s.sourceId));if(totalSet.kind!=='total_set')throw new Error('occupied fixture complete zero TOTALs pending');
  const viewSource=save({sourceId:label+':view',sourceVersion:'fixture-only-v1',capability:'reserved_same_pa_cumulative_view_v1',enrollmentReference:prefixSource.enrollmentReference,
    prefixReference:reference('reserved_pa_work_prefixes',prefix),participantTotalReferences:totalSet.participantTotalReferences});
  const view=execution.acceptView(viewSource.sourceId);if(view.kind!=='basis_prepared')throw new Error('occupied fixture initial view pending');
  expect(view.participants.map(p=>p.playerId)).toEqual(enrollment.participants.map(p=>p.binding.playerId));
  expect(prefix.timeline.events).toEqual([]);expect(view.participants.every(p=>p.activity.kind==='MATCH'&&p.activity.effortUnits===0)).toBe(true);
  const holdSource:AcceptedSamePaOccupiedRunnerHold={sourceId:label+':runner-hold',sourceVersion:'fixture-only-v1',capability:'same_pa_occupied_runner_hold_v1',
    enrollmentReference:prefixSource.enrollmentReference,playerId:runnerBinding.playerId,personId:runnerBinding.personId,
    bodyReference:reference('world_player_body_materializations',runnerBody.value),runnerModelReference:reference('world_player_runner_decision_motion_models',runnerModel),
    intent:{kind:'hold',issuedTick:actor.world.tick},coverageThroughTick:actor.world.tick+20_000_000,
    provenance:{sourceRecordId:label+':independently-issued-hold',sourceVersion:'fixture-only-v1'}};
  const hold=track(openSqliteSamePlateAppearanceOccupiedRunnerHoldStore(path,{readAcceptedHold:id=>id===holdSource.sourceId?holdSource:null})).accept(holdSource.sourceId);
  expect(hold.setup.position).toEqual(completed.endpoint.baseCenters.first);expect(hold.motionExecuted).toBe(false);expect(hold.actors).toHaveLength(5);

  const roles=deriveSamePaDispatchRoles(actor,view,originals),values=dispatchCalibrationValues();
  const base={sourceVersion:'fixture-only-v1',enrollmentReference:prefixSource.enrollmentReference,viewReference:reference('reserved_pa_execution_views',view),firstPhysicalPitchSourceId:enrollmentSource.firstPhysicalPitchSourceId};
  const actionSource:AcceptedSamePaFirstPitchAction=save({...base,sourceId:label+':action',capability:'same_pa_first_pitch_action_v1',variant:'declared_take_v1',
    pitcherPlayerId:h.original.pitcherPlayerId,batterPlayerId:actor.binding.playerId,
    nominalPitch:{...h.original.nominalPitch,delivery:{...h.original.nominalPitch.delivery,readyAtUs:actor.world.tick}},
    timingReference:h.original.timingReference,releaseReference:h.original.releaseReference,pitchResponseReference:h.original.pitchResponseReference,
    batterModelReference:reference('world_player_batting_models',batting),geometryReference:{kind:'action_source_take_geometry_v1'},
    occupiedRunnerHoldReferences:[reference('world_same_pa_occupied_runner_holds',hold)]});
  const parameters={batter_observation:'observationCalibration',batter_decision:'decisionModel',batter_motor:'capability',batter_swing:'repertoire'} as const;
  const calibrationSources=roles.flatMap(role=>role.routes.map(route=>{
    const key=parameters[route as keyof typeof parameters],parameter=key?batting[key]:null;
    const original=f.acceptedCalibrations.calibrations.find(c=>c.source.route===route&&(parameter!==null||c.source.member.playerId===role.member.playerId));
    if(!original)throw new Error('occupied fixture original calibrated route missing');
    const sourceId=label+':calibration:'+role.member.playerId+':'+route;
    return save({...base,sourceId,capability:'same_pa_execution_calibration_v1',member:role.member,route,
      nominalReference:parameter?reference('world_player_batting_models',batting):original.source.nominalReference,
      nominalParameterReference:parameter?{parameterKey:key,sourceId:parameter.sourceId,sourceVersion:parameter.sourceVersion,sourceHash:hash(parameter)}:null,
      acceptedAtDay:actor.binding.gameDay,provenance:{assessmentSourceId:sourceId+':assessment',assessmentVersion:'fixture-only-v1',calibrationSourceId:sourceId+':declaration',calibrationVersion:'fixture-only-v1'},
      response:route==='pitch_delivery'?{kind:'accepted_pitch_response_v1',policyReference:h.original.pitchResponseReference}:{kind:'accepted_execution_values_v1',values:values[route as keyof typeof values]}});
  }));
  expect(roles).toHaveLength(11);expect(roles.find(r=>r.role==='runner')?.routes).toEqual([]);expect(calibrationSources).toHaveLength(32);
  const dispatch=track(openSqliteSamePlateAppearanceDispatchStore(path,{readAcceptedAction:id=>accepted.get(id),readAcceptedCalibration:id=>accepted.get(id),
    readAcceptedConsumerSet:id=>accepted.get(id),readAcceptedEpisode:id=>accepted.get(id),readAcceptedRight:id=>accepted.get(id),readAcceptedPhysicalPitch:id=>accepted.get(id)}));
  const action=dispatch.acceptAction(actionSource.sourceId),calibrations=dispatch.acceptCalibrationSet(calibrationSources.map(s=>s.sourceId));
  if(action.kind!=='action_prepared'||calibrations.kind!=='execution_calibration_set')throw new Error('occupied fixture action/calibration pending');
  const actionReference=reference('pa_dispatch_v1_action_plans',action);
  const consumerSource=save({...base,sourceId:label+':consumers',capability:'same_pa_consumer_set_v1',actionReference,
    participantInputs:roles.map(role=>({member:role.member,calibrationReferences:calibrations.calibrations.filter(c=>c.source.member.playerId===role.member.playerId)
      .map(c=>({route:c.source.route,calibrationReference:reference('pa_dispatch_v1_execution_calibrations',c)}))}))});
  const consumers=dispatch.acceptConsumerSet(consumerSource.sourceId);if(consumers.kind!=='consumer_set_prepared')throw new Error('occupied fixture consumers pending');
  expect(consumers.source.participantInputs).toHaveLength(11);
  const consumerSetReference=reference('pa_dispatch_v1_consumer_sets',consumers);
  const episodeSource=save({...base,sourceId:label+':episode',capability:'same_pa_first_pitch_episode_v1',actionReference,consumerSetReference});
  const episode=dispatch.acceptEpisode(episodeSource.sourceId);if(episode.kind!=='prospective_episode_prepared')throw new Error('occupied fixture episode pending');
  const rightSource=save({...base,sourceId:label+':right',capability:'same_pa_first_pitch_right_v1',actionReference,consumerSetReference,
    episodeReference:reference('pa_dispatch_v1_episodes',episode),prefixReference:view.source.prefixReference});
  const right=dispatch.acceptRight(rightSource.sourceId);if(right.kind!=='immutable_right_prepared')throw new Error('occupied fixture first right pending');
  save({sourceId:base.firstPhysicalPitchSourceId,sourceVersion:'fixture-only-v1',capability:'same_pa_physical_pitch_v1',actionReference,rightReference:reference('pa_dispatch_v1_rights',right)});
  const pitch=dispatch.acceptPhysicalPitch(base.firstPhysicalPitchSourceId);if(pitch.kind==='pending')throw new Error('occupied fixture real declared TAKE pending');
  expect(pitch.originalActor).toEqual(actor);expect(pitch.lineage.participantReferences).toHaveLength(11);
  expect(pitch.beforeTimeline).toEqual(prefix.timeline);
  const physical=pitch.result.resolution.physical;if(physical.kind!=='taken')throw new Error('occupied fixture declared TAKE physical result differs');
  expect(pitch.result.delivery.release.releaseAtUs).toBeGreaterThan(actor.world.tick);
  expect(pitch.result.resolution.timeline.lastEventTick).toBeGreaterThan(pitch.result.delivery.release.releaseAtUs);
  expect(pitch.result.resolution.timeline.events.map(e=>e.kind)).toEqual(['TakenPitchPlateCrossed','PitchAdjudicated']);
  expect(pitch.result.resolution.timeline.events[0]).toMatchObject({tick:physical.result.crossing.tick,payload:{result:physical.result}});
  expect(pitch.result.resolution.timeline.events[1]).toMatchObject({tick:physical.result.crossing.tick,payload:{adjudication:{kind:physical.result.kind}}});
  expect(pitch.result.resolution.timeline.status.kind).toBe('active');
  expect(hold.source.coverageThroughTick).toBeGreaterThanOrEqual(Math.max(pitch.result.resolution.timeline.lastEventTick,pitch.result.delivery.timeline.followThroughEndUs));
  expect(json(db.prepare('SELECT * FROM matches WHERE match_id=?').get(actor.source.gameId))).toBe(officialBefore);
  for(const p of enrollment.participants)expect(readActualRoleWorkloadState(db,enrollment.careerId,p.binding.playerId,undefined,p.binding.personLinkSourceId)).toEqual(p.state);
  const bytes=()=>json(['same_pa_enrollments','same_pa_participant_reservations','reserved_pa_work_prefixes','reserved_pa_total_assessments','reserved_pa_execution_views',
    'world_same_pa_occupied_runner_holds','pa_dispatch_v1_action_plans','pa_dispatch_v1_execution_calibrations','pa_dispatch_v1_consumer_sets','pa_dispatch_v1_episodes',
    'pa_dispatch_v1_rights','pa_dispatch_v1_consumer_actions','pa_dispatch_v1_pitch_actions','pa_dispatch_v1_pitch_heads','pa_dispatch_v1_consumptions','pa_dispatch_v1_episode_admissions']
    .map(table=>db.prepare('SELECT * FROM main.'+table+' ORDER BY rowid').all()));
  const saved=bytes();dispatch.close();
  const reopened=track(openSqliteSamePlateAppearanceDispatchStore(path));
  expect(reopened.acceptPhysicalPitch(pitch.source.sourceId)).toEqual(pitch);expect(reopened.readPhysicalPitch(pitch.source.sourceId)).toEqual(pitch);
  expect(bytes()).toBe(saved);
  return {actor,enrollment,view,hold,action,calibrations,consumers,episode,right,pitch};
};

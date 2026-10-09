import { flight } from '../../core/world/psychology/batting/BattingFixtures.test-support';
import { policy } from '../../core/world/psychology/EmotionFixtures.test-support';
import { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { prepareSamePaSceneBodies } from './SamePlateAppearanceSceneBodies.test-support';
import { prepareSamePaNonemptyFixture } from './SamePlateAppearanceNonemptyFixture.test-support';
import { prepareSamePaLifecycleFixture } from './SamePlateAppearanceLifecycleFixture.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import { openSqliteSamePlateAppearanceTakeSuccessorStore } from './SqliteSamePlateAppearanceTakeSuccessorStore';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import { openSqliteBattingPerceptionStore } from './SqliteBattingPerceptionStore';
import { openSqliteBattingEmotionStore } from './SqliteBattingEmotionStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import type { SamePaLifecycleWorkReference } from './SamePlateAppearanceLifecycle';
import type { SamePaPhysicalActionSource } from './SamePlateAppearancePhysicalEpisode';
import type { PlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import type { AcceptedBattingCapability, AcceptedBattingObservationCalibration } from './PlayerBattingModel';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { AcceptedInFlightBattingPosture } from './NativeInFlightBattingPerception';
import type { Vec3 } from '../../core/model/geometry';

/** Source-only synthetic ownership fixture. It performs the two earlier TAKEs
 * through the real owners, then exposes a current accepted lifecycle view.
 * No returned actor/view is manufactured or supplied to a production writer. */
export const samePaPhysicalLifecycleFixture=(options:Readonly<{explicitBatterObservation?:AcceptedBattingObservationCalibration['values'];explicitDefenderObservation?:PlayerObservationCalibration;explicitBatterMotor?:AcceptedBattingCapability['values'];profile?:NonNullable<Parameters<typeof directNativeDispatchFixture>[0]>['profile'];explicitDefenderGloveOffsets?:Readonly<Record<string,Vec3>>}>={})=>{
  const f=directNativeDispatchFixture({profile:options.profile}),accepted=new Map<string,unknown>(),track=f.x.f.track;
  const save=<T extends {sourceId:string}>(s:T):T=>{accepted.set(s.sourceId,s);return s;};
  try{
    const original=f.acceptedAction.source,sceneBodyReferences=prepareSamePaSceneBodies(f,options.explicitDefenderGloveOffsets);
    const genesisSource=save({sourceId:'physical-fixture:emotion-genesis',sourceVersion:'fixture-only-v1',capability:'owned_batting_emotion_genesis_v1',
      viewReference:original.viewReference,member:deriveSamePaDispatchRoles(f.actor,f.view)[0].member,policy:policy(),provenance:{assessmentSourceId:'physical-fixture:genesis-assessment',
        assessmentVersion:'fixture-only-v1',calibrationSourceId:'existing-explicit-Core-fixture',calibrationVersion:'fixture-only-v1'}});
    const genesisOwner=track(openSqliteBattingEmotionStore(f.path,{readAcceptedGenesis:id=>accepted.get(id)}));
    const genesis=genesisOwner.acceptGenesis(genesisSource.sourceId);if(genesis.kind!=='batting_emotion_genesis')throw new Error('real original genesis pending');
    const worldOwner=track(openSqliteWorldControlStore(f.path));worldOwner.initialize({careerId:f.actor.binding.careerId,worldRevision:0,
      control:{schemaVersion:1,revision:0,controllerId:'explicit-fixture-controller',controlledClubId:null,domainIds:['BATTING'],manualDomainIds:[]}});
    const dispatch=track(openSqliteSamePlateAppearanceDispatchStore(f.path,{readAcceptedConsumerSet:id=>accepted.get(id),readAcceptedEpisode:id=>accepted.get(id),
      readAcceptedRight:id=>accepted.get(id),readAcceptedPhysicalPitch:id=>accepted.get(id)}));
    const base={sourceVersion:'fixture-only-v1',enrollmentReference:original.enrollmentReference,viewReference:original.viewReference,firstPhysicalPitchSourceId:original.firstPhysicalPitchSourceId};
    const consumersSource=save({...base,sourceId:'physical-fixture:consumers',capability:'same_pa_consumer_set_v1',actionReference:f.request.actionReference,
      participantInputs:deriveSamePaDispatchRoles(f.actor,f.view).map(role=>({member:role.member,calibrationReferences:f.acceptedCalibrations.calibrations.filter(c=>c.source.member.playerId===role.member.playerId)
        .map(c=>({route:c.source.route,calibrationReference:reference('pa_dispatch_v1_execution_calibrations',c)}))}))});
    const consumers=dispatch.acceptConsumerSet(consumersSource.sourceId);if(consumers.kind!=='consumer_set_prepared')throw new Error('real fixture consumers pending');
    const consumerSetReference=reference('pa_dispatch_v1_consumer_sets',consumers);
    const episodeSource=save({...base,sourceId:'physical-fixture:episode',capability:'same_pa_first_pitch_episode_v1',actionReference:f.request.actionReference,consumerSetReference});
    const episode=dispatch.acceptEpisode(episodeSource.sourceId);if(episode.kind!=='prospective_episode_prepared')throw new Error('real fixture episode pending');
    const rightSource=save({...base,sourceId:'physical-fixture:right',capability:'same_pa_first_pitch_right_v1',actionReference:f.request.actionReference,consumerSetReference,
      episodeReference:reference('pa_dispatch_v1_episodes',episode),prefixReference:f.view.source.prefixReference});
    const right=dispatch.acceptRight(rightSource.sourceId);if(right.kind!=='immutable_right_prepared')throw new Error('real fixture right pending');
    save({sourceId:original.firstPhysicalPitchSourceId,sourceVersion:'fixture-only-v1',capability:'same_pa_physical_pitch_v1',actionReference:f.request.actionReference,rightReference:reference('pa_dispatch_v1_rights',right)});
    const first=dispatch.acceptPhysicalPitch(original.firstPhysicalPitchSourceId);if(first.kind==='pending')throw new Error('real fixture first TAKE pending');
    // The same explicit cumulative effort2 declaration used by the prior Native
    // fixture is supplied independently for all ten participants at each cut.
    const efforts=Object.fromEntries(first.lineage.participantReferences.map(p=>[p.playerId,2]));
    const anchor=prepareSamePaNonemptyFixture(f,first,'physical-fixture:anchor',efforts,[]),member=anchor.basis.members.find(m=>m.playerId===f.actor.binding.playerId)!;
    const next=track(openSqliteSamePlateAppearanceTakeSuccessorStore(f.path,{readAcceptedAction:id=>accepted.get(id),readAcceptedSetup:id=>accepted.get(id),readAcceptedPhysicalPitch:id=>accepted.get(id)}));
    const readyAtUs=Math.max(first.result.delivery.timeline.followThroughEndUs,anchor.view.evaluationTick);
    const secondActionSource=save({sourceId:'physical-fixture:second-action',sourceVersion:'fixture-only-v1',capability:'same_pa_next_take_action_v1',viewReference:anchor.viewReference,
      previousPitchReference:reference('pa_dispatch_v1_pitch_actions',first),nominalPitch:{...original.nominalPitch,delivery:{...original.nominalPitch.delivery,readyAtUs}},
      timingReference:original.timingReference,releaseReference:original.releaseReference,pitchResponseReference:original.pitchResponseReference,batterModelReference:original.batterModelReference});
    const secondAction=next.acceptAction(secondActionSource.sourceId);if(secondAction.kind==='pending')throw new Error('real second action pending');
    const geometry={kind:'stationary_pre_pitch_scene_v1' as const,startedAtTick:secondAction.bodyCut.completedAtTick,validUntilTick:readyAtUs+20_000_000,ticksPerSecond:1_000_000,
      handedness:'R' as const,centerOfMass:{x:-0.78,y:1,z:-0.16},eyePosition:{x:-0.78,y:1.6,z:-0.16},observerForward:{x:0,y:0,z:1},
      attention:{target:{kind:'ball' as const},focusedSinceTick:secondAction.bodyCut.completedAtTick},bodyReadyTick:readyAtUs,latestMotorStartTick:readyAtUs,
      plateZ:original.nominalPitch.batter.plateZ,strikeZone:original.nominalPitch.batter.strikeZone};
    const perception=track(openSqliteBattingPerceptionStore(f.path,{readAcceptedPosture:id=>accepted.get(id)}));
    const postureSource=save({sourceId:'physical-fixture:second-posture',sourceVersion:'fixture-only-v1',capability:'owned_next_take_batting_posture_v1',viewReference:anchor.viewReference,
      member,actionReference:reference('pa_take_successor_v1_action_plans',secondAction),nextPhysicalPitchSourceId:'physical-fixture:second-pitch',modelReference:original.batterModelReference,
      sceneBodyReferences,geometry,provenance:{assessmentSourceId:'physical-fixture:second-posture-assessment',assessmentVersion:'fixture-only-v1',calibrationSourceId:'existing-explicit-Core-fixture',calibrationVersion:'fixture-only-v1'}});
    const posture=perception.acceptPosture(postureSource.sourceId);if(posture.kind!=='batting_invocation_posture')throw new Error('real second posture pending');
    const setupSource=save({sourceId:'physical-fixture:second-setup',sourceVersion:'fixture-only-v1',capability:'same_pa_retained_take_setup_v1',actionReference:reference('pa_take_successor_v1_action_plans',secondAction),
      postureReference:reference('batting_observation_v1_postures',posture),nextPhysicalPitchSourceId:postureSource.nextPhysicalPitchSourceId,
      participantInputs:anchor.basis.members.map(m=>({member:m,calibrationReferences:anchor.calibrationSet.calibrations.filter(c=>c.source.member.playerId===m.playerId)
        .map(c=>({route:c.source.route,calibrationReference:reference('pa_continuation_v1_execution_calibrations',c)}))}))});
    const setup=next.acceptSetup(setupSource.sourceId);if(setup.kind==='pending')throw new Error('real second setup pending');
    save({sourceId:postureSource.nextPhysicalPitchSourceId,sourceVersion:'fixture-only-v1',capability:'same_pa_successor_take_pitch_v1',actionReference:setupSource.actionReference,setupReference:reference('pa_take_successor_v1_setups',setup)});
    const second=next.acceptPhysicalPitch(postureSource.nextPhysicalPitchSourceId);if(second.kind==='pending')throw new Error('real second TAKE pending');
    const events:SamePaLifecycleWorkReference[]=[reference('pa_take_successor_v1_pitch_actions',second)];
    let basis=prepareSamePaLifecycleFixture(f,anchor.viewReference,[...events],'physical-fixture:cut0',efforts,options.explicitBatterObservation,options.explicitDefenderObservation,options.explicitBatterMotor);
    const physical=track(openSqliteSamePlateAppearancePhysicalEpisodeStore(f.path,{readAcceptedAction:id=>accepted.get(id),readAcceptedRight:id=>accepted.get(id),readAcceptedFieldCalibration:id=>accepted.get(id),readAcceptedOperation:id=>accepted.get(id)}));
    const current=()=>basis;
    const advance=(ref:SamePaLifecycleWorkReference)=>{events.push(ref);basis=prepareSamePaLifecycleFixture(f,anchor.viewReference,[...events],'physical-fixture:cut'+events.length,efforts,options.explicitBatterObservation,options.explicitDefenderObservation,options.explicitBatterMotor);return basis;};
    const prepareAction=(label:string,battingMode:SamePaPhysicalActionSource['battingMode'],nominalPitch:SamePaPhysicalActionSource['nominalPitch'],actualFlightParameters=flight().parameters)=>{
      const s=save({sourceId:label+':action',sourceVersion:'fixture-only-v1',capability:'same_pa_physical_action_v1',viewReference:basis.viewReference,physicalPitchSourceId:label+':launch',battingMode,nominalPitch,
        timingReference:original.timingReference,releaseReference:original.releaseReference,pitchResponseReference:original.pitchResponseReference,batterModelReference:original.batterModelReference,
        actualFlightParameters,contactResponse:'nathan_2012_wood_local_v1'});
      const action=physical.acceptAction(s.sourceId);if(action.kind!=='same_pa_physical_action_prepared_v1')throw new Error('real later action pending');return{action,actionReference:reference('pa_physical_v1_action_plans',action)};
    };
    const preparePosture=(label:string,prepared:ReturnType<typeof prepareAction>,geometry:AcceptedInFlightBattingPosture['geometry'])=>{
      const s=save({sourceId:label+':posture',sourceVersion:'fixture-only-v1',capability:'owned_in_flight_batting_posture_v1',viewReference:basis.viewReference,
        member:basis.basis.members.find(m=>m.playerId===f.actor.binding.playerId)!,actionReference:prepared.actionReference,modelReference:original.batterModelReference,sceneBodyReferences,geometry,
        provenance:{assessmentSourceId:label+':posture-assessment',assessmentVersion:'fixture-only-v1',calibrationSourceId:'existing-explicit-Core-fixture',calibrationVersion:'fixture-only-v1'}});
      const value=perception.acceptPosture(s.sourceId);if(value.kind!=='batting_invocation_posture')throw new Error('real per-pitch posture pending');return{posture:value,postureReference:reference('batting_observation_v1_postures',value)};
    };
    const prepareRight=(prepared:ReturnType<typeof prepareAction>,postureReference:SamePaReference<'batting_observation_v1_postures'>)=>{
      const {action,actionReference}=prepared;
      const rs=save({sourceId:action.source.sourceId+':right',sourceVersion:'fixture-only-v1',capability:'same_pa_physical_right_v1',viewReference:basis.viewReference,actionReference,postureReference,
        participantInputs:deriveSamePaDispatchRoles(f.actor,f.view).map(role=>({member:basis.basis.members.find(m=>m.playerId===role.member.playerId)!,calibrationReferences:basis.calibrationSet.calibrations.filter(c=>c.source.member.playerId===role.member.playerId)
          .map(c=>({route:c.source.route,calibrationReference:reference('pa_lifecycle_v1_execution_calibrations',c)}))}))});
      const right=physical.acceptRight(rs.sourceId);if(right.kind!=='same_pa_physical_right_prepared_v1')throw new Error('real later right pending');return{action,actionReference,right,rightReference:reference('pa_physical_v1_rights',right)};
    };
    const launch=(prepared:ReturnType<typeof prepareRight>)=>{save({sourceId:prepared.action.physicalPitchSourceId,sourceVersion:'fixture-only-v1',capability:'same_pa_physical_launch_v1',viewReference:prepared.action.source.viewReference,
      actionReference:prepared.actionReference,rightReference:prepared.rightReference});const op=physical.acceptOperation(prepared.action.physicalPitchSourceId);if(op.kind!=='same_pa_physical_launch_v1')throw new Error('real later launch pending');advance(reference('pa_physical_v1_launches',op));return op;};
    return{f,accepted,save,first,second,anchor,events,current,advance,physical,prepareAction,preparePosture,prepareRight,launch,sceneBodyReferences,geometry,original,efforts,genesis,worldOwner,close:f.close};
  }catch(e){f.close();throw e;}
};

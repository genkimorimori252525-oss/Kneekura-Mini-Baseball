import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { AerodynamicPitchTrajectoryParameters } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { actorHash as hash,actorJson as json,actorFreeze as freeze } from '../../host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../host/world/SamePlateAppearanceExecutionFromSqlite';
import { samePaReferenceValid, type SamePaReference } from '../../host/world/SamePlateAppearanceWorkPrefix';
import { openSqliteSamePlateAppearanceEnrollmentStore } from '../../host/world/SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceExecutionStore } from '../../host/world/SqliteSamePlateAppearanceExecutionStore';
import { openSqliteSamePlateAppearanceDispatchStore,readSamePaFirstPitchCalculation } from '../../host/world/SqliteSamePlateAppearanceDispatchStore';
import { deriveSamePaDispatchRoles } from '../../host/world/SamePlateAppearanceDispatchRoles';
import type { AcceptedSamePaFirstPitchAction,AcceptedSamePaExecutionCalibration,SamePaNominalObservedPitch } from '../../host/world/SamePlateAppearanceDispatchSource';
import type { SamePaNativeObservedLaunchCalculation } from '../../host/world/SamePlateAppearanceDispatchExecution';
import { openSqlitePlayerPersonLinkStore } from '../../host/world/SqlitePlayerPersonLinkStore';
import { openSqlitePlayerPitchTimingStore,type AcceptedPitchTimingBaseline } from '../../host/world/SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from '../../host/world/SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore,type AcceptedPitchFatiguePolicy } from '../../host/world/SqlitePitchFatiguePolicyStore';
import { playerBattingModelEvidenceFromSqlite } from '../../host/world/PlayerBattingModelEvidence';
import { withBodyCompositionTransaction } from '../../host/world/BodyMaterializationSqliteOwnership';
import { readAuthoredNativeMatchV1,type AuthoredNativeMatchReadPinsV1 } from './AuthoredNativeMatchV1';

type CalibrationDeclaration=Pick<AcceptedSamePaExecutionCalibration,'sourceId'|'sourceVersion'|'route'|'acceptedAtDay'|'provenance'|'response'>&Readonly<{playerId:string}>;
export type AuthoredNativePitchPreparationV1=Readonly<{
  version:'authored_native_observed_pitch_preparation_v1';namespace:string;sourceVersion:string;genesisPins:AuthoredNativeMatchReadPinsV1;
  enrollmentReference:SamePaReference<'same_pa_enrollments'>;battingModelReference:SamePaReference<'world_player_batting_models'>;
  timing:AcceptedPitchTimingBaseline;pitchResponse:AcceptedPitchFatiguePolicy;nominalPitch:SamePaNominalObservedPitch;
  actualFlightParameters:AerodynamicPitchTrajectoryParameters;
  emptyTotalProvenance:readonly Readonly<{playerId:string;provenance:Readonly<{assessmentSourceId:string;assessmentVersion:string;calibrationSourceId:string;calibrationVersion:string}>}>[];
  /** Every effective response is explicitly authored. There is no production
   * nominal-copy default or conversion from a relative league rating. */
  calibrations:readonly CalibrationDeclaration[];
}>;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('authored pitch original scope differs');};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('authored pitch: '+message);}

/** Compose original owners on the already-authored world/reservation. This
 * prepares an unconsumed observed action and32 responses. Play, held-ball
 * command and physical launch still require their separate actual owners. */
export function prepareAuthoredNativeObservedPitchV1(path:string,raw:AuthoredNativePitchPreparationV1){
  const d=cloneInert(raw),ids=(suffix:string)=>d.namespace+':'+suffix;
  assert(d.version==='authored_native_observed_pitch_preparation_v1'&&typeof d.namespace==='string'&&d.namespace.trim()===d.namespace&&d.namespace.length>0
    &&typeof d.sourceVersion==='string'&&d.sourceVersion.length>0&&samePaReferenceValid(d.enrollmentReference,'same_pa_enrollments')
    &&samePaReferenceValid(d.battingModelReference,'world_player_batting_models')&&Array.isArray(d.calibrations)&&d.calibrations.length===32
    &&Array.isArray(d.emptyTotalProvenance)&&d.emptyTotalProvenance.length===10,'invalid declaration');
  const genesis=readAuthoredNativeMatchV1(path,d.genesisPins),actor=genesis.actor;
  assert(actor.world.runners.length===0,'occupied initial pitch requires its actual runner controls');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path);
  const stores:{close():void}[]=[],track=<T extends {close():void}>(s:T):T=>{stores.push(s);return s;};
  try{
    const enrollment=track(openSqliteSamePlateAppearanceEnrollmentStore(path)).read(d.enrollmentReference.sourceId);
    assert(enrollment?.kind==='reserved','original reservation missing');same(reference('same_pa_enrollments',enrollment),d.enrollmentReference);
    same(enrollment.source.actorReference,reference('physical_plate_appearance_actors',actor));
    const batting=withBodyCompositionTransaction(db,false,()=>playerBattingModelEvidenceFromSqlite(db).read(d.battingModelReference.sourceId));
    assert(batting&&batting.source.playerId===actor.binding.playerId,'original batting model missing');same(reference('world_player_batting_models',batting),d.battingModelReference);
    const pitcher=actor.world.defenders.find(p=>p.registeredPosition==='P'),pitcherBody=genesis.materializations.find(b=>b.source.playerId===pitcher?.playerId&&b.source.role==='pitcher');
    assert(pitcher&&pitcherBody?.releaseGeometry,'original pitcher/release missing');
    const pitcherBinding=actor.defenderBindings.find(p=>p.playerId===pitcher.playerId)!;
    assert(d.timing.careerId===actor.binding.careerId&&d.timing.playerId===pitcher.playerId&&d.timing.personLinkSourceId===pitcherBinding.personLinkSourceId
      &&d.timing.acceptedAtDay<=actor.binding.gameDay,'timing original pitcher differs');
    const links=track(openSqlitePlayerPersonLinkStore(path));
    const timing=track(openSqlitePlayerPitchTimingStore(path,links,{readAcceptedBaseline:id=>id===d.timing.sourceId?d.timing:null,readAcceptedLearning:()=>null}));
    const timingState=timing.initialize(d.timing.sourceId);
    const policy=track(openSqlitePitchFatiguePolicyStore(path,{readAcceptedPolicy:id=>id===d.pitchResponse.sourceId?d.pitchResponse:null})).accept(d.pitchResponse.sourceId);
    const sources=new Map<string,unknown>(),publish=<T extends {sourceId:string}>(v:T)=>{assert(!sources.has(v.sourceId),'duplicate authored Source');sources.set(v.sourceId,v);return v;};
    const get=(id:string)=>sources.get(id),execution=track(openSqliteSamePlateAppearanceExecutionStore(path,{readAcceptedPrefix:get,readAcceptedTotal:get,readAcceptedView:get}));
    const prefixSource=publish({sourceId:ids('empty-prefix'),sourceVersion:d.sourceVersion,capability:'reserved_same_pa_empty_prefix_v1',enrollmentReference:d.enrollmentReference});
    const prefix=execution.acceptPrefix(prefixSource.sourceId);assert(prefix.kind==='empty_prefix','empty prefix pending');
    const totals=enrollment.participants.map(p=>{
      const assessments=d.emptyTotalProvenance.filter(a=>a.playerId===p.binding.playerId);assert(assessments.length===1,'explicit participant TOTAL assessment missing or duplicated');
      return publish({sourceId:ids('empty-total:'+p.binding.playerId),sourceVersion:d.sourceVersion,capability:'reserved_same_pa_cumulative_total_v1',
      enrollmentReference:d.enrollmentReference,prefixReference:reference('reserved_pa_work_prefixes',prefix),
      participantReference:prefix.lineage.participantReferences.find(r=>r.playerId===p.binding.playerId)!,effortUnits:0,provenance:assessments[0].provenance});});
    const totalSet=execution.acceptTotalSet(totals.map(s=>s.sourceId));assert(totalSet.kind==='total_set','empty totals pending');
    const viewSource=publish({sourceId:ids('initial-view'),sourceVersion:d.sourceVersion,capability:'reserved_same_pa_cumulative_view_v1',enrollmentReference:d.enrollmentReference,
      prefixReference:reference('reserved_pa_work_prefixes',prefix),participantTotalReferences:totalSet.participantTotalReferences});
    const view=execution.acceptView(viewSource.sourceId);assert(view.kind==='basis_prepared','initial view pending');
    const nominalRef=<O extends string>(owner:O,table:string,id:string,value:unknown)=>{
      const row=db.prepare('SELECT source_json FROM '+table+' WHERE source_id=?').get(id);assert(row,'original nominal Source missing');
      return {owner,sourceId:id,sourceHash:hash(JSON.parse(String(row.source_json))),snapshotHash:hash(value)};
    };
    const timingRef=nominalRef('world_pitch_timing_baselines','world_pitch_timing_baselines',d.timing.sourceId,timingState);
    const releaseOwner=track(openSqlitePlayerReleaseGeometryStore(path,links)),releaseHistory=releaseOwner.readHead(actor.binding.careerId,pitcher.playerId);
    assert(releaseHistory,'original full release history missing');same(releaseOwner.selectAtDay(actor.binding.careerId,pitcher.playerId,actor.binding.gameDay),pitcherBody.releaseGeometry);
    const releaseRef=nominalRef('world_player_release_baselines','world_player_release_baselines',pitcherBody.releaseGeometry.sourceId,releaseHistory);
    const base={sourceVersion:d.sourceVersion,enrollmentReference:d.enrollmentReference,viewReference:reference('reserved_pa_execution_views',view),firstPhysicalPitchSourceId:enrollment.source.firstPhysicalPitchSourceId};
    const action:AcceptedSamePaFirstPitchAction=publish({...base,sourceId:ids('action'),capability:'same_pa_first_pitch_action_v1',variant:'observer_decision_v1',
      pitcherPlayerId:pitcher.playerId,batterPlayerId:actor.binding.playerId,nominalPitch:d.nominalPitch,actualFlightParameters:d.actualFlightParameters,
      timingReference:timingRef,releaseReference:releaseRef,pitchResponseReference:{owner:'world_pitch_fatigue_policies',sourceId:policy.sourceId,sourceHash:hash(policy),snapshotHash:hash(policy)},
      batterModelReference:d.battingModelReference,geometryReference:{kind:'action_source_batting_geometry_v1'}});
    const roles=deriveSamePaDispatchRoles(actor,view),parameters={batter_observation:'observationCalibration',batter_decision:'decisionModel',batter_motor:'capability',batter_swing:'repertoire'} as const;
    const calibrations=roles.flatMap(role=>role.routes.map(route=>{
      const matches=d.calibrations.filter(c=>c.playerId===role.member.playerId&&c.route===route);assert(matches.length===1,'effective calibration membership differs');
      const {playerId:_player,...declared}=matches[0],key=parameters[route as keyof typeof parameters],parameter=key?batting[key]:null;
      const models=genesis.models.find(m=>m.playerId===role.member.playerId);
      const nominal=route==='pitch_delivery'?timingRef:parameter?d.battingModelReference:route==='defender_observation'?reference('world_player_observation_models',models!.observation)
        :route==='defender_decision'?reference('world_player_decision_models',models!.decision):reference('world_player_locomotion_models',models!.locomotion);
      return publish({...base,...declared,capability:'same_pa_execution_calibration_v1',member:role.member,nominalReference:nominal,
        nominalParameterReference:parameter?{parameterKey:key,sourceId:parameter.sourceId,sourceVersion:parameter.sourceVersion,sourceHash:hash(parameter)}:null});
    }));
    const dispatch=track(openSqliteSamePlateAppearanceDispatchStore(path,{readAcceptedAction:get,readAcceptedCalibration:get}));
    const acceptedAction=dispatch.acceptAction(action.sourceId),accepted=dispatch.acceptCalibrationSet(calibrations.map(c=>c.sourceId));
    assert(acceptedAction.kind==='action_prepared'&&accepted.kind==='execution_calibration_set','dispatch preparation pending');
    const request={actionReference:reference('pa_dispatch_v1_action_plans',acceptedAction),calibrationReference:reference('pa_dispatch_v1_execution_calibrations',accepted.calibrations.find(c=>c.source.route==='pitch_delivery')!)};
    const rawCalculation=readSamePaFirstPitchCalculation(path,request);
    assert(rawCalculation&&typeof rawCalculation==='object'&&'kind'in rawCalculation&&rawCalculation.kind==='native_observed_launch_calculation_only','observed preparation differs');
    const calculation=rawCalculation as SamePaNativeObservedLaunchCalculation;
    return freeze({genesis,batting,enrollment,view,roles,acceptedAction,acceptedCalibrations:accepted,request,calculation,sources:[...sources.values()],nativePitchLaunched:false as const});
  }finally{stores.reverse().forEach(s=>s.close());db.close();}
}

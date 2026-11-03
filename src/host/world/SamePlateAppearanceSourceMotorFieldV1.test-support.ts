import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import type { DatabaseSync } from 'node:sqlite';
import { sourceFieldV3Fixture } from '../../core/sim/ball/SourceBattedFieldMotionV3.test-support';
import { fixture as catchFixture } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { deriveSourceBattedFieldMotionV3 } from '../../core/sim/ball/SourceBattedFieldMotionV3';
import { recordBatBallContact } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { createDefensiveRatings } from '../../core/model/DefensiveRatings';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldActionFromSqlite';
import { deriveSamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalFieldCalculation';
import { deriveSamePaSourceIntegerCheckpointV1 } from './SamePlateAppearanceSourceIntegerCheckpointV1';
import { samePaSourceFieldSolverEvidenceV3 } from './SamePlateAppearanceSourceFieldV3';
import { SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT, SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION as OLD,
  SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION as INTEGER } from './SamePlateAppearanceBallPhysics';
import type { SamePaPhysicalAction, SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldAction';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
export type SourceHostMotorFixtureModels = {calibrations:Map<string,any>;models:Map<string,any>;posture:any};
const MOTOR='same_pa_field_step_aero_ground_motor_v1';
const v = (x=0,y=0,z=0) => ({x,y,z});
const ref = (f: SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const member = (playerId: string) => ({ playerId, bindingHash: hash(playerId+'binding'), personHash: hash(playerId+'person'), baselineSourceId:playerId+'baseline',
  reservedRevision:0, reservedStateHash:hash(playerId+'reserved'), projectedStateHash:hash(playerId+'projected') });
// Synthetic model/ancestry bindings; production Source and rated motor run unchanged.
export const sourceHostMotorFixture = (mocked: SourceHostMotorFixtureModels, catchAfterInteger = false,
  options:Readonly<{capturePowerW?:number;wallX?:number;continuous?:boolean}>={}) => {
  const x = sourceFieldV3Fixture(); x.response.world.surfaces=[]; x.response.surfaces=[];
  if(options.wallX!==undefined){x.response.world.surfaces=[{surfaceId:'capture-wall',start:{x:options.wallX,z:-1},end:{x:options.wallX,z:1},minimumHeight:0,maximumHeight:20}];
    x.response.surfaces=[{surfaceId:'capture-wall',material:{restitution:.5,tangentialDamping:.25,spinDamping:.2}}];}
  const roles = ['body','glove','tag_hand','left_foot','right_foot'] as const, ids = Array.from({length:9},(_,i)=>'p'+(i+1));
  const bodies = ['p0',...ids].map((playerId,i) => ({ source:{playerId}, actor:{playerId,personId:playerId+'person',heightMeters:2,bodyOriginHeightMeters:1,
    primitives:roles.map((role,j)=>({role,radius:.1,offset:v(0,j*.2)}))}, center:v(1000+i*5,1,1000) }));
  if(catchAfterInteger){
    const ground=deriveSourceBattedFieldMotionV3({initial:x,throughTicks:[812345]}).field.motion.cursor!.moment.ball.position;
    bodies[1].center=v(ground.x+.2,1,ground.z);
    bodies[1].actor.primitives.find(p=>p.role==='glove')!.offset=v(0,ground.y-1);
  }
  const actors = bodies.flatMap(b => b.actor.primitives.map(s=>({playerId:b.source.playerId,primitive:{role:s.role,radius:s.radius,
    startTick:x.availableAtTick,endTick:x.coverageThroughTick,ticksPerSecond:1e6,startCenter:v(b.center.x,b.center.y+s.offset.y,b.center.z),startVelocity:v(),acceleration:v()}})));
  const material={restitution:.5,tangentialDamping:.25,spinDamping:.2};
  const originalGlove = catchFixture().response.actors[0].profile;
  if(originalGlove.role!=='glove')throw new Error('glove fixture');
  const glove={...originalGlove,parameters:{...originalGlove.parameters,ballRadiusMeters:x.response.world.parameters.ballRadius,
    captureDissipationPowerW:options.capturePowerW??originalGlove.parameters.captureDissipationPowerW}};
  const response = {...x.response,world:{...x.response.world,actors},actors:actors.map(a=>({playerId:a.playerId,
    profile:a.primitive.role==='glove'?glove:{role:a.primitive.role,material}}))};
  const commands = actors.map(a=>({playerId:a.playerId,role:a.primitive.role,acceleration:v()}));
  const initial={...x,response,actors,commands}, trace=deriveSourceBattedFieldMotionV3({initial,throughTicks:[]});
  const root = {kind:'same_pa_physical_field_root_v1',stage:'field',physicalPitchSourceId:'pitch',pitchOrdinal:1,operationOrdinal:0,lineage:{playId:1},
    source:{sourceId:'root',sourceVersion:ROOT,throughTick:x.availableAtTick,parameters:response.world.parameters,ballPhysics:x.cursor.sourceCurve.profile,
      postureReference:reference('batting_observation_v1_postures',{source:{sourceId:'posture'}} as never),
      launchReference:reference('pa_physical_v1_launches',{source:{sourceId:'launch'}} as never),
      commands:bodies.map(b=>({playerId:b.source.playerId,bodyAcceleration:v(),primitiveMotions:roles.map(role=>({role,offsetVelocity:v(),offsetAcceleration:v()}))}))},
    response,geometry:x.geometry,field:trace.field,evaluationTick:x.availableAtTick,ballSolverEvidence:samePaSourceFieldSolverEvidenceV3(trace),
    timeline:recordBatBallContact({playId:1,startedAtTick:0,lastEventTick:0,nextSequence:0,events:[],status:{kind:'active',count:{balls:0,strikes:0}}},response.world.flight.contact)} as unknown as SamePaPhysicalFieldRoot;
  const history:(SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep)[]=[root];
  let basis={view:{source:{sourceId:'view'},cut:{evaluationTick:root.evaluationTick}},members:ids.map(member)} as unknown as SamePaLifecycleViewBasis;
  const source = (version=INTEGER, action?:SamePaPhysicalFieldAction, throughTick=history.at(-1)!.evaluationTick):SamePaPhysicalFieldStepSource => ({sourceId:'row'+history.length,
    sourceVersion:version,capability:'same_pa_physical_field_step_v1',launchReference:root.source.launchReference,fieldRootReference:ref(root) as never,
    previousFieldReference:ref(history.at(-1)!),previousOperationReference:ref(history.at(-1)!),viewReference:reference('pa_lifecycle_v1_execution_views',basis.view),throughTick,...(action?{action}:{})});
  const append=(s:SamePaPhysicalFieldStepSource,value:any) => { const f={...history.at(-1)!,...value,source:s,kind:'same_pa_physical_field_step_v1',operationOrdinal:history.length} as SamePaPhysicalFieldStep;
    history.push(f);basis={...basis,view:{...basis.view,cut:{...basis.view.cut,evaluationTick:f.evaluationTick}}};return f; };
  const s=source(OLD,undefined,812345);append(s,deriveSamePaPhysicalFieldStep(s,root,root,root.evaluationTick,true,history));
  const integerSource=source(INTEGER,{kind:'source_integer_boundary_checkpoint_v1'}),wait=deriveSamePaSourceIntegerCheckpointV1({source:integerSource,root,previous:history.at(-1)!,history});
  append(integerSource,{...wait,evaluationTick:wait.field.motion.world.moment.ball.tick});
  const at={originTick:x.availableAtTick,elapsedSeconds:history.at(-1)!.field.motion.world.moment.elapsedSeconds,tick:history.at(-1)!.evaluationTick};
  const ratings=createDefensiveRatings({positionSuitability:{P:.5,C:.5,'1B':.5,'2B':.5,'3B':.5,SS:.5,LF:.5,CF:.5,RF:.5},firstStep:.5,acceleration:.5,battedBallRead:.5,
    routeEfficiency:.5,catching:.5,transfer:.5,armStrength:.5,throwingAccuracy:.5,situationalAwareness:.5,tagSkill:.5});
  const metadata=(kind:string,value:any)=>append(source(INTEGER,{kind} as never),{actionResult:{kind,...value}});
  const decisions=ids.map(playerId=>{
    let o:SamePaPhysicalFieldStep;
    if(options.continuous){
      const id=playerId+'obsCal', model={source:{sourceId:playerId+'obsModel',playerId},fieldingModel:{source:{ratings},person:{personId:playerId+'person'}}};
      mocked.models.set(model.source.sourceId,model);
      const values={...playerObservationCalibrationFixture(),refreshPolicy:{attendedIntervalTicks:80000,peripheralIntervalTicks:160000},
        memoryDecayParameters:{...playerObservationCalibrationFixture().memoryDecayParameters,ticksPerSecond:1000000}};
      const calibrationReference=reference('pa_lifecycle_v1_execution_calibrations',{source:{sourceId:id}} as never);
      mocked.calibrations.set(id,{lineage:root.lineage,source:{member:member(playerId),viewReference:reference('pa_lifecycle_v1_execution_views',basis.view),
        route:'defender_observation',nominalReference:reference('world_player_observation_models',model),response:{values}}});
      const request={kind:'defender_observation_v1',member:member(playerId),calibrationReference} as SamePaPhysicalFieldAction;
      o=append(source(INTEGER,request),{actionResult:{kind:'defender_observation_v1',playerId,
        samplingRequest:{observationModelSourceId:model.source.sourceId,view:{attentionTarget:{kind:'ball'}}},
        receipt:{at,results:[{target:{kind:'ball'},status:'detected'}],samples:{ball:{at,sample:{observedAt:at.tick}},players:[]}}}});
    }else o=metadata('defender_observation_v1',{playerId});
    return metadata('defender_decision_v1',{playerId,observationReference:ref(o)});
  });
  const team=metadata('defender_team_selection_v1',{plan:{assignments:ids.map(playerId=>({playerId}))},movementAdmission:false});
  const targets=ids.map((_,i)=>({x:990+i,z:990}));
  const intents=[{kind:'ball_handler'},{kind:'base_cover',base:1},{kind:'relay',target:targets[2]},{kind:'backup',target:targets[3]},
    {kind:'deep_coverage',target:targets[4]},{kind:'hold'},{kind:'relay',target:targets[6]},{kind:'backup',target:targets[7]},{kind:'deep_coverage',target:targets[8]}];
  const actorSelections=ids.map((playerId,i)=>{
    const model={source:{sourceId:playerId+'model',sourceVersion:'fixture',playerId,personLinkSourceId:playerId+'link',acceptedAtDay:1},fieldingModel:{source:{ratings},person:{personId:playerId+'person'}}};
    mocked.models.set(model.source.sourceId,model);
    return metadata('defender_actor_selection_v1',{playerId,member:member(playerId),teamSelectionReference:ref(team),originalDecisionReference:ref(decisions[i]),
      observationReference:(decisions[i].actionResult as any).observationReference,candidate:{intent:intents[i],localPriority:1,evidenceAvailableAt:at.tick,evidenceKinds:['fixture']},
      scheduling:{startedAtTick:at.tick,decisionTick:at.tick,movementStartTick:at.tick,decisionDelayTicks:0,firstStepDelayTicks:0},
      availability:at,target:intents[i].kind==='hold'?null:targets[i],fieldingModelHash:hash(model.fieldingModel),movementAdmission:false});
  });
  mocked.posture={kind:'batting_invocation_posture',sceneBodies:bodies.slice(1)};
  const action={physicalPitchSourceId:'pitch',actor:{defenderBindings:ids.map(playerId=>({playerId,personId:playerId+'person',personLinkSourceId:playerId+'link',gameDay:1}))}} as unknown as SamePaPhysicalAction;
  const selections=actorSelections.map((a,i)=>{const model=mocked.models.get(ids[i]+'model'),id=ids[i]+'cal';
    mocked.calibrations.set(id,{lineage:root.lineage,source:{member:member(ids[i]),viewReference:reference('pa_lifecycle_v1_execution_views',basis.view),route:'defender_locomotion',
      nominalReference:reference('world_player_locomotion_models',model),response:{values:{...playerLocomotionCalibrationFixture(),maxIntegrationStepTicks:options.continuous?2000:100000}}}});
    return{member:member(ids[i]),decisionReference:ref(a) as Extract<SamePaPhysicalFieldAction,{kind:'defender_motion_v1'}>['selections'][number]['decisionReference'],calibrationReference:reference('pa_lifecycle_v1_execution_calibrations',{source:{sourceId:id}} as never)};});
  const request={kind:'defender_motion_v1',selections} as const;
  const motorSource=source(MOTOR,request,at.tick+(catchAfterInteger?5000:1000));
  const run=()=>deriveSamePaPhysicalFieldAction({} as DatabaseSync,motorSource,root,history.at(-1)!,action,basis,history,false);
  return{root,history,basis,source,append,request,motorSource,run,at,action};
};

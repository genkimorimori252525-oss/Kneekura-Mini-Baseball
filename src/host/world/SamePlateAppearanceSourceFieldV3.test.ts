import { expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { deriveSamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldActionFromSqlite';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import type { SamePaPhysicalAction } from './SamePlateAppearancePhysicalEpisode';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { sourceFieldV3Fixture } from '../../core/sim/ball/SourceBattedFieldMotionV3.test-support';
import { deriveSourceBattedFieldMotionV3 } from '../../core/sim/ball/SourceBattedFieldMotionV3';
import { deriveSamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalFieldCalculation';
import { deriveSamePaSourceFieldMetadataV3, samePaSourceFieldSolverEvidenceV3 } from './SamePlateAppearanceSourceFieldV3';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT, SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION as STEP,
  SAME_PA_AERO_GROUND_FIELD_STEP_SOURCE_VERSION as V2STEP } from './SamePlateAppearanceBallPhysics';
const modelReads=vi.hoisted(()=>({calibrations:new Map<string,unknown>(),models:new Map<string,unknown>()}));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite',()=>({readSamePaLifecycleCalibrationFromSqlite:(_db:unknown,r:{sourceId:string})=>modelReads.calibrations.get(r.sourceId),
  readCurrentSamePaLifecycleCalibrationFromSqlite:(_db:unknown,r:{sourceId:string})=>modelReads.calibrations.get(r.sourceId)}));
vi.mock('./SqlitePlayerObservationModelStore',()=>({playerObservationModelEvidenceFromSqlite:()=>({read:(id:string)=>modelReads.models.get(id)})}));
vi.mock('./SqlitePlayerDecisionModelStore',()=>({playerDecisionModelEvidenceFromSqlite:()=>({read:(id:string)=>modelReads.models.get(id)})}));

// Structural calculation fixture only. Native authentication is tested by the
// original owner; these synthetic references grant no admission authority.
const setup=(x=sourceFieldV3Fixture())=>{
  const trace=deriveSourceBattedFieldMotionV3({initial:x,throughTicks:[]}),initial=trace.field;
  const root={kind:'same_pa_physical_field_root_v1',stage:'field',physicalPitchSourceId:'physical-pitch',operationOrdinal:0,pitchOrdinal:3,lineage:{playId:1},
    ballSolverEvidence:samePaSourceFieldSolverEvidenceV3(trace),
    source:{sourceId:'root',sourceVersion:ROOT,throughTick:x.availableAtTick,parameters:x.response.world.parameters,ballPhysics:x.cursor.sourceCurve.profile,
      commands:x.actors.map(a=>({playerId:a.playerId,bodyAcceleration:{x:0,y:0,z:0},primitiveMotions:[{role:a.primitive.role,
        offsetVelocity:{x:0,y:0,z:0},offsetAcceleration:{x:0,y:0,z:0}}]}))},response:x.response,geometry:x.geometry,field:initial,
    evaluationTick:initial.motion.world.moment.ball.tick,timeline:{playId:1,startedAtTick:0,lastEventTick:0,nextSequence:0,events:[],status:{kind:'active',count:{balls:0,strikes:0}}}
  } as unknown as SamePaPhysicalFieldRoot;
  const ref=(f:SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
  const source=(previous:SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep):SamePaPhysicalFieldStepSource=>({sourceId:'step'+(previous.operationOrdinal+1),sourceVersion:STEP,
    capability:'same_pa_physical_field_step_v1',viewReference:{owner:'pa_lifecycle_v1_execution_views',sourceId:'view',sourceHash:hash('view'),snapshotHash:hash('view')},
    launchReference:{owner:'pa_physical_v1_launches',sourceId:'launch',sourceHash:hash('launch'),snapshotHash:hash('launch')},previousOperationReference:ref(previous),
    previousFieldReference:ref(previous),fieldRootReference:reference('pa_physical_v1_field_roots',root),throughTick:212345});
  return{root,source};
};
it('reconstructs the full original prefix for each step and never accepts saved certificates as authority',()=>{
  const h=setup(),s1=h.source(h.root),first=deriveSamePaPhysicalFieldStep(s1,h.root,h.root,h.root.evaluationTick,false,[h.root]);
  expect(first.field.motion.response.kind).toBe('rebound');
  const record={...h.root,...first,source:s1,kind:'same_pa_physical_field_step_v1',operationOrdinal:1} as SamePaPhysicalFieldStep;
  const s2=h.source(record),next=deriveSamePaPhysicalFieldStep(s2,h.root,record,record.evaluationTick,false,[h.root,record]);
  expect(next.field.motion.world.kind).toBe('moving');expect(next.ballSolverEvidence!.escapedIntervals).toHaveLength(1);
  expect(()=>deriveSamePaPhysicalFieldStep(s2,h.root,record,record.evaluationTick,false)).toThrow('original root/history');
  const forged={...record,field:{...record.field,motion:{...record.field.motion,cursor:{...record.field.motion.cursor!,moment:{...record.field.motion.cursor!.moment,
    ball:{...record.field.motion.cursor!.moment.ball,velocity:{x:-999,y:0,z:0}}}}}}};
  expect(()=>deriveSamePaPhysicalFieldStep(h.source(forged),h.root,forged,forged.evaluationTick,false,[h.root,forged])).toThrow('original history differs');
});
it('inserts all five metadata kinds at the exact post-impulse cut without adding a physical horizon',()=>{
  const h=setup(),firstSource=h.source(h.root),first=deriveSamePaPhysicalFieldStep(firstSource,h.root,h.root,h.root.evaluationTick,false,[h.root]);
  const physical={...h.root,...first,source:firstSource,kind:'same_pa_physical_field_step_v1',operationOrdinal:1} as SamePaPhysicalFieldStep;
  expect(physical.field.motion.world.moment.elapsedSeconds).not.toBe((physical.evaluationTick-h.root.field.motion.world.moment.originTick)/1e6);
  const history:(SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep)[]=[h.root,physical];
  for(const kind of ['defender_observation_v1','defender_decision_v1','defender_candidate_set_v1','defender_team_selection_v1','defender_actor_selection_v1']){
    const previous=history.at(-1)!,source={...h.source(previous),throughTick:previous.evaluationTick,action:{kind} as never};
    const metadata=deriveSamePaSourceFieldMetadataV3(source,h.root,previous,history);
    expect(metadata).toEqual({ballSolverEvidence:previous.ballSolverEvidence});
    history.push({...previous,source,kind:'same_pa_physical_field_step_v1',operationOrdinal:previous.operationOrdinal+1,actionResult:{kind} as never,...metadata} as SamePaPhysicalFieldStep);
  }
  const previous=history.at(-1)!,next=deriveSamePaPhysicalFieldStep(h.source(previous),h.root,previous,previous.evaluationTick,false,history);
  const baseline=deriveSamePaPhysicalFieldStep(h.source(physical),h.root,physical,physical.evaluationTick,false,[h.root,physical]);
  expect(next).toEqual(baseline);expect(JSON.stringify(history.at(-1)!.field)).toBe(JSON.stringify(physical.field));
});
it('rejects changed metadata time, field, timeline, Source side/profile/velocity/spin, custody and diagnostic inheritance',()=>{
  const h=setup(),firstSource=h.source(h.root),first=deriveSamePaPhysicalFieldStep(firstSource,h.root,h.root,h.root.evaluationTick,false,[h.root]);
  const physical={...h.root,...first,source:firstSource,kind:'same_pa_physical_field_step_v1',operationOrdinal:1} as SamePaPhysicalFieldStep;
  const source={...h.source(physical),throughTick:physical.evaluationTick,action:{kind:'defender_observation_v1'} as never};
  expect(()=>deriveSamePaSourceFieldMetadataV3({...source,throughTick:source.throughTick+1},h.root,physical,[h.root,physical])).toThrow();
  const changed=(patch:Partial<SamePaPhysicalFieldStep>)=>({...physical,...patch});
  const c=physical.field.motion.cursor!,m=physical.field.motion;
  const badFields=[{...physical.field,motion:{...m,cursor:null}}, {...physical.field,motion:{...m,carrierPlayerId:'fielder'}},
    ...['incoming','invalid'].map(side=>({...physical.field,motion:{...m,cursor:{...c,sourceSide:side as never}}})),
    ...['velocity','spin'].map(key=>({...physical.field,motion:{...m,cursor:{...c,moment:{...c.moment,ball:{...c.moment.ball,[key]:{x:999,y:0,z:0}}}}}})),
    {...physical.field,motion:{...m,cursor:{...c,sourceCurve:{...c.sourceCurve!,profile:{...c.sourceCurve!.profile,air:{...c.sourceCurve!.profile.air,gravityY:-8}}}}}}];
  for(const field of badFields){const bad=changed({field});expect(()=>deriveSamePaSourceFieldMetadataV3(source,h.root,bad,[h.root,bad])).toThrow();}
  const inherited=deriveSamePaSourceFieldMetadataV3(source,h.root,physical,[h.root,physical]);
  const metadata={...physical,source,operationOrdinal:2,actionResult:{kind:'defender_observation_v1'} as never,...inherited} as SamePaPhysicalFieldStep;
  for(const bad of [ {...metadata,evaluationTick:metadata.evaluationTick+1}, {...metadata,timeline:{...metadata.timeline,nextSequence:99}},
    {...metadata,ballSolverEvidence:{...metadata.ballSolverEvidence!,impulseCertificates:[]}},
    {...metadata,field:{...metadata.field,baseContacts:[{} as never]}},
    {...metadata,field:{...metadata.field,motion:{...metadata.field.motion,actors:metadata.field.motion.actors.map(a=>({...a,primitive:{...a.primitive,acceleration:{x:1,y:0,z:0}}}))}}} ])
    expect(()=>deriveSamePaPhysicalFieldStep(h.source(bad),h.root,bad,bad.evaluationTick,false,[h.root,physical,bad])).toThrow();
});
it('feeds actual Source post-rebound position/velocity into observation and decision, keeping spin in the unchanged physical record',()=>{
  // Model reads alone are mocked. Real Source collision, exact replay, sensory
  // sampling and decision calculations run here; this is not Native admission.
  const x=sourceFieldV3Fixture();
  x.actors[0].primitive.startCenter={x:1,y:1,z:3};
  const batter={...x.actors[0],playerId:'batter',primitive:{...x.actors[0].primitive,startCenter:{x:0,y:1,z:-3}}};
  x.actors.push(batter);x.response.actors.push({...x.response.actors[0],playerId:'batter'});
  x.commands.push({...x.commands[0],playerId:'batter'});
  const h=setup(x),s=h.source(h.root),derived=deriveSamePaPhysicalFieldStep(s,h.root,h.root,h.root.evaluationTick,false,[h.root]);
  const physical={...h.root,...derived,source:s,kind:'same_pa_physical_field_step_v1',operationOrdinal:1} as SamePaPhysicalFieldStep;
  const member={playerId:'fielder',personId:'person',role:'defender',bindingHash:hash('binding')} as never;
  const view={source:{sourceId:'metadata-view'},cut:{evaluationTick:physical.evaluationTick}};
  const basis={view,members:[member]} as unknown as SamePaLifecycleViewBasis;
  const action={physicalPitchSourceId:h.root.physicalPitchSourceId,source:{nominalPitch:{delivery:{matchSeed:1}}},
    actor:{binding:{playerId:'batter'},defenderBindings:[{playerId:'fielder'}],world:{runners:[]},match:{playId:1}}} as unknown as SamePaPhysicalAction;
  const fieldingModel={source:{ratings:{situationalAwareness:.5,firstStep:.5}}};
  const calibration=playerObservationCalibrationFixture();
  const observationValues={...calibration,memoryDecayParameters:{...calibration.memoryDecayParameters,ticksPerSecond:1e6},
    errorParameters:{minimumDetectionQuality:0,minimumPositionErrorMeters:0,maximumPositionErrorMeters:0,minimumVelocityErrorMps:0,maximumVelocityErrorMps:0}};
  const model={source:{sourceId:'nominal',sourceVersion:'synthetic',calibration:observationValues},fieldingModel};modelReads.models.set('nominal',model);
  const ref=(id:string)=>({owner:'pa_lifecycle_v1_execution_calibrations',sourceId:id,sourceHash:hash(id),snapshotHash:hash(id)}) as never;
  for(const [id,route,values,owner]of [['observation','defender_observation',observationValues,'world_player_observation_models'],
    ['decision','defender_decision',playerDecisionCalibrationFixture(),'world_player_decision_models']] as const)
    modelReads.calibrations.set(id,{source:{member,viewReference:reference('pa_lifecycle_v1_execution_views',view as never),route,
      nominalReference:reference(owner,model as never),response:{values}},lineage:h.root.lineage});
  const observationSource={...h.source(physical),throughTick:physical.evaluationTick,viewReference:reference('pa_lifecycle_v1_execution_views',view as never),
    action:{kind:'defender_observation_v1',member,calibrationReference:ref('observation'),previousObservationReference:null,
      view:{poseVersion:'synthetic',bodyRelativeEyeOffset:{x:0,y:0,z:0},forward:{x:0,y:0,z:-1},attentionTarget:{kind:'ball'}}}} as SamePaPhysicalFieldStepSource;
  const observed=deriveSamePaPhysicalFieldAction({} as DatabaseSync,observationSource,h.root,physical,action,basis,[h.root,physical],false);
  const r=observed.actionResult;if(r.kind!=='defender_observation_v1')throw new Error('missing observation');
  const cursor=physical.field.motion.cursor!,truth=createSourceFreeBallKernel(cursor.sourceCurve!).evaluateAt(cursor.moment.elapsedSeconds,cursor.sourceSide).moment;
  expect(r.receipt.samples.ball!.sample.estimate).toEqual({position:truth.ball.position,velocity:truth.ball.velocity});
  expect(r.receipt.at.elapsedSeconds).toBe(truth.elapsedSeconds);expect(r.receipt.samples.ball!.sample.estimate).not.toHaveProperty('spin');
  // A legacy effective-only override must not bypass the new V3 unit contract.
  const originalNominal=model.source.calibration;
  model.source.calibration={...observationValues,memoryDecayParameters:{...observationValues.memoryDecayParameters,ticksPerSecond:1000}};
  const c=modelReads.calibrations.get('observation') as {source:{nominalReference:unknown}};
  c.source.nominalReference=reference('world_player_observation_models',model as never);
  expect(()=>deriveSamePaPhysicalFieldAction({} as DatabaseSync,observationSource,h.root,physical,action,basis,[h.root,physical],false)).toThrow('explicit observation clock projection');
  model.source.calibration=originalNominal;c.source.nominalReference=reference('world_player_observation_models',model as never);
  const record={...physical,...observed,source:observationSource,operationOrdinal:2} as SamePaPhysicalFieldStep;
  const decisionSource={...h.source(record),throughTick:record.evaluationTick,viewReference:observationSource.viewReference,action:{kind:'defender_decision_v1',member,
    calibrationReference:ref('decision'),observationReference:reference('pa_physical_v1_field_steps',record),priorities:{ballPursuitPriority:1,holdPriority:0,
      baseCoverPriorities:[],relayPriority:0,backupPriority:0,deepCoveragePriority:0}}} as SamePaPhysicalFieldStepSource;
  const decided=deriveSamePaPhysicalFieldAction({} as DatabaseSync,decisionSource,h.root,record,action,basis,[h.root,physical,record],false);
  expect(decided.actionResult).toMatchObject({kind:'defender_decision_v1',target:{x:truth.ball.position.x,z:truth.ball.position.z}});
  expect(decided.field).toEqual(physical.field);expect(decided.field.motion.cursor!.moment.ball.spin).toEqual(truth.ball.spin);
  if(!('ballSolverEvidence' in decided))throw new Error('missing inherited Source diagnostics');
  expect(decided.ballSolverEvidence).toEqual(physical.ballSolverEvidence);
  expect(()=>deriveSamePaPhysicalFieldAction({} as DatabaseSync,{...decisionSource,action:{kind:'defender_motion_v1'} as never},h.root,record,action,basis,[h.root,physical,record],false)).toThrow('free checkpoints only');
});
it('keeps a positive-time original root horizon and its diagnostic index while inserting metadata',()=>{
  const h=setup(),first=deriveSamePaPhysicalFieldStep(h.source(h.root),h.root,h.root,h.root.evaluationTick,false,[h.root]);
  if(first.ballSolverEvidence?.solverVersion!=='source_field_contact_escape_v3')throw new Error('original stationary solver required');
  const root={...h.root,...first,ballSolverEvidence:first.ballSolverEvidence,source:{...h.root.source,throughTick:212345}};
  const source={...h.source(root),fieldRootReference:reference('pa_physical_v1_field_roots',root),throughTick:root.evaluationTick,
    action:{kind:'defender_actor_selection_v1'} as never};
  const metadata=deriveSamePaSourceFieldMetadataV3(source,root,root,[root]);
  const record={...root,...metadata,source,kind:'same_pa_physical_field_step_v1',operationOrdinal:1,
    actionResult:{kind:'defender_actor_selection_v1'} as never} as SamePaPhysicalFieldStep;
  const nextSource={...h.source(record),fieldRootReference:reference('pa_physical_v1_field_roots',root)};
  const next=deriveSamePaPhysicalFieldStep(nextSource,root,record,record.evaluationTick,false,[root,record]);
  expect(next.field.motion.world.kind).toBe('moving');expect(next.ballSolverEvidence!.impulseCertificates[0].afterStepIndex).toBe(0);
  expect(metadata.ballSolverEvidence).toEqual(root.ballSolverEvidence);
});
it('rejects a changed solver version, unconnected action or a Source profile different from the original kernel',()=>{
  const h=setup(),source=h.source(h.root);
  expect(()=>deriveSamePaPhysicalFieldStep({...source,sourceVersion:V2STEP},h.root,h.root,h.root.evaluationTick,false,[h.root])).toThrow('original version');
  expect(()=>deriveSamePaPhysicalFieldStep({...source,action:{kind:'capture_checkpoint_v1'} as never},h.root,h.root,h.root.evaluationTick,false,[h.root])).toThrow('free checkpoints only');
  const profile=h.root.source.ballPhysics!,forged={...h.root,source:{...h.root.source,ballPhysics:{...profile,ground:{...profile.ground,material:{...profile.ground.material,restitution:0.9}}}}};
  expect(()=>deriveSamePaPhysicalFieldStep(source,forged,forged,forged.evaluationTick,false,[forged])).toThrow('original history differs');
});

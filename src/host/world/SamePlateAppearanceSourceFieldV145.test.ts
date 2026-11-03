import {expect,it} from 'vitest';
import {sourceFieldV3Fixture} from '../../core/sim/ball/SourceBattedFieldMotionV3.test-support';
import {deriveSourceBattedFieldMotionV145} from '../../core/sim/ball/SourceBattedFieldMotionV145';
import {deriveSamePaPhysicalFieldStep} from './SamePlateAppearancePhysicalFieldCalculation';
import {actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {samePaExecutionReference as reference} from './SamePlateAppearanceExecutionFromSqlite';
import {SAME_PA_POLE_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT,SAME_PA_POLE_ESCAPE_FIELD_STEP_SOURCE_VERSION as STEP,
  SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION as V3STEP} from './SamePlateAppearanceBallPhysics';
import type {SamePaPhysicalFieldRoot,SamePaPhysicalFieldStep,SamePaPhysicalFieldStepSource} from './SamePlateAppearancePhysicalEpisode';
import type {AcceptedSamePaParkEquipmentV145} from './SamePlateAppearanceParkEquipmentV145';

// Structural calculation fixture only. It does not authenticate any Native row.
const setup=()=>{
  const x=sourceFieldV3Fixture(),equipment:AcceptedSamePaParkEquipmentV145={version:'same_pa_park_equipment_v145',sourceId:'equipment',sourceVersion:'synthetic-v1',
    gameId:'game',playId:1,physicalPitchSourceId:'pitch',fixtureEventId:'fixture',venueId:'venue',baseFieldSourceId:'root',worldModelSourceId:'model',
    worldModelSourceVersion:'v1',availableAtDay:1,fenceSurfaceIds:['right-wall'],equipment:{version:'source_park_equipment_v145',poles:[{
      geometry:{surfaceId:'pole',center:{x:2,z:0},minimumHeight:0,maximumHeight:3,radiusM:.1},material:{restitution:.5,tangentialDamping:.25,spinDamping:.2}}]}};
  const trace=deriveSourceBattedFieldMotionV145({initial:x,throughTicks:[],parkEquipment:equipment.equipment}),
    evidence={solverVersion:trace.solverVersion,impulseCertificates:trace.impulseCertificates,escapedIntervals:trace.escapedIntervals};
  const root={kind:'same_pa_physical_field_root_v1',stage:'field',physicalPitchSourceId:'pitch',operationOrdinal:0,pitchOrdinal:3,lineage:{gameId:'game',playId:1},
    source:{sourceId:'root',sourceVersion:ROOT,throughTick:x.availableAtTick,parameters:x.response.world.parameters,ballPhysics:x.cursor.sourceCurve.profile,
      parkEquipment:equipment,launchReference:{sourceId:'pitch'},commands:x.actors.map(a=>({playerId:a.playerId,bodyAcceleration:{x:0,y:0,z:0},
        primitiveMotions:[{role:a.primitive.role,offsetVelocity:{x:0,y:0,z:0},offsetAcceleration:{x:0,y:0,z:0}}]}))},
    geometryBindingHash:hash('geometry'),parkEquipmentBinding:{equipmentHash:hash(equipment),geometryBindingHash:hash('geometry'),fixtureHash:hash('fixture'),
      worldModelHash:hash('model'),responseModelHash:hash('response')},response:x.response,geometry:x.geometry,field:trace.field,ballSolverEvidence:evidence,
    evaluationTick:trace.field.motion.world.moment.ball.tick,timeline:{playId:1,startedAtTick:0,lastEventTick:0,nextSequence:0,events:[],status:{kind:'active',count:{balls:0,strikes:0}}}
  } as unknown as SamePaPhysicalFieldRoot;
  const ref=(f:SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
  const source=(prior:SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep,throughTick=212345):SamePaPhysicalFieldStepSource=>({sourceId:'step'+(prior.operationOrdinal+1),
    sourceVersion:STEP,capability:'same_pa_physical_field_step_v1',viewReference:{owner:'pa_lifecycle_v1_execution_views',sourceId:'view',sourceHash:hash('view'),snapshotHash:hash('view')},
    launchReference:{owner:'pa_physical_v1_launches',sourceId:'pitch',sourceHash:hash('pitch'),snapshotHash:hash('pitch')},
    previousOperationReference:ref(prior),previousFieldReference:ref(prior),fieldRootReference:reference('pa_physical_v1_field_roots',root),throughTick});
  return{root,source};
};
const advance=(h:ReturnType<typeof setup>,prior:SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep,history:readonly(SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep)[],throughTick=212345)=>{
  const source=h.source(prior,throughTick),derived=deriveSamePaPhysicalFieldStep(source,h.root,prior,prior.evaluationTick,false,history);
  return{...prior,...derived,kind:'same_pa_physical_field_step_v1' as const,source,operationOrdinal:prior.operationOrdinal+1};
};
it('replays the original pole root and exact checkpoints, including a later horizon extension',()=>{
  const h=setup(),before=JSON.stringify(h.root),first=advance(h,h.root,[h.root],112345),second=advance(h,first,[h.root,first]);
  expect(first.field.motion.world).toMatchObject({kind:'boundary',contacts:[{kind:'surface',surfaceId:'pole'}]});
  expect(first.field.motion.response.kind).toBe('rebound');expect(second.field.motion.world.kind).toBe('moving');
  expect(second.ballSolverEvidence).toMatchObject({solverVersion:'source_field_pole_contact_escape_v145'});
  expect(second.ballSolverEvidence!.impulseCertificates).toHaveLength(1);expect(second.ballSolverEvidence!.escapedIntervals).toHaveLength(1);
  expect(JSON.stringify(h.root)).toBe(before);
});
it('requires the complete original prefix rather than accepting a serialized diagnostic or cursor',()=>{
  const h=setup(),first=advance(h,h.root,[h.root]);
  expect(()=>deriveSamePaPhysicalFieldStep(h.source(first),h.root,first,first.evaluationTick,false)).toThrow(/original.*history/);
  const bad={...first,ballSolverEvidence:{...first.ballSolverEvidence!,impulseCertificates:[]}};
  expect(()=>advance(h,bad,[h.root,bad])).toThrow(/original.*history/);
  const c=first.field.motion.cursor!,forged={...first,field:{...first.field,motion:{...first.field.motion,cursor:{...c,moment:{...c.moment,
    ball:{...c.moment.ball,velocity:{x:-999,y:0,z:0}}}}}}};
  expect(()=>advance(h,forged,[h.root,forged])).toThrow(/original.*history/);
});
it('rejects missing equipment binding, changed complete geometry and spliced predecessor or algorithm',()=>{
  const h=setup();
  const{parkEquipmentBinding:_,...missing}=h.root;
  for(const root of [missing,{...h.root,geometryBindingHash:hash('foreign')},
    {...h.root,source:{...h.root.source,parkEquipment:{...h.root.source.parkEquipment!,sourceVersion:'foreign'}}}])
    expect(()=>deriveSamePaPhysicalFieldStep(h.source(root),root,root,root.evaluationTick,false,[root])).toThrow(/equipment/);
  const first=advance(h,h.root,[h.root]),s=h.source(first);
  expect(()=>deriveSamePaPhysicalFieldStep({...s,previousFieldReference:s.fieldRootReference},h.root,first,first.evaluationTick,false,[h.root,first])).toThrow();
  expect(()=>deriveSamePaPhysicalFieldStep({...s,sourceVersion:V3STEP},h.root,first,first.evaluationTick,false,[h.root,first])).toThrow();
});

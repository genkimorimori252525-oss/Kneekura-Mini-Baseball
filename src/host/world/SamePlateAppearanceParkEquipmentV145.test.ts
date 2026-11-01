import {expect,it} from 'vitest';
import {DEFAULT_BALL_FLIGHT_PARAMETERS} from '../../core/sim/ball/BallFlight';
import {sourceFieldV3Fixture} from '../../core/sim/ball/SourceBattedFieldMotionV3.test-support';
import {actorHash as hash,type DurablePhysicalPlateAppearanceActor} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {samePaPhysicalEpisodeSourceInput} from './SamePlateAppearancePhysicalEpisode';
import {samePaFieldBallPhysics,assertSamePaFieldBallPhysicsStep,
  SAME_PA_POLE_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT,SAME_PA_POLE_ESCAPE_FIELD_STEP_SOURCE_VERSION as STEP,
  SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION as V3ROOT,SAME_PA_AERO_GROUND_ESCAPE_FIELD_STEP_SOURCE_VERSION as V3STEP} from './SamePlateAppearanceBallPhysics';
import {samePaParkEquipmentInputV145,bindSamePaParkEquipmentV145,type AcceptedSamePaParkEquipmentV145} from './SamePlateAppearanceParkEquipmentV145';
import type {AcceptedBattedWorldModel} from './BattedWorldModel';
const ref=<T extends string>(owner:T)=>({owner,sourceId:owner,sourceHash:hash(owner),snapshotHash:hash(owner)});
const equipment=():AcceptedSamePaParkEquipmentV145=>({version:'same_pa_park_equipment_v145',sourceId:'equipment',sourceVersion:'synthetic-v1',
  gameId:'game',playId:1,physicalPitchSourceId:'pa_physical_v1_launches',fixtureEventId:'fixture',venueId:'venue',
  baseFieldSourceId:'root',worldModelSourceId:'model',worldModelSourceVersion:'model-v1',availableAtDay:1,fenceSurfaceIds:['right-wall'],
  equipment:{version:'source_park_equipment_v145',poles:[{geometry:{surfaceId:'pole',center:{x:2,z:0},minimumHeight:0,maximumHeight:3,radiusM:.1},
    material:{restitution:.5,tangentialDamping:.25,spinDamping:.2}}]}});
const source=()=>({sourceId:'root',sourceVersion:ROOT,capability:'same_pa_physical_field_root_v1',viewReference:ref('pa_lifecycle_v1_execution_views'),
  launchReference:ref('pa_physical_v1_launches'),previousOperationReference:ref('pa_physical_v1_resolutions'),resolutionReference:ref('pa_physical_v1_resolutions'),
  postureReference:ref('batting_observation_v1_postures'),fieldInputs:{kind:'fresh_physical_field_calibration_v1',calibrationReference:ref('pa_physical_v1_field_calibrations')},
  commands:Array.from({length:10},(_,i)=>({playerId:String(i)})),parameters:{...DEFAULT_BALL_FLIGHT_PARAMETERS,integrationStepTicks:2000},
  throughTick:1,ballPhysics:sourceFieldV3Fixture().cursor.sourceCurve.profile,parkEquipment:equipment()});
const parsed=()=>{const r=samePaPhysicalEpisodeSourceInput(source());if(r.capability!=='same_pa_physical_field_root_v1')throw Error('root required');return r;};
const scope=()=>{
  const fixture={game_id:'game',fixture_event_id:'fixture',venue_id:'venue'};
  const actor={source:{gameId:'game'},match:{playId:1},binding:{fixtureEventId:'fixture',gameDay:1},fixtureHash:hash(fixture)} as unknown as DurablePhysicalPlateAppearanceActor;
  const model:AcceptedBattedWorldModel={sourceId:'model',sourceVersion:'model-v1',gameId:'game',careerId:'career',fixtureEventId:'fixture',venueId:'venue',availableAtDay:1,
    actors:[],batterGripOffset:{x:0,y:0,z:0},surfaces:sourceFieldV3Fixture().response.world.surfaces};
  const responseModel={sourceId:'response',sourceVersion:'response-v1',gameId:'game',careerId:'career',fixtureEventId:'fixture',venueId:'venue',availableAtDay:1};
  return{actor,model,responseModel,fixture,geometryBindingHash:hash('original-geometry')};
};
it('accepts only the explicit new root algorithm and freezes the complete sidecar without changing its Source',()=>{
  const raw=source(),before=JSON.stringify(raw),r=parsed(),binding=bindSamePaParkEquipmentV145(r,scope());
  expect(r).toEqual(raw);expect(JSON.stringify(raw)).toBe(before);expect(Object.isFrozen(r.parkEquipment!.equipment.poles[0].material)).toBe(true);
  expect(binding).toMatchObject({equipmentHash:hash(raw.parkEquipment),geometryBindingHash:hash('original-geometry')});
  expect(samePaFieldBallPhysics(r)).toEqual(raw.ballPhysics);expect(binding).not.toHaveProperty('fair');expect(binding).not.toHaveProperty('homeRun');
});
it('does not allow old roots to absorb equipment or new roots to omit the profile or sidecar',()=>{
  const r=source(),{parkEquipment:_,...old}=r;
  expect(samePaPhysicalEpisodeSourceInput({...old,sourceVersion:V3ROOT})).toEqual({...old,sourceVersion:V3ROOT});
  for(const bad of [{...r,sourceVersion:V3ROOT},{...r,parkEquipment:undefined},old,{...r,ballPhysics:undefined},
    {...r,parkEquipment:{...r.parkEquipment,fair:true}}])expect(()=>samePaPhysicalEpisodeSourceInput(bad)).toThrow();
});
it('keeps new steps on the same root algorithm and rejects old, action, or equipment replacement branches',()=>{
  const r=parsed();expect(()=>assertSamePaFieldBallPhysicsStep({sourceVersion:STEP},r,r,true)).not.toThrow();
  expect(()=>assertSamePaFieldBallPhysicsStep({sourceVersion:STEP},r,{sourceVersion:STEP},false)).not.toThrow();
  for(const s of [{sourceVersion:V3STEP},{sourceVersion:STEP,action:{kind:'defender_motion_v1'}},{sourceVersion:STEP,action:undefined}])
    expect(()=>assertSamePaFieldBallPhysicsStep(s,r,r,true)).toThrow();
  expect(()=>assertSamePaFieldBallPhysicsStep({sourceVersion:STEP},r,{sourceVersion:V3STEP},false)).toThrow();
  const rootRef=ref('pa_physical_v1_field_roots');
  expect(()=>samePaPhysicalEpisodeSourceInput({sourceId:'step',sourceVersion:STEP,capability:'same_pa_physical_field_step_v1',
    viewReference:r.viewReference,launchReference:r.launchReference,previousOperationReference:rootRef,previousFieldReference:rootRef,
    fieldRootReference:rootRef,throughTick:2,parkEquipment:equipment()})).toThrow();
});
it.each(['gameId','playId','physicalPitchSourceId','fixtureEventId','venueId','baseFieldSourceId','worldModelSourceId','worldModelSourceVersion','availableAtDay'] as const)(
  'rejects a different original %s before issuing a physical query',key=>{
    const r=parsed(),value={...equipment(),[key]:key==='playId'||key==='availableAtDay'?2:'foreign'};
    expect(()=>bindSamePaParkEquipmentV145({...r,parkEquipment:value},scope())).toThrow(/original.*scope/);
  });
it('binds the complete original fixture, model, response and geometry and checks all wall membership',()=>{
  const r=parsed(),original=scope(),a=bindSamePaParkEquipmentV145(r,original)!;
  expect(a.fixtureHash).toBe(hash(original.fixture));expect(a.worldModelHash).toBe(hash(original.model));expect(a.responseModelHash).toBe(hash(original.responseModel));
  expect(()=>bindSamePaParkEquipmentV145(r,{...original,fixture:{...original.fixture,venue_id:'foreign'}})).toThrow();
  expect(()=>bindSamePaParkEquipmentV145(r,{...original,responseModel:{...original.responseModel,venueId:'foreign'}})).toThrow();
  expect(()=>bindSamePaParkEquipmentV145({...r,parkEquipment:{...equipment(),fenceSurfaceIds:['absent']}},original)).toThrow();
  const p=equipment(),pole=p.equipment.poles[0];
  expect(()=>bindSamePaParkEquipmentV145({...r,parkEquipment:{...p,equipment:{...p.equipment,poles:[{...pole,geometry:{...pole.geometry,surfaceId:'right-wall'}}]}}},original)).toThrow();
});
it('validates unused geometry/material and rejects result, contact, proof or duplicate sidecar payloads',()=>{
  const p=equipment(),pole=p.equipment.poles[0];
  for(const bad of [{...p,equipment:{...p.equipment,poles:[{...pole,material:{...pole.material,restitution:2}}]}},
    {...p,equipment:{...p.equipment,poles:[pole,pole]}},{...p,fenceSurfaceIds:['right-wall','right-wall']},
    ...['contacts','impulseCertificates','homeRun'].map(key=>({...p,[key]:[]}))])expect(()=>samePaParkEquipmentInputV145(bad)).toThrow();
});
it('leaves ordinary legacy roots without equipment unchanged',()=>{
  const{parkEquipment:_,...r}=parsed();const old={...r,sourceVersion:V3ROOT};
  expect(bindSamePaParkEquipmentV145(old,scope())).toBeUndefined();
});

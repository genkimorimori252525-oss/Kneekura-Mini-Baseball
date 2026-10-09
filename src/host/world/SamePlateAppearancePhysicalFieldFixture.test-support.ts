import { createFairTerritoryWedge } from '../../core/sim/ball/FairTerritoryGeometry';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { openSqlitePlayerBodyCapabilityMaterializationStore } from './SqlitePlayerBodyCapabilityMaterializationStore';
import type { BattedBodyModelAssembly } from './PlayerBodyCapabilityMaterialization';
import type { SamePaPhysicalFieldCalibrationSource, SamePaPhysicalResolution } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { DurableBattingInvocationPosture } from './NativeBattingPerception';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
type Fixture=ReturnType<typeof samePaPhysicalLifecycleFixture>;

/** Explicit values from BattedWorldContact/Field/ContactResponse fixtures.
 * Normal ten-body assembly is accepted without an old flight, contact, field
 * row, or copied receipt. The new calibration preparation emits no work fact. */
export const prepareFreshPhysicalFieldFixture=(h:Fixture,prepared:ReturnType<Fixture['prepareAction']>,posture:DurableBattingInvocationPosture,
  postureReference:SamePaReference<'batting_observation_v1_postures'>,label:string,
  options:Readonly<{liveProducerProfile?:'same_pa_empty_base_catch_v1'}>={})=>{
  const {f}=h,action=prepared.action,bodies=[posture.model.bodyMaterialization,...posture.sceneBodies];
  const fixture=f.db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').get(f.actor.source.gameId)!;
  const assembly:BattedBodyModelAssembly={sourceId:label+':body-model',sourceVersion:'fixture-only-v1',kind:'body_materialized_batted_model_v1',
    gameId:f.actor.source.gameId,careerId:f.actor.binding.careerId,fixtureEventId:f.actor.binding.fixtureEventId,venueId:String(fixture.venue_id),availableAtDay:1,atDay:f.actor.binding.gameDay,
    actors:bodies.map(b=>({playerId:b.source.playerId,personId:b.person.personId,materializationRef:{sourceId:b.source.sourceId,sourceVersion:b.source.sourceVersion}})),
    batterGripOffset:{x:0.5,y:0.9,z:0},surfaces:[]};
  const bodyOwner=f.x.f.track(openSqlitePlayerBodyCapabilityMaterializationStore(f.path,{readAcceptedMaterialization:()=>null,readAcceptedBody:()=>null,
    readAcceptedPose:()=>null,readAcceptedReachCalibration:()=>null,readAcceptedModelAssembly:id=>id===assembly.sourceId?assembly:null}));
  const model=bodyOwner.acceptModel(assembly.sourceId),bodyModelReference={owner:'world_batted_body_materializations' as const,sourceId:assembly.sourceId,sourceHash:hash(assembly),snapshotHash:hash(model)};
  const center=action.baseCenters,ray=(p:{x:number;z:number})=>({x:p.x/Math.hypot(p.x,p.z),z:p.z/Math.hypot(p.x,p.z)});
  const field=createFairTerritoryWedge({homePlate:{x:0,z:0},firstBaseLineUnit:ray(center.first),thirdBaseLineUnit:ray(center.third)});
  const bag=(center:{x:number;z:number})=>({region:{center,halfSize:{x:0.01,z:0.2},rotationRadians:0},surfaceHeightMeters:0.1});
  const material={restitution:0.5,tangentialDamping:0.25,spinDamping:0.2},baseModel={bottomY:0,material};
  const parameters={ticksPerSecond:1_000_000,gravityY:-9.81,ballRadius:0.0366,groundRestitution:0.35,groundFriction:0.78,
    groundRollingDecelerationMps2:4,integrationStepTicks:2_000,restingVerticalSpeed:0.5};
  const source:SamePaPhysicalFieldCalibrationSource={sourceId:label+':calibration',sourceVersion:'fixture-only-v1',capability:'same_pa_physical_field_calibration_v1',
    viewReference:h.current().viewReference,actionReference:prepared.actionReference,postureReference,bodyModelReference,availableAtDay:1,geometryRef:'synthetic-field-contact-v1',field,
    bases:{home:bag(field.homePlate),first:bag(center.first),second:bag(center.second),third:bag(center.third)},baseModels:{home:baseModel,first:baseModel,second:baseModel,third:baseModel},parameters,
    responseModel:{sourceId:label+':response-model',sourceVersion:'fixture-only-v1',gameId:model.gameId,careerId:model.careerId,fixtureEventId:model.fixtureEventId,venueId:model.venueId,availableAtDay:1,
      actors:model.actors.map(a=>({playerId:a.playerId,personId:a.personId,primitives:a.primitives.map(p=>p.role!=='glove'?{role:p.role,material}:{role:'glove',
        pocketCenterOffset:{x:0,y:0,z:-0.08},bodyStability:1,parameters:{ticksPerSecond:1_000_000,ballMassKg:0.145,ballRadiusMeters:0.0366,pocketRadiusMeters:0.2,
          centerRetentionCapacityJ:1_000_000,captureDissipationPowerW:1000,failedContactRestitution:0.5,failedTangentialDamping:0.25,failedSpinDamping:0.2}})})),surfaces:[]}};
  h.save(source);const calibration=h.physical.acceptFieldCalibration(source.sourceId);if(calibration.kind!=='same_pa_physical_field_calibration_prepared_v1')throw new Error('real fresh field calibration pending');
  const calibrationReference=reference('pa_physical_v1_field_calibrations',calibration);
  const appendField=(resolution:SamePaPhysicalResolution,resolutionReference:SamePaReference<'pa_physical_v1_resolutions'>)=>{
    if(!resolution.contact)throw new Error('real fresh field requires actual contact');
    const rootSource=h.save({sourceId:label+':field-root',sourceVersion:'fixture-only-v1',capability:'same_pa_physical_field_root_v1',viewReference:h.current().viewReference,
      launchReference:resolution.source.launchReference,previousOperationReference:resolutionReference,resolutionReference,postureReference,
      fieldInputs:{kind:'fresh_physical_field_calibration_v1',calibrationReference},parameters,throughTick:resolution.contact.tick,
      ...(options.liveProducerProfile?{liveProducerProfile:options.liveProducerProfile}:{}),
      commands:model.actors.map(a=>({playerId:a.playerId,bodyAcceleration:{x:0,y:0,z:0},primitiveMotions:a.primitives.map(p=>({role:p.role,offsetVelocity:{x:0,y:0,z:0},offsetAcceleration:{x:0,y:0,z:0}}))}))});
    const root=h.physical.acceptOperation(rootSource.sourceId);if(root.kind!=='same_pa_physical_field_root_v1')throw new Error('real fresh field root pending');
    const rootReference=reference('pa_physical_v1_field_roots',root);h.advance(rootReference);
    if(!root.field.motion.cursor)throw new Error('explicit stationary field fixture has an unresolved initial contact');
    const stepSource=h.save({sourceId:label+':field-step',sourceVersion:'fixture-only-v1',capability:'same_pa_physical_field_step_v1',viewReference:h.current().viewReference,
      launchReference:resolution.source.launchReference,previousOperationReference:rootReference,fieldRootReference:rootReference,previousFieldReference:rootReference,
      throughTick:resolution.contact.tick+2_000_000});
    const step=h.physical.acceptOperation(stepSource.sourceId);if(step.kind!=='same_pa_physical_field_step_v1')throw new Error('real retained field step pending');
    const stepReference=reference('pa_physical_v1_field_steps',step);h.advance(stepReference);return{root,rootReference,step,stepReference};
  };
  return{source,calibration,calibrationReference,model,appendField};
};

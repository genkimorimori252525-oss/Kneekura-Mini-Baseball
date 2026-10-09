import type { DatabaseSync } from 'node:sqlite';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { createBattedWorldBaseGeometry } from '../../core/sim/ball/BattedWorldBaseGeometry';
import { createBattedWorldFieldGeometry, deriveBattedWorldFieldMotionAdoption, deriveBattedWorldFieldMotionCheckpoint, advanceBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { composeDefenderPhysicalPrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { deriveAndRecordFirstGroundContactEvidence } from '../../core/sim/plateAppearance/BattedBallTimelinePhysicalAdapter';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { battedWorldFieldCalibrationEvidenceFromSqlite } from './BattedWorldFieldCalibrationEvidenceFromSqlite';
import { battedWorldContactEvidenceFromSqlite } from './SqliteBattedWorldContactStore';
import { battedContactResponseEvidenceFromSqlite } from './SqliteBattedContactResponseStore';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import type { SamePaPhysicalAction, SamePaPhysicalLaunch, SamePaPhysicalCommitment, SamePaPhysicalResolution,
  SamePaPhysicalFieldRootSource, SamePaPhysicalFieldStepSource, SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldCalibration } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleView } from './SamePlateAppearanceLifecycle';
import { bindSamePaPlayableWallPolicy } from './SamePlateAppearancePlayableWallPolicy';
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('same-PA field original calibration/body/command differs');};
const sourceModel=(ref:SamePaReference,model:{sourceId:string;sourceVersion:string}|null)=>{if(!model)throw new Error('same-PA field accepted model missing');same(ref,{owner:ref.owner,sourceId:model.sourceId,sourceHash:hash(model),snapshotHash:hash(model)});return model;};
const zero=(v:unknown):boolean=>samePaFields(v,['x','y','z'])&&Object.values(v).every(n=>n===0);
const roles=['glove','body','tag_hand','left_foot','right_foot'] as const;
export const samePaPhysicalTimelineAtField=(timeline:CanonicalPlateAppearanceTimeline,field:SamePaPhysicalFieldRoot['field'],response:SamePaPhysicalFieldRoot['response'],geometry:SamePaPhysicalFieldRoot['geometry'])=>{
  const world=field.motion.world;
  if(timeline.status.kind!=='batted_ball_pending'||world.kind!=='boundary'||world.contacts.length!==1||world.contacts[0].kind!=='ground')return timeline;
  if(timeline.events.some(event=>event.kind==='BattedBallFirstGroundContact'&&event.tick>=response.world.flight.contact.tick))return timeline;
  const contact=response.world.flight.contact,ground=deriveAndRecordFirstGroundContactEvidence({timeline,field:geometry.baseGeometry.field,
    searchDurationTicks:world.moment.ball.tick-contact.tick,ballFlightParameters:response.world.parameters});
  if(ground.kind!=='recorded'||ground.territory.tick!==world.moment.ball.tick)throw new Error('actual field ground boundary differs from its original contact');return ground.timeline;
};

/** New dynamic field binding. Only reusable venue/model calibrations are read
 * from the existing normal owners; their old flight, response and actor paths
 * are never copied into the new episode. This first bridge retains explicit
 * stationary body commands. New moving commands need their own controller. */
export const deriveSamePaPhysicalFieldRoot=(db:DatabaseSync,source:SamePaPhysicalFieldRootSource,input:Readonly<{
  launch:SamePaPhysicalLaunch;action:SamePaPhysicalAction;resolution:SamePaPhysicalResolution;currentView:SamePaLifecycleView;commitment:SamePaPhysicalCommitment|null;
  calibration:SamePaPhysicalFieldCalibration|null;
}>)=>{
  const {launch,action,resolution,currentView}=input,actor=action.actor;
  if(!resolution.contact||resolution.physicalPitchSourceId!==launch.source.sourceId||resolution.timeline.status.kind!=='batted_ball_pending')throw new Error('physical field root requires actual bat contact');
  if(source.throughTick<currentView.cut.evaluationTick||source.throughTick<resolution.evaluationTick)throw new Error('physical field root backdates its current cut');
  const binding=(()=>{
    const pins=source.fieldInputs;
    if(pins.kind==='fresh_physical_field_calibration_v1'){
      const value=input.calibration;if(!value||value.physicalPitchSourceId!==launch.source.sourceId)throw new Error('physical field fresh calibration missing');
      same(source.parameters,value.calibration.parameters);return{...value.calibration,geometryBindingHash:hash(value)};
    }
    if(input.calibration!==null)throw new Error('reused field arm has a foreign fresh calibration');
    const owner=battedWorldFieldCalibrationEvidenceFromSqlite(db),calibration=owner.readGeometry(pins.geometryReference.sourceId);if(!calibration)throw new Error('physical field venue calibration missing');
    same(pins.geometryReference,{owner:'batted_world_field_geometries',sourceId:calibration.source.sourceId,sourceHash:hash(calibration.source),snapshotHash:hash(calibration)});owner.historicalGeometry(calibration);
    const base=calibration.baseGeometry;
    if(base.fixture.game_id!==actor.source.gameId||base.fixture.fixture_event_id!==actor.binding.fixtureEventId||base.source.availableAtDay>actor.binding.gameDay)throw new Error('physical field reusable venue scope differs');
    const model=battedWorldContactEvidenceFromSqlite(db).readModel(pins.modelReference.sourceId),responseModel=battedContactResponseEvidenceFromSqlite(db).readModel(pins.responseModelReference.sourceId);
    sourceModel(pins.modelReference,model);sourceModel(pins.responseModelReference,responseModel);if(!model||!responseModel)throw new Error('field model missing');
    return{geometry:createBattedWorldFieldGeometry({baseGeometry:createBattedWorldBaseGeometry({field:base.geometry.field,bases:base.source.bases}),baseModels:calibration.source.baseModels}),
      model,responseModel,fixture:base.fixture,geometryBindingHash:hash(calibration)};
  })();
  const {geometry,model,responseModel,fixture,geometryBindingHash}=binding;
  const venuePolicyBinding=bindSamePaPlayableWallPolicy(source,{actor,model,fixture,geometryBindingHash});
  for(const id of ['first','second','third'] as const)same(geometry.baseGeometry.bases[id].region.center,action.baseCenters[id]);
  if(model.kind!=='body_materialized_batted_model_v1'||model.gameId!==actor.source.gameId||model.careerId!==actor.binding.careerId||model.fixtureEventId!==actor.binding.fixtureEventId
    ||model.availableAtDay>actor.binding.gameDay||model.venueId!==fixture.venue_id||responseModel.gameId!==model.gameId||responseModel.careerId!==model.careerId
    ||responseModel.fixtureEventId!==model.fixtureEventId||responseModel.venueId!==model.venueId||responseModel.availableAtDay>actor.binding.gameDay)throw new Error('field normal model scope differs');
  const posture=readBattingPerceptionFromSqlite(db,'posture',source.postureReference);if(posture.kind!=='batting_invocation_posture'||posture.physicalPitchSourceId!==launch.source.sourceId)throw new Error('field current episode posture missing');
  same(posture.lineage,launch.lineage);same(posture.source.modelReference,action.source.batterModelReference);same(posture.source.actionReference,launch.source.actionReference);
  const bodies=[posture.model.bodyMaterialization,...posture.sceneBodies],bindings=[actor.binding,...actor.defenderBindings],p=source.parameters;
  if(model.actors.length!==10||responseModel.actors.length!==10||bodies.length!==10||new Set(bodies.map(b=>b.source.playerId)).size!==10
    ||source.commands.length!==10||new Set(source.commands.map(c=>c.playerId)).size!==10||p.ticksPerSecond!==launch.trajectory.parameters.ticksPerSecond
    ||p.ballRadius!==posture.model.equipment.values.ball.radiusM||p.integrationStepTicks<=0||!Number.isSafeInteger(p.integrationStepTicks)
    ||p.groundRestitution<0||p.groundRestitution>1||p.groundFriction<0||p.groundFriction>1||p.groundRollingDecelerationMps2<0||p.restingVerticalSpeed<0)throw new Error('field ten bodies or explicit physical parameters differ');
  if(responseModel.actors.some(a=>a.primitives.some(profile=>profile.role==='glove'&&profile.parameters.ballMassKg!==posture.model.equipment.values.ball.massKg)))throw new Error('field response original ball mass differs');
  const start=resolution.contact.tick,end=posture.source.geometry.validUntilTick;if(source.throughTick>end||end<start)throw new Error('field body coverage unavailable');
  const actors=bodies.flatMap(body=>{
    const binding=bindings.find(b=>b.playerId===body.source.playerId),shape=model.actors.find(a=>a.playerId===body.source.playerId),profile=responseModel.actors.find(a=>a.playerId===body.source.playerId),command=source.commands.find(c=>c.playerId===body.source.playerId);
    if(!binding||!shape||!profile||!command||binding.personId!==body.person.personId||binding.personLinkSourceId!==body.person.sourceId||profile.personId!==binding.personId)throw new Error('field original Person/body missing');
    same(shape,body.actor);
    if(!samePaFields(command,['playerId','bodyAcceleration','primitiveMotions'])||!zero(command.bodyAcceleration)||command.primitiveMotions.length!==5
      ||new Set(command.primitiveMotions.map(r=>r.role)).size!==5||command.primitiveMotions.some(r=>!samePaFields(r,['role','offsetVelocity','offsetAcceleration'])||!roles.includes(r.role)||!zero(r.offsetVelocity)||!zero(r.offsetAcceleration)))throw new Error('moving field commands require an owned effective controller');
    const defender=action.physicalWorld.defenders.find(d=>d.playerId===body.source.playerId);
    if(defender&&(defender.velocity.x!==0||defender.velocity.z!==0))throw new Error('retained field body has moving original state');
    const position=defender?{x:defender.position.x,y:body.actor.bodyOriginHeightMeters,z:defender.position.z}:posture.source.geometry.centerOfMass;
    return body.actor.primitives.map(shape=>({playerId:body.source.playerId,primitive:composeDefenderPhysicalPrimitiveSegment({startTick:start,endTick:end,ticksPerSecond:p.ticksPerSecond,
      startPosition:position,startVelocity:{x:0,y:0,z:0},acceleration:command.bodyAcceleration},{role:shape.role,radius:shape.radius,startTick:start,endTick:end,ticksPerSecond:p.ticksPerSecond,
      startOffset:shape.offset,offsetVelocity:command.primitiveMotions.find(r=>r.role===shape.role)!.offsetVelocity,offsetAcceleration:command.primitiveMotions.find(r=>r.role===shape.role)!.offsetAcceleration})}));
  });
  const flight=createBattedBallFlightEvidence({contact:resolution.contact,searchDurationTicks:0,parameters:p});
  const response={world:{flight,parameters:p,throughTick:start,actors,surfaces:model.surfaces},actors:responseModel.actors.flatMap(a=>a.primitives.map(profile=>({playerId:a.playerId,profile}))),surfaces:responseModel.surfaces};
  const commands=source.commands.flatMap(c=>c.primitiveMotions.map(r=>({playerId:c.playerId,role:r.role,acceleration:{x:c.bodyAcceleration.x+r.offsetAcceleration.x,y:c.bodyAcceleration.y+r.offsetAcceleration.y,z:c.bodyAcceleration.z+r.offsetAcceleration.z}})));
  const physical={response,geometry,actors,carrierPlayerId:null,cursor:{moment:{originTick:start,elapsedSeconds:0,ball:flight.initialBall},previousContacts:[]},availableAtTick:start,coverageThroughTick:end,commands};
  const field=source.throughTick===start?deriveBattedWorldFieldMotionAdoption(physical):deriveBattedWorldFieldMotionCheckpoint({...physical,checkpointThroughTick:source.throughTick});
  return freeze({response,geometry,field,geometryBindingHash,evaluationTick:field.motion.world.moment.ball.tick,timeline:samePaPhysicalTimelineAtField(resolution.timeline,field,response,geometry),
    ...(venuePolicyBinding===undefined?{}:{venuePolicyBinding})});
};
export const deriveSamePaPhysicalFieldStep=(source:SamePaPhysicalFieldStepSource,root:SamePaPhysicalFieldRoot,previous:SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep,currentTick:number,recordInitialGroundContact=true)=>{
  if(root.physicalPitchSourceId!==previous.physicalPitchSourceId||source.throughTick<=currentTick||source.throughTick<=previous.evaluationTick)throw new Error('physical field step is stale or foreign');
  const p=previous.field.motion;if(!p.cursor)throw new Error('field physical contact requires its concrete acquisition/response owner');
  const field=advanceBattedWorldFieldMotionCheckpoint({response:root.response,geometry:root.geometry,cursor:p.cursor,actors:p.actors,carrierPlayerId:p.carrierPlayerId,checkpointThroughTick:source.throughTick});
  return freeze({field,evaluationTick:field.motion.world.moment.ball.tick,timeline:recordInitialGroundContact?samePaPhysicalTimelineAtField(previous.timeline,field,root.response,root.geometry):previous.timeline});
};

import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createHeldToMeasuredBatControlV1,createCoupledHeldMeasuredBatBodyControlV1 } from '../../core/sim/contact/HeldToMeasuredBatControlV1';
import { readMeasuredBattingBodyReferenceFromSqlite,measuredBattingBodyReferenceTable,type MeasuredBattingBodyReference } from './SqliteMeasuredBattingBodyReferenceStore';
import { createMeasuredBatAxisReferenceV1 } from '../../core/sim/contact/MeasuredBatAxisReferenceV1';
import type { MeasuredBattingProfileV1 } from '../../core/world/psychology/batting/MeasuredBattingTrajectoryV1';
import type { ReferenceBatKinematicsInputV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { safeTickSum } from '../../core/world/psychology/execution/ExecutionValidation';
import { actorFreeze as freeze,actorJson as json,actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readInitialBatEquipmentFromSqlite,type InitialBatEquipmentReference } from './SqliteInitialBatEquipmentStore';
import { assertCurrentObservedInitialPitchOperationFromSqlite,readHistoricalObservedInitialPitchOperationFromSqlite } from './SqliteObservedInitialPitchStore';
import { readSamePaObservedPitchFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { readSamePaInitialPlayFromSqlite } from './SqliteSamePlateAppearanceInitialBallStore';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readEmotionWorldRevisionFromSqlite,readHistoricalEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { deriveSamePaObservedPitchScene } from './SamePlateAppearanceInitialBallProof';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';

export type InitialMeasuredBatControlRequestV1=Readonly<{
  initialBatReference:InitialBatEquipmentReference;decisionReference:SamePaReference<'pa_observed_initial_v1_operations'>;
  bridgeStartTick:number;throughTick:number;
}>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial measured bat control: '+message);}
const same=(a:unknown,b:unknown)=>{assert(json(a)===json(b),'original dependency or current World differs');};

/** Private current Native proof -> explicit control preparation only. This
 * cannot issue a motion, consume an execution right or renew another actor.
 * An eventual physical owner must call it again in its own adoption proof. */
export function prepareInitialMeasuredBatControlFromSqlite(db:DatabaseSync,raw:InitialMeasuredBatControlRequestV1){
  const p=parameters(db,raw),result=createHeldToMeasuredBatControlV1(p.control);
  return freeze({kind:'initial_measured_bat_control_preparation_v1' as const,...p.metadata,control:result.input,certificate:result.certificate});
}
function parameters(db:DatabaseSync,raw:InitialMeasuredBatControlRequestV1,current=true){
  const r=cloneInert(raw);
  assert(fields(r,['initialBatReference','decisionReference','bridgeStartTick','throughTick'])
    &&validRef(r.initialBatReference,'batting_initial_equipment_v1_sources')&&validRef(r.decisionReference,'pa_observed_initial_v1_operations')
    &&Number.isSafeInteger(r.bridgeStartTick)&&r.bridgeStartTick>=0&&Number.isSafeInteger(r.throughTick)&&r.throughTick>r.bridgeStartTick,'invalid preparation request');
  const decision=(current?assertCurrentObservedInitialPitchOperationFromSqlite:readHistoricalObservedInitialPitchOperationFromSqlite)(db,r.decisionReference);
  assert(decision.kind==='observed_initial_decision_v1'&&decision.calculation.status==='READY','current owned initial batting decision required');
  const commitment=decision.calculation.commitment;
  assert(commitment?.action==='SWING'&&commitment.sampledTrajectoryV1&&commitment.trajectory===null,'an actual measured SWING calculation is required');
  const {pitch,action}=readSamePaObservedPitchFromSqlite(db,decision.source.launchReference),binding=pitch.initialLiveBallBinding;
  assert(binding.kind==='same_pa_observed_initial_pitch_live_binding_v2','pre-pitch owned bat required');same(binding.initialBatReference,r.initialBatReference);
  const bat=readInitialBatEquipmentFromSqlite(db,r.initialBatReference);same(bat,binding.initialBat);
  const initial=readSamePaInitialPlayFromSqlite(db,pitch.source.initialPlayReference),posture=readBattingPerceptionFromSqlite(db,'posture',initial.setup.source.postureReference);
  assert(posture.kind==='batting_invocation_posture','original posture required');same(bat.modelReference,posture.source.modelReference);
  const model=posture.model,body=model.bodyMaterialization,g=posture.source.geometry;
  const profile=decision.calculation.effectiveValues.repertoire.sampledProfiles?.find(p=>p.profileId===commitment.profileId);
  assert(profile&&profile.measured.handReferenceFromKnobM===bat.binding.control.handReferenceFromKnobM,'a different grip requires its own explicit transfer');
  same(commitment.sampledTrajectoryV1.frames,createReferenceFrames(profile,commitment.sampledTrajectoryV1));
  const world=current?readEmotionWorldRevisionFromSqlite(db,pitch.lineage.careerId)
    :readHistoricalEmotionWorldRevisionFromSqlite(db,pitch.lineage.careerId,decision.source.expectedWorld.worldRevision);assert(world,'original World required');
  same(decision.source.expectedWorld,{careerId:pitch.lineage.careerId,worldRevision:world.head.worldRevision,controlRevision:world.head.control.revision,controlHash:hash(world.head.control)});
  const earliestBridgeTick=Math.max(g.bodyReadyTick,safeTickSum(decision.evaluationTick,decision.calculation.effectiveValues.motor.motorLatencyTicks,'initial.batApproach.motorLatency'));
  assert(r.bridgeStartTick>=earliestBridgeTick&&r.throughTick<=g.validUntilTick,'approach precedes actual body/motor readiness or exceeds original scene');
  const scene=deriveSamePaObservedPitchScene(initial.setup,{actor:pitch.originalActor,posture,
    body:{...pitch.frame.nominalRelease.body,moundReference:action.source.nominalPitch.delivery.moundReference}});
  const hand=scene.otherActors.find(p=>p.playerId===bat.holderPlayerId&&p.primitive.role==='tag_hand');assert(hand,'original holder hand required');
  const obstacles=scene.otherActors.filter(p=>!(p.playerId===bat.holderPlayerId&&p.primitive.role==='tag_hand'));
  const control={version:'held_to_measured_bat_control_v1' as const,initial:bat.binding.control,bridgeStartTick:r.bridgeStartTick,throughTick:r.throughTick,
    measured:commitment.sampledTrajectoryV1,body:{bodyOrigin:{x:g.centerOfMass.x,y:body.actor.bodyOriginHeightMeters,z:g.centerOfMass.z},
      maximumHandReachM:body.reach.maximumTagReachMeters,handCenter:hand.primitive.startCenter,handRadiusM:hand.primitive.radius,
      obstacles:[...obstacles.map(p=>({center:p.primitive.startCenter,radiusM:p.primitive.radius})),
        // Cover all permissible pitcher-hand positions rather than pretending
        // its expiring control is stationary or omitting that limb.
        {center:scene.shoulder,radiusM:pitch.frame.nominalRelease.body.armReachMeters+scene.hand.radius}]},
    maximumSweetSpotSpeedMps:decision.calculation.effectiveValues.motor.maximumSweetSpotSpeedMps};
  return {control,body,obstacles,profile,metadata:{request:r,lineage:pitch.lineage,
    bodyReference:reference('world_player_body_materializations',body),sceneBodyReferences:binding.sceneBodyReferences,
    evaluatedAtTick:decision.evaluationTick,earliestBridgeTick,
    requiresPitcherControlRenewal:r.throughTick>binding.ownedHandControlThroughTick,motionIssued:false as const,physicalEffect:'none' as const}};
}

export type InitialCoupledMeasuredBatControlRequestV1=InitialMeasuredBatControlRequestV1&Readonly<{bodyControlReference:MeasuredBattingBodyReference}>;
export function prepareInitialCoupledMeasuredBatControlFromSqlite(db:DatabaseSync,raw:InitialCoupledMeasuredBatControlRequestV1){
  return coupledParameters(db,raw,true);
}
/** Immutable replay only. A forward owner must separately authenticate the
 * current cut before issuing any new physical execution. */
export function readHistoricalInitialCoupledMeasuredBatControlFromSqlite(db:DatabaseSync,raw:InitialCoupledMeasuredBatControlRequestV1){
  return coupledParameters(db,raw,false);
}
function coupledParameters(db:DatabaseSync,raw:InitialCoupledMeasuredBatControlRequestV1,current:boolean){
  const r=cloneInert(raw);
  assert(fields(r,['initialBatReference','decisionReference','bridgeStartTick','throughTick','bodyControlReference'])
    &&validRef(r.bodyControlReference,measuredBattingBodyReferenceTable),'invalid coupled request');
  const {bodyControlReference,...base}=r,p=parameters(db,base,current),owned=readMeasuredBattingBodyReferenceFromSqlite(db,bodyControlReference);
  same(owned.source.initialBatReference,base.initialBatReference);same(owned.bodyReference,p.metadata.bodyReference);
  assert(owned.source.profileId===p.profile.profileId,'coupled profile differs from the current decision');
  const index=(role:string)=>{const i=p.obstacles.findIndex(o=>o.playerId===owned.playerId&&o.primitive.role===role);assert(i>=0,'original own primitive missing');return i;};
  const m=p.control.measured;assert(m.transform.scale===1,'original unit scale required');
  const result=createCoupledHeldMeasuredBatBodyControlV1({version:'coupled_held_measured_bat_body_control_v1',bat:p.control,
    bodyObstacleIndex:index('body'),footObstacleIndices:[index('left_foot'),index('right_foot')],maximumLegReachM:p.body.reach.maximumLegReachMeters,
    body:{version:'measured_pelvis_control_v1',startTick:p.control.initial.startTick,bridgeStartTick:base.bridgeStartTick,throughTick:base.throughTick,
      initialCenter:p.control.body.bodyOrigin,maximumSpeedMps:owned.source.postureSpeed.maximumSpeedMps,
      reference:{...owned.source.reference,startTick:m.startTick,ticksPerSecond:1000000,playbackRate:m.playbackRate,
        transform:{rotation:m.transform.rotation,translation:m.transform.translation,scale:1}}}});
  return freeze({kind:'initial_coupled_measured_bat_control_preparation_v1' as const,...p.metadata,request:r,bodyControlReference,
    bodyReferenceOwned:true as const,postureSpeedCalibration:owned.source.postureSpeed,control:result.input,certificate:result.certificate});
}

const createReferenceFrames=(p:MeasuredBattingProfileV1,m:ReferenceBatKinematicsInputV1)=>createMeasuredBatAxisReferenceV1({...p.measured,
  startTick:m.startTick,ticksPerSecond:m.ticksPerSecond,playbackRate:p.playbackRate,transform:{rotation:{x:0,y:0,z:0,w:1},translation:{x:0,y:0,z:0},scale:1}}).reference.frames;

export function readInitialMeasuredBatControlPreparation(path:string,request:InitialMeasuredBatControlRequestV1){
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path,{readOnly:true});
  try{db.exec('PRAGMA query_only=1; BEGIN');const result=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>prepareInitialMeasuredBatControlFromSqlite(db,request)));db.exec('COMMIT');return result;}
  finally{db.close();}
}
export function readInitialCoupledMeasuredBatControlPreparation(path:string,request:InitialCoupledMeasuredBatControlRequestV1){
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path,{readOnly:true});
  try{db.exec('PRAGMA query_only=1; BEGIN');const result=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>prepareInitialCoupledMeasuredBatControlFromSqlite(db,request)));db.exec('COMMIT');return result;}
  finally{db.close();}
}

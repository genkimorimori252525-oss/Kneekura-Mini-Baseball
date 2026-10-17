import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { calculateBattingObservation } from '../../core/world/psychology/batting/BattingObservationCalculation';
import { calculateBaseballAerodynamics } from '../../core/sim/ball/BaseballAerodynamics';
import { createAeroGroundBallPhysicsProfile,type AeroGroundBallPhysicsV1 } from '../../core/sim/ball/VersionedBattedBallPhysics';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { queryControlledPitchWorldV1 } from '../../core/sim/pitch/ControlledPitchWorldV1';
import { sampleControlledHeldPitchV1,sampleControlledPitchHandV1 } from '../../core/sim/pitch/ControlledHeldPitchV1';
import { actorFreeze as freeze,actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaText as text,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readSamePaObservedPitchFromSqlite,readSamePaExecutionCalibrationFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { readSamePaInitialPlayFromSqlite } from './SqliteSamePlateAppearanceInitialBallStore';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { deriveSamePaObservedPitchScene } from './SamePlateAppearanceInitialBallProof';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { deriveBattingObservationDelivery,type BattingObservationDelivery } from './NativeBattingDelivery';
import { deriveDeliveredBattingObservedMotionForecast,type BattingObservedMotionForecast } from './NativeBattingPrediction';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { assertSamePaLifecycleReservedStateFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { calculateObservedBattingMotorPlanV1 } from '../../core/world/psychology/batting/BattingMotorPlanV1';
import { assessObservedStrikeZoneOpportunityV1 } from '../../core/world/psychology/batting/ObservedStrikeZoneOpportunityV1';
import { calculateBattingExecution } from '../../core/world/psychology/batting/BattingCommitment';
import { readBattingRequest } from '../../core/world/psychology/batting/BattingValidation';
import { readBattingEmotionExecutionFromSqlite,readCurrentBattingEmotionExecutionFromSqlite } from './SqliteBattingEmotionExecutionStore';
import { readEmotionWorldRevisionFromSqlite,readHistoricalEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import type { AcceptedBattingEmotionExecution } from './NativeBattingEmotionExecution';
import { originalBattingIntentInput } from './OriginalBattingIntent';
import { reusableBattedWorldFieldReadSnapshot } from './SqliteBattedWorldFieldStore';
import { initialHeldBatPointClearanceV1 } from '../../core/sim/contact/InitialHeldBatV1';
import type { ObservationOccluder } from '../../core/sim/perception/Occlusion';

export const observedInitialOperations='pa_observed_initial_v1_operations';
const headTable='pa_observed_initial_v1_heads';
type Ref=SamePaReference<typeof observedInitialOperations>;
type Base=Readonly<{sourceId:string;sourceVersion:string;launchReference:SamePaReference<'pa_dispatch_v1_pitch_actions'>;previousOperationReference:Ref|null}>;
export type ObservedInitialCutSource=Base&Readonly<{capability:'same_pa_observed_initial_cut_v1';throughTick:number;ballPhysics:AeroGroundBallPhysicsV1}>;
export type ObservedInitialCaptureSource=Omit<Base,'previousOperationReference'>&Readonly<{capability:'same_pa_observed_initial_capture_v1';previousOperationReference:Ref;
  calibrationReference:SamePaReference<'pa_dispatch_v1_execution_calibrations'>}>;
export type ObservedInitialDeliverySource=Omit<Base,'previousOperationReference'>&Readonly<{capability:'same_pa_observed_initial_delivery_v1';previousOperationReference:Ref;
  captureReference:Ref;calibrationReference:SamePaReference<'pa_dispatch_v1_execution_calibrations'>}>;
export type ObservedInitialPredictionSource=Omit<Base,'previousOperationReference'>&Readonly<{capability:'same_pa_observed_initial_prediction_v1';previousOperationReference:Ref;deliveryReference:Ref}>;
/** Explicit preparation only: aggression is a proposed planning input, not an
 * emotion/decision receipt or authority to issue the returned motor. */
export type ObservedInitialMotorPreparationSource=Omit<Base,'previousOperationReference'>&Readonly<{
  capability:'same_pa_observed_initial_motor_preparation_v1';previousOperationReference:Ref;predictionReference:Ref;
  motorCalibrationReference:SamePaReference<'pa_dispatch_v1_execution_calibrations'>;
  repertoireCalibrationReference:SamePaReference<'pa_dispatch_v1_execution_calibrations'>;aggression:number;
}>;
export type ObservedInitialOpportunitySource=Omit<Base,'previousOperationReference'>&Readonly<{
  capability:'same_pa_observed_initial_opportunity_v1';previousOperationReference:Ref;predictionReference:Ref;
}>;
export type ObservedInitialDecisionSource=Omit<Base,'previousOperationReference'>&Readonly<{
  capability:'same_pa_observed_initial_decision_v1';previousOperationReference:Ref;opportunityReference:Ref;
  emotionReference:SamePaReference<'batting_emotion_execution_v1_executions'>;
  decisionCalibrationReference:SamePaReference<'pa_dispatch_v1_execution_calibrations'>;
  motorCalibrationReference:SamePaReference<'pa_dispatch_v1_execution_calibrations'>;
  repertoireCalibrationReference:SamePaReference<'pa_dispatch_v1_execution_calibrations'>;
  expectedWorld:AcceptedBattingEmotionExecution['expectedWorld'];attempt:'ordinary_swing';
}>;
export type ObservedInitialSource=ObservedInitialCutSource|ObservedInitialCaptureSource|ObservedInitialDeliverySource|ObservedInitialPredictionSource|ObservedInitialMotorPreparationSource
  |ObservedInitialOpportunitySource|ObservedInitialDecisionSource;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('observed initial original, row or head differs');};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('observed initial: '+message);}
export const observedInitialSourceInput=(raw:unknown,id?:string):ObservedInitialSource=>{
  const s=cloneInert(raw) as ObservedInitialSource,base=['sourceId','sourceVersion','capability','launchReference','previousOperationReference'];
  assert(s&&text(s.sourceId)&&text(s.sourceVersion)&&(id===undefined||s.sourceId===id)&&validRef(s.launchReference,'pa_dispatch_v1_pitch_actions')
    &&(s.previousOperationReference===null||validRef(s.previousOperationReference,observedInitialOperations)),'invalid Source identity');
  if(s.capability==='same_pa_observed_initial_cut_v1'){
    assert(fields(s,[...base,'throughTick','ballPhysics'])&&Number.isSafeInteger(s.throughTick)&&s.throughTick>=0,'invalid cut Source');
    createAeroGroundBallPhysicsProfile(s.ballPhysics);
  }else if(s.capability==='same_pa_observed_initial_decision_v1')assert(fields(s,[...base,'opportunityReference','emotionReference','decisionCalibrationReference','motorCalibrationReference','repertoireCalibrationReference','expectedWorld','attempt'])
    &&s.previousOperationReference!==null&&validRef(s.opportunityReference,observedInitialOperations)&&validRef(s.emotionReference,'batting_emotion_execution_v1_executions')
    &&[s.decisionCalibrationReference,s.motorCalibrationReference,s.repertoireCalibrationReference].every(r=>validRef(r,'pa_dispatch_v1_execution_calibrations'))
    &&fields(s.expectedWorld,['careerId','worldRevision','controlRevision','controlHash'])&&text(s.expectedWorld.careerId)
    &&Number.isSafeInteger(s.expectedWorld.worldRevision)&&s.expectedWorld.worldRevision>=0&&Number.isSafeInteger(s.expectedWorld.controlRevision)&&s.expectedWorld.controlRevision>=0
    &&typeof s.expectedWorld.controlHash==='string'&&/^[a-f0-9]{64}$/.test(s.expectedWorld.controlHash)&&s.attempt==='ordinary_swing','invalid decision Source');
  else if(s.capability==='same_pa_observed_initial_opportunity_v1')assert(fields(s,[...base,'predictionReference'])&&s.previousOperationReference!==null
    &&validRef(s.predictionReference,observedInitialOperations),'invalid opportunity Source');
  else if(s.capability==='same_pa_observed_initial_motor_preparation_v1')assert(fields(s,[...base,'predictionReference','motorCalibrationReference','repertoireCalibrationReference','aggression'])
    &&s.previousOperationReference!==null&&validRef(s.predictionReference,observedInitialOperations)
    &&validRef(s.motorCalibrationReference,'pa_dispatch_v1_execution_calibrations')&&validRef(s.repertoireCalibrationReference,'pa_dispatch_v1_execution_calibrations')
    &&Number.isFinite(s.aggression)&&s.aggression>=0&&s.aggression<=1,'invalid motor preparation Source');
  else if(s.capability==='same_pa_observed_initial_delivery_v1')assert(fields(s,[...base,'captureReference','calibrationReference'])
    &&s.previousOperationReference!==null&&validRef(s.captureReference,observedInitialOperations)&&validRef(s.calibrationReference,'pa_dispatch_v1_execution_calibrations'),'invalid delivery Source');
  else if(s.capability==='same_pa_observed_initial_prediction_v1')assert(fields(s,[...base,'deliveryReference'])
    &&s.previousOperationReference!==null&&validRef(s.deliveryReference,observedInitialOperations),'invalid prediction Source');
  else assert(s.capability==='same_pa_observed_initial_capture_v1'&&fields(s,[...base,'calibrationReference'])
    &&s.previousOperationReference!==null&&validRef(s.calibrationReference,'pa_dispatch_v1_execution_calibrations'),'invalid capture Source');
  return freeze(s);
};
const schemas={
  [observedInitialOperations]:`CREATE TABLE ${observedInitialOperations}(source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL,launch_source_id TEXT NOT NULL,operation_ordinal INTEGER NOT NULL CHECK(operation_ordinal>0),evaluation_tick INTEGER NOT NULL,previous_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(enrollment_source_id,operation_ordinal))`,
  [headTable]:`CREATE TABLE ${headTable}(enrollment_source_id TEXT PRIMARY KEY,launch_source_id TEXT NOT NULL,operation_ordinal INTEGER NOT NULL,last_source_id TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`
};
/** Additive owned namespace; never alters an old schema or installs on read. */
export const assertObservedInitialStorage=(db:Pick<DatabaseSync,'prepare'>)=>{
  const rows=(schema:string)=>db.prepare(`SELECT type,name,tbl_name,sql FROM ${schema}.sqlite_master WHERE lower(name) GLOB 'pa_observed_initial_v1_*' OR lower(tbl_name) GLOB 'pa_observed_initial_v1_*'`).all();
  assert(rows('temp').length===0,'temporary namespace shadow');const catalog=rows('main');if(!catalog.length)return false;
  const expected=new Set<string>();
  for(const [name,sql]of Object.entries(schemas)){
    const r=catalog.filter(v=>v.name===name);assert(r.length===1&&r[0].type==='table'&&r[0].tbl_name===name&&r[0].sql===sql,'partial or malformed storage');expected.add(name);
    const keys=name===observedInitialOperations?[['source_id'],['enrollment_source_id','operation_ordinal']]:[['enrollment_source_id']];
    const indexes=db.prepare('PRAGMA main.index_list('+name+')').all();assert(indexes.length===keys.length,'storage index count differs');
    keys.forEach((columns,i)=>{
      const index='sqlite_autoindex_'+name+'_'+(i+1),c=catalog.filter(v=>v.name===index),actual=indexes.find(v=>v.name===index);
      assert(c.length===1&&c[0].sql===null&&c[0].type==='index'&&c[0].tbl_name===name&&actual?.unique===1&&actual.origin===(i===0?'pk':'u')&&actual.partial===0,'storage index differs');
      same(db.prepare('PRAGMA main.index_xinfo('+index+')').all().filter(v=>v.key===1).map(v=>v.name),columns);expected.add(index);
    });
    const columns=sql.slice(sql.indexOf('(')+1).split(',').filter(s=>/^[a-z_]+ (TEXT|INTEGER)/.test(s)).map(s=>s.split(' '));
    const actual=db.prepare('PRAGMA main.table_xinfo('+name+')').all();
    assert(actual.length===columns.length&&actual.every((c,i)=>c.cid===i&&c.name===columns[i][0]&&c.type===columns[i][1]
      &&c.notnull===(i===0?0:1)&&c.pk===(i===0?1:0)&&c.hidden===0&&c.dflt_value===null),'storage columns differ');
  }
  assert(catalog.length===expected.size&&catalog.every(r=>expected.has(String(r.name))),'unexpected namespace object');return true;
};
const deriveContext=(db:DatabaseSync,ref:Base['launchReference'])=>{
  const bundle=readSamePaObservedPitchFromSqlite(db,ref),{pitch,action}=bundle;
  const initial=readSamePaInitialPlayFromSqlite(db,pitch.source.initialPlayReference);
  const posture=readBattingPerceptionFromSqlite(db,'posture',initial.setup.source.postureReference);
  assert(posture.kind==='batting_invocation_posture','original posture missing');
  const body={...pitch.frame.nominalRelease.body,moundReference:action.source.nominalPitch.delivery.moundReference};
  const scene=deriveSamePaObservedPitchScene(initial.setup,{actor:pitch.originalActor,posture,body});
  assert(scene.scene.length===10&&scene.otherActors.length===49,'initial cut requires ten complete original bodies');
  return {pitch,action,initial,posture,scene};
};
type Context=ReturnType<typeof deriveContext>;
// Only this owner seeds completed, frozen context proofs. The opaque snapshot
// is owned by the existing synchronous read bracket: every lookup checks its
// transaction/query-only/change/schema fences. No cross-operation cache,
// caller evidence or lifetime extension is introduced.
const contexts=new WeakMap<object,WeakMap<DatabaseSync,Map<string,Context>>>();
const context=(db:DatabaseSync,ref:Base['launchReference']):Context=>{
  const snapshot=reusableBattedWorldFieldReadSnapshot(db);
  if(snapshot===null)return deriveContext(db,ref);
  let connections=contexts.get(snapshot);if(!connections){connections=new WeakMap();contexts.set(snapshot,connections);}
  let entries=connections.get(db);if(!entries){entries=new Map();connections.set(db,entries);}
  const key=json(ref),existing=entries.get(key);if(existing)return existing;
  const value=freeze(deriveContext(db,ref));
  assert(reusableBattedWorldFieldReadSnapshot(db)===snapshot,'original context read snapshot expired');
  entries.set(key,value);return value;
};
const assertCurrentReservation=(db:DatabaseSync,b:Context)=>{
  const view=readHistoricalSamePaExecutionView(db,b.action.source.viewReference).view;
  same(view.lineage,b.pitch.lineage);
  assertSamePaLifecycleReservedStateFromSqlite(db,{actor:b.pitch.originalActor,view});
};
const control=(b:Context,physics:AeroGroundBallPhysicsV1)=>{
  const {pitch,scene,initial}=b,release=pitch.result.delivery.release;
  same(physics.air,pitch.result.trajectory.parameters);
  assert(physics.ground.radiusM===initial.setup.ballRadiusMeters,'ground radius differs from original equipment');
  return {descriptor:{kind:'aero_ground_continuous_source_kernel_v2' as const,initial:{originTick:release.releaseAtUs,elapsedSeconds:0,
    ball:{tick:release.releaseAtUs,position:release.position,velocity:release.velocity,spin:release.spin}},
    throughElapsedSeconds:(pitch.initialLiveBallBinding.ownedHandControlThroughTick-release.releaseAtUs)/1e6,profile:physics},
    anchors:{initialBall:initial.setup.source.custody.ball,initialHand:{position:scene.hand.startCenter,velocity:scene.hand.startVelocity},shoulder:scene.shoulder,
      armReachM:pitch.frame.nominalRelease.body.armReachMeters,handRadiusM:scene.hand.radius,ballRadiusM:initial.setup.ballRadiusMeters,release,
      releaseAcceleration:{x:0,y:0,z:0},followThroughEndTick:pitch.initialLiveBallBinding.ownedHandControlThroughTick,
      obstacles:[...scene.obstacles,...(pitch.initialLiveBallBinding.kind==='same_pa_observed_initial_pitch_live_binding_v2'?[pitch.initialLiveBallBinding.initialBat.binding.boundingSphere]:[])]},
    motion:pitch.source.custodyMotion,pitcherPlayerId:b.action.source.pitcherPlayerId,otherActors:scene.otherActors};
};
// The release's actual aero acceleration is part of the control certificate.
// It is reconstructed below, never supplied as a caller correction.
const withAcceleration=(b:Context,physics:AeroGroundBallPhysicsV1)=>{
  const input=control(b,physics),r=b.pitch.result.delivery.release;
  const air=calculateBaseballAerodynamics(r.velocity,r.spin,physics.air.aerodynamics).totalAcceleration;
  return {...input,anchors:{...input.anchors,releaseAcceleration:{...air,y:air.y+physics.air.gravityY}}};
};
type Cut=Readonly<{kind:'observed_initial_cut_v1';source:ObservedInitialCutSource;lineage:Context['pitch']['lineage'];operationOrdinal:number;evaluationTick:number;
  stage:'in_flight'|'boundary';physical:Exclude<ReturnType<typeof queryControlledPitchWorldV1>,{kind:'unresolved'}>;
  hand:ReturnType<typeof sampleControlledHeldPitchV1>['hand'];originalWorldHash:string;sceneBodyReferences:Context['pitch']['initialLiveBallBinding']['sceneBodyReferences'];
  beforeTimeline:Context['pitch']['beforeTimeline'];ownedControlThroughTick:number}>;
const deriveCut=(source:ObservedInitialCutSource,b:Context,ordinal:number,previous:ObservedInitialRecord|null):Cut=>{
  const last=previous?.kind==='observed_initial_cut_v1'?previous:previous?.cut;
  assert(!last||last.kind==='observed_initial_cut_v1'&&last.stage==='in_flight','boundary requires its actual response before another cut');
  if(last)same(source.ballPhysics,last.source.ballPhysics);
  assert(source.throughTick>(previous?.evaluationTick??b.pitch.result.delivery.release.releaseAtUs),'cut must advance the original clock');
  const input=withAcceleration(b,source.ballPhysics),result=queryControlledPitchWorldV1({...input,throughTick:source.throughTick});
  assert(result.kind!=='unresolved','unresolved physical cut: '+(result.kind==='unresolved'?result.reason:''));
  // No fence geometry is invented. Until supplied, only a conservatively
  // enclosed original playable interior authorizes an airborne cut.
  const kernel=createSourceFreeBallKernel(input.descriptor),regions=b.initial.setup.originalVenue.rulePolicy.regions.filter(r=>r.classification==='inside_playable_region');
  const batter=b.posture.model.bodyMaterialization,g=b.posture.source.geometry,repertoire=b.posture.model.repertoire.values;
  const batLength=Math.max(...repertoire.profiles.map(p=>p.profile.batLengthM),...(repertoire.sampledProfiles??[]).map(p=>p.measured.batLengthM));
  const batRadius=Math.max(...b.posture.model.equipment.values.batPhysical.radiusProfile.knots.map(k=>k.radiusM));
  const batReach=batter.reach.maximumTagReachMeters+batLength+batRadius;
  const initialBat=b.pitch.initialLiveBallBinding.kind==='same_pa_observed_initial_pitch_live_binding_v2'?b.pitch.initialLiveBallBinding.initialBat:null;
  if(initialBat)assert(source.throughTick<=initialBat.binding.control.throughTick,'initial bat control expired');
  assert(Number.isFinite(batReach)&&batReach>0,'original batting interaction extent missing');
  for(const cell of kernel.cells){
    const lo=cell.fromElapsedSeconds,hi=Math.min(result.moment.elapsedSeconds,cell.throughElapsedSeconds);if(hi<=lo)continue;
    const point=kernel.evaluateAt((lo+hi)/2).moment.ball.position,pad=cell.maximumPositionSpeedMps*(hi-lo)/2+cell.positionRoundingBoundMeters+b.initial.setup.ballRadiusMeters;
    assert(regions.some(r=>(['x','y','z'] as const).every(k=>point[k]-pad>=r.minimum[k]&&point[k]+pad<=r.maximum[k])),'cut exceeds original certified venue interior');
    if(initialBat)assert(initialHeldBatPointClearanceV1(initialBat.binding.control,point)>pad,'initial bat interaction requires its actual response before another cut');
    assert(Math.hypot(point.x-g.centerOfMass.x,point.y-batter.actor.bodyOriginHeightMeters,point.z-g.centerOfMass.z)-pad>batReach,
      'owned batting motion required before the original reachable bat interaction region');
  }
  return freeze({kind:'observed_initial_cut_v1' as const,source,lineage:b.pitch.lineage,operationOrdinal:ordinal,evaluationTick:result.moment.ball.tick,
    stage:result.kind==='boundary'?'boundary' as const:'in_flight' as const,physical:result,
    hand:sampleControlledPitchHandV1(input.motion,result.moment.originTick+result.moment.elapsedSeconds*1e6),
    originalWorldHash:hash(b.pitch.originalActor.world),sceneBodyReferences:b.pitch.initialLiveBallBinding.sceneBodyReferences,
    beforeTimeline:b.pitch.beforeTimeline,ownedControlThroughTick:b.pitch.initialLiveBallBinding.ownedHandControlThroughTick});
};
type Capture=Readonly<{kind:'observed_initial_capture_v1';source:ObservedInitialCaptureSource;lineage:Cut['lineage'];operationOrdinal:number;evaluationTick:number;
  cut:Cut;eventSequence:number;lastCapturedTick:number|null;calculation:Extract<ReturnType<typeof calculateBattingObservation>,{ok:true}>['value']}>;
type Delivery=Readonly<{kind:'observed_initial_delivery_v1';source:ObservedInitialDeliverySource;lineage:Cut['lineage'];operationOrdinal:number;evaluationTick:number;
  cut:Cut;captureReference:Ref;captureHash:string;delivery:BattingObservationDelivery}>;
type Prediction=Readonly<{kind:'observed_initial_prediction_v1';source:ObservedInitialPredictionSource;lineage:Cut['lineage'];operationOrdinal:number;evaluationTick:number;
  cut:Cut;deliveryReference:Ref;predictionParameterReference:Readonly<{sourceId:string;sourceVersion:string;sourceHash:string}>;forecast:BattingObservedMotionForecast}>;
type MotorPreparation=Readonly<{kind:'observed_initial_motor_preparation_v1';source:ObservedInitialMotorPreparationSource;lineage:Cut['lineage'];operationOrdinal:number;evaluationTick:number;
  cut:Cut;predictionReference:Ref;modelReference:Context['posture']['source']['modelReference'];
  plan:Extract<ReturnType<typeof calculateObservedBattingMotorPlanV1>,{ok:true}>['value'];
  scope:'motor_preparation_only';motionIssued:false;physicalEffect:'none'}>;
type Opportunity=Readonly<{kind:'observed_initial_opportunity_v1';source:ObservedInitialOpportunitySource;lineage:Cut['lineage'];operationOrdinal:number;evaluationTick:number;
  cut:Cut;predictionReference:Ref;assessment:Extract<ReturnType<typeof assessObservedStrikeZoneOpportunityV1>,{ok:true}>['value']} >;
type Decision=Readonly<{kind:'observed_initial_decision_v1';source:ObservedInitialDecisionSource;lineage:Cut['lineage'];operationOrdinal:number;evaluationTick:number;
  cut:Cut;calculation:Extract<ReturnType<typeof calculateBattingExecution>,{ok:true}>['value'];
  originalIntent:ReturnType<typeof originalBattingIntentInput>;invokedRoutes:readonly ('batter_decision'|'batter_motor'|'batter_swing')[];
  motionIssued:false;physicalEffect:'none';physicalAdmission:'requires_forward_initial_physical_right'}>;
export type ObservedInitialRecord=Cut|Capture|Delivery|Prediction|MotorPreparation|Opportunity|Decision;
const observation=(b:Context,cut:Cut,source:ObservedInitialCaptureSource,previousCapture:Capture|null,db:DatabaseSync)=>{
  const c=readSamePaExecutionCalibrationFromSqlite(db,source.calibrationReference).source;
  assert(c.route==='batter_observation'&&c.response.kind==='accepted_execution_values_v1','capture calibration route differs');
  same(c.member,b.posture.source.member);same(c.viewReference,b.action.source.viewReference);same(c.nominalReference,b.posture.source.modelReference);
  const g=b.posture.source.geometry,at=cut.evaluationTick;
  assert(cut.stage==='in_flight'&&at>=g.startedAtTick&&at<=g.validUntilTick,'capture requires the current owned in-flight posture');
  const occluders:ObservationOccluder[]=b.scene.otherActors.filter(a=>a.playerId!==b.pitch.originalActor.binding.playerId).map(a=>({center:a.primitive.startCenter,radiusMeters:a.primitive.radius}));
  occluders.push({center:cut.hand.position,radiusMeters:b.scene.hand.radius});
  if(b.pitch.initialLiveBallBinding.kind==='same_pa_observed_initial_pitch_live_binding_v2'){
    const bat=b.pitch.initialLiveBallBinding.initialBat.binding;
    assert(at>=bat.control.startTick&&at<=bat.control.throughTick,'sensory bat control expired');
    occluders.push({shape:'capsule',start:bat.control.grip,end:bat.tip,radiusMeters:bat.control.maximumBatRadiusM});
  }
  const seed=new SeedRoot(b.action.source.nominalPitch.delivery.matchSeed).streamSeed(b.pitch.originalActor.match.playId,'perception',json(['observed_initial_capture_v1',source.launchReference,cut.source.sourceId,at]));
  const result=calculateBattingObservation({nominalValues:b.posture.model.observationCalibration.values,effectiveValues:c.response.values,
    input:{observedTick:at,deliveryCutTick:at,ticksPerSecond:g.ticksPerSecond,seed,
      observer:{position:g.eyePosition,forward:g.observerForward,velocity:{x:0,y:0,z:0}},target:{position:cut.physical.moment.ball.position,velocity:cut.physical.moment.ball.velocity},
      occluders,attention:g.attention,lastObservedTick:previousCapture?.lastCapturedTick??null}});
  assert(result.ok,'sensory Core rejected');return result.value;
};
const derive=(db:DatabaseSync,source:ObservedInitialSource,b:Context,previous:ObservedInitialRecord|null,prefix:ObservedInitialRecord[],current=false):ObservedInitialRecord=>{
  same(source.launchReference,reference('pa_dispatch_v1_pitch_actions',b.pitch));
  same(source.previousOperationReference,previous?reference(observedInitialOperations,previous):null);
  const ordinal=(previous?.operationOrdinal??0)+1;
  if(source.capability==='same_pa_observed_initial_cut_v1')return deriveCut(source,b,ordinal,previous);
  const cut=previous?.kind==='observed_initial_cut_v1'?previous:previous?.cut;
  assert(cut&&cut.stage==='in_flight','sensory work requires its current owned cut');
  if(source.capability==='same_pa_observed_initial_decision_v1'){
    assert(previous?.kind==='observed_initial_opportunity_v1','decision must consume its current owned opportunity');
    same(reference(observedInitialOperations,previous),source.opportunityReference);
    const prediction=prefix.find(v=>v.source.sourceId===previous.predictionReference.sourceId);
    assert(prediction?.kind==='observed_initial_prediction_v1','decision original forecast missing');same(reference(observedInitialOperations,prediction),previous.predictionReference);same(prediction.cut,cut);
    const emotion=(current?readCurrentBattingEmotionExecutionFromSqlite:readBattingEmotionExecutionFromSqlite)(db,source.emotionReference);
    assert(emotion.source.capability==='owned_initial_batting_emotion_execution_v1','initial emotion owner required');
    same(emotion.lineage,b.pitch.lineage);same(emotion.source.member,b.posture.source.member);same(emotion.physicalPitchReference,source.launchReference);
    same(emotion.source.physicalOperationReference,source.previousOperationReference);same(emotion.source.deliveryReference,prediction.deliveryReference);
    const world=current?readEmotionWorldRevisionFromSqlite(db,b.pitch.lineage.careerId):readHistoricalEmotionWorldRevisionFromSqlite(db,b.pitch.lineage.careerId,source.expectedWorld.worldRevision);
    assert(world,'actual decision World head missing');
    same(source.expectedWorld,{careerId:b.pitch.lineage.careerId,worldRevision:world.head.worldRevision,controlRevision:world.head.control.revision,controlHash:hash(world.head.control)});
    assert(world.head.worldRevision>=emotion.acceptance.afterWorldRevision,'decision predates accepted emotion');
    const calibrations=[source.decisionCalibrationReference,source.motorCalibrationReference,source.repertoireCalibrationReference].map(r=>readSamePaExecutionCalibrationFromSqlite(db,r).source);
    for(const c of calibrations){same(c.member,b.posture.source.member);same(c.viewReference,b.action.source.viewReference);same(c.nominalReference,b.posture.source.modelReference);}
    const [decision,motor,swing]=calibrations;
    assert(decision.route==='batter_decision'&&motor.route==='batter_motor'&&swing.route==='batter_swing'
      &&decision.response.kind==='accepted_execution_values_v1'&&motor.response.kind==='accepted_execution_values_v1'&&swing.response.kind==='accepted_execution_values_v1','decision calibration route differs');
    const frame={...emotion.acceptance.expectedFrame,snapshotId:'owned-initial-batting-decision:'+hash([source,world]),worldRevision:world.head.worldRevision,
      time:{tick:cut.evaluationTick,sequence:previous.operationOrdinal}};
    const nominal=b.posture.model,g=b.posture.source.geometry,forecast=prediction.forecast,timeline=b.pitch.beforeTimeline;
    assert(timeline.status.kind==='active','initial plate appearance terminal');
    const batting={sourceId:source.sourceId,revision:0,frame,validUntilTick:g.validUntilTick,ballId:'pitch:'+b.pitch.source.sourceId,
      playId:b.pitch.originalActor.match.playId,pitchOrdinal:b.pitch.progressRevision,ticksPerSecond:g.ticksPerSecond,
      count:timeline.status.count,timelineNextSequence:timeline.nextSequence,bodyReadyTick:g.bodyReadyTick,latestMotorStartTick:g.latestMotorStartTick,
      ...nominal.capability.values,handedness:g.handedness,centerOfMass:g.centerOfMass,...nominal.equipment.values,
      plateZ:g.plateZ,strikeZone:g.strikeZone,...nominal.repertoire.values,directive:'AUTO' as const,decisionModel:nominal.decisionModel.values,
      predictions:[{predictionId:prediction.source.sourceId,observedTick:forecast.observedTick,availableTick:forecast.availableTick,validUntilTick:forecast.validUntilTick,
        trajectory:forecast.trajectory,swingScore:previous.assessment.score}]};
    const nominalRequest=readBattingRequest({currentFrame:frame,currentEmotion:emotion.acceptance.proposal.appraisal.state,acceptedExecution:emotion.acceptance,source:batting});
    const result=calculateBattingExecution({nominalRequest,effectiveValues:{decision:decision.response.values,motor:motor.response.values,repertoire:swing.response.values}});
    assert(result.ok,'decision Core rejected'+(!result.ok?': '+result.reason.path:''));
    const originalIntent=originalBattingIntentInput({version:'original_batting_intent_v1',actorSourceId:b.pitch.originalActor.source.sourceId,attempt:source.attempt});
    return freeze({kind:'observed_initial_decision_v1' as const,source,lineage:b.pitch.lineage,operationOrdinal:ordinal,evaluationTick:cut.evaluationTick,cut,
      calculation:result.value,originalIntent,invokedRoutes:result.value.commitment?.action==='SWING'?['batter_decision','batter_motor','batter_swing'] as const:['batter_decision'] as const,
      motionIssued:false as const,physicalEffect:'none' as const,physicalAdmission:'requires_forward_initial_physical_right' as const});
  }
  if(source.capability==='same_pa_observed_initial_opportunity_v1'){
    const prediction=prefix.find(v=>v.source.sourceId===source.predictionReference.sourceId);
    assert(prediction?.kind==='observed_initial_prediction_v1','opportunity original forecast missing');
    same(reference(observedInitialOperations,prediction),source.predictionReference);same(prediction.cut,cut);
    const f=prediction.forecast,g=b.posture.source.geometry;
    const result=assessObservedStrikeZoneOpportunityV1({evaluatedAtTick:cut.evaluationTick,
      forecast:{observedTick:f.observedTick,availableTick:f.availableTick,validUntilTick:f.validUntilTick,trajectory:f.trajectory},
      plateZ:g.plateZ,strikeZone:g.strikeZone,ballRadiusM:b.posture.model.equipment.values.ball.radiusM});
    assert(result.ok,'opportunity Core rejected');
    return freeze({kind:'observed_initial_opportunity_v1' as const,source,lineage:b.pitch.lineage,operationOrdinal:ordinal,evaluationTick:cut.evaluationTick,
      cut,predictionReference:source.predictionReference,assessment:result.value});
  }
  if(source.capability==='same_pa_observed_initial_motor_preparation_v1'){
    const prediction=prefix.find(v=>v.source.sourceId===source.predictionReference.sourceId);
    assert(prediction?.kind==='observed_initial_prediction_v1','original observed prediction missing');
    same(reference(observedInitialOperations,prediction),source.predictionReference);same(prediction.cut,cut);
    const motor=readSamePaExecutionCalibrationFromSqlite(db,source.motorCalibrationReference).source;
    const repertoire=readSamePaExecutionCalibrationFromSqlite(db,source.repertoireCalibrationReference).source;
    assert(motor.route==='batter_motor'&&motor.response.kind==='accepted_execution_values_v1'
      &&repertoire.route==='batter_swing'&&repertoire.response.kind==='accepted_execution_values_v1','motor preparation calibration route differs');
    for(const c of [motor,repertoire]){
      same(c.member,b.posture.source.member);same(c.viewReference,b.action.source.viewReference);same(c.nominalReference,b.posture.source.modelReference);
    }
    const g=b.posture.source.geometry;
    assert(cut.evaluationTick>=g.startedAtTick&&cut.evaluationTick<=g.validUntilTick,'motor preparation posture expired');
    const forecast=prediction.forecast;
    const result=calculateObservedBattingMotorPlanV1({decisionTick:cut.evaluationTick,aggression:source.aggression,
      geometry:{handedness:g.handedness,centerOfMass:g.centerOfMass,batPhysical:b.posture.model.equipment.values.batPhysical,
        plateZ:g.plateZ,strikeZone:g.strikeZone,bodyReadyTick:g.bodyReadyTick,latestMotorStartTick:g.latestMotorStartTick},
      motor:motor.response.values,repertoire:repertoire.response.values,
      forecast:{observedTick:forecast.observedTick,availableTick:forecast.availableTick,validUntilTick:forecast.validUntilTick,trajectory:forecast.trajectory}});
    assert(result.ok,'motor preparation Core rejected'+(!result.ok?': '+result.reason.path:''));
    return freeze({kind:'observed_initial_motor_preparation_v1' as const,source,lineage:b.pitch.lineage,operationOrdinal:ordinal,evaluationTick:cut.evaluationTick,
      cut,predictionReference:source.predictionReference,modelReference:b.posture.source.modelReference,plan:result.value,
      scope:'motor_preparation_only' as const,motionIssued:false as const,physicalEffect:'none' as const});
  }
  if(source.capability==='same_pa_observed_initial_delivery_v1'){
    const capture=prefix.find(v=>v.source.sourceId===source.captureReference.sourceId);
    assert(capture?.kind==='observed_initial_capture_v1','original capture missing');same(reference(observedInitialOperations,capture),source.captureReference);
    const c=readSamePaExecutionCalibrationFromSqlite(db,source.calibrationReference).source;
    assert(c.route==='batter_observation'&&c.response.kind==='accepted_execution_values_v1','retention calibration route differs');
    same(c.member,b.posture.source.member);same(c.viewReference,b.action.source.viewReference);same(c.nominalReference,b.posture.source.modelReference);
    assert(cut.evaluationTick>capture.evaluationTick,'delivery requires a later owned physical cut');
    const delivery=deriveBattingObservationDelivery(capture.calculation,capture.calculation.nominalValues.calibration.memoryDecayParameters,
      c.response.values.calibration.memoryDecayParameters,cut.evaluationTick);
    assert(delivery.kind==='batting_observation_delivered','observation delivery is not yet available');
    return freeze({kind:'observed_initial_delivery_v1',source,lineage:b.pitch.lineage,operationOrdinal:ordinal,evaluationTick:cut.evaluationTick,
      cut,captureReference:source.captureReference,captureHash:hash(capture),delivery});
  }
  if(source.capability==='same_pa_observed_initial_prediction_v1'){
    const delivery=prefix.find(v=>v.source.sourceId===source.deliveryReference.sourceId);
    assert(delivery?.kind==='observed_initial_delivery_v1','original delivered observation missing');same(reference(observedInitialOperations,delivery),source.deliveryReference);
    const capture=prefix.find(v=>v.source.sourceId===delivery.captureReference.sourceId);
    assert(capture?.kind==='observed_initial_capture_v1','prediction original capture missing');same(hash(capture),delivery.captureHash);
    const parameter=b.posture.model.predictionCalibration,forecast=deriveDeliveredBattingObservedMotionForecast(capture.calculation,delivery.delivery,parameter.values,cut.evaluationTick);
    assert(forecast.kind==='observed_motion_forecast','delivered prediction horizon expired');
    return freeze({kind:'observed_initial_prediction_v1',source,lineage:b.pitch.lineage,operationOrdinal:ordinal,evaluationTick:cut.evaluationTick,cut,
      deliveryReference:source.deliveryReference,predictionParameterReference:{sourceId:parameter.sourceId,sourceVersion:parameter.sourceVersion,sourceHash:hash(parameter)},forecast});
  }
  assert(previous?.kind==='observed_initial_cut_v1','capture must immediately consume its actual cut');
  const prior=prefix.filter((v):v is Capture=>v.kind==='observed_initial_capture_v1').at(-1)??null;
  const calculation=observation(b,previous,source,prior,db);
  return freeze({kind:'observed_initial_capture_v1',source,lineage:b.pitch.lineage,operationOrdinal:ordinal,evaluationTick:previous.evaluationTick,cut:previous,
    eventSequence:(prior?.eventSequence??0)+1,lastCapturedTick:calculation.sample?.observedAt??prior?.lastCapturedTick??null,calculation});
};
const rowFor=(v:ObservedInitialRecord)=>({source_id:v.source.sourceId,enrollment_source_id:v.lineage.enrollmentReference.sourceId,launch_source_id:v.source.launchReference.sourceId,
  operation_ordinal:v.operationOrdinal,evaluation_tick:v.evaluationTick,previous_source_id:v.source.previousOperationReference?.sourceId??'',
  source_json:json(v.source),source_hash:hash(v.source),snapshot_json:json(v),snapshot_hash:hash(v)});
const headFor=(v:ObservedInitialRecord)=>({enrollment_source_id:v.lineage.enrollmentReference.sourceId,launch_source_id:v.source.launchReference.sourceId,
  operation_ordinal:v.operationOrdinal,last_source_id:v.source.sourceId,snapshot_hash:hash(v)});
const readPrefix=(db:DatabaseSync,b:Context,throughSourceId?:string)=>{
  if(!assertObservedInitialStorage(db))return [];
  const rows=db.prepare(`SELECT * FROM ${observedInitialOperations} WHERE enrollment_source_id=? ORDER BY operation_ordinal`).all(b.pitch.lineage.enrollmentReference.sourceId);
  const values:ObservedInitialRecord[]=[];
  let previous:ObservedInitialRecord|null=null,pastCut=false;
  for(const row of rows){
    const s=observedInitialSourceInput(JSON.parse(String(row.source_json)),String(row.source_id));
    // Immutable historical inputs may be dependencies of later operations.
    // Replaying those later behaviors here would create a dependency cycle.
    // Authenticate all durable identity/ancestry/head bytes, but derive only
    // the requested prefix. The ordinary public reader still derives ALL rows.
    const v:ObservedInitialRecord=pastCut?JSON.parse(String(row.snapshot_json)):derive(db,s,b,previous,values);
    same(v.source,s);same(v.lineage,b.pitch.lineage);same(row,rowFor(v));
    same(s.previousOperationReference,previous?reference(observedInitialOperations,previous):null);
    assert(v.operationOrdinal===(previous?.operationOrdinal??0)+1&&v.evaluationTick>=(previous?.evaluationTick??0),'historical prefix chronology differs');
    if(!pastCut)values.push(v);previous=v;
    if(s.sourceId===throughSourceId)pastCut=true;
  }
  const head=db.prepare('SELECT * FROM '+headTable+' WHERE enrollment_source_id=?').get(b.pitch.lineage.enrollmentReference.sourceId)??null;
  same(head,previous?headFor(previous):null);
  assert(throughSourceId===undefined||pastCut,'historical prefix target missing');return values;
};
/** Authenticated immutable prefix only; this grants no current-cut authority
 * and makes no behavioral claim about later rows. */
export const readHistoricalObservedInitialPitchOperationFromSqlite=(db:DatabaseSync,ref:Ref)=>{
  assert(validRef(ref,observedInitialOperations),'invalid historical operation reference');assert(assertObservedInitialStorage(db),'original operation namespace missing');
  const row=db.prepare(`SELECT source_json FROM ${observedInitialOperations} WHERE source_id=?`).get(ref.sourceId);assert(row,'original historical operation missing');
  const source=observedInitialSourceInput(JSON.parse(String(row.source_json)),ref.sourceId),b=context(db,source.launchReference);
  const value=readPrefix(db,b,ref.sourceId).at(-1)!;same(reference(observedInitialOperations,value),ref);return value;
};
/** Current original reservation and exact head, without author callbacks. */
export const assertCurrentObservedInitialPitchOperationFromSqlite=(db:DatabaseSync,ref:Ref)=>{
  const value=readHistoricalObservedInitialPitchOperationFromSqlite(db,ref),b=context(db,value.source.launchReference);
  assertCurrentReservation(db,b);
  same(db.prepare('SELECT * FROM '+headTable+' WHERE enrollment_source_id=?').get(b.pitch.lineage.enrollmentReference.sourceId),headFor(value));
  return value;
};
/** Original owner reconstruction for a successor hand command. The immutable
 * arm grants no current authority; new acceptance must select current=true.
 * No supplied controller, physics, scene or replacement endpoint is accepted. */
export const readObservedInitialPitchHandControlFromSqlite=(db:DatabaseSync,ref:Ref,current=false)=>{
  const record=current?assertCurrentObservedInitialPitchOperationFromSqlite(db,ref):readHistoricalObservedInitialPitchOperationFromSqlite(db,ref);
  assert(record.kind==='observed_initial_decision_v1'&&record.calculation.status==='READY','a current initial decision is required for the successor hand command');
  const b=context(db,record.source.launchReference);
  if(current){
    const world=readEmotionWorldRevisionFromSqlite(db,b.pitch.lineage.careerId);assert(world,'current hand-command World missing');
    same(record.source.expectedWorld,{careerId:b.pitch.lineage.careerId,worldRevision:world.head.worldRevision,
      controlRevision:world.head.control.revision,controlHash:hash(world.head.control)});
  }
  return freeze({lineage:b.pitch.lineage,launchReference:record.source.launchReference,issuedAtTick:record.evaluationTick,
    sceneThroughTick:b.posture.source.geometry.validUntilTick,sceneBodyReferences:b.pitch.initialLiveBallBinding.sceneBodyReferences,
    control:withAcceleration(b,record.cut.source.ballPhysics)});
};
export const readObservedInitialPitchOperationFromSqlite=(db:DatabaseSync,ref:Ref)=>{
  assert(validRef(ref,observedInitialOperations),'invalid operation reference');assert(assertObservedInitialStorage(db),'original operation namespace missing');
  const row=db.prepare(`SELECT source_json FROM ${observedInitialOperations} WHERE source_id=?`).get(ref.sourceId);assert(row,'original operation missing');
  const source=observedInitialSourceInput(JSON.parse(String(row.source_json)),ref.sourceId),b=context(db,source.launchReference);
  const value=readPrefix(db,b).find(v=>v.source.sourceId===ref.sourceId);assert(value,'original operation missing');same(reference(observedInitialOperations,value),ref);return value;
};
export const openSqliteObservedInitialPitchStore=(path:string,authority?:Readonly<{readAcceptedOperation:(id:string)=>unknown|null}>)=>{
  assert(text(path)&&(!authority||typeof authority.readAcceptedOperation==='function'),'invalid owner');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path);
  const tx=battingInvocationTransaction(db,()=>assertObservedInitialStorage(db));
  const read=(id:string)=>{
    assert(text(id),'invalid source identity');if(!assertObservedInitialStorage(db))return null;
    const row=db.prepare(`SELECT source_hash,snapshot_hash FROM ${observedInitialOperations} WHERE source_id=?`).get(id);
    return row?readObservedInitialPitchOperationFromSqlite(db,{owner:observedInitialOperations,sourceId:id,sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)}):null;
  };
  return Object.freeze({
    read:(id:string)=>tx.run(false,proof=>proof(()=>read(id)),()=>{}),
    accept:(id:string)=>{
      assert(text(id),'invalid source identity');const raw=authority?.readAcceptedOperation(id)??null,source=raw===null?null:observedInitialSourceInput(raw,id);
      const prior=tx.run(false,proof=>proof(()=>read(id)),()=>{});if(prior){if(source)same(prior.source,source);return prior;}
      if(!source)return freeze({kind:'pending' as const,reason:'accepted_original_operation_required'});
      const preflight=tx.run(false,proof=>proof(()=>{const b=context(db,source.launchReference);assertCurrentReservation(db,b);const prefix=readPrefix(db,b);return {prefix,value:derive(db,source,b,prefix.at(-1)??null,prefix,true)};}),()=>{});
      return tx.run(true,(proof,step)=>{
        const b=proof(()=>{const b=context(db,source.launchReference);assertCurrentReservation(db,b);return b;});same(proof(()=>readPrefix(db,b)),preflight.prefix);
        const value=proof(()=>derive(db,source,b,preflight.prefix.at(-1)??null,preflight.prefix,true));same(value,preflight.value);
        if(!assertObservedInitialStorage(db))step(()=>Object.values(schemas).forEach(sql=>db.exec(sql)),0,2);
        const row=rowFor(value),head=headFor(value);
        step(()=>{
          assert(db.prepare(`INSERT INTO ${observedInitialOperations} VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row)).changes===1,'exact operation insert differs');
          const old=preflight.prefix.at(-1);
          const changed=old?db.prepare(`UPDATE ${headTable} SET launch_source_id=?,operation_ordinal=?,last_source_id=?,snapshot_hash=? WHERE enrollment_source_id=? AND operation_ordinal=? AND last_source_id=? AND snapshot_hash=?`)
            .run(head.launch_source_id,head.operation_ordinal,head.last_source_id,head.snapshot_hash,head.enrollment_source_id,old.operationOrdinal,old.source.sourceId,hash(old))
            :db.prepare(`INSERT INTO ${headTable} VALUES(?,?,?,?,?)`).run(...Object.values(head));
          assert(changed.changes===1,'physical head CAS differs');
        },2);
        same(proof(()=>readPrefix(db,b)),[...preflight.prefix,value]);return value;
      },value=>same(read(id),value));
    },close:()=>tx.close()
  });
};

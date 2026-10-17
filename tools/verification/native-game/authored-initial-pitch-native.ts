import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual,throws } from 'node:assert';
import { prepareAuthoredNativeObservedPitchV1,type AuthoredNativePitchPreparationV1 } from '../../../src/integration/native-game/AuthoredNativePitchPreparationV1';
import { initializeAuthoredNativeMatchV1 } from '../../../src/integration/native-game/AuthoredNativeMatchV1';
import { reserveAuthoredNativePlateAppearanceV1 } from '../../../src/integration/native-game/AuthoredNativeReservationV1';
import { openSqlitePlayerBattingModelStore } from '../../../src/host/world/SqlitePlayerBattingModelStore';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../../src/core/sim/ball/BaseballAerodynamics';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { samePaOfficialSourceReference as originalRef } from '../../../src/host/world/SamePlateAppearanceCatchCommunicationSource';
import { openSqliteBattingPerceptionStore } from '../../../src/host/world/SqliteBattingPerceptionStore';
import { openSqliteSamePlateAppearanceInitialBallStore } from '../../../src/host/world/SqliteSamePlateAppearanceInitialBallStore';
import { openSqliteSamePlateAppearanceDispatchStore } from '../../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { NPB_2026_RULE_PROFILE } from '../../../src/core/rules/RuleProfile';
import { openSqliteInitialBatEquipmentStore,initialBatEquipmentTable,type InitialBatEquipmentV1 } from '../../../src/host/world/SqliteInitialBatEquipmentStore';
import { MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2 } from '../../../src/core/world/psychology/batting/MeasuredBattingTrajectoryV1';

const [inputArgument,outputArgument]=process.argv.slice(2);if(!inputArgument||!outputArgument)throw new Error('requires immutable authored reservation and new output directory');
const withInitialBat=process.argv[4]==='with-initial-bat';if(process.argv[4]!==undefined&&!withInitialBat)throw new Error('unsupported initial equipment option');
const input=resolve(inputArgument),output=resolve(outputArgument),sha=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const explicitPhysics=process.argv[5]?JSON.parse(readFileSync(resolve(process.argv[5]),'utf8')):null;
if(explicitPhysics&&(Object.keys(explicitPhysics).sort().join('|')!=='authority|physics|spinUnit|velocityUnit|version'
  ||explicitPhysics.version!=='authored_pitch_physics_v1'||explicitPhysics.authority!=='AUTHORED_SYNTHETIC_INTEGRATION_TEST_NOT_EMPIRICAL_PLAYER'
  ||explicitPhysics.velocityUnit!=='m/s'||explicitPhysics.spinUnit!=='rad/s'))throw new Error('invalid authored pitch physics declaration');
const explicitObserver=process.argv[6]?JSON.parse(readFileSync(resolve(process.argv[6]),'utf8')):null;
const upright=process.argv[7]==='upright-measured-v2';
if(process.argv[7]!==undefined&&!upright)throw new Error('unsupported measured registration option');
if(explicitObserver&&(Object.keys(explicitObserver).sort().join('|')!=='authority|maximumPositionErrorMeters|maximumVelocityErrorMps|version'
  ||explicitObserver.version!=='authored_zero_observation_error_v1'
  ||explicitObserver.authority!=='SYNTHETIC_CONTROL_ISOLATION_TEST_NOT_EMPIRICAL_PLAYER'
  ||explicitObserver.maximumPositionErrorMeters!==0||explicitObserver.maximumVelocityErrorMps!==0))throw new Error('invalid synthetic observation declaration');
const priorManifest=JSON.parse(readFileSync(resolve(input,'manifest.json'),'utf8'));
strictEqual(sha(readFileSync(resolve(input,'reservation.sqlite'))),priorManifest.databaseSha256);
mkdirSync(output);const path=resolve(output,'working.sqlite');
const originalReservationDeclaration=JSON.parse(readFileSync(resolve(input,'declaration.json'),'utf8')),old=JSON.parse(readFileSync(resolve(input,'expected.json'),'utf8'));
const genesisDeclaration=JSON.parse(readFileSync(resolve(input,'genesisDeclaration.json'),'utf8'));
const genesis=initializeAuthoredNativeMatchV1(path,genesisDeclaration),actor=genesis.actor;
// New model edition, declared before its reservation. Do not mutate the old
// immutable model whose observation prior was an intentional zero-gravity test.
const physicalAir={ticksPerSecond:1e6,integrationStepTicks:2000,gravityY:-9.81,aerodynamics:REFERENCE_BASEBALL_AERODYNAMICS};
const observationCalibration=explicitObserver?{...old.battingModel.observationCalibration,
  sourceId:old.battingModel.observationCalibration.sourceId+':zero-error-test-v1',sourceVersion:'authored_zero_observation_error_v1',
  values:{...old.battingModel.observationCalibration.values,calibration:{...old.battingModel.observationCalibration.values.calibration,
    errorParameters:{...old.battingModel.observationCalibration.values.calibration.errorParameters,
      maximumPositionErrorMeters:0,maximumVelocityErrorMps:0}}}}:old.battingModel.observationCalibration;
const repertoire=upright?{...old.battingModel.repertoire,sourceId:old.battingModel.repertoire.sourceId+':upright-v2',sourceVersion:'authored_measured_upright_v2',
  values:{...old.battingModel.repertoire.values,repertoireVersion:MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2}}:old.battingModel.repertoire;
const parameters={capability:old.battingModel.capability,repertoire,decisionModel:old.battingModel.decisionModel,
  equipment:old.battingModel.equipment,observationCalibration,
  predictionCalibration:{...old.battingModel.predictionCalibration,sourceId:old.battingModel.predictionCalibration.sourceId+':physical-air-v2',sourceVersion:'authored_measured_physical_air_v2',
    values:{...old.battingModel.predictionCalibration.values,parameters:physicalAir}}};
const modelSource={...old.battingModel.source,sourceId:old.battingModel.source.sourceId+(explicitObserver?':physical-air-zero-error-test-v1':':physical-air-v2')+(upright?':upright-v2':''),
  sourceVersion:upright?'authored_physical_air_upright_v2':explicitObserver?'authored_physical_air_zero_error_test_v1':'authored_measured_physical_air_v2',
  repertoireRef:{sourceId:repertoire.sourceId,sourceVersion:repertoire.sourceVersion},
  observationCalibrationRef:{sourceId:observationCalibration.sourceId,sourceVersion:observationCalibration.sourceVersion},
  predictionCalibrationRef:{sourceId:parameters.predictionCalibration.sourceId,sourceVersion:parameters.predictionCalibration.sourceVersion}};
const modelStore=openSqlitePlayerBattingModelStore(path,{readAcceptedModel:id=>id===modelSource.sourceId?modelSource:null,
  readAcceptedCapability:id=>id===parameters.capability.sourceId?parameters.capability:null,
  readAcceptedRepertoire:id=>id===parameters.repertoire.sourceId?parameters.repertoire:null,
  readAcceptedDecisionModel:id=>id===parameters.decisionModel.sourceId?parameters.decisionModel:null,
  readAcceptedEquipment:id=>id===parameters.equipment.sourceId?parameters.equipment:null,
  readAcceptedObservationCalibration:id=>id===parameters.observationCalibration.sourceId?parameters.observationCalibration:null,
  readAcceptedPredictionCalibration:id=>id===parameters.predictionCalibration.sourceId?parameters.predictionCalibration:null});
let batting;try{batting=modelStore.accept(modelSource.sourceId);}finally{modelStore.close();}
deepStrictEqual(batting.repertoire,repertoire);deepStrictEqual(batting.repertoire.values.sampledProfiles,old.battingModel.repertoire.values.sampledProfiles);
const reservationDeclaration={...originalReservationDeclaration,battingModelReference:reference('world_player_batting_models',batting)};
const original=reserveAuthoredNativePlateAppearanceV1(path,reservationDeclaration);
const pitcher=actor.world.defenders.find(p=>p.registeredPosition==='P')!,binding=actor.defenderBindings.find(p=>p.playerId===pitcher.playerId)!;
const ns='authored-native-observed-first-physical-v2',version='explicit-synthetic-physical-air-v2',zero={x:0,y:0,z:0};
const policy={sourceId:ns+':response',sourceVersion:version,policyId:ns+':response-policy',version:'v1',availableAtDay:actor.binding.gameDay,
  motionDurationScaleAtFullFatigue:1.5,velocityRetentionAtFullFatigue:.5,spinRetentionAtFullFatigue:.75};
const policyRef={owner:'world_pitch_fatigue_policies' as const,sourceId:policy.sourceId,sourceHash:hash(policy),snapshotHash:hash(policy)};
const calibration=(playerId:string,route:string,response:unknown)=>({sourceId:ns+':calibration:'+playerId+':'+route,sourceVersion:version,playerId,route,
  acceptedAtDay:actor.binding.gameDay,provenance:{assessmentSourceId:ns+':synthetic-assessment:'+playerId+':'+route,assessmentVersion:version,
    calibrationSourceId:ns+':synthetic-zero-fatigue-response',calibrationVersion:version},response});
// Explicit zero-fatigue synthetic declarations. Production preparation has no
// nominal-copy fallback; these are not empirical athlete response measurements.
const declarations:any[]=[];
for(const [route,key]of Object.entries({batter_observation:'observationCalibration',batter_decision:'decisionModel',batter_motor:'capability',batter_swing:'repertoire'} as const))
  declarations.push(calibration(actor.binding.playerId,route,{kind:'accepted_execution_values_v1',values:batting[key].values}));
for(const defender of actor.world.defenders){
  const m=genesis.models.find(m=>m.playerId===defender.playerId)!;
  for(const [route,model]of [['defender_observation',m.observation],['defender_decision',m.decision],['defender_locomotion',m.locomotion]] as const)
    declarations.push(calibration(defender.playerId,route,{kind:'accepted_execution_values_v1',values:model.source.calibration}));
  if(defender.playerId===pitcher.playerId)declarations.push(calibration(defender.playerId,'pitch_delivery',{kind:'accepted_pitch_response_v1',policyReference:policyRef}));
}
const strikeZone={centerX:0,halfWidth:.2159,lowerY:.5,upperY:1.1};
const declaration:AuthoredNativePitchPreparationV1={version:'authored_native_observed_pitch_preparation_v1',namespace:ns,sourceVersion:version,
  genesisPins:reservationDeclaration.genesisPins,enrollmentReference:reference('same_pa_enrollments',original.enrollment),battingModelReference:reservationDeclaration.battingModelReference,
  timing:{sourceId:ns+':timing',sourceVersion:version,careerId:binding.careerId,playerId:binding.playerId,personLinkSourceId:binding.personLinkSourceId,acceptedAtDay:actor.binding.gameDay,
    profile:{baseStartIntervalUs:10_000_000,normalMotionToReleaseUs:600_000,followThroughUs:200_000,quickSpeedFactor:1.8,cadenceExecutionControl:.8,cadenceTimingKnowledge:.8,
      quickRepeatability:.8,naturalVariationUs:50_000,normalPhaseWeights:{gather:2,transition:3,stride:5},quickPhaseWeights:{gather:1,transition:2,stride:3}}},
  pitchResponse:policy,nominalPitch:{delivery:{matchSeed:19,moundReference:{...pitcher.position,y:0},outingId:ns+':outing',readyAtUs:actor.world.tick,
    timingIntent:{deliveryMode:'NORMAL',cadenceIntent:'STANDARD'},physics:explicitPhysics?.physics??{velocity:{x:0,y:0,z:-30},spin:{x:0,y:100,z:0}}},flight:{durationUs:1_500_000},
    batter:{plateZ:0,strikeZone,ballRadiusMeters:batting.equipment.values.ball.radiusM}},actualFlightParameters:physicalAir,
  emptyTotalProvenance:original.enrollment.participants.map((p:any)=>({playerId:p.binding.playerId,provenance:{assessmentSourceId:ns+':empty-pre-pitch-work-assessment:'+p.binding.playerId,
    assessmentVersion:version,calibrationSourceId:ns+':empty-prefix-zero-work',calibrationVersion:version}})),calibrations:declarations};
const p=prepareAuthoredNativeObservedPitchV1(path,declaration);
strictEqual(p.nativePitchLaunched,false);strictEqual(p.acceptedCalibrations.calibrations.length,32);
deepStrictEqual(p.batting,batting);strictEqual(p.batting.repertoire.values.sampledProfiles![0].measured.frames.length,137);
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path);
const sources=new Map<string,unknown>(),save=<T extends {sourceId:string}>(s:T)=>{sources.set(s.sourceId,s);return s;},get=(id:string)=>sources.get(id);
const perception=openSqliteBattingPerceptionStore(path,{readAcceptedPosture:get});
const initial=openSqliteSamePlateAppearanceInitialBallStore(path,{readAcceptedSetup:get,readAcceptedVenue:get,readAcceptedPlay:get,readAcceptedAssignment:get,readAcceptedOfficialPerson:get});
const dispatch=openSqliteSamePlateAppearanceDispatchStore(path,{readAcceptedConsumerSet:get,readAcceptedEpisode:get,readAcceptedRight:get,readAcceptedPhysicalPitch:get});
const equipment=openSqliteInitialBatEquipmentStore(path,{readAcceptedInitialBat:get});
try{
  const base={sourceVersion:version,enrollmentReference:declaration.enrollmentReference,viewReference:reference('reserved_pa_execution_views',p.view),firstPhysicalPitchSourceId:p.enrollment.source.firstPhysicalPitchSourceId};
  const postureSource=save({sourceId:ns+':posture',sourceVersion:version,capability:'owned_batting_invocation_posture_v1',viewReference:base.viewReference,member:p.roles[0].member,
    actionReference:p.request.actionReference,modelReference:declaration.battingModelReference,
    sceneBodyReferences:actor.world.defenders.map(f=>({playerId:f.playerId,bodyReference:reference('world_player_body_materializations',genesis.materializations.find(b=>b.source.playerId===f.playerId&&b.source.role!=='batter')!)})),
    geometry:{kind:'stationary_pre_pitch_scene_v1',startedAtTick:actor.world.tick,validUntilTick:p.calculation.calculation.trajectory.endTick+500_000,ticksPerSecond:1e6,
      handedness:batting.repertoire.values.sampledProfiles![0].handedness,
      // OpenBiomechanics laboratory +Y is the right-handed box; the proper
      // world permutation (Y,Z,X) therefore places that box at world +X.
      // Preserve old declarations in the legacy edition for reproducibility.
      centerOfMass:{x:upright?(batting.repertoire.values.sampledProfiles![0].handedness==='R'?.78:-.78):-.78,y:1,z:-.16},
      eyePosition:{x:upright?(batting.repertoire.values.sampledProfiles![0].handedness==='R'?.72:-.72):-.72,y:1.55,z:-.28},observerForward:{x:0,y:0,z:1},
      attention:{target:{kind:'ball'},focusedSinceTick:actor.world.tick},bodyReadyTick:actor.world.tick,latestMotorStartTick:p.calculation.calculation.trajectory.endTick,plateZ:0,strikeZone},
    provenance:{assessmentSourceId:ns+':stance-assessment',assessmentVersion:version,calibrationSourceId:ns+':explicit-stance',calibrationVersion:version}});
  const posture=perception.acceptPosture(postureSource.sourceId);if(posture.kind!=='batting_invocation_posture')throw new Error('authored posture pending');
  const body=posture.sceneBodies.find(b=>b.source.playerId===pitcher.playerId)!,hand=body.actor.primitives.find(p=>p.role==='tag_hand')!,foot=body.actor.primitives.find(p=>p.role==='left_foot')!;
  const venue=save({sourceId:ns+':venue',sourceVersion:version,capability:'same_pa_initial_ball_venue_v1',careerId:actor.binding.careerId,gameId:actor.source.gameId,playId:actor.match.playId,
    fixtureEventId:actor.binding.fixtureEventId,venueId:String(db.prepare('SELECT venue_id FROM official_fixtures WHERE game_id=?').get(actor.source.gameId)!.venue_id),availableAtDay:actor.binding.gameDay,
    pitcherPlate:{region:{center:pitcher.position,halfSize:{x:.4,z:.2},rotationRadians:0},surfaceHeightMeters:body.actor.bodyOriginHeightMeters+foot.offset.y},
    rulePolicy:{version:'closed_interior_venue_legal_regions_v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,rulesRevision:NPB_2026_RULE_PROFILE.rulesRevision,
      regions:[{regionId:ns+':explicit-interior',classification:'inside_playable_region',minimum:{x:-100,y:-1,z:-5},maximum:{x:100,y:10,z:150}}]}});
  const setupSource=save({sourceId:ns+':setup',sourceVersion:version,capability:'same_pa_initial_ball_setup_v1',enrollmentReference:base.enrollmentReference,viewReference:base.viewReference,
    actionReference:p.request.actionReference,postureReference:reference('batting_observation_v1_postures',posture),venueReference:originalRef(venue),firstPhysicalPitchSourceId:base.firstPhysicalPitchSourceId,
    pitcherPlayerId:pitcher.playerId,custody:{kind:'explicit_initial_secure_custody_v1',role:'tag_hand',ball:{tick:actor.world.tick,
      position:{x:pitcher.position.x+hand.offset.x,y:body.actor.bodyOriginHeightMeters+hand.offset.y,z:pitcher.position.z+hand.offset.z},velocity:zero,spin:zero}}});
  const setup=initial.acceptSetup(setupSource.sourceId);if(setup.kind!=='same_pa_initial_ball_setup_v1')throw new Error('authored setup pending');
  let initialBat:InitialBatEquipmentV1|null=null;
  if(withInitialBat){
    const batterBody=posture.model.bodyMaterialization,grasp=batting.repertoire.values.sampledProfiles![0],holderHand=batterBody.actor.primitives.find(p=>p.role==='tag_hand')!;
    const g=posture.source.geometry,handCenter={x:g.centerOfMass.x+holderHand.offset.x,y:batterBody.actor.bodyOriginHeightMeters+holderHand.offset.y,z:g.centerOfMass.z+holderHand.offset.z};
    // Authored stationary stance. It is declared BEFORE launch; no imported
    // reference key or future physical trajectory chooses this initial pose.
    const gear=save({sourceId:ns+':initial-bat',sourceVersion:version+':initial-bat',capability:'owned_initial_bat_equipment_v1',
      setupReference:reference('pa_initial_ball_v1_setups',setup),profileId:grasp.profileId,custody:'explicit_initial_secure_bat_grasp_v1',throughTick:g.validUntilTick,
      pose:{grip:{x:handCenter.x,y:handCenter.y-grasp.measured.handReferenceFromKnobM,z:handCenter.z},orientation:{x:0,y:0,z:0,w:1}},
      provenance:{assessmentSourceId:ns+':initial-bat-assessment',assessmentVersion:version,calibrationSourceId:ns+':authored-stationary-bat',calibrationVersion:version}});
    const before=JSON.stringify(db.prepare("SELECT type,name,sql FROM sqlite_master ORDER BY name").all());
    const bad=save({...gear,sourceId:gear.sourceId+':invalid-grasp',pose:{...gear.pose,grip:{...gear.pose.grip,x:gear.pose.grip.x+4}}});
    throws(()=>equipment.accept(bad.sourceId));strictEqual(JSON.stringify(db.prepare("SELECT type,name,sql FROM sqlite_master ORDER BY name").all()),before);
    const result=equipment.accept(gear.sourceId);if(result.kind!=='initial_bat_equipment_v1')throw new Error('initial bat pending');initialBat=result;
    strictEqual(result.binding.custodyInferred,false);strictEqual(result.binding.measuredStance,false);
  }
  const person=save({sourceId:ns+':umpire',sourceVersion:version,capability:'accepted_original_umpire_person_v1',careerId:actor.binding.careerId,officialId:ns+':plate-umpire',personId:ns+':umpire-person'});
  const assignment=save({sourceId:ns+':assignment',sourceVersion:version,capability:'same_pa_explicit_live_ball_assignment_v1',role:'plate_umpire',enrollmentReference:base.enrollmentReference,
    gameId:actor.source.gameId,playId:actor.match.playId,physicalPitchSourceId:base.firstPhysicalPitchSourceId,officialId:person.officialId,personId:person.personId,personReference:originalRef(person),
    policy:{sourceId:ns+':play-policy',sourceVersion:version,ruleProfileId:actor.match.ruleProfileId,kind:'accepted_original_live_ball_action_v1'}});
  const playSource=save({sourceId:ns+':play',sourceVersion:version,capability:'same_pa_initial_play_v1',setupReference:reference('pa_initial_ball_v1_setups',setup),
    assignmentReference:originalRef(assignment),officialId:person.officialId,personId:person.personId,declaration:'play'});
  const play=initial.acceptPlay(playSource.sourceId);if(play.kind!=='same_pa_initial_play_v1')throw new Error('authored Play pending');
  const cs=save({...base,sourceId:ns+':consumers',capability:'same_pa_consumer_set_v1',actionReference:p.request.actionReference,participantInputs:p.roles.map(role=>({member:role.member,
    calibrationReferences:role.routes.map(route=>({route,calibrationReference:reference('pa_dispatch_v1_execution_calibrations',p.acceptedCalibrations.calibrations.find(c=>c.source.member.playerId===role.member.playerId&&c.source.route===route)!)}))}))});
  const consumers=dispatch.acceptConsumerSet(cs.sourceId);if(consumers.kind!=='consumer_set_prepared')throw new Error('consumers pending');
  const es=save({...base,sourceId:ns+':episode',capability:'same_pa_first_pitch_episode_v1',actionReference:p.request.actionReference,consumerSetReference:reference('pa_dispatch_v1_consumer_sets',consumers)});
  const episode=dispatch.acceptEpisode(es.sourceId);if(episode.kind!=='prospective_episode_prepared')throw new Error('episode pending');
  const rs=save({...base,sourceId:ns+':right',capability:'same_pa_first_pitch_right_v1',actionReference:p.request.actionReference,consumerSetReference:es.consumerSetReference,
    episodeReference:reference('pa_dispatch_v1_episodes',episode),prefixReference:p.view.source.prefixReference});
  const right=dispatch.acceptRight(rs.sourceId);if(right.kind!=='immutable_right_prepared')throw new Error('right pending');
  const release=p.calculation.calculation.delivery.release,r=hand.radius+setup.ballRadiusMeters,releaseHand={...release.position,z:release.position.z+r};
  const motion={version:'controlled_held_pitch_v1',ticksPerSecond:1e6,initialOrientation:{x:0,y:0,z:0,w:1},held:[
    {tick:actor.world.tick,handCenter:setup.source.custody.ball.position,handVelocity:zero,ballOffset:zero,ballOffsetVelocity:zero,spin:zero},
    {tick:release.releaseAtUs-40000,handCenter:{x:pitcher.position.x-.3,y:1.45,z:pitcher.position.z+.3},handVelocity:zero,ballOffset:{x:0,y:0,z:-r},ballOffsetVelocity:zero,spin:zero},
    {tick:release.releaseAtUs,handCenter:releaseHand,handVelocity:release.velocity,ballOffset:{x:0,y:0,z:-r},ballOffsetVelocity:zero,spin:release.spin}],
    followThrough:[{tick:release.releaseAtUs,handCenter:releaseHand,handVelocity:release.velocity},
      {tick:release.releaseAtUs+50000,handCenter:{x:release.position.x,y:release.position.y,z:pitcher.position.z-.67},handVelocity:zero},
      {tick:p.calculation.calculation.delivery.timeline.followThroughEndUs,handCenter:{x:release.position.x,y:release.position.y,z:pitcher.position.z-.67},handVelocity:zero}]};
  const launchSource=save({sourceId:base.firstPhysicalPitchSourceId,sourceVersion:version,
    capability:initialBat?'same_pa_observed_physical_pitch_with_bat_v2':'same_pa_observed_physical_pitch_v1',rightReference:reference('pa_dispatch_v1_rights',right),
    actionReference:p.request.actionReference,initialPlayReference:reference('pa_initial_ball_v1_plays',play),custodyMotion:motion,
    ...(initialBat?{initialBatReference:reference(initialBatEquipmentTable,initialBat)}:{})});
  const launch=dispatch.acceptObservedPitch(launchSource.sourceId);if(launch.kind!=='same_pa_first_pitch_launched_v1')throw new Error('authored launch pending');
  deepStrictEqual(launch.originalActor,actor);deepStrictEqual(launch.beforeTimeline.status,{kind:'active',count:{balls:0,strikes:0}});strictEqual(launch.beforeTimeline.events.length,0);
  strictEqual(db.prepare('SELECT count(*) n FROM pa_dispatch_v1_pitch_actions').get()!.n,1);
  if(initialBat){
    strictEqual(launch.initialLiveBallBinding.kind,'same_pa_observed_initial_pitch_live_binding_v2');
    deepStrictEqual(equipment.read(initialBat.source.sourceId),initialBat);deepStrictEqual(equipment.accept(initialBat.source.sourceId),initialBat);
    const before=JSON.stringify(db.prepare('SELECT * FROM '+initialBatEquipmentTable).all());
    const late=save({...initialBat.source,sourceId:initialBat.source.sourceId+':late'});throws(()=>equipment.accept(late.sourceId));
    strictEqual(JSON.stringify(db.prepare('SELECT * FROM '+initialBatEquipmentTable).all()),before);
  }
  db.prepare('VACUUM INTO ?').run(resolve(output,'launch.sqlite'));
  const saveFile=(name:string,value:unknown)=>writeFileSync(resolve(output,name),JSON.stringify(value),{flag:'wx'});
  saveFile('expected.json',launch);saveFile('reference.json',reference('pa_dispatch_v1_pitch_actions',launch));saveFile('declaration.json',declaration);
  saveFile('genesis-declaration.json',genesisDeclaration);saveFile('batting-model-source.json',modelSource);saveFile('batting-model-parameters.json',parameters);
  saveFile('reservation-declaration.json',reservationDeclaration);
  saveFile('authored-sources.json',[...p.sources,...sources.values()]);
  saveFile('manifest.json',{scope:'FRESH_18_PERSON_MEASURED_MODEL_ACTUAL_INITIAL_NATIVE_LAUNCH',fresh18PersonGenesis:true,measuredBattingModelInSameDatabase:true,
    authoredGenesisReadPins:declaration.genesisPins,battingModelReference:declaration.battingModelReference,nativePitchLaunched:true,fullMatchVerified:false,
    files:{'launch.sqlite':sha(readFileSync(resolve(output,'launch.sqlite')))},originalReservationSha256:priorManifest.databaseSha256});
  if(initialBat)saveFile('initial-bat.json',{record:initialBat,reference:reference(initialBatEquipmentTable,initialBat),scope:'AUTHORED_STATIONARY_INITIAL_BAT_NOT_SWING_ADOPTION'});
  if(explicitPhysics)saveFile('authored-pitch-physics.json',explicitPhysics);
  if(explicitObserver)saveFile('authored-observation-test.json',explicitObserver);
  if(upright)saveFile('measured-registration.json',{version:MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2,gravityPreserved:true,originalMeasuredKeysChanged:false});
  process.stdout.write('PASS_AUTHORED_18_PERSON_MEASURED_MODEL_INITIAL_LAUNCH\n');
}finally{equipment.close();dispatch.close();initial.close();perception.close();db.close();}

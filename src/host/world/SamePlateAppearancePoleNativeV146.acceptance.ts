import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {appendFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {expect,it} from 'vitest';
import {NPB_2026_RULE_PROFILE} from '../../core/rules/RuleProfile';
import {REFERENCE_BASEBALL_AERODYNAMICS,REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from '../../core/sim/ball/BaseballAerodynamics';
import {samePaPhysicalLifecycleFixture} from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import {dispatchCalibrationValues} from './SamePlateAppearanceDispatchCalibration.test-support';
import {prepareInFlightBattingSwing} from './InFlightBattingLifecycleFixture.test-support';
import {prepareFreshPhysicalFieldFixture} from './SamePlateAppearancePhysicalFieldFixture.test-support';
import {openSqliteSamePlateAppearancePhysicalEpisodeStore} from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import {samePaExecutionReference as reference} from './SamePlateAppearanceExecutionFromSqlite';
import {actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {SAME_PA_POLE_ESCAPE_FIELD_ROOT_SOURCE_VERSION as ROOT,SAME_PA_POLE_ESCAPE_FIELD_STEP_SOURCE_VERSION as STEP,
  SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION as V3ROOT} from './SamePlateAppearanceBallPhysics';
import {assertSamePaPhysicalEpisodeStorage} from './SamePlateAppearancePhysicalEpisodeStorage';
import type {SamePaPhysicalFieldRootSource,SamePaPhysicalFieldStepSource} from './SamePlateAppearancePhysicalEpisode';
import type {AeroGroundBallPhysicsV1} from '../../core/sim/ball/VersionedBattedBallPhysics';

// Opt-in genuine Native owners. Not included in the normal unit-test sweep.
it('PV146 fresh actual rigid contact adopts pole equipment, rebounds, departs and survives complete providerless reopen',()=>{
  const raw=process.env.MINI_BASEBALL_POLE_V146_DIR;
  if(!raw)throw Error('PV146 requires its own new workspace evidence directory');
  const directory=resolve(raw),inside=relative(resolve('../'),directory);
  if(!inside||inside.startsWith('..')||isAbsolute(inside)||existsSync(directory)||process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY)
    throw Error('PV146 requires a new private directory within workspace work/ and no existing Native directory override');
  mkdirSync(directory);
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,started=Date.now();
  let h:ReturnType<typeof samePaPhysicalLifecycleFixture>|undefined,originalsClosed=false;
  const stage=(name:string)=>{
    // This map excludes Lifecycle's separate Source map. It is a partial
    // declaration journal, never a complete Source archive or admission proof.
    if(h)writeFileSync(join(directory,'partial-declarations.json'),JSON.stringify([...h.accepted]));
    appendFileSync(join(directory,'stages.jsonl'),JSON.stringify({name,at:Date.now(),elapsedMs:Date.now()-started,rss:process.memoryUsage().rss})+'\n');
    console.log('PV146 '+name+' '+(Date.now()-started)+'ms');
  };
  const census=(db:InstanceType<typeof Native>)=>{
    const schema=db.prepare("SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name").all();
    const tables=db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    return{schemaHash:hash(schema),tables:tables.map(row=>{
      const name=String(row.name),digest=createHash('sha256');let count=0;
      for(const record of db.prepare('SELECT * FROM main."'+name.replaceAll('"','""')+'"').iterate()){
        digest.update(JSON.stringify(record));digest.update('\n');count++;
      }
      return{name,count,sha256:digest.digest('hex')};
    })};
  };
  stage('fresh-fixture-start');
  process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY=directory;
  try{
    const declared=dispatchCalibrationValues();
    h=samePaPhysicalLifecycleFixture({profile:{ruleProfileId:NPB_2026_RULE_PROFILE.id},onFixtureStage:stage,
      explicitBatterObservation:{...declared.batter_observation,calibration:{...declared.batter_observation.calibration,
        errorParameters:{...declared.batter_observation.calibration.errorParameters,minimumPositionErrorMeters:0,maximumPositionErrorMeters:0,
          minimumVelocityErrorMps:0,maximumVelocityErrorMps:0}}},
      originalBaseCenters:{first:{x:19.09,z:19.09},second:{x:0,z:38.18},third:{x:-19.09,z:19.09}}});
    delete process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY;
    writeFileSync(join(directory,'original-database.json'),JSON.stringify({path:h.f.path}));stage('fresh-fixture-ready');
    const save=h.save;h.save=source=>{const result=save(source);stage('declare:'+source.sourceId);return result;};
    const before=h.current(),readyAtUs=Math.max(before.view.cut.evaluationTick,before.view.cut.bodyCut.completedAtTick);
    const planned=h.prepareAction('pole-native-v146:pitch3','observer_decision',{...h.original.nominalPitch,
      delivery:{...h.original.nominalPitch.delivery,readyAtUs,physics:{velocity:{x:0,y:3.5,z:-40},spin:{x:0,y:0,z:0}}}},
      {ticksPerSecond:1_000_000,integrationStepTicks:2_000,gravityY:-9.81,aerodynamics:REFERENCE_BASEBALL_AERODYNAMICS});
    const ballPhysics:AeroGroundBallPhysicsV1={kind:'aero_ground_v1',
      air:{ticksPerSecond:1_000_000,integrationStepTicks:2_000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
      ground:{ticksPerSecond:1_000_000,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,
        material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}};
    const preparations:ReturnType<typeof prepareFreshPhysicalFieldFixture>[]=[];
    const swing=prepareInFlightBattingSwing(h,planned,'pole-native-v146:pitch3',owned=>{
      preparations.push(prepareFreshPhysicalFieldFixture(h!,planned,owned.posture,owned.postureReference,'pole-native-v146:field',{ballPhysics}));
      stage('original-field-calibration');
    },{onStage:stage});
    const contact=swing.resolution.contact;if(!contact)throw Error('PV146 requires genuine original rigid contact');
    expect(preparations).toHaveLength(1);stage('actual-rigid-contact');
    const prepared=preparations[0],model=prepared.model,calibration=prepared.calibration;
    const speed=Math.hypot(contact.exitVelocity.x,contact.exitVelocity.z);if(speed===0)throw Error('PV146 synthetic obstacle requires nonzero horizontal exit');
    // Explicit synthetic fixture configuration, not a real park calibration.
    // Only geometry is declared; the actual pole query decides the response.
    const rootId='pole-native-v146:field-root',poleId='pv146-synthetic-pole',rootSource:SamePaPhysicalFieldRootSource={
      sourceId:rootId,sourceVersion:ROOT,capability:'same_pa_physical_field_root_v1',viewReference:h.current().viewReference,
      launchReference:swing.resolution.source.launchReference,previousOperationReference:swing.resolutionReference,resolutionReference:swing.resolutionReference,
      postureReference:calibration.source.postureReference,fieldInputs:{kind:'fresh_physical_field_calibration_v1',calibrationReference:prepared.calibrationReference},
      parameters:calibration.source.parameters,throughTick:contact.tick,ballPhysics,
      commands:model.actors.map(a=>({playerId:a.playerId,bodyAcceleration:{x:0,y:0,z:0},primitiveMotions:a.primitives.map(p=>({role:p.role,
        offsetVelocity:{x:0,y:0,z:0},offsetAcceleration:{x:0,y:0,z:0}}))})),
      parkEquipment:{version:'same_pa_park_equipment_v145',sourceId:'pole-native-v146:equipment',sourceVersion:'synthetic-collision-fixture-v1',
        gameId:h.f.actor.source.gameId,playId:h.f.actor.match.playId,physicalPitchSourceId:swing.resolution.physicalPitchSourceId,
        fixtureEventId:model.fixtureEventId,venueId:model.venueId,baseFieldSourceId:rootId,worldModelSourceId:model.sourceId,
        worldModelSourceVersion:model.sourceVersion,availableAtDay:1,fenceSurfaceIds:[],equipment:{version:'source_park_equipment_v145',poles:[{
          geometry:{surfaceId:poleId,center:{x:contact.ballCenter.x+2*contact.exitVelocity.x/speed,z:contact.ballCenter.z+2*contact.exitVelocity.z/speed},
            minimumHeight:0,maximumHeight:Math.max(4,contact.ballCenter.y+10),radiusM:.1},material:{restitution:.5,tangentialDamping:.25,spinDamping:.2}}]}}};
    const noRoot=census(h.f.db);
    for(const [label,patch]of [['day',{availableAtDay:h.f.actor.binding.gameDay+1}],['fixture',{fixtureEventId:'foreign'}]] as const){
      const id=rootId+':refuse:'+label;
      h.save({...rootSource,sourceId:id,parkEquipment:{...rootSource.parkEquipment!,...patch,baseFieldSourceId:id}});
      expect(()=>h!.physical.acceptOperation(id)).toThrow(/park equipment.*original.*scope/);
    }
    const wrongVersion={...rootSource,sourceId:rootId+':wrong-version',sourceVersion:V3ROOT};h.save(wrongVersion);
    expect(()=>h!.physical.acceptOperation(wrongVersion.sourceId)).toThrow(/explicit.*algorithm/);
    expect(census(h.f.db)).toEqual(noRoot);stage('root-scope-refusals');
    h.save(rootSource);const root=h.physical.acceptOperation(rootId);if(root.kind!=='same_pa_physical_field_root_v1')throw Error('PV146 original root pending');
    expect(root.parkEquipmentBinding?.equipmentHash).toBe(hash(rootSource.parkEquipment));
    expect(root.response.world.sourceCurve!.initial.ball).toEqual(root.response.world.flight.initialBall);
    expect(root.response.world.sourceCurve!.initial.originTick).toBe(contact.tick);expect(root.response.world.sourceCurve!.profile).toEqual(ballPhysics);
    expect(root.ballSolverEvidence?.solverVersion).toBe('source_field_pole_contact_escape_v145');
    const rootReference=reference('pa_physical_v1_field_roots',root),rootCensus=census(h.f.db);
    expect(h.physical.acceptOperation(rootId)).toEqual(root);expect(census(h.f.db)).toEqual(rootCensus);stage('root-accept-retry');
    h.advance(rootReference);stage('original-root-admitted');
    const stepSource:SamePaPhysicalFieldStepSource={sourceId:'pole-native-v146:impact',sourceVersion:STEP,capability:'same_pa_physical_field_step_v1',
      viewReference:h.current().viewReference,launchReference:rootSource.launchReference,previousOperationReference:rootReference,fieldRootReference:rootReference,
      previousFieldReference:rootReference,throughTick:contact.tick+200_000};
    const beforeStep=census(h.f.db);h.save({...stepSource,sourceId:'pole-native-v146:replace-equipment',parkEquipment:rootSource.parkEquipment});
    expect(()=>h!.physical.acceptOperation('pole-native-v146:replace-equipment')).toThrow();expect(census(h.f.db)).toEqual(beforeStep);
    h.save(stepSource);const impact=h.physical.acceptOperation(stepSource.sourceId);if(impact.kind!=='same_pa_physical_field_step_v1')throw Error('PV146 original impact pending');
    expect(impact.field.motion.world).toMatchObject({kind:'boundary',contacts:[{kind:'surface',surfaceId:poleId}]});
    expect(impact.field.motion.response.kind).toBe('rebound');expect(impact.ballSolverEvidence!.impulseCertificates).toHaveLength(1);
    const impactReference=reference('pa_physical_v1_field_steps',impact);h.advance(impactReference);stage('actual-pole-impulse');
    h.save({...stepSource,sourceId:'pole-native-v146:departure',viewReference:h.current().viewReference,previousOperationReference:impactReference,previousFieldReference:impactReference});
    const departure=h.physical.acceptOperation('pole-native-v146:departure');if(departure.kind!=='same_pa_physical_field_step_v1')throw Error('PV146 departure pending');
    expect(departure.ballSolverEvidence!.escapedIntervals).toHaveLength(1);expect(departure.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(impact.field.motion.world.moment.elapsedSeconds);
    const departureReference=reference('pa_physical_v1_field_steps',departure),saved=census(h.f.db),path=h.f.path;
    expect(h.physical.acceptOperation(departure.source.sourceId)).toEqual(departure);expect(census(h.f.db)).toEqual(saved);stage('actual-departure-retry');
    h.f.close();originalsClosed=true;stage('all-original-owners-closed');
    const reopened=openSqliteSamePlateAppearancePhysicalEpisodeStore(path);
    try{expect(reopened.readOperation(rootReference).record).toEqual(root);expect(reopened.readOperation(impactReference).record).toEqual(impact);
      expect(reopened.readOperation(departureReference).record).toEqual(departure);}finally{reopened.close();}
    const check=new Native(path,{readOnly:true});try{expect(assertSamePaPhysicalEpisodeStorage(check)).toBe(true);expect(census(check)).toEqual(saved);}finally{check.close();}
    stage('same-original-db-providerless-reopen');
    writeFileSync(join(directory,'receipt.json'),JSON.stringify({status:'PASS_PV146_ACTUAL_NATIVE_POLE_ROOT_IMPULSE_DEPARTURE_RETRY_ALL_CLOSE_REOPEN',
      rootReference,impactReference,departureReference,elapsedMs:Date.now()-started,originalDatabaseReopened:true,syntheticParkFixture:true,
      databaseCopies:0,officialResult:null,scoringResult:null,browserDelivery:false,census:saved},null,2));
  }finally{
    if(!originalsClosed)h?.f.close();delete process.env.BASEBALL_NATIVE_DATABASE_DIRECTORY;
  }
},1_200_000);

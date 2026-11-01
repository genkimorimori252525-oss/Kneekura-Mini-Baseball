import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {expect,it} from 'vitest';
import {withSqliteReadTransaction} from './SqliteReadTransaction.test-support';
import {readSamePaPhysicalOperationFromSqlite,readSamePaPhysicalFieldCalibrationFromSqlite} from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import {readHistoricalSamePaLifecycleViewFromSqlite,readCurrentSamePaLifecycleViewFromSqlite,readSamePaLifecycleRecordFromSqlite} from './SamePlateAppearanceLifecycleFromSqlite';
import {openSqliteSamePlateAppearancePhysicalEpisodeStore} from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import {samePaExecutionReference as reference} from './SamePlateAppearanceExecutionFromSqlite';
import {actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {createSourceFreeBallKernel} from '../../core/sim/ball/SourceFreeBallKernel';
import type {SamePaPhysicalOperationReference,SamePaPhysicalFieldStepSource} from './SamePlateAppearancePhysicalEpisode';
import type {SamePaReference} from './SamePlateAppearanceWorkPrefix';

it('PV147 uses the original admitted impact view for a real pole departure, retry and complete providerless reopen',()=>{
  if(!process.env.MINI_BASEBALL_POLE_V146_DIR)throw Error('PV147 requires the original V146 evidence directory');
  const directory=resolve(process.env.MINI_BASEBALL_POLE_V146_DIR),locator=JSON.parse(readFileSync(join(directory,'original-locators.json'),'utf8'));
  expect(locator.interpretation).toBe('RAW_LOCATORS_ONLY_NOT_NATIVE_AUTHENTICATION');expect(dirname(resolve(locator.databasePath))).toBe(directory);
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,
    db=new Native(locator.databasePath,{readOnly:true}),started=Date.now(),declarations=new Map<string,unknown>();
  const stage=(name:string)=>{
    writeFileSync(join(directory,'v147-partial-declarations.json'),JSON.stringify([...declarations]));
    appendFileSync(join(directory,'departure-stages-v147.jsonl'),JSON.stringify({name,at:Date.now(),elapsedMs:Date.now()-started,rss:process.memoryUsage().rss})+'\n');
  };
  const physical=openSqliteSamePlateAppearancePhysicalEpisodeStore(locator.databasePath,{readAcceptedOperation:id=>declarations.get(id)});
  let closed=false;
  const snapshot=(connection:InstanceType<typeof Native>=db)=>{
    const schema=connection.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all(),rows=new Map<string,{count:number;sha256:string}>();
    for(const entry of connection.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()){
      const name=String(entry.name),digest=createHash('sha256');let count=0;
      for(const row of connection.prepare('SELECT * FROM main."'+name.replaceAll('"','""')+'"').iterate()){digest.update(JSON.stringify(row)+'\n');count++;}
      rows.set(name,{count,sha256:digest.digest('hex')});
    }
    return{schemaHash:hash(schema),rows};
  };
  stage('original-recovery-start');
  try{
    const original=withSqliteReadTransaction(db,()=>{
      const rootPin=locator.pins.root[0]?.reference as SamePaPhysicalOperationReference|undefined,
        impactPin=locator.pins.step.find((x:{reference:{sourceId:string}})=>x.reference.sourceId==='pole-native-v146:impact')?.reference as SamePaPhysicalOperationReference|undefined;
      if(!rootPin||!impactPin)throw Error('original root/impact locator absent');
      const root=readSamePaPhysicalOperationFromSqlite(db,rootPin).record,impact=readSamePaPhysicalOperationFromSqlite(db,impactPin).record;
      if(root.kind!=='same_pa_physical_field_root_v1'||impact.kind!=='same_pa_physical_field_step_v1')throw Error('original physical kinds differ');
      const rootReference=reference('pa_physical_v1_field_roots',root),impactReference=reference('pa_physical_v1_field_steps',impact);
      expect(rootReference).toEqual(rootPin);expect(impactReference).toEqual(impactPin);
      expect(impact.source.fieldRootReference).toEqual(rootPin);expect(impact.field.motion.response.kind).toBe('rebound');
      const historical=readHistoricalSamePaLifecycleViewFromSqlite(db,impact.source.viewReference),
        prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',historical.view.source.prefixReference.sourceId);
      if(!prefix||prefix.kind!=='same_pa_lifecycle_prefix')throw Error('original historical prefix missing');
      expect(reference('pa_lifecycle_v1_work_prefixes',prefix)).toEqual(historical.view.source.prefixReference);
      if(root.source.fieldInputs.kind!=='fresh_physical_field_calibration_v1')throw Error('original fresh calibration required');
      const calibration=readSamePaPhysicalFieldCalibrationFromSqlite(db,root.source.fieldInputs.calibrationReference);
      expect(hash(calibration)).toBe(root.geometryBindingHash);stage('historical-originals-authenticated');
      const savedRow=db.prepare('SELECT source_id,source_hash,snapshot_hash FROM main.pa_physical_v1_field_steps WHERE source_id=?').get('pole-native-v147:departure');
      const stored=savedRow?readSamePaPhysicalOperationFromSqlite(db,{owner:'pa_physical_v1_field_steps',sourceId:String(savedRow.source_id),
        sourceHash:String(savedRow.source_hash),snapshotHash:String(savedRow.snapshot_hash)}).record:null;
      if(stored&&stored.kind!=='same_pa_physical_field_step_v1')throw Error('original committed departure kind differs');
      // This raw row is only a locator; the current reader authenticates every
      // prefix/TOTAL/actor/coverage dependency before any new Source is issued.
      const row=db.prepare('SELECT source_id,source_hash,snapshot_hash FROM main.pa_lifecycle_v1_execution_views WHERE source_id=?').get('physical-fixture:cut13:view');
      if(!row)throw Error('existing cut13 locator missing; do not duplicate canonical admission');
      const viewReference:SamePaReference<'pa_lifecycle_v1_execution_views'>={owner:'pa_lifecycle_v1_execution_views',sourceId:String(row.source_id),
        sourceHash:String(row.source_hash),snapshotHash:String(row.snapshot_hash)},current=stored
          ?readHistoricalSamePaLifecycleViewFromSqlite(db,viewReference):readCurrentSamePaLifecycleViewFromSqlite(db,viewReference);
      expect(current.view.cut.stage).toBe('field_active');expect(current.view.cut.physicalOperationReference).toEqual(impactPin);
      expect(current.view.lineage).toEqual(impact.lineage);expect(current.actor).toEqual(historical.actor);
      const currentPrefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',current.view.source.prefixReference.sourceId);
      if(!currentPrefix||currentPrefix.kind!=='same_pa_lifecycle_prefix')throw Error('current prefix missing');
      expect(currentPrefix.source.eventReferences).toEqual([...prefix.source.eventReferences,impactPin]);
      for(const participant of current.view.participants){const old=historical.view.participants.find(p=>p.playerId===participant.playerId);
        if(!old||old.activity.kind!=='MATCH'||participant.activity.kind!=='MATCH')throw Error('original explicit fixture MATCH effort missing');
        expect(participant.activity.effortUnits).toBe(old.activity.effortUnits);
      }
      stage(stored?'committed-departure-and-original-view-authenticated':'existing-current-impact-view-authenticated');
      return{root,impact,rootPin:rootReference,impactPin:impactReference,viewReference,current,stored};
    });
    const id='pole-native-v147:departure',source:SamePaPhysicalFieldStepSource={...original.impact.source,sourceId:id,viewReference:original.viewReference,
      previousOperationReference:original.impactPin,previousFieldReference:original.impactPin};
    expect(Object.hasOwn(source,'action')).toBe(false);expect(source.throughTick).toBeGreaterThan(original.current.view.cut.evaluationTick);
    const before=snapshot(),oldSteps=db.prepare('SELECT * FROM main.pa_physical_v1_field_steps ORDER BY operation_ordinal').all(),
      oldHeads=db.prepare('SELECT * FROM main.pa_physical_v1_heads ORDER BY enrollment_source_id').all();
    declarations.set(id,source);stage('declare-original-departure');
    const departure=physical.acceptOperation(id);if(departure.kind!=='same_pa_physical_field_step_v1')throw Error('original departure pending');
    stage('actual-departure-returned');
    expect(departure.source).toEqual(source);if(original.stored)expect(departure).toEqual(original.stored);
    // The synthetic pole reflects the genuine shot back toward the catcher.
    // The next actual body contact must interrupt the requested free horizon.
    expect(departure.field.motion.world).toMatchObject({kind:'boundary',contacts:[{kind:'actor',playerId:'p2',role:'body'}]});
    expect(departure.field.motion.response.kind).toBe('rebound');
    expect(departure.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(original.impact.field.motion.world.moment.elapsedSeconds);
    expect(departure.ballSolverEvidence!.impulseCertificates).toHaveLength(2);expect(departure.ballSolverEvidence!.escapedIntervals).toHaveLength(1);
    const cursor=departure.field.motion.cursor!,curve=cursor.sourceCurve!,moment=departure.field.motion.world.moment,
      poleImpulse=original.impact.ballSolverEvidence!.impulseCertificates[0].diagnostic,
      nextImpulse=departure.ballSolverEvidence!.impulseCertificates[1].diagnostic,poleCurve=original.impact.field.motion.cursor!.sourceCurve!;
    expect(departure.ballSolverEvidence!.impulseCertificates[0]).toEqual(original.impact.ballSolverEvidence!.impulseCertificates[0]);
    expect(nextImpulse.colliderKey).toBe('["actor","p2","body"]');expect(nextImpulse.incomingMoment).toEqual(moment);
    expect(poleCurve.initial).toEqual(poleImpulse.outgoingMoment);expect(curve.initial).toEqual(nextImpulse.outgoingMoment);
    expect(curve.profile).toEqual(original.root.source.ballPhysics);
    expect(moment.elapsedSeconds).toBeLessThan((source.throughTick-moment.originTick)/original.root.source.parameters.ticksPerSecond);
    expect(createSourceFreeBallKernel(poleCurve).evaluateAt(moment.elapsedSeconds,'incoming').moment).toEqual(moment);
    expect(createSourceFreeBallKernel(curve).evaluateAt(moment.elapsedSeconds,'outgoing').moment).toEqual(cursor.moment);
    expect(departure.ballSolverEvidence!.escapedIntervals[0].advance.colliderKey).toBe(poleImpulse.colliderKey);
    const departureReference=reference('pa_physical_v1_field_steps',departure),after=snapshot();expect(after.schemaHash).toBe(before.schemaHash);
    expect([...after.rows.keys()]).toEqual([...before.rows.keys()]);
    for(const [table,value]of before.rows)if(!['pa_physical_v1_field_steps','pa_physical_v1_heads'].includes(table))expect(after.rows.get(table)).toEqual(value);
    const newSteps=db.prepare('SELECT * FROM main.pa_physical_v1_field_steps ORDER BY operation_ordinal').all();
    expect(newSteps.slice(0,oldSteps.length)).toEqual(oldSteps);expect(newSteps).toHaveLength(oldSteps.length+(original.stored?0:1));
    expect(newSteps.at(-1)!.source_id).toBe(id);expect(newSteps.at(-1)!.snapshot_hash).toBe(departureReference.snapshotHash);
    const target=departure.lineage.enrollmentReference.sourceId;
    expect(db.prepare('SELECT * FROM main.pa_physical_v1_heads ORDER BY enrollment_source_id').all()).toEqual(oldHeads.map(head=>original.stored||head.enrollment_source_id!==target?head:
      {...head,operation_ordinal:departure.operationOrdinal,last_owner:'pa_physical_v1_field_steps',last_source_id:id,last_snapshot_hash:departureReference.snapshotHash}));
    if(original.stored)expect(after).toEqual(before);
    expect(physical.acceptOperation(id)).toEqual(departure);expect(snapshot()).toEqual(after);stage('regular-departure-retry-and-census');
    physical.close();db.close();closed=true;stage('all-original-handles-closed');
    const reopened=openSqliteSamePlateAppearancePhysicalEpisodeStore(locator.databasePath);
    try{expect(reopened.readOperation(departureReference).record).toEqual(departure);expect(reopened.acceptOperation(id)).toEqual(departure);}finally{reopened.close();}
    const finalCheck=new Native(locator.databasePath,{readOnly:true});try{expect(snapshot(finalCheck)).toEqual(after);}finally{finalCheck.close();}
    stage('same-original-db-providerless-reopen');
    writeFileSync(join(directory,'departure-receipt-v147.json'),JSON.stringify({status:'PASS_PV147_ORIGINAL_NATIVE_POLE_DEPARTURE_RETRY_ALL_CLOSE_REPLAY',
      departureReference,currentImpactViewReference:original.viewReference,elapsedMs:Date.now()-started,source:departure.source,
      escapedIntervals:departure.ballSolverEvidence!.escapedIntervals,originalTablesPreserved:true,addedStepRows:original.stored?0:1,databaseCopies:0,
      resumedCommittedDeparture:!!original.stored,nextBoundary:'catcher_body',requestedHorizonInterruptedByActualContact:true,
      newLifecycleAdmissions:0,newActionCalibrations:0,officialResult:null,browserDelivery:false,originalFreshTimeoutPreserved:true},null,2));
  }finally{if(!closed){physical.close();db.close();}}
},420_000);

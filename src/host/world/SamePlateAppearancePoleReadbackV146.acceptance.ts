import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {expect,it} from 'vitest';
import {withSqliteReadTransaction} from './SqliteReadTransaction.test-support';
import {readSamePaPhysicalOperationFromSqlite} from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import type {SamePaPhysicalOperationReference} from './SamePlateAppearancePhysicalEpisode';
import {actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {createSourceFreeBallKernel} from '../../core/sim/ball/SourceFreeBallKernel';
import {openSqliteSamePlateAppearancePhysicalEpisodeStore} from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import type {SamePaPhysicalFieldRoot,SamePaPhysicalFieldStep} from './SamePlateAppearancePhysicalEpisode';

/** The fresh writer timed out. Raw pins only locate its committed rows; the
 * original owner re-derives them, with no writer/provider/copy/repair. This
 * does not prove the timed-out first accept returned normally. */
it('PV146R reauthenticates the original committed pole root and impact from the same closed DB',()=>{
  if(!process.env.MINI_BASEBALL_POLE_V146_DIR)throw Error('PV146R requires the exact original directory');
  const directory=resolve(process.env.MINI_BASEBALL_POLE_V146_DIR),locator=JSON.parse(readFileSync(join(directory,'original-locators.json'),'utf8'));
  expect(locator.interpretation).toBe('RAW_LOCATORS_ONLY_NOT_NATIVE_AUTHENTICATION');expect(dirname(resolve(locator.databasePath))).toBe(directory);
  const rootPin=locator.pins.root[0]?.reference as SamePaPhysicalOperationReference|undefined,
    impactPin=locator.pins.step.find((x:{reference:{sourceId:string}})=>x.reference.sourceId==='pole-native-v146:impact')?.reference as SamePaPhysicalOperationReference|undefined;
  if(!rootPin||!impactPin)throw Error('original root and impact locator required');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,started=Date.now(),
    sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex'),beforeHash=sha(locator.databasePath),
    db=new Native(locator.databasePath,{readOnly:true});
  const stage=(name:string)=>appendFileSync(join(directory,'readback-stages.jsonl'),JSON.stringify({name,elapsedMs:Date.now()-started,at:Date.now()})+'\n');
  let receipt:Record<string,unknown>|undefined,originalRoot:SamePaPhysicalFieldRoot|undefined,originalImpact:SamePaPhysicalFieldStep|undefined;
  stage('original-read-start');
  try{
    withSqliteReadTransaction(db,()=>{
      const root=readSamePaPhysicalOperationFromSqlite(db,rootPin).record;if(root.kind!=='same_pa_physical_field_root_v1')throw Error('original root kind differs');
      stage('original-root-authenticated');
      const impact=readSamePaPhysicalOperationFromSqlite(db,impactPin).record;if(impact.kind!=='same_pa_physical_field_step_v1')throw Error('original impact kind differs');
      originalRoot=root;originalImpact=impact;
      stage('original-impact-authenticated');
      expect(impact.source).toEqual(locator.pendingImpactSource);
      expect(root.source.sourceVersion).toBe('same_pa_field_root_pole_escape_v145');expect(impact.source.sourceVersion).toBe('same_pa_field_step_pole_escape_v145');
      expect(root.parkEquipmentBinding!.equipmentHash).toBe(hash(root.source.parkEquipment));expect(impact.source.fieldRootReference).toEqual(rootPin);
      expect(impact.field.motion.world).toMatchObject({kind:'boundary',contacts:[{kind:'surface',surfaceId:'pv146-synthetic-pole'}]});
      expect(impact.field.motion.response.kind).toBe('rebound');expect(impact.ballSolverEvidence!.impulseCertificates).toHaveLength(1);
      const diagnostic=impact.ballSolverEvidence!.impulseCertificates[0].diagnostic,curve=root.response.world.sourceCurve!,moment=impact.field.motion.world.moment;
      expect(diagnostic.colliderKey).toBe('["surface","pv146-synthetic-pole"]');expect(diagnostic.incomingMoment).toEqual(moment);
      expect(createSourceFreeBallKernel({...curve,throughElapsedSeconds:(impact.source.throughTick-curve.initial.originTick)/curve.profile.air.ticksPerSecond})
        .evaluateAt(moment.elapsedSeconds,'incoming').moment).toEqual(moment);
      expect(impact.field.motion.cursor!.sourceCurve!.initial).toEqual(diagnostic.outgoingMoment);
      expect(diagnostic.outgoingMoment.originTick).toBe(curve.initial.originTick);
      const tables=db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name LIKE 'pa_physical_v1_%' ORDER BY name").all()
        .map(row=>({name:String(row.name),count:db.prepare('SELECT count(*) n FROM main."'+String(row.name).replaceAll('"','""')+'"').get()!.n}));
      receipt={status:'PASS_PV146R_ORIGINAL_OWNER_POLE_ROOT_IMPACT_REPLAY',rootReference:rootPin,
        impactReference:impactPin,elapsedMs:Date.now()-started,tables,firstTimedOutAcceptNormalReturnProven:false,departureProven:false,
        copiedDatabase:false,syntheticParkFixture:true,officialResult:null,browserDelivery:false};
    });
    stage('original-q1-read-completed');
  }finally{db.close();}
  expect(sha(locator.databasePath)).toBe(beforeHash);
  const fingerprint=()=>{
    const view=new Native(locator.databasePath,{readOnly:true});
    try{
      const schema=view.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all(),digest=createHash('sha256');
      for(const table of view.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()){
        digest.update(String(table.name));
        for(const row of view.prepare('SELECT * FROM main."'+String(table.name).replaceAll('"','""')+'"').iterate())digest.update(JSON.stringify(row)+'\n');
      }
      return{schemaHash:hash(schema),rowsHash:digest.digest('hex')};
    }finally{view.close();}
  };
  const beforeRetry=fingerprint(),owner=openSqliteSamePlateAppearancePhysicalEpisodeStore(locator.databasePath);
  try{
    expect(owner.acceptOperation(rootPin.sourceId)).toEqual(originalRoot);stage('regular-original-root-retry-returned');
    expect(owner.acceptOperation(impactPin.sourceId)).toEqual(originalImpact);stage('regular-original-impact-retry-returned');
  }finally{owner.close();}
  expect(fingerprint()).toEqual(beforeRetry);
  if(!receipt)throw Error('original readback result missing');
  writeFileSync(join(directory,'readback-receipt.json'),JSON.stringify({...receipt,elapsedMs:Date.now()-started,
    regularOriginalOwnerRetryReturned:true,allSchemaRowsHeadUnchanged:true,q1OriginalMainBytesUnchanged:true},null,2));
},180_000);

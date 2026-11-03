import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual,throws } from 'node:assert';
import { openSqliteMeasuredBattingBodyReferenceStore,measuredBattingBodyReferenceTable,type AcceptedMeasuredBattingBodyReferenceV1 } from '../../../src/host/world/SqliteMeasuredBattingBodyReferenceStore';
import { readInitialMeasuredBatControlPreparation,readInitialCoupledMeasuredBatControlPreparation } from '../../../src/host/world/InitialMeasuredBatControlFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';

const [decisionArg,prefixArg,studyArg,outputArg]=process.argv.slice(2);if(!decisionArg||!prefixArg||!studyArg||!outputArg)throw new Error('requires original decision, prefix, study and NEW output directory');
const decisionDir=resolve(decisionArg),prefixDir=resolve(prefixArg),studyDir=resolve(studyArg),output=resolve(outputArg),original=resolve(decisionDir,'match.sqlite');
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const durable=()=>({main:sha(original),wal:existsSync(original+'-wal')&&readFileSync(original+'-wal').length?sha(original+'-wal'):null});
const beforeInput=durable(),study=JSON.parse(readFileSync(resolve(studyDir,'study.json'),'utf8'));
strictEqual(study.databaseSha256,beforeInput.main);strictEqual(study.physicalExecutionAdmitted,false);strictEqual(study.bodyReferenceOwned,false);
const proposed=JSON.parse(readFileSync(resolve(studyDir,'input.json'),'utf8')),oldPrefix=JSON.parse(readFileSync(resolve(prefixDir,'preparation.json'),'utf8'));
mkdirSync(output);const path=resolve(output,'match.sqlite'),stage=resolve(output,'input-snapshot.sqlite');copyFileSync(original,stage);
if(beforeInput.wal)copyFileSync(original+'-wal',stage+'-wal');
const sqlite=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),inputDb=new sqlite.DatabaseSync(stage,{readOnly:true});
try{await sqlite.backup(inputDb,path);}finally{inputDb.close();}deepStrictEqual(durable(),beforeInput);
const db=new sqlite.DatabaseSync(path),census=()=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>{
  const rows=db.prepare('SELECT * FROM "'+String(row.name).replaceAll('"','""')+'"').all().map(r=>JSON.stringify(r)).sort();
  return [row.name,createHash('sha256').update(JSON.stringify(rows)).digest('hex')];});
const before=census();strictEqual(before.length,72);
const sources=new Map<string,unknown>(),owner=openSqliteMeasuredBattingBodyReferenceStore(path,{readAcceptedBodyReference:id=>sources.get(id)??null});
try{
  deepStrictEqual(readInitialMeasuredBatControlPreparation(path,oldPrefix.request),oldPrefix);
  const decision=JSON.parse(readFileSync(resolve(decisionDir,'expected.json'),'utf8')).records.at(-1);
  const gear=db.prepare('SELECT snapshot_json FROM batting_initial_equipment_v1_sources WHERE source_id=?').get(oldPrefix.request.initialBatReference.sourceId)!;
  const actorReference=JSON.parse(String(gear.snapshot_json)).actorReference;
  const actor=db.prepare('SELECT snapshot_json FROM physical_plate_appearance_actors WHERE source_id=?').get(actorReference.sourceId)!;
  deepStrictEqual(reference('physical_plate_appearance_actors',JSON.parse(String(actor.snapshot_json))),actorReference);
  const gameDay=JSON.parse(String(actor.snapshot_json)).binding.gameDay;
  const source:AcceptedMeasuredBattingBodyReferenceV1={sourceId:'authored-coupled-body:reference',sourceVersion:'explicit-synthetic-posture-v1',capability:'owned_measured_batting_body_reference_v1',
    initialBatReference:oldPrefix.request.initialBatReference,profileId:decision.calculation.commitment.profileId,availableAtDay:gameDay,
    reference:{provenance:proposed.body.reference.provenance,frames:proposed.body.reference.frames,sourceTicksPerSecond:proposed.body.reference.sourceTicksPerSecond},
    postureSpeed:{maximumSpeedMps:5,basis:'EXPLICIT_SYNTHETIC_PERSON_POSTURE_SPEED_V1',provenance:{assessmentSourceId:'authored-coupled-body:synthetic-posture-assessment',assessmentVersion:'v1',
      calibrationSourceId:'authored-coupled-body:synthetic-posture-calibration',calibrationVersion:'v1'}}};
  writeFileSync(resolve(output,'source.json'),JSON.stringify(source),{flag:'wx'});
  strictEqual(owner.accept('missing').kind,'pending');deepStrictEqual(census(),before);
  for(const [name,change] of [
    ['future-day',(s:any)=>{s.availableAtDay=gameDay+1;}],
    ['wrong-original-bat',(s:any)=>{s.initialBatReference.sourceHash='0'.repeat(64);} ],
    ['wrong-clip',(s:any)=>{s.reference.provenance.clipId+=':wrong';}],
    ['retimed-key',(s:any)=>{s.reference.frames[0].tick++;}],
  ] as const){const s=structuredClone(source);Object.assign(s,{sourceId:s.sourceId+':'+name});change(s);sources.set(s.sourceId,s);throws(()=>owner.accept(s.sourceId));deepStrictEqual(census(),before);}
  sources.set(source.sourceId,source);const body=owner.accept(source.sourceId);if(body.kind!=='measured_batting_body_reference_v1')throw new Error('owned body reference missing');
  strictEqual(body.bodyReferenceOwned,true);strictEqual(body.motionIssued,false);deepStrictEqual(body.source.reference.frames,proposed.body.reference.frames);
  const bodyControlReference=reference(measuredBattingBodyReferenceTable,body),request={...oldPrefix.request,throughTick:proposed.bat.throughTick,bodyControlReference};
  writeFileSync(resolve(output,'owned-body.json'),JSON.stringify(body),{flag:'wx'});writeFileSync(resolve(output,'request.json'),JSON.stringify(request),{flag:'wx'});
  const preparation=readInitialCoupledMeasuredBatControlPreparation(path,request);
  deepStrictEqual(preparation.control,proposed);strictEqual(preparation.bodyReferenceOwned,true);strictEqual(preparation.motionIssued,false);
  strictEqual(preparation.requiresPitcherControlRenewal,true);deepStrictEqual(preparation.certificate,study.certificate);
  deepStrictEqual(census().filter(row=>row[0]!==measuredBattingBodyReferenceTable),before);
  const saved=census();strictEqual(saved.length,before.length+1);
  strictEqual(db.prepare('SELECT count(*) n FROM '+measuredBattingBodyReferenceTable).get()!.n,1);
  const reopen=openSqliteMeasuredBattingBodyReferenceStore(path);
  try{deepStrictEqual(reopen.read(source.sourceId),body);deepStrictEqual(reopen.accept(source.sourceId),body);}finally{reopen.close();}
  const row=db.prepare('SELECT source_json FROM '+measuredBattingBodyReferenceTable+' WHERE source_id=?').get(source.sourceId)!;
  const corrupt=JSON.parse(String(row.source_json));corrupt.postureSpeed.maximumSpeedMps=99;
  db.prepare('UPDATE '+measuredBattingBodyReferenceTable+' SET source_json=? WHERE source_id=?').run(JSON.stringify(corrupt),source.sourceId);
  try{throws(()=>owner.read(source.sourceId));}finally{db.prepare('UPDATE '+measuredBattingBodyReferenceTable+' SET source_json=? WHERE source_id=?').run(String(row.source_json),source.sourceId);}
  deepStrictEqual(owner.read(source.sourceId),body);deepStrictEqual(census(),saved);
  throws(()=>readInitialCoupledMeasuredBatControlPreparation(path,{...request,bridgeStartTick:preparation.earliestBridgeTick-1}));deepStrictEqual(census(),saved);
  deepStrictEqual(durable(),beforeInput);
  writeFileSync(resolve(output,'preparation.json'),JSON.stringify(preparation),{flag:'wx'});
  writeFileSync(resolve(output,'native-report.json'),JSON.stringify({status:'PASS_NATIVE_OWNED_MEASURED_BODY_REFERENCE_AND_COUPLED_PREPARATION',ownerMocks:false,
    bodyReferenceOwned:true,originalTablesUnchanged:true,newOwnedTables:1,bodyRows:1,callbackFreeReopen:true,invalidOriginalsRefused:true,
    modifiedCalibrationRefused:true,corruptionRestoredExactly:true,originalMeasuredBatKeys:preparation.control.bat.measured.frames.length,
    originalHipKeys:preparation.control.body.reference.frames.length,originalObstacleCount:preparation.control.bat.body.obstacles.length,
    throughTick:request.throughTick,requiresPitcherControlRenewal:true,postureCalibrationBasis:source.postureSpeed.basis,
    physicalExecutionAdmitted:false,motionIssued:false,fullMatchVerified:false},null,2)+'\n',{flag:'wx'});
  process.stdout.write('PASS_NATIVE_OWNED_MEASURED_BODY_REFERENCE_AND_COUPLED_PREPARATION\n');
}finally{owner.close();db.close();}

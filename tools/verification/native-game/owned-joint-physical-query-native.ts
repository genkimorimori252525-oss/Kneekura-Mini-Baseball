import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual } from 'node:assert';
import { readInitialOwnedJointPhysicalCalculation } from '../../../src/host/world/InitialOwnedJointPhysicalCalculationFromSqlite';
import { createSourceFreeBallKernel } from '../../../src/core/sim/ball/SourceFreeBallKernel';

const [inputArg,outputArg]=process.argv.slice(2);if(!inputArg||!outputArg)throw new Error('requires owned joint Native input and NEW output directory');
const input=resolve(inputArg),output=resolve(outputArg),path=resolve(input,'match.sqlite');mkdirSync(output);
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const durable=()=>({main:sha(path),wal:existsSync(path+'-wal')&&readFileSync(path+'-wal').length?sha(path+'-wal'):null});
const beforeDurable=durable(),original=JSON.parse(readFileSync(resolve(input,'independent-readback.json'),'utf8'));
strictEqual(original.tableCount,74);deepStrictEqual(original.beforeDurableContent,beforeDurable);
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path,{readOnly:true});
const census=()=>({schema:db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
  rows:db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>[r.name,
    createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(v=>JSON.stringify(v)).sort())).digest('hex')])});
try{
  const before=census(),controls=JSON.parse(readFileSync(resolve(input,'request.json'),'utf8'));
  const request={controls,throughTick:controls.batter.throughTick};writeFileSync(resolve(output,'request.json'),JSON.stringify(request),{flag:'wx'});
  const value=readInitialOwnedJointPhysicalCalculation(path,request),r=value.result;
  if(r.kind==='unresolved'||r.kind==='scene_result'&&r.physical.kind==='unresolved')throw new Error('joint world contact query unresolved: '+JSON.stringify(r));
  const moment=r.kind==='scene_result'?(r.physical.kind!=='unresolved'?r.physical.moment:null):r.moment;
  if(!moment)throw new Error('unresolved scene has no physical moment');
  deepStrictEqual(moment.ball,createSourceFreeBallKernel(value.input.pitch.descriptor).evaluateAt(moment.elapsedSeconds,'incoming').moment.ball);
  strictEqual(r.coverage.replacedActorCount,2);strictEqual(r.coverage.retainedActorCount+2,r.coverage.originalActorCount);
  strictEqual(r.coverage.palmAttachmentPreserved,true);strictEqual(r.coverage.addedBat,true);
  strictEqual(value.physicalExecutionAdmitted,false);strictEqual(value.motionIssued,false);
  deepStrictEqual(census(),before);deepStrictEqual(durable(),beforeDurable);
  writeFileSync(resolve(output,'calculation.json'),JSON.stringify(value),{flag:'wx'});
  writeFileSync(resolve(output,'native-report.json'),JSON.stringify({status:'PASS_NATIVE_OWNED_INPUT_FULL_JOINT_PHYSICAL_CALCULATION',ownerMocks:false,authorCallbacks:false,
    schemasAndAllRowsUnchanged:true,durableContentUnchanged:true,tableCount:before.rows.length,
    boundaryKind:r.kind,boundaryTick:moment.ball.tick,exactElapsedSeconds:moment.elapsedSeconds,originalBallRootPreserved:true,
    originalActorCount:r.coverage.originalActorCount,retainedActorCount:r.coverage.retainedActorCount,replacedActorCount:2,addedRealBat:true,
    originalMeasuredBatKeys:value.input.batterControl.bat.measured.frames.length,actualPalmAndGloveReachCertified:true,
    conditionalOnControlExecution:true,physicalExecutionAdmitted:false,motionIssued:false,workloadTotalAdmitted:false,fullMatchVerified:false,
    databaseSha256:beforeDurable.main},null,2)+'\n',{flag:'wx'});
  process.stdout.write('PASS_NATIVE_OWNED_INPUT_FULL_JOINT_PHYSICAL_CALCULATION\n');
}catch(error){
  writeFileSync(resolve(output,'rejected-query.json'),JSON.stringify({error:error instanceof Error?error.message:String(error),physicalExecutionAdmitted:false,motionIssued:false,
    durableContentUnchanged:JSON.stringify(durable())===JSON.stringify(beforeDurable)},null,2)+'\n',{flag:'wx'});throw error;
}finally{db.close();}

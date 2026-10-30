import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual } from 'node:assert';
import { readPostImpactJointPhysicalCalculation } from '../../../src/host/world/PostImpactJointPhysicalCalculationFromSqlite';
import { initialJointWorkloadViewTable } from '../../../src/host/world/SqliteInitialJointWorkloadViewStore';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { createPostImpactBatBodyControlV1 } from '../../../src/core/sim/contact/PostImpactBatBodyControlV1';
import { createSourceFreeBallKernel } from '../../../src/core/sim/ball/SourceFreeBallKernel';

const [inputArg,outputArg]=process.argv.slice(2);if(!inputArg||!outputArg)throw new Error('requires accepted workload directory and NEW output directory');
const input=resolve(inputArg),output=resolve(outputArg),path=resolve(input,'match.sqlite'),sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const durable=()=>({main:sha(path),wal:existsSync(path+'-wal')&&readFileSync(path+'-wal').length?sha(path+'-wal'):null});
const beforeDurable=durable(),previous=JSON.parse(readFileSync(resolve(input,'independent-readback.json'),'utf8'));deepStrictEqual(beforeDurable,previous.beforeDurableContent);
mkdirSync(output);const Native=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new Native.DatabaseSync(path,{readOnly:true});
const census=()=>({schema:db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all(),rows:db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>[r.name,
  createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(v=>JSON.stringify(v)).sort())).digest('hex')])});
const save=(name:string,value:unknown)=>writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
try{
  const before=census();strictEqual(before.rows.length,77);const view=JSON.parse(readFileSync(resolve(input,'view.json'),'utf8'));
  const request={workloadViewReference:reference(initialJointWorkloadViewTable,view),throughTick:11134216};save('request.json',request);
  process.stdout.write('READ_AUTHENTIC_WORKLOAD_AND_IMPULSE\n');
  const result=readPostImpactJointPhysicalCalculation(path,request);save('calculation.json',result);
  if(result.result.kind==='unresolved')throw new Error('post-impact physical query unresolved: '+JSON.stringify(result.result));
  const physical=result.result,c=createPostImpactBatBodyControlV1(result.input.control),start=c.sample(c.fromElapsedSeconds),last=c.sample(c.throughElapsedSeconds);
  deepStrictEqual(physical.descriptor.initial.ball.position,c.impact.moment.ball.position);
  strictEqual(physical.descriptor.initial.elapsedSeconds,c.impact.moment.elapsedSeconds);strictEqual(physical.descriptor.initial.originTick,c.impact.moment.originTick);
  deepStrictEqual(physical.moment,createSourceFreeBallKernel(physical.descriptor).evaluateAt(physical.moment.elapsedSeconds,'incoming').moment);
  strictEqual(result.physicalExecutionAdmitted,false);strictEqual(result.motionIssued,false);
  deepStrictEqual(census(),before);deepStrictEqual(durable(),beforeDurable);
  save('recovery-control.json',{certificate:c.certificate,first:start,last,firstElapsedSeconds:c.fromElapsedSeconds,lastElapsedSeconds:c.throughElapsedSeconds});
  save('native-report.json',{status:'PASS_NATIVE_CONDITIONAL_POST_IMPACT_WORLD',ownerMocks:false,authorCallbacks:false,all77TableSchemasAndRowsUnchanged:true,durableContentUnchanged:true,
    kind:physical.kind,fromElapsedSeconds:c.fromElapsedSeconds,throughElapsedSeconds:physical.moment.elapsedSeconds,throughTick:physical.moment.ball.tick,
    originalClockAndPositionPreserved:true,actualRecoilUsed:true,coverage:physical.coverage,departureCount:physical.departures.length,
    reachedRecoveryEnd:physical.moment.elapsedSeconds===c.throughElapsedSeconds,requiresAcceptedRecoveryPolicy:true,requiresCapabilityRecalibration:true,
    physicalExecutionAdmitted:false,motionIssued:false,fullMatchVerified:false});process.stdout.write('PASS_NATIVE_CONDITIONAL_POST_IMPACT_WORLD\n');
}catch(error){save('rejected-query.json',{error:error instanceof Error?error.message:String(error),physicalExecutionAdmitted:false,motionIssued:false,durableContentUnchanged:JSON.stringify(durable())===JSON.stringify(beforeDurable)});throw error;}
finally{db.close();}

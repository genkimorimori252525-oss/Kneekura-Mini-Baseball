import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync,readFileSync,writeFileSync } from 'node:fs';
import { strictEqual,deepStrictEqual } from 'node:assert';
import { prepareInitialOwnedJointControlFromSqlite,type InitialOwnedJointControlRequestV1 } from '../../../src/host/world/InitialOwnedJointControlPreparationFromSqlite';
import { readMeasuredBattingBodyReferenceFromSqlite } from '../../../src/host/world/SqliteMeasuredBattingBodyReferenceStore';
import { withBattedWorldPhysicalReadTraversal } from '../../../src/host/world/SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';

const [path,requestPath,expectedPath,reportPath]=process.argv.slice(2);if(!path||!requestPath||!expectedPath||!reportPath)throw new Error('requires Native database, request, expected and NEW report');
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const durable=()=>({main:sha(path),wal:existsSync(path+'-wal')&&readFileSync(path+'-wal').length?sha(path+'-wal'):null});
const beforeDurable=durable(),Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path,{readOnly:true});
try{
  db.exec('PRAGMA query_only=1; BEGIN');
  const audit=()=>({schema:db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
    rows:db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>[r.name,
      createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(v=>JSON.stringify(v)).sort())).digest('hex')])});
  strictEqual(db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');deepStrictEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  const before=audit(),request=JSON.parse(readFileSync(requestPath,'utf8')) as InitialOwnedJointControlRequestV1;
  const result=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>{
    const joint=prepareInitialOwnedJointControlFromSqlite(db,request),body=readMeasuredBattingBodyReferenceFromSqlite(db,request.batter.bodyControlReference);
    return {joint,postureCalibrationBasis:body.source.postureSpeed.basis};
  }));
  deepStrictEqual(result.joint,JSON.parse(readFileSync(expectedPath,'utf8')));deepStrictEqual(audit(),before);strictEqual(before.rows.length,74);
  db.exec('COMMIT');deepStrictEqual(durable(),beforeDurable);
  writeFileSync(reportPath,JSON.stringify({status:'PASS_INDEPENDENT_NATIVE_OWNED_JOINT_CONTROL_PREPARATION',ownerMocks:false,authorCallbacks:false,
    outerConnectionReadOnly:true,schemasAndAllRowsUnchanged:true,durableContentUnchanged:true,tableCount:before.rows.length,
    bodyReferenceOwned:result.joint.bodyReferenceOwned,pitcherSuccessorCommandOwned:result.joint.pitcherSuccessorCommandOwned,
    originalMeasuredBatKeys:result.joint.batterControl.bat.measured.frames.length,originalHipKeys:result.joint.batterControl.body.reference.frames.length,
    originalObstacleCount:result.joint.batterControl.bat.body.obstacles.length,throughTick:result.joint.throughTick,
    originalPitcherDeadlineTick:result.joint.pitcherHandHold.request.fromTick,allDeclaredControlLeasesCoverThroughTick:true,
    postureCalibrationBasis:result.postureCalibrationBasis,motionIssued:false,physicalExecutionAdmitted:false,workloadTotalAdmitted:false,
    fullWorldAdvanceAllowed:false,fullMatchVerified:false,beforeDurableContent:beforeDurable},null,2)+'\n',{flag:'wx'});
  process.stdout.write('PASS_INDEPENDENT_NATIVE_OWNED_JOINT_CONTROL_PREPARATION\n');
}finally{db.close();}

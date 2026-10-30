import { createHash } from 'node:crypto';
import { readFileSync,readdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deepStrictEqual,strictEqual } from 'node:assert';
const root=process.cwd(),output=resolve(root,'../../outputs/verification-observed-initial-cut-v5');
const sha=data=>createHash('sha256').update(data).digest('hex');
const builds=['native-observed-initial-cut-v5','native-observed-initial-cut-readback-v4'].map(name=>{
  const directory=resolve(root,'..',name),path=resolve(directory,'build.json'),data=JSON.parse(readFileSync(path,'utf8'));
  strictEqual(sha(readFileSync(resolve(directory,'readback.mjs'))),data.entrySha256);
  for(const [input,expected]of Object.entries(data.inputs))strictEqual(sha(readFileSync(resolve(root,input))),expected,input);
  return {directory:name,manifestSha256:sha(readFileSync(path)),sourcePinCount:Object.keys(data.inputs).length};
});
const native=JSON.parse(readFileSync(resolve(output,'native-report.json'),'utf8')),report=JSON.parse(readFileSync(resolve(output,'independent-readback.json'),'utf8'));
strictEqual(native.status,'PASS_NATIVE_OBSERVED_INITIAL_CUT_AND_CAPTURE');
strictEqual(native.earlyDeliveryRefused,true);strictEqual(native.missingPrefixReadRefusedWithoutRepair,true);
strictEqual(report.status,'PASS_INDEPENDENT_NATIVE_INITIAL_CUT_REOPEN');strictEqual(report.schemasAndAllRowsUnchanged,true);
strictEqual(report.beforeFileHash,report.afterFileHash);strictEqual(sha(readFileSync(resolve(output,'match.sqlite'))),report.afterFileHash);
strictEqual(sha(readFileSync(resolve(output,'expected.json'))),report.expectedSha256);
const expected=JSON.parse(readFileSync(resolve(output,'expected.json'),'utf8'));
deepStrictEqual(expected.records.map(r=>r.kind),['observed_initial_cut_v1','observed_initial_capture_v1','observed_initial_cut_v1',
  'observed_initial_capture_v1','observed_initial_delivery_v1','observed_initial_prediction_v1']);
strictEqual(report.actualCuts,2);strictEqual(report.actualCaptures,2);strictEqual(report.sensoryDeliveryAdmitted,true);strictEqual(report.observedPredictionAdmitted,true);
const tasks=['MB-20261016-INITIAL-PIPELINE-CORE-REGRESSION','MB-20261016-INITIAL-RESERVED-DRIVER-BUILD','MB-20261016-INITIAL-RESERVED-NATIVE',
  'MB-20261016-INITIAL-RESERVED-READER-BUILD','MB-20261016-INITIAL-RESERVED-INDEPENDENT','MB-20261016-INITIAL-RESERVED-TSC'];
const directory=resolve(root,'docs/ai-continuity/verification-receipts');
const receipts=tasks.map(task=>{
  const names=readdirSync(directory).filter(n=>n.startsWith(task+'_')&&n.endsWith('.json'));strictEqual(names.length,1,'ambiguous receipt '+task);
  const data=readFileSync(resolve(directory,names[0])),r=JSON.parse(data);strictEqual(r.result,'PASS');
  const log=readFileSync(resolve(root,r.output_path));strictEqual(sha(log),r.output_sha256);
  if(task.endsWith('CORE-REGRESSION'))strictEqual(/Tests\s+44 passed/.test(log.toString('utf8')),true);
  return {task,path:'docs/ai-continuity/verification-receipts/'+names[0],sha256:sha(data),elapsedMs:r.elapsed_ms};
});
const manifest={scope:'SYNTHETIC_NATIVE_FIRST_PITCH_PHYSICS_CAPTURE_DELIVERY_AND_OBSERVED_FORECAST',builds,receipts,
  originalInitialLaunchInputDirectory:'verification-observed-initial-adoption-v3',
  originalInitialLaunchSha256:sha(readFileSync(resolve(root,'../../outputs/verification-observed-initial-adoption-v3/launch.sqlite'))),
  files:Object.fromEntries(readdirSync(output).filter(n=>n!=='manifest.json').map(n=>[n,sha(readFileSync(resolve(output,n)))])),
  coreAndHostRegressionTestsPassed:44,nativeOperationsAdmitted:6,actualCuts:2,actualCapturedSamples:2,
  sensoryDeliveryAdmitted:true,observedPredictionAdmitted:true,ownerMocks:false,originalRowsUnchanged:true,
  independentSchemasAndAllRowsUnchanged:true,fresh18PersonGenesis:false,measuredBattingAdmitted:false,fullMatchVerified:false,
  preservedInitialTypecheckFailure:'docs/ai-continuity/verification-receipts/MB-20261016-INITIAL-CUT-TSC_1bf4ec38a9a34b3da613b35620194a16.json',
  limitations:['Finite synthetic hand control, no measured pitching or muscle torque calibration.',
    'No workload TOTAL/physiology transition or new fatigue calibration is admitted by these operations.',
    'Owned batting motion is required before the reachable bat region; control expiry and uncertain contact refuse advance.',
    'Batting assessment/decision, measured commitment, body-control renewal, generic fielding, runners, official closure and full-match audits remain.']};
const path=resolve(output,'manifest.json');
if(process.argv[2]==='--verify')deepStrictEqual(JSON.parse(readFileSync(path,'utf8')),manifest);
else writeFileSync(path,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({status:'PASS_INITIAL_PIPELINE_SOURCE_AND_EVIDENCE_PINS',builds,operations:6,regressionTests:44})+'\n');

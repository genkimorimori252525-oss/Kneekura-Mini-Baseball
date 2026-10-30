import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deepStrictEqual, strictEqual } from 'node:assert';

// Run from the repository after the declared tests and closed-file reader.
// Fail rather than relabeling an incomplete or changed evidence set.
const root=process.cwd(),output=resolve(root,'../../outputs/verification-observed-initial-adoption-v3');
const sha=data=>createHash('sha256').update(data).digest('hex');
const pinsPath=resolve(root,'../native-observed-launch-readback-v2/build.json'),pins=JSON.parse(readFileSync(pinsPath,'utf8'));
for(const [name,expected] of Object.entries(pins.inputs))strictEqual(sha(readFileSync(resolve(root,name))),expected,name);
const report=JSON.parse(readFileSync(resolve(output,'independent-readback.json'),'utf8'));
strictEqual(report.status,'PASS_INDEPENDENT_NATIVE_OBSERVED_LAUNCH_REOPEN');
strictEqual(sha(readFileSync(resolve(output,'launch.sqlite'))),report.beforeFileHash);
strictEqual(report.afterFileHash,report.beforeFileHash);
strictEqual(sha(readFileSync(resolve(output,'expected.json'))),report.expectedSha256);
strictEqual(sha(readFileSync(resolve(output,'reference.json'))),report.referenceSha256);
deepStrictEqual(report.executionRowCounts.map(row=>row[1]),[1,1,1,1,1]);
const directory=resolve(root,'docs/ai-continuity/verification-receipts');
const tasks=['MB-20261016-HELD-HAND-AND-SOURCE','MB-20261016-OBSERVED-HAND-ADOPTION','MB-20261016-OBSERVED-LEGACY-EXECUTION',
  'MB-20261016-OBSERVED-HAND-TSC','MB-20261016-OBSERVED-READBACK-BUILD-V2','MB-20261016-OBSERVED-HAND-INDEPENDENT'];
const receipts=tasks.map(task=>{
  const names=readdirSync(directory).filter(n=>n.startsWith(task+'_')&&n.endsWith('.json'));
  strictEqual(names.length,1,'ambiguous receipt '+task);
  const path=resolve(directory,names[0]),receipt=JSON.parse(readFileSync(path,'utf8'));
  strictEqual(receipt.result,'PASS');strictEqual(sha(readFileSync(resolve(root,receipt.output_path))),receipt.output_sha256);
  return {task,path:'docs/ai-continuity/verification-receipts/'+names[0],sha256:sha(readFileSync(path)),elapsedMs:receipt.elapsed_ms};
});
const files=Object.fromEntries(readdirSync(output).filter(name=>name!=='manifest.json').map(name=>[name,sha(readFileSync(resolve(output,name)))]));
const manifest={scope:'SYNTHETIC_NATIVE_OBSERVED_FIRST_LAUNCH_WITH_CUSTODY_AND_PLAY',nativeFirstPitchAdopted:true,
  closedDatabaseIndependentProcessVerified:true,testFiles:6,testsPassed:44,fullMatchVerified:false,
  fresh18PersonGenesis:false,measuredBattingAdmitted:false,sensorsAfterRelease:false,
  sceneBodies:report.sceneBodies,controlThroughTick:report.controlThroughTick,
  sourcePinCount:Object.keys(pins.inputs).length,sourcePinsCurrent:true,buildManifestSha256:sha(readFileSync(pinsPath)),files,receipts,
  preservedInitialFailure:'docs/ai-continuity/verification-receipts/MB-20261016-OBSERVED-INITIAL-ADOPTION_a42c58b7a2c848bcab17d7f9d5ce43b5.json',
  limitations:['Explicit synthetic hand control; no measured pitching or muscle torque calibration.',
    'Free-ball CCD against moving hand after release and initial sensory/commitment admission remain to be connected.',
    'Finite hand control must be renewed or the world stopped at its expiry. No stale pose extrapolation.',
    'Mixed nine innings, 100-game audits, empirical player SI and real-phone acceptance remain unverified.']};
if(process.argv[2]==='--verify')deepStrictEqual(JSON.parse(readFileSync(resolve(output,'manifest.json'),'utf8')),manifest);
else writeFileSync(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({status:'PASS_OBSERVED_LAUNCH_EVIDENCE_PINS',sourcePins:manifest.sourcePinCount,tests:manifest.testsPassed})+'\n');

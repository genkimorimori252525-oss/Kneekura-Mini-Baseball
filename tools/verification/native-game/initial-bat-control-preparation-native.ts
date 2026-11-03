import { createRequire } from 'node:module';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual,throws } from 'node:assert';
import { readInitialMeasuredBatControlPreparation } from '../../../src/host/world/InitialMeasuredBatControlFromSqlite';
import { createHeldToMeasuredBatControlV1 } from '../../../src/core/sim/contact/HeldToMeasuredBatControlV1';

const [inputArg,outputArg]=process.argv.slice(2);if(!inputArg||!outputArg)throw new Error('requires saved initial decision directory and NEW output directory');
const input=resolve(inputArg),output=resolve(outputArg),path=resolve(input,'match.sqlite');mkdirSync(output);
const expected=JSON.parse(readFileSync(resolve(input,'expected.json'),'utf8')),decision=expected.records.at(-1);
strictEqual(decision.kind,'observed_initial_decision_v1');strictEqual(decision.calculation.commitment.action,'SWING');
const sqlite=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new sqlite.DatabaseSync(path,{readOnly:true});
let launch:any;
try{launch=JSON.parse(String(db.prepare('SELECT snapshot_json FROM pa_dispatch_v1_pitch_actions WHERE source_id=?').get(decision.source.launchReference.sourceId)!.snapshot_json));}
finally{db.close();}
strictEqual(launch.initialLiveBallBinding.kind,'same_pa_observed_initial_pitch_live_binding_v2');
const measured=decision.calculation.commitment.sampledTrajectoryV1;
const end=measured.startTick+(measured.frames.at(-1).tick-measured.frames[0].tick)/measured.sourceTicksPerSecond/measured.playbackRate*measured.ticksPerSecond;
const r={initialBatReference:launch.initialLiveBallBinding.initialBatReference,decisionReference:expected.references.at(-1),
  bridgeStartTick:Math.max(decision.calculation.nominalRequest.source.bodyReadyTick,decision.evaluationTick+decision.calculation.effectiveValues.motor.motorLatencyTicks),
  // Prepare only the currently owned joint-world interval. A successful
  // prefix does not certify the later clip or renew the pitcher's control.
  throughTick:Math.min(launch.initialLiveBallBinding.initialBat.binding.control.throughTick,
    launch.initialLiveBallBinding.ownedHandControlThroughTick,Math.ceil(end)-1)};
writeFileSync(resolve(output,'request.json'),JSON.stringify(r),{flag:'wx'});
try{
  const result=readInitialMeasuredBatControlPreparation(path,r);strictEqual(result.motionIssued,false);strictEqual(result.physicalEffect,'none');
  deepStrictEqual(result.control.measured,measured);strictEqual(result.certificate.measuredKeysChanged,false);
  const model=createHeldToMeasuredBatControlV1(result.control),at=model.sampleContinuous(measured.startTick),before=model.sampleContinuous(measured.startTick-.0001);
  for(const k of ['x','y','z'] as const){
    strictEqual(Math.abs(before.state.pose.grip[k]-at.state.pose.grip[k])<1e-6,true);
    strictEqual(Math.abs(before.state.linearVelocity[k]-at.state.linearVelocity[k])<1e-5,true);
    strictEqual(Math.abs(before.state.angularVelocity[k]-at.state.angularVelocity[k])<1e-5,true);
  }
  throws(()=>readInitialMeasuredBatControlPreparation(path,{...r,bridgeStartTick:result.earliestBridgeTick-1}),/readiness/);
  writeFileSync(resolve(output,'preparation.json'),JSON.stringify(result),{flag:'wx'});
  writeFileSync(resolve(output,'native-report.json'),JSON.stringify({status:'PASS_NATIVE_CURRENT_INITIAL_CONTROL_PREPARATION',
    ownerMocks:false,authorCallbacks:false,originalMeasuredKeys:measured.frames.length,bridgeStartTick:r.bridgeStartTick,measuredStartTick:measured.startTick,
    bodyReachBoundM:result.certificate.handReachUpperBoundM,sweetSpeedUpperBoundMps:result.certificate.sweetSpeedUpperBoundMps,
    actualBodyReachAndClearanceCertified:true,certifiedThroughTick:r.throughTick,fullMeasuredIntervalCertified:false,
    nextWorldControlDeadlineTick:launch.initialLiveBallBinding.ownedHandControlThroughTick,
    tooEarlyApproachRefused:true,requiresPitcherControlRenewal:result.requiresPitcherControlRenewal,
    motionIssued:false,physicalEffect:'none',fullMatchVerified:false},null,2)+'\n',{flag:'wx'});
  process.stdout.write('PASS_NATIVE_CURRENT_INITIAL_CONTROL_PREPARATION\n');
}catch(error){
  writeFileSync(resolve(output,'rejected-preparation.json'),JSON.stringify({status:'REJECTED_NATIVE_INITIAL_CONTROL_PREPARATION',request:r,
    error:error instanceof Error?error.message:String(error),motionIssued:false,fullMatchVerified:false},null,2)+'\n',{flag:'wx'});
  throw error;
}

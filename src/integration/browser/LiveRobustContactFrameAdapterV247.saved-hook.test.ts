import {it,expect} from 'vitest';
import {planLiveRobustContactFrameV247} from './LiveRobustContactFrameAdapterV247';


import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';







it('compares pinned instrumented Live before late correction without altering the record',async()=>{
 const path='src/integration/browser/LivePitchV1.ts',source=readFileSync(path,'utf8');
 expect(createHash('sha256').update(source).digest('hex')).toBe('1fc48dc6142e1dd5da87ff8d896eb8002a5fcef90725a05c3bf242b57d3a18c0');
 const marker='  const uncorrectedReference=createReferenceBatKinematicsV1(impactReference),headroom=';
 expect(source.split(marker)).toHaveLength(2);
 const hook=`  (globalThis as any).__v247Probe({recipe:{originTick:input.originTick,decisionTick:observationTick,decisionTimeSeconds:decisionTime,nominalArrivalSeconds:prediction.elapsedSeconds,technicalTimingOffsetSeconds:b.technicalTimingOffsetSeconds??0,latencySeconds:b.motorLatencySeconds,startMode:envelopeV133?'ENVELOPE':swingMotorV121||executionV122||intentV122||spinMotionV123||battingDirectionV149||positionObserverV151?'MOTOR':'LEGACY',contactSourceTick:sourceContactTick,rampSeconds,reference:{...referenceInput,rotation:referenceInput.transform.rotation},normalCenter:nominalSweetSpotV153,limits:{...(effectiveMaximumSpeedV121===undefined?{}:{maximumSweetSpotSpeedMps:effectiveMaximumSpeedV121}),...(executionV122?{maximumGripAccelerationMps2:executionV122.maximumGripAccelerationMps2,maximumAngularAccelerationRadPerSecond2:executionV122.maximumAngularAccelerationRadPerSecond2,maximumSweetSpotAccelerationMps2:executionV122.maximumSweetSpotAccelerationMps2}:{})},impactTrajectory},sample:{timingSeconds:timingError,aim:aimError,actualSweetSpotT:sweetSpotT},registration:{...nominalInputsV154.get(rate),reference:nominalReferenceV153},delta:deltaV244??{x:0,y:0,z:0},actual:impactReference,saturationV153});\n`;
 const pre='  let impactReference=impactTrajectory===undefined?translatedReference:'; expect(source.split(pre)).toHaveLength(2);
 const instrumented=source.replace(pre,'  const __v247Before=referenceInput;\n'+pre).replace(marker,hook.replace('reference:{...referenceInput,rotation:referenceInput.transform.rotation}','reference:{...__v247Before,sweetSpotT:planningSweetSpotT,rotation:__v247Before.transform.rotation}')+marker);
 const compile=async(instrument:boolean)=>{const result=await build({entryPoints:['src/integration/browser/LiveBaseballMatchV1.ts'],absWorkingDir:process.cwd(),bundle:true,write:false,platform:'node',format:'cjs',target:'node20',plugins:instrument?[{name:'pinned-observer',setup(b){b.onLoad({filter:/LivePitchV1\.ts$/},()=>({contents:instrumented,loader:'ts'}));}}]:[]});const m={exports:{} as any};new Function('module','exports','require',result.outputFiles[0].text)(m,m.exports,createRequire(import.meta.url));return m.exports;};
 const original=await compile(false),observed=await compile(true),bytes=readFileSync('work/maker-effective-forecast-v246-hook-browser-01/episode-1-step-1.json');
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('fd32dfd3fd70e8536d212bdea5e8dd7fd6dcf6961f1651f1803234d6efff2da7');
 // @ts-expect-error Existing lossless verification codec is JavaScript.
 const {parseDebugRecord,stringifyDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');
 const saved=parseDebugRecord(bytes.toString('utf8')),config=saved.capture.configuration,command=saved.step.trialRecord.command;
 const captures:any[]=[];(globalThis as any).__v247Probe=(v:any)=>captures.push(v);
 try {const a=original.createLiveBaseballMatchWorkerV116(config,saved.step.before),b=observed.createLiveBaseballMatchWorkerV116(config,saved.step.before),x=a.issuePitch(command),y=b.issuePitch(command);
  expect(stringifyDebugRecord(x)).toBe(stringifyDebugRecord(y));expect(stringifyDebugRecord(a.captureContinuationV116())).toBe(stringifyDebugRecord(b.captureContinuationV116()));
  const c=captures.at(-1),{startTick:_s,transform:_transform,...rest}=c.recipe.reference;c.recipe.reference={...rest,rotation:c.recipe.reference.rotation};
  expect(Math.hypot(c.delta.x,c.delta.y,c.delta.z)).toBeGreaterThan(0);expect(c.saturationV153.temporalScale).toBeLessThan(1);
  const {desiredFieldAngleDegrees:_angle,...registration}=c.registration,declared={recipe:c.recipe,registration,cutoffTick:registration.prediction.availableTick,bats:'L' as const,technique:'HOOK' as const,thresholds:{minimumComponent:1,minimumImprovement:1},sigma:{timingSeconds:.004,aim:{x:.004,y:.004,z:.0012}},maximumEvaluations:250,maximumSearchSamples:250*4096};
  const started=performance.now(),result=planLiveRobustContactFrameV247(declared),elapsedMs=performance.now()-started;
  expect(['PLANNED','NO_TARGET','UNRESOLVED']).toContain(result.status);expect(result.assumptions.actualFutureUsed).toBe(false);console.log('V247_SAVED_HOOK_ADAPTER',{elapsedMs,status:result.status,reason:'reason' in result?result.reason:null,nominalContactSearchCalls:'nominalContactSearchCalls' in result?result.nominalContactSearchCalls:null,nominalContactSearchSamples:'nominalContactSearchSamples' in result?result.nominalContactSearchSamples:null,scenarioCalls:result.contactSearchCalls,scenarioSamples:result.contactSearchSamples,syntheticSigmaNotCalibration:true});
 }finally{delete (globalThis as any).__v247Probe;}
},180000);
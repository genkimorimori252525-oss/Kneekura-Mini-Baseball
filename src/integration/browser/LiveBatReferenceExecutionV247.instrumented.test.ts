import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {buildLiveBatReferenceExecutionV247} from './LiveBatReferenceExecutionV247';
import {createReferenceBatKinematicsV1} from '../../core/sim/contact/ReferenceBatKinematicsV1';
import {AUTHORED_LIVE_BATTER_OBSERVATION_V151} from './LiveBatterObservationV151';
import {AUTHORED_OBSERVED_DIRECTION_MOTOR_V153} from './LiveDirectionMotorV153';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1} from './LiveBaseballMatchV1';
import {AUTHORED_PLAY_RANDOMNESS_V152} from '../../core/rng/LiveRandomStreamsV152';

it('compares pinned instrumented Live before late correction without altering the record',async()=>{
 const path='src/integration/browser/LivePitchV1.ts',source=readFileSync(path,'utf8');
 expect(createHash('sha256').update(source).digest('hex')).toBe('1fc48dc6142e1dd5da87ff8d896eb8002a5fcef90725a05c3bf242b57d3a18c0');
 const marker='  const uncorrectedReference=createReferenceBatKinematicsV1(impactReference),headroom=';
 expect(source.split(marker)).toHaveLength(2);
 const hook=`  (globalThis as any).__v247Probe({recipe:{originTick:input.originTick,decisionTick:observationTick,decisionTimeSeconds:decisionTime,nominalArrivalSeconds:prediction.elapsedSeconds,technicalTimingOffsetSeconds:b.technicalTimingOffsetSeconds??0,latencySeconds:b.motorLatencySeconds,startMode:envelopeV133?'ENVELOPE':swingMotorV121||executionV122||intentV122||spinMotionV123||battingDirectionV149||positionObserverV151?'MOTOR':'LEGACY',contactSourceTick:sourceContactTick,rampSeconds,reference:{...referenceInput,rotation:referenceInput.transform.rotation},normalCenter:nominalSweetSpotV153,limits:{...(effectiveMaximumSpeedV121===undefined?{}:{maximumSweetSpotSpeedMps:effectiveMaximumSpeedV121}),...(executionV122?{maximumGripAccelerationMps2:executionV122.maximumGripAccelerationMps2,maximumAngularAccelerationRadPerSecond2:executionV122.maximumAngularAccelerationRadPerSecond2,maximumSweetSpotAccelerationMps2:executionV122.maximumSweetSpotAccelerationMps2}:{})},impactTrajectory},sample:{timingSeconds:timingError,aim:aimError,actualSweetSpotT:sweetSpotT},delta:deltaV244??{x:0,y:0,z:0},actual:impactReference,saturationV153});\n`;
 const pre='  let impactReference=impactTrajectory===undefined?translatedReference:'; expect(source.split(pre)).toHaveLength(2);
 const instrumented=source.replace(pre,'  const __v247Before=referenceInput;\n'+pre).replace(marker,hook.replace('reference:{...referenceInput,rotation:referenceInput.transform.rotation}','reference:{...__v247Before,sweetSpotT:planningSweetSpotT,rotation:__v247Before.transform.rotation}')+marker);
 const compile=async(instrument:boolean)=>{const result=await build({entryPoints:[path],absWorkingDir:process.cwd(),bundle:true,write:false,platform:'node',format:'cjs',target:'node20',plugins:instrument?[{name:'pinned-observer',setup(b){b.onLoad({filter:/LivePitchV1\.ts$/},()=>({contents:instrumented,loader:'ts'}));}}]:[]});const m={exports:{} as any};new Function('module','exports','require',result.outputFiles[0].text)(m,m.exports,createRequire(import.meta.url));return m.exports;};
 const original=await compile(false),observed=await compile(true),catalog=JSON.parse(readFileSync('docs/demos/measured-bat-motions.json','utf8')).clips,clip=catalog.find((c:any)=>c.side==='L');
 const physical={...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'L',clipId:clip.id,maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,motorLatencySeconds:.04,swingDecision:{approach:'SWING',threshold:0,aggressionWeight:1}};
 const base={originTick:1000000,seed:31,randomnessV152:AUTHORED_PLAY_RANDOMNESS_V152,batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'v247-fixture',mode:'CENTER'},pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0},measuredClips:catalog,batting:'balanced',pitchType:'fastball',location:'zone',physics:LIVE_MATCH_PHYSICS_V1};
 // Existing lossless codec retains undefined, nonfinite values, and signed zero.
 // @ts-expect-error Existing verification codec is JavaScript.
 const {stringifyDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');
 const recipes:any[]=[]; for(const std of [0,.004]){const input={...base,batter:{...physical,timingStdSeconds:std,aimStdMeters:std}},captured:any[]=[];(globalThis as any).__v247Probe=(v:any)=>captured.push(v);
  try{const plain=original.simulateLivePitchV1(input),traced=observed.simulateLivePitchV1(input);const {sampleBatAtTick:_p,...a}=plain,{sampleBatAtTick:_t,...b}=traced;expect(stringifyDebugRecord(b)).toBe(stringifyDebugRecord(a));expect(captured.length).toBeGreaterThan(0);
   const c=captured.at(-1),{startTick:_s,transform:_transform,...rest}=c.recipe.reference;c.recipe.reference={...rest,rotation:c.recipe.reference.rotation};expect(c.recipe.normalCenter).not.toBeNull();recipes.push(c.recipe);
   if(std===0)expect(Math.abs(c.sample.timingSeconds)+Math.hypot(c.sample.aim.x,c.sample.aim.y,c.sample.aim.z)).toBe(0);else expect(Math.abs(c.sample.timingSeconds)+Math.hypot(c.sample.aim.x,c.sample.aim.y,c.sample.aim.z)).toBeGreaterThan(0);
   const rebuilt=buildLiveBatReferenceExecutionV247(c.recipe,c.sample,c.delta),actual=createReferenceBatKinematicsV1(c.actual);
   expect(rebuilt.reference).toEqual(c.actual);expect(rebuilt.contactTick).toBe(traced.diagnostics.referenceContactTick);
   expect(rebuilt.temporalScale).toBe(c.saturationV153.temporalScale);
   for(const key of ['maximumSweetSpotSpeedMps','maximumGripAccelerationMps2','maximumAngularAccelerationRadPerSecond2','maximumSweetSpotAccelerationMps2'] as const)expect(rebuilt.motion[key]).toBe(actual[key]);
   for(const tick of [actual.motionStartTickV133!,(actual.motionStartTickV133!+c.actual.startTick)/2,c.actual.startTick,(c.actual.startTick+rebuilt.contactTick)/2,rebuilt.contactTick,(rebuilt.contactTick+actual.motionThroughTickV133!)/2,actual.motionThroughTickV133!])expect(stringifyDebugRecord(rebuilt.motion.sampleContinuous(tick))).toBe(stringifyDebugRecord(actual.sampleContinuous(tick)));
  }finally{delete (globalThis as any).__v247Probe;}
 }
 expect(stringifyDebugRecord(recipes[0])).toBe(stringifyDebugRecord(recipes[1]));
},120000);

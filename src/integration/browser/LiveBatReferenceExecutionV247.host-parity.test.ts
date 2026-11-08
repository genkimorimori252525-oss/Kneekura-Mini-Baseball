import {it,expect} from 'vitest';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
import {resolveLiveBattingSetupV94} from '../../core/sim/pitching/BattingSetupV94';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';


import {AUTHORED_LIVE_BATTER_OBSERVATION_V151} from './LiveBatterObservationV151';
import {AUTHORED_OBSERVED_DIRECTION_MOTOR_V153} from './LiveDirectionMotorV153';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1} from './LiveBaseballMatchV1';


it('compares pinned instrumented Live before late correction without altering the record',async()=>{
 const path='src/integration/browser/LivePitchV1.ts',source=readFileSync(path,'utf8');
 expect(createHash('sha256').update(source).digest('hex')).toBe('1fc48dc6142e1dd5da87ff8d896eb8002a5fcef90725a05c3bf242b57d3a18c0');
 const marker='  const uncorrectedReference=createReferenceBatKinematicsV1(impactReference),headroom=';
 expect(source.split(marker)).toHaveLength(2);
 const hook=`  (globalThis as any).__v247Probe({recipe:{originTick:input.originTick,decisionTick:observationTick,decisionTimeSeconds:decisionTime,nominalArrivalSeconds:prediction.elapsedSeconds,technicalTimingOffsetSeconds:b.technicalTimingOffsetSeconds??0,latencySeconds:b.motorLatencySeconds,startMode:envelopeV133?'ENVELOPE':swingMotorV121||executionV122||intentV122||spinMotionV123||battingDirectionV149||positionObserverV151?'MOTOR':'LEGACY',contactSourceTick:sourceContactTick,rampSeconds,reference:{...referenceInput,rotation:referenceInput.transform.rotation},normalCenter:nominalSweetSpotV153,limits:{...(effectiveMaximumSpeedV121===undefined?{}:{maximumSweetSpotSpeedMps:effectiveMaximumSpeedV121}),...(executionV122?{maximumGripAccelerationMps2:executionV122.maximumGripAccelerationMps2,maximumAngularAccelerationRadPerSecond2:executionV122.maximumAngularAccelerationRadPerSecond2,maximumSweetSpotAccelerationMps2:executionV122.maximumSweetSpotAccelerationMps2}:{})},impactTrajectory},sample:{timingSeconds:timingError,aim:aimError},delta:deltaV244??{x:0,y:0,z:0},actual:impactReference,saturationV153});\n`;
 const pre='  let impactReference=impactTrajectory===undefined?translatedReference:'; expect(source.split(pre)).toHaveLength(2);
 const instrumented=source.replace(pre,'  const __v247Before=referenceInput;\n'+pre).replace(marker,hook.replace('reference:{...referenceInput,rotation:referenceInput.transform.rotation}','reference:{...__v247Before,rotation:__v247Before.transform.rotation}')+marker);
 const compile=async(instrument:boolean)=>{const result=await build({entryPoints:['src/integration/browser/LiveBaseballMatchV1.ts'],absWorkingDir:process.cwd(),bundle:true,write:false,platform:'node',format:'cjs',target:'node20',plugins:instrument?[{name:'pinned-observer',setup(b){b.onLoad({filter:/LivePitchV1\.ts$/},()=>({contents:instrumented,loader:'ts'}));}}]:[]});const m={exports:{} as any};new Function('module','exports','require',result.outputFiles[0].text)(m,m.exports,createRequire(import.meta.url));return m.exports;};
 const original=await compile(false),observed=await compile(true),base=liveMatchFixture(2468),clip=base.measuredClips.find(c=>c.side==='L')!;
 const config={...base,players:base.players.map(p=>p.playerId==='0-b0'?{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,clipId:clip.id,maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,timingStdSeconds:.004,aimStdMeters:.004,motorLatencySeconds:.04}}:p),batterObservationV151:AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:AUTHORED_OBSERVED_DIRECTION_MOTOR_V153};
 const command={managedTeam:0,pitchType:'auto',location:'auto',batting:'balanced',battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'v247-fixture',mode:'CENTER'},practiceSwingDecisionV241:{version:'practice_swing_decision_v241',sourceId:'v247-fixture',scope:'EXPLICIT_PRACTICE',mode:'SWING'},observedSpinTrialV236:{version:'live_observed_contact_frame_trial_v244',subjectId:'0-b0',technique:'TOPSPIN',clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:'L'},domain:{plateZ:resolveLiveBattingSetupV94({...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'L'}).contactPlaneZ,coordinateSystem:'LIVE_WORLD_METERS_V1'},policy:'FIXED_25_UNCALIBRATED_V243',thresholds:{minimumComponent:1e9,minimumImprovement:1e9}}};
 // @ts-expect-error Existing verification codec is JavaScript.
 const {stringifyDebugRecord}=await import('../../../tools/verification/live-debug-record.mjs');
 const captures:any[]=[];(globalThis as any).__v247Probe=(v:any)=>captures.push(v);
 try {const a=original.createLiveBaseballMatchWorkerV116(config),b=observed.createLiveBaseballMatchWorkerV116(config),x=a.issuePitch(command),y=b.issuePitch(command);
  expect(stringifyDebugRecord(x)).toBe(stringifyDebugRecord(y));expect(stringifyDebugRecord(a.captureContinuationV116())).toBe(stringifyDebugRecord(b.captureContinuationV116()));
  expect(captures.length).toBeGreaterThan(0);
 }finally{delete (globalThis as any).__v247Probe;}
},180000);
import { expect,it } from 'vitest';
import { measuredBattingBodyReferenceInput,type AcceptedMeasuredBattingBodyReferenceV1 } from './SqliteMeasuredBattingBodyReferenceStore';
const input=():AcceptedMeasuredBattingBodyReferenceV1=>({sourceId:'synthetic-body',sourceVersion:'v1',capability:'owned_measured_batting_body_reference_v1',
  initialBatReference:{owner:'batting_initial_equipment_v1_sources',sourceId:'original-bat',sourceHash:'1'.repeat(64),snapshotHash:'2'.repeat(64)},profileId:'original-profile',availableAtDay:10,
  reference:{provenance:{clipId:'original-clip',sourceSha256:'3'.repeat(64),batSourceSha256:'4'.repeat(64)},sourceTicksPerSecond:1000000,
    frames:[0,100000].map(tick=>({tick,leftHip:{x:.5,y:.9,z:0},rightHip:{x:.7,y:.9,z:0}}))},
  postureSpeed:{maximumSpeedMps:5,basis:'EXPLICIT_SYNTHETIC_PERSON_POSTURE_SPEED_V1',provenance:{assessmentSourceId:'explicit-test',assessmentVersion:'v1',calibrationSourceId:'explicit-posture',calibrationVersion:'v1'}}});
it('requires explicit original references, hip keys and a separately identified posture-speed calibration',()=>{
  const p=input(),result=measuredBattingBodyReferenceInput(p,p.sourceId);expect(result).toEqual(p);expect(result).not.toBe(p);
  expect(()=>Object.assign(result.postureSpeed,{maximumSpeedMps:99})).toThrow();
  expect(()=>measuredBattingBodyReferenceInput(p,'other-id')).toThrow();
});
it.each(['missing-speed','run-speed','nan','duplicate-key','missing-hip','extra-field','bad-hash','negative-day'] as const)('refuses %s without defaults',fault=>{
  const p=structuredClone(input());
  if(fault==='missing-speed')Reflect.deleteProperty(p,'postureSpeed');
  if(fault==='run-speed')Object.assign(p.postureSpeed,{basis:'DERIVED_FROM_GROUND_RUNNING_SPEED'});
  if(fault==='nan')Object.assign(p.reference.frames[0].leftHip,{y:NaN});
  if(fault==='duplicate-key')Object.assign(p.reference.frames[1],{tick:0});
  if(fault==='missing-hip')Reflect.deleteProperty(p.reference.frames[1],'rightHip');
  if(fault==='extra-field')Object.assign(p,{gripCorrectionMeters:.1});
  if(fault==='bad-hash')Object.assign(p.reference.provenance,{batSourceSha256:'bad'});
  if(fault==='negative-day')Object.assign(p,{availableAtDay:-1});
  expect(()=>measuredBattingBodyReferenceInput(p)).toThrow();
});

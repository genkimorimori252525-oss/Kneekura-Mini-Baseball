import {expect,it} from 'vitest';
import * as api from './LiveSpinControlV123';

const profile=()=>({version:'live_spin_control_v123' as const,boundary:'LOCAL_AUTHORING_ONLY' as const,sourceId:'maker-authored-spin',sourceVersion:'v1',
 preferredIntent:'BACKSPIN' as const,techniques:[{technique:'BACKSPIN' as const,sourceId:'independent-backspin',sourceEffectIdentity:'backspin-motor',
  learnedStatus:'CONSOLIDATED' as const,calibration:{sourceId:'author-checked-model',sourceVersion:'v1',status:'MODEL_VERIFIED' as const},
  clip:{id:'measured-clip',sourceSha256:'1'.repeat(64),bats:'R' as const},
  motion:{attackAngleDegrees:12,pullAngleDeltaDegrees:3,contactOffsetMeters:{pull:.01,up:-.02,depth:0}},
  conditions:{minimumInsideNormalized:-1,maximumInsideNormalized:1,minimumHeightNormalized:0,maximumHeightNormalized:1,minimumAvailableSeconds:.05}}]});
const input=()=>({profile:profile(),bats:'R' as const,clip:{id:'measured-clip',sourceSha256:'1'.repeat(64)},
 observation:{observedTick:100,availableTick:110,decisionTick:120},perceivedPosition:{x:0,y:.8},
 zone:{centerX:0,halfWidth:.2159,lowerY:.5,upperY:1.1},timeUntilContactSeconds:.2,swingOffered:true,battingMode:'balanced' as const});

it('keeps authored skill, own prediction and one motion separate from Native admission and actual exit spin',()=>{
 expect(api.selectLiveSpinIntentV123).toBeTypeOf('function');
 const i=input(),before=structuredClone(i),r=api.selectLiveSpinIntentV123(i);
 expect(r).toMatchObject({boundary:'LOCAL_AUTHORING_ONLY',nativeAdmission:false,selectedIntent:'BACKSPIN',selectedAtTick:120,
  masteredTechniqueSet:['BACKSPIN'],effectiveStateId:'BLUE_BACKSPIN',motion:i.profile.techniques[0].motion});
 expect(r).not.toHaveProperty('exitSpin');expect(i).toEqual(before);
});

it('preserves mastery memory while the current side, clip, time or perceived course cannot execute it',()=>{
 for(const patch of [
  (i:any)=>i.clip.id='different', (i:any)=>i.clip.sourceSha256='2'.repeat(64), (i:any)=>i.bats='L',
  (i:any)=>i.timeUntilContactSeconds=.01, (i:any)=>i.perceivedPosition.y=1.5,
  (i:any)=>i.swingOffered=false, (i:any)=>i.battingMode='bunt',
 ]){const i=input();patch(i);const r=api.selectLiveSpinIntentV123(i);
  expect(r.selectedIntent).toBe('NO_SPIN_TARGET');expect(r.motion).toBeNull();expect(r.masteredTechniqueSet).toEqual(['BACKSPIN']);}
});

it('never turns a label, unverified practice or a duplicate effect into an executable extra skill',()=>{
 for(const patch of [(i:any)=>i.profile.techniques[0].learnedStatus='PRACTICING',(i:any)=>i.profile.techniques[0].calibration.status='UNVERIFIED']){
  const i=input();patch(i);const r=api.selectLiveSpinIntentV123(i);expect(r.selectedIntent).toBe('NO_SPIN_TARGET');expect(r.effectiveStateId).toBe('NONE');}
 const i:any=input(),first=i.profile.techniques[0];
 i.profile.techniques.push({...structuredClone(first),technique:'HOOK'});
 expect(api.selectLiveSpinIntentV123(i).effectiveStateId).toBe('NONE');
});

it('allows a Gold authoring projection to choose normal batting without unlocking unknown skills',()=>{
 const i:any=input(),first=i.profile.techniques[0];
 i.profile.techniques.push({...structuredClone(first),technique:'HOOK',sourceId:'independent-hook',sourceEffectIdentity:'hook-motor'});
 i.profile.preferredIntent='NO_SPIN_TARGET';const r=api.selectLiveSpinIntentV123(i);
 expect(r).toMatchObject({effectiveStateId:'GOLD',masteredTechniqueSet:['HOOK','BACKSPIN'],selectedIntent:'NO_SPIN_TARGET',motion:null});
 i.profile.preferredIntent='SLICE';expect(api.selectLiveSpinIntentV123(i).selectedIntent).toBe('NO_SPIN_TARGET');
});

it('refuses future perception and actual outcome/Native/Gold shortcuts in authoring input',()=>{
 for(const patch of [(i:any)=>i.observation.availableTick=121,(i:any)=>i.observation.observedTick=111,
  (i:any)=>i.actualPitch={velocity:{x:0,y:0,z:-40}},(i:any)=>i.profile.nativeAdmission=true,
  (i:any)=>i.profile.techniques[0].exitSpin={x:200,y:0,z:0},(i:any)=>i.profile.preferredIntent='GOLD']){
  const i=input();patch(i);expect(()=>api.selectLiveSpinIntentV123(i)).toThrow();}
});

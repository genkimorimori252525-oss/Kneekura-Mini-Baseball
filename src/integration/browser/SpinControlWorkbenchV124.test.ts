import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import * as workbench from './SpinControlWorkbenchV124';
import {simulateLivePitchV1,type LivePitchInputV1,type LiveMeasuredClipV1} from './LivePitchV1';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1} from './LiveBaseballMatchV1';
const clips=JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')).clips as LiveMeasuredClipV1[];
const learned=clips.find(c=>c.side==='R')!,ordinary=clips.find(c=>c.side==='R'&&c.id!==learned.id)!;
const input=():LivePitchInputV1=>({originTick:1e6,seed:3,batting:'balanced',pitchType:'curve',location:'zone',physics:LIVE_MATCH_PHYSICS_V1,measuredClips:clips,
 batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R',clipId:ordinary.id,maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,
  motorLatencySeconds:.04,timingStdSeconds:0,aimStdMeters:0,swingDecision:{approach:'SWING',threshold:0,aggressionWeight:.5},
  spinControlV123:{version:'live_spin_control_v123',boundary:'LOCAL_AUTHORING_ONLY',sourceId:'synthetic-trial',sourceVersion:'1',preferredIntent:'BACKSPIN',techniques:[{
   technique:'BACKSPIN',sourceId:'synthetic-back',sourceEffectIdentity:'back-motor',learnedStatus:'CONSOLIDATED',
   calibration:{sourceId:'synthetic-calibration',sourceVersion:'1',status:'MODEL_VERIFIED'},clip:{id:learned.id,sourceSha256:learned.source.sha256,bats:'R'},
   motion:{attackAngleDegrees:12,pullAngleDeltaDegrees:0,contactOffsetMeters:{pull:0,up:-.01,depth:0}},
   conditions:{minimumInsideNormalized:-3,maximumInsideNormalized:3,minimumHeightNormalized:-3,maximumHeightNormalized:3,minimumAvailableSeconds:0}}]}},
 pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0}});

it('trials the same real Live motor and rigid contact without altering the saved actor or forcing the target spin',()=>{
 const i=input(),before=structuredClone(i),result=workbench.simulateSpinControlWorkbenchV124(i),actual=simulateLivePitchV1(i);
 expect(result.boundary).toBe('LOCAL_AUTHORING_PREVIEW');expect(result.nativeAdmission).toBe(false);
 expect(result.requested.clipId).toBe(learned.id);expect(result.ordinary.clipId).toBe(ordinary.id);
 expect(result.requested.contact).toEqual(actual.contact?{exitVelocity:actual.contact.exitVelocity,exitSpin:actual.contact.exitSpin}:null);
 expect(result.requested.intent).toEqual(actual.diagnostics.spinIntentV123);expect(result.requested.batPath.length).toBeGreaterThan(1);
 expect(result.requested.batPath.length).toBeLessThanOrEqual(129);expect(i).toEqual(before);
 expect(JSON.parse(JSON.stringify(result))).toEqual(result);
});

it('reports no contact on a take, and normal intention has identical ordinary and requested physics',()=>{
 const i=input(),take=workbench.simulateSpinControlWorkbenchV124({...i,batting:'take'});
 expect(take.requested.contact).toBeNull();expect(take.requested.spin).toBeNull();expect(take.requested.intent).toMatchObject({reason:'NO_SWING'});
 const normal=workbench.simulateSpinControlWorkbenchV124({...i,batter:{...i.batter,spinControlV123:{...i.batter.spinControlV123!,preferredIntent:'NO_SPIN_TARGET'}}});
 const {intent:_intent,...requested}=normal.requested;expect(requested).toEqual(normal.ordinary);
});

it('accepts the full 673-trial archive without expanding it into either physical pitch or weakening inert validation',()=>{
 const decode=new Function(readFileSync(new URL('../../../tools/browser-bridge/measured-bat-library-v1.js',import.meta.url),'utf8')+';return KneekuraMeasuredBatLibrary.decode;')();
 const catalog=decode(readFileSync(new URL('../../../docs/demos/measured-bat-library-v1.json',import.meta.url),'utf8')).clips;
 expect(catalog).toHaveLength(673);
 const result=workbench.simulateSpinControlWorkbenchV124({...input(),measuredClips:catalog});
 expect(result.requested.clipId).toBe(learned.id);expect(result.ordinary.clipId).toBe(ordinary.id);
 let reads=0;const forged={...input()};Object.defineProperty(forged,'measuredClips',{enumerable:true,get(){reads++;return catalog;}});
 expect(()=>workbench.simulateSpinControlWorkbenchV124(forged)).toThrow('inert measured catalog');expect(reads).toBe(0);
});

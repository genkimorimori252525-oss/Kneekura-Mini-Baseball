import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {simulateLivePitchV1,type LiveMeasuredClipV1,type LivePitchInputV1} from './LivePitchV1';
import {LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,LIVE_MATCH_PHYSICS_V1,createLiveBaseballMatchV1} from './LiveBaseballMatchV1';
import {createLiveBatPlaybackV88} from './LiveBatPlaybackV88';
import {applyLivePhysicalRosterV1} from './LivePhysicalRosterV1';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
import type {LiveSpinControlV123} from './LiveSpinControlV123';

const clips=JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')).clips as LiveMeasuredClipV1[];
const clip=clips.find(c=>c.side==='R')!;
const profile=():LiveSpinControlV123=>({version:'live_spin_control_v123',boundary:'LOCAL_AUTHORING_ONLY',sourceId:'test-author-spin',sourceVersion:'v1',
 preferredIntent:'BACKSPIN',techniques:[{technique:'BACKSPIN',sourceId:'authored-backspin',sourceEffectIdentity:'authored-backspin-arc',learnedStatus:'CONSOLIDATED',
  calibration:{sourceId:'explicit-test-model',sourceVersion:'v1',status:'MODEL_VERIFIED'},clip:{id:clip.id,sourceSha256:clip.source.sha256,bats:'R'},
  motion:{attackAngleDegrees:12,pullAngleDeltaDegrees:0,contactOffsetMeters:{pull:0,up:-.01,depth:0}},
  conditions:{minimumInsideNormalized:-3,maximumInsideNormalized:3,minimumHeightNormalized:-3,maximumHeightNormalized:3,minimumAvailableSeconds:0}}]});
const input=():LivePitchInputV1=>({originTick:1000000,seed:3,batter:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,heightMeters:1.8,bats:'R',clipId:clip.id,
 maximumSweetSpotSpeedMps:50,targetSweetSpotSpeedMps:30,motorLatencySeconds:.04,timingStdSeconds:0,aimStdMeters:0,
 swingDecision:{approach:'SWING',threshold:0,aggressionWeight:.5}},pitcher:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,commandStdMeters:0},
 measuredClips:clips,batting:'balanced',pitchType:'curve',location:'zone',physics:LIVE_MATCH_PHYSICS_V1});
function withSpin(i:LivePitchInputV1,p:LiveSpinControlV123):LivePitchInputV1{return {...i,batter:{...i.batter,spinControlV123:p}};}

it('connects one authored intent to the existing actual bat and returns spin observation only from the real contact',()=>{
 const i=input(),r=simulateLivePitchV1(withSpin(i,profile()));
 expect(r.diagnostics.spinIntentV123).toMatchObject({selectedIntent:'BACKSPIN',nativeAdmission:false});
 expect(r.diagnostics.batPlaybackV88?.reference.impactTrajectory).toMatchObject({method:'whole-arc-target'});
 const d=r.diagnostics.batPlaybackV88!,playback=createLiveBatPlaybackV88({descriptor:d,measuredClip:clip});
 for(let t=i.originTick;t<playback.throughTick;t+=7000)expect(playback.sampleAtTick(t)).toEqual(r.sampleBatAtTick(t));
 expect(r.contact).not.toBeNull();
 expect(r.diagnostics.battedSpinV123).toMatchObject({velocityMps:r.contact!.exitVelocity,spinRadPerSecond:r.contact!.exitSpin});
 // contactMoment is the incoming pitch state. The host adopts exitSpin once
 // into its outgoing free ball; that boundary is verified below.
});

it('adopts the real contact vector once into the ordinary match outgoing ball',()=>{
 const f=liveMatchFixture(3),i=input(),host=createLiveBaseballMatchV1({...f,players:f.players.map(p=>({...p,bats:'R' as const,
  physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,...i.batter,spinControlV123:profile()}}))});
 const r=host.issuePitch({managedTeam:0,batting:'balanced',pitchType:'curve',location:'zone'});
 const diagnostics=r.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics'],contact=r.play.contact as ReturnType<typeof simulateLivePitchV1>['contact'];
 expect(diagnostics.spinIntentV123).toMatchObject({selectedIntent:'BACKSPIN'});
 expect(contact).not.toBeNull();
 expect(r.play.outgoingBallMoment!.ball.spin).toEqual(contact!.exitSpin);
 expect(r.play.outgoingBallMoment!.ball.velocity).toEqual(contact!.exitVelocity);
});

it('keeps ordinary physics and random streams exact when choosing normal or when a skill does not match the current domain',()=>{
 const i=input(),normal=simulateLivePitchV1(i),p=profile();
 for(const local of [{...p,preferredIntent:'NO_SPIN_TARGET' as const},
  {...p,techniques:p.techniques.map(t=>({...t,clip:{...t.clip,id:'unsupported-clip'}}))}]){
  const r=simulateLivePitchV1(withSpin(i,local)),{spinIntentV123:_intent,battedSpinV123:_spin,...diagnostics}=r.diagnostics;
  expect({frames:r.frames,contact:r.contact,call:r.call,endedAtTick:r.endedAtTick,diagnostics})
   .toEqual({frames:normal.frames,contact:normal.contact,call:normal.call,endedAtTick:normal.endedAtTick,diagnostics:normal.diagnostics});
 }
});

it('round-trips the local authoring packet and clears it when an older packet is imported',()=>{
 const f=liveMatchFixture(3),playerId=f.players[0].playerId,p=profile(),packet={version:'live_physical_roster_v1' as const,sourceId:'spin-editor',
  entries:[{playerId,sourceId:'authored-player',physical:{basis:'EXPLICIT_AUTHORED_SI_V1' as const,spinControlV123:p}}]};
 const projected=applyLivePhysicalRosterV1({players:f.players,roster:JSON.parse(JSON.stringify(packet))});
 expect(projected.players[0].physical?.spinControlV123).toEqual(p);
 const old={...packet,entries:[{...packet.entries[0],physical:{basis:'EXPLICIT_AUTHORED_SI_V1' as const}}]};
 expect(applyLivePhysicalRosterV1({players:projected.players,roster:old}).players[0].physical).not.toHaveProperty('spinControlV123');
 expect(packet.entries[0].physical.spinControlV123).toEqual(p);
});

it('selects the actual learned motion from the repertoire instead of requiring the random ordinary form to coincide',()=>{
 const i=input(),ordinaryClip=clips.find(c=>c.side==='R'&&c.id!==clip.id)!;
 const r=simulateLivePitchV1(withSpin({...i,batter:{...i.batter,clipId:ordinaryClip.id}},profile()));
 expect(r.diagnostics.spinIntentV123).toMatchObject({selectedIntent:'BACKSPIN',reason:'APPLIED'});
 expect(r.clipId).toBe(clip.id);
 expect(r.diagnostics.measuredClipId).toBe(clip.id);
});

it('keeps the learned repertoire motion available through the ordinary match host as well',()=>{
 const f=liveMatchFixture(3),i=input(),ordinaryClip=clips.find(c=>c.side==='R'&&c.id!==clip.id)!;
 const host=createLiveBaseballMatchV1({...f,players:f.players.map(p=>({...p,bats:'R' as const,
  physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,...i.batter,clipId:ordinaryClip.id,spinControlV123:profile()}}))});
 const r=host.issuePitch({managedTeam:0,batting:'balanced',pitchType:'curve',location:'zone'});
 const diagnostics=r.play.diagnostics as ReturnType<typeof simulateLivePitchV1>['diagnostics'];
 expect(diagnostics.spinIntentV123).toMatchObject({selectedIntent:'BACKSPIN'});
 expect(diagnostics.measuredClipId).toBe(clip.id);
});

it('keeps the ordinary form, physics and random stream exact when the learned motion cannot be used in this course',()=>{
 const i=input(),ordinaryClip=clips.find(c=>c.side==='R'&&c.id!==clip.id)!,ordinary={...i,batter:{...i.batter,clipId:ordinaryClip.id}},p=profile();
 const unavailable={...p,techniques:p.techniques.map(t=>({...t,conditions:{...t.conditions,minimumInsideNormalized:2.9}}))};
 const normal=simulateLivePitchV1(ordinary),r=simulateLivePitchV1(withSpin(ordinary,unavailable));
 expect(r.diagnostics.spinIntentV123).toMatchObject({selectedIntent:'NO_SPIN_TARGET',reason:'OUTSIDE_CALIBRATED_COURSE'});
 const {spinIntentV123:_intent,battedSpinV123:_spin,...diagnostics}=r.diagnostics;
 expect({frames:r.frames,contact:r.contact,call:r.call,endedAtTick:r.endedAtTick,clipId:r.clipId,diagnostics})
  .toEqual({frames:normal.frames,contact:normal.contact,call:normal.call,endedAtTick:normal.endedAtTick,clipId:normal.clipId,diagnostics:normal.diagnostics});
});

import { expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Vec3 } from '../../core/model/geometry';
import { createReferenceBatKinematicsV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { registerMeasuredBatToFieldV1 } from './MeasuredBatFieldRegistrationV1';
import { simulateLivePitchV1,type LiveMeasuredClipV1,type LivePitchInputV1 } from './LivePitchV1';
import { createLiveBaseballMatchV1,LIVE_MATCH_BASES_V1,LIVE_MATCH_PHYSICS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

type RecordedClip=LiveMeasuredClipV1&Readonly<{sourceRows:readonly Readonly<{sweet_spot_x:string;sweet_spot_y:string;sweet_spot_z:string}>[]}>;
const originalBytes=readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url));
const clips=(JSON.parse(originalBytes.toString('utf8')) as {clips:RecordedClip[]}).clips;
const reflect=(p:Vec3):Vec3=>({x:-p.x,y:p.y,z:p.z});
const axial=(p:Vec3):Vec3=>({x:p.x,y:-p.y,z:-p.z});
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

for(const clip of clips)it('registers original measured keys and continuous velocity in the actual field frame: '+clip.id,()=>{
  const before=JSON.stringify(clip),frames=clip.frames.map(f=>({tick:f.tick,grip:f.grip,orientation:f.orientation}));
  const reference={provenance:{clipId:clip.id,sourceSha256:clip.source.sha256},frames,batLengthM:clip.normalization.batLengthM,
    sweetSpotT:clip.normalization.sweetSpotT,sourceTicksPerSecond:1e6,startTick:frames[0].tick,ticksPerSecond:1e6,playbackRate:1,
    transform:{rotation:{w:1,x:0,y:0,z:0},translation:{x:0,y:0,z:0},scale:1}};
  const old=createReferenceBatKinematicsV1(reference),registered=createReferenceBatKinematicsV1({...reference,frames:registerMeasuredBatToFieldV1(frames)});
  const check=(at:number)=>{
    const a=old.sampleContinuous(at),b=registered.sampleContinuous(at);
    expect(distance(b.state.pose.grip,reflect(a.state.pose.grip))).toBeLessThan(1e-10);
    expect(distance(b.state.pose.tip,reflect(a.state.pose.tip))).toBeLessThan(1e-10);
    expect(distance(b.sweetSpot,reflect(a.sweetSpot))).toBeLessThan(1e-10);
    expect(distance(b.state.linearVelocity,reflect(a.state.linearVelocity))).toBeLessThan(1e-10);
    expect(distance(b.state.angularVelocity,axial(a.state.angularVelocity))).toBeLessThan(1e-10);
    expect(distance(b.sweetSpotVelocity,reflect(a.sweetSpotVelocity))).toBeLessThan(1e-10);
  };
  for(let i=0;i<frames.length;i++){
    const row=clip.sourceRows[i],sample=registered.sampleContinuous(frames[i].tick);
    expect(distance(sample.sweetSpot,{x:-Number(row.sweet_spot_y),y:Number(row.sweet_spot_z),z:Number(row.sweet_spot_x)})).toBeLessThan(1e-10);
    check(frames[i].tick);if(i)check((frames[i-1].tick+frames[i].tick)/2);
  }
  const contact=registered.sampleContinuous(clip.contactTimeSeconds*1e6),side=clip.side==='R'?-1:1;
  expect((contact.state.pose.grip.x-contact.sweetSpot.x)*side).toBeGreaterThan(0);
  expect(JSON.stringify(clip)).toBe(before);
});
it('preserves the original measured artifact and rejects malformed registration inputs',()=>{
  expect(clips).toHaveLength(12);expect(clips.reduce((n,c)=>n+c.frames.length,0)).toBe(1644);
  expect(sha(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url)))).toBe(sha(originalBytes));
  expect(()=>registerMeasuredBatToFieldV1([{tick:0,grip:{x:NaN,y:0,z:0},orientation:{w:1,x:0,y:0,z:0}},
    {tick:1,grip:{x:0,y:0,z:0},orientation:{w:1,x:0,y:0,z:0}}])).toThrow(/registration/);
});
const pitchInput=(side:'R'|'L',clipId?:string):LivePitchInputV1=>({originTick:1234567,seed:1,
  batter:{heightMeters:1.8,bats:side,batLengthM:.84,batMassKg:.88,swingRate:1,timingStdSeconds:0,aimStdMeters:0,chaseMarginMeters:.2,...(clipId?{clipId}:{})},
  pitcher:{releaseSpeedMps:42,spinRadPerSecond:{x:230,y:0,z:0},commandStdMeters:0},
  measuredClips:clips,batting:'balanced',pitchType:'fastball',location:'zone',physics:LIVE_MATCH_PHYSICS_V1});
for(const side of ['R','L'] as const){
  it('uses the original '+side+' clip in CCD on the correct side of the actual diamond',()=>{
    const clipId=side==='R'?'obp-123_6':'obp-51_3',input=pitchInput(side,clipId),before=JSON.stringify(input),result=simulateLivePitchV1(input);
    expect(result.clipId).toBe(clipId);expect(result.diagnostics.battingSide).toBe(side);
    expect(result.diagnostics.unsupportedReason).toBeNull();expect(result.contact).not.toBeNull();
    expect(result.contact!.ballCenter).toEqual(result.contactMoment!.ball.position);expect(result.contact!.normalImpulseNs).toBeGreaterThan(0);
    const pose=result.sampleBatAtTick(result.contact!.tick)!,sign=side==='R'?-1:1;
    expect((pose.grip.x-result.contact!.ballCenter.x)*sign).toBeGreaterThan(0);
    expect((pose.tip.x-pose.grip.x)*sign).toBeLessThan(0);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('places the '+side+' batter in its proper first/third-base-side box',()=>{
    const source=liveMatchFixture(),players=source.players.map(p=>p.playerId==='0-b0'?{...p,bats:side}:p),ready=createLiveBaseballMatchV1({...source,players}).inspect().frame;
    const body=ready.actors.find(a=>a.role==='batter')!,sideBase=side==='R'?LIVE_MATCH_BASES_V1.third:LIVE_MATCH_BASES_V1.first;
    expect(body.position.x*sideBase.x).toBeGreaterThan(0);
  });
  for(const location of ['inside','outside'] as const)it('aims '+location+' on the correct side for '+side,()=>{
    const result=simulateLivePitchV1({...pitchInput(side),batting:'take',location}),kernel=createSourceFreeBallKernel(result.diagnostics.sourceDescriptor);
    let lo=0,hi=result.diagnostics.sourceDescriptor.throughElapsedSeconds;
    for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(kernel.evaluateAt(mid).moment.ball.position.z<=.15)hi=mid;else lo=mid;}
    const boxSign=side==='R'?-1:1,x=kernel.evaluateAt(hi).moment.ball.position.x;
    expect(x*boxSign*(location==='inside'?1:-1)).toBeGreaterThan(0);
  });
}

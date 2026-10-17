import { expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { simulateLivePitchV1,type LivePitchInputV1,type LiveMeasuredClipV1 } from './LivePitchV1';
const clips=JSON.parse(readFileSync(new URL('../../../docs/demos/measured-bat-motions.json',import.meta.url),'utf8')).clips as LiveMeasuredClipV1[];
const input=(seed=1):LivePitchInputV1=>({originTick:1234567,seed,batter:{heightMeters:1.8,bats:'R',batLengthM:.84,batMassKg:.88,swingRate:1,
  timingStdSeconds:0,aimStdMeters:0,chaseMarginMeters:.2},pitcher:{releaseSpeedMps:42,spinRadPerSecond:{x:230,y:0,z:0},commandStdMeters:0},
  measuredClips:clips,batting:'balanced',pitchType:'fastball',location:'zone',physics:{kind:'aero_ground_v1',
    air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
    ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,
      material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}}});

it('uses an actual OBP path and continuous tapered collision with the original fractional ball clock',()=>{
  const source=input(),before=JSON.stringify(source),r=simulateLivePitchV1(source);
  expect(r.diagnostics.unsupportedReason).toBeNull();expect(r.contact).not.toBeNull();expect(r.call).toBeNull();
  expect(r.contactMoment!.originTick).toBe(source.originTick);
  expect(r.contact!.tick).toBe(quantizeEventTick(source.originTick,r.contactMoment!.elapsedSeconds,1e6));
  expect(r.contact!.ballCenter).toEqual(r.contactMoment!.ball.position);expect(r.contactOrientation).not.toBeNull();
  expect(r.contact!.normalImpulseNs).toBeGreaterThan(0);expect(r.contact!.exitVelocity).not.toEqual(r.contactMoment!.ball.velocity);
  expect(r.contact!.exitSpin).not.toEqual(r.contactMoment!.ball.spin);expect(JSON.stringify(source)).toBe(before);
  expect(r.diagnostics.sourceBallReanchored).toBe(false);expect(r.diagnostics.nativeAdmission).toBe(false);
});
it('is deterministic by input seed and never changes a ball to match a render frame',()=>{
  const a=simulateLivePitchV1(input(5)),b=simulateLivePitchV1(input(5));
  expect(a.frames).toEqual(b.frames);expect(a.contact).toEqual(b.contact);expect(a.diagnostics).toEqual(b.diagnostics);
  const kernel=createSourceFreeBallKernel(a.diagnostics.sourceDescriptor);
  for(const f of a.frames.filter(f=>a.diagnostics.catcherContactElapsedSeconds===null||f.elapsedSeconds<a.diagnostics.catcherContactElapsedSeconds)){
    const at=kernel.evaluateAt(f.elapsedSeconds,'incoming');expect(f.ball.position).toEqual(at.moment.ball.position);expect(f.ball.spin).toEqual(at.moment.ball.spin);expect(f.ball.orientation).toEqual(at.orientation);
  }
});
it('counts a take only after actual glove contact and secure retention, then hides the ball',()=>{
  const i=input(3),r=simulateLivePitchV1({...i,batting:'take'});
  expect(r.contact).toBeNull();expect(r.call).toBe('called_strike');expect(r.diagnostics.catcherContactElapsedSeconds).not.toBeNull();expect(r.diagnostics.secureTick).not.toBeNull();
  expect(r.frames.at(-1)!.ball.visible).toBe(false);expect(r.frames.at(-1)!.ball.possessedBy).toBe('catcher');
  expect(r.frames.filter(f=>f.tick<r.diagnostics.secureTick!).every(f=>f.ball.possessedBy===null&&f.ball.visible)).toBe(true);
});
it('retains selected left-handed measured paths without mirroring right-handed clips',()=>{
  const i=input(1),r=simulateLivePitchV1({...i,batter:{...i.batter,bats:'L',clipId:'obp-51_3'}});
  expect(r.clipId).toBe('obp-51_3');expect(r.diagnostics.battingSide).toBe('L');
  const pose=r.sampleBatAtTick(r.endedAtTick)!;expect(Math.hypot(pose.tip.x-pose.grip.x,pose.tip.y-pose.grip.y,pose.tip.z-pose.grip.z)).toBeCloseTo(.84,12);
});
it('motor commands change reference execution rate, preserving one actual bat length',()=>{
  const i=input(7),contact=simulateLivePitchV1({...i,batting:'contact'}),power=simulateLivePitchV1({...i,batting:'power',batter:{...i.batter,batLengthM:1}});
  expect(contact.diagnostics.playbackRate).toBe(.92);expect(power.diagnostics.playbackRate).toBe(1.08);
  const pose=power.sampleBatAtTick(power.endedAtTick+50000)!;expect(Math.hypot(pose.tip.x-pose.grip.x,pose.tip.y-pose.grip.y,pose.tip.z-pose.grip.z)).toBeCloseTo(1,12);
  expect(power.diagnostics.postImpactBodyRecoilImplemented).toBe(false);
  expect(power.sampleBatAtTick(power.diagnostics.referenceThroughTick+1)).toBeNull();
  expect(power.diagnostics.batReferenceScope).toBe('FINITE_MEASURED_KEYS_ONLY_NOT_AN_EQUIPMENT_RELEASE_FACT');
});
it('does not turn a failed high-energy catch into a strikeout or secure custody',()=>{
  const i=input(2),r=simulateLivePitchV1({...i,batting:'take',pitcher:{...i.pitcher,releaseSpeedMps:85}});
  expect(r.call).toBeNull();expect(r.diagnostics.unsupportedReason).not.toBeNull();expect(r.frames.every(f=>f.ball.possessedBy===null&&f.ball.visible)).toBe(true);
});
it('refuses missing measured sides, MMD provenance and unbounded SI input',()=>{
  const i=input();expect(()=>simulateLivePitchV1({...i,measuredClips:clips.filter(c=>c.side==='L')})).toThrow(/measured OpenBiomechanics/);
  expect(()=>simulateLivePitchV1({...i,measuredClips:[{...clips[0],id:'vmd-test'}]})).toThrow(/provenance/);
  expect(()=>simulateLivePitchV1({...i,batter:{...i.batter,swingRate:99}})).toThrow(/batter SI/);
});
for(const [index,seed,side,batting] of [[90,1035487403,'L','contact'],[612,3671489509,'L','balanced'],[746,2883596987,'R','balanced']] as const)
  it('tracks a real low-pitch bounce in the catcher forecast without changing the actual Source, regression '+index,()=>{
    const i=input(seed),r=simulateLivePitchV1({...i,originTick:1e6+index*2e6,batting,pitchType:'auto',location:'auto',
      batter:{...i.batter,bats:side,timingStdSeconds:.009,aimStdMeters:.022,chaseMarginMeters:.12},
      pitcher:{releaseSpeedMps:42.5,spinRadPerSecond:{x:-230,y:15,z:10},commandStdMeters:.11},
      physics:{...i.physics,air:{...i.physics.air,gravityY:-9.80665},ground:{...i.physics.ground,gravityMps2:9.80665,restingVerticalSpeedMps:.28}}});
    expect(r.diagnostics.unsupportedReason).toBeNull();expect(r.call).toBe('ball');expect(r.frames.at(-1)!.ball.possessedBy).toBe('catcher');
    const kernel=createSourceFreeBallKernel(r.diagnostics.sourceDescriptor);
    expect(kernel.boundaries.some(b=>b.kind==='ground'&&b.elapsedSeconds<r.diagnostics.catcherContactElapsedSeconds!)).toBe(true);
    expect(r.diagnostics.sourceBallReanchored).toBe(false);
  });
it('uses the same supplied catcher SI and Core absorption delay instead of a hidden stronger catcher',()=>{
  const i=input(3),catcher={gloveSpeedMps:11,gloveReachMeters:1.35,gloveRadiusMeters:.11,retentionCapacityJ:160,captureDissipationPowerW:3000,pocketRadiusMeters:.14},
    one=simulateLivePitchV1({...i,batting:'take',catcher}),fast=simulateLivePitchV1({...i,batting:'take',catcher:{...catcher,captureDissipationPowerW:6000}});
  expect(one.call).toBe('called_strike');expect(one.diagnostics.catcherSI).toEqual(catcher);expect(one.diagnostics.catcherCalibration).toBe('EXPLICIT_ROSTER_SI');
  expect(one.diagnostics.catcherContactElapsedSeconds).toBe(fast.diagnostics.catcherContactElapsedSeconds);
  expect(one.diagnostics.secureTick!).toBeGreaterThan(fast.diagnostics.secureTick!);
  const weak=simulateLivePitchV1({...i,batting:'take',catcher:{...catcher,retentionCapacityJ:1}});
  expect(weak.call).toBeNull();expect(weak.diagnostics.unsupportedReason).toBe('catcher_retention_failed_live_ball_requires_successor');
  expect(weak.diagnostics.catcherSI.retentionCapacityJ).toBe(1);
});

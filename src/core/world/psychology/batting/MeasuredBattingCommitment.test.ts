import assert from 'node:assert/strict';
import { test } from 'vitest';
import { measuredClips, measuredFixture, measuredActual, measuredRepertoire } from './MeasuredBattingFixtures.test-support';
import { fixture, value, change } from './BattingFixtures.test-support';
import { prepareBattingExecution, calculateBattingExecution } from './BattingCommitment';
import { acceptBattingExecution } from './BattingAcceptance';
import { resolveBattingExecution } from './BattingResolution';
import { physical } from './BattingPhysicalFixtures.test-support';
import { createBattingCommitmentSwingWindow } from './BattingSwingWindow';
import { createReferenceBatKinematicsV1 } from '../../../sim/contact/ReferenceBatKinematicsV1';
import { planAerodynamicCourseAwareSwingV1 } from '../../../sim/pitching/AerodynamicCourseAwareSwingV1';
import { battingRepertoireValuesInput } from '../../../../host/world/PlayerBattingExecutionCalibration';
import { adoptBattingForecastAtTick } from './BattingEventAdoption';
import { MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2 } from './MeasuredBattingTrajectoryV1';
import { rotateVectorByQuaternion } from '../../../sim/pitching/BaseballOrientation';
type Mutable<T>={-readonly [K in keyof T]:Mutable<T[K]>};

for(const [i,c] of measuredClips.entries())test(`upright registration preserves gravity and original ${c.side} ${c.id} motion`,()=>{
  const r=change(measuredFixture(i),d=>d.source.repertoireVersion=MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2);
  const p=value(prepareBattingExecution(r)),s=p.commitment!.sampledTrajectoryV1!;
  assert.equal(p.status,'READY');assert.equal(s.transform.scale,1);
  assert.deepEqual(s.frames.map(f=>f.tick),c.measurements.map(f=>f.tick));
  const up=rotateVectorByQuaternion({x:0,y:1,z:0},s.transform.rotation);
  assert.ok(Math.hypot(up.x,up.y-1,up.z)<1e-12);
  const motion=createReferenceBatKinematicsV1(s);
  const first=motion.sample(s.startTick).state.pose.grip;
  const lastTick=s.startTick+s.frames.at(-1)!.tick-s.frames[0].tick;
  const last=motion.sample(lastTick).state.pose.grip;
  assert.ok(Math.abs((last.y-first.y)-(s.frames.at(-1)!.grip.y-s.frames[0].grip.y))<1e-12);
  const plan=planAerodynamicCourseAwareSwingV1({predictedTrajectory:r.source.predictions[1].trajectory,plateZ:r.source.plateZ,
    strikeZone:r.source.strikeZone,handedness:r.source.handedness,batterCenterOfMass:r.source.centerOfMass,physical:r.source.batPhysical,
    profile:r.source.profiles[0].profile})!;
  const at=motion.sample(plan.swingPlan.trajectory.contactTick);
  for(const axis of ['x','y','z'] as const)assert.ok(Math.abs(at.sweetSpot[axis]-plan.swingPlan.trajectory.contact.sweetSpotPosition[axis])<1e-10);
  const v=at.sweetSpotVelocity,t=plan.swingPlan.trajectory.contact.sweetSpotVelocity;
  assert.ok(Math.abs(v.x*t.z-v.z*t.x)/(Math.hypot(v.x,v.z)*Math.hypot(t.x,t.z))<1e-12);
  assert.ok(v.x*t.x+v.z*t.z>0);
  assert.ok(acceptBattingExecution(r,JSON.parse(JSON.stringify(p))).ok);
});

for(const [i,c] of measuredClips.entries())test(`commit original ${c.side} ${c.id} keys from perceived aim, not three execution knots`,()=>{
  const r=measuredFixture(i),before=structuredClone(r),p=value(prepareBattingExecution(r)),s=p.commitment!.sampledTrajectoryV1!;
  assert.equal(p.status,'READY');assert.equal(p.commitment!.trajectory,null);assert.ok(s);assert.equal(p.commitment!.motorDelayTicks,0);
  assert.equal(s.frames.length,c.measurements.length);assert.deepEqual(s.frames.map(f=>f.tick),c.measurements.map(f=>f.tick));
  assert.deepEqual(r,before);assert.equal(s.transform.scale,1);assert.equal(s.provenance.clipId,c.id);
  const plan=planAerodynamicCourseAwareSwingV1({predictedTrajectory:r.source.predictions[1].trajectory,plateZ:r.source.plateZ,
    strikeZone:r.source.strikeZone,handedness:r.source.handedness,batterCenterOfMass:r.source.centerOfMass,physical:r.source.batPhysical,
    profile:r.source.profiles[0].profile})!;
  const motion=createReferenceBatKinematicsV1(s),atImpact=motion.sample(plan.swingPlan.trajectory.contactTick);
  for(const axis of ['x','y','z'] as const)assert.ok(Math.abs(atImpact.sweetSpot[axis]-plan.swingPlan.trajectory.contact.sweetSpotPosition[axis])<1e-10);
  assert.equal(atImpact.sourceTick,r.source.sampledProfiles![0].sourceImpactTick);
  const window=createBattingCommitmentSwingWindow(p.commitment!,r.source.batPhysical);
  assert.deepEqual(window.sampledKinematicsV1,s);assert.equal(window.kinematicsV1,undefined);
  const forecast=value(resolveBattingExecution(physical(r,measuredActual())));
  assert.equal(forecast.resolution.kind,'recorded_swing');
});

test('actual flight changes physical outcome inputs without changing the frozen measured commitment',()=>{
  const r=physical(measuredFixture(),measuredActual()),before=structuredClone(r.accepted.proposal.commitment);
  const a=value(resolveBattingExecution(r)),b=value(resolveBattingExecution(change(r,d=>d.actualTrajectory.start.position.x=5)));
  assert.deepEqual(a.commitment,before);assert.deepEqual(a.commitment,b.commitment);
  assert.equal(b.resolution.kind,'recorded_swing');if(b.resolution.kind==='recorded_swing')assert.equal(b.resolution.physical.kind,'swinging_miss');
});
test('perception-planned measured swing contacts a synthetic pitch and adopts the same canonical event at its due tick',()=>{
  const f=value(resolveBattingExecution(physical(measuredFixture(),measuredActual())));
  assert.equal(f.resolution.kind,'recorded_swing');
  if(f.resolution.kind!=='recorded_swing'||f.resolution.physical.kind!=='contact')assert.fail('perceived measured swing must physically contact this synthetic pitch');
  assert.ok(Object.values(f.resolution.physical.contact.exitSpin).every(Number.isFinite));
  assert.equal(f.resolution.timeline.status.kind,'batted_ball_pending');
  const due=f.resolution.physical.contact.tick;
  assert.equal(adoptBattingForecastAtTick(f,f.request.timeline,due-1).status,'WAITING');
  const adopted=adoptBattingForecastAtTick(f,f.request.timeline,due);
  assert.equal(adopted.status,'ADOPTED');assert.deepEqual(adopted.adoptedEvents.map(e=>e.kind),['BatBallContact']);
});
test('body readiness delays every original key together and does not retarget the bat',()=>{
  const r=measuredFixture(),a=value(prepareBattingExecution(r)).commitment!;
  const b=value(prepareBattingExecution(change(r,d=>d.source.bodyReadyTick=a.motorStartTick!+30_000))).commitment!;
  assert.equal(b.motorDelayTicks,30_000);assert.equal(b.sampledTrajectoryV1!.startTick-a.sampledTrajectoryV1!.startTick,30_000);
  assert.deepEqual(b.sampledTrajectoryV1!.frames,a.sampledTrajectoryV1!.frames);
  assert.deepEqual(b.sampledTrajectoryV1!.transform,a.sampledTrajectoryV1!.transform);
});
test('technical timing shifts the original curve without changing its shape or aim',()=>{
  const a=value(prepareBattingExecution(measuredFixture())).commitment!;
  const b=value(prepareBattingExecution(change(measuredFixture(),d=>d.source.technicalTimingOffsetTicks=10_000))).commitment!;
  assert.equal(b.sampledTrajectoryV1!.startTick-a.sampledTrajectoryV1!.startTick,10_000);
  assert.deepEqual(a.sampledTrajectoryV1!.frames,b.sampledTrajectoryV1!.frames);
  assert.deepEqual(a.sampledTrajectoryV1!.transform,b.sampledTrajectoryV1!.transform);
});
test('explicit accepted playback rate changes measured duration and speed, never key values or bat length',()=>{
  const a=value(prepareBattingExecution(measuredFixture())).commitment!.sampledTrajectoryV1!;
  const b=value(prepareBattingExecution(change(measuredFixture(),d=>d.source.sampledProfiles[0].playbackRate=.8))).commitment!.sampledTrajectoryV1!;
  assert.deepEqual(a.frames,b.frames);assert.equal(a.batLengthM,b.batLengthM);assert.deepEqual(a.transform,b.transform);
  assert.equal(a.startTick-b.startTick,75_000);
  assert.ok(Math.abs(createReferenceBatKinematicsV1(b).maximumSweetSpotSpeedMps-createReferenceBatKinematicsV1(a).maximumSweetSpotSpeedMps*.8)<1e-10);
});
test('effective repertoire, separately supplied and validated, controls the measured execution',()=>{
  const r=fixture(),m=measuredFixture();
  Object.assign(r.source,{handedness:m.source.handedness});r.source.predictions.forEach(p=>Object.assign(p.trajectory.start.position,{z:27}));
  const effectiveValues={decision:r.source.decisionModel,motor:{motorLatencyTicks:r.source.motorLatencyTicks,
    technicalTimingOffsetTicks:0,maximumSweetSpotSpeedMps:r.source.maximumSweetSpotSpeedMps},repertoire:measuredRepertoire()};
  const a=value(calculateBattingExecution({nominalRequest:r,effectiveValues}));
  assert.ok(a.commitment?.sampledTrajectoryV1);assert.equal(a.commitment?.trajectory,null);
  assert.deepEqual(a.nominalRequest,r);
});
test('measured body speed ceiling is checked against the whole measured curve',()=>{
  assert.equal(prepareBattingExecution(change(measuredFixture(),d=>d.source.maximumSweetSpotSpeedMps=1)).ok,false);
});
test('saved measured commitment is recomputed and rejects altered keys at acceptance',()=>{
  const r=measuredFixture(),p=value(prepareBattingExecution(r));
  assert.ok(acceptBattingExecution(r,JSON.parse(JSON.stringify(p))).ok);
  const altered=change(p,d=>d.commitment!.sampledTrajectoryV1!.frames[3].grip.x+=.01);
  assert.equal(acceptBattingExecution(r,altered).ok,false);
});
test('source and effective parameter boundaries reject wrong side, geometry, clock, version and missing keys',()=>{
  const mutations=[
    (d:Mutable<ReturnType<typeof measuredFixture>>)=>{d.source.handedness='L';},
    (d:Mutable<ReturnType<typeof measuredFixture>>)=>{d.source.profiles[0].profile.batLengthM+=.01;},
    (d:Mutable<ReturnType<typeof measuredFixture>>)=>{d.source.sampledProfiles![0].playbackRate=1.3;},
    (d:Mutable<ReturnType<typeof measuredFixture>>)=>{d.source.repertoireVersion='v1';},
    (d:Mutable<ReturnType<typeof measuredFixture>>)=>{delete d.source.sampledProfiles;},
    (d:Mutable<ReturnType<typeof measuredFixture>>)=>{d.source.sampledProfiles![0].measured.frames[3].tick=d.source.sampledProfiles![0].measured.frames[2].tick;},
  ];
  for(const mutation of mutations)assert.equal(prepareBattingExecution(change(measuredFixture(),mutation)).ok,false);
  for(const mutation of mutations.slice(1)){
    const bad=change(measuredFixture(),mutation).source;
    const v={repertoireId:bad.repertoireId,repertoireVersion:bad.repertoireVersion,profiles:bad.profiles,
      ...(bad.sampledProfiles?{sampledProfiles:bad.sampledProfiles}:{})};
    // Clock divisibility depends on the actual world TPS and is checked during planning.
    if(bad.sampledProfiles?.[0].playbackRate!==1.3)assert.throws(()=>battingRepertoireValuesInput(v));
  }
});
test('legacy commitments keep the original data shape; measured take never creates a bat motor',()=>{
  const old=value(prepareBattingExecution(fixture())).commitment!;assert.ok(old.trajectory);assert.equal(Object.hasOwn(old,'sampledTrajectoryV1'),false);
  const take=value(prepareBattingExecution(change(measuredFixture(),d=>d.source.directive='TAKE'))).commitment!;
  assert.equal(take.action,'TAKE');assert.equal(Object.hasOwn(take,'sampledTrajectoryV1'),false);
});

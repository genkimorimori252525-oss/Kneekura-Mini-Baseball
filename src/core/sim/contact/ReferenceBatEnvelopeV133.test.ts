import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from './ReferenceBatKinematicsV1';
import { quaternionFromAxisAngle } from '../pitching/BaseballOrientation';
import { referenceWorldTickAtSourceV121 } from './ReferenceBatMotorV121';
import { withReferenceImpactTrajectoryV1 } from './ReferenceBatImpactTrajectoryV1';

const input = (): ReferenceBatKinematicsInputV1 => ({ provenance: { clipId: 'c1-execution-synthetic', sourceSha256: '2'.repeat(64) },
  frames: [
    { tick: 0, grip: { x: 0, y: 1, z: .1 }, orientation: quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, 0) },
    { tick: 100000, grip: { x: .2, y: 1.2, z: -.1 }, orientation: quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, .7) },
    { tick: 260000, grip: { x: -.1, y: 1.3, z: .2 }, orientation: quaternionFromAxisAngle({ x: 1, y: 1, z: 0 }, 1.3) },
    { tick: 400000, grip: { x: .3, y: 1, z: .4 }, orientation: quaternionFromAxisAngle({ x: 0, y: 1, z: 1 }, 1.8) } ],
  batLengthM: .84, sweetSpotT: .8, sourceTicksPerSecond: 1e6, startTick: 1e6, ticksPerSecond: 1e6, playbackRate: 1,
  transform: { rotation: { x: 0, y: 0, z: 0, w: 1 }, translation: { x: 0, y: 0, z: 0 }, scale: 1 } });
const envelope = () => ({ version: 'reference_bat_envelope_v133', sourceId: 'explicit-synthetic-boundary-v133',
  preparation: { durationSeconds: .2, grip: { x: -.2, y: 1.1, z: .2 }, orientation: quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, -.2) },
  recovery: { durationSeconds: .25, grip: { x: .6, y: 1.2, z: .5 }, orientation: quaternionFromAxisAngle({ x: 0, y: 1, z: 1 }, 2.1) } });
const authored = () => ({ ...input(), executionInterpolationV122: 'cubic-c1', executionEnvelopeV133: envelope() }) as unknown as ReferenceBatKinematicsInputV1;
const norm = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
const diff = (a: { x: number; y: number; z: number }, b: typeof a) => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z });

it('exposes read-only interval certificates for the existing fixed-rotation translation without changing its bounds or endpoints', () => {
  const orientation={x:0,y:0,z:0,w:1},raw:ReferenceBatKinematicsInputV1={...input(),startTick:2000000,
    frames:[0,1000000].map(tick=>({tick,grip:{x:1,y:1,z:0},orientation})),executionInterpolationV122:'cubic-c1',
    executionEnvelopeV133:{version:'reference_bat_envelope_v133',sourceId:'fixed-rotation-interval-diagnostics',
      preparation:{durationSeconds:.25,grip:{x:0,y:1,z:0},orientation},recovery:{durationSeconds:.5,grip:{x:2,y:1,z:0},orientation}}},
    before=JSON.stringify(raw),m=createReferenceBatKinematicsV1(raw),intervals=m.intervalCertificatesV154!;
  expect(intervals).toBeDefined();
  expect([intervals.preparation.fromTick,intervals.preparation.throughTick]).toEqual([1750000,2000000]);
  expect([intervals.measuredArc.fromTick,intervals.measuredArc.throughTick]).toEqual([2000000,3000000]);
  expect([intervals.recovery.fromTick,intervals.recovery.throughTick]).toEqual([3000000,3500000]);
  for(const interval of Object.values(intervals)){
    for(let index=0;index<=16;index++){
      const sample=m.sampleContinuous(interval.fromTick+(interval.throughTick-interval.fromTick)*index/16);
      expect(norm(sample.state.linearVelocity)).toBeLessThanOrEqual(interval.maximumGripSpeedMps);
      expect(norm(sample.state.angularVelocity)).toBeLessThanOrEqual(interval.maximumAngularSpeedRadPerSecond);
      expect(norm(sample.sweetSpotVelocity)).toBeLessThanOrEqual(interval.maximumSweetSpotSpeedMps);
    }
    const first=m.sampleContinuous(interval.fromTick),last=m.sampleContinuous(interval.throughTick);
    expect(interval.startPose).toEqual({grip:first.state.pose.grip,orientation:first.orientation});
    expect(interval.endPose).toEqual({grip:last.state.pose.grip,orientation:last.orientation});
    expect(interval.minimumQuaternionNorm).toBeCloseTo(1,12);
    expect(Object.isFrozen(interval)).toBe(true);expect(Object.isFrozen(interval.startPose.grip)).toBe(true);
  }
  expect(m).toMatchObject({maximumGripSpeedMps:6,maximumAngularSpeedRadPerSecond:0,maximumSweetSpotSpeedMps:6,
    maximumSweetSpotSpeedUpperBoundMps:6,maximumGripAccelerationMps2:96,maximumAngularAccelerationRadPerSecond2:0,
    maximumSweetSpotAccelerationMps2:96,minimumQuaternionNormV122:.9999999999999716});
  for(const key of ['maximumGripSpeedMps','maximumAngularSpeedRadPerSecond','maximumSweetSpotSpeedMps',
    'maximumGripAccelerationMps2','maximumAngularAccelerationRadPerSecond2','maximumSweetSpotAccelerationMps2'] as const)
    expect(m[key]).toBe(Math.max(...Object.values(intervals).map(interval=>interval[key])));
  expect(m.minimumQuaternionNormV122).toBe(Math.min(...Object.values(intervals).map(interval=>interval.minimumQuaternionNorm)));
  for(const [tick,x]of [[1750000,0],[2000000,1],[3000000,1],[3500000,2]]){
    const sample=m.sampleContinuous(tick);
    expect(sample.state.pose.grip).toEqual({x,y:1,z:0});expect(sample.orientation).toEqual(orientation);
    expect(sample.state.linearVelocity).toEqual({x:0,y:0,z:0});expect(sample.state.angularVelocity).toEqual({x:0,y:0,z:0});
  }
  expect(JSON.stringify(raw)).toBe(before);
});

it('joins explicit finite preparation/recovery to nonzero measured endpoint tangents without editing the original keys', () => {
  const raw = authored(), before = JSON.stringify(raw), motion = createReferenceBatKinematicsV1(raw);
  expect(motion.motionStartTickV133).toBe(800000);
  expect(motion.motionThroughTickV133).toBe(1650000);
  expect(motion.executionEnvelopeSourceIdV133).toBe(envelope().sourceId);
  expect(norm(motion.sampleAtSourceTick(0).state.linearVelocity)).toBeGreaterThan(1);
  expect(norm(motion.sampleAtSourceTick(400000).state.linearVelocity)).toBeGreaterThan(1);
  for (const frame of raw.frames) {
    const sample = motion.sampleAtSourceTick(frame.tick);
    expect(sample.state.pose.grip).toEqual(frame.grip);
    expect(Math.abs(sample.orientation.x*frame.orientation.x + sample.orientation.y*frame.orientation.y
      + sample.orientation.z*frame.orientation.z + sample.orientation.w*frame.orientation.w)).toBeCloseTo(1, 12);
  }
  expect(motion.sampleContinuous(700000).state.pose.grip).toEqual(envelope().preparation.grip);
  expect(motion.sampleContinuous(1750000).state.pose.grip).toEqual(envelope().recovery.grip);
  expect(norm(motion.sampleContinuous(800000).sweetSpotVelocity)).toBe(0);
  expect(norm(motion.sampleContinuous(1650000).sweetSpotVelocity)).toBe(0);
  expect(JSON.stringify(raw)).toBe(before);
});

it.each([0, .12])('keeps pose and analytic velocities continuous at every join with motor ramp %s and delivered aim', ramp => {
  const raw = { ...authored(), motorRampSecondsV121: ramp,
    aimCorrectionV121: { availableTick: 1050000, throughTick: 1200000, offset: { x: .02, y: -.01, z: .01 } } };
  const m = createReferenceBatKinematicsV1(raw), end = referenceWorldTickAtSourceV121(raw, 400000);
  for (const tick of [m.motionStartTickV133!, raw.startTick, end, m.motionThroughTickV133!]) {
    const a = m.sampleContinuous(tick-.01), b = m.sampleContinuous(tick+.01);
    expect(norm(diff(a.state.pose.grip,b.state.pose.grip))).toBeLessThan(1e-5);
    expect(norm(diff(a.state.linearVelocity,b.state.linearVelocity))).toBeLessThan(.001);
    expect(norm(diff(a.state.angularVelocity,b.state.angularVelocity))).toBeLessThan(.001);
    expect(norm(diff(a.sweetSpotVelocity,b.sweetSpotVelocity))).toBeLessThan(.002);
  }
  expect(m.sampleContinuous(raw.startTick)).toEqual(m.sampleAtSourceTick(0));
  expect(m.sampleContinuous(end)).toEqual(m.sampleAtSourceTick(400000));
});

it('includes preparation/recovery in continuous SI bounds and in the same time and source samplers', () => {
  const raw = { ...authored(), playbackRate: 1.4, motorRampSecondsV121: .1,
    transform: { rotation: quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, .3), translation: { x: .1, y: .2, z: -.2 }, scale: 1.1 } },
    m = createReferenceBatKinematicsV1(raw);
  for (let tick = m.motionStartTickV133! + 12.25; tick < m.motionThroughTickV133!; tick += 1603.57) {
    const a = m.sampleContinuous(tick-.01), b = m.sampleContinuous(tick+.01), at = m.sampleContinuous(tick);
    for (const k of ['x','y','z'] as const) {
      expect((b.state.pose.grip[k]-a.state.pose.grip[k])*5e7).toBeCloseTo(at.state.linearVelocity[k], 5);
      expect((b.sweetSpot[k]-a.sweetSpot[k])*5e7).toBeCloseTo(at.sweetSpotVelocity[k], 5);
    }
    expect(norm(at.state.linearVelocity)).toBeLessThanOrEqual(m.maximumGripSpeedMps + 1e-10);
    expect(norm(at.state.angularVelocity)).toBeLessThanOrEqual(m.maximumAngularSpeedRadPerSecond + 1e-10);
    expect(norm(at.sweetSpotVelocity)).toBeLessThanOrEqual(m.maximumSweetSpotSpeedMps + 1e-10);
    expect(norm(diff(a.state.linearVelocity,b.state.linearVelocity))*5e7).toBeLessThanOrEqual(m.maximumGripAccelerationMps2!);
    expect(norm(diff(a.state.angularVelocity,b.state.angularVelocity))*5e7).toBeLessThanOrEqual(m.maximumAngularAccelerationRadPerSecond2!);
    expect(norm(diff(a.sweetSpotVelocity,b.sweetSpotVelocity))*5e7).toBeLessThanOrEqual(m.maximumSweetSpotAccelerationMps2!);
  }
  expect(() => m.sampleAtSourceTick(400001)).toThrow(/source/);
});

it.each([undefined,'whole-arc-target'] as const)('joins the actual impact-adjusted motor endpoints for method %s', method => {
  const raw = withReferenceImpactTrajectoryV1({ ...authored(), motorRampSecondsV121: .12 }, 220000,
    { level: 3, angleDegreesByLevel: [-10,0,10,20], beforeSeconds: .1, afterSeconds: .06, ...(method?{method}:{}) }),
    m = createReferenceBatKinematicsV1(raw), end = referenceWorldTickAtSourceV121(raw,400000);
  for (const tick of [raw.startTick,end]) {
    const a=m.sampleContinuous(tick-.01),b=m.sampleContinuous(tick+.01);
    expect(norm(diff(a.state.linearVelocity,b.state.linearVelocity))).toBeLessThan(.002);
    expect(norm(diff(a.state.angularVelocity,b.state.angularVelocity))).toBeLessThan(.002);
  }
  expect(m.sampleContinuous(end)).toEqual(m.sampleAtSourceTick(400000));
});

it('retains original source-time offsets and handles antipodal author poses without changing their bytes', () => {
  const raw=authored(), shifted={...raw,frames:raw.frames.map(f=>({...f,tick:f.tick+8e15}))},
    original=createReferenceBatKinematicsV1(raw),offset=createReferenceBatKinematicsV1(shifted);
  for(const tick of [0,100000,260000,400000])expect(offset.sampleAtSourceTick(tick+8e15).state).toEqual(original.sampleAtSourceTick(tick).state);
  const e=envelope(),negate=(q:typeof e.preparation.orientation)=>({x:-q.x,y:-q.y,z:-q.z,w:-q.w}),
    alternate={...raw,executionEnvelopeV133:{...e,preparation:{...e.preparation,orientation:negate(e.preparation.orientation)},
      recovery:{...e.recovery,orientation:negate(e.recovery.orientation)}}} as unknown as ReferenceBatKinematicsInputV1,
    before=JSON.stringify(alternate),m=createReferenceBatKinematicsV1(alternate);
  for(const tick of [700000,850000,1000000,1400000,1512345,1700000])expect(m.sampleContinuous(tick).state).toEqual(original.sampleContinuous(tick).state);
  expect(JSON.stringify(alternate)).toBe(before);
});

it('retains the entire legacy linear result and the zero-endpoint C1 contract without the optional Source', () => {
  const raw = input(), m = createReferenceBatKinematicsV1(raw), signature = JSON.stringify({ ...m,
    samples: [0,1000000,1051234.5,1100000,1234567.8,1400000,1500000].map(t=>m.sampleContinuous(t)) });
  expect(createHash('sha256').update(signature).digest('hex')).toBe('31da4fdeec6d5c7394884c568cbff56bb716fcdce213ac16c0b018b838dc441c');
  const c1 = createReferenceBatKinematicsV1({ ...raw, executionInterpolationV122: 'cubic-c1' });
  expect(c1).not.toHaveProperty('motionStartTickV133');
  expect(c1).not.toHaveProperty('intervalCertificatesV154');
  expect(norm(c1.sampleContinuous(1000000).sweetSpotVelocity)).toBe(0);
  expect(norm(c1.sampleContinuous(1400000).sweetSpotVelocity)).toBe(0);
});

it('rejects positive durations which cannot form a distinct execution-clock interval', () => {
  const raw = { ...authored(), executionEnvelopeV133: { ...envelope(),
    preparation: { ...envelope().preparation, durationSeconds: 1e-20 } } };
  expect(() => createReferenceBatKinematicsV1(raw as unknown as ReferenceBatKinematicsInputV1)).toThrow(/clock/);
});

it('does not activate author envelope behavior through an inherited property', () => {
  Object.defineProperty(Object.prototype, 'executionEnvelopeV133', { value: envelope(), configurable: true });
  try {
    const m = createReferenceBatKinematicsV1({ ...input(), executionInterpolationV122: 'cubic-c1' });
    expect(m).not.toHaveProperty('motionStartTickV133');
    expect(norm(m.sampleAtSourceTick(0).sweetSpotVelocity)).toBe(0);
  } finally { delete (Object.prototype as { executionEnvelopeV133?: unknown }).executionEnvelopeV133; }
});

it('keeps authored world boundary poses independent of the pitch-derived reference registration', () => {
  const raw=authored(),a=createReferenceBatKinematicsV1(raw),b=createReferenceBatKinematicsV1({...raw,
    transform:{rotation:quaternionFromAxisAngle({x:0,y:1,z:0},.4),translation:{x:.4,y:.2,z:-.3},scale:1.1}});
  expect(a.sampleContinuous(700000).state.pose.grip).toEqual(envelope().preparation.grip);
  expect(b.sampleContinuous(700000).state.pose.grip).toEqual(envelope().preparation.grip);
  expect(b.sampleContinuous(1800000).state.pose.grip).toEqual(envelope().recovery.grip);
  expect(b.sampleContinuous(700000).orientation).toEqual(a.sampleContinuous(700000).orientation);
});

it('does not expose cached boundary state through mutable observation samples', () => {
  const m=createReferenceBatKinematicsV1(authored()),before=JSON.stringify(m.sampleContinuous(700000));
  const sample=m.sampleContinuous(700000) as {state:{pose:{grip:{x:number}}}};
  sample.state.pose.grip.x=999;
  expect(JSON.stringify(m.sampleContinuous(700000))).toBe(before);
  const end=m.sampleAtSourceTick(400000),endBefore=JSON.stringify(end);
  (end.orientation as {x:number}).x=99;
  expect(JSON.stringify(m.sampleAtSourceTick(400000))).toBe(endBefore);
});

it.each(['preparation','recovery'] as const)('uses the represented clock span for %s derivatives and continuous bounds', phase => {
  const orientation={x:0,y:0,z:0,w:1}, raw:ReferenceBatKinematicsInputV1={...input(),startTick:1e12,ticksPerSecond:1,
    frames:[0,1e6].map(tick=>({tick,grip:{x:1,y:1,z:0},orientation})),executionInterpolationV122:'cubic-c1',
    executionEnvelopeV133:{version:'reference_bat_envelope_v133',sourceId:'rounded-clock-counterexample',
      preparation:{durationSeconds:.001,grip:{x:0,y:1,z:0},orientation},recovery:{durationSeconds:.001,grip:{x:2,y:1,z:0},orientation}}};
  const before=JSON.stringify(raw),m=createReferenceBatKinematicsV1(raw),end=referenceWorldTickAtSourceV121(raw,1e6),
    from=phase==='preparation'?m.motionStartTickV133!:end,through=phase==='preparation'?raw.startTick:m.motionThroughTickV133!,
    span=through-from,at=(u:number)=>m.sampleContinuous(from+span*u),low=at(3/8),high=at(5/8),
    secant=(high.state.pose.grip.x-low.state.pose.grip.x)/(high.tick-low.tick);
  expect(span).toBe(.0009765625); // Eight exactly representable ULPs, rather than .001 seconds.
  const interval=m.intervalCertificatesV154![phase];
  expect(interval.fromTick).toBe(from);expect(interval.throughTick).toBe(through);
  expect(secant).toBeLessThanOrEqual(m.maximumGripSpeedMps);
  expect(at(.5).state.linearVelocity.x).toBe(1.5/span);
  expect(m.maximumGripSpeedMps).toBeGreaterThanOrEqual(1.5/span);
  expect(JSON.stringify(raw)).toBe(before);
});

it.each(['version','empty-id','duration','quaternion','extra-field','clock','linear'] as const)('rejects invalid envelope Source %s', fault => {
  const e = envelope();
  const p = fault === 'version' ? { ...e, version: 'unknown' } : fault === 'empty-id' ? { ...e, sourceId: '' }
    : fault === 'duration' ? { ...e, preparation: { ...e.preparation, durationSeconds: 0 } }
      : fault === 'quaternion' ? { ...e, recovery: { ...e.recovery, orientation: { x: 0, y: 0, z: 0, w: 0 } } }
        : fault === 'extra-field' ? { ...e, ability: 999 } : e;
  const raw = { ...authored(), executionEnvelopeV133: p, ...(fault === 'clock' ? { startTick: 0 } : {}),
    ...(fault === 'linear' ? { executionInterpolationV122: undefined } : {}) } as unknown as ReferenceBatKinematicsInputV1;
  expect(() => createReferenceBatKinematicsV1(raw)).toThrow();
});

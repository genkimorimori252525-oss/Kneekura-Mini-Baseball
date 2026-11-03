import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from './ReferenceBatKinematicsV1';
import { quaternionFromAxisAngle } from '../pitching/BaseballOrientation';
import { certifyReferenceQuaternionCubicV122 } from './ReferenceBatC1V122';

const input = () => ({ provenance: { clipId: 'c1-execution-synthetic', sourceSha256: '2'.repeat(64) },
  frames: [
    { tick: 0, grip: { x: 0, y: 1, z: .1 }, orientation: quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, 0) },
    { tick: 100000, grip: { x: .2, y: 1.2, z: -.1 }, orientation: quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, .7) },
    { tick: 260000, grip: { x: -.1, y: 1.3, z: .2 }, orientation: quaternionFromAxisAngle({ x: 1, y: 1, z: 0 }, 1.3) },
    { tick: 400000, grip: { x: .3, y: 1, z: .4 }, orientation: quaternionFromAxisAngle({ x: 0, y: 1, z: 1 }, 1.8) } ],
  batLengthM: .84, sweetSpotT: .8, sourceTicksPerSecond: 1e6, startTick: 1e6, ticksPerSecond: 1e6, playbackRate: 1,
  transform: { rotation: { x: 0, y: 0, z: 0, w: 1 }, translation: { x: 0, y: 0, z: 0 }, scale: 1 } });
const norm = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
const difference = (a: { x: number; y: number; z: number }, b: typeof a) => ({ x: a.x-b.x, y: a.y-b.y, z: a.z-b.z });

it('adds C1 author execution only by explicit opt-in and retains every original source key', () => {
  const raw = input(), before = JSON.stringify(raw), motion = createReferenceBatKinematicsV1({ ...raw, executionInterpolationV122: 'cubic-c1' } as ReferenceBatKinematicsInputV1);
  expect(motion).toHaveProperty('executionInterpolationV122', 'cubic-c1');
  for (const frame of raw.frames) {
    const one = motion.sampleAtSourceTick(frame.tick, 'incoming'), two = motion.sampleAtSourceTick(frame.tick, 'outgoing');
    expect(one.state.pose.grip).toEqual(frame.grip);
    expect(two.state.pose.grip).toEqual(frame.grip);
    expect(Math.abs(one.orientation.x*frame.orientation.x+one.orientation.y*frame.orientation.y
      +one.orientation.z*frame.orientation.z+one.orientation.w*frame.orientation.w)).toBeCloseTo(1,13);
    expect(norm(difference(one.state.linearVelocity, two.state.linearVelocity))).toBeLessThan(1e-10);
    expect(norm(difference(one.state.angularVelocity, two.state.angularVelocity))).toBeLessThan(1e-10);
  }
  expect(JSON.stringify(raw)).toBe(before);
});

it('retains the legacy return shape and deterministic fixture without optional acceleration claims', () => {
  const motion = createReferenceBatKinematicsV1(input());
  expect(motion).not.toHaveProperty('executionInterpolationV122');
  expect(motion).not.toHaveProperty('maximumGripAccelerationMps2');
  const signature = JSON.stringify({ ...motion, samples: [0,1000000,1051234.5,1100000,1234567.8,1400000,1500000].map(t => motion.sampleContinuous(t)) });
  expect(createHash('sha256').update(signature).digest('hex')).toBe('31da4fdeec6d5c7394884c568cbff56bb716fcdce213ac16c0b018b838dc441c');
});

it('keeps analytic velocities C1 across uneven key times and stationary endpoint holds', () => {
  const raw = input(), motion = createReferenceBatKinematicsV1({ ...raw, executionInterpolationV122: 'cubic-c1' } as ReferenceBatKinematicsInputV1);
  for (const frame of raw.frames) {
    const tick = raw.startTick + frame.tick, before = motion.sampleContinuous(tick-.001), after = motion.sampleContinuous(tick+.001);
    expect(norm(difference(before.state.linearVelocity, after.state.linearVelocity))).toBeLessThan(.001);
    expect(norm(difference(before.state.angularVelocity, after.state.angularVelocity))).toBeLessThan(.001);
  }
  for (const tick of [raw.startTick,raw.startTick+400000]) {
    expect(norm(motion.sampleContinuous(tick).sweetSpotVelocity)).toBeLessThan(1e-10);
  }
  for (let tick = raw.startTick+123.5; tick < raw.startTick+400000; tick += 7391.3) {
    const a = motion.sampleContinuous(tick-.1), b = motion.sampleContinuous(tick+.1), at = motion.sampleContinuous(tick);
    for (const key of ['x','y','z'] as const) {
      expect((b.state.pose.grip[key]-a.state.pose.grip[key])*5e6).toBeCloseTo(at.state.linearVelocity[key],6);
      expect((b.sweetSpot[key]-a.sweetSpot[key])*5e6).toBeCloseTo(at.sweetSpotVelocity[key],6);
    }
    expect(norm(at.state.linearVelocity)).toBeLessThanOrEqual(motion.maximumGripSpeedMps);
    expect(norm(at.state.angularVelocity)).toBeLessThanOrEqual(motion.maximumAngularSpeedRadPerSecond);
    expect(norm(at.sweetSpotVelocity)).toBeLessThanOrEqual(motion.maximumSweetSpotSpeedMps);
  }
});

it('certifies conservative continuous acceleration bounds and proper time/space scaling', () => {
  const raw = { ...input(), executionInterpolationV122: 'cubic-c1' as const }, motion = createReferenceBatKinematicsV1(raw);
  expect(motion.minimumQuaternionNormV122).toBeGreaterThan(0);
  for (let tick = raw.startTick+.25; tick < raw.startTick+400000; tick += 1711.57) {
    const a=motion.sampleContinuous(tick-.1),b=motion.sampleContinuous(tick+.1);
    expect(norm(difference(a.state.linearVelocity,b.state.linearVelocity))*5e6).toBeLessThanOrEqual(motion.maximumGripAccelerationMps2!);
    expect(norm(difference(a.state.angularVelocity,b.state.angularVelocity))*5e6).toBeLessThanOrEqual(motion.maximumAngularAccelerationRadPerSecond2!);
    expect(norm(difference(a.sweetSpotVelocity,b.sweetSpotVelocity))*5e6).toBeLessThanOrEqual(motion.maximumSweetSpotAccelerationMps2!);
  }
  const scaled=createReferenceBatKinematicsV1({...raw,playbackRate:2,transform:{...raw.transform,scale:1.5}});
  expect(scaled.maximumGripAccelerationMps2).toBeCloseTo(motion.maximumGripAccelerationMps2!*6,8);
  expect(scaled.maximumAngularAccelerationRadPerSecond2).toBeCloseTo(motion.maximumAngularAccelerationRadPerSecond2!*4,8);
  expect(scaled.maximumSweetSpotAccelerationMps2).toBeCloseTo(motion.maximumSweetSpotAccelerationMps2!*6,8);
});

it('aligns antipodes without changing the original quaternion keys and rejects uncertified zero norms', () => {
  const raw = input(), aligned=createReferenceBatKinematicsV1({...raw,executionInterpolationV122:'cubic-c1'});
  raw.frames.forEach((f,i)=>{if(i%2)f.orientation={x:-f.orientation.x,y:-f.orientation.y,z:-f.orientation.z,w:-f.orientation.w};});
  const before=JSON.stringify(raw),motion=createReferenceBatKinematicsV1({...raw,executionInterpolationV122:'cubic-c1'});
  for(const tick of [1000000,1034567,1100000,1259999.5,1400000])expect(motion.sampleContinuous(tick)).toEqual(aligned.sampleContinuous(tick));
  expect(JSON.stringify(raw)).toBe(before);
  expect(certifyReferenceQuaternionCubicV122([[0,0,0,1],[.1,0,0,1],[0,.1,0,1],[0,0,0,1]])).toBeGreaterThan(0);
  expect(()=>certifyReferenceQuaternionCubicV122([[0,0,0,1],[0,0,0,-1],[0,0,0,-1],[0,0,0,1]])).toThrow(/norm/);
  expect(()=>createReferenceBatKinematicsV1({...raw,executionInterpolationV122:'linear'} as unknown as ReferenceBatKinematicsInputV1)).toThrow();
});

it('keeps source-time offsets out of derived velocities and acceleration certificates',()=>{
  const raw=input(),shift=8e15,base=createReferenceBatKinematicsV1({...raw,executionInterpolationV122:'cubic-c1'}),
    shifted=createReferenceBatKinematicsV1({...raw,executionInterpolationV122:'cubic-c1',frames:raw.frames.map(f=>({...f,tick:f.tick+shift}))});
  for(const source of [0,30000,100000,200000,260000,350000,400000])
    expect(shifted.sampleAtSourceTick(source+shift).state).toEqual(base.sampleAtSourceTick(source).state);
  expect(shifted.maximumGripAccelerationMps2).toBe(base.maximumGripAccelerationMps2);
  expect(shifted.maximumAngularAccelerationRadPerSecond2).toBe(base.maximumAngularAccelerationRadPerSecond2);
});

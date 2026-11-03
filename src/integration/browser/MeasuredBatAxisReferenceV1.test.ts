import { expect, it } from 'vitest';
import { createMeasuredBatAxisReferenceV1, type MeasuredBatAxisReferenceInputV1 } from './MeasuredBatAxisReferenceV1';
import { createReferenceBatKinematicsV1 } from '../../core/sim/contact/ReferenceBatKinematicsV1';
import { rotateVectorByQuaternion } from '../../core/sim/pitching/BaseballOrientation';

const input = () => ({
  provenance: { clipId: 'measured:fixture', sourceSha256: 'a'.repeat(64) },
  frames: [
    { tick: 0, handReference: { x: 0, y: .17145, z: 0 }, sweetSpot: { x: 0, y: .7, z: 0 } },
    { tick: 100_000, handReference: { x: .27145, y: 0, z: 0 }, sweetSpot: { x: .8, y: 0, z: 0 } },
    { tick: 200_000, handReference: { x: .2, y: 0, z: .17145 }, sweetSpot: { x: .2, y: 0, z: .7 } },
  ],
  batLengthM: .8524, sweetSpotFromTipM: .1524, handReferenceFromKnobM: .17145, maximumHandResidualM: .001,
  sourceTicksPerSecond: 1_000_000, startTick: 0, ticksPerSecond: 1_000_000, playbackRate: 1,
  transform: { rotation: { w: 1, x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 }, scale: 1 },
} satisfies MeasuredBatAxisReferenceInputV1);

it('preserves every measured sweet-spot key with one declared rigid length', () => {
  const source = input(), adapted = createMeasuredBatAxisReferenceV1(source), motor = createReferenceBatKinematicsV1(adapted.reference);
  for (const frame of source.frames) {
    const sample = motor.sample(frame.tick);
    for (const axis of ['x','y','z'] as const) expect(sample.sweetSpot[axis]).toBeCloseTo(frame.sweetSpot[axis], 12);
    expect(Math.hypot(sample.state.pose.tip.x-sample.state.pose.grip.x,
      sample.state.pose.tip.y-sample.state.pose.grip.y,sample.state.pose.tip.z-sample.state.pose.grip.z)).toBeCloseTo(source.batLengthM,12);
  }
  expect(adapted.maximumHandResidualM).toBeLessThan(1e-12);
  expect(adapted.axialPhase).toBe('DECLARED_MINIMUM_ROTATION_TRANSPORT');
  expect(adapted.nativeAdmission).toBe(false); expect(adapted.officialResult).toBeNull();
});

it('reports and bounds the hand reference residual without moving measured sweet spots', () => {
  const source = input(); source.frames[1].handReference.x += .01; source.maximumHandResidualM = .011;
  const adapted = createMeasuredBatAxisReferenceV1(source);
  expect(adapted.maximumHandResidualM).toBeCloseTo(.01,12);
  expect(createReferenceBatKinematicsV1(adapted.reference).sample(100_000).sweetSpot.x).toBeCloseTo(.8,12);
  source.maximumHandResidualM = .009;
  expect(() => createMeasuredBatAxisReferenceV1(source)).toThrow(/hand reference residual/);
});

it('transports the axis by the shortest rotation without inventing measured axial roll', () => {
  const adapted = createMeasuredBatAxisReferenceV1(input());
  const expected = [{x:0,y:1,z:0},{x:1,y:0,z:0},{x:0,y:0,z:1}];
  adapted.reference.frames.forEach((frame,index) => {
    const axis=rotateVectorByQuaternion({x:0,y:1,z:0},frame.orientation);
    for(const component of ['x','y','z'] as const) expect(axis[component]).toBeCloseTo(expected[index][component],12);
  });
  const half=createReferenceBatKinematicsV1(adapted.reference).sample(50_000);
  expect(half.state.angularVelocity.x).toBeCloseTo(0,12);
  expect(half.state.angularVelocity.y).toBeCloseTo(0,12);
  expect(half.state.angularVelocity.z).toBeCloseTo(-Math.PI/.2,10);
});

it('rejects missing/zero points, ambiguous antipodes, wrong clocks and nonmonotonic source keys', () => {
  const missing=input(); missing.frames[1].sweetSpot.x=NaN; expect(()=>createMeasuredBatAxisReferenceV1(missing)).toThrow();
  const zero=input(); zero.frames[1].handReference={...zero.frames[1].sweetSpot}; expect(()=>createMeasuredBatAxisReferenceV1(zero)).toThrow();
  const reversed=input(); reversed.frames[1].handReference={x:0,y:-.17145,z:0}; reversed.frames[1].sweetSpot={x:0,y:-.7,z:0};
  expect(()=>createMeasuredBatAxisReferenceV1(reversed)).toThrow(/antipodal/);
  const clock=input(); clock.frames[1].tick=0; expect(()=>createMeasuredBatAxisReferenceV1(clock)).toThrow();
  const rate=input(); rate.playbackRate=0; expect(()=>createMeasuredBatAxisReferenceV1(rate)).toThrow();
});

it('retains detached source measurements and does not let observation order change the motor', () => {
  const source=input(), original=JSON.stringify(source), adapted=createMeasuredBatAxisReferenceV1(source);
  const motor=createReferenceBatKinematicsV1(adapted.reference), first=motor.sample(75_000);
  motor.sample(199_000); motor.sample(100); expect(motor.sample(75_000)).toEqual(first);
  expect(JSON.stringify(source)).toBe(original);
  source.frames[0].sweetSpot.y=99; expect(motor.sample(75_000)).toEqual(first);
});

it('keeps measured keys near the initially downward axis without snapping them to vertical', () => {
  const source=input(), epsilon=1e-7, y=-Math.sqrt(1-epsilon*epsilon);
  source.frames[0].handReference={x:epsilon*.17145,y:y*.17145,z:0};
  source.frames[0].sweetSpot={x:epsilon*.7,y:y*.7,z:0};
  const sample=createReferenceBatKinematicsV1(createMeasuredBatAxisReferenceV1(source).reference).sample(0);
  expect(sample.sweetSpot.x).toBeCloseTo(source.frames[0].sweetSpot.x,12);
});

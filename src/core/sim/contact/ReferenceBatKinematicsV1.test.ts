import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createReferenceBatKinematicsV1 } from './ReferenceBatKinematicsV1';
import { quaternionFromAxisAngle } from '../pitching/BaseballOrientation';
import { createRigidBatStateFromBatterSwingState, resolveRigidBatBallContact,
  REFERENCE_BASEBALL_RIGID_BODY, CROSS_NATHAN_2006_LOW_SPEED_BAT_CONTACT_FIXTURE } from './RigidBatBallContact';

const input = () => ({ provenance: { clipId: 'research', sourceSha256: 'a'.repeat(64) },
  frames: [{ tick: 0, grip: { x: 0, y: 1, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
    { tick: 100_000, grip: { x: .1, y: 1, z: 0 }, orientation: quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 2) }],
  batLengthM: .84, sweetSpotT: .72, sourceTicksPerSecond: 1_000_000,
  startTick: 200_000, ticksPerSecond: 1_000_000, playbackRate: 1,
  transform: { rotation: { x: 0, y: 0, z: 0, w: 1 }, translation: { x: 0, y: 0, z: 0 }, scale: 1 } });

it('keeps a rigid rod between source keys and uses analytic point velocity in the same state', () => {
  const trajectory = createReferenceBatKinematicsV1(input());
  const a = trajectory.sample(249_990), b = trajectory.sample(250_010), m = trajectory.sample(250_000);
  expect(Math.hypot(m.state.pose.tip.x - m.state.pose.grip.x, m.state.pose.tip.y - m.state.pose.grip.y,
    m.state.pose.tip.z - m.state.pose.grip.z)).toBeCloseTo(.84, 12);
  expect(m.state.angularVelocity.x).toBeCloseTo(Math.PI / .2, 10);
  expect(trajectory.maximumSweetSpotSpeedMps).toBeCloseTo(Math.hypot(1,Math.PI/.2*.84*.72),10);
  for (const axis of ['x', 'y', 'z'] as const) expect((b.sweetSpot[axis] - a.sweetSpot[axis]) / .00002)
    .toBeCloseTo(m.sweetSpotVelocity[axis], 6);
  expect(trajectory.authority).toBe('SAMPLED_RIGID_REFERENCE_RESEARCH');
  expect(trajectory.officialResult).toBeNull(); expect(trajectory.nativeAdmission).toBe(false);
});

it('changes only execution time for playback rate and holds both ends without extrapolation', () => {
  const regular = createReferenceBatKinematicsV1(input()), fastInput = input(); fastInput.playbackRate = 2;
  const fast = createReferenceBatKinematicsV1(fastInput);
  expect(fast.sample(225_000).state.pose).toEqual(regular.sample(250_000).state.pose);
  expect(fast.sample(225_000).sweetSpotVelocity.z).toBeCloseTo(regular.sample(250_000).sweetSpotVelocity.z * 2, 10);
  expect(regular.sample(0).state.linearVelocity).toEqual({ x: 0, y: 0, z: 0 });
  expect(regular.sample(400_000).state.angularVelocity).toEqual({ x: 0, y: 0, z: 0 });
});
it('evaluates original key coordinates with explicit incoming/outgoing derivatives without world-time snapping', () => {
  const raw=input();raw.playbackRate=1.37;
  raw.frames.push({tick:200_000,grip:{x:.4,y:1,z:0},orientation:raw.frames[1].orientation});
  const trajectory=createReferenceBatKinematicsV1(raw),incoming=trajectory.sampleAtSourceTick(100_000,'incoming'),outgoing=trajectory.sampleAtSourceTick(100_000,'outgoing');
  expect(incoming.state.pose).toEqual(outgoing.state.pose);
  expect(incoming.state.linearVelocity.x).toBeCloseTo(1.37,12);
  expect(outgoing.state.linearVelocity.x).toBeCloseTo(4.11,12);
  expect(incoming.state.angularVelocity).not.toEqual(outgoing.state.angularVelocity);
  expect(trajectory.sampleAtSourceTick(0,'incoming').state.pose.grip).toEqual(raw.frames[0].grip);
  expect(trajectory.sampleAtSourceTick(0,'incoming').sweetSpotVelocity).toEqual({x:0,y:0,z:0});
  expect(trajectory.sampleAtSourceTick(200_000,'outgoing').sweetSpotVelocity).toEqual({x:0,y:0,z:0});
  expect(trajectory.sampleAtSourceTick(200_000,'incoming').state.linearVelocity.x).toBeCloseTo(4.11,12);
  const interior=trajectory.sampleAtSourceTick(150_000);
  expect(trajectory.sampleContinuous(interior.tick).state.pose.grip.x).toBeCloseTo(interior.state.pose.grip.x,12);
  expect(()=>trajectory.sampleAtSourceTick(NaN)).toThrow('source tick');
});

it('transforms positions, orientation, and velocity by the same proper rigid registration and SI scale', () => {
  const normal = createReferenceBatKinematicsV1(input()), rotatedInput = input();
  rotatedInput.transform = { rotation: quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI),
    translation: { x: 2, y: 3, z: 4 }, scale: 2 };
  const transformed = createReferenceBatKinematicsV1(rotatedInput), a = normal.sample(250_000), b = transformed.sample(250_000);
  expect(b.sweetSpot.x).toBeCloseTo(2 - a.sweetSpot.x * 2, 11);
  expect(b.sweetSpot.z).toBeCloseTo(4 - a.sweetSpot.z * 2, 11);
  expect(b.sweetSpotVelocity.z).toBeCloseTo(-a.sweetSpotVelocity.z * 2, 11);
  expect(transformed.maximumSweetSpotSpeedUpperBoundMps).toBeCloseTo(normal.maximumSweetSpotSpeedUpperBoundMps * 2, 10);
});

it('does not retain mutable authoring inputs and refuses invalid timelines/frames/transforms', () => {
  const raw = input(), trajectory = createReferenceBatKinematicsV1(raw), original = trajectory.sample(250_000);
  raw.frames[0].grip.x = 99; expect(trajectory.sample(250_000)).toEqual(original);
  const duplicate = input(); duplicate.frames[1].tick = 0;
  expect(() => createReferenceBatKinematicsV1(duplicate)).toThrow();
  const invalid = input(); invalid.frames[0].orientation = {...invalid.frames[0].orientation,w:0};
  expect(() => createReferenceBatKinematicsV1(invalid)).toThrow();
  const badScale = input(); badScale.transform.scale = -1;
  expect(() => createReferenceBatKinematicsV1(badScale)).toThrow();
  expect(() => trajectory.sample(NaN)).toThrow();
});

it('selects the human-requested upper Miku fifth stage and keeps both original sources unchanged', () => {
  const dataset = JSON.parse(readFileSync(new URL('../../../../docs/demos/reference-bat-motions.json', import.meta.url), 'utf8'));
  const clips = dataset.clips.filter((clip: { id: string }) => ['vmd-2-18', 'vmd-2-62'].includes(clip.id));
  expect(clips.map((clip: { id: string }) => clip.id)).toEqual(['vmd-2-18', 'vmd-2-62']);
  for (const clip of clips) {
    const before = JSON.stringify(clip.frames), scenario = input();
    scenario.provenance = { clipId: clip.id, sourceSha256: clip.source.sha256 };
    scenario.frames = clip.frames.map((f: typeof scenario.frames[number]) => ({tick:f.tick,grip:f.grip,orientation:f.orientation}));
    const trajectory = createReferenceBatKinematicsV1(scenario);
    for (let tick = 200_000; tick <= 500_000; tick += 991) {
      const f = trajectory.sample(tick), p = f.state.pose;
      expect(Math.hypot(p.tip.x-p.grip.x,p.tip.y-p.grip.y,p.tip.z-p.grip.z)).toBeCloseTo(.84, 10);
      expect(Math.hypot(...Object.values(f.sweetSpotVelocity))).toBeLessThanOrEqual(trajectory.maximumSweetSpotSpeedMps + 1e-8);
    }
    expect(JSON.stringify(clip.frames)).toBe(before);
  }
});

it('handles quaternion antipodes without inventing a whole revolution', () => {
  const source=input(); source.frames[1].orientation={x:0,y:0,z:0,w:-1};
  const middle=createReferenceBatKinematicsV1(source).sample(250_000);
  expect(middle.state.angularVelocity).toEqual({x:0,y:0,z:0});
  expect(middle.state.pose.tip.y-middle.state.pose.grip.y).toBeCloseTo(.84,12);
});

it('bounds an interior speed peak that exceeds both segment endpoint speeds', () => {
  const source=input();
  source.frames[1].grip={x:0,y:.9,z:.1};
  const trajectory=createReferenceBatKinematicsV1(source), middle=trajectory.sample(250_000);
  const peak=Math.sqrt(2)+Math.PI/.2*.84*.72;
  expect(trajectory.maximumSweetSpotSpeedMps).toBeCloseTo(peak,10);
  expect(Math.hypot(...Object.values(middle.sweetSpotVelocity))).toBeCloseTo(peak,10);
  expect(Math.hypot(...Object.values(trajectory.sample(200_000).sweetSpotVelocity))).toBeLessThan(peak);
  expect(Math.hypot(...Object.values(trajectory.sample(299_999).sweetSpotVelocity))).toBeLessThan(peak);
});

it('feeds actual reference velocities to the existing rigid collision kernel and leaves geometric misses unaltered', () => {
  const sample=createReferenceBatKinematicsV1(input()).sample(250_000);
  const bat=createRigidBatStateFromBatterSwingState(sample.state,{massKg:1,centerOfMassT:.5,
    transverseMomentOfInertiaKgM2:.05,axialMomentOfInertiaKgM2:.0004,
    radiusProfile:{knots:[{t:0,radiusM:.033},{t:1,radiusM:.033}]}});
  const ball={tick:sample.tick,position:{...sample.sweetSpot,x:sample.sweetSpot.x+.069},
    velocity:{x:-4,y:0,z:0},spin:{x:0,y:0,z:0}};
  const hit=resolveRigidBatBallContact(ball,bat,REFERENCE_BASEBALL_RIGID_BODY,CROSS_NATHAN_2006_LOW_SPEED_BAT_CONTACT_FIXTURE);
  expect(hit).not.toBeNull(); expect(Object.values(hit!.exitVelocity).every(Number.isFinite)).toBe(true);
  expect(hit!.exitSpin).not.toEqual(ball.spin);
  expect(resolveRigidBatBallContact({...ball,position:{...ball.position,x:ball.position.x+1}},bat,
    REFERENCE_BASEBALL_RIGID_BODY,CROSS_NATHAN_2006_LOW_SPEED_BAT_CONTACT_FIXTURE)).toBeNull();
});

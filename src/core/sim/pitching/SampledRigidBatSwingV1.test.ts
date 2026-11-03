import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from '../contact/ReferenceBatKinematicsV1';
import { createMeasuredBatAxisReferenceV1, type MeasuredBatAxisReferenceInputV1 } from '../contact/MeasuredBatAxisReferenceV1';
import { createRigidBatSwingWindowFromSampledV1, resolveAerodynamicRigidBatSwing } from './AerodynamicRigidBatSwingingPitchPhysicalResult';
import { sampleAerodynamicPitchTrajectory, type AerodynamicPitchTrajectory } from './AerodynamicPitchTrajectory';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { REALISTIC_BASEBALL_RIGID_BODY, type RigidBatPhysicalProperties } from '../contact/RigidBatBallContact';
import { quaternionFromAxisAngle } from './BaseballOrientation';
import { resolveAndRecordAerodynamicRigidPitchAgainstBatter } from './AerodynamicRigidPitchAgainstBatter';
import { createCanonicalPlateAppearanceTimeline } from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import { NPB_2026_RULE_PROFILE } from '../../rules/RuleProfile';

const physical: RigidBatPhysicalProperties = { massKg: .9, centerOfMassT: .6, transverseMomentOfInertiaKgM2: .06,
  axialMomentOfInertiaKgM2: .00055, radiusProfile: { knots: [{ t: 0, radiusM: .016 }, { t: 1, radiusM: .033 }] } };
const resolver = () => ({ normalRestitution: .5, tangentialRestitution: .3, frictionCoefficient: .2 });
const identity = { w: 1, x: 0, y: 0, z: 0 };
const reference = (): ReferenceBatKinematicsInputV1 => ({ provenance: { clipId: 'controlled-curved-path', sourceSha256: 'a'.repeat(64) },
  frames: [0, 100000, 200000].map((tick, i) => ({ tick, grip: { x: -.84 * .72, y: 1, z: i === 1 ? 1 : 0 },
    orientation: quaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, -Math.PI / 2) })),
  batLengthM: .84, sweetSpotT: .72, sourceTicksPerSecond: 1e6, startTick: 0, ticksPerSecond: 1e6, playbackRate: 1,
  transform: { rotation: identity, translation: { x: 0, y: 0, z: 0 }, scale: 1 } });

// Controlled collision geometry, not an actor decision or statistical hit-rate
// test: translate an explicitly declared pitch so it crosses a measured key.
const crossing = (ref: ReferenceBatKinematicsInputV1, at: number): AerodynamicPitchTrajectory => {
  const aim = createReferenceBatKinematicsV1(ref).sample(at).sweetSpot;
  const base: AerodynamicPitchTrajectory = { start: { tick: 0, position: { x: 0, y: 1, z: 18 }, velocity: { x: 0, y: 0, z: -40 }, spin: { x: 0, y: 180, z: 0 } },
    endTick: 400000, parameters: { ticksPerSecond: 1e6, integrationStepTicks: 1000, gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS } };
  const predicted = sampleAerodynamicPitchTrajectory(base, at);
  return { ...base, start: { ...base.start, position: { x: base.start.position.x + aim.x - predicted.position.x,
    y: base.start.position.y + aim.y - predicted.position.y, z: base.start.position.z + aim.z - predicted.position.z } } };
};

it('executes curved sampled keys instead of extrapolating the initial velocity', () => {
  const ref = reference(), trajectory = crossing(ref, 150000), swing = createRigidBatSwingWindowFromSampledV1(ref, physical);
  const actual = resolveAerodynamicRigidBatSwing({ trajectory, swing, ball: REALISTIC_BASEBALL_RIGID_BODY, parameterResolver: resolver });
  const { sampledKinematicsV1: _sampled, ...compatibility } = swing;
  const old = resolveAerodynamicRigidBatSwing({ trajectory, swing: compatibility, ball: REALISTIC_BASEBALL_RIGID_BODY, parameterResolver: resolver });
  expect(actual.kind).toBe('contact'); expect(old.kind).toBe('contact');
  if (actual.kind !== 'contact' || old.kind !== 'contact') throw new Error('controlled contacts required');
  expect(actual.contact.tick).toBeGreaterThan(old.contact.tick);
  expect(actual.contact.exitVelocity).not.toEqual(old.contact.exitVelocity);
  expect(actual.contact.ballCenter).toEqual(sampleAerodynamicPitchTrajectory(trajectory, actual.contact.tick).position);
  // Native canonical JSON may reorder object keys; that must not change motion.
  const state = swing.stateAtStart;
  const reordered = { ...swing, stateAtStart: { angularVelocity: state.angularVelocity, linearVelocity: state.linearVelocity,
    pose: { tip: state.pose.tip, grip: state.pose.grip } } };
  expect(resolveAerodynamicRigidBatSwing({ trajectory, swing: reordered, ball: REALISTIC_BASEBALL_RIGID_BODY, parameterResolver: resolver })).toEqual(actual);
});

it('keeps geometric misses and rejects a conflicting trajectory, altered seed, clock and active interval', () => {
  const ref = reference(), trajectory = crossing(ref, 150000), swing = createRigidBatSwingWindowFromSampledV1(ref, physical);
  const input = { trajectory, swing, ball: REALISTIC_BASEBALL_RIGID_BODY, parameterResolver: resolver };
  expect(resolveAerodynamicRigidBatSwing({ ...input, trajectory: { ...trajectory,
    start: { ...trajectory.start, position: { ...trajectory.start.position, x: trajectory.start.position.x + 10 } } } }).kind).toBe('swinging_miss');
  expect(() => resolveAerodynamicRigidBatSwing({ ...input, swing: { ...swing, kinematicsV1: {} as never } })).toThrow();
  expect(() => resolveAerodynamicRigidBatSwing({ ...input, swing: { ...swing, stateAtStart: { ...swing.stateAtStart,
    pose: { ...swing.stateAtStart.pose, grip: { x: 99, y: 0, z: 0 } } } } })).toThrow('seed');
  expect(() => resolveAerodynamicRigidBatSwing({ ...input, swing: { ...swing, ticksPerSecond: 1000 } })).toThrow('ticksPerSecond');
  let invoked = false;
  expect(() => createRigidBatSwingWindowFromSampledV1(ref, physical, Object.defineProperty({ endTick: 200000 }, 'startTick', {
    enumerable: true, get() { invoked = true; return 0; } }) as never)).toThrow('accessors'); expect(invoked).toBe(false);
  (ref.frames[0].grip as { x: number }).x = 20;
  expect(swing.sampledKinematicsV1!.frames[0].grip.x).not.toBe(20);
});

type Clip = { id: string; source: { sha256: string }; contactTimeSeconds: number; normalization: { batLengthM: number };
  measurements: MeasuredBatAxisReferenceInputV1['frames']; binding: { sweetSpotFromTipM: number; handReferenceFromKnobM: number } };
const clips = (JSON.parse(readFileSync(new URL('../../../../docs/demos/measured-bat-motions.json', import.meta.url), 'utf8')) as { clips: Clip[] }).clips;
const exactUs = (seconds: number) => {
  const text = String(seconds); if (!/^\d+(?:\.\d{1,6})?$/.test(text)) throw new Error('fixture impact time is not exact microseconds');
  const [whole, fraction = ''] = text.split('.'); return Number(BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0')));
};
it.each(clips)('records actual rigid contact and canonical ball/spin from all original keys: $id', clip => {
  const adapted = createMeasuredBatAxisReferenceV1({ provenance: { clipId: clip.id, sourceSha256: clip.source.sha256 }, frames: clip.measurements,
    batLengthM: clip.normalization.batLengthM, sweetSpotFromTipM: clip.binding.sweetSpotFromTipM,
    handReferenceFromKnobM: clip.binding.handReferenceFromKnobM, maximumHandResidualM: .02,
    sourceTicksPerSecond: 1e6, startTick: 0, ticksPerSecond: 1e6, playbackRate: 1,
    transform: { rotation: identity, translation: { x: 0, y: 0, z: 0 }, scale: 1 } });
  const before = JSON.stringify(adapted.reference), impact = exactUs(clip.contactTimeSeconds) - clip.measurements[0].tick;
  const trajectory = crossing(adapted.reference, impact), swing = createRigidBatSwingWindowFromSampledV1(adapted.reference, physical);
  const timeline = createCanonicalPlateAppearanceTimeline({ ruleProfileId: NPB_2026_RULE_PROFILE.id, inning: 1, half: 'top', outs: 0,
    balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { home: 0, away: 0 }, playId: 1 }, 0);
  const result = resolveAndRecordAerodynamicRigidPitchAgainstBatter(timeline, { action: { kind: 'swing', swing }, trajectory,
    ball: REALISTIC_BASEBALL_RIGID_BODY, parameterResolver: resolver });
  expect(result.kind).toBe('recorded_swing');
  if (result.kind !== 'recorded_swing' || result.physical.kind !== 'contact') throw new Error('actual marker-path collision required');
  expect(result.timeline.status.kind).toBe('batted_ball_pending');
  expect(result.timeline.events.some(e => e.kind === 'BatBallContact')).toBe(true);
  expect(result.physical.contact.ballCenter).toEqual(sampleAerodynamicPitchTrajectory(trajectory, result.physical.contact.tick).position);
  expect(Object.values(result.physical.contact.exitSpin).every(Number.isFinite)).toBe(true);
  expect(JSON.stringify(adapted.reference)).toBe(before);
});

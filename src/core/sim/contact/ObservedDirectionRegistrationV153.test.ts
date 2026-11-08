import { expect, it } from 'vitest';
import { planObservedDirectionRegistrationV153 } from './ObservedDirectionRegistrationV153';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from './ReferenceBatKinematicsV1';
import { quaternionFromAxisAngle } from '../pitching/BaseballOrientation';
import { createRigidBatStateFromBatterSwingState, measureRigidBatBallGeometry, measureRigidBatBallSurfaceSeparation,
  REALISTIC_BASEBALL_RIGID_BODY, type RigidBatPhysicalProperties } from './RigidBatBallContact';
import { resolveWoodBatSpeedProfileBallContact } from './WoodBatSpeedResponseProfile';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from './WoodBatProductionProfileV1';

const reference = ():ReferenceBatKinematicsInputV1 => ({ provenance:{ clipId:'synthetic-direction-barrel', sourceSha256:'3'.repeat(64) },
  frames:[0, 100000, 200000, 300000].map((tick, index) => ({ tick, grip:{ x:-.672, y:1, z:index - 2 },
    orientation:quaternionFromAxisAngle({ x:0, y:0, z:1 }, -Math.PI / 2) })),
  batLengthM:.84, sweetSpotT:.8, sourceTicksPerSecond:1000000, startTick:1000000, ticksPerSecond:1000000, playbackRate:1,
  transform:{ rotation:{ x:0, y:0, z:0, w:1 }, translation:{ x:0, y:0, z:0 }, scale:1 }, executionInterpolationV122:'cubic-c1' });
const bat:RigidBatPhysicalProperties = { massKg:.88, centerOfMassT:.65, transverseMomentOfInertiaKgM2:.046,
  axialMomentOfInertiaKgM2:.00035, radiusProfile:{ knots:[{ t:0, radiusM:.03 }, { t:1, radiusM:.03 }] } };
const input = (angle = 0) => ({ reference:reference(), contactSourceTick:150000, prediction:{ anchorTick:1000000, availableTick:1000000,
  position:{ x:0, y:1, z:6 }, velocity:{ x:0, y:0, z:-40 }, acceleration:{ x:0, y:0, z:0 } },
  desiredFieldAngleDegrees:angle, batPhysical:bat, ballPhysical:REALISTIC_BASEBALL_RIGID_BODY });

it('registers a nominal center-field barrel surface rather than overlapping the ball and sweet-spot centers', () => {
  const source = input(), result = planObservedDirectionRegistrationV153(source);
  expect(result.diagnostics.status).toBe('PLANNED');
  expect(result.reference).not.toBeNull();
  const motion = createReferenceBatKinematicsV1(result.reference!), nominal = motion.sampleAtSourceTick(150000),
    distance = Math.hypot(nominal.sweetSpot.x, nominal.sweetSpot.y - 1, nominal.sweetSpot.z);
  expect(distance).toBeCloseTo(.0666, 8);
  expect(result.diagnostics.predictedContact!.surfaceSeparationM).toBeLessThanOrEqual(0);
  expect(Math.abs(result.diagnostics.residualDegrees!)).toBeLessThan(.1);
  expect(result.reference!.frames).toEqual(source.reference.frames);
  expect(result.reference!.startTick).toBe(source.reference.startTick);
  expect(result.reference!.sweetSpotT).toBe(source.reference.sweetSpotT);
});

it.each([-20, 0, 20])('selects a finite nominal yaw for a requested %s degree field angle', desired => {
  const result = planObservedDirectionRegistrationV153(input(desired));
  expect(result.diagnostics.status).toBe('PLANNED');
  expect(Math.abs(result.diagnostics.residualDegrees!)).toBeLessThan(6);
  expect(result.diagnostics.candidates.map(candidate => candidate.yawDegrees)).toEqual(Array.from({ length:17 }, (_, index) => index * 5 - 40));
  expect(result.diagnostics.modelAssumptions).toMatchObject({ unknownSpin:'ZERO_OPERATIONAL_ASSUMPTION', errorsApplied:false,
    phaseChanged:false, actualWorldUsed:false, opponentPrivateStateUsed:false });
});

it('keeps mirrored barrel/desired directions symmetric while preserving each own Source and clock', () => {
  const one = input(20), two = input(-20);
  two.reference = { ...two.reference, frames:two.reference.frames.map(frame => ({ ...frame, grip:{ ...frame.grip, x:-frame.grip.x },
    orientation:quaternionFromAxisAngle({ x:0, y:0, z:1 }, Math.PI / 2) })) };
  const right = planObservedDirectionRegistrationV153(one), left = planObservedDirectionRegistrationV153(two);
  expect(right.diagnostics.status).toBe('PLANNED');expect(left.diagnostics.status).toBe('PLANNED');
  expect(right.diagnostics.selectedYawDegrees).toBe(-left.diagnostics.selectedYawDegrees!);
  expect(right.diagnostics.predictedContact!.fieldAngleDegrees).toBeCloseTo(-left.diagnostics.predictedContact!.fieldAngleDegrees, 7);
  for (const [raw, result] of [[one, right], [two, left]] as const) {
    expect(result.reference!.provenance).toEqual(raw.reference.provenance);expect(result.reference!.frames).toEqual(raw.reference.frames);
    expect(result.reference!.playbackRate).toBe(raw.reference.playbackRate);expect(result.reference!.ticksPerSecond).toBe(raw.reference.ticksPerSecond);
    expect(result.reference!.sourceTicksPerSecond).toBe(raw.reference.sourceTicksPerSecond);
  }
});

it('scores the existing wood response at localized earliest surface contact instead of the nominal center time', () => {
  const source = input(20), result = planObservedDirectionRegistrationV153(source), at = result.diagnostics.predictedContact!,
    motion = createReferenceBatKinematicsV1(result.reference!), dt = (at.atTick - source.prediction.anchorTick) / source.reference.ticksPerSecond,
    ball = { tick:at.atTick, position:{ x:0, y:1, z:6 - 40 * dt }, velocity:{ x:0, y:0, z:-40 }, spin:{ x:0, y:0, z:0 } },
    rigid = createRigidBatStateFromBatterSwingState(motion.sampleContinuous(at.atTick).state, bat);
  expect(at.contactWindow.fromTick).toBeLessThanOrEqual(at.atTick);
  expect((at.contactWindow.throughTick - at.contactWindow.fromTick) / source.reference.ticksPerSecond).toBeLessThanOrEqual(1e-5);
  expect(Math.abs(at.surfaceSeparationM)).toBeLessThan(1e-8);
  expect(at.response).toEqual(resolveWoodBatSpeedProfileBallContact(ball, rigid, source.ballPhysical, NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1));
  const beforeTick = at.contactWindow.fromTick - 1, beforeDt = (beforeTick - source.prediction.anchorTick) / source.reference.ticksPerSecond;
  expect(measureRigidBatBallSurfaceSeparation({ ...ball, tick:beforeTick, position:{ x:0, y:1, z:6 - 40 * beforeDt } },
    createRigidBatStateFromBatterSwingState(motion.sampleContinuous(beforeTick).state, bat), source.ballPhysical)).toBeGreaterThan(0);
});

it('scores an earlier surface passage when the authored barrel crosses the prediction before returning to its nominal phase', () => {
  const source = input(), levels = [-2, 10, -10, 1];
  source.reference = { ...source.reference, frames:source.reference.frames.map((frame, index) => ({ ...frame, grip:{ ...frame.grip, z:levels[index] } })) };
  const result = planObservedDirectionRegistrationV153(source), hit = result.diagnostics.predictedContact!;
  expect(result.diagnostics.status).toBe('PLANNED');
  expect(hit.atTick).toBeLessThan(1140000);
  expect(hit.contactWindow.throughTick).toBeLessThan(1150000);
  expect(Math.abs(hit.surfaceSeparationM)).toBeLessThan(1e-8);
  expect(result.reference!.frames).toEqual(source.reference.frames);
  expect(result.reference!.startTick).toBe(source.reference.startTick);
});

it('registers an actual tapered surface whose nearest axis point differs from the nominal sweet-spot parameter', () => {
  const source = { ...input(20), batPhysical:{ ...bat, radiusProfile:{ knots:[{ t:0, radiusM:.012 }, { t:.6, radiusM:.018 }, { t:1, radiusM:.045 }] } } },
    result = planObservedDirectionRegistrationV153(source), motion = createReferenceBatKinematicsV1(result.reference!),
    sample = motion.sampleAtSourceTick(150000), ball = { tick:sample.tick, position:{ x:0, y:1, z:0 }, velocity:{ x:0, y:0, z:-40 }, spin:{ x:0, y:0, z:0 } },
    geometry = measureRigidBatBallGeometry(ball, createRigidBatStateFromBatterSwingState(sample.state, source.batPhysical), source.ballPhysical);
  expect(result.diagnostics.status).toBe('PLANNED');
  expect(Math.abs(geometry.signedGapMeters)).toBeLessThan(1e-8);
  expect(Math.abs(geometry.segmentT - source.reference.sweetSpotT)).toBeGreaterThan(1e-4);
  expect(result.diagnostics.predictedContact!.geometry.segmentT).toBeGreaterThan(0);
});

it('retains arrival-anchored continuous p/v/a before the anchor without rounding the contact Source coordinate', () => {
  const source = input(), contactSourceTick = 150000.25, nominalTick = 1150000.25,
    result = planObservedDirectionRegistrationV153({ ...source, contactSourceTick, prediction:{ anchorTick:nominalTick, availableTick:1000000,
      position:{ x:0, y:1, z:0 }, velocity:{ x:0, y:0, z:-40 }, acceleration:{ x:0, y:0, z:-2 } } });
  expect(result.diagnostics.status).toBe('PLANNED');
  expect(result.diagnostics.predictedContact!.atTick).toBeLessThanOrEqual(nominalTick);
  expect(result.reference!.frames).toEqual(source.reference.frames);
  expect(createReferenceBatKinematicsV1(result.reference!).sampleAtSourceTick(contactSourceTick).sourceTick).toBe(contactSourceTick);
});

it('rejects explicit bound violations and leaves missing acceleration certification or a missing approach normal unresolved', () => {
  const tooSlow = planObservedDirectionRegistrationV153({ ...input(), limits:{ maximumSweetSpotSpeedMps:.1 } });
  expect(tooSlow.reference).toBeNull();expect(tooSlow.diagnostics.status).toBe('NO_FEASIBLE_CANDIDATE');
  expect(tooSlow.diagnostics.candidates.every(candidate => candidate.status === 'LIMIT_EXCEEDED')).toBe(true);
  const { executionInterpolationV122:_interpolation, ...legacy } = reference(),
    missing = planObservedDirectionRegistrationV153({ ...input(), reference:legacy, limits:{ maximumGripAccelerationMps2:1000 } });
  expect(missing.reference).toBeNull();expect(missing.diagnostics.status).toBe('UNRESOLVED');
  expect(missing.diagnostics.candidates.every(candidate => candidate.reason.includes('MISSING_CERTIFICATE'))).toBe(true);
  const still = reference(), stationary = { ...still, frames:still.frames.map(frame => ({ ...frame, grip:{ x:0, y:1, z:0 } })) },
    unresolved = planObservedDirectionRegistrationV153({ ...input(), reference:stationary,
      prediction:{ anchorTick:1000000, availableTick:1000000, position:{ x:0, y:1, z:0 }, velocity:{ x:0, y:0, z:0 }, acceleration:{ x:0, y:0, z:0 } } });
  expect(unresolved.reference).toBeNull();expect(unresolved.diagnostics.status).toBe('UNRESOLVED');
});

it('recertifies the fully composed preparation/recovery and preserves their fixed world poses', () => {
  const source = input(20), envelope = { version:'reference_bat_envelope_v133' as const, sourceId:'explicit-synthetic-envelope',
    preparation:{ durationSeconds:.1, grip:{ x:-.672, y:1, z:-2 }, orientation:source.reference.frames[0].orientation },
    recovery:{ durationSeconds:.1, grip:{ x:-.672, y:1, z:1 }, orientation:source.reference.frames[0].orientation } },
    result = planObservedDirectionRegistrationV153({ ...source, prediction:{ ...source.prediction, availableTick:900000 },
      reference:{ ...source.reference, executionEnvelopeV133:envelope },
      limits:{ maximumSweetSpotSpeedMps:1000, maximumGripAccelerationMps2:1e7,
        maximumAngularAccelerationRadPerSecond2:1e7, maximumSweetSpotAccelerationMps2:1e7 } });
  expect(result.diagnostics.status).toBe('PLANNED');
  expect(result.reference!.executionEnvelopeV133).toEqual(envelope);
  const motion = createReferenceBatKinematicsV1(result.reference!);
  expect(motion.sampleContinuous(motion.motionStartTickV133!).state.pose.grip).toEqual(envelope.preparation.grip);
  expect(motion.sampleContinuous(motion.motionThroughTickV133!).state.pose.grip).toEqual(envelope.recovery.grip);
  const selected = result.diagnostics.candidates.find(candidate => candidate.yawDegrees === result.diagnostics.selectedYawDegrees)!;
  expect(selected.certificates).toMatchObject({ c1:true, includesPreparationRecovery:true,
    maximumGripAccelerationMps2:motion.maximumGripAccelerationMps2,
    maximumAngularAccelerationRadPerSecond2:motion.maximumAngularAccelerationRadPerSecond2,
    maximumSweetSpotAccelerationMps2:motion.maximumSweetSpotAccelerationMps2 });
});

it('does not score a later free-flight contact after the delivered prediction already hits the known held prefix', () => {
  const source = input(), result = planObservedDirectionRegistrationV153({ ...source, prediction:{ anchorTick:500000, availableTick:500000,
    position:{ x:0, y:1, z:-58.5 }, velocity:{ x:0, y:0, z:220 }, acceleration:{ x:0, y:0, z:-400 } } });
  if (result.reference) expect(result.diagnostics.predictedContact!.atTick).toBeLessThan(source.reference.startTick);
  else expect(result.diagnostics.status).toBe('UNRESOLVED');
  const tooLate = planObservedDirectionRegistrationV153({ ...source, prediction:{ ...source.prediction, availableTick:1000001 } });
  expect(tooLate.reference).toBeNull();expect(tooLate.diagnostics.status).toBe('UNRESOLVED');
  expect(tooLate.diagnostics.candidates.every(candidate => candidate.reason.includes('PREDICTION_AVAILABLE_AFTER_MOTION_START'))).toBe(true);
});

it('finds contact in the fixed authored held prefix before preparation starts for every candidate yaw', () => {
  const source = input(), envelope = { version:'reference_bat_envelope_v133' as const, sourceId:'fixed-prefix-counterexample',
    preparation:{ durationSeconds:.05, grip:{ x:-.672, y:1, z:-1.5666 }, orientation:source.reference.frames[0].orientation },
    recovery:{ durationSeconds:.1, grip:{ x:-.672, y:1, z:1 }, orientation:source.reference.frames[0].orientation } },
    result = planObservedDirectionRegistrationV153({ ...source, reference:{ ...source.reference, executionEnvelopeV133:envelope },
      prediction:{ anchorTick:500000, availableTick:500000, position:{ x:0, y:1, z:-58.5 },
        velocity:{ x:0, y:0, z:220 }, acceleration:{ x:0, y:0, z:-400 } } });
  expect(result.diagnostics.status).toBe('PLANNED');
  expect(result.diagnostics.predictedContact!.atTick).toBeLessThan(950000);
  expect(result.diagnostics.candidates.every(candidate => candidate.predictedContact !== null && candidate.predictedContact.atTick < 950000)).toBe(true);
  expect(result.reference!.executionEnvelopeV133).toEqual(envelope);
});

it('rejects private inputs and delivered aim corrections, while keeping every caller object unchanged and result frozen', () => {
  const source = input(), before = JSON.stringify(source), result = planObservedDirectionRegistrationV153(source);
  expect(JSON.stringify(source)).toBe(before);expect(Object.isFrozen(source.reference.frames)).toBe(false);
  expect(Object.isFrozen(result.reference!.frames)).toBe(true);expect(Object.isFrozen(result.diagnostics.candidates)).toBe(true);
  for (const raw of [{ ...source, seed:5 }, { ...source, kernel:{} }, { ...source, prediction:{ ...source.prediction, spin:{ x:1, y:0, z:0 } } },
    { ...source, limits:{ maximumSweetSpotSpeedMps:-1 } }, { ...source, reference:{ ...source.reference, aimCorrectionV121:{} } }])
    expect(() => planObservedDirectionRegistrationV153(raw as typeof source)).toThrow();
});

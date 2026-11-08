import { expect, it } from 'vitest';
import { planObservedDirectionRegistrationV153, planObservedReactiveRegistrationV161, type ObservedReactiveRegistrationInputV161 } from './ObservedDirectionRegistrationV153';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from './ReferenceBatKinematicsV1';
import { quaternionFromAxisAngle } from '../pitching/BaseballOrientation';
import { REALISTIC_BASEBALL_RIGID_BODY } from './RigidBatBallContact';

const reference = ():ReferenceBatKinematicsInputV1 => {
  const orientation = quaternionFromAxisAngle({ x:0, y:0, z:1 }, -Math.PI / 2);
  return { provenance:{ clipId:'synthetic-reactive-barrel', sourceSha256:'4'.repeat(64) },
    frames:[0, 100000, 200000, 300000].map((tick, index) => ({ tick, grip:{ x:-.672, y:1, z:index - 2 }, orientation })),
    batLengthM:.84, sweetSpotT:.8, sourceTicksPerSecond:1000000, startTick:1000000, ticksPerSecond:1000000, playbackRate:1,
    transform:{ rotation:{ x:0, y:0, z:0, w:1 }, translation:{ x:0, y:0, z:0 }, scale:1 }, executionInterpolationV122:'cubic-c1',
    executionEnvelopeV133:{ version:'reference_bat_envelope_v133', sourceId:'fixed-reactive-hold',
      preparation:{ durationSeconds:.1, grip:{ x:-.672, y:1, z:-2 }, orientation },
      recovery:{ durationSeconds:.1, grip:{ x:-.672, y:1, z:1 }, orientation } } };
};
const input = (x = 0):ObservedReactiveRegistrationInputV161 => ({ reference:reference(), contactSourceTick:150000,
  prediction:{ anchorTick:1000000, availableTick:900000, position:{ x, y:1, z:6 },
    velocity:{ x:0, y:0, z:-40 }, acceleration:{ x:0, y:0, z:0 } },
  batPhysical:{ massKg:.88, centerOfMassT:.65, transverseMomentOfInertiaKgM2:.046,
    axialMomentOfInertiaKgM2:.00035, radiusProfile:{ knots:[{ t:0, radiusM:.03 }, { t:1, radiusM:.03 }] } },
  ballPhysical:REALISTIC_BASEBALL_RIGID_BODY });
const transferCost = (registered:ReferenceBatKinematicsInputV1) => {
  const motion = createReferenceBatKinematicsV1(registered), start = motion.motionStartTickV133!,
    held = motion.sampleContinuous(start).state.pose, arc = motion.sampleContinuous(registered.startTick).state.pose,
    distance = (one:typeof held.grip, two:typeof held.grip) => Math.hypot(one.x - two.x, one.y - two.y, one.z - two.z);
  return Math.max(distance(held.grip, arc.grip), distance(held.tip, arc.tip)) / ((registered.startTick - start) / registered.ticksPerSecond);
};

it('registers each observed inside/outside position without introducing a nominal field-angle target', () => {
  const sources = [input(-.3), input(.3)], results = sources.map(planObservedReactiveRegistrationV161);
  for (const [index, result] of results.entries()) {
    expect(result.diagnostics).toMatchObject({ version:'observed_reactive_registration_v161', status:'PLANNED',
      nominalIntent:'REACTIVE', nominalFieldAngleDegrees:null, residualDegrees:null });
    expect(result.diagnostics.predictedContact!.surfaceSeparationM).toBeLessThanOrEqual(0);
    expect(result.reference!.frames).toEqual(sources[index].reference.frames);
    expect(result.reference!.executionEnvelopeV133).toEqual(sources[index].reference.executionEnvelopeV133);
    expect(result.diagnostics.candidates.every(candidate => candidate.residualDegrees === null)).toBe(true);
  }
  expect(results[0].reference!.transform).not.toEqual(results[1].reference!.transform);
  expect(results[0].diagnostics.nominalTargetSweetSpot!.x).toBeLessThan(results[1].diagnostics.nominalTargetSweetSpot!.x);
});

it('chooses the minimum feasible maximum endpoint displacement per preparation second and reports it as a kinematic proxy', () => {
  const source = input(.3), result = planObservedReactiveRegistrationV161(source),
    feasible = result.diagnostics.candidates.filter(candidate => candidate.status === 'PREDICTED_CONTACT');
  expect(result.diagnostics.status).toBe('PLANNED');
  expect(feasible.length).toBeGreaterThan(1);
  expect(result.diagnostics.selectedPreparationTransferCostMps).toBe(Math.min(...feasible.map(candidate => candidate.preparationTransferCostMps!)));
  expect(result.diagnostics.selectedPreparationTransferCostMps).toBeCloseTo(transferCost(result.reference!), 12);
  expect(Math.abs(result.diagnostics.predictedContact!.fieldAngleDegrees)).toBeGreaterThan(1);
  expect(result.diagnostics.modelAssumptions).toMatchObject({ selection:'MINIMUM_MAX_ENDPOINT_PREPARATION_TRANSFER_SPEED',
    preparationCost:'KINEMATIC_PROXY_NOT_MEASURED_HUMAN_EFFORT', actualWorldUsed:false,
    opponentPrivateStateUsed:false, anthropometricFeasibilityCertified:false });
  expect(result.diagnostics.predictedContact!.response).not.toBeNull();
  const motion = createReferenceBatKinematicsV1(result.reference!),
    selected = feasible.find(candidate => candidate.yawDegrees === result.diagnostics.selectedYawDegrees)!;
  expect(selected.certificates).toMatchObject({ c1:true, includesPreparationRecovery:true,
    maximumGripAccelerationMps2:motion.maximumGripAccelerationMps2,
    maximumAngularAccelerationRadPerSecond2:motion.maximumAngularAccelerationRadPerSecond2,
    maximumSweetSpotAccelerationMps2:motion.maximumSweetSpotAccelerationMps2 });
});

it('preserves left/right reflection when both the observed ball and the fixed held/arc poses are mirrored', () => {
  const right = input(.3), original = right.reference, orientation = quaternionFromAxisAngle({ x:0, y:0, z:1 }, Math.PI / 2),
    mirrorGrip = (grip:{ x:number;y:number;z:number }) => ({ ...grip, x:-grip.x }),
    left:ObservedReactiveRegistrationInputV161 = { ...input(-.3), reference:{ ...original,
      frames:original.frames.map(frame => ({ ...frame, grip:mirrorGrip(frame.grip), orientation })),
      executionEnvelopeV133:{ ...original.executionEnvelopeV133!,
        preparation:{ ...original.executionEnvelopeV133!.preparation, grip:mirrorGrip(original.executionEnvelopeV133!.preparation.grip), orientation },
        recovery:{ ...original.executionEnvelopeV133!.recovery, grip:mirrorGrip(original.executionEnvelopeV133!.recovery.grip), orientation } } } },
    one = planObservedReactiveRegistrationV161(right), two = planObservedReactiveRegistrationV161(left);
  expect(one.diagnostics.status).toBe('PLANNED');expect(two.diagnostics.status).toBe('PLANNED');
  expect(one.diagnostics.selectedYawDegrees).toBe(-two.diagnostics.selectedYawDegrees!);
  expect(one.diagnostics.selectedPreparationTransferCostMps).toBeCloseTo(two.diagnostics.selectedPreparationTransferCostMps!, 10);
  expect(one.diagnostics.predictedContact!.fieldAngleDegrees).toBeCloseTo(-two.diagnostics.predictedContact!.fieldAngleDegrees, 7);
});

it('requires a fixed held envelope and positive preparation clock, and preserves explicit limit refusal', () => {
  const source = input(), { executionEnvelopeV133:_envelope, ...withoutEnvelope } = source.reference,
    missing = planObservedReactiveRegistrationV161({ ...source, reference:withoutEnvelope });
  expect(missing.reference).toBeNull();expect(missing.diagnostics.status).toBe('UNRESOLVED');
  expect(missing.diagnostics.candidates.every(candidate => candidate.reason === 'MISSING_AUTHORED_HELD_PREPARATION')).toBe(true);
  const tooLate = planObservedReactiveRegistrationV161({ ...source, prediction:{ ...source.prediction, availableTick:900001 } });
  expect(tooLate.reference).toBeNull();expect(tooLate.diagnostics.status).toBe('UNRESOLVED');
  const invalid = { ...source, reference:{ ...source.reference, executionEnvelopeV133:{ ...source.reference.executionEnvelopeV133!,
    preparation:{ ...source.reference.executionEnvelopeV133!.preparation, durationSeconds:0 } } } };
  expect(() => planObservedReactiveRegistrationV161(invalid)).toThrow();
  const limited = planObservedReactiveRegistrationV161({ ...source, limits:{ maximumSweetSpotSpeedMps:.1 } });
  expect(limited.reference).toBeNull();expect(limited.diagnostics.status).toBe('NO_FEASIBLE_CANDIDATE');
  expect(limited.diagnostics.candidates.every(candidate => candidate.status === 'LIMIT_EXCEEDED')).toBe(true);
});

it('does not accept direction goals, hidden state, future Source cells, or delivered aim corrections; inputs stay mutable and outputs freeze', () => {
  const source = input(), before = JSON.stringify(source), result = planObservedReactiveRegistrationV161(source);
  expect(JSON.stringify(source)).toBe(before);expect(Object.isFrozen(source.reference.frames)).toBe(false);
  expect(Object.isFrozen(result.reference!.frames)).toBe(true);expect(Object.isFrozen(result.diagnostics.candidates)).toBe(true);
  expect(Object.isFrozen(result.diagnostics.predictedContact!.response)).toBe(true);
  for (const raw of [{ ...source, desiredFieldAngleDegrees:0 }, { ...source, seed:5 }, { ...source, kernel:{} },
    { ...source, prediction:{ ...source.prediction, sourceCells:[] } }, { ...source, reference:{ ...source.reference, aimCorrectionV121:{} } }])
    expect(() => planObservedReactiveRegistrationV161(raw as typeof source)).toThrow();
  for (const raw of [null, undefined, {}, []]) {
    const message = raw === undefined ? 'official window input must contain inert data only' : 'invalid nominal prediction or private extra fields';
    expect(() => planObservedReactiveRegistrationV161(raw as typeof source)).toThrow(message);
    expect(() => planObservedDirectionRegistrationV153(raw as Parameters<typeof planObservedDirectionRegistrationV153>[0]))
      .toThrow(message);
  }
});

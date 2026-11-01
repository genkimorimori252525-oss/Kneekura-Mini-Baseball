import { expect, it } from 'vitest';
import { fixture, value } from './BattingFixtures.test-support';
import { measuredFixture } from './MeasuredBattingFixtures.test-support';
import { calculateObservedBattingMotorPlanV1, type BattingMotorPlanInputV1 } from './BattingMotorPlanV1';
import * as api from './SpinMotorPlanV123';

function input(measured = false) {
  const r = measured ? measuredFixture() : fixture(), s = r.source, p = s.predictions[1];
  const base: BattingMotorPlanInputV1 = { decisionTick: r.currentFrame.time.tick, aggression: 0.8,
    geometry: { handedness: s.handedness, centerOfMass: s.centerOfMass, batPhysical: s.batPhysical, plateZ: s.plateZ,
      strikeZone: s.strikeZone, bodyReadyTick: s.bodyReadyTick, latestMotorStartTick: s.latestMotorStartTick },
    motor: { motorLatencyTicks: s.motorLatencyTicks, technicalTimingOffsetTicks: s.technicalTimingOffsetTicks, maximumSweetSpotSpeedMps: s.maximumSweetSpotSpeedMps },
    repertoire: { repertoireId: s.repertoireId, repertoireVersion: s.repertoireVersion, profiles: s.profiles,
      ...(s.sampledProfiles ? { sampledProfiles: s.sampledProfiles } : {}) },
    forecast: { observedTick: p.observedTick, availableTick: p.availableTick, validUntilTick: p.validUntilTick, trajectory: p.trajectory } };
  const ref = { sourceId: 'accepted-repertoire', sourceVersion: 'test-v1' };
  return { base, atDay: 17, repertoireSourceRef: ref,
    intent: { technique: 'BACKSPIN' as const, selectedAtTick: base.decisionTick },
    techniques: [{ technique: 'BACKSPIN' as const, qualificationRef: { sourceId: 'qualified-backspin', sourceVersion: 'v1' },
      acceptedAtDay: 16, repertoireRef: ref, calibration: { sourceId: 'explicit-model', sourceVersion: 'v1', status: 'MODEL_VERIFIED' as const },
      motorProfileRefs: [{ profileId: s.profiles[0].profile.profileId, version: s.profiles[0].profile.version }] }] };
}

it.each([false, true])('keeps NO_SPIN_TARGET identical to the original motor, including measured keys (%s)', measured => {
  const i = input(measured), before = structuredClone(i);
  expect(api.calculateObservedSpinMotorPlanV123).toBeTypeOf('function');
  const result = value(api.calculateObservedSpinMotorPlanV123({ ...i, intent: { ...i.intent, technique: 'NO_SPIN_TARGET' } }));
  expect(result).toMatchObject({ boundary: 'SPIN_MOTOR_PLAN_ONLY', selectedIntent: 'NO_SPIN_TARGET', selectedQualificationRef: null });
  expect(result.plan).toEqual(value(calculateObservedBattingMotorPlanV1(i.base)));
  expect(i).toEqual(before);
});

it('uses only a specifically qualified existing motor profile and never returns or adds an exit spin', () => {
  const i = input(), before = structuredClone(i), result = value(api.calculateObservedSpinMotorPlanV123(i));
  expect(result).toMatchObject({ selectedIntent: 'BACKSPIN', selectedQualificationRef: i.techniques[0].qualificationRef,
    plan: { status: 'READY', motion: { profileId: 'controlled' } } });
  expect(result).not.toHaveProperty('exitSpin');
  expect(value(calculateObservedBattingMotorPlanV1(i.base))).toMatchObject({ motion: { profileId: 'strong' } });
  expect(i).toEqual(before);
  const unavailable = value(api.calculateObservedSpinMotorPlanV123({ ...i, intent: { ...i.intent, technique: 'TOPSPIN' } }));
  expect(unavailable).toMatchObject({ selectedIntent: 'NO_SPIN_TARGET', fallbackReason: 'UNMASTERED_TECHNIQUE' });
  expect(unavailable.plan).toEqual(value(calculateObservedBattingMotorPlanV1(i.base)));
});

it('can choose a feasible learned profile when the default stronger profile exceeds the same personal speed envelope', () => {
  const i = structuredClone(input()); i.base = { ...i.base, motor: { ...i.base.motor, maximumSweetSpotSpeedMps: 34 } };
  expect(calculateObservedBattingMotorPlanV1(i.base).ok).toBe(false);
  const result = value(api.calculateObservedSpinMotorPlanV123(i));
  expect(result).toMatchObject({ selectedIntent: 'BACKSPIN', fallbackReason: null,
    plan: { status: 'READY', motion: { profileId: 'controlled' } } });
});

it('falls back on unavailable or unexecutable technique motion without inventing more speed or a successful contact', () => {
  for (const patch of [
    (i: ReturnType<typeof input>) => { i.techniques[0].acceptedAtDay = i.atDay + 1; },
    (i: ReturnType<typeof input>) => { i.techniques[0].repertoireRef = { ...i.repertoireSourceRef, sourceId: 'another-bat-model' }; },
    (i: ReturnType<typeof input>) => { i.techniques[0].motorProfileRefs[0].profileId = 'absent-motor'; },
    (i: ReturnType<typeof input>) => { (i.base.repertoire.profiles[0].profile as { baseContactSweetSpotSpeedMps: number }).baseContactSweetSpotSpeedMps = 90; },
  ]) {
    const i = structuredClone(input()); patch(i);
    const original = value(calculateObservedBattingMotorPlanV1(i.base)), result = value(api.calculateObservedSpinMotorPlanV123(i));
    expect(result.selectedIntent).toBe('NO_SPIN_TARGET'); expect(result.fallbackReason).not.toBeNull();
    expect(result.plan).toEqual(original);
  }
});

it('refuses future perception, future decisions and result/Gold shortcuts at the boundary', () => {
  for (const patch of [
    (i: any) => { i.base.forecast.availableTick = i.base.decisionTick + 1; },
    (i: any) => { i.intent.selectedAtTick = i.base.decisionTick + 1; },
    (i: any) => { i.actualTrajectory = i.base.forecast.trajectory; },
    (i: any) => { i.intent.exitSpin = { x: 0, y: 200, z: 0 }; },
    (i: any) => { i.techniques[0].gold = true; },
    (i: any) => { i.intent.technique = 'GOLD'; },
  ]) { const i = structuredClone(input()); patch(i); expect(api.calculateObservedSpinMotorPlanV123(i).ok).toBe(false); }
});

it('requires an explicit registered linear implementation for measured qualification and rejects other implementation claims', () => {
  const i = input(true);
  const legacy = value(api.calculateObservedSpinMotorPlanV123(i));
  expect(legacy).toMatchObject({ selectedIntent: 'NO_SPIN_TARGET', fallbackReason: 'REPERTOIRE_UNAVAILABLE' });
  const explicit = { ...i, techniques: i.techniques.map(t => ({ ...t, motorProfileRefs: t.motorProfileRefs.map(r =>
    ({ ...r, implementationV133: api.REGISTERED_MEASURED_LINEAR_V133 })) })) };
  const result = value(api.calculateObservedSpinMotorPlanV123(explicit));
  expect(result).toMatchObject({ selectedIntent: 'BACKSPIN', fallbackReason: null, plan: { status: 'READY', motion: { trajectory: null } } });
  if (result.plan.status !== 'READY') throw Error('explicit measured control is not ready');
  expect(result.plan.motion.sampledTrajectoryV1!.frames).toHaveLength(137);
  for (const mode of ['cubic-c1', 'registered_measured_linear_v134', '', null]) {
    const wrong = { ...explicit, techniques: explicit.techniques.map(t => ({ ...t, motorProfileRefs: t.motorProfileRefs.map(r =>
      ({ ...r, implementationV133: mode })) })) };
    expect(api.calculateObservedSpinMotorPlanV123(wrong).ok).toBe(false);
  }
  const course = input();
  expect(value(api.calculateObservedSpinMotorPlanV123({ ...course, techniques: explicit.techniques })).selectedIntent).toBe('NO_SPIN_TARGET');
});

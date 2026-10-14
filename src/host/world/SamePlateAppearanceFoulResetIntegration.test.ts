import { expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import { completeSamePaFoulResetFixture } from './SamePlateAppearanceFoulResetFixture.test-support';

/** One staged real Native composition. -24,000 is this test's independently
 * accepted technical-timing Source, selected by the bounded Core probe. It is
 * neither a production default nor a supplied contact/territory/outcome. */
it('FR01 original swing owns an untouched settled foul, official closure and controller reset before the fourth ordinary pitch', () => {
  const values = dispatchCalibrationValues(), observation = values.batter_observation;
  const explicitBatterObservation = { ...observation, calibration: { ...observation.calibration, errorParameters: { ...observation.calibration.errorParameters,
    minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0, minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } };
  const explicitBatterMotor = { ...values.batter_motor, technicalTimingOffsetTicks: -24_000 };
  const h = samePaPhysicalLifecycleFixture({ profile: { ruleProfileId: NPB_2026_RULE_PROFILE.id }, explicitBatterObservation, explicitBatterMotor });
  try {
    const before = h.current(), readyAtUs = Math.max(before.view.cut.evaluationTick, before.view.cut.bodyCut.completedAtTick);
    const action = h.prepareAction('foul-reset:pitch3', 'observer_decision', { ...h.original.nominalPitch,
      delivery: { ...h.original.nominalPitch.delivery, readyAtUs, physics: { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } } } },
      { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS });
    const preparations: ReturnType<typeof prepareFreshPhysicalFieldFixture>[] = [];
    const swing = prepareInFlightBattingSwing(h, action, 'foul-reset:pitch3', owned => {
      preparations.push(prepareFreshPhysicalFieldFixture(h, action, owned.posture, owned.postureReference, 'foul-reset:field'));
    });
    expect(swing.commitment.calculation.effectiveValues.motor).toEqual(explicitBatterMotor);
    expect(swing.commitment.calculation.nominalRequest.source.technicalTimingOffsetTicks).toBe(0);
    expect(swing.commitment.originalIntent.attempt).toBe('ordinary_swing'); expect(swing.resolution.contact).not.toBeNull();
    expect(preparations).toHaveLength(1);
    const field = preparations[0].appendField(swing.resolution, swing.resolutionReference);
    const closed = completeSamePaFoulResetFixture(h, field, 'foul-reset');
    expect(closed.outcome.timeline.status).toMatchObject({ kind: 'active', count: { balls: 0, strikes: 2 } });
    expect(closed.resolution.timeline.status).toMatchObject({ kind: 'active', count: { balls: 1, strikes: 2 } });
  } finally { h.close(); }
}, 1_200_000);

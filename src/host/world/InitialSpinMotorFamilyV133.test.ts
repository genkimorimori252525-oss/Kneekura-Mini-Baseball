import { expect, it } from 'vitest';
import { measuredFixture } from '../../core/world/psychology/batting/MeasuredBattingFixtures.test-support';
import { value } from '../../core/world/psychology/batting/BattingFixtures.test-support';
import { calculateObservedBattingMotorPlanV1, type BattingMotorPlanInputV1 } from '../../core/world/psychology/batting/BattingMotorPlanV1';
import { calculateObservedSpinMotorPlanV123 } from '../../core/world/psychology/batting/SpinMotorPlanV123';

/** Pure regression of the motor-selection boundary, not Native admission.
 * The legacy profile reference below is exactly the information exposed by
 * readNativeStandaloneBattingContactV123 for a course-aware practice command.
 * No synthetic contact/qualification is admitted to a Native owner here. */
it('ISM133 does not transfer an ID/version-only course-aware qualification to a measured motor with the same profile identity', () => {
  const r = measuredFixture(), s = r.source, p = s.predictions[1];
  const base: BattingMotorPlanInputV1 = { decisionTick: r.currentFrame.time.tick, aggression: .8,
    geometry: { handedness: s.handedness, centerOfMass: s.centerOfMass, batPhysical: s.batPhysical, plateZ: s.plateZ,
      strikeZone: s.strikeZone, bodyReadyTick: s.bodyReadyTick, latestMotorStartTick: s.latestMotorStartTick },
    motor: { motorLatencyTicks: s.motorLatencyTicks, technicalTimingOffsetTicks: s.technicalTimingOffsetTicks,
      maximumSweetSpotSpeedMps: s.maximumSweetSpotSpeedMps },
    repertoire: { repertoireId: s.repertoireId, repertoireVersion: s.repertoireVersion, profiles: s.profiles, sampledProfiles: s.sampledProfiles },
    forecast: { observedTick: p.observedTick, availableTick: p.availableTick, validUntilTick: p.validUntilTick, trajectory: p.trajectory } };
  const original = value(calculateObservedBattingMotorPlanV1(base));
  expect(original.status).toBe('READY');
  if (original.status !== 'READY') throw Error('explicit measured control must be executable');
  expect(original.motion.trajectory).toBeNull();
  expect(original.motion.sampledTrajectoryV1!.frames).toHaveLength(137);

  const repertoireSourceRef = { sourceId: 'synthetic-original-repertoire', sourceVersion: 'test-v1' };
  const courseOnlyRef = { profileId: s.profiles[0].profile.profileId, version: s.profiles[0].profile.version };
  // StandalonePracticeMotion.standalonePracticeSwingTrajectory always executes
  // the course-aware motor even when this original repertoire has a clip.
  // Same profile identity therefore does not prove this measured motor.
  const result = value(calculateObservedSpinMotorPlanV123({ base, atDay: 10, repertoireSourceRef,
    intent: { technique: 'BACKSPIN', selectedAtTick: base.decisionTick },
    techniques: [{ technique: 'BACKSPIN', qualificationRef: { sourceId: 'synthetic-course-only-proof', sourceVersion: 'test-v1' },
      acceptedAtDay: 9, repertoireRef: repertoireSourceRef,
      calibration: { sourceId: 'synthetic-calibration', sourceVersion: 'test-v1', status: 'MODEL_VERIFIED' },
      motorProfileRefs: [courseOnlyRef] }] }));
  expect(result.selectedIntent).toBe('NO_SPIN_TARGET');
  expect(result.selectedQualificationRef).toBeNull();
  expect(result.plan).toEqual(original);
});

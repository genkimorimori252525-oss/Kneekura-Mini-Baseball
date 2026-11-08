import { expect, it } from 'vitest';
import { measuredFixture } from '../../core/world/psychology/batting/MeasuredBattingFixtures.test-support';
import { planStandaloneMeasuredPracticeV133, registeredMeasuredMotorBindingV133 } from './StandaloneMeasuredPracticeV133';

// Pure Host contract tests. This prospective synthetic 1 cm technique target
// is not a calibrated athlete, an executed contact or a Native qualification.
const aimVersion = 'measured_bat_field_contact_aim_repertoire_v138';
const aimFamily = 'registered_measured_contact_aim_v138';
function fixture(aim: boolean) {
  const s = measuredFixture().source;
  const parameter = <T>(values: T) => ({ sourceId: 'synthetic-aim-parameter', sourceVersion: 'test-v138', careerId: 'synthetic-career',
    playerId: 'synthetic-player', personId: 'synthetic-person', personLinkSourceId: 'synthetic-link', acceptedAtDay: 1, values });
  const contactAimV138 = { version: 'measured_bat_contact_aim_v138' as const, lateralOffsetM: 0, verticalOffsetM: -.01, maximumOffsetM: .02 };
  const profiles = s.sampledProfiles!.map(p => aim ? { ...p, contactAimV138 } : p);
  const model = { repertoire: parameter({ repertoireId: s.repertoireId,
    repertoireVersion: aim ? aimVersion : 'measured_bat_field_upright_repertoire_v137', profiles: s.profiles, sampledProfiles: profiles }),
    equipment: parameter({ batPhysical: s.batPhysical, ball: s.ball }),
    capability: parameter({ motorLatencyTicks: s.motorLatencyTicks, technicalTimingOffsetTicks: 0, maximumSweetSpotSpeedMps: 50 }) };
  const profile = s.profiles[0].profile;
  const binding = registeredMeasuredMotorBindingV133(model.repertoire.values, model.equipment.values, { profileId: profile.profileId, version: profile.version });
  const command = { kind: 'BATTING_CONTACT' as const, pitchAttemptId: 'synthetic-aim-pitch',
    calibrationRef: { sourceId: 'synthetic-aim-flight', sourceVersion: 'test-v138' }, issuedTick: 0, bodyReadyTick: 0,
    profileId: profile.profileId, profileVersion: profile.version,
    measuredMotorV133: { implementationV133: binding.implementationV133, payloadHash: binding.payloadHash },
    plan: { handedness: 'R' as const, batterCenterOfMass: { x: -.8, y: .95, z: 0 },
      targetBallCenterAtPlate: { x: 0, y: .87, z: 0 }, strikeZone: { centerX: 0, halfWidth: .22, lowerY: .5, upperY: 1.8 }, contactTick: 2_000_000 },
    parameters: s.predictions[1].trajectory.parameters };
  return { model, command, binding };
}

it('MCA138 assigns the explicit aim family and pins the complete prospective target and assessment', () => {
  const f = fixture(true), old = fixture(false);
  expect(f.binding.implementationV133).toBe(aimFamily);
  expect(f.binding.payloadHash).not.toBe(old.binding.payloadHash);
  for (const [key, value] of [['verticalOffsetM', -.005], ['maximumOffsetM', .015]] as const) {
    const changed = structuredClone(f.model.repertoire.values);
    Object.assign(changed.sampledProfiles[0], { contactAimV138: { version: 'measured_bat_contact_aim_v138', lateralOffsetM: 0,
      verticalOffsetM: -.01, maximumOffsetM: .02, [key]: value } });
    expect(registeredMeasuredMotorBindingV133(changed, f.model.equipment.values, f.binding.profileRef).payloadHash).not.toBe(f.binding.payloadHash);
  }
});

it('MCA138 offsets registration once without altering raw frames, phase, velocity or the ball target', () => {
  const f = fixture(true), old = fixture(false), before = JSON.stringify(f);
  const planned = planStandaloneMeasuredPracticeV133(f.command, 1_000_000, f.model);
  const neutral = planStandaloneMeasuredPracticeV133(old.command, 1_000_000, old.model);
  expect(planned.trajectory.frames).toEqual(neutral.trajectory.frames);
  expect(planned.trajectory.transform.rotation).toEqual(neutral.trajectory.transform.rotation);
  expect(planned.trajectory.transform.translation.y).toBeCloseTo(neutral.trajectory.transform.translation.y - .01, 12);
  expect(planned.trajectory.transform.translation.x).toBe(neutral.trajectory.transform.translation.x);
  expect(planned.startTick).toBe(neutral.startTick);
  const at = planned.motion.sample(f.command.plan.contactTick), base = neutral.motion.sample(old.command.plan.contactTick);
  expect(at.sweetSpot.y).toBeCloseTo(base.sweetSpot.y - .01, 12);
  expect(at.sweetSpotVelocity).toEqual(base.sweetSpotVelocity);
  expect(f.command.plan).toEqual(old.command.plan);
  expect(JSON.stringify(f)).toBe(before);
});

it('MCA138 rejects an old-family command even with an exact new-family payload hash', () => {
  const f = fixture(true);
  expect(() => planStandaloneMeasuredPracticeV133({ ...f.command,
    measuredMotorV133: { ...f.command.measuredMotorV133, implementationV133: 'registered_measured_linear_v133' } },
  1_000_000, f.model)).toThrow(/motor|payload|implementation/);
});

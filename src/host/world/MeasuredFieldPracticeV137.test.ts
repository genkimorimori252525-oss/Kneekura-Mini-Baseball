import { expect, it } from 'vitest';
import { measuredFixture } from '../../core/world/psychology/batting/MeasuredBattingFixtures.test-support';
import { createMeasuredBatAxisReferenceV1 } from '../../core/sim/contact/MeasuredBatAxisReferenceV1';
import { rotateVectorByQuaternion } from '../../core/sim/pitching/BaseballOrientation';
import { registerMeasuredBatToFieldV1 } from '../../integration/browser/MeasuredBatFieldRegistrationV1';
import { planStandaloneMeasuredPracticeV133, registeredMeasuredMotorBindingV133 } from './StandaloneMeasuredPracticeV133';

/** Pure Host motor seam only. These synthetic declarations are never passed
 * off as Native qualifications, accepted body references or physical receipts. */
const fieldVersion = 'measured_bat_field_upright_repertoire_v137';
function fixture(version: string) {
  const s = measuredFixture().source;
  const parameter = <T>(values: T) => ({ sourceId: 'synthetic-field-parameter', sourceVersion: 'test-v137', careerId: 'synthetic-career',
    playerId: 'synthetic-player', personId: 'synthetic-person', personLinkSourceId: 'synthetic-link', acceptedAtDay: 1, values });
  const model = { repertoire: parameter({ repertoireId: s.repertoireId, repertoireVersion: version,
    profiles: s.profiles, sampledProfiles: s.sampledProfiles }), equipment: parameter({ batPhysical: s.batPhysical, ball: s.ball }),
    capability: parameter({ motorLatencyTicks: s.motorLatencyTicks, technicalTimingOffsetTicks: 0, maximumSweetSpotSpeedMps: 50 }) };
  const profile = s.profiles[0].profile;
  const binding = registeredMeasuredMotorBindingV133(model.repertoire.values, model.equipment.values, { profileId: profile.profileId, version: profile.version });
  const command = { kind: 'BATTING_CONTACT' as const, pitchAttemptId: 'synthetic-field-pitch',
    calibrationRef: { sourceId: 'synthetic-field-flight', sourceVersion: 'test-v137' }, issuedTick: 0, bodyReadyTick: 0,
    profileId: profile.profileId, profileVersion: profile.version,
    measuredMotorV133: { implementationV133: binding.implementationV133, payloadHash: binding.payloadHash },
    plan: { handedness: 'R' as const, batterCenterOfMass: { x: -.8, y: .95, z: 0 },
      targetBallCenterAtPlate: { x: 0, y: .87, z: 0 }, strikeZone: { centerX: 0, halfWidth: .22, lowerY: .5, upperY: 1.8 }, contactTick: 2_000_000 },
    parameters: s.predictions[1].trajectory.parameters };
  const clip = s.sampledProfiles![0];
  const original = createMeasuredBatAxisReferenceV1({ ...clip.measured, startTick: 0,
    ticksPerSecond: clip.measured.sourceTicksPerSecond, playbackRate: 1,
    transform: { rotation: { x: 0, y: 0, z: 0, w: 1 }, translation: { x: 0, y: 0, z: 0 }, scale: 1 } }).reference.frames;
  return { model, command, original, binding };
}

it('MFP137 uses the explicit field basis once before upright planning, preserving the raw clip and its full payload pin', () => {
  const f = fixture(fieldVersion), before = JSON.stringify(f), planned = planStandaloneMeasuredPracticeV133(f.command, 1_000_000, f.model);
  expect(planned.trajectory.frames).toEqual(registerMeasuredBatToFieldV1(f.original));
  expect(planned.trajectory.frames).toHaveLength(137);
  expect(planned.trajectory.frames.map(x => x.tick)).toEqual(f.original.map(x => x.tick));
  const up = rotateVectorByQuaternion({ x: 0, y: 1, z: 0 }, planned.trajectory.transform.rotation);
  expect(Math.hypot(up.x, up.y - 1, up.z)).toBeLessThan(1e-12);
  const contact = planned.motion.sample(f.command.plan.contactTick);
  expect(contact.state.pose.grip.x).toBeLessThan(contact.sweetSpot.x);
  expect(JSON.stringify(f)).toBe(before);
  const raw = fixture('measured_bat_axis_upright_repertoire_v2');
  expect(f.binding.payloadHash).not.toBe(raw.binding.payloadHash);
  expect(() => planStandaloneMeasuredPracticeV133({ ...f.command, measuredMotorV133: raw.command.measuredMotorV133 }, 1_000_000, f.model)).toThrow(/payload differs/);
});

it('MFP137 retains the original unreflected frames for both old registration versions', () => {
  for (const version of ['measured_bat_axis_repertoire_v1', 'measured_bat_axis_upright_repertoire_v2']) {
    const f = fixture(version), before = JSON.stringify(f), planned = planStandaloneMeasuredPracticeV133(f.command, 1_000_000, f.model);
    expect(planned.trajectory.frames).toEqual(f.original);
    expect(JSON.stringify(f)).toBe(before);
  }
});

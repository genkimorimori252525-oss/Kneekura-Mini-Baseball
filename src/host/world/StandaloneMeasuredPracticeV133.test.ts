import { expect, it } from 'vitest';
import { measuredFixture } from '../../core/world/psychology/batting/MeasuredBattingFixtures.test-support';
import { REGISTERED_MEASURED_LINEAR_V133 } from '../../core/world/psychology/batting/SpinMotorPlanV123';
import { planStandaloneMeasuredPracticeV133, registeredMeasuredMotorBindingV133 } from './StandaloneMeasuredPracticeV133';
import { standalonePracticeInput, type AcceptedStandalonePractice } from './StandalonePracticeMotion';
import { qualifySpinMotorGroupsV133 } from './SqliteSpinControlMasteryV123';
import { createMeasuredBatAxisReferenceV1 } from '../../core/sim/contact/MeasuredBatAxisReferenceV1';

/** Declared numerical inputs for pure planning/ownership-shape tests. These
 * parameter objects are never admitted as Native receipts or qualifications. */
function fixture() {
  const s = measuredFixture().source;
  const parameter = <T>(values: T) => ({ sourceId: 'synthetic-parameter', sourceVersion: 'test-v1', careerId: 'synthetic-career',
    playerId: 'synthetic-player', personId: 'synthetic-person', personLinkSourceId: 'synthetic-link', acceptedAtDay: 1, values });
  const model = { repertoire: parameter({ repertoireId: s.repertoireId, repertoireVersion: s.repertoireVersion,
    profiles: s.profiles, sampledProfiles: s.sampledProfiles }), equipment: parameter({ batPhysical: s.batPhysical, ball: s.ball }),
    capability: parameter({ motorLatencyTicks: s.motorLatencyTicks, technicalTimingOffsetTicks: 0, maximumSweetSpotSpeedMps: 50 }) };
  const profile = s.profiles[0].profile;
  const binding = registeredMeasuredMotorBindingV133(model.repertoire.values, model.equipment.values, { profileId: profile.profileId, version: profile.version });
  const command = { kind: 'BATTING_CONTACT' as const, pitchAttemptId: 'synthetic-pitch', calibrationRef: { sourceId: 'synthetic-flight', sourceVersion: 'test-v1' },
    issuedTick: 0, bodyReadyTick: 0, profileId: profile.profileId, profileVersion: profile.version,
    measuredMotorV133: { implementationV133: binding.implementationV133, payloadHash: binding.payloadHash },
    spinIntentV123: { technique: 'BACKSPIN' as const, decidedTick: 0 },
    plan: { handedness: 'R' as const, batterCenterOfMass: { x: -.8, y: .95, z: 0 },
      targetBallCenterAtPlate: { x: 0, y: .87, z: 0 }, strikeZone: { centerX: 0, halfWidth: .22, lowerY: .5, upperY: 1.8 }, contactTick: 2_000_000 },
    parameters: s.predictions[1].trajectory.parameters };
  return { model, binding, command };
}

it('MSP133 pins the full original profile, registered clip, execution mode and equipment rather than a clip name', () => {
  const f = fixture(), { model, binding } = f;
  expect(binding.implementationV133).toBe(REGISTERED_MEASURED_LINEAR_V133);
  expect(Object.isFrozen(binding)).toBe(true);
  const changed = structuredClone(model.repertoire.values);
  (changed.sampledProfiles![0].measured.frames[2].handReference as { y: number }).y += .001;
  expect(registeredMeasuredMotorBindingV133(changed, model.equipment.values, binding.profileRef).payloadHash).not.toBe(binding.payloadHash);
  const rate = structuredClone(model.repertoire.values); (rate.sampledProfiles![0] as { playbackRate: number }).playbackRate += .01;
  expect(registeredMeasuredMotorBindingV133(rate, model.equipment.values, binding.profileRef).payloadHash).not.toBe(binding.payloadHash);
  expect(registeredMeasuredMotorBindingV133({ ...model.repertoire.values, repertoireVersion: 'different-registration' }, model.equipment.values, binding.profileRef).payloadHash).not.toBe(binding.payloadHash);
  const equipment = structuredClone(model.equipment.values); (equipment.batPhysical as { massKg: number }).massKg += .01;
  expect(registeredMeasuredMotorBindingV133(model.repertoire.values, equipment, binding.profileRef).payloadHash).not.toBe(binding.payloadHash);
});

it('MSP134 executes only the explicit registered linear clip and validates its full pin before a command can be consumed', () => {
  const f = fixture(), before = JSON.stringify(f), plan = planStandaloneMeasuredPracticeV133(f.command, 1_000_000, f.model);
  const clip = f.model.repertoire.values.sampledProfiles![0];
  expect(plan.trajectory.frames).toEqual(createMeasuredBatAxisReferenceV1({ ...clip.measured, startTick: 0,
    ticksPerSecond: clip.measured.sourceTicksPerSecond, playbackRate: 1,
    transform: { rotation: { x: 0, y: 0, z: 0, w: 1 }, translation: { x: 0, y: 0, z: 0 }, scale: 1 } }).reference.frames);
  expect(plan.trajectory.frames).toHaveLength(137);
  for (const key of ['executionInterpolationV122', 'executionEnvelopeV133', 'motorRampSecondsV121', 'aimCorrectionV121', 'impactTrajectory']) expect(plan.trajectory).not.toHaveProperty(key);
  const source: AcceptedStandalonePractice = { sourceId: 'synthetic-command', sourceVersion: 'test-v133', opportunityId: 'synthetic-opportunity',
    careerId: 'synthetic-career', playerId: 'synthetic-player', personLinkSourceId: 'synthetic-link', atDay: 4,
    startTick: plan.startTick, endTick: plan.endTick, ticksPerSecond: 1_000_000, workloadRevision: 0,
    bodySourceId: 'synthetic-body', modelSourceId: 'synthetic-model', episodeId: 'synthetic-episode', episodeRevision: 1, domain: 'TECHNICAL', command: f.command };
  expect(standalonePracticeInput(source, source.sourceId)).toEqual(source);
  expect(() => planStandaloneMeasuredPracticeV133({ ...f.command, measuredMotorV133: { ...f.command.measuredMotorV133, payloadHash: '0'.repeat(64) } }, 1_000_000, f.model)).toThrow(/payload differs/);
  expect(() => standalonePracticeInput({ ...source, command: { ...f.command, measuredMotorV133: { ...f.command.measuredMotorV133, executionInterpolationV122: 'cubic-c1' } } }, source.sourceId)).toThrow(/explicit measured/);
  const { measuredMotorV133: _explicit, ...oldCommand } = f.command;
  const legacy = { ...source, command: oldCommand }, bytes = JSON.stringify(legacy);
  expect(JSON.stringify(standalonePracticeInput(legacy, source.sourceId))).toBe(bytes);
  expect(JSON.stringify(f)).toBe(before);
});

it('MSP135 cannot pool two course contacts with one measured contact or different measured payloads under one ID/version', () => {
  const { binding } = fixture(), course = { profileRef: binding.profileRef, velocityMps: { x: 0, y: 0, z: 40 }, spinRadPerSecond: { x: -200, y: 0, z: 0 }, bats: 'R' as const },
    measured = { ...course, motorBindingV133: binding };
  const assess = (contacts: (typeof course & { motorBindingV133?: typeof binding })[]) => qualifySpinMotorGroupsV133({
    technique: 'BACKSPIN', minimumIntentionalContacts: 3, minimumDirectionalSpinRadPerSecond: 100, minimumSuccessFraction: 1, contacts });
  expect(assess([course, course, course])).not.toHaveProperty('motorBindingsV133');
  expect(assess([measured, measured, measured]).motorBindingsV133).toEqual([binding]);
  expect(assess([course, course, measured]).motorQualification.qualifiedProfiles).toEqual([]);
  const other = { ...measured, motorBindingV133: { ...binding, payloadHash: '0'.repeat(64) } };
  expect(assess([measured, measured, other]).motorQualification.qualifiedProfiles).toEqual([]);
  const independent = assess([course, course, course, measured, measured, measured, other, other, other]);
  expect(independent.courseMotorProfileRefsV133).toEqual([binding.profileRef]);
  expect(independent.motorBindingsV133).toHaveLength(2);
  expect(independent.motorBindingsV133).toEqual(expect.arrayContaining([binding, other.motorBindingV133]));
  expect(assess([other, measured, course, other, measured, course, other, measured, course])).toEqual(independent);
});

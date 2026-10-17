import { expect, it } from 'vitest';
import { jointFieldSuccessorCommandInput, jointFieldCapabilityAt, type AcceptedJointFieldSuccessorCommand } from './JointFieldSuccessorCommand';

const roles = ['glove', 'tag_hand', 'body', 'left_foot', 'right_foot'] as const;
const samples = () => [
  { fatigue: 0, maximumBodySpeedMps: 10, maximumGloveSpeedMps: 12, maximumAccelerationMps2: 6 },
  { fatigue: .5, maximumBodySpeedMps: 8, maximumGloveSpeedMps: 10, maximumAccelerationMps2: 5 },
  { fatigue: 1, maximumBodySpeedMps: 6, maximumGloveSpeedMps: 8, maximumAccelerationMps2: 4 },
];
const fixture = (count = 10): AcceptedJointFieldSuccessorCommand => {
  const participantResponses = Array.from({ length: count }, (_, i) => ({ playerId: `player-${i}`,
    personHash: 'a'.repeat(64), projectedStateHash: 'b'.repeat(64), calibrationSourceId: `explicit-SI-${i}`,
    calibrationVersion: 'v1', availableAtDay: 10, fatigueSamples: samples() }));
  return { sourceId: 'finite-field-command', sourceVersion: 'test-v1', capability: 'owned_joint_field_successor_execution_v1',
    workloadViewReference: { owner: 'pa_joint_recovery_workload_v1_views', sourceId: 'cumulative-view',
      sourceHash: 'c'.repeat(64), snapshotHash: 'd'.repeat(64) },
    recoveryReference: { owner: 'pa_joint_recovery_v1_executions', sourceId: 'recovery',
      sourceHash: 'e'.repeat(64), snapshotHash: 'f'.repeat(64) },
    throughTick: 1_200_000, equipmentId: 'original-retained-bat',
    modelCalibration: { basis: 'EXPLICIT_SYNTHETIC_FINITE_FIELD_CONTROL_V1', modelId: 'rigid_actor_spheres_horizontal_acceleration_v1',
      feedback: 'ZERO_DELAY_SNAPSHOT_TEST_CONTROL', availableAtDay: 10, assessmentSourceId: 'explicit-test-model', assessmentVersion: 'v1',
      footGroundSupport: { kind: 'compliant_stationary_sole_v1', maximumCompressionMeters: .002 } },
    participantResponses,
    commands: participantResponses.flatMap(p => roles.map(role => ({ playerId: p.playerId, role, acceleration: { x: .5, y: 0, z: -.25 } }))),
    actorProfiles: [], surfaces: [], surfaceProfiles: [], baseGeometry: null };
};

it.each([10, 13])('parses %i explicit participants with five rigid primitive commands each and freezes a detached copy', count => {
  const raw = fixture(count), parsed = jointFieldSuccessorCommandInput(raw, raw.sourceId);
  expect(parsed).toEqual(raw);
  expect(parsed).not.toBe(raw);
  expect(parsed.commands).toHaveLength(count * 5);
  expect(Object.isFrozen(parsed.participantResponses[0].fatigueSamples[0])).toBe(true);
  expect(Object.isFrozen(parsed.commands[0].acceleration)).toBe(true);
  Object.assign(raw.commands[0].acceleration, { x: 2 });
  expect(parsed.commands[0].acceleration.x).toBe(.5);
  expect(parsed).not.toHaveProperty('physicalExecutionAdmitted');
});

it('rejects extra authority fields, altered command identity and foreign or malformed parent references', () => {
  const s = fixture();
  const invalid: unknown[] = [{ ...s, physicalExecutionAdmitted: true }, { ...s, sourceId: '' }, { ...s, sourceVersion: ' v1' },
    { ...s, capability: 'world_field_execution' },
    { ...s, recoveryReference: { ...s.recoveryReference, owner: 'pa_initial_joint_v1_executions' } },
    { ...s, workloadViewReference: { ...s.workloadViewReference, owner: 'pa_joint_workload_v1_views' } },
    { ...s, workloadViewReference: { ...s.workloadViewReference, sourceHash: 'wrong' } },
    { ...s, recoveryReference: { ...s.recoveryReference, extra: true } }, { ...s, equipmentId: ' ' }];
  invalid.forEach(raw => expect(() => jointFieldSuccessorCommandInput(raw)).toThrow());
  expect(() => jointFieldSuccessorCommandInput(s, 'different-id')).toThrow();
});

it.each([-1, .5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])('rejects an invalid finite throughTick %s', throughTick => {
  expect(() => jointFieldSuccessorCommandInput({ ...fixture(), throughTick })).toThrow();
});

it('requires the supported explicit test model and complete model provenance', () => {
  const s = fixture(), m = s.modelCalibration;
  for (const modelCalibration of [{ ...m, basis: 'MEASURED' }, { ...m, modelId: 'independent_glove' },
    { ...m, feedback: 'NEURAL_LATENCY_MEASURED' }, { ...m, assessmentSourceId: '' },
    { ...m, assessmentVersion: '' }, { ...m, availableAtDay: -.1 }, { ...m, extra: true }])
    expect(() => jointFieldSuccessorCommandInput({ ...s, modelCalibration })).toThrow();
});

it('requires explicit finite physical sole support calibration and preserves rigid zero calibration', () => {
  const s = fixture(), m = s.modelCalibration;
  expect(jointFieldSuccessorCommandInput(s).modelCalibration.footGroundSupport).toEqual(m.footGroundSupport);
  const rigid = { ...m.footGroundSupport, maximumCompressionMeters: 0 };
  expect(jointFieldSuccessorCommandInput({ ...s, modelCalibration: { ...m, footGroundSupport: rigid } }).modelCalibration.footGroundSupport).toEqual(rigid);
  for (const footGroundSupport of [undefined, null, { ...m.footGroundSupport, kind: 'numeric_epsilon' },
    { ...m.footGroundSupport, maximumCompressionMeters: -.001 }, { ...m.footGroundSupport, maximumCompressionMeters: Infinity },
    { ...m.footGroundSupport, maximumCompressionMeters: NaN }, { ...m.footGroundSupport, extra: true }])
    expect(() => jointFieldSuccessorCommandInput({ ...s, modelCalibration: { ...m, footGroundSupport } })).toThrow();
});

it('requires a complete unique participant population and explicit person/state/SI identities', () => {
  const s = fixture(), p = s.participantResponses[0];
  for (const raw of [fixture(9), fixture(14),
    { ...s, participantResponses: [...s.participantResponses.slice(1), s.participantResponses[1]] }])
    expect(() => jointFieldSuccessorCommandInput(raw)).toThrow();
  for (const changed of [{ ...p, personHash: 'bad' }, { ...p, projectedStateHash: 'A'.repeat(64) },
    { ...p, calibrationSourceId: '' }, { ...p, calibrationVersion: '' }, { ...p, availableAtDay: -1 },
    { ...p, playerId: '' }, { ...p, fatigueSamples: undefined }, { ...p, extra: true }])
    expect(() => jointFieldSuccessorCommandInput({ ...s, participantResponses: [changed, ...s.participantResponses.slice(1)] })).toThrow();
});

it('rejects incomplete fatigue coverage and every increasing or non-positive SI ceiling', () => {
  const s = fixture(), p = s.participantResponses[0], a = samples();
  const invalid: unknown[] = [[a[0]], Array.from({ length: 33 }, () => a[0]), [a[0], a[0], a[2]],
    [{ ...a[0], fatigue: .1 }, a[2]], [a[0], { ...a[2], fatigue: .9 }],
    [a[0], { ...a[1], fatigue: NaN }, a[2]], [a[0], { ...a[1], extra: true }, a[2]]];
  for (const key of ['maximumBodySpeedMps', 'maximumGloveSpeedMps', 'maximumAccelerationMps2'] as const)
    invalid.push([a[0], { ...a[1], [key]: 0 }, a[2]], [a[0], { ...a[1], [key]: -1 }, a[2]],
      [a[0], { ...a[1], [key]: Infinity }, a[2]], [a[0], { ...a[1], [key]: a[0][key] + 1 }, a[2]]);
  invalid.forEach(fatigueSamples => expect(() => jointFieldSuccessorCommandInput({ ...s,
    participantResponses: [{ ...p, fatigueSamples }, ...s.participantResponses.slice(1)] })).toThrow());
});

it('requires one of each role, horizontal finite acceleration, and a shared rigid acceleration per player', () => {
  const s = fixture(), c = s.commands[0];
  const changedFirst: unknown[] = [{ ...c, role: 'head' }, { ...c, acceleration: { x: 0, y: .1, z: 0 } },
    { ...c, acceleration: { x: Infinity, y: 0, z: 0 } }, { ...c, acceleration: { x: 0, z: 0 } },
    { ...c, acceleration: { ...c.acceleration, extra: 0 } }, { ...c, acceleration: { ...c.acceleration, x: 1 } }, { ...c, extra: true }];
  for (const commands of [s.commands.slice(1), [...s.commands.slice(1), s.commands[1]],
    ...changedFirst.map(changed => [changed, ...s.commands.slice(1)])])
    expect(() => jointFieldSuccessorCommandInput({ ...s, commands })).toThrow();
});

it('rejects an additional foreign player controller rather than accepting a valid subset', () => {
  const s = fixture(), foreign = roles.map(role => ({ playerId: 'foreign-player', role, acceleration: { x: 0, y: 0, z: 0 } }));
  expect(() => jointFieldSuccessorCommandInput({ ...s, commands: [...s.commands, ...foreign] })).toThrow();
});

it('interpolates each fatigue-adjusted SI ceiling without inventing league or rating modifiers', () => {
  const s = jointFieldSuccessorCommandInput(fixture()).participantResponses[0].fatigueSamples;
  expect(jointFieldCapabilityAt(s, 0)).toEqual({ maximumBodySpeedMps: 10, maximumGloveSpeedMps: 12, maximumAccelerationMps2: 6 });
  expect(jointFieldCapabilityAt(s, .25)).toEqual({ maximumBodySpeedMps: 9, maximumGloveSpeedMps: 11, maximumAccelerationMps2: 5.5 });
  expect(jointFieldCapabilityAt(s, .5)).toEqual({ maximumBodySpeedMps: 8, maximumGloveSpeedMps: 10, maximumAccelerationMps2: 5 });
  expect(jointFieldCapabilityAt(s, .75)).toEqual({ maximumBodySpeedMps: 7, maximumGloveSpeedMps: 9, maximumAccelerationMps2: 4.5 });
  expect(jointFieldCapabilityAt(s, 1)).toEqual({ maximumBodySpeedMps: 6, maximumGloveSpeedMps: 8, maximumAccelerationMps2: 4 });
  for (const fatigue of [-.01, 1.01, Infinity, NaN]) expect(() => jointFieldCapabilityAt(s, fatigue)).toThrow();
});

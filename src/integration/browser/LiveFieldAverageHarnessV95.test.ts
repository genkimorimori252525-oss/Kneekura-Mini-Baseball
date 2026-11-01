import { expect, it } from 'vitest';
import { AVERAGE_FIELD_REFERENCE_V95, AVERAGE_FIELD_PROFILE_V95, AVERAGE_FIELD_CASES_V95,
  buildAverageFieldCaseV95, runAverageFieldMatrixV95, measureSampledRunnerSprintV95,
  findHeldMultipleAdvancesV95, runAverageFieldTrialV95 } from './LiveFieldAverageHarnessV95';

it('separates observed MLB reference values from an explicitly provisional uniform SI player', () => {
  expect(AVERAGE_FIELD_REFERENCE_V95.season).toBe(2025);
  expect(AVERAGE_FIELD_REFERENCE_V95.armStrengthByPositionMph.values).toEqual({
    '1B': 78.3, '2B': 79.3, '3B': 85.6, SS: 85.7, LF: 87.1, CF: 89.6, RF: 90.5 });
  expect(AVERAGE_FIELD_REFERENCE_V95.overallArmMph.value).toBeNull();
  expect(AVERAGE_FIELD_REFERENCE_V95.homeToFirstSeconds.value).toBeNull();
  expect(AVERAGE_FIELD_REFERENCE_V95.infieldOutfieldExchangeSeconds.value).toBeNull();
  expect(AVERAGE_FIELD_PROFILE_V95.claim).toBe('UNIFORM_REFERENCE_PLAYER_WITH_PROVISIONAL_SI_NOT_MLB_VALIDATED');
  expect(AVERAGE_FIELD_PROFILE_V95.parameterBasis.throwSpeedMps.status).toBe('PROVISIONAL');
  expect(AVERAGE_FIELD_PROFILE_V95.physical.topSpeedMps).toBeCloseTo(27 * .3048, 10);
});

it('builds independent ground/fly/relay test inputs through the same uniform Host mapping without position stagger', () => {
  expect(new Set(AVERAGE_FIELD_CASES_V95.map(c => c.category))).toContain('rf_ground');
  const a = buildAverageFieldCaseV95({ caseId: 'RF_ground_pull', seed: 12345, bats: 'R', parkRadiusMeters: 105 }),
    again = buildAverageFieldCaseV95({ caseId: 'RF_ground_pull', seed: 12345, bats: 'R', parkRadiusMeters: 105 });
  expect(a.input).toEqual(again.input);
  const motor = a.input.fielders.map(f => [f.reactionSeconds, f.topSpeedMps, f.accelerationMps2,
    f.throwSpeedMps, f.transferSeconds, f.catchRetention.centerRetentionCapacityJ, f.fieldingCognition]);
  expect(motor.every(m => JSON.stringify(m) === JSON.stringify(motor[0]))).toBe(true);
  expect(a.input.fielders.every(f => f.technicalSkills === undefined)).toBe(true);
  expect(a.input.runners.every(r => r.technicalSkills === undefined)).toBe(true);
  expect(a.input.runners[0].topSpeedMps).toBe(a.input.fielders[0].topSpeedMps);
  expect(a.input.runners[0].position).toEqual({ x: .85, y: 0, z: -.2 });
  expect(a.input.field.fenceRadiusMeters).toBe(105);
  expect(buildAverageFieldCaseV95({ caseId: 'RF_ground_pull', seed: 12345, bats: 'L', parkRadiusMeters: 105 })
    .input.runners[0].position).toEqual({ x: -.85, y: 0, z: -.2 });
});

it('keeps the neutral profile unchanged when comparing a bounded global sensitivity intervention', () => {
  const args = { caseId: 'RF_ground_pull', seed: 711, bats: 'R' as const, parkRadiusMeters: 120 },
    base = buildAverageFieldCaseV95(args), perturbed = buildAverageFieldCaseV95({ ...args, variant: 'wide_throws' });
  expect(base.input.ball).toEqual(perturbed.input.ball); expect(base.input.seed).toBe(perturbed.input.seed);
  expect(base.input.fielders.every(f => f.throwDirectionStdRadians === .011)).toBe(true);
  expect(perturbed.input.fielders.every(f => f.throwDirectionStdRadians === .055)).toBe(true);
  expect(AVERAGE_FIELD_PROFILE_V95.physical.throwDirectionStdRadians).toBe(.011);
  expect(perturbed.context.purpose).toBe('PARAMETER_SENSITIVITY_NOT_MLB_CALIBRATION');
  expect(perturbed.input.runners).toEqual(base.input.runners);
});

it('pairs explicit throw errors without changing any actor ability, team instruction or other random seed', () => {
  const args = { caseId: 'second_force', seed: 2025, bats: 'L' as const, parkRadiusMeters: 120 },
    base = buildAverageFieldCaseV95(args), error = buildAverageFieldCaseV95({ ...args, variant: 'throw_yaw_right' });
  expect(error.input.fielders).toEqual(base.input.fielders); expect(error.input.runners).toEqual(base.input.runners);
  expect(error.input.ball).toEqual(base.input.ball); expect(error.input.seed).toEqual(base.input.seed);
  expect(error.input).toHaveProperty('executionPerturbationsV95', { throwErrors: [{ releaseOrdinal: 0, yawRadians: .08, pitchRadians: 0 }] });
  expect(base.input).not.toHaveProperty('executionPerturbationsV95');
  expect(error.context.purpose).toBe('PAIRED_EXECUTION_ERROR_WITH_FIXED_ABILITIES');
});

it('includes every unfinished trial in the failure denominator instead of selecting successful plays', () => {
  const report = runAverageFieldMatrixV95({ caseIds: ['RF_ground_pull'], seeds: [711, 2025],
    parks: [110], sides: ['R'], variants: ['baseline'], maxPlaySeconds: .02 });
  expect(report.denominators).toMatchObject({ planned: 2, attempted: 2, complete: 0, unfinished: 2, thrown: 0 });
  expect(report.denominators.rfGroundTrials).toBe(2);
  expect(report.trials).toHaveLength(2); expect(report.failures).toHaveLength(2);
  expect(report.structuralPass).toBe(false);
  expect(report.mlbCalibrationClaim).toBe('NOT_ESTABLISHED');
  expect(report.rfGroundOpportunityRateClaim).toBeNull();
});

it('compares a one-second observed running window rather than reporting the authored speed ceiling as a measurement', () => {
  const frames = [0, .4, .8, 1.2, 1.6].map(elapsedSeconds => ({ elapsedSeconds,
    runners: [{ runnerId: 'r', position: { x: elapsedSeconds * 3, y: 0, z: elapsedSeconds * 4 } }] }));
  expect(measureSampledRunnerSprintV95(frames, 'r').basis).toBe('READONLY_PIECEWISE_LINEAR_FRAME_PATH_ONE_SECOND_WINDOW');
  expect(measureSampledRunnerSprintV95(frames, 'r').fastestOneSecondMps).toBeCloseTo(5, 10);
  expect(measureSampledRunnerSprintV95(frames.slice(0, 2), 'r').fastestOneSecondMps).toBeNull();
});

it('requests a review when a held ball permits multiple later base touches without manufacturing an out expectation', () => {
  const facts = [{ kind: 'catch_secured' as const, elapsedSeconds: 2, tick: 2_000_000, playerId: 'RF' },
    { kind: 'runner_base_touch' as const, elapsedSeconds: 4, tick: 4_000_000, runnerId: 'r', base: 1 as const },
    { kind: 'runner_base_touch' as const, elapsedSeconds: 8, tick: 8_000_000, runnerId: 'r', base: 2 as const }];
  expect(findHeldMultipleAdvancesV95({ facts, throughSeconds: 9, overFenceAward: false })).toMatchObject([
    { kind: 'HOLDER_RETAINED_BALL_DURING_MULTIPLE_BASE_ADVANCES', playerId: 'RF', runnerId: 'r', bases: [1, 2] }]);
  expect(findHeldMultipleAdvancesV95({ facts, throughSeconds: 9, overFenceAward: true })).toEqual([]);
  expect(findHeldMultipleAdvancesV95({ facts: [...facts,
    { kind: 'throw_release' as const, elapsedSeconds: 3, tick: 3_000_000, playerId: 'RF' }],
  throughSeconds: 9, overFenceAward: false })).toEqual([]);
});

it.each([711, 2025])('covers a real RF fly catch and a surviving second-base runner (seed=%s)', seed => {
  const result = runAverageFieldTrialV95({ caseId: 'RF_caught_tag_second', seed, bats: 'R', parkRadiusMeters: 110 });
  expect(result.status).toBe('COMPLETE');
  expect(result.flyCatch).toMatchObject({ fielderId: 'def-RF' });
  expect(result.firstGroundContactTick).toBeNull();
  expect(result.finalRunners.find(r => r.runnerId === 'runner-2')).toMatchObject({ base: 2, retired: false, scored: false });
  expect(result.finalRunners.find(r => r.runnerId === 'runner-0')?.retired).toBe(true);
  expect(result.anomalies).toEqual([]); expect(result.reviewObservations).toEqual([]);
}, 30_000);

it.each([711, 2025])('holds second when a deep RF catch has no proven safe relay margin (seed=%s)', seed => {
  const result = runAverageFieldTrialV95({ caseId: 'RF_deep_caught_tag_second', seed, bats: 'R', parkRadiusMeters: 110 });
  expect(result.status).toBe('COMPLETE');
  expect(result.flyCatch).toMatchObject({ fielderId: 'def-RF' });
  expect(result.firstGroundContactTick).toBeNull();
  expect(result.finalRunners.find(r => r.runnerId === 'runner-2')).toMatchObject({ base: 2, retired: false, scored: false });
  expect(result.eventTrace.filter(f => f.kind === 'runner_base_touch' && f.runnerId === 'runner-2')
    .some(f => f.kind === 'runner_base_touch' && f.base === 3)).toBe(false);
  expect(result.runnerActions.filter(a => a.runnerId === 'runner-2')
    .some(a => a.throughBases.includes(3) || a.throughBases.includes(4))).toBe(false);
  expect(result.anomalies).toEqual([]); expect(result.reviewObservations).toEqual([]);
}, 30_000);

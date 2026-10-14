import { afterAll, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { actualLocomotionFixture } from './ActualLocomotionFixtures.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
const modules = import.meta.glob('./SamePlateAppearanceOriginalConsumerCalculation.ts');
const implementation = async () => {
  const load = modules['./SamePlateAppearanceOriginalConsumerCalculation.ts'];
  expect(load, 'ORIGINAL_CONSUMER_NATIVE_COMPOSITION_MISSING').toBeTypeOf('function');
  return (await load() as { calculateSamePaOriginalConsumerFromSqlite: (db: DatabaseSync, input: unknown) => any }).calculateSamePaOriginalConsumerFromSqlite;
};
let fixture: ReturnType<typeof actualLocomotionFixture> | undefined;
const setup = () => {
  const f = fixture ??= actualLocomotionFixture();
  const saved = f.locomotion.accept(f.locomotionSource.sourceId);
  return { ...f, saved };
};
afterAll(() => fixture?.f.close());
const read = <T>(f: ReturnType<typeof setup>, body: () => T) => withSqliteReadTransaction(f.f.db, () => withBattedWorldPhysicalReadTraversal(f.f.db, body));
/** Original-owner composition only: these source-only synthetic tests use the
 * real Native operation owners and Core calculations. They do not create a
 * dispatch calibration, prove current same-PA coverage, or qualify admission. */
it('NC01 original observation ownership feeds effective sampling without changing its nominal history', async () => {
  const calculate = await implementation(), f = setup(), original = f.observations.read(f.observationSource.sourceId)!, before = hash(original), nominal = f.observationModel;
  const input = { route: 'defender_observation', originalReference: reference('actual_field_observations', original), effectiveCalibration: nominal.source.calibration };
  const legacy = read(f, () => calculate(f.f.db, input));
  expect(legacy.calculation).toEqual(original.receipt); expect(legacy.original).toEqual(original); expect(legacy.nominal).toEqual(nominal);
  const effective = { ...nominal.source.calibration, errorParameters: { minimumDetectionQuality: 0, minimumPositionErrorMeters: 0,
    maximumPositionErrorMeters: 0, minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } };
  const value = read(f, () => calculate(f.f.db, { ...input, effectiveCalibration: effective }));
  expect(value.calculation.samples).not.toEqual(legacy.calculation.samples);
  expect(hash(value.original)).toBe(before); expect(value.nominal).toEqual(nominal);
  expect(f.observations.read(original.source.sourceId)).toEqual(original);
});
it('NC02 original delivered perception and priorities feed effective scheduling without changing the accepted decision', async () => {
  const calculate = await implementation(), f = setup(), original = f.decision, nominal = read(f, () => playerDecisionModelEvidenceFromSqlite(f.f.db).read(original.source.decisionModelSourceId)!), before = hash(original);
  const input = { route: 'defender_decision', originalReference: reference('actual_defensive_decisions', original), effectiveCalibration: nominal.source.calibration };
  const legacy = read(f, () => calculate(f.f.db, input));
  expect(legacy.calculation.scheduling).toEqual(original.receipt.scheduling);
  const effective = { ...nominal.source.calibration,
    decisionTimingParameters: { ...nominal.source.calibration.decisionTimingParameters, fixedProcessingOffsetTicks: 15 },
    firstStepTimingParameters: { ...nominal.source.calibration.firstStepTimingParameters, fixedMotorOffsetTicks: 12 } };
  const value = read(f, () => calculate(f.f.db, { ...input, effectiveCalibration: effective }));
  expect(value.calculation.scheduling.decisionTick).toBe(legacy.calculation.scheduling.decisionTick + 15);
  expect(value.calculation.scheduling.movementStartTick).toBe(legacy.calculation.scheduling.movementStartTick + 27);
  expect(hash(value.original)).toBe(before); expect(value.nominal).toEqual(nominal);
  expect(f.decisions.read(original.source.sourceId)).toEqual(original);
});
it('NC03 original issued decision and exact kinematics feed effective motion while retaining role commands', async () => {
  const calculate = await implementation(), f = setup(), original = f.saved, nominal = f.model, before = hash(original);
  const input = { route: 'defender_locomotion', originalReference: reference('actual_locomotion_receipts', original), effectiveCalibration: nominal.source.calibration };
  const legacy = read(f, () => calculate(f.f.db, input));
  const { physicalAvailability: _availability, ...receipt } = original.receipt;
  expect(legacy.calculation).toEqual(receipt);
  const effective = { ...nominal.source.calibration, accelerationRatingCalibration: { lowestAbilityAccelerationMps2: 1, highestAbilityAccelerationMps2: 3 } };
  const value = read(f, () => calculate(f.f.db, { ...input, effectiveCalibration: effective }));
  expect(value.calculation.parameters.accelerationMps2).toBe(legacy.calculation.parameters.accelerationMps2 / 2);
  expect(value.calculation.segment.acceleration).not.toEqual(legacy.calculation.segment.acceleration);
  expect(value.calculation.self).toEqual(original.receipt.self); expect(value.calculation.retainedRoles).toEqual(original.receipt.retainedRoles);
  expect(value.calculation.command.primitiveMotions).toEqual(original.receipt.command.primitiveMotions);
  expect(hash(value.original)).toBe(before); expect(value.nominal).toEqual(nominal);
});
it('NC04 original owner refs reject wrong hashes extra input context and expired read scopes', async () => {
  const calculate = await implementation(), f = setup();
  const input = { route: 'defender_locomotion', originalReference: reference('actual_locomotion_receipts', f.saved), effectiveCalibration: f.model.source.calibration };
  expect(() => calculate(f.f.db, input)).toThrow(/read-only|transaction|proof/);
  expect(() => read(f, () => calculate(f.f.db, { ...input, originalReference: { ...input.originalReference, snapshotHash: hash('foreign') } }))).toThrow(/reference|differs/);
  expect(() => read(f, () => calculate(f.f.db, { ...input, self: f.saved.receipt.self }))).toThrow(/input|fields/);
  const before = read(f, () => calculate(f.f.db, input));
  f.f.db.prepare("UPDATE actual_locomotion_receipts SET snapshot_hash=? WHERE source_id=?").run(hash('mutated'), f.saved.source.sourceId);
  try { expect(() => read(f, () => calculate(f.f.db, input))).toThrow(); }
  finally { f.f.db.prepare('UPDATE actual_locomotion_receipts SET snapshot_hash=? WHERE source_id=?').run(hash(before.original), f.saved.source.sourceId); }
});

it('NC05 a hold composition retains actual self ancestry and validates effective motion domains', async () => {
  const calculate = await implementation(), f = actualLocomotionFixture({ hold: true });
  try {
    const saved = f.locomotion.accept(f.locomotionSource.sourceId), original = { ...f, saved };
    const input = { route: 'defender_locomotion', originalReference: reference('actual_locomotion_receipts', saved), effectiveCalibration: f.model.source.calibration };
    const result = read(original, () => calculate(f.f.db, input));
    expect(result.calculation.intent.kind).toBe('hold'); expect(result.calculation.target).toBeNull();
    expect(result.calculation.self).toEqual(saved.receipt.self); expect(result.calculation.retainedRoles).toEqual(saved.receipt.retainedRoles);
    expect(result.calculation.coverageEndTick).toBe(saved.receipt.coverageEndTick);
    expect(() => read(original, () => calculate(f.f.db, { ...input, effectiveCalibration: { ...input.effectiveCalibration, maxIntegrationStepTicks: 0 } }))).toThrow();
    expect(f.locomotion.read(saved.source.sourceId)).toEqual(saved);
  } finally { f.f.close(); }
});

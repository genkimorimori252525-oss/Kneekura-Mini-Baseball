import { expect, it } from 'vitest';
import { fixture, withFixture } from './ActualLivePhysicalActivationReadPairFixtures.test-support';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const deeplyFrozen = (value: unknown): boolean => value === null || typeof value !== 'object'
  || Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);

// One existing-API RED only: removing the duplicate historical authentication
// while preserving all real checks must change the final count from two to one.
// Source-only preparation does not establish that RED has been observed.
it('authenticates target historical readiness once per owned activation with identical bytes', () => withFixture(fixture(), f => {
  const archives = f.archiveBytes(), synthetic = f.syntheticBytes();
  expect(f.reference).not.toBeNull();
  expect(f.settlement?.kind).toBe('complete');
  if (f.settlement?.kind !== 'complete') throw new Error('test requires complete original effects');
  expect(f.settlement.participants.length).toBe(10);
  expect(f.settlement.participants.every(participant => participant.applied)).toBe(true);
  expect(f.roleEffects()).toBe(10);
  f.resetCounts();
  const result = f.transaction(() => f.owned(() => {
    expect(f.db.isTransaction).toBe(true);
    expect(activeBattedWorldFieldReadFrame(f.db)).not.toBeNull();
    expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    return f.activate();
  }));
  expect(result).not.toBeNull();
  expect(deeplyFrozen(result)).toBe(true);
  expect(json(result) === json(f.reference)).toBe(true);
  expect(f.archiveBytes() === archives).toBe(true);
  expect(f.syntheticBytes() === synthetic).toBe(true);
  expect(f.db.isTransaction).toBe(false);
  expect(activeBattedWorldFieldReadFrame(f.db)).toBeNull();
  expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  const counts = f.counts();
  expect(counts.historicalCompleted).toBeGreaterThan(0);
  expect([counts.historicalEntries, counts.closureAuthentications]).toEqual([counts.historicalCompleted, counts.historicalCompleted]);
  const witness = { schema: 'actual_live_activation_read_pair_red_witness_v1', ...counts, roleEffects: f.roleEffects(),
    activationBytesMatch: json(result) === json(f.reference), archivesUnchanged: f.archiveBytes() === archives,
    syntheticInputsUnchanged: f.syntheticBytes() === synthetic };
  expect(witness.roleEffects).toBe(10);
  expect([witness.activationBytesMatch, witness.archivesUnchanged, witness.syntheticInputsUnchanged]).toEqual([true, true, true]);
  // Fixed bounded witness; contains no archive values, paths, IDs or timings.
  console.log(JSON.stringify(witness));
  expect(counts.historicalCompleted).toBe(1);
}));

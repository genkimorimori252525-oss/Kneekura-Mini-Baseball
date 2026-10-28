import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { MeasurementModel } from '../../core/world/traits/classifiers/MeasuredTraitTypes';
import type { SourceTraitPolicy } from '../../core/world/traits/sources/SourceTraitTypes';
import * as snapshots from './SqliteNativeBattingContactObservationStoreV188';
import * as inventories from './NativeBattingContactInventoryV188';
import { readNativeBattingContactTraitProjectionV189FromSqlite as read } from './NativeBattingContactTraitProjectionV189';

const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const scope = { careerId: 'synthetic-career', playerId: 'synthetic-player' };
// Explicit synthetic calibration tests integration only; it is not a production default or Native recognition proof.
const model: MeasurementModel = { modelId: 'synthetic-integration-only', version: '1', minimumEpisodes: 2, minimumDays: 1,
  windowDays: 10, maximumSourceAgeDays: 0, rule: { familyId: 'line_drive', lowerAngleDeg: 10, upperAngleDeg: 30, minimumFraction: .6 } };
const policy: SourceTraitPolicy = { policyId: 'synthetic-only', version: '1', families: [{ familyId: 'line_drive',
  modelId: model.modelId, modelVersion: model.version, minimumRecognitionEpisodes: 2, minimumRecognitionDays: 1 }] };
const request = () => ({ scope, classificationId: 'classification', projectionId: 'projection', worldRevision: 77, model, policy });
const databases: DatabaseSync[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) db.close(); });
const database = () => { const db = new Sqlite(':memory:'); databases.push(db); return db; };
function mock(days = [5, 6]) {
  const time = { season: 2032, day: days.at(-1)!, sequence: 0 };
  const source = { careerId: scope.careerId, subjectId: scope.playerId, owner: 'BATTING_CONTACT' as const,
    sourceKey: 'synthetic-integration', revision: days.length, snapshotId: 'synthetic-snapshot', time };
  const value = { boundary: 'NATIVE_REGISTERED_CONTACT_SNAPSHOT_ONLY', scope, populationCoverage: 'SUPPORTED_NATIVE_INVENTORY_AT_CAPTURE',
    source, time, captureCoverage: { inventoryHash: 'synthetic-inventory' }, receipts: [], measurements: [],
    observations: days.map((day, i) => ({ scope, episodeId: 'episode:' + i, eventId: 'event:' + i,
      time: { season: 2032, day, sequence: 0 }, exitVelocityMps: { x: -0, y: 10, z: 30 } })) } as unknown as snapshots.NativeBattingContactObservationSnapshotV188;
  const snapshot = vi.spyOn(snapshots, 'readNativeBattingContactObservationSnapshotV189FromSqlite').mockImplementation(db => {
    expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1); return value;
  });
  const inventory = vi.spyOn(inventories, 'readNativeBattingContactInventoryV188FromSqlite').mockImplementation(db => {
    expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    return { scope, inventoryHash: 'synthetic-inventory' } as inventories.NativeBattingContactInventoryV188;
  });
  return { value, snapshot, inventory };
}
it('U01 requires a captured, unchanged supported inventory before classifying', () => {
  const m = mock(), db = database();
  m.snapshot.mockReturnValueOnce(null);
  expect(read(db, request()).reasons).toEqual(['NO_REGISTERED_CONTACTS']); expect(m.inventory).not.toHaveBeenCalled();
  m.snapshot.mockReturnValueOnce({ ...m.value, captureCoverage: null, populationCoverage: 'REGISTERED_NATIVE_CONTACTS_ONLY' });
  expect(read(db, request()).reasons).toEqual(['INVENTORY_NOT_CAPTURED']); expect(m.inventory).not.toHaveBeenCalled();
  m.inventory.mockReturnValueOnce({ scope, inventoryHash: 'new-contact' } as inventories.NativeBattingContactInventoryV188);
  const stale = read(db, request()); expect(stale.reasons).toEqual(['INVENTORY_CHANGED_SINCE_CAPTURE']);
  expect(stale.classification).toBeNull(); expect(stale.projection).toBeNull();
});
it('U02 preserves insufficient evidence without fabricating an assessment or a current clock', () => {
  mock([425]); const result = read(database(), request());
  expect(result.status).toBe('UNAVAILABLE'); expect(result.reasons).toEqual(['INSUFFICIENT_EVIDENCE']);
  expect(result.classification?.assessment).toBeNull(); expect(result.classification?.episodeCount).toBe(1);
  expect(result.classification?.request.time).toEqual({ season: 2032, day: 425, sequence: 0 });
  expect(result.projection?.entries.find(x => x.familyId === 'line_drive')?.status).toBe('UNASSESSED');
  expect(result.timeSemantics).toBe('AS_OF_LATEST_REGISTERED_CONTACT');
});
it('U03 has no implicit model or policy and rejects other measured families', () => {
  mock(); const db = database();
  expect(read(db, { ...request(), model: null }).reasons).toEqual(['NO_MEASUREMENT_MODEL']);
  expect(read(db, { ...request(), policy: null }).reasons).toEqual(['NO_PROJECTION_POLICY']);
  expect(() => read(db, { ...request(), model: { ...model, rule: { familyId: 'command_instability', minimumDispersionM: .1 } } })).toThrow(/line_drive/);
});
it('U04 routes a synthetic READY classification through projection policy and detaches the result', () => {
  const m = mock(), db = database(), result = read(db, request());
  expect(result.status).toBe('READY'); expect(result.reasons).toEqual([]);
  expect(result.projection?.worldRevision).toBe(77); expect(result.projection?.entries.find(x => x.familyId === 'line_drive')?.status).toBe('PRESENT');
  expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.classification?.request.model.rule)).toBe(true);
  expect(result.classification?.request.observations).not.toBe(m.value.observations);
  // The existing classifier canonicalizes signed zero; the Native observation and its bit hash remain untouched.
  const classifiedObservation = result.classification!.request.observations[0]!;
  if (!('exitVelocityMps' in classifiedObservation)) throw new Error('expected contact observation');
  expect(Object.is(classifiedObservation.exitVelocityMps.x, 0)).toBe(true);
  expect(Object.is(m.value.observations[0]!.exitVelocityMps.x, -0)).toBe(true);
  expect(model.rule).not.toBe(result.classification?.request.model.rule);
  expect(Object.isFrozen(model)).toBe(false); expect(db.isTransaction).toBe(false); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  const changedPolicy = { ...policy, families: [{ ...policy.families[0]!, modelVersion: 'changed' }] };
  const unavailable = read(db, { ...request(), policy: changedPolicy });
  expect(unavailable.status).toBe('UNAVAILABLE'); expect(unavailable.reasons).toEqual(['MODEL_CHANGED']);
});
it('U05 preserves enclosing transaction and propagates invalid model and policy errors', () => {
  mock(); const db = database(); db.exec('BEGIN');
  expect(() => read(db, { ...request(), model: { ...model, minimumEpisodes: 1 } })).toThrow(/INVALID_INPUT/);
  expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  expect(() => read(db, { ...request(), policy: { ...policy, families: [] } })).toThrow(/MISSING_FAMILY_POLICY/);
  expect(db.isTransaction).toBe(true); db.exec('ROLLBACK');
});
it('U06 does not count unresolved producer representations within one PA as independent contacts', () => {
  const m = mock(); m.snapshot.mockReturnValue({ ...m.value, receipts: [
    { episodeId: 'same-pa', reference: { owner: 'physical_pitch_progress_actions' } },
    { episodeId: 'same-pa', reference: { owner: 'pa_initial_joint_v1_executions' } },
  ] } as unknown as snapshots.NativeBattingContactObservationSnapshotV188);
  const result = read(database(), request()); expect(result.reasons).toEqual(['UNRESOLVED_CONTACT_IDENTITY']);
  expect(result.classification).toBeNull(); expect(result.projection).toBeNull();
});
it('U07 accepts a long inventory even when most observations are outside the model window', () => {
  const m = mock(Array.from({ length: 8_000 }, (_, i) => i + 1)), result = read(database(), request());
  expect(result.status).toBe('READY'); expect(result.classification?.request.observations).toHaveLength(8_000);
  expect(result.classification?.sampleCount).toBe(10);
  expect(result.classification?.request.observations[7_999]).not.toBe(m.value.observations[7_999]);
  expect(Object.isFrozen(m.value.observations[7_999])).toBe(false);
});

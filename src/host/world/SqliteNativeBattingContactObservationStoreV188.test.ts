import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { worldCalendarDateAtDay } from '../../core/world/competition/WorldCalendarDate';
import { readSnapshot as validateTraitSourceSnapshot } from '../../core/world/traits/sources/SourceTraitValidation';
import * as calendarOwner from './NativeMeasuredContactCalendarV186';
import * as inventoryOwner from './NativeBattingContactInventoryV188';
import { createWorldBoundOriginalContactV187 } from './WorldBoundOriginalContactV187.test-support';
import { actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteNativeBattingContactObservationStoreV188 as open } from './SqliteNativeBattingContactObservationStoreV188';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const scope = { careerId: 'career-a', playerId: 'away-1' }, journal = 'world_native_batting_contact_observations_v188', head = 'world_native_batting_contact_observation_heads_v188';
const directories: string[] = [], stores: { close(): void }[] = [];
afterEach(() => {
  vi.restoreAllMocks(); while (stores.length) stores.pop()!.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(root + sep) || !basename(target).startsWith('native-observations-v188-')) throw new Error('observation cleanup escaped its directory');
    rmSync(target, { recursive: true, force: true });
  }
});
const track = <T extends { close(): void }>(value: T): T => { stores.push(value); return value; };
const path = () => { const directory = mkdtempSync(join(tmpdir(), 'native-observations-v188-')); directories.push(directory); return join(directory, 'world.sqlite'); };
const ref = (id: string) => ({ owner: 'physical_pitch_progress_actions' as const, sourceId: id, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const bits = (velocity: { x: number; y: number; z: number }, spin: { x: number; y: number; z: number }) => {
  const bytes = Buffer.alloc(48); [velocity.x, velocity.y, velocity.z, spin.x, spin.y, spin.z].forEach((value, i) => bytes.writeDoubleBE(value, i * 8));
  return createHash('sha256').update(bytes).digest('hex');
};
const frozen = (value: unknown): void => { if (value && typeof value === 'object') { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozen); } };
const expectLossless = (actual: unknown, expected: unknown): void => {
  if (!actual || typeof actual !== 'object' || !expected || typeof expected !== 'object') { expect(Object.is(actual, expected)).toBe(true); return; }
  expect(Array.isArray(actual)).toBe(Array.isArray(expected)); expect(Object.keys(actual)).toStrictEqual(Object.keys(expected));
  for (const key of Object.keys(expected)) expectLossless((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key]);
};

/** Synthetic normal-getter doubles test ledger mechanics, not Native authority. */
const mocked = () => {
  const values = new Map<string, ReturnType<typeof fact>>(), epochs = new Map<string, string>(), salts = new Map<string, string>();
  const get = vi.spyOn(calendarOwner, 'readNativeMeasuredContactCalendarV186FromSqlite').mockImplementation((db, input) => {
    expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    const edition = input.careerCalendarEditionId ?? 'formal';
    const contacts = input.contacts.references.flatMap(reference => {
      const value = values.get(reference.sourceId); return value ? [{ reference, evidence: value.evidence, measurement: value.measurement }] : [];
    });
    const calendars = contacts.map(item => {
      const value = values.get(item.reference.sourceId)!, dayOne = epochs.get(edition) ?? value.dayOne, date = worldCalendarDateAtDay(dayOne, value.day);
      return { reference: item.reference, calendar: value.unavailable ? { kind: 'DOMESTIC', status: 'UNAVAILABLE', reason: 'NO_DOMESTIC_CALENDAR_ORIGIN' }
        : { kind: 'DOMESTIC', status: 'RESOLVED_DATE', calendarDateISO: date, calendarYear: Number(date.slice(0, 4)), careerDay: value.day,
          careerDayOne: dayOne, seasonId: 'season', seasonDay: 11, gameId: value.evidence.scope.gameId, fixtureEventId: 'fixture',
          careerDayReason: null, origin: { sourceHash: salts.get(edition) ?? 'original-calendar', source: { seasonDayOne: '2032-02-19' } },
          careerCalendarSelection: { editionId: edition, careerDayOne: dayOne } } };
    });
    return { boundary: 'NATIVE_CONTACT_CALENDAR_BINDINGS_ONLY', collection: { scope: input.contacts.scope, contacts,
      requests: input.contacts.references.map(reference => ({ reference, status: values.has(reference.sourceId) ? 'CONTACT' : 'NO_CONTACT' })) },
      calendars, chronology: 'UNRESOLVED', classification: null } as never;
  });
  return { values, epochs, salts, get };
};
const fact = (id: string, day = 425, gameId = 'game', playId = 200) => {
  const velocity = { z: -0, x: 3, y: 4 }, spin = { x: -0, y: 7, z: 9 }, reference = ref(id);
  return { reference, day, dayOne: '2031-01-01', unavailable: false,
    evidence: { kind: 'native_measured_original_pitch_contact_v183', reference, source: { sourceId: id },
      actor: { binding: { ...scope, gameId, gameDay: 11, fixtureEventId: 'fixture' } }, scope: { ...scope, gameId, playId, physicalPitchSourceId: id },
      contact: { exitVelocity: velocity, exitSpin: spin }, contactEvent: { tick: 100, sequence: 5 }, progressRevision: 1 },
    measurement: { exitVelocityMps: velocity, exitSpinRadPerSecond: spin, launchAngleDeg: 53.13010235415598 } };
};
const request = (reference = ref('a'), careerCalendarEditionId = 'formal') => ({ scope, reference, careerCalendarEditionId });
const rows = (db: InstanceType<typeof DatabaseSync>) => ({ journal: db.prepare(`SELECT * FROM main.${journal} ORDER BY revision`).all(), head: db.prepare(`SELECT * FROM main.${head}`).all() });
const inventory = (references: readonly ReturnType<typeof ref>[]): inventoryOwner.NativeBattingContactInventoryV188 => {
  const producerAvailability = { physical_pitch_progress_actions: 'PRESENT', pa_physical_v1_resolutions: 'ABSENT', pa_initial_joint_v1_executions: 'ABSENT' } as const;
  return { boundary: 'NATIVE_CONTACT_INVENTORY_ONLY', scope, references, producerAvailability,
    inventoryHash: inventoryOwner.hashNativeBattingContactInventoryV188(scope, producerAvailability, references) };
};

it('NO188-N01 observes the real formal V187 contact, reopens losslessly and supplies Core-compatible source/observation fields', () => {
  const database = path(), fixture = createWorldBoundOriginalContactV187(database), store = track(open(database));
  const input = { scope: fixture.scope, reference: fixture.reference, careerCalendarEditionId: fixture.careerCalendarEditionId };
  const receipt = store.observe(input);
  expect(receipt.revision).toBe(1); expect(receipt.time).toStrictEqual({ season: 2032, day: 425, sequence: 0 });
  expect(receipt.careerDayOne).toBe('2031-01-01'); expect(receipt.measurementBitHash).toBe(bits(fixture.expectedPhysical.contact.exitVelocity, fixture.expectedPhysical.contact.exitSpin));
  expect(store.observe(input)).toStrictEqual(receipt);
  const db = track(new DatabaseSync(database)), before = rows(db), snapshot = store.readSnapshot(fixture.scope)!;
  expect(rows(db)).toStrictEqual(before); expect(snapshot.receipts).toStrictEqual([receipt]);
  expect(snapshot.boundary).toBe('NATIVE_REGISTERED_CONTACT_SNAPSHOT_ONLY'); expect(snapshot.populationCoverage).toBe('REGISTERED_NATIVE_CONTACTS_ONLY');
  expect(snapshot.source.owner).toBe('BATTING_CONTACT'); expect(snapshot.source.subjectId).toBe(fixture.scope.playerId);
  expect(snapshot.source.revision).toBe(1); expect(snapshot.source.time).toStrictEqual(receipt.time);
  expect(validateTraitSourceSnapshot(snapshot.source, 'native-source')).toStrictEqual(snapshot.source);
  expect(snapshot.observations[0]).toStrictEqual({ scope: fixture.scope, episodeId: receipt.episodeId, eventId: receipt.eventId,
    time: receipt.time, exitVelocityMps: fixture.expectedPhysical.contact.exitVelocity });
  expect(snapshot.measurements[0].measurement.exitSpinRadPerSecond).toStrictEqual(fixture.expectedPhysical.contact.exitSpin);
  expect(snapshot.measurements[0].reference).toStrictEqual(fixture.reference); expect(snapshot.classification).toBeNull(); frozen(snapshot);
  expect(String(before.journal[0].receipt_json)).not.toContain('exitVelocity');
  store.close(); const reopened = track(open(database));
  expect(reopened.observe(input)).toStrictEqual(receipt); expect(reopened.readSnapshot(fixture.scope)).toStrictEqual(snapshot);
  const captured = reopened.capture(fixture.scope, { careerCalendarEditionId: fixture.careerCalendarEditionId })!;
  expect(captured.receipts).toHaveLength(1); expect(captured.populationCoverage).toBe('SUPPORTED_NATIVE_INVENTORY_AT_CAPTURE');
  expect(captured.captureCoverage!.references).toStrictEqual([fixture.reference]);
  expectLossless(reopened.readSnapshot(fixture.scope), captured);
  reopened.close(); const afterCapture = track(open(database));
  expectLossless(afterCapture.readSnapshot(fixture.scope), captured);
});

it('NO188-M01 returns null for an empty subject without executing contact physics', () => {
  const mock = mocked(), store = track(open(path())); expect(store.readSnapshot(scope)).toBeNull(); expect(mock.get).not.toHaveBeenCalled();
});

it('NO188-M02 allocates distinct same-day acceptances while keeping one original plate appearance group', () => {
  const mock = mocked(), store = track(open(path())); mock.values.set('a', fact('a')); mock.values.set('b', fact('b'));
  const a = store.observe(request(ref('a'))); mock.get.mockClear(); const b = store.observe(request(ref('b')));
  expect(mock.get).toHaveBeenCalledTimes(1); expect([a.revision, b.revision]).toEqual([1, 2]); expect([a.time.sequence, b.time.sequence]).toEqual([0, 1]);
  expect(a.episodeId).toBe(b.episodeId); expect(a.eventId).not.toBe(b.eventId); expect(store.readSnapshot(scope)!.observations).toHaveLength(2);
});

it('NO188-M03 accepts late historical days with per-day counters while snapshot time stays at the latest registered day', () => {
  const mock = mocked(), store = track(open(path()));
  for (const [id, day] of [['a', 425], ['b', 426], ['c', 425]] as const) { mock.values.set(id, fact(id, day)); store.observe(request(ref(id))); }
  const snapshot = store.readSnapshot(scope)!;
  expect(snapshot.receipts.map(receipt => [receipt.time.day, receipt.time.sequence])).toEqual([[425, 0], [426, 0], [425, 1]]);
  expect(snapshot.time).toStrictEqual({ season: 2032, day: 426, sequence: 0 }); expect(snapshot.source.revision).toBe(3);
});

it('NO188-M04 retains an original receipt across same-epoch aliases and rejects changed ref or original proof', () => {
  const mock = mocked(), database = path(), store = track(open(database)); mock.values.set('a', fact('a'));
  const receipt = store.observe(request()), db = track(new DatabaseSync(database)), before = rows(db);
  expect(store.observe(request())).toStrictEqual(receipt); expect(store.observe(request(ref('a'), 'alias'))).toStrictEqual(receipt);
  expect(rows(db)).toStrictEqual(before);
  expect(() => store.observe(request({ ...ref('a'), snapshotHash: 'c'.repeat(64) }))).toThrow();
  mock.salts.set('formal', 'changed-original-proof'); expect(() => store.observe(request(ref('a'), 'alias'))).toThrow();
  expect(rows(db)).toStrictEqual(before);
});

it('NO188-M05 rejects another formal epoch or subject before appending', () => {
  const mock = mocked(), database = path(), store = track(open(database)), db = track(new DatabaseSync(database));
  mock.values.set('a', fact('a')); store.observe(request()); const before = rows(db);
  const other = fact('b'); other.dayOne = '2030-01-01'; mock.values.set('b', other);
  expect(() => store.observe(request(ref('b')))).toThrow(/epoch|origin/);
  other.dayOne = '2031-01-01'; other.evidence.actor.binding.playerId = 'another-player';
  expect(() => store.observe(request(ref('b')))).toThrow(/subject/); expect(rows(db)).toStrictEqual(before);
});

it.each(['NO_CONTACT', 'NO_FORMAL_CALENDAR'] as const)('NO188-M06 creates no receipt for %s', missing => {
  const mock = mocked(), database = path(), store = track(open(database)), db = track(new DatabaseSync(database));
  if (missing === 'NO_FORMAL_CALENDAR') { const value = fact('a'); value.unavailable = true; mock.values.set('a', value); }
  expect(() => store.observe(request())).toThrow(); expect(rows(db)).toStrictEqual({ journal: [], head: [] });
});

it('NO188-M07 detects signed-zero and float64 vector drift that metadata JSON would hide', () => {
  const mock = mocked(), store = track(open(path())), value = fact('a'); mock.values.set('a', value); const receipt = store.observe(request());
  expect(receipt.measurementBitHash).toBe(bits(value.measurement.exitVelocityMps, value.measurement.exitSpinRadPerSecond));
  value.measurement.exitVelocityMps.z = 0; expect(() => store.readSnapshot(scope)).toThrow(/measurement|bits/);
  value.measurement.exitVelocityMps.z = -0; value.measurement.exitVelocityMps.x = 3.000000000000001;
  expect(() => store.readSnapshot(scope)).toThrow(/measurement|bits/);
});

it.each(['receipt_json', 'receipt_hash', 'head_hash', 'delete_tail'] as const)('NO188-M08 rejects ledger corruption: %s', corruption => {
  const mock = mocked(), database = path(), store = track(open(database)), db = track(new DatabaseSync(database));
  for (const id of ['a', 'b']) { mock.values.set(id, fact(id)); store.observe(request(ref(id))); }
  if (corruption === 'receipt_json') db.prepare(`UPDATE main.${journal} SET receipt_json='{}' WHERE revision=1`).run();
  else if (corruption === 'receipt_hash') db.prepare(`UPDATE main.${journal} SET receipt_hash=? WHERE revision=1`).run('0'.repeat(64));
  else if (corruption === 'head_hash') db.prepare(`UPDATE main.${head} SET last_receipt_hash=?`).run('0'.repeat(64));
  else db.prepare(`DELETE FROM main.${journal} WHERE revision=2`).run();
  expect(() => store.readSnapshot(scope)).toThrow();
});

it('NO188-M09 captures inventory atomically when a later reference lacks a formal calendar', () => {
  const mock = mocked(), database = path(), store = track(open(database)), db = track(new DatabaseSync(database));
  mock.values.set('a', fact('a')); const invalid = fact('b'); invalid.unavailable = true; mock.values.set('b', invalid);
  vi.spyOn(inventoryOwner, 'readNativeBattingContactInventoryV188FromSqlite').mockReturnValue(inventory([ref('a'), ref('b')]));
  expect(() => store.capture(scope, { careerCalendarEditionId: 'formal' })).toThrow(); expect(rows(db)).toStrictEqual({ journal: [], head: [] });
});

it('NO188-M10 records capture coverage only at capture and never calls inventory order physical chronology', () => {
  const mock = mocked(), store = track(open(path())); for (const id of ['a', 'b', 'c']) mock.values.set(id, fact(id));
  const capturedInventory = inventory([ref('b'), ref('a')]);
  vi.spyOn(inventoryOwner, 'readNativeBattingContactInventoryV188FromSqlite').mockReturnValue(capturedInventory);
  const snapshot = store.capture(scope, { careerCalendarEditionId: 'formal' })!;
  expect(snapshot.receipts.map(receipt => receipt.reference.sourceId)).toEqual(['b', 'a']);
  expect(snapshot.populationCoverage).toBe('SUPPORTED_NATIVE_INVENTORY_AT_CAPTURE'); expect(snapshot.captureCoverage!.inventoryHash).toBe(capturedInventory.inventoryHash);
  expect(snapshot.sequenceSemantics).toBe('OWNER_ACCEPTANCE_ORDER_WITHIN_CAREER_DAY');
  store.observe(request(ref('c'))); const later = store.readSnapshot(scope)!;
  expect(later.populationCoverage).toBe('REGISTERED_NATIVE_CONTACTS_ONLY'); expect(later.captureCoverage).toStrictEqual(snapshot.captureCoverage);
});

it.each(['empty_stale_hash', 'empty_rehashed', 'duplicate', 'foreign'] as const)
('NO188-CV01 rejects a rehashed capture reference-set mutation: %s', corruption => {
  const mock = mocked(), database = path(), store = track(open(database)), db = track(new DatabaseSync(database));
  for (const id of ['a', 'b']) mock.values.set(id, fact(id));
  vi.spyOn(inventoryOwner, 'readNativeBattingContactInventoryV188FromSqlite').mockReturnValue(inventory([ref('a'), ref('b')]));
  store.capture(scope, { careerCalendarEditionId: 'formal' });
  const row = db.prepare(`SELECT capture_json FROM main.${head}`).get()!, coverage = JSON.parse(String(row.capture_json));
  coverage.references = corruption.startsWith('empty') ? [] : corruption === 'duplicate' ? [ref('a'), ref('a')] : [ref('a'), ref('foreign')];
  if (corruption !== 'empty_stale_hash') coverage.inventoryHash = inventoryOwner.hashNativeBattingContactInventoryV188(coverage.scope, coverage.producerAvailability, coverage.references);
  db.prepare(`UPDATE main.${head} SET capture_json=?,capture_hash=?`).run(actorJson(coverage), actorHash(coverage));
  expect(() => store.readSnapshot(scope)).toThrow(/capture/);
});

it('NO188-CV02 refuses partial writer inventory before appending any newly found reference', () => {
  const mock = mocked(), database = path(), store = track(open(database)), db = track(new DatabaseSync(database));
  for (const id of ['a', 'b', 'c']) mock.values.set(id, fact(id));
  store.observe(request(ref('a'))); store.observe(request(ref('b'))); const before = rows(db);
  vi.spyOn(inventoryOwner, 'readNativeBattingContactInventoryV188FromSqlite').mockReturnValue(inventory([ref('a'), ref('c')]));
  expect(() => store.capture(scope, { careerCalendarEditionId: 'formal' })).toThrow(/inventory/);
  expect(rows(db)).toStrictEqual(before);
});

it('NO188-CV03 rejects absent producer coverage even when both metadata hashes are recomputed', () => {
  const mock = mocked(), database = path(), store = track(open(database)), db = track(new DatabaseSync(database));
  mock.values.set('a', fact('a'));
  vi.spyOn(inventoryOwner, 'readNativeBattingContactInventoryV188FromSqlite').mockReturnValue(inventory([ref('a')]));
  store.capture(scope, { careerCalendarEditionId: 'formal' });
  const row = db.prepare(`SELECT capture_json FROM main.${head}`).get()!, coverage = JSON.parse(String(row.capture_json));
  coverage.producerAvailability.physical_pitch_progress_actions = 'ABSENT';
  coverage.inventoryHash = inventoryOwner.hashNativeBattingContactInventoryV188(coverage.scope, coverage.producerAvailability, coverage.references);
  db.prepare(`UPDATE main.${head} SET capture_json=?,capture_hash=?`).run(actorJson(coverage), actorHash(coverage));
  mock.get.mockClear(); expect(() => store.readSnapshot(scope)).toThrow(/producer/); expect(mock.get).not.toHaveBeenCalled();
});

it('NO188-CV04 rejects absent producer inventory before reading contact facts or appending receipts', () => {
  const mock = mocked(), database = path(), store = track(open(database)), db = track(new DatabaseSync(database));
  mock.values.set('a', fact('a'));
  const original = inventory([ref('a')]), producerAvailability = { ...original.producerAvailability, physical_pitch_progress_actions: 'ABSENT' as const };
  const invalidInventory = { ...original, producerAvailability,
    inventoryHash: inventoryOwner.hashNativeBattingContactInventoryV188(scope, producerAvailability, original.references) };
  vi.spyOn(inventoryOwner, 'readNativeBattingContactInventoryV188FromSqlite').mockReturnValue(invalidInventory);
  const before = rows(db);
  expect(() => store.capture(scope, { careerCalendarEditionId: 'formal' })).toThrow(/producer/);
  expect(mock.get).not.toHaveBeenCalled(); expect(rows(db)).toStrictEqual(before);
});

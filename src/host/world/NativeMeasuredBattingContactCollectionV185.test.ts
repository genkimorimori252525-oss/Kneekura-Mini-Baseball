import { createRequire } from 'node:module';
import { beforeEach, expect, it, vi } from 'vitest';
import { measureBattingContactVectorsV185 as measure,
  readNativeMeasuredBattingContactCollectionV185FromSqlite as read } from './NativeMeasuredBattingContactCollectionV185';

const readers = vi.hoisted(() => ({ samePa: vi.fn(), original: vi.fn(), joint: vi.fn() }));
vi.mock('./NativeMeasuredBattingContactV182', () => ({ readNativeMeasuredBattingContactV182FromSqlite: readers.samePa }));
vi.mock('./NativeMeasuredOriginalPitchContactV183', () => ({ readNativeMeasuredOriginalPitchContactV183FromSqlite: readers.original }));
vi.mock('./NativeMeasuredInitialJointContactV184', () => ({ readNativeMeasuredInitialJointContactV184FromSqlite: readers.joint }));
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const owners = ['pa_physical_v1_resolutions', 'physical_pitch_progress_actions', 'pa_initial_joint_v1_executions'] as const;
const ref = <O extends typeof owners[number]>(owner: O, sourceId: string) => ({ owner, sourceId,
  sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const subject = () => ({ careerId: 'career', playerId: 'batter' });
// Reader doubles exercise dispatch/assembly only. They are explicitly synthetic
// and do not prove Native authentication, accepted physics or a real population.
const evidence = (reference: ReturnType<typeof ref>) => {
  const contact = { tick: 100, ballCenter: { x: 0, y: 1, z: 0 }, point: { x: 0, y: 1, z: 0 },
    batPoint: { x: 0, y: 1, z: 0 }, normal: { x: 1, y: 0, z: 0 }, segmentT: 0.5,
    exitVelocity: { z: -0, x: 3, y: 4 }, exitSpin: { y: 7, z: -9, x: -0 } };
  return { kind: reference.owner === owners[0] ? 'native_measured_batting_contact_v182'
    : reference.owner === owners[1] ? 'native_measured_original_pitch_contact_v183' : 'native_measured_initial_joint_contact_v184',
  source: { sourceId: reference.sourceId, sourceVersion: 'synthetic-reader-double-only' },
  actor: { binding: { ...subject(), gameId: 'game', gameDay: 10, personId: 'person' } },
  lineage: { firstPhysicalPitchSourceId: 'shared-first-pitch' }, contact,
  contactEvent: { kind: 'BatBallContact', tick: 100, sequence: 5, payload: { countBefore: { balls: 0, strikes: 0 }, contact } },
  scope: { careerId: 'career', gameId: 'game', playId: 1, physicalPitchSourceId: 'shared-physical-pitch' },
  ...(reference.owner === owners[0] ? { resolutionReference: reference, resolutionEvaluationTick: 100 }
    : { reference }),
  ...(reference.owner === owners[2] ? { contactMoment: { originTick: 100, elapsedSeconds: 0.00000025,
    ball: { tick: 100, position: { x: 0, y: 1, z: 0 }, velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
    rigidContact: { tick: 100, exitVelocity: contact.exitVelocity, exitSpin: contact.exitSpin } } : {}) };
};
const frozen = (value: unknown): void => {
  if (!value || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozen);
};
beforeEach(() => { vi.resetAllMocks(); readers.samePa.mockReturnValue(null); readers.original.mockReturnValue(null); readers.joint.mockReturnValue(null); });

it('CC185-S01 measures original vector units and vertical launch angle while retaining negative zero without Native authority', () => {
  const input = { exitVelocity: { z: -0, x: 3, y: 4 }, exitSpin: { y: 7, z: -9, x: -0 } }, result = measure(input);
  expect(result.exitVelocityMps).toStrictEqual(input.exitVelocity); expect(result.exitSpinRadPerSecond).toStrictEqual(input.exitSpin);
  expect(result.launchAngleDeg).toBe(53.13010235415598);
  expect(measure({ ...input, exitVelocity: { x: 3, y: -0, z: 4 } }).launchAngleDeg).toBe(-0);
  expect(measure({ ...input, exitVelocity: { x: 0, y: 2, z: 0 } }).launchAngleDeg).toBe(90);
  expect(result.exitVelocityMps).not.toBe(input.exitVelocity); expect(Object.keys(result.exitVelocityMps)).toEqual(['z', 'x', 'y']);
  frozen(result); input.exitVelocity.x = 999; expect(result.exitVelocityMps.x).toBe(3);
});

it('CC185-C01 dispatches all owners in one Native snapshot, reads exact duplicates once and retains request order and separate raw references', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const a = ref(owners[0], 'same-pa-a'), original = ref(owners[1], 'original'), joint = ref(owners[2], 'joint'),
      b = ref(owners[0], 'same-pa-b'), none = ref(owners[0], 'none');
    const raw = new Map([a, original, joint, b].map(reference => [reference.sourceId, evidence(reference)]));
    const seen: { db: unknown; transaction: boolean; queryOnly: unknown }[] = [];
    const get = (connection: InstanceType<typeof DatabaseSync>, reference: typeof a) => {
      seen.push({ db: connection, transaction: connection.isTransaction, queryOnly: connection.prepare('PRAGMA query_only').get()!.query_only });
      return raw.get(reference.sourceId) ?? null;
    };
    readers.samePa.mockImplementation(get); readers.original.mockImplementation(get); readers.joint.mockImplementation(get);
    const duplicate = { snapshotHash: a.snapshotHash, sourceId: a.sourceId, owner: a.owner, sourceHash: a.sourceHash };
    const input = { scope: subject(), references: [a, original, joint, b, none, duplicate, { ...none }] }, before = structuredClone(input);
    const result = read(db, input);
    expect(result.boundary).toBe('NATIVE_RAW_CONTACT_COLLECTION_ONLY'); expect(result.populationCompleteness).toBe('EXPLICIT_REFERENCES_ONLY');
    expect(result.contactIdentityResolution).toBe('OWNER_REFERENCE_ONLY'); expect(result.chronology).toBe('UNRESOLVED'); expect(result.classification).toBeNull();
    expect(result.contacts).toHaveLength(4);
    expect(result.contacts.map(item => item.reference.sourceId)).toEqual(['same-pa-a', 'original', 'joint', 'same-pa-b']);
    expect(result.requests.map(item => [item.status, item.contactIndex])).toEqual([
      ['CONTACT', 0], ['CONTACT', 1], ['CONTACT', 2], ['CONTACT', 3], ['NO_CONTACT', null], ['CONTACT', 0], ['NO_CONTACT', null] ]);
    expect(result.requests.map(item => item.reference)).toStrictEqual(before.references);
    expect(readers.samePa).toHaveBeenCalledTimes(3); expect(readers.original).toHaveBeenCalledTimes(1); expect(readers.joint).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(5); expect(seen.every(item => item.db === db && item.transaction && item.queryOnly === 1)).toBe(true);
    expect(result.contacts[0].measurement.exitVelocityMps).toStrictEqual({ z: -0, x: 3, y: 4 });
    expect(result.contacts[0].measurement.exitSpinRadPerSecond).toStrictEqual({ y: 7, z: -9, x: -0 });
    expect(result.contacts[0].measurement.launchAngleDeg).toBe(53.13010235415598);
    expect(result.contacts[2].evidence).toStrictEqual(raw.get('joint'));
    expect(Object.keys(result.contacts[0].evidence.contact.exitVelocity)).toEqual(['z', 'x', 'y']);
    expect(result.contacts[0].evidence.contactEvent).toStrictEqual(result.contacts[1].evidence.contactEvent);
    expect(result.contacts[0].evidence.contactEvent).toStrictEqual(result.contacts[3].evidence.contactEvent);
    frozen(result); expect(input).toStrictEqual(before); expect(Object.isFrozen(input)).toBe(false);
    expect(result.contacts[0].evidence).not.toBe(raw.get('same-pa-a')); expect(result.scope).not.toBe(input.scope);
    raw.get('same-pa-a')!.contact.exitVelocity.x = 999; input.scope.playerId = 'changed'; a.snapshotHash = '0'.repeat(64);
    expect(result.contacts[0].measurement.exitVelocityMps.x).toBe(3); expect(result.contacts[0].evidence.contact.exitVelocity.x).toBe(3);
    expect(result.scope.playerId).toBe('batter'); expect(result.requests[0].reference.snapshotHash).toBe('b'.repeat(64));
    expect(db.isTransaction).toBe(false); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(0);
  } finally { db.close(); }
});

it.each(['sourceHash', 'snapshotHash'] as const)('CC185-C02 rejects conflicting %s for one owner/source identity before reading', field => {
  const db = new DatabaseSync(':memory:');
  try {
    const a = ref(owners[0], 'same-id'), conflict = { ...a, [field]: 'c'.repeat(64) };
    expect(() => read(db, { scope: subject(), references: [a, conflict] })).toThrow(/conflicting/);
    expect(Object.values(readers).every(reader => reader.mock.calls.length === 0)).toBe(true);
  } finally { db.close(); }
});

it('CC185-C03 rejects unknown owners, malformed fullrefs and malformed subject scope at the input boundary', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const a = ref(owners[0], 'a'), valid = { scope: subject(), references: [a] };
    for (const invalid of [{ ...valid, references: [{ ...a, owner: 'pa_initial_joint_v1_rights' }] },
      { ...valid, references: [{ ...a, sourceHash: 'bad' }] }, { ...valid, references: [{ ...a, cachedProof: {} }] },
      { ...valid, scope: { careerId: '', playerId: 'batter' } }, { ...valid, scope: { ...subject(), atDay: 10 } },
      { ...valid, references: 'all' }]) expect(() => read(db, invalid as typeof valid)).toThrow();
    expect(Object.values(readers).every(reader => reader.mock.calls.length === 0)).toBe(true);
  } finally { db.close(); }
});

it.each(['careerId', 'playerId'] as const)('CC185-C04 rejects a contact belonging to another subject %s', field => {
  const db = new DatabaseSync(':memory:');
  try {
    const a = ref(owners[0], 'foreign'), value = evidence(a); value.actor.binding[field] = 'other'; readers.samePa.mockReturnValue(value);
    expect(() => read(db, { scope: subject(), references: [a] })).toThrow(/subject/);
    expect(db.isTransaction).toBe(false); expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(0);
  } finally { db.close(); }
});

import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import { createWorldBoundOriginalContactV187 } from './WorldBoundOriginalContactV187.test-support';
import { readNativeMeasuredContactCalendarV186FromSqlite as read } from './NativeMeasuredContactCalendarV186';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const frozen = (value: unknown): void => { if (value && typeof value === 'object') { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozen); } };
it('V187-N01 joins a generated formal leap-day fixture to its actual original contact before resolving career time', () => {
  const directory = mkdtempSync(join(tmpdir(), 'world-bound-contact-v187-')), path = join(directory, 'world.sqlite');
  let db: InstanceType<typeof DatabaseSync> | undefined;
  try {
    const fixture = createWorldBoundOriginalContactV187(path);
    expect(fixture.expectedCalendar).toStrictEqual({ seasonDay: 11, calendarDateISO: '2032-02-29', careerDay: 425, careerDayOne: '2031-01-01' });
    expect(fixture.expectedPhysical.actor.binding.gameId).not.toBe('game-1');
    expect(fixture.expectedPhysical.actor.binding.gameDay).toBe(11);
    expect(fixture.expectedPhysical.source.gameId).toBe(fixture.expectedPhysical.actor.binding.gameId);
    expect(fixture.fixtureAuthority.normalAiProven).toBe(false);
    db = new DatabaseSync(path);
    const input = { contacts: { scope: fixture.scope, references: [fixture.reference, { ...fixture.reference }] },
      careerCalendarEditionId: fixture.careerCalendarEditionId }, originalInput = structuredClone(input);
    const state = () => ({ transaction: db!.isTransaction, queryOnly: db!.prepare('PRAGMA query_only').get()!.query_only,
      changes: db!.prepare('SELECT total_changes() n').get()!.n, schema: db!.prepare('PRAGMA main.schema_version').get()!.schema_version });
    db.setAuthorizer((code, table) => code === constants.SQLITE_DELETE && table === 'physical_pitch_progress_actions' ? constants.SQLITE_DENY : constants.SQLITE_OK);
    db.exec('BEGIN'); db.exec('SAVEPOINT formal_contact_caller');
    const before = state(), first = read(db, input), measured = first.collection.contacts[0].evidence;
    expect(state()).toStrictEqual(before); expect(input).toStrictEqual(originalInput);
    expect(first.collection.contacts).toHaveLength(1); expect(first.collection.requests).toHaveLength(2);
    expect({ source: measured.source, actor: measured.actor, contactEvent: measured.contactEvent, contact: measured.contact,
      progressRevision: 'progressRevision' in measured ? measured.progressRevision : null, scope: measured.scope }).toStrictEqual(fixture.expectedPhysical);
    const calendar = first.calendars[0].calendar;
    if (calendar.kind !== 'DOMESTIC' || calendar.status !== 'RESOLVED_DATE') throw new Error('formal original contact lacks its Domestic calendar proof');
    expect(calendar.origin).toStrictEqual(fixture.calendarOrigin);
    expect(calendar.careerCalendarSelection).toStrictEqual(fixture.careerCalendarSelection);
    expect({ seasonDay: calendar.seasonDay, calendarDateISO: calendar.calendarDateISO,
      careerDay: calendar.careerDay, careerDayOne: calendar.careerDayOne }).toStrictEqual(fixture.expectedCalendar);
    expect(calendar.careerDay).not.toBe(measured.actor.binding.gameDay);
    expect(calendar.gameId).toBe(measured.actor.binding.gameId); expect(calendar.fixtureEventId).toBe(measured.actor.binding.fixtureEventId);
    expect(first.chronology).toBe('UNRESOLVED'); expect(first.classification).toBeNull(); frozen(first);
    db.exec('PRAGMA query_only=1'); const q1 = state(), second = read(db, input);
    expect(second).toStrictEqual(first); expect(second).not.toBe(first); expect(second.collection.contacts[0].evidence).not.toBe(measured);
    expect(state()).toStrictEqual(q1); frozen(second);
    expect(() => db!.prepare('DELETE FROM main.physical_pitch_progress_actions WHERE 0')).toThrow(/authorized/i);
    const wrongRef = { ...input, contacts: { ...input.contacts,
      references: input.contacts.references.map(reference => ({ ...reference, snapshotHash: '0'.repeat(64) })) } };
    expect(() => read(db!, wrongRef)).toThrow();
    expect(() => read(db!, { ...input, careerCalendarEditionId: 'opaque-unaccepted-calendar' })).toThrow(/selection/);
    const wrongEpoch = { ...input, careerDayOne: '2032-02-19' };
    expect(() => read(db!, wrongEpoch)).toThrow(/calendar request/);
    db.exec('RELEASE formal_contact_caller'); db.exec('ROLLBACK'); db.setAuthorizer(null); db.close(); db = undefined;
    db = new DatabaseSync(path);
    expect(read(db, input)).toStrictEqual(first);
    // Fault injection is uncommitted and rolled back; it is never fixture data.
    db.exec('BEGIN');
    db.prepare("UPDATE main.world_national_selections SET request_json=json_set(request_json,'$.careerDayOne',?) WHERE career_id=? AND edition_id=?")
      .run('2032-01-01', fixture.scope.careerId, fixture.careerCalendarEditionId);
    db.exec('PRAGMA query_only=1'); expect(() => read(db!, input)).toThrow(/corrupt national selection/);
    db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0');
    expect(read(db, input)).toStrictEqual(first);
  } finally {
    if (db) { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
    const root = realpathSync(tmpdir()), target = realpathSync(directory);
    if (!target.startsWith(root + sep) || !basename(target).startsWith('world-bound-contact-v187-')) throw new Error('V187 cleanup target escaped its directory');
    rmSync(target, { recursive: true, force: true });
  }
});

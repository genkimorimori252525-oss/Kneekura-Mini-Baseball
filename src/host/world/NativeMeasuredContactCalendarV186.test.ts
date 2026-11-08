import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as collectionOwner from './NativeMeasuredBattingContactCollectionV185';
import * as domesticOwner from './SqliteDomesticScheduleStore';
import * as cycleOwner from './SqliteWorldCompetitionCycleStore';
import * as selectionOwner from './SqliteNationalCompetitionSelectionStore';
import * as nationalOwner from './NationalMatchOriginFromSqlite';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readNativeMeasuredContactCalendarV186FromSqlite as read } from './NativeMeasuredContactCalendarV186';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const subject = { careerId: 'career', playerId: 'batter' };
const reference = (sourceId = 'contact') => ({ owner: 'pa_initial_joint_v1_executions' as const, sourceId, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
// All owner doubles below are synthetic orchestration data, not Native proofs,
// normal AI, accepted physics, calendar ownership or a natural population.
const contact = (gameDay: number, editionId = 'domestic', sourceId = 'contact', national = false) => {
  const ref = reference(sourceId), binding = { ...subject, gameId: 'game-' + sourceId, competitionEditionId: editionId, gameDay,
    fixtureEventId: 'fixture-' + sourceId, clubId: 'club', side: 'AWAY', personId: 'person', personLinkSourceId: 'link', rosterRevision: 0,
    ...(national ? { nationalRegistrationEventId: 'registration', nationalRosterSnapshotId: 'roster' } : {}) };
  return { reference: ref, evidence: { kind: 'native_measured_initial_joint_contact_v184', actor: { binding },
    contact: { exitVelocity: { z: -0, x: 3, y: 4 }, exitSpin: { x: -0, y: 7, z: 9 } },
    contactMoment: { originTick: 100, elapsedSeconds: 0.00000025, ball: { tick: 100 } } },
  measurement: { exitVelocityMps: { z: -0, x: 3, y: 4 }, exitSpinRadPerSecond: { x: -0, y: 7, z: 9 }, launchAngleDeg: 53.13010235415598 } };
};
const collection = (contacts = [contact(2)]) => ({ boundary: 'NATIVE_RAW_CONTACT_COLLECTION_ONLY', populationCompleteness: 'EXPLICIT_REFERENCES_ONLY',
  contactIdentityResolution: 'OWNER_REFERENCE_ONLY', chronology: 'UNRESOLVED', classification: null, scope: { ...subject }, contacts,
  requests: contacts.map((item, i) => ({ reference: item.reference, status: 'CONTACT', contactIndex: i })) });
const origin = (seasonDayOne = '2032-02-28') => ({ kind: 'world_bound_domestic_calendar_origin_v186', careerId: 'career', seasonId: 'domestic',
  source: { cycleOrdinal: 0, leagueRegion: 'ASIA_PACIFIC', seasonDayOne, generatorInput: { seasonId: 'domestic' } },
  sourceHash: 'c'.repeat(64), baseScheduleHash: 'd'.repeat(64), calendarPolicyVersion: 'world-v1', worldWindowSnapshotId: 'world-window' });
const selection = (editionId = 'national', careerDayOne = '2031-01-01'): selectionOwner.NationalCompetitionSelection => ({ editionId, careerDayOne,
  cycleOrdinal: 0, kind: 'WBC', calendarYear: 2032, calendarPolicyVersion: 'world-v1', calendarWindow: { startsOnDay: 400, endsOnDay: 450 },
  qualificationCutoff: { snapshotId: 'cutoff', day: 300 } });
const nationalOrigin = (item: ReturnType<typeof contact>, selected: selectionOwner.NationalCompetitionSelection) => {
  const binding = item.evidence.actor.binding;
  return { source: { sourceId: 'national-origin', sourceVersion: 'national-match-origin-v1', careerId: binding.careerId,
    editionId: binding.competitionEditionId, gameId: binding.gameId }, fixture: { careerId: binding.careerId,
    competitionEditionId: binding.competitionEditionId, gameDay: binding.gameDay, fixtureEventId: binding.fixtureEventId,
    selectionHash: actorHash(selected) }, participants: [{ binding }] };
};
const frozen = (value: unknown): void => { if (value && typeof value === 'object') { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozen); } };
let db: InstanceType<typeof DatabaseSync>;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  vi.spyOn(collectionOwner, 'readNativeMeasuredBattingContactCollectionV185FromSqlite').mockReturnValue(collection() as never);
  vi.spyOn(domesticOwner, 'readDomesticCalendarOriginFromSqlite').mockReturnValue(origin() as never);
  vi.spyOn(cycleOwner, 'worldCompetitionCycleEvidenceFromSqlite').mockReturnValue({ readCycle: vi.fn() });
  vi.spyOn(selectionOwner, 'nationalCompetitionSelectionEvidenceFromSqlite').mockReturnValue({ readSelection: vi.fn().mockReturnValue(null),
    readWbcPredecessors: vi.fn(), authority: vi.fn() });
  vi.spyOn(nationalOwner, 'assertNationalMatchBindings').mockReturnValue(null);
});
afterEach(() => { vi.restoreAllMocks(); db.close(); });
const input = () => ({ contacts: { scope: { ...subject }, references: [reference()] } });

it.each([['2032-02-28', 2, '2032-02-29', 2032], ['2031-12-31', 2, '2032-01-01', 2032], ['2032-01-01', 0, '2031-12-31', 2031]] as const)
('CC186-C01 binds a Domestic origin %s day %s without inventing a career epoch', (dayOne, gameDay, date, year) => {
  vi.mocked(collectionOwner.readNativeMeasuredBattingContactCollectionV185FromSqlite).mockReturnValue(collection([contact(gameDay)]) as never);
  vi.mocked(domesticOwner.readDomesticCalendarOriginFromSqlite).mockImplementation((connection, career, season) => {
    expect(connection).toBe(db); expect(connection.isTransaction).toBe(true); expect(connection.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect([career, season]).toEqual(['career', 'domestic']); return origin(dayOne) as never;
  });
  const result = read(db, input());
  expect(result.calendars[0].calendar).toMatchObject({ kind: 'DOMESTIC', status: 'RESOLVED_DATE', calendarDateISO: date, calendarYear: year,
    seasonId: 'domestic', seasonDay: gameDay, gameId: 'game-contact', fixtureEventId: 'fixture-contact', careerDay: null,
    careerDayOne: null, careerDayReason: 'NO_EXPLICIT_CAREER_CALENDAR_SELECTION', origin: origin(dayOne) });
  expect(result.boundary).toBe('NATIVE_CONTACT_CALENDAR_BINDINGS_ONLY'); expect(result.chronology).toBe('UNRESOLVED'); expect(result.classification).toBeNull();
  expect(selectionOwner.nationalCompetitionSelectionEvidenceFromSqlite).not.toHaveBeenCalled();
  expect(db.isTransaction).toBe(false); expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(0);
});

it('CC186-C02 resolves career day only through the explicitly selected formal National calendar', () => {
  const selected = selection('career-calendar'), readSelection = vi.fn().mockReturnValue(selected);
  vi.mocked(selectionOwner.nationalCompetitionSelectionEvidenceFromSqlite).mockReturnValue({ readSelection, readWbcPredecessors: vi.fn(), authority: vi.fn() });
  const result = read(db, { ...input(), careerCalendarEditionId: 'career-calendar' });
  expect(readSelection).toHaveBeenCalledWith('career', 'career-calendar');
  expect(result.calendars[0].calendar).toMatchObject({ calendarDateISO: '2032-02-29', careerDay: 425, careerDayOne: '2031-01-01',
    careerDayReason: null, careerCalendarSelection: selected });
});

it('CC186-C03 preserves a missing Domestic origin as unavailable rather than deriving a date from another calendar', () => {
  vi.mocked(domesticOwner.readDomesticCalendarOriginFromSqlite).mockReturnValue(null);
  const result = read(db, input());
  expect(result.calendars[0].calendar).toMatchObject({ kind: 'DOMESTIC', status: 'UNAVAILABLE', reason: 'NO_DOMESTIC_CALENDAR_ORIGIN',
    calendarDateISO: null, calendarYear: null, seasonDay: 2, careerDay: null, careerDayOne: null });
});

it('CC186-C04 authenticates the National selection hash and raw career-day binding before converting its date', () => {
  const item = contact(425, 'national', 'national-contact', true), selected = selection(), rawOrigin = nationalOrigin(item, selected);
  vi.mocked(collectionOwner.readNativeMeasuredBattingContactCollectionV185FromSqlite).mockReturnValue(collection([item]) as never);
  vi.mocked(nationalOwner.assertNationalMatchBindings).mockReturnValue(rawOrigin as never);
  const readSelection = vi.fn().mockReturnValue(selected);
  vi.mocked(selectionOwner.nationalCompetitionSelectionEvidenceFromSqlite).mockReturnValue({ readSelection, readWbcPredecessors: vi.fn(), authority: vi.fn() });
  const result = read(db, input());
  expect(nationalOwner.assertNationalMatchBindings).toHaveBeenCalledWith(db, [item.evidence.actor.binding]);
  expect(readSelection).toHaveBeenCalledWith('career', 'national');
  expect(domesticOwner.readDomesticCalendarOriginFromSqlite).not.toHaveBeenCalled();
  expect(result.calendars[0].calendar).toMatchObject({ kind: 'NATIONAL', status: 'RESOLVED_DATE', calendarDateISO: '2032-02-29',
    calendarYear: 2032, editionId: 'national', careerDay: 425, careerDayOne: '2031-01-01', nationalOrigin: rawOrigin, selection: selected });
});

it.each(['missing', 'hash', 'scope', 'edition', 'mixed_origin'] as const)('CC186-C05 refuses missing or inconsistent National provenance: %s', fault => {
  const item = contact(425, 'national', 'national-contact', true), selected = selection(), rawOrigin = nationalOrigin(item, selected);
  vi.mocked(collectionOwner.readNativeMeasuredBattingContactCollectionV185FromSqlite).mockReturnValue(collection([item]) as never);
  if (fault === 'hash') rawOrigin.fixture.selectionHash = '0'.repeat(64);
  if (fault === 'scope') rawOrigin.source.gameId = 'another-game';
  vi.mocked(nationalOwner.assertNationalMatchBindings).mockReturnValue(fault === 'missing' ? null : rawOrigin as never);
  const readSelection = vi.fn((_career: string, edition: string) => fault === 'edition' ? { ...selected, editionId: 'another-edition' }
    : edition === 'career-calendar' ? selection(edition, '2030-01-01') : selected);
  vi.mocked(selectionOwner.nationalCompetitionSelectionEvidenceFromSqlite).mockReturnValue({ readSelection, readWbcPredecessors: vi.fn(), authority: vi.fn() });
  expect(() => read(db, { ...input(), ...(fault === 'mixed_origin' ? { careerCalendarEditionId: 'career-calendar' } : {}) })).toThrow();
  expect(db.isTransaction).toBe(false);
});

it('CC186-C06 rejects a requested but missing formal career calendar even with no contact dates to resolve', () => {
  vi.mocked(collectionOwner.readNativeMeasuredBattingContactCollectionV185FromSqlite).mockReturnValue(collection([]) as never);
  expect(() => read(db, { ...input(), careerCalendarEditionId: 'missing' })).toThrow(/selection/);
});

it('CC186-C07 keeps all original evidence and request order, sub-ticks and negative zero detached and deeply frozen', () => {
  const raw = collection([contact(2), contact(0, 'domestic', 'earlier')]), inputValue = input(), originalInput = structuredClone(inputValue), rawOrigin = origin();
  raw.requests.push({ reference: reference('no-contact'), status: 'NO_CONTACT', contactIndex: null } as never);
  vi.mocked(collectionOwner.readNativeMeasuredBattingContactCollectionV185FromSqlite).mockReturnValue(raw as never);
  vi.mocked(domesticOwner.readDomesticCalendarOriginFromSqlite).mockReturnValue(rawOrigin as never);
  const result = read(db, inputValue);
  expect(result.collection).toStrictEqual(raw); expect(result.collection).not.toBe(raw);
  expect(result.calendars.map(item => item.reference)).toStrictEqual(raw.contacts.map(item => item.reference));
  expect(result.calendars.map(item => item.calendar.calendarDateISO)).toEqual(['2032-02-29', '2032-02-27']);
  expect(result.chronology).toBe('UNRESOLVED'); frozen(result);
  expect(Object.is(result.collection.contacts[0].evidence.contact.exitVelocity.z, -0)).toBe(true);
  expect(Object.keys(result.collection.contacts[0].evidence.contact.exitVelocity)).toEqual(['z', 'x', 'y']);
  expect(inputValue).toStrictEqual(originalInput);
  raw.contacts[0].evidence.contactMoment.elapsedSeconds = 999; rawOrigin.source.seasonDayOne = '2000-01-01';
  expect((result.collection.contacts[0].evidence as { contactMoment: { elapsedSeconds: number } }).contactMoment.elapsedSeconds).toBe(0.00000025);
  expect(result.collection.contacts[0].evidence).not.toBe(raw.contacts[0].evidence);
});

import { expect, it } from 'vitest';
import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { applyTwo } from './OfficialParticipationPlayFixtures.test-support';
import { createRequire } from 'node:module';

it('accepts actual Native callups without changing Club roster and replays after reopening', () => {
  const f = nationalCallupFixture();
  let store: ReturnType<typeof openSqliteNationalCallupStore> | undefined;
  try {
    store = openSqliteNationalCallupStore(f.path, f.sources);
    const before = f.roster.readHead('career-a', 'club-a')!.roster;
    const accepted = store.register(f.request());
    expect(accepted.decision).toMatchObject({ accepted: true, registrationStatus: 'ACTIVE', clubMustRelease: true });
    expect(store.register(f.request())).toEqual(accepted);
    expect(store.readActiveRoster('career-a', 'wbc-2032', 'JP', 419)).toEqual([]);
    expect(store.readActiveRoster('career-a', 'wbc-2032', 'JP', 420)).toEqual([accepted]);
    expect(f.roster.readHead('career-a', 'club-a')!.roster).toEqual(before);
    store.close(); store = openSqliteNationalCallupStore(f.path, f.sources);
    expect(store.readRegistration('career-a', 'call-0')).toEqual(accepted);
    expect(store.readRepresentation('career-a', 'p0', 420)).toEqual([{ editionId: 'wbc-2032', nationId: 'JP',
      registeredAtDay: 420, seniorOfficialAppearanceDay: null, evidenceId: accepted.snapshotId }]);
  } finally { store?.close(); f.close(); }
});

it('enforces consent, exact policy, capacity, identity and one representative without changing global roster', () => {
  const f = nationalCallupFixture(), store = openSqliteNationalCallupStore(f.path, f.sources);
  try {
    const declinedInput = { ...f.request(1), response: { decision: 'DECLINE' as const, reason: 'PERSONAL' as const, evidenceId: 'decline-1' } };
    expect(store.register(declinedInput).decision.registrationStatus).toBe('DECLINED');
    expect(store.readRepresentation('career-a', 'p1', 420)).toEqual([]);
    const accepted = store.register(f.request());
    expect(accepted.releaseClubId).toBe('club-a');
    expect(() => store.register(f.request(2))).toThrow('MEDICALLY_UNAVAILABLE');
    expect(() => store.register({ ...f.request(1), eventId: 'accept-1' })).toThrow('ROSTER_LIMIT');
    expect(() => store.register({ ...f.request(), eventId: 'second-nation', nationId: 'KR',
      response: { decision: 'ACCEPT', reason: null, evidenceId: 'switch' } })).toThrow('already registered');
    expect(() => store.register({ ...f.request(3), personId: 'forged' })).toThrow('accepted identity');
    expect(() => store.register({ ...f.request(3), callupPolicy: { ...f.request().callupPolicy, rosterLimit: 2 } })).toThrow('frozen differently');
    expect(() => store.register({ ...f.request(3), eligibilityPolicy: { ...f.request().eligibilityPolicy, allowNationSwitch: false } })).toThrow('policy version');
    expect(() => store.register({ ...f.request(3), registeredAtDay: 419 })).toThrow('backdated');
    expect(store.readActiveRoster('career-a', 'wbc-2032', 'JP', 420)).toEqual([accepted]);
    expect(() => store.adoptAppearance({ careerId: 'career-a', eventId: 'fake-senior', receiptId: 'missing', acceptedAtDay: 426 })).toThrow('actual official participation');
  } finally { store.close(); f.close(); }
});

it('uses saved roster checkpoints for past retry and permits only an active injured Player replacement before cutoff', () => {
  const f = nationalCallupFixture();
  let store = openSqliteNationalCallupStore(f.path, f.sources);
  try {
    const first = store.register(f.request());
    const replacement = { ...f.request(1), replacementOf: first.input.eventId, registeredAtDay: 422 };
    expect(() => store.register(replacement)).toThrow('active injured');
    f.changeAvailability('p0', 'INJURED', 421);
    expect(store.register(f.request())).toEqual(first);
    expect(() => store.register({ ...replacement, registeredAtDay: 431 })).toThrow('REPLACEMENT_CUTOFF');
    const second = store.register(replacement);
    expect(store.readActiveRoster('career-a', 'wbc-2032', 'JP', 420)).toEqual([first]);
    expect(store.readActiveRoster('career-a', 'wbc-2032', 'JP', 422)).toEqual([second]);
    expect(store.readRepresentation('career-a', 'p0', 422)[0].nationId).toBe('JP');
    expect(() => store.register({ ...f.request(3), registeredAtDay: 422, replacementOf: first.input.eventId })).toThrow('active injured');
    store.close(); store = openSqliteNationalCallupStore(f.path, f.sources);
    expect(store.register(replacement)).toEqual(second);
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const observer = new DatabaseSync(f.path);
    try {
      observer.prepare("UPDATE world_national_callups SET entry_json='{}' WHERE event_id=?").run(second.input.eventId);
      expect(store.readActiveRoster('career-a', 'wbc-2032', 'JP', 420)).toEqual([first]);
      expect(() => store.readActiveRoster('career-a', 'wbc-2032', 'JP', 422)).toThrow('corrupt');
    } finally { observer.close(); }
  } finally { store.close(); f.close(); }
});

it('accepts an eligible unaffiliated global Player and identifies no releasing Club', () => {
  const f = nationalCallupFixture();
  const store = openSqliteNationalCallupStore(f.path, f.sources);
  try {
    const accepted = store.register(f.request(5));
    expect(accepted.decision.registrationStatus).toBe('ACTIVE');
    expect(accepted.releaseClubId).toBeNull();
    expect(f.roster.readHead('career-a', 'club-a')!.roster.players[5].assignment).toBeNull();
  } finally { store.close(); f.close(); }
});

it('requires the initial roster before tournament play and keeps later additions on the replacement route', () => {
  const f = nationalCallupFixture(), store = openSqliteNationalCallupStore(f.path, f.sources);
  try {
    expect(() => store.register({ ...f.request(), registeredAtDay: 427 })).toThrow('INITIAL_ROSTER_CUTOFF');
    expect(store.readRepresentation('career-a', 'p0', 427)).toEqual([]);
  } finally { store.close(); f.close(); }
});

it('pins the legal fact prefix at acceptance and rechecks current eligibility without rewriting that decision', () => {
  const f = nationalCallupFixture(), store = openSqliteNationalCallupStore(f.path, f.sources);
  try {
    const accepted = store.register(f.request());
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-0', active: true, fact: {
      playerId: 'p0', personId: 'person-0', nationId: 'JP', evidenceId: 'later-same-day-birth', basis: 'BIRTH', effectiveFromDay: 420 } });
    expect(store.register(f.request())).toEqual(accepted);
    expect(store.readEligibilityAtDay('career-a', 'call-0', 420)?.decision.eligible).toBe(true);
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-0', active: false, fact: {
      playerId: 'p0', personId: 'person-0', nationId: 'JP', evidenceId: 'citizenship-revoked', basis: 'CITIZENSHIP', effectiveFromDay: 421 } });
    expect(store.readEligibilityAtDay('career-a', 'call-0', 421)?.decision.reason).toBe('NO_ELIGIBILITY_BASIS');
    expect(store.readRegistration('career-a', 'call-0')).toEqual(accepted);
  } finally { store.close(); f.close(); }
});

it('allows a policy-approved eligibility dispute refusal when legal facts have not been accepted', () => {
  const f = nationalCallupFixture([5]), store = openSqliteNationalCallupStore(f.path, f.sources);
  try {
    const request = { ...f.request(5), callupPolicy: { ...f.request().callupPolicy,
      allowedDeclineReasons: ['ELIGIBILITY_DISPUTE' as const] },
      response: { decision: 'DECLINE' as const, reason: 'ELIGIBILITY_DISPUTE' as const, evidenceId: 'dispute-5' } };
    const refusal = store.register(request);
    expect(refusal.eligibility.reason).toBe('NO_ELIGIBILITY_BASIS');
    expect(refusal.decision.registrationStatus).toBe('DECLINED');
    expect(store.readRepresentation('career-a', 'p5', 420)).toEqual([]);
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-5', active: true, fact: {
      evidenceId: 'later-citizenship', playerId: 'p5', personId: 'person-5', nationId: 'JP', basis: 'CITIZENSHIP', effectiveFromDay: 420 } });
    expect(store.register(request)).toEqual(refusal);
  } finally { store.close(); f.close(); }
});

it('binds National players to actual Club identities without fictitious National Club assignments', () => {
  const f = nationalCallupFixture();
  const official = new SqliteOfficialStateStore(f.path);
  let participation: SqliteOfficialParticipationStore | undefined;
  const readGame = () => ({ careerId: 'career-a', competitionEditionId: 'wbc-2032', gameDay: 426,
    homeClubId: 'JP', awayClubId: 'KR', fixtureEventId: 'fixture-1', competitionScope: 'NATIONAL' as const });
  const callups = openSqliteNationalCallupStore(f.path, { ...f.sources, games: { readGame },
    participation: { readReceipt: (receiptId: string) => participation?.readReceipt(receiptId) ?? null } });
  try {
    const registration = callups.register(f.request());
    official.registerOfficialFixture({ gameId: 'game-1', venueId: 'venue-1', fixtureRevision: 1, fixtureEventId: 'fixture-1' });
    const snapshot = f.snapshots.capture('career-a', 'club-a');
    participation = new SqliteOfficialParticipationStore(f.path, {
      readGame,
      readRoster: () => { throw new Error('National participation must not use a fictitious Club roster'); },
      readPersonLink: () => ({ personId: 'person-0', sourceId: 'link-0' }),
      readNationalRegistration: () => ({ careerId: 'career-a', competitionEditionId: 'wbc-2032', nationId: 'JP',
        playerId: 'p0', personId: 'person-0', personLinkSourceId: 'link-0', eventId: registration.input.eventId,
        registeredAtDay: 420, rosterSnapshotId: snapshot.snapshotId, rosterRevision: snapshot.revision }),
    });
    const binding = { gameId: 'game-1', careerId: 'career-a', competitionEditionId: 'wbc-2032', gameDay: 426,
      clubId: 'JP', side: 'HOME' as const, playerId: 'p0', personId: 'person-0', personLinkSourceId: 'link-0',
      rosterRevision: snapshot.revision, fixtureEventId: 'fixture-1',
      nationalRegistrationEventId: registration.input.eventId, nationalRosterSnapshotId: snapshot.snapshotId };
    expect(participation.bindPregame(binding)).toEqual(binding);
    applyTwo(official, 'game-1', 'p0');
    const played = participation.confirmPlayed('game-1', 'p0', 'DEFENDER', 'application-1', 'application-2');
    expect(played.binding).toEqual(binding);
    const appearance = callups.adoptAppearance({ careerId: 'career-a', eventId: 'senior-0',
      receiptId: played.receiptId, acceptedAtDay: 426 });
    expect(callups.adoptAppearance(appearance.input)).toEqual(appearance);
    expect(callups.readRepresentation('career-a', 'p0', 426)[0].seniorOfficialAppearanceDay).toBe(426);
    expect(callups.readRepresentation('career-a', 'p0', 425)[0].seniorOfficialAppearanceDay).toBeNull();
    expect(callups.readRegistration('career-a', registration.input.eventId)).toEqual(registration);
    expect(() => callups.register({ ...f.request(), eventId: 'switch-after-senior', nationId: 'KR',
      editionId: 'premier-2034', registeredAtDay: 1300,
      response: { decision: 'ACCEPT', reason: null, evidenceId: 'later-response' },
      callupPolicy: { ...f.request().callupPolicy, version: 'premier-roster-v1', replacementCutoffDay: 1415 } }))
      .toThrow('NATIONAL_INELIGIBLE');
    expect(f.roster.readHead('career-a', 'club-a')!.roster.players[0].assignment?.clubId).toBe('club-a');
  } finally { participation?.close(); official.close(); callups.close(); f.close(); }
});

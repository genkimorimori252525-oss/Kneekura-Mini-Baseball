import { expect, it } from 'vitest';
import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { regionalNationalInput } from './RegionalNationalFixtures.test-support';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqliteRegionalNationalGroupStore } from './SqliteRegionalNationalGroupStore';
import { openSqliteRegionalNationalKnockoutStore } from './SqliteRegionalNationalKnockoutStore';
import { openSqliteRegionalNationalScheduleStore } from './SqliteRegionalNationalScheduleStore';
import { registerRegionalNationalFixtureFromWorld } from './RegionalNationalFixtureFromWorld';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { createNationalParticipationAuthority } from './SqliteNationalParticipationAuthority';
import { applyTwo } from './OfficialParticipationPlayFixtures.test-support';

it('derives National pregame and senior actor proof from actual Native selection, fixture, roster and identity owners', () => {
  const f = nationalCallupFixture();
  const official = new SqliteOfficialStateStore(f.path);
  const groups = openSqliteRegionalNationalGroupStore(f.path, { regions: f.nations, matches: official, selections: f.selections });
  const knockout = openSqliteRegionalNationalKnockoutStore(f.path, { groups, regions: f.nations, matches: official });
  const schedules = openSqliteRegionalNationalScheduleStore(f.path, { groups, selections: f.selections });
  let participation: SqliteOfficialParticipationStore | undefined;
  let authority: ReturnType<typeof createNationalParticipationAuthority> | undefined;
  const callups = openSqliteNationalCallupStore(f.path, { ...f.sources,
    games: { readGame: (gameId: string) => authority?.readGame(gameId) ?? null },
    participation: { readReceipt: (receiptId: string) => participation?.readReceipt(receiptId) ?? null } });
  try {
    const input = regionalNationalInput('ASIA_PACIFIC', 2, { startsOnDay: 121, endsOnDay: 130 });
    const edition = { ...input.edition, groups: input.edition.groups.map((group, i) => i === 0
      ? { ...group, nationIds: ['JP', 'KR', 'AP-2', 'AP-3'] } : group) };
    f.selections.initialize({ careerId: 'career-a', editionId: edition.editionId, kind: 'REGIONAL_NATIONAL',
      region: 'ASIA_PACIFIC', cycleOrdinal: 0, careerDayOne: '2031-01-01', cutoffDay: 100 });
    for (const nationId of edition.groups.flatMap((group) => group.nationIds).filter((nation) => !['JP', 'KR'].includes(nation))) {
      f.nations.record({ careerId: 'career-a', nationId, region: 'ASIA_PACIFIC', effectiveFromDay: 0, sourceEventId: nationId });
    }
    const plan = groups.initialize('career-a', edition);
    const schedule = schedules.initialize({ careerId: 'career-a', editionId: edition.editionId,
      knockoutEdition: input.knockoutEdition, policy: { version: 'test-v1', gamesPerVenuePerDay: 2, minimumOffDaysBetweenRounds: 0 } });
    const game = plan.groups[0].games.find((item) => item.homeNationId === 'JP')!;
    const gameDay = schedule.games.find((slot) => slot.gameId === game.gameId)!.gameDay;
    const fixture = registerRegionalNationalFixtureFromWorld({ groups, knockout, schedules, matches: official },
      { careerId: 'career-a', editionId: edition.editionId, gameId: game.gameId, gameDay });
    const request = { ...f.request(), editionId: edition.editionId, registeredAtDay: 120,
      callupPolicy: { ...f.request().callupPolicy, version: 'regional-v1', rosterLimit: 3, initialRegistrationCutoffDay: 120, replacementCutoffDay: 124 } };
    const registration = callups.register(request);
    const substitute = callups.register({ ...request, ...f.request(1), editionId: edition.editionId,
      registeredAtDay: 120, callupPolicy: request.callupPolicy });
    const disputed = callups.register({ ...f.request(3), editionId: edition.editionId,
      registeredAtDay: 120, callupPolicy: request.callupPolicy });
    const snapshot = f.snapshots.capture('career-a', 'club-a');
    authority = createNationalParticipationAuthority({ careerId: 'career-a', editionId: edition.editionId,
      fixtures: { kind: 'REGIONAL_NATIONAL', groups, knockout, schedules }, matches: official,
      callups, roster: f.roster, rosterSnapshots: f.snapshots, personLinks: f.links });
    participation = new SqliteOfficialParticipationStore(f.path, authority);
    expect(authority.readGame('missing')).toBeNull();
    expect(authority.readGame(game.gameId)).toMatchObject({ competitionScope: 'NATIONAL', gameDay, homeClubId: 'JP' });
    const binding = { gameId: game.gameId, careerId: 'career-a', competitionEditionId: edition.editionId, gameDay,
      clubId: 'JP', side: 'HOME' as const, playerId: 'p0', personId: 'person-0', personLinkSourceId: 'link-0',
      rosterRevision: snapshot.revision, fixtureEventId: fixture.binding.fixtureEventId,
      nationalRegistrationEventId: registration.input.eventId, nationalRosterSnapshotId: snapshot.snapshotId };
    expect(authority.readNationalRegistration({ ...binding, careerId: 'foreign' })).toBeNull();
    expect(authority.readNationalRegistration({ ...binding, nationalRegistrationEventId: 'forged' })).toBeNull();
    expect(() => participation!.bindPregame({ ...binding, nationalRosterSnapshotId: 'missing' })).toThrow('lacks accepted');
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-3', active: false, fact: {
      evidenceId: 'revoked-before-game', playerId: 'p3', personId: 'person-3', nationId: 'JP', basis: 'CITIZENSHIP', effectiveFromDay: gameDay } });
    expect(() => participation!.bindPregame({ ...binding, playerId: 'p3', personId: 'person-3',
      personLinkSourceId: 'link-3', nationalRegistrationEventId: disputed.input.eventId })).toThrow('lacks accepted');
    expect(participation.bindPregame(binding)).toEqual(binding);
    participation.bindPregame({ ...binding, playerId: 'p1', personId: 'person-1', personLinkSourceId: 'link-1',
      nationalRegistrationEventId: substitute.input.eventId });
    applyTwo(official, game.gameId, 'p0');
    expect(() => participation!.confirmPlayed(game.gameId, 'p1', 'DEFENDER', 'application-1', 'application-2')).toThrow('absent');
    const receipt = participation.confirmPlayed(game.gameId, 'p0', 'DEFENDER', 'application-1', 'application-2');
    const appearance = callups.adoptAppearance({ careerId: 'career-a', eventId: 'senior-0', receiptId: receipt.receiptId, acceptedAtDay: gameDay });
    expect(appearance.source.registrationSnapshotId).toBe(registration.snapshotId);
    expect(callups.readRepresentation('career-a', 'p0', gameDay)[0].seniorOfficialAppearanceDay).toBe(gameDay);
    expect(callups.readRepresentation('career-a', 'p1', gameDay)[0].seniorOfficialAppearanceDay).toBeNull();
    expect(f.roster.readHead('career-a', 'club-a')!.roster.players[0].assignment?.clubId).toBe('club-a');
  } finally { participation?.close(); callups.close(); schedules.close(); knockout.close(); groups.close(); official.close(); f.close(); }
});

import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { nationalQualifierCallupFixture } from './NationalQualifierCallupFixtures.test-support';
import { registerWbcQualifierFixtureFromWorld } from './WbcQualifierFixtureFromWorld';
import { createNationalParticipationAuthority } from './SqliteNationalParticipationAuthority';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { applyTwo } from './OfficialParticipationPlayFixtures.test-support';

it('registers only actual selected qualifier entrants and preserves the earlier Native roster eligibility prefix', () => {
  const f = nationalQualifierCallupFixture();
  try {
    const before = f.roster.readHead('career-a', 'club-a')!.roster;
    expect(() => f.callups.register({ ...f.request(), registeredAtDay: 378,
      callupPolicy: { ...f.request().callupPolicy, initialRegistrationCutoffDay: 378 } })).toThrow('accepted identity');
    const saved = f.callups.register(f.request());
    expect(saved.source.selection).toMatchObject({ kind: 'WBC_QUALIFIER', editionId: 'qualifier-2032',
      wbcEditionId: 'wbc-2032', snapshotId: f.snapshot.snapshotId, calendarWindow: { startsOnDay: 380, endsOnDay: 390 } });
    expect(f.callups.readRepresentation('career-a', 'p0', 380).map((entry) => entry.editionId)).toEqual(['wbc-2032', 'qualifier-2032']);
    expect(f.eligibility.readEligibilityForEdition('career-a', 'wbc-2032', f.acceptedEligibility.eligibility.snapshotId))
      .toEqual(f.acceptedEligibility.eligibility);
    expect(f.selection.readSelection('career-a', 'qualifier-2032')!.entrants).toHaveLength(16);
    expect(() => f.callups.register({ ...f.request(1), nationId: 'host-0' })).toThrow('accepted identity');
    expect(() => f.callups.register({ ...f.request(1), editionId: 'missing-qualifier' })).toThrow('accepted identity');
    expect(() => f.callups.register({ ...f.request(1), callupPolicy: { ...f.request().callupPolicy, replacementCutoffDay: 391 } })).toThrow();
    expect(f.roster.readHead('career-a', 'club-a')!.roster).toEqual(before);
    f.reopen();
    expect(f.callups.register(f.request())).toEqual(saved);
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(f.path);
    try { db.prepare("UPDATE world_wbc_qualifier_editions SET snapshot_json='{}'").run(); }
    finally { db.close(); }
    // The accepted pre-qualifier prefix remains readable; the later callup must revalidate its actual Edition.
    expect(f.eligibility.readEligibilityForEdition('career-a', 'wbc-2032', f.acceptedEligibility.eligibility.snapshotId))
      .toEqual(f.acceptedEligibility.eligibility);
    expect(() => f.callups.readRegistration('career-a', saved.input.eventId)).toThrow('corrupt');
  } finally { f.close(); }
});

it('adopts actual qualifier actor proof as senior appearance without crediting an unused pregame substitute', () => {
  const f = nationalQualifierCallupFixture();
  let participation: SqliteOfficialParticipationStore | undefined;
  try {
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-1', active: true, fact: {
      evidenceId: 'substitute-jp-citizenship', playerId: 'p1', personId: 'person-1', nationId: 'JP', basis: 'CITIZENSHIP', effectiveFromDay: 380 } });
    const callupPolicy = { ...f.request().callupPolicy, rosterLimit: 2 };
    const registration = f.callups.register({ ...f.request(), callupPolicy });
    const substitute = f.callups.register({ ...f.request(1), nationId: 'JP', callupPolicy });
    const game = f.plan.pods.flatMap((pod) => pod.semifinals).find((slot) => slot.homeNationId === 'JP' || slot.awayNationId === 'JP')!;
    const gameDay = f.schedule.games.find((slot) => slot.gameId === game.gameId)!.gameDay;
    const fixture = registerWbcQualifierFixtureFromWorld({ pods: f.pods, schedules: f.schedules, matches: f.official },
      { careerId: 'career-a', editionId: 'qualifier-2032', gameId: game.gameId, gameDay });
    const authority = createNationalParticipationAuthority({ careerId: 'career-a', editionId: 'qualifier-2032',
      fixtures: { kind: 'WBC_QUALIFIER', pods: f.pods, schedules: f.schedules }, matches: f.official,
      callups: f.callups, roster: f.roster, rosterSnapshots: f.snapshots, personLinks: f.links });
    participation = new SqliteOfficialParticipationStore(f.path, authority);
    f.connectParticipation(authority, participation);
    const roster = f.snapshots.capture('career-a', 'club-a');
    const binding = { gameId: game.gameId, careerId: 'career-a', competitionEditionId: 'qualifier-2032', gameDay,
      clubId: 'JP', side: game.homeNationId === 'JP' ? 'HOME' as const : 'AWAY' as const,
      playerId: 'p0', personId: 'person-0', personLinkSourceId: 'link-0', rosterRevision: roster.revision,
      fixtureEventId: fixture.binding.fixtureEventId, nationalRegistrationEventId: registration.input.eventId,
      nationalRosterSnapshotId: roster.snapshotId };
    expect(authority.readGame(game.gameId)).toMatchObject({ competitionScope: 'NATIONAL', gameDay });
    expect(authority.readNationalRegistration({ ...binding, competitionEditionId: 'wbc-2032' })).toBeNull();
    participation.bindPregame(binding);
    participation.bindPregame({ ...binding, playerId: 'p1', personId: 'person-1', personLinkSourceId: 'link-1',
      nationalRegistrationEventId: substitute.input.eventId });
    expect(() => f.callups.adoptAppearance({ eventId: 'forged', careerId: 'career-a', receiptId: 'missing', acceptedAtDay: gameDay }))
      .toThrow('actual official participation');
    applyTwo(f.official, game.gameId, 'p0', binding.side === 'HOME' ? 'top' : 'bottom');
    expect(() => participation!.confirmPlayed(game.gameId, 'p1', 'DEFENDER', 'application-1', 'application-2')).toThrow('absent');
    const receipt = participation.confirmPlayed(game.gameId, 'p0', 'DEFENDER', 'application-1', 'application-2');
    const appearanceRequest = { eventId: 'qualifier-senior', careerId: 'career-a', receiptId: receipt.receiptId, acceptedAtDay: gameDay };
    const appearance = f.callups.adoptAppearance(appearanceRequest);
    expect(f.callups.readRepresentation('career-a', 'p0', gameDay).map((entry) => [entry.editionId, entry.seniorOfficialAppearanceDay]))
      .toEqual([['wbc-2032', null], ['qualifier-2032', gameDay]]);
    expect(f.callups.readRepresentation('career-a', 'p1', gameDay).map((entry) => entry.seniorOfficialAppearanceDay)).toEqual([null, null]);
    expect(f.selection.readSelection('career-a', 'qualifier-2032')!.entrants).toHaveLength(16);
    f.facts.record({ careerId: 'career-a', personLinkSourceId: 'link-0', active: true, fact: {
      evidenceId: 'other-citizenship', playerId: 'p0', personId: 'person-0', nationId: 'KR', basis: 'CITIZENSHIP', effectiveFromDay: gameDay } });
    expect(() => f.callups.register({ ...f.request(), eventId: 'premier-switch', editionId: 'premier-2034', nationId: 'KR',
      registeredAtDay: 1301, callupPolicy: { ...f.request().callupPolicy, version: 'premier-v1',
        initialRegistrationCutoffDay: 1301, replacementCutoffDay: 1302 },
      response: { decision: 'ACCEPT', reason: null, evidenceId: 'premier-switch-response' } })).toThrow('INELIGIBLE');
    f.reopen();
    expect(f.callups.adoptAppearance(appearanceRequest)).toEqual(appearance);
  } finally { participation?.close(); f.close(); }
});

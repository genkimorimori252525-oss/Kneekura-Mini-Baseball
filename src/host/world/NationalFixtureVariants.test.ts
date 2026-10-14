import { withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';
import { expect, it } from 'vitest';
import { readAdditionalNationalMatchFixture } from './NativeNationalFixtureEvidenceFromSqlite';
import { premierFixtureVariants, regionalFixtureVariants } from './NationalFixtureVariants.test-support';
import { createNationalParticipationAuthority } from './SqliteNationalParticipationAuthority';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePhysicalPlateAppearanceActorStore } from './SqlitePhysicalPlateAppearanceActorStore';
import { match } from './OfficialParticipationPlayFixtures.test-support';
import type { NationalMatchOriginSource } from './NationalMatchOriginFromSqlite';

it.each([2, 4])('connects every accepted Regional stage for %i groups using only original predecessor results', groupCount => {
  const f = regionalFixtureVariants(groupCount), careerId = 'career-a', editionId = f.edition.editionId;
  const read = (gameId: string) => readAdditionalNationalMatchFixture(f.db, { careerId, editionId, gameId });
  try {
    const group = read(f.source.gameId);
    expect(group.fixtureEventId).toBe(f.fixture.binding.fixtureEventId);
    const pending = f.schedule.games.find(g => g.stage !== 'GROUP')!;
    expect(() => f.fixtureFor(pending.gameId)).toThrow('not yet qualified');
    f.finishGroups();
    const proofs: { gameId: string; proof: ReturnType<typeof read> }[] = [];
    for (const stage of ['QUARTERFINAL', 'SEMIFINAL', 'FINAL']) {
      for (const slot of f.schedule.games.filter(g => g.stage === stage)) {
        const accepted = f.fixtureFor(slot.gameId), proof = read(slot.gameId);
        expect(proof).toMatchObject({ homeClubId: accepted.game.homeNationId, awayClubId: accepted.game.awayNationId,
          gameDay: slot.gameDay, fixtureEventId: accepted.binding.fixtureEventId });
        proofs.push({ gameId: slot.gameId, proof }); f.finish(slot.gameId);
      }
    }
    f.knockout.finalize(careerId, editionId);
    for (const p of proofs) expect(read(p.gameId)).toEqual(p.proof);
    expect(read(f.source.gameId)).toEqual(group);
    // Future outcome corruption is not a source of an earlier playable fixture.
    f.db.exec('BEGIN');
    f.db.prepare("UPDATE world_regional_national_knockouts SET outcome_json='{}'").run();
    for (const p of proofs) expect(read(p.gameId)).toEqual(p.proof);
    f.db.exec('ROLLBACK');
    f.db.exec('BEGIN');
    f.db.prepare("UPDATE matches SET state_json=json_set(state_json,'$.score.home',99) WHERE match_id=?").run(f.source.gameId);
    expect(() => read(proofs[0].gameId)).toThrow();
    f.db.exec('ROLLBACK');
  } finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.close(); }
});

it('connects Premier12 group, semifinal and both medals while later ranking results remain outside original fixture proof', () => {
  const f = premierFixtureVariants(), p = f.premier, careerId = 'career-a', editionId = p.edition.editionId;
  const read = (gameId: string) => readAdditionalNationalMatchFixture(f.db, { careerId, editionId, gameId });
  try {
    const first = p.schedule.games[0]; p.fixture(first.gameId);
    const group = read(first.gameId);
    expect(() => p.fixture(p.schedule.games.find(g => g.stage === 'SEMIFINAL')!.gameId)).toThrow('not yet qualified');
    p.finishGroups();
    const proofs: { gameId: string; proof: ReturnType<typeof read> }[] = [];
    for (const stage of ['SEMIFINAL', 'BRONZE', 'FINAL']) for (const slot of p.schedule.games.filter(g => g.stage === stage)) {
      const accepted = p.fixture(slot.gameId), proof = read(slot.gameId);
      expect(proof.fixtureEventId).toBe(accepted.binding.fixtureEventId);
      proofs.push({ gameId: slot.gameId, proof }); p.finish(slot.gameId);
    }
    withCompetitionSourceReadPhase(() => p.finalFour.finalize(careerId, editionId)); p.history.recordPremier(careerId, editionId);
    expect(read(first.gameId)).toEqual(group);
    for (const entry of proofs) expect(read(entry.gameId)).toEqual(entry.proof);
    f.db.exec('BEGIN');
    f.db.prepare("UPDATE world_premier_twelve_final_four SET outcome_json='{}'").run();
    for (const entry of proofs) expect(read(entry.gameId)).toEqual(entry.proof);
    f.db.exec('ROLLBACK');
    f.db.exec('BEGIN');
    f.db.prepare("UPDATE world_national_ranking_snapshots SET ranking_json='{}'").run();
    expect(() => read(first.gameId)).toThrow();
    f.db.exec('ROLLBACK');
  } finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.close(); }
});

it('feeds accepted Premier12 registration into original National membership and the actual physical actor owner', () => {
  const f = premierFixtureVariants(), p = f.premier, careerId = 'career-a', editionId = p.edition.editionId;
  try {
    const slot = p.schedule.games[0], fixture = p.fixture(slot.gameId);
    expect(fixture.game).toMatchObject({ homeNationId: 'JP', awayNationId: 'KR' });
    for (let i = 0; i < 19; i++) f.callups.register({ ...f.request(i), eventId: `premier-call-${i}`, editionId,
      response: { ...f.request(i).response, evidenceId: `premier-response-${i}` },
      nationId: i < 9 || i === 18 ? 'JP' : 'KR', registeredAtDay: slot.gameDay - 1,
      callupPolicy: { ...f.request().callupPolicy, rosterLimit: 10, initialRegistrationCutoffDay: slot.gameDay - 1, replacementCutoffDay: slot.gameDay } });
    const authority = createNationalParticipationAuthority({ careerId, editionId, fixtures: { kind: 'PREMIER_12', ...p },
      matches: f.official, callups: f.callups, roster: f.roster, rosterSnapshots: f.snapshots, personLinks: f.links });
    const participation = f.track(new SqliteOfficialParticipationStore(f.path, authority));
    const roster = f.snapshots.capture(careerId, 'club-a');
    for (let i = 0; i < 19; i++) participation.bindPregame({ gameId: slot.gameId, careerId, competitionEditionId: editionId,
      gameDay: slot.gameDay, clubId: i < 9 || i === 18 ? 'JP' : 'KR', side: i < 9 || i === 18 ? 'HOME' : 'AWAY',
      playerId: `p${i}`, personId: `person-${i}`, personLinkSourceId: `link-${i}`, rosterRevision: roster.revision,
      fixtureEventId: fixture.binding.fixtureEventId, nationalRegistrationEventId: `premier-call-${i}`, nationalRosterSnapshotId: roster.snapshotId });
    f.official.initializeMatch(slot.gameId, match());
    const source: NationalMatchOriginSource = { sourceId: 'premier-origin', sourceVersion: 'national-match-origin-v1', careerId, editionId, gameId: slot.gameId };
    const origin = f.origins.capture(source);
    const setup = { sourceId: 'premier-initial', sourceVersion: 'fixture-v1', gameId: slot.gameId,
      fixtureEventId: fixture.binding.fixtureEventId, startedAtTick: 0, worldSetup: f.setup };
    const initialWorlds = f.track(openSqliteOfficialInitialWorldStore(f.path, { matches: f.official, participation }, { readAcceptedSetup: () => setup }));
    initialWorlds.accept(setup.sourceId);
    const actorSource = { sourceId: 'premier-batter', sourceVersion: 'fixture-v1', gameId: slot.gameId, playerId: 'p9', initialWorldSourceId: setup.sourceId };
    const actors = f.track(openSqlitePhysicalPlateAppearanceActorStore(f.path, { matches: f.official, participation, initialWorlds }, { readAcceptedActor: () => actorSource }));
    expect(actors.accept(actorSource.sourceId).worldFixture).toEqual({ careerId, competitionEditionId: editionId,
      game: { gameId: slot.gameId, homeClubId: 'JP', awayClubId: 'KR' } });
    expect(f.origins.capture(source)).toEqual(origin);
    expect(f.db.prepare('SELECT 1 FROM world_season_heads WHERE season_id=?').get(editionId)).toBeUndefined();
  } finally { f.close(); }
});

import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { regionalNationalAssemblyFixture } from './RegionalNationalAssemblyFixtures.test-support';
import { openSqliteRegionalNationalDrawStore } from './SqliteRegionalNationalDrawStore';
import { openSqliteRegionalNationalEditionStore } from './SqliteRegionalNationalEditionStore';
import { openSqliteRegionalNationalGroupStore } from './SqliteRegionalNationalGroupStore';
import { openSqliteRegionalNationalKnockoutStore } from './SqliteRegionalNationalKnockoutStore';
import { openSqliteRegionalNationalScheduleStore } from './SqliteRegionalNationalScheduleStore';
import { registerRegionalNationalFixtureFromWorld } from './RegionalNationalFixtureFromWorld';
import { SqliteOfficialStateStore, type PersistOfficialPlayResult } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { createNationalParticipationAuthority } from './SqliteNationalParticipationAuthority';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { openSqliteWorldNationalRankingHistoryStore } from './SqliteWorldNationalRankingHistoryStore';
import { playOfficialNineInningGame } from './OfficialNineInningGame.test-support';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, registerCompetitionDrawPolicy } from '../../core/world/competition/CompetitionDraw';

it('plays a generated regional tournament with actual registered National actors and durable appearance proofs', () => {
  const f = regionalNationalAssemblyFixture(8, 10);
  const official = new SqliteOfficialStateStore(f.path);
  const closables: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { closables.push(store); return store; };
  let participation: SqliteOfficialParticipationStore | undefined;
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const observer = new DatabaseSync(f.path);
  try {
    for (const nationId of f.nationIds.slice(0, 8)) expect(f.callups.readActiveRoster('career-a', f.selection.editionId, nationId, 100)).toHaveLength(10);
    const before = f.roster.readHead('career-a', 'club-a')!.roster;
    const draws = track(openSqliteRegionalNationalDrawStore(f.path, f.drawSources));
    const drawPolicy = { ...f.drawRequest.policy, hostPot1CandidateRule: 'QUALIFIED_HOSTS_FIRST' as const };
    draws.initialize({ ...f.drawRequest, policy: drawPolicy, registry: registerCompetitionDrawPolicy(EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, drawPolicy) });
    const editions = track(openSqliteRegionalNationalEditionStore(f.path, { draws, hosts: f.hosts, nations: f.nations }));
    const accepted = editions.initialize({ careerId: 'career-a', editionId: f.selection.editionId,
      bestThirdDrawSeed: 'regional-third-seed', placementDrawSeed: 'regional-placement-seed',
      profile: { competitionId: 'regional-europe', formatVersion: 'regional-eight-fixture-v1',
        ruleProfileVersion: 'national-rules-v1', gamePolicyVersion: 'national-games-v1', hostingPolicyVersion: f.hostPolicy.version,
        tiebreakPolicy: { version: 'regional-groups-fixture-v1', tieCreditNumerator: 0, tieCreditDenominator: 1, runDifferentialCapPerGame: 5 },
        bestThirdPolicy: { version: 'regional-third-fixture-v1', criteria: ['WINS', 'CAPPED_RUN_DIFFERENTIAL', 'RUNS_AGAINST'] }, groupHostIndices: [0, 1],
        knockoutPolicy: { version: 'regional-ko-fixture-v1', openingPairs: [[0, 1], [2, 3]], openingHubIndices: [0, 0], semifinalHubIndices: [0, 0],
          placementPolicy: { version: 'regional-placement-fixture-v1', criteria: ['GROUP_WINS', 'GROUP_RUN_DIFFERENTIAL', 'GROUP_RUNS_AGAINST'] } } } });
    const matchSource = { getMatch: (gameId: string) => official.getMatch(gameId), getOfficialFixture: (gameId: string) => official.getOfficialFixture(gameId) };
    const groupSources = { regions: f.nations, selections: f.selections, draws, editions, matches: matchSource };
    let groups = track(openSqliteRegionalNationalGroupStore(f.path, groupSources));
    let knockout = track(openSqliteRegionalNationalKnockoutStore(f.path, { groups, regions: f.nations, editions, matches: matchSource }));
    let schedules = track(openSqliteRegionalNationalScheduleStore(f.path, { groups, selections: f.selections, editions }));
    groups.initialize('career-a', accepted.edition);
    const schedule = schedules.initialize({ careerId: 'career-a', editionId: f.selection.editionId, knockoutEdition: accepted.knockoutEdition,
      policy: { version: 'regional-schedule-fixture-v1', gamesPerVenuePerDay: 2, minimumOffDaysBetweenRounds: 0 } });
    const authority = createNationalParticipationAuthority({ careerId: 'career-a', editionId: f.selection.editionId,
      fixtures: { kind: 'REGIONAL_NATIONAL',
        groups: { readEdition: (...args) => groups.readEdition(...args), readPlan: (...args) => groups.readPlan(...args) },
        knockout: { readEdition: (...args) => knockout.readEdition(...args), readPlan: (...args) => knockout.readPlan(...args),
          readSemifinalGames: (...args) => knockout.readSemifinalGames(...args), readFinalGame: (...args) => knockout.readFinalGame(...args) },
        schedules: { readSchedule: (...args) => schedules.readSchedule(...args) } }, matches: official,
      callups: f.callups, roster: f.roster, rosterSnapshots: f.snapshots, personLinks: f.links });
    participation = new SqliteOfficialParticipationStore(f.path, authority);
    f.connectParticipation(authority, { readReceipt: (receiptId) => participation!.readReceipt(receiptId) });
    const roster = f.snapshots.capture('career-a', 'club-a');
    const appearances: { eventId: string; careerId: string; receiptId: string; acceptedAtDay: number }[] = [];
    let played = 0;
    const play = (gameId: string): void => {
      const slot = schedule.games.find((game) => game.gameId === gameId)!;
      const fixture = registerRegionalNationalFixtureFromWorld({ groups, knockout, schedules, matches: official },
        { careerId: 'career-a', editionId: f.selection.editionId, gameId, gameDay: slot.gameDay });
      const teamPlayers = [fixture.game.homeNationId, fixture.game.awayNationId].map((nationId, side) => {
        const registrations = f.callups.readActiveRoster('career-a', f.selection.editionId, nationId, slot.gameDay);
        for (const registration of registrations) {
          participation!.bindPregame({ gameId, careerId: 'career-a', competitionEditionId: f.selection.editionId, gameDay: slot.gameDay,
            clubId: nationId, side: side === 0 ? 'HOME' : 'AWAY', playerId: registration.input.playerId, personId: registration.input.personId,
            personLinkSourceId: registration.input.personLinkSourceId, rosterRevision: roster.revision,
            fixtureEventId: fixture.binding.fixtureEventId, nationalRegistrationEventId: registration.input.eventId, nationalRosterSnapshotId: roster.snapshotId });
        }
        return registrations.map((registration) => registration.input.playerId);
      });
      const result = playOfficialNineInningGame(official, { ...fixture.game, seasonId: f.selection.editionId,
        ruleProfileVersion: accepted.edition.ruleProfileVersion, gamePolicyVersion: accepted.edition.gamePolicyVersion, binding: fixture.binding,
        defenderPlayerIds: { home: teamPlayers[0].slice(0, 9), away: teamPlayers[1].slice(0, 9) } });
      expect(result.durableRevision).toBe(60); played++;
      const applications = (observer.prepare('SELECT result_json FROM applications WHERE match_id=?').all(gameId) as { result_json: string }[])
        .map((row) => JSON.parse(row.result_json) as PersistOfficialPlayResult);
      for (const [index, half] of ['top', 'bottom'].entries()) {
        const first = applications.find((item) => item.activation?.nextMatchState.half === half && item.nextWorld?.defenders.some((actor) => actor.playerId === teamPlayers[index][0]))!;
        const second = applications.find((item) => item.receipt.durableRevision === first.receipt.durableRevision + 1)!;
        const receipt = participation!.confirmPlayed(gameId, teamPlayers[index][0], 'DEFENDER', first.receipt.applicationId, second.receipt.applicationId);
        expect(() => participation!.confirmPlayed(gameId, teamPlayers[index][9], 'DEFENDER', first.receipt.applicationId, second.receipt.applicationId)).toThrow('absent');
        const request = { eventId: `appearance-${gameId}-${index}`, careerId: 'career-a', receiptId: receipt.receiptId, acceptedAtDay: slot.gameDay };
        const appearance = f.callups.adoptAppearance(request);
        expect(appearance.source.game.competitionEditionId).toBe(f.selection.editionId);
        appearances.push(request);
        expect(f.callups.readRepresentation('career-a', teamPlayers[index][9], slot.gameDay)[0].seniorOfficialAppearanceDay).toBeNull();
      }
      expect(f.eligibility.readEligibilityForEdition('career-a', f.selection.editionId, f.cohort.eligibility.snapshotId)).toEqual(f.cohort.eligibility);
    };
    schedule.games.filter((game) => game.stage === 'GROUP').sort((a, b) => a.gameDay - b.gameDay || a.gameId.localeCompare(b.gameId)).forEach((game) => play(game.gameId));
    expect(groups.finalize('career-a', f.selection.editionId)).not.toBeNull();
    knockout.initialize('career-a', accepted.knockoutEdition);
    for (const stage of ['SEMIFINAL', 'FINAL']) schedule.games.filter((game) => game.stage === stage).forEach((game) => play(game.gameId));
    const outcome = knockout.finalize('career-a', f.selection.editionId)!;
    expect(played).toBe(15);
    expect(outcome.placement.orderedNationIds).toHaveLength(8);
    schedules.close(); knockout.close(); groups.close(); participation.close(); participation = undefined;
    groups = track(openSqliteRegionalNationalGroupStore(f.path, groupSources));
    knockout = track(openSqliteRegionalNationalKnockoutStore(f.path, { groups, regions: f.nations, editions, matches: matchSource }));
    schedules = track(openSqliteRegionalNationalScheduleStore(f.path, { groups, selections: f.selections, editions }));
    participation = new SqliteOfficialParticipationStore(f.path, authority);
    const reopened = track(openSqliteNationalCallupStore(f.path, { ...f.sources, games: authority, participation }));
    for (const request of [appearances[0], appearances.at(-1)!]) expect(reopened.adoptAppearance(request)).toEqual(f.callups.adoptAppearance(request));
    expect(knockout.readOutcome('career-a', f.selection.editionId)).toEqual(outcome);
    const rankingHistory = track(openSqliteWorldNationalRankingHistoryStore(f.path, { nations: f.nations, regional: knockout, wbc: { readEvidence: () => null } }));
    expect(rankingHistory.recordRegional('career-a', f.selection.editionId).editions[0].games).toHaveLength(15);
    expect(f.roster.readHead('career-a', 'club-a')!.roster).toEqual(before);
    const appeared = participation.readReceipt(appearances[0].receiptId)!.binding;
    f.facts.record({ careerId: 'career-a', personLinkSourceId: appeared.personLinkSourceId, active: true,
      fact: { evidenceId: 'later-other-citizenship', playerId: appeared.playerId, personId: appeared.personId, nationId: f.nationIds[8], basis: 'CITIZENSHIP', effectiveFromDay: schedule.games.at(-1)!.gameDay } });
    const registration = f.callups.readRegistration('career-a', appeared.nationalRegistrationEventId!)!;
    expect(() => f.callups.register({ ...registration.input, eventId: 'switch-after-regional-appearance', editionId: 'premier-2034', nationId: f.nationIds[8],
      registeredAtDay: 1301, callupPolicy: { ...registration.input.callupPolicy, version: 'premier-fixture-v1', initialRegistrationCutoffDay: 1301, replacementCutoffDay: 1302 },
      response: { decision: 'ACCEPT', reason: null, evidenceId: 'switch-response' } })).toThrow('INELIGIBLE');
    expect(f.eligibility.readEligibilityForEdition('career-a', f.selection.editionId, f.cohort.eligibility.snapshotId)).toEqual(f.cohort.eligibility);
  } finally { observer.close(); participation?.close(); closables.reverse().forEach((store) => store.close()); official.close(); f.close(); }
});

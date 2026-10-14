import { withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import type { OfficialGameVenueBinding } from '../../core/world/competition/OfficialGameCompletion';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { nationalPhysicalPregameFixture } from './NationalPhysicalMatchFixtures.test-support';
import { registerRegionalNationalFixtureFromWorld } from './RegionalNationalFixtureFromWorld';
import { openSqliteWorldNationalRankingHistoryStore } from './SqliteWorldNationalRankingHistoryStore';
import { openSqliteWorldNationalRankingSnapshotStore } from './SqliteWorldNationalRankingSnapshotStore';
import { openSqlitePremierTwelveGroupStore } from './SqlitePremierTwelveGroupStore';
import { openSqlitePremierTwelveFinalFourStore } from './SqlitePremierTwelveFinalFourStore';
import { openSqlitePremierTwelveScheduleStore } from './SqlitePremierTwelveScheduleStore';
import { registerPremierTwelveFixtureFromWorld } from './PremierTwelveFixtureFromWorld';
import type { PremierTwelveEdition } from '../../core/world/competition/PremierTwelve';

/** Tiny qualification fixture: one accepted final PA from an explicit ninth-inning state, not a generated physical game. */
export const finishNationalFixture = (official: SqliteOfficialStateStore, game: Readonly<{
  gameId: string; homeNationId: string; awayNationId: string;
}>, edition: Readonly<{ editionId: string; ruleProfileVersion: string; gamePolicyVersion: string }>, binding: OfficialGameVenueBinding) => {
  const match = { ruleProfileId: asRuleProfileId(edition.ruleProfileVersion), inning: 9, half: 'top' as const,
    outs: 2, balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { home: 2, away: 1 }, playId: 1 };
  official.initializeMatch(game.gameId, match);
  let timeline = createCanonicalPlateAppearanceTimeline(match, 0);
  for (let i = 1; i <= 3; i++) timeline = recordCountedPitch(timeline, i, { kind: 'swinging_strike' });
  let adjudication = createPlayAdjudicationLedger({ playId: 1, ruleProfileId: match.ruleProfileId, playEnd: null });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: 'rule', tick: 4, snapshotId: 'rule', evidenceRevision: 1,
    ruling: { outsAfter: 3, basesAfter: match.bases, scoredRunnerIds: [] } });
  adjudication = closeOfficialPlay(adjudication, 1, { eventId: 'close', closureId: `close-${game.gameId}`, tick: 5 });
  return official.applyAndFinalize({ kind: 'non_live', matchId: game.gameId, applicationId: `final-${game.gameId}`,
    expectedDurableRevision: 0, match, timeline, adjudication, context: { kind: 'strikeout' },
    game: { seasonId: edition.editionId, homeClubId: game.homeNationId, awayClubId: game.awayNationId, venueBinding: binding,
      policy: { version: edition.gamePolicyVersion, minimumInnings: 9, tiesAllowed: false },
      lineScore: { innings: Array.from({ length: 9 }, (_, i) => ({ inning: i + 1, awayRuns: i === 0 ? 1 : 0, homeRuns: i === 8 ? null : i === 0 ? 2 : 0 })),
        totals: { home: { runs: 2, hits: 0, errors: 0 }, away: { runs: 1, hits: 0, errors: 0 } } } } }).result;
};

export const regionalFixtureVariants = (groupCount = 2) => {
  const f = nationalPhysicalPregameFixture({ initializeMatch: false, groupCount });
  const fixture = (gameId: string) => registerRegionalNationalFixtureFromWorld({ ...f, matches: f.official },
    { careerId: 'career-a', editionId: f.edition.editionId, gameId, gameDay: f.schedule.games.find(g => g.gameId === gameId)!.gameDay });
  const finish = (gameId: string) => { const accepted = fixture(gameId); return finishNationalFixture(f.official, accepted.game, f.edition, accepted.binding); };
  const groups = () => {
    f.schedule.games.filter(g => g.stage === 'GROUP').forEach(g => finish(g.gameId));
    f.groups.finalize('career-a', f.edition.editionId);
    return f.knockout.initialize('career-a', f.knockoutEdition);
  };
  const tournament = () => {
    groups();
    for (const stage of ['QUARTERFINAL', 'SEMIFINAL', 'FINAL']) f.schedule.games.filter(g => g.stage === stage).forEach(g => finish(g.gameId));
    return f.knockout.finalize('career-a', f.edition.editionId)!;
  };
  return { ...f, fixtureFor: fixture, finish, finishGroups: groups, finishTournament: tournament };
};

/** Existing explicit ranking policy from SqlitePremierTwelveStore's fixture; no default production calibration. */
export const premierFixtureVariants = () => {
  const f = regionalFixtureVariants(); f.finishTournament();
  const nationIds = [...f.edition.groups.flatMap(g => g.nationIds), 'extra-0', 'extra-1', 'extra-2', 'extra-3'];
  for (const nationId of nationIds.slice(8)) f.nations.record({ careerId: 'career-a', nationId, region: 'ASIA_PACIFIC', effectiveFromDay: 0, sourceEventId: nationId });
  let finalFour: ReturnType<typeof openSqlitePremierTwelveFinalFourStore> | undefined;
  const history = f.track(openSqliteWorldNationalRankingHistoryStore(f.path, { nations: f.nations, regional: f.knockout,
    wbc: { readEvidence: () => null }, premier: { readEvidence: (c, e) => finalFour?.readEvidence(c, e) ?? null } }));
  history.recordRegional('career-a', f.edition.editionId);
  const selection = f.selections.readSelection('career-a', 'premier-2034')!;
  const rankings = f.track(openSqliteWorldNationalRankingSnapshotStore(f.path, { history }));
  const policy = { version: 'ranking-v1', winPoints: 2, tiePoints: 1, tierWeights: { REGIONAL: 1, WBC: 3, PREMIER_12: 2 },
    stageWeights: { GROUP: 1, ROUND_OF_16: 2, QUARTERFINAL: 3, SEMIFINAL: 4, BRONZE: 2, FINAL: 5 },
    recencyBands: [{ maxAgeDays: 2000, multiplier: 1 }], tieBreak: 'NATION_ID' as const };
  const ranking = rankings.initialize({ careerId: 'career-a', asOfDay: selection.qualificationCutoff.day, nationIds, policy, registry: { policies: [policy] } });
  const others = nationIds.filter(n => n !== 'JP' && n !== 'KR');
  const edition: PremierTwelveEdition = { competitionId: 'premier', editionId: selection.editionId, canonicalRole: 'PREMIER_12', formatVersion: 'fixture-v1',
    ruleProfileVersion: 'national-rules-v1', gamePolicyVersion: 'national-games-v1', rankingPolicyVersion: policy.version,
    qualificationCutoffSnapshotId: selection.qualificationCutoff.snapshotId, rankingSnapshotId: ranking.snapshotId,
    drawSnapshotId: 'explicit-fixture-draw', hostingPolicyVersion: 'explicit-fixture-hosts', calendarWindow: selection.calendarWindow,
    tiebreakPolicy: f.edition.tiebreakPolicy, finalFourPairingPolicy: { version: 'fixture-pairs-v1', semifinalPairs: [[0, 3], [1, 2]] },
    hostNationIds: ['JP', 'KR'], groupHosts: ['JP', 'KR'].map((nationId, groupIndex) => ({ nationId, groupIndex, cityId: `premier-city-${groupIndex}`, venueId: `premier-venue-${groupIndex}` })),
    finalFourHost: { nationId: 'JP', cityId: 'premier-final-city', venueId: 'premier-final-venue' },
    groups: [{ groupIndex: 0, nationIds: ['JP', ...others.slice(0, 4), 'KR'] }, { groupIndex: 1, nationIds: others.slice(4) }] };
  const groups = f.track(openSqlitePremierTwelveGroupStore(f.path, { matches: f.fixtureMatches, rankings, selections: f.selections,
    editionCutoff: e => f.selections.readSelection('career-a', e)?.qualificationCutoff ?? null }));
  withCompetitionSourceReadPhase(() => groups.initialize({ careerId: 'career-a', edition }));
  finalFour = f.track(openSqlitePremierTwelveFinalFourStore(f.path, { groups, matches: f.fixtureMatches }));
  const schedules = f.track(openSqlitePremierTwelveScheduleStore(f.path, { groups }));
  const schedule = withCompetitionSourceReadPhase(() => schedules.initialize({ careerId: 'career-a', editionId: edition.editionId,
    policy: { version: 'fixture-schedule-v1', gamesPerVenuePerDay: 3, minimumOffDaysBetweenRounds: 0 } }));
  const fixtures = { groups, finalFour, schedules, matches: f.official };
  const fixture = (gameId: string) => withCompetitionSourceReadPhase(() => registerPremierTwelveFixtureFromWorld(fixtures,
    { careerId: 'career-a', editionId: edition.editionId, gameId, gameDay: schedule.games.find(g => g.gameId === gameId)!.gameDay }));
  const finish = (gameId: string) => { const accepted = fixture(gameId); return finishNationalFixture(f.official, accepted.game, edition, accepted.binding); };
  const finishGroups = () => {
    schedule.games.filter(g => g.stage === 'GROUP').forEach(g => finish(g.gameId));
    withCompetitionSourceReadPhase(() => groups.finalize('career-a', edition.editionId));
    return withCompetitionSourceReadPhase(() => finalFour!.initialize('career-a', edition.editionId));
  };
  return { ...f, premier: { edition, groups, finalFour, schedules, schedule, fixture, finish, finishGroups, history, rankings } };
};

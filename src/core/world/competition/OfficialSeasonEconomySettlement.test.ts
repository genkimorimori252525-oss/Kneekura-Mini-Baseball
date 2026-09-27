import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { createClubWageScheduleLedger } from '../club/ClubWageScheduleLedger';
import { state } from '../club/ClubFixtures.test-support';
import { settleFinalRegularSeasonGame,
  settleRegularSeasonGame } from './OfficialSeasonEconomySettlement';

const priorMatch: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('fixture-rules'), inning: 9,
  half: 'top', outs: 2, balls: 0, strikes: 0,
  bases: { first: null, second: null, third: null },
  score: { away: 0, home: 1 }, playId: 8,
};
const game = {
  gameId: 'game-1', seasonId: 'league-season-1',
  homeClubId: 'club-a', awayClubId: 'club-b',
  policy: { version: 'completion-v1', minimumInnings: 9,
    tiesAllowed: false },
  priorMatch,
  application: { applicationId: 'application-9', closureId: 'closure-9',
    previousPlayId: 8, durableRevision: 9,
    appliedMatchState: { ...priorMatch, half: 'bottom' as const,
      outs: 0, playId: 9 } },
  lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({
    inning: index + 1, awayRuns: 0,
    homeRuns: index === 8 ? null : index === 0 ? 1 : 0,
  })), totals: {
    away: { runs: 0, hits: 0, errors: 0 },
    home: { runs: 1, hits: 1, errors: 0 },
  } },
};
const schedule = { seasonId: 'league-season-1', leagueId: 'league-a',
  memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
  games: [{ gameId: 'game-1', homeClubId: 'club-a',
    awayClubId: 'club-b' }], revisionEventIds: ['schedule-revision-1'] };
const standingsPolicy = { version: 'standings-v1',
  tieCreditNumerator: 1, tieCreditDenominator: 2,
  runDifferentialCapPerGame: 10 };
const attendance = { factId: 'gate-1', careerId: 'career-a',
  sourceEventId: 'turnstile-1', gameId: 'game-1', stadiumId: 'stadium-a',
  observedAtDay: 10, availableAtDay: 10,
  venueRevisionAtObservation: 0, count: 120 };
const revenuePolicy = { version: 'matchday-v1', availableAtDay: 10,
  seasonId: 'league-season-1', currency: 'SIM',
  recognizedMinorUnitsPerAttendee: 5 };
const input = () => {
  const club = state();
  return { game, schedule, priorResults: [], standingsPolicy,
    homeClub: club, homeClubHistory: { checkpoint: club,
      acceptedEvents: [] },
    wageSchedules: createClubWageScheduleLedger('career-a', 'club-a'),
    attendance, revenuePolicy, finalizedAtDay: 11 };
};

it('passes one durable final game to full-season standings and matchday accounting once', () => {
  const source = input();
  const settled = settleFinalRegularSeasonGame(source);
  expect(settled.gameResult).toMatchObject({ gameId: 'game-1',
    applicationId: 'application-9', gamePolicyVersion: 'completion-v1',
    winnerClubId: 'club-a' });
  expect(settled.standings).toMatchObject({ seasonId: 'league-season-1',
    leagueId: 'league-a', tiebreakPolicyVersion: 'standings-v1',
    resultApplicationIds: ['application-9'], orderedClubIds: ['club-a', 'club-b'] });
  expect(settled.economy.state.live.finance.revenue.matchday).toBe(600);
  expect(settled.economy.applications[0]?.basis).toMatchObject({
    gameId: 'game-1', applicationId: 'application-9',
    attendanceFactId: 'gate-1', policyVersion: 'matchday-v1', amount: 600 });
  expect(settled.economy.events[0]?.command.causeEventIds).toEqual([
    'application-9', 'turnstile-1' ]);
  expect(source.homeClub.live.finance.revenue.matchday).toBe(0);
  expect(() => settleFinalRegularSeasonGame({ ...source,
    homeClub: settled.economy.state,
    homeClubHistory: { checkpoint: source.homeClub,
      acceptedEvents: settled.economy.events },
  })).toThrow('DUPLICATE_ID');
});

it('does not return standings or revenue when the official game continues', () => {
  const source = input();
  expect(() => settleFinalRegularSeasonGame({ ...source,
    game: { ...source.game, policy: { ...source.game.policy,
      minimumInnings: 10 } },
  })).toThrow('final');
  expect(source.homeClub.live.finance.receipts).toEqual([]);
});

it('rejects mismatched schedule or attendance without a partial result', () => {
  const source = input();
  expect(() => settleFinalRegularSeasonGame({ ...source,
    schedule: { ...source.schedule, games: [{ ...source.schedule.games[0]!,
      gameId: 'other-game' }] },
  })).toThrow();
  expect(() => settleFinalRegularSeasonGame({ ...source,
    attendance: { ...source.attendance, gameId: 'other-game' },
  })).toThrow();
  expect(source.homeClub.live.finance.receipts).toEqual([]);
});

it('settles an ordinary official game provisionally, then closes standings when all results arrive', () => {
  const first = input();
  const twoGameSchedule = { ...first.schedule,
    regularSeasonGamesPerClub: 2,
    games: [...first.schedule.games, { gameId: 'game-2',
      homeClubId: 'club-a', awayClubId: 'club-b' }] };
  const firstSettlement = settleRegularSeasonGame({ ...first,
    schedule: twoGameSchedule });
  expect(firstSettlement.standings).toMatchObject({
    kind: 'PROVISIONAL', seasonId: 'league-season-1',
    leagueId: 'league-a', tiebreakPolicyVersion: 'standings-v1',
    playedGameIds: ['game-1'], pendingGameIds: ['game-2'],
    provisionalGroups: [['club-a'], ['club-b']],
    rows: [{ clubId: 'club-a', games: 1, wins: 1 },
      { clubId: 'club-b', games: 1, losses: 1 }],
    resultApplicationIds: ['application-9'],
  });
  expect(firstSettlement.economy.state.live.finance.revenue.matchday)
    .toBe(600);
  const secondSettlement = settleRegularSeasonGame({ ...first,
    game: { ...first.game, gameId: 'game-2',
      application: { ...first.game.application,
        applicationId: 'application-10', closureId: 'closure-10' } },
    schedule: twoGameSchedule,
    priorResults: firstSettlement.results,
    homeClub: firstSettlement.economy.state,
    homeClubHistory: { checkpoint: first.homeClub,
      acceptedEvents: firstSettlement.economy.events },
    attendance: { ...first.attendance, factId: 'gate-2',
      sourceEventId: 'turnstile-2', gameId: 'game-2',
      observedAtDay: 12, availableAtDay: 12,
      venueRevisionAtObservation: 1 },
    finalizedAtDay: 13,
  });
  expect(secondSettlement.standings).toMatchObject({
    kind: 'OFFICIAL', snapshot: { orderedClubIds: ['club-a', 'club-b'],
      resultApplicationIds: ['application-9', 'application-10'] },
  });
  expect(secondSettlement.economy.state.live.finance.revenue.matchday)
    .toBe(1200);
  expect(() => settleRegularSeasonGame({ ...first,
    schedule: twoGameSchedule,
    homeClub: firstSettlement.economy.state,
    homeClubHistory: { checkpoint: first.homeClub,
      acceptedEvents: firstSettlement.economy.events },
  })).toThrow('DUPLICATE_ID');
});

it('keeps clubs with no official result unranked rather than inventing a result', () => {
  const source = input();
  const threeClubSchedule = { ...source.schedule,
    memberClubIds: ['club-a', 'club-b', 'club-c'],
    regularSeasonGamesPerClub: 2,
    games: [...source.schedule.games,
      { gameId: 'game-2', homeClubId: 'club-b', awayClubId: 'club-c' },
      { gameId: 'game-3', homeClubId: 'club-c', awayClubId: 'club-a' }],
  };
  const settled = settleRegularSeasonGame({ ...source,
    schedule: threeClubSchedule });
  expect(settled.standings).toMatchObject({
    kind: 'PROVISIONAL', playedGameIds: ['game-1'],
    pendingGameIds: ['game-2', 'game-3'],
    provisionalGroups: [['club-a'], ['club-b']],
    unplayedClubIds: ['club-c'],
    rows: [{ clubId: 'club-a', games: 1 },
      { clubId: 'club-b', games: 1 },
      { clubId: 'club-c', games: 0 }],
  });
});

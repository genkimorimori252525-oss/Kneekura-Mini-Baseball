import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { closeOfficialPlay, createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot } from
  '../../core/adjudication/PlayAdjudicationLedger';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalMatchState } from
  '../../core/model/CanonicalMatchState';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createClubWageScheduleLedger } from
  '../../core/world/club/ClubWageScheduleLedger';
import { createBaseScheduleSnapshot } from
  '../../core/world/competition/LeagueSchedule';
import { createCanonicalPlateAppearanceTimeline,
  recordCountedPitch } from
  '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { initializeDomesticSeason, prepareDomesticMatch,
  reviseDomesticSeasonSchedule, settleDomesticGame } from
  './DomesticSeasonRuntime';
import { openSqliteDomesticScheduleStore } from
  './SqliteDomesticScheduleStore';
import { openSqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';
import { openSqliteOfficialWorldSettlementOutbox } from
  './SqliteOfficialWorldSettlementOutbox';

const directories: string[] = [];
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-domestic-runtime-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const matchState = (): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('rules-v1'), inning: 1,
  half: 'top', outs: 0, balls: 0, strikes: 0,
  bases: { first: null, second: null, third: null },
  score: { away: 0, home: 0 }, playId: 1,
});

it('initializes the frozen schedule and prepares a source-backed match', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-domestic-runtime-'));
  directories.push(directory);
  const world = openSqliteWorldSettlementStore(join(directory, 'world.sqlite'));
  const archive = openSqliteDomesticScheduleStore(join(directory, 'world.sqlite'));
  const match = new SqliteOfficialStateStore(join(directory, 'match.sqlite'));
  const outbox = openSqliteOfficialWorldSettlementOutbox(
    join(directory, 'world.sqlite'));
  stores.push(world, archive, match, outbox);
  const baseSchedule = createBaseScheduleSnapshot({
    seasonId: 'league-season-1', leagueId: 'league-a',
    calendarProfileVersion: 'calendar-v1', generatorVersion: 'generator-v1',
    scheduleSeed: 'seed-a', opponentMatrixVersion: 'matrix-v1',
    regularSeasonGamesPerClub: 2, memberClubIds: ['club-a', 'club-b'],
    opponentMatrix: [{ homeClubId: 'club-a', awayClubId: 'club-b',
      gameCount: 2 }], allowedDays: [11, 12, 13], reservedWindows: [],
    series: [{ seriesId: 'series-a', homeClubId: 'club-a',
      awayClubId: 'club-b', startsOnDay: 11, gameCount: 2 }],
  });
  const storesInput = { world, archive, match, outbox };
  const eventProfile = { version: 'events-v1', allStarEnabled: false,
    marketWindows: [], rosterExpansionEnabled: false,
    awardSelectionPolicyVersion: 'award-v1' };
  expect(() => initializeDomesticSeason(storesInput, {
    careerId: 'career-a', baseSchedule, eventProfile,
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 }, clubs: [state()],
  })).toThrow('membership');
  initializeDomesticSeason(storesInput, { careerId: 'career-a',
    baseSchedule, eventProfile, standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 }, clubs: [state(), {
        ...state(), identity: { ...state().identity,
          clubId: 'club-b' },
        live: { ...state().live, references: {
          ...state().live.references,
          rivalryStateRefs: [{ fromClubId: 'club-b',
            toClubId: 'club-a', stateRef: 'rivalry-b-a' }],
        } },
      }] });
  expect(archive.readEvents('career-a', baseSchedule.seasonId)?.profile)
    .toEqual(eventProfile);
  const moved = { eventId: 'rainout', gameId: 'series-a:2',
    newDay: 13, reason: 'RAINOUT' as const };
  expect(reviseDomesticSeasonSchedule(storesInput, {
    careerId: 'career-a', seasonId: 'league-season-1',
    expectedRevision: 0, event: moved, acceptedAtDay: 11,
  }).revision).toBe(1);
  const before: CanonicalMatchState = { ...matchState(),
    inning: 9, outs: 2, strikes: 2, playId: 8,
    score: { away: 0, home: 1 } };
  const prepared = prepareDomesticMatch(storesInput, {
    careerId: 'career-a', seasonId: 'league-season-1',
    gameId: 'series-a:1', matchState: before,
  });
  expect(prepared.fixture.binding.venueId).toBe('stadium-a');
  expect(match.getMatch('series-a:1')?.durableRevision).toBe(0);
  expect(() => reviseDomesticSeasonSchedule(storesInput, {
    careerId: 'career-a', seasonId: 'league-season-1',
    expectedRevision: 1, event: { eventId: 'move-pinned',
      gameId: 'series-a:1', newDay: 12, reason: 'VENUE' },
    acceptedAtDay: 11,
  })).toThrow('prepared');
  const timeline = recordCountedPitch(
    createCanonicalPlateAppearanceTimeline(before, 1000), 1100,
    { kind: 'swinging_strike' });
  let adjudication = createPlayAdjudicationLedger({ playId: 8,
    ruleProfileId: before.ruleProfileId, playEnd: null });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
    eventId: 'rule-final', tick: 1101, snapshotId: 'rule-final',
    evidenceRevision: 1, ruling: { outsAfter: 3,
      basesAfter: before.bases, scoredRunnerIds: [] },
  });
  adjudication = closeOfficialPlay(adjudication, 1, {
    eventId: 'close-final', closureId: 'closure-final', tick: 1102 });
  const finalInput = { kind: 'non_live' as const,
    matchId: 'series-a:1', applicationId: 'final-1',
    expectedDurableRevision: 0, match: before, timeline,
    adjudication, context: { kind: 'strikeout' as const },
    game: { seasonId: 'league-season-1', homeClubId: 'club-a',
      awayClubId: 'club-b',
      policy: { version: 'completion-v1', minimumInnings: 9,
        tiesAllowed: false },
      venueBinding: prepared.fixture.binding,
      lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({
        inning: index + 1, awayRuns: 0,
        homeRuns: index === 8 ? null : index === 0 ? 1 : 0,
      })), totals: { away: { runs: 0, hits: 0, errors: 0 },
        home: { runs: 1, hits: 1, errors: 0 } } },
    },
  };
  const worldInput = { schedule: world.readSeason('career-a',
    'league-season-1')!.schedule, priorResults: [],
    standingsPolicy: world.readSeason('career-a',
      'league-season-1')!.standingsPolicy,
    homeClub: state(), homeClubHistory: { checkpoint: state(),
      acceptedEvents: [] },
    wageSchedules: createClubWageScheduleLedger('career-a', 'club-a'),
    attendance: { factId: 'gate-1', careerId: 'career-a',
      sourceEventId: 'turnstile-1', gameId: 'series-a:1',
      stadiumId: 'stadium-a', observedAtDay: 11,
      availableAtDay: 11, venueRevisionAtObservation: 0,
      count: 120 },
    revenuePolicy: { version: 'matchday-v1', availableAtDay: 11,
      seasonId: 'league-season-1', currency: 'SIM',
      recognizedMinorUnitsPerAttendee: 5 }, finalizedAtDay: 11 };
  const request = { finalInput, worldInput, expectedSeasonRevision: 0,
    expectedClubRevision: 0 };
  expect(() => settleDomesticGame(storesInput, { ...request,
    finalInput: { ...finalInput, game: { ...finalInput.game,
      venueBinding: { ...prepared.fixture.binding,
        venueId: 'forged' } } } })).toThrow('durable schedule or fixture');
  const result = settleDomesticGame(storesInput, request);
  expect(result.world).toMatchObject({ applicationId: 'final-1',
    seasonRevision: 1 });
  expect(settleDomesticGame(storesInput, request)).toEqual(result);
});

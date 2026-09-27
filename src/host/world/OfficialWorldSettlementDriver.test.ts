import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { closeOfficialPlay, createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { createCanonicalPlateAppearanceTimeline,
  recordCountedPitch } from
  '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createClubWageScheduleLedger } from
  '../../core/world/club/ClubWageScheduleLedger';
import { SqliteOfficialStateStore,
  type PersistOfficialFinalInput } from '../SqliteOfficialStateStore';
import { applyAndSettleOfficialRegularSeasonGame } from
  './OfficialWorldSettlementDriver';
import { openSqliteWorldSettlementStore,
  type SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';

const directories: string[] = [];
const matchStores: SqliteOfficialStateStore[] = [];
const worldStores: SqliteWorldSettlementStore[] = [];
const paths = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-world-driver-'));
  directories.push(directory);
  return { match: join(directory, 'match.sqlite'),
    world: join(directory, 'world.sqlite') };
};
const openMatch = (path: string) => {
  const store = new SqliteOfficialStateStore(path);
  matchStores.push(store);
  return store;
};
const openWorld = (path: string) => {
  const store = openSqliteWorldSettlementStore(path);
  worldStores.push(store);
  return store;
};
afterEach(() => {
  for (const store of matchStores.splice(0)) store.close();
  for (const store of worldStores.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-world-driver-')) {
      throw new Error('test cleanup target escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const fixture = () => {
  const club = state();
  const before = { ruleProfileId: asRuleProfileId('fixture-rules'),
    inning: 9, half: 'top' as const, outs: 2, balls: 0, strikes: 2,
    bases: { first: null, second: null, third: null },
    score: { away: 0, home: 1 }, playId: 8 };
  const timeline = recordCountedPitch(
    createCanonicalPlateAppearanceTimeline(before, 1000),
    1100, { kind: 'swinging_strike' });
  let adjudication = createPlayAdjudicationLedger({ playId: 8,
    ruleProfileId: before.ruleProfileId, playEnd: null });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
    eventId: 'rule-final', tick: 1101, snapshotId: 'rule-final',
    evidenceRevision: 1, ruling: { outsAfter: 3,
      basesAfter: before.bases, scoredRunnerIds: [] },
  });
  adjudication = closeOfficialPlay(adjudication, 1, {
    eventId: 'close-final', closureId: 'closure-final', tick: 1102,
  });
  const finalInput: PersistOfficialFinalInput = {
    kind: 'non_live', matchId: 'game-1', applicationId: 'final-1',
    expectedDurableRevision: 0, match: before, timeline,
    adjudication, context: { kind: 'strikeout' },
    game: { seasonId: 'league-season-1', homeClubId: 'club-a',
      awayClubId: 'club-b',
      policy: { version: 'completion-v1', minimumInnings: 9,
        tiesAllowed: false },
      lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({
        inning: index + 1, awayRuns: 0,
        homeRuns: index === 8 ? null : index === 0 ? 1 : 0,
      })), totals: { away: { runs: 0, hits: 0, errors: 0 },
        home: { runs: 1, hits: 1, errors: 0 } } },
    },
  };
  const schedule = { seasonId: 'league-season-1', leagueId: 'league-a',
    memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
    games: [{ gameId: 'game-1', homeClubId: 'club-a',
      awayClubId: 'club-b' }], revisionEventIds: ['schedule-revision-1'] };
  const standingsPolicy = { version: 'standings-v1',
    tieCreditNumerator: 1, tieCreditDenominator: 2,
    runDifferentialCapPerGame: 10 };
  const worldInput = { schedule, priorResults: [], standingsPolicy,
    homeClub: club, homeClubHistory: { checkpoint: club,
      acceptedEvents: [] },
    wageSchedules: createClubWageScheduleLedger('career-a', 'club-a'),
    attendance: { factId: 'gate-1', careerId: 'career-a',
      sourceEventId: 'turnstile-1', gameId: 'game-1',
      stadiumId: 'stadium-a', observedAtDay: 10,
      availableAtDay: 10, venueRevisionAtObservation: 0, count: 120 },
    revenuePolicy: { version: 'matchday-v1', availableAtDay: 10,
      seasonId: 'league-season-1', currency: 'SIM',
      recognizedMinorUnitsPerAttendee: 5 }, finalizedAtDay: 11 };
  return { club, before, finalInput, schedule, standingsPolicy, worldInput };
};

it('resumes a durable Match final and applies only the missing world settlement', () => {
  const p = paths();
  const x = fixture();
  const matchStore = openMatch(p.match);
  const worldStore = openWorld(p.world);
  matchStore.initializeMatch('game-1', x.before);
  worldStore.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  const finalizedBeforeCrash = matchStore.applyAndFinalize(x.finalInput);
  expect(worldStore.readApplication('final-1')).toBeNull();
  matchStore.close();
  worldStore.close();
  matchStores.splice(matchStores.indexOf(matchStore), 1);
  worldStores.splice(worldStores.indexOf(worldStore), 1);
  const reopenedMatch = openMatch(p.match);
  const reopenedWorld = openWorld(p.world);
  const recovered = applyAndSettleOfficialRegularSeasonGame({
    matchStore: reopenedMatch, worldStore: reopenedWorld,
    finalInput: x.finalInput, worldInput: x.worldInput,
    expectedSeasonRevision: 0, expectedClubRevision: 0,
  });
  expect(recovered.final).toEqual(finalizedBeforeCrash);
  expect(recovered.world).toMatchObject({ applicationId: 'final-1',
    seasonRevision: 1, clubRevision: 1 });
  expect(reopenedWorld.readSeason('career-a', 'league-season-1'))
    .toMatchObject({ revision: 1,
      results: [{ applicationId: 'final-1' }] });
  expect(reopenedWorld.readClub('career-a', 'club-a')?.state.live.finance
    .revenue.matchday).toBe(600);
  expect(applyAndSettleOfficialRegularSeasonGame({
    matchStore: reopenedMatch, worldStore: reopenedWorld,
    finalInput: x.finalInput, worldInput: x.worldInput,
    expectedSeasonRevision: 0, expectedClubRevision: 0,
  })).toEqual(recovered);
  expect(reopenedWorld.readSeason('career-a', 'league-season-1')?.revision)
    .toBe(1);
});

it('does not apply world settlement when the official Match is not final', () => {
  const p = paths();
  const x = fixture();
  const matchStore = openMatch(p.match);
  const worldStore = openWorld(p.world);
  matchStore.initializeMatch('game-1', x.before);
  worldStore.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  const nonFinalInput = { ...x.finalInput,
    game: { ...x.finalInput.game, policy: {
      ...x.finalInput.game.policy, minimumInnings: 10 } } };
  expect(() => applyAndSettleOfficialRegularSeasonGame({
    matchStore, worldStore, finalInput: nonFinalInput,
    worldInput: x.worldInput, expectedSeasonRevision: 0,
    expectedClubRevision: 0,
  })).toThrow('does not complete');
  expect(matchStore.getMatch('game-1')?.finalResult).toBeNull();
  expect(worldStore.readSeason('career-a', 'league-season-1')?.revision)
    .toBe(0);
  expect(worldStore.readApplication('final-1')).toBeNull();
});

it('rejects schedule scope before finalizing Match', () => {
  const p = paths();
  const x = fixture();
  const matchStore = openMatch(p.match);
  const worldStore = openWorld(p.world);
  matchStore.initializeMatch('game-1', x.before);
  worldStore.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  const wrongSchedule = { ...x.schedule, games: [{
    ...x.schedule.games[0], awayClubId: 'other-club' }] };
  expect(() => applyAndSettleOfficialRegularSeasonGame({
    matchStore, worldStore, finalInput: x.finalInput,
    worldInput: { ...x.worldInput, schedule: wrongSchedule },
    expectedSeasonRevision: 0, expectedClubRevision: 0,
  })).toThrow('scope mismatch');
  expect(matchStore.getMatch('game-1')?.finalResult).toBeNull();
  expect(worldStore.readSeason('career-a', 'league-season-1')?.revision)
    .toBe(0);
});

it('rejects an altered Match final head before changing world state', () => {
  const p = paths();
  const x = fixture();
  const matchStore = openMatch(p.match);
  const worldStore = openWorld(p.world);
  matchStore.initializeMatch('game-1', x.before);
  worldStore.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  const final = matchStore.applyAndFinalize(x.finalInput);
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(p.match);
  try {
    external.prepare(`UPDATE matches SET activation_json=?
      WHERE match_id='game-1'`).run(JSON.stringify({ finalResult: {
        ...final.result, winnerClubId: 'club-b' } }));
    expect(() => applyAndSettleOfficialRegularSeasonGame({
      matchStore, worldStore, finalInput: x.finalInput,
      worldInput: x.worldInput, expectedSeasonRevision: 0,
      expectedClubRevision: 0,
    })).toThrow('not durable or authentic');
  } finally {
    external.close();
  }
  expect(worldStore.readSeason('career-a', 'league-season-1')?.revision)
    .toBe(0);
  expect(worldStore.readApplication('final-1')).toBeNull();
});

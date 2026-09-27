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
import { openSqliteOfficialWorldSettlementOutbox,
  type SqliteOfficialWorldSettlementOutbox } from
  './SqliteOfficialWorldSettlementOutbox';
import { openSqliteWorldSettlementStore,
  type SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';

const directories: string[] = [];
const matches: SqliteOfficialStateStore[] = [];
const worlds: SqliteWorldSettlementStore[] = [];
const outboxes: SqliteOfficialWorldSettlementOutbox[] = [];
const paths = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-outbox-'));
  directories.push(directory);
  return { match: join(directory, 'match.sqlite'),
    world: join(directory, 'world.sqlite') };
};
const openMatch = (path: string) => {
  const store = new SqliteOfficialStateStore(path);
  matches.push(store);
  return store;
};
const openWorld = (path: string) => {
  const store = openSqliteWorldSettlementStore(path);
  worlds.push(store);
  return store;
};
const openOutbox = (path: string) => {
  const store = openSqliteOfficialWorldSettlementOutbox(path);
  outboxes.push(store);
  return store;
};
afterEach(() => {
  for (const store of outboxes.splice(0)) store.close();
  for (const store of worlds.splice(0)) store.close();
  for (const store of matches.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-outbox-')) {
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
  const input = { finalInput, expectedSeasonRevision: 0,
    expectedClubRevision: 0,
    worldInput: { schedule, priorResults: [], standingsPolicy,
      homeClub: club, homeClubHistory: { checkpoint: club,
        acceptedEvents: [] },
      wageSchedules: createClubWageScheduleLedger('career-a', 'club-a'),
      attendance: { factId: 'gate-1', careerId: 'career-a',
        sourceEventId: 'turnstile-1', gameId: 'game-1',
        stadiumId: 'stadium-a', observedAtDay: 10,
        availableAtDay: 10, venueRevisionAtObservation: 0, count: 120 },
      revenuePolicy: { version: 'matchday-v1', availableAtDay: 10,
        seasonId: 'league-season-1', currency: 'SIM',
        recognizedMinorUnitsPerAttendee: 5 }, finalizedAtDay: 11 } };
  return { club, before, schedule, standingsPolicy, input };
};

it('recovers an intake after Match final but before world settlement', () => {
  const p = paths();
  const x = fixture();
  const matchStore = openMatch(p.match);
  const worldStore = openWorld(p.world);
  const outbox = openOutbox(p.world);
  matchStore.initializeMatch('game-1', x.before);
  worldStore.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  expect(outbox.enqueue(x.input)).toMatchObject({
    applicationId: 'final-1', status: 'PENDING' });
  matchStore.applyAndFinalize(x.input.finalInput);
  outbox.close();
  outboxes.splice(outboxes.indexOf(outbox), 1);
  const reopened = openOutbox(p.world);
  expect(reopened.listPending()).toMatchObject([{
    applicationId: 'final-1', status: 'PENDING' }]);
  const completed = reopened.resume('final-1', { matchStore, worldStore });
  expect(completed.world).toMatchObject({ applicationId: 'final-1',
    seasonRevision: 1, clubRevision: 1 });
  expect(reopened.listPending()).toEqual([]);
  expect(reopened.read('final-1')).toMatchObject({ status: 'COMPLETED' });
  expect(reopened.resume('final-1', { matchStore, worldStore }))
    .toEqual(completed);
  expect(worldStore.readSeason('career-a', 'league-season-1')?.revision)
    .toBe(1);
});

it('recovers a world commit when completion marking was interrupted', () => {
  const p = paths();
  const x = fixture();
  const matchStore = openMatch(p.match);
  const worldStore = openWorld(p.world);
  const outbox = openOutbox(p.world);
  matchStore.initializeMatch('game-1', x.before);
  worldStore.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  outbox.enqueue(x.input);
  applyAndSettleOfficialRegularSeasonGame({ ...x.input,
    matchStore, worldStore });
  expect(outbox.read('final-1')?.status).toBe('PENDING');
  const recovered = outbox.resume('final-1', { matchStore, worldStore });
  expect(recovered.world.seasonRevision).toBe(1);
  expect(outbox.read('final-1')?.status).toBe('COMPLETED');
  expect(worldStore.readClub('career-a', 'club-a')?.state.live.finance
    .revenue.matchday).toBe(600);
});

it('keeps intake pending when the world write fails, then resumes once', () => {
  const p = paths();
  const x = fixture();
  const matchStore = openMatch(p.match);
  const worldStore = openWorld(p.world);
  const outbox = openOutbox(p.world);
  matchStore.initializeMatch('game-1', x.before);
  worldStore.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(p.world);
  try {
    external.exec(`CREATE TRIGGER fail_world_outbox_test
      BEFORE INSERT ON world_settlement_applications
      BEGIN SELECT RAISE(ABORT, 'injected world failure'); END;`);
    expect(() => outbox.submit(x.input, { matchStore, worldStore }))
      .toThrow('injected world failure');
    expect(matchStore.getMatch('game-1')?.finalResult?.applicationId)
      .toBe('final-1');
    expect(worldStore.readApplication('final-1')).toBeNull();
    expect(outbox.read('final-1')?.status).toBe('PENDING');
    expect(() => outbox.enqueue({ ...x.input,
      worldInput: { ...x.input.worldInput, finalizedAtDay: 12 } }))
      .toThrow('different outbox evidence');
    external.exec('DROP TRIGGER fail_world_outbox_test');
  } finally {
    external.close();
  }
  outbox.close();
  outboxes.splice(outboxes.indexOf(outbox), 1);
  const reopened = openOutbox(p.world);
  const result = reopened.resume('final-1', { matchStore, worldStore });
  expect(result.world.seasonRevision).toBe(1);
  expect(reopened.read('final-1')?.status).toBe('COMPLETED');
  expect(reopened.listPending()).toEqual([]);
  expect(worldStore.readSeason('career-a', 'league-season-1')?.revision)
    .toBe(1);
});

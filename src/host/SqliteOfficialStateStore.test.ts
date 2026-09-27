import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../core/adjudication/PlayAdjudicationLedger';
import type { CanonicalMatchState } from '../core/model/CanonicalMatchState';
import { asRuleProfileId } from '../core/model/RuleProfileRef';
import type { BetweenPlayWorldSetup } from '../core/adjudication/BetweenPlayWorldReset';
import {
  createCanonicalPlateAppearanceTimeline,
  recordCountedPitch,
  type CanonicalPlateAppearanceTimeline,
} from '../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { SqliteOfficialStateStore } from './SqliteOfficialStateStore';

const directories: string[] = [];
const pathForTest = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-official-store-'));
  directories.push(directory);
  return join(directory, 'official.sqlite');
};
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`) || !basename(target).startsWith('kneekura-official-store-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const ruleProfileId = asRuleProfileId('test-rules');
const match = (): CanonicalMatchState => ({
  ruleProfileId, inning: 1, half: 'top', outs: 1, balls: 0, strikes: 0,
  bases: { first: 'r1', second: null, third: null },
  score: { away: 0, home: 0 }, playId: 7,
});
const playEnd = { kind: 'play_end' as const, tick: 500, reason: 'live_action_complete' as const };
const liveTimeline = (): CanonicalPlateAppearanceTimeline => ({
  playId: 7, startedAtTick: 100, lastEventTick: 500, nextSequence: 1,
  status: { kind: 'live_ball_complete', count: { balls: 0, strikes: 0 }, contactTick: 200,
    playEndTick: 500, disposition: { kind: 'fair', fairDeterminationTick: 210 } },
  events: [{ tick: 500, sequence: 0, kind: 'LiveBallPlayEnded', payload: { playEnd } }],
});
const liveAdjudication = () => {
  let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd });
  ledger = recordCorrectRuleSnapshot(ledger, 0, {
    eventId: 'rule', tick: 501, snapshotId: 'snapshot', evidenceRevision: 1,
    ruling: { outsAfter: 2, basesAfter: { first: null, second: 'r1', third: null }, scoredRunnerIds: [] },
  });
  return closeOfficialPlay(ledger, 1, { eventId: 'close', closureId: 'closure-1', tick: 502 });
};
const worldSetup = (): BetweenPlayWorldSetup => ({
  baseCenters: {
    first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 },
  },
  defenders: (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const).map(
    (registeredPosition, index) => ({
      playerId: `defender-${index}`,
      registeredPosition,
      position: { x: index, z: index },
    }),
  ),
  activePreviousPlayControllerIds: [],
});
const liveRequest = () => ({
  kind: 'live_ball' as const, matchId: 'game-1', applicationId: 'application-1',
  expectedDurableRevision: 0, match: match(), physicalTimeline: liveTimeline(),
  adjudication: liveAdjudication(), nextStartedAtTick: 503, worldSetup: worldSetup(),
});

describe('SQLite official state store', () => {
  it('opens an existing version-one match store with the new fixture table', () => {
    const path = pathForTest();
    const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
      typeof import('node:sqlite')).DatabaseSync;
    const legacy = new DatabaseSync(path);
    legacy.exec(`CREATE TABLE matches (match_id TEXT PRIMARY KEY,
      durable_revision INTEGER NOT NULL, state_json TEXT NOT NULL,
      activation_json TEXT);
      PRAGMA user_version=1;`);
    legacy.prepare(`INSERT INTO matches(match_id, durable_revision,
      state_json, activation_json) VALUES (?, 0, ?, NULL)`)
      .run('legacy-game', JSON.stringify(match()));
    legacy.close();
    const store = new SqliteOfficialStateStore(path);
    expect(store.getMatch('legacy-game')?.matchState).toEqual(match());
    expect(store.getOfficialFixture('legacy-game')).toBeNull();
    expect(store.registerOfficialFixture({ gameId: 'new-game',
      venueId: 'neutral', fixtureEventId: 'fixture-new',
      fixtureRevision: 1 }).venueId).toBe('neutral');
    store.close();
  });

  it('atomically persists application and next-play activation, including across restart', () => {
    const path = pathForTest();
    const store = new SqliteOfficialStateStore(path);
    store.initializeMatch('game-1', match());
    const result = store.applyAndActivate(liveRequest());
    expect(result.receipt).toMatchObject({
      applicationId: 'application-1', closureId: 'closure-1', durableRevision: 1,
    });
    expect(result.activation.nextMatchState).toMatchObject({ playId: 8, outs: 2 });
    expect(result.activation.nextTimeline.playId).toBe(8);
    expect(result.nextWorld).toMatchObject({
      tick: 503, ball: null,
      runners: [{ playerId: 'r1', position: { x: 27, z: 27 }, velocity: { x: 0, z: 0 } }],
    });
    expect(store.getMatch('game-1')).toMatchObject({
      durableRevision: 1, matchState: { playId: 8, outs: 2 },
      activation: { applicationId: 'application-1' },
      nextWorld: { runners: [{ playerId: 'r1' }] },
    });
    store.close();
    const reopened = new SqliteOfficialStateStore(path);
    expect(reopened.applyAndActivate(liveRequest())).toEqual(result);
    expect(reopened.getMatch('game-1')?.durableRevision).toBe(1);
    reopened.close();
  });

  it('rejects an activation that disagrees with the durable MatchState after restart', () => {
    const path = pathForTest();
    const store = new SqliteOfficialStateStore(path);
    store.initializeMatch('game-1', match());
    store.applyAndActivate(liveRequest());
    store.close();
    const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
      typeof import('node:sqlite')).DatabaseSync;
    const external = new DatabaseSync(path);
    const row = external.prepare(`SELECT activation_json FROM matches
      WHERE match_id=?`).get('game-1') as { activation_json: string };
    const stored = JSON.parse(row.activation_json);
    stored.activation.nextMatchState.outs = 1;
    external.prepare(`UPDATE matches SET activation_json=?
      WHERE match_id=?`).run(JSON.stringify(stored), 'game-1');
    external.close();
    const reopened = new SqliteOfficialStateStore(path);
    expect(() => reopened.getMatch('game-1'))
      .toThrow('durable activation does not match MatchState');
    reopened.close();
  });

  it('rejects changed idempotency input, duplicate closure and stale revision without advancing state', () => {
    const store = new SqliteOfficialStateStore(pathForTest());
    store.initializeMatch('game-1', match());
    store.applyAndActivate(liveRequest());
    expect(() => store.applyAndActivate({ ...liveRequest(), nextStartedAtTick: 504 }))
      .toThrow('applicationId was already used for different input');
    expect(() => store.applyAndActivate({ ...liveRequest(), applicationId: 'application-2' }))
      .toThrow('official closure was already applied');
    expect(() => store.applyAndActivate({ ...liveRequest(), applicationId: 'application-3',
      adjudication: closeOfficialPlay(recordCorrectRuleSnapshot(
        createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd }), 0,
        { eventId: 'rule-2', tick: 501, snapshotId: 'snapshot-2', evidenceRevision: 1,
          ruling: { outsAfter: 2, basesAfter: { first: null, second: 'r1', third: null }, scoredRunnerIds: [] } },
      ), 1, { eventId: 'close-2', closureId: 'closure-2', tick: 502 }),
    })).toThrow('stale durable MatchState revision');
    expect(store.getMatch('game-1')?.durableRevision).toBe(1);
    store.close();
  });

  it('reads an older activation-only row without inventing a reset world', () => {
    const path = pathForTest();
    const store = new SqliteOfficialStateStore(path);
    store.initializeMatch('game-1', match());
    const result = store.applyAndActivate(liveRequest());
    const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
    const external = new DatabaseSync(path);
    external.prepare('UPDATE matches SET activation_json=? WHERE match_id=?')
      .run(JSON.stringify(result.activation), 'game-1');
    expect(store.getMatch('game-1')).toMatchObject({
      activation: { applicationId: 'application-1' }, nextWorld: null,
    });
    external.close();
    store.close();
  });

  it('rolls back a failed official derivation before writing any application', () => {
    const store = new SqliteOfficialStateStore(pathForTest());
    store.initializeMatch('game-1', match());
    expect(() => store.applyAndActivate({ ...liveRequest(), nextStartedAtTick: 501 }))
      .toThrow('next play cannot start before OfficialPlayClosure');
    expect(store.getMatch('game-1')).toMatchObject({ durableRevision: 0, matchState: { playId: 7 } });
    expect(store.applyAndActivate(liveRequest()).receipt.durableRevision).toBe(1);
    store.close();
  });

  it('refuses activation while an old controller is active and preserves the durable revision', () => {
    const store = new SqliteOfficialStateStore(pathForTest());
    store.initializeMatch('game-1', match());
    expect(() => store.applyAndActivate({
      ...liveRequest(),
      worldSetup: { ...worldSetup(), activePreviousPlayControllerIds: ['runner-r1'] },
    })).toThrow('previous-play controllers must be retired');
    expect(store.getMatch('game-1')).toMatchObject({ durableRevision: 0, nextWorld: null });
    store.close();
  });

  it('rolls back a state update if the application insert fails inside the transaction', () => {
    const path = pathForTest();
    const store = new SqliteOfficialStateStore(path);
    store.initializeMatch('game-1', match());
    const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
    const external = new DatabaseSync(path);
    external.exec(`CREATE TRIGGER fail_application BEFORE INSERT ON applications
      BEGIN SELECT RAISE(ABORT, 'injected insert failure'); END;`);
    expect(() => store.applyAndActivate(liveRequest())).toThrow('injected insert failure');
    expect(store.getMatch('game-1')).toMatchObject({ durableRevision: 0, matchState: { playId: 7 } });
    external.exec('DROP TRIGGER fail_application');
    expect(store.applyAndActivate(liveRequest()).receipt.durableRevision).toBe(1);
    external.close();
    store.close();
  });

  it('serializes competing store instances around the durable revision', () => {
    const path = pathForTest();
    const first = new SqliteOfficialStateStore(path);
    const second = new SqliteOfficialStateStore(path);
    first.initializeMatch('game-1', match());
    const result = first.applyAndActivate(liveRequest());
    expect(second.applyAndActivate(liveRequest())).toEqual(result);
    expect(() => second.applyAndActivate({ ...liveRequest(), applicationId: 'application-2' }))
      .toThrow('official closure was already applied');
    expect(second.getMatch('game-1')?.durableRevision).toBe(1);
    first.close();
    second.close();
  });

  it('rejects invalid initial state without creating a match row', () => {
    const store = new SqliteOfficialStateStore(pathForTest());
    expect(() => store.initializeMatch('game-1', { ...match(), outs: -1 }))
      .toThrow('match outs is invalid');
    expect(store.getMatch('game-1')).toBeNull();
    store.close();
  });

  it('uses the same transaction for a non-live strikeout', () => {
    const store = new SqliteOfficialStateStore(pathForTest());
    const before = { ...match(), strikes: 2 };
    store.initializeMatch('game-1', before);
    const timeline = recordCountedPitch(
      createCanonicalPlateAppearanceTimeline(before, 1000), 1100, { kind: 'swinging_strike' },
    );
    let adjudication = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd: null });
    adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
      eventId: 'rule-strikeout', tick: 1101, snapshotId: 'rule-strikeout', evidenceRevision: 1,
      ruling: { outsAfter: 2, basesAfter: before.bases, scoredRunnerIds: [] },
    });
    adjudication = closeOfficialPlay(adjudication, 1, {
      eventId: 'close-strikeout', closureId: 'closure-strikeout', tick: 1102,
    });
    const result = store.applyAndActivate({
      kind: 'non_live', matchId: 'game-1', applicationId: 'strikeout-1',
      expectedDurableRevision: 0, match: before, timeline, adjudication,
      context: { kind: 'strikeout' }, nextStartedAtTick: 1103, worldSetup: worldSetup(),
    });
    expect(result.activation.nextMatchState).toMatchObject({ playId: 8, outs: 2, strikes: 0 });
    expect(store.getMatch('game-1')?.durableRevision).toBe(1);
    store.close();
  });

  it('atomically finalizes a completed game without activating another play', () => {
    const path = pathForTest();
    const store = new SqliteOfficialStateStore(path);
    const venueBinding = { gameId: 'game-1', venueId: 'neutral-venue',
      fixtureEventId: 'fixture-game-1', fixtureRevision: 1 };
    expect(store.registerOfficialFixture(venueBinding)).toEqual(venueBinding);
    expect(store.registerOfficialFixture(venueBinding)).toEqual(venueBinding);
    expect(() => store.registerOfficialFixture({ ...venueBinding,
      venueId: 'other-venue' })).toThrow('pinned differently');
    const before: CanonicalMatchState = { ...match(), inning: 9, half: 'top', outs: 2,
      strikes: 2, bases: { first: null, second: null, third: null },
      score: { away: 1, home: 2 } };
    store.initializeMatch('game-1', before);
    store.initializeMatch('game-unbound', before);
    expect(() => store.registerOfficialFixture({ ...venueBinding,
      gameId: 'game-unbound', fixtureEventId: 'fixture-late' }))
      .toThrow('precede match initialization');
    expect(() => store.registerOfficialFixture({ ...venueBinding,
      gameId: 'game-2', fixtureEventId: 'fixture-game-2' }))
      .not.toThrow();
    const timeline = recordCountedPitch(
      createCanonicalPlateAppearanceTimeline(before, 1000), 1100,
      { kind: 'swinging_strike' },
    );
    let adjudication = createPlayAdjudicationLedger({ playId: 7,
      ruleProfileId, playEnd: null });
    adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
      eventId: 'rule-final', tick: 1101, snapshotId: 'rule-final', evidenceRevision: 1,
      ruling: { outsAfter: 3, basesAfter: before.bases, scoredRunnerIds: [] },
    });
    adjudication = closeOfficialPlay(adjudication, 1, {
      eventId: 'close-final', closureId: 'closure-final', tick: 1102,
    });
    const request = {
      kind: 'non_live' as const, matchId: 'game-1', applicationId: 'final-1',
      expectedDurableRevision: 0, match: before, timeline, adjudication,
      context: { kind: 'strikeout' as const },
      game: {
        seasonId: 'season-1', homeClubId: 'home', awayClubId: 'away',
        venueBinding,
        policy: { version: 'game-v1', minimumInnings: 9, tiesAllowed: false },
        lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({
          inning: index + 1, awayRuns: index === 0 ? 1 : 0,
          homeRuns: index === 0 ? 2 : index === 8 ? null : 0,
        })), totals: { away: { runs: 1, hits: 4, errors: 0 },
          home: { runs: 2, hits: 5, errors: 0 } } },
      },
    };
    expect(() => store.applyAndFinalize({ ...request,
      applicationId: 'premature-final', game: {
        ...request.game, policy: { ...request.game.policy, minimumInnings: 10 },
      },
    })).toThrow('does not complete');
    expect(() => store.applyAndFinalize({ ...request,
      game: { ...request.game, venueBinding: { ...venueBinding,
        venueId: 'other-venue' } },
    })).toThrow('durable fixture');
    expect(() => store.applyAndFinalize({ ...request,
      matchId: 'game-unbound', applicationId: 'unbound-final',
      game: { ...request.game, venueBinding: { ...venueBinding,
        gameId: 'game-unbound' } },
    })).toThrow('durable fixture');
    expect(store.getMatch('game-1')?.durableRevision).toBe(0);
    const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
    const external = new DatabaseSync(path);
    external.exec(`CREATE TRIGGER fail_final BEFORE INSERT ON applications
      BEGIN SELECT RAISE(ABORT, 'injected final insert failure'); END;`);
    expect(() => store.applyAndFinalize(request)).toThrow('injected final insert failure');
    expect(store.getMatch('game-1')).toMatchObject({ durableRevision: 0, finalResult: null });
    external.exec('DROP TRIGGER fail_final');
    external.close();
    const finalized = store.applyAndFinalize(request);
    expect(finalized.result).toMatchObject({
      gameId: 'game-1', winnerClubId: 'home', completionReason: 'HOME_LEADS_AFTER_TOP',
      venueBinding,
    });
    expect(store.getMatch('game-1')).toMatchObject({
      durableRevision: 1, activation: null, nextWorld: null,
      finalResult: { applicationId: 'final-1' },
    });
    store.close();
    const reopened = new SqliteOfficialStateStore(path);
    expect(reopened.getOfficialFixture('game-1')).toEqual(venueBinding);
    expect(reopened.applyAndFinalize(request)).toEqual(finalized);
    expect(() => reopened.applyAndFinalize({ ...request, applicationId: 'final-again' }))
      .toThrow('finalized');
    expect(() => reopened.applyAndActivate({
      ...liveRequest(), expectedDurableRevision: 1,
      match: reopened.getMatch('game-1')!.matchState,
    })).toThrow('finalized');
    reopened.close();
  });

  it('replays an earlier successful activation after a later official game final', () => {
    const path = pathForTest();
    const store = new SqliteOfficialStateStore(path);
    const firstRequest = { ...liveRequest(), match: { ...match(), inning: 9,
      score: { away: 0, home: 1 } } };
    store.initializeMatch('game-1', firstRequest.match);
    const first = store.applyAndActivate(firstRequest);
    const before = first.activation.nextMatchState;
    let timeline = createCanonicalPlateAppearanceTimeline(before, 1000);
    timeline = recordCountedPitch(timeline, 1100, { kind: 'swinging_strike' });
    timeline = recordCountedPitch(timeline, 1110, { kind: 'swinging_strike' });
    timeline = recordCountedPitch(timeline, 1120, { kind: 'swinging_strike' });
    let adjudication = createPlayAdjudicationLedger({ playId: before.playId,
      ruleProfileId, playEnd: null });
    adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
      eventId: 'rule-final-2', tick: 1130, snapshotId: 'rule-final-2', evidenceRevision: 1,
      ruling: { outsAfter: 3, basesAfter: before.bases, scoredRunnerIds: [] },
    });
    adjudication = closeOfficialPlay(adjudication, 1, {
      eventId: 'close-final-2', closureId: 'closure-final-2', tick: 1140,
    });
    store.applyAndFinalize({
      kind: 'non_live', matchId: 'game-1', applicationId: 'final-2',
      expectedDurableRevision: 1, match: before, timeline, adjudication,
      context: { kind: 'strikeout' },
      game: { seasonId: 'season-1', homeClubId: 'home', awayClubId: 'away',
        policy: { version: 'game-v1', minimumInnings: 9, tiesAllowed: false },
        lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({
          inning: index + 1, awayRuns: 0,
          homeRuns: index === 0 ? 1 : index === 8 ? null : 0,
        })), totals: { away: { runs: 0, hits: 0, errors: 0 },
          home: { runs: 1, hits: 1, errors: 0 } } },
      },
    });
    expect(store.applyAndActivate(firstRequest)).toEqual(first);
    store.close();
    const reopened = new SqliteOfficialStateStore(path);
    expect(reopened.applyAndActivate(firstRequest)).toEqual(first);
    reopened.close();
  });
});

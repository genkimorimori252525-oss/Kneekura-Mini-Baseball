import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync as Database } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { closeOfficialPlay, createPlayAdjudicationLedger, recordCorrectRuleSnapshot } from '../core/adjudication/PlayAdjudicationLedger';
import type { CanonicalMatchState } from '../core/model/CanonicalMatchState';
import { asRuleProfileId } from '../core/model/RuleProfileRef';
import type { BetweenPlayWorldSetup } from '../core/adjudication/BetweenPlayWorldReset';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch,
  type CanonicalPlateAppearanceTimeline } from '../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { SqliteOfficialStateStore, deriveOfficialPlayResult, deriveOfficialFinalResult,
  type PersistOfficialPlayInput, type PersistOfficialPlayResult, type PersistOfficialFinalInput,
  type PersistOfficialFinalResult, type PersistedMatch } from './SqliteOfficialStateStore';
import type { SqliteEvidenceGuard } from './SqliteEvidenceGuard';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const directories: string[] = [];
const connections: { close(): void }[] = [];
const tracked = <T extends { close(): void }>(value: T): T => { connections.push(value); return value; };
afterEach(() => {
  for (const connection of connections.splice(0).reverse()) connection.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const databasePath = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-shared-official-writer-'));
  directories.push(directory);
  return join(directory, 'official.sqlite');
};
type PreparedWrite<T> = Readonly<{ kind: 'write'; write(): Readonly<{ readResult(): T }> }>;
type Writer = Readonly<{
  getMatch(matchId: string): PersistedMatch | null;
  getOfficialFixture(gameId: string): ReturnType<SqliteOfficialStateStore['getOfficialFixture']>;
  prepareActivation(input: PersistOfficialPlayInput): Readonly<{ kind: 'retry'; result: PersistOfficialPlayResult }> | PreparedWrite<PersistOfficialPlayResult>;
  prepareFinalization(input: PersistOfficialFinalInput): PreparedWrite<PersistOfficialFinalResult>;
}>;
type WriterConstructor = new (database: Database,
  guard?: SqliteEvidenceGuard<PersistOfficialPlayInput | PersistOfficialFinalInput>) => Writer;
const loadWriter = async (): Promise<WriterConstructor> => {
  const moduleId = './SqliteOfficialStateWriter';
  const module: { SqliteOfficialStateWriter?: WriterConstructor } = existsSync(new URL(moduleId + '.ts', import.meta.url))
    ? await import(moduleId) : {};
  expect(typeof module.SqliteOfficialStateWriter, 'shared connection-bound official writer must exist').toBe('function');
  return module.SqliteOfficialStateWriter!;
};
// Independent wire-format oracle. Core values are existing pure public results;
// recursive key order and final request envelope are the legacy store contract.
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable((value as Record<string, unknown>)[key])])) : value;
const json = (value: unknown) => JSON.stringify(stable(value));
const hash = (value: unknown) => createHash('sha256').update(json(value)).digest('hex');
const rows = (database: Database) => ({
  matches: database.prepare('SELECT * FROM matches ORDER BY match_id').all(),
  applications: database.prepare('SELECT * FROM applications ORDER BY application_id').all(),
  fixtures: database.prepare('SELECT * FROM official_fixtures ORDER BY game_id').all(),
});
const initialize = (input: PersistOfficialPlayInput | PersistOfficialFinalInput) => {
  const path = databasePath(), store = tracked(new SqliteOfficialStateStore(path));
  if ('game' in input && input.game.venueBinding) store.registerOfficialFixture(input.game.venueBinding);
  store.initializeMatch(input.matchId, input.match);
  return { path, store, database: tracked(new DatabaseSync(path)) };
};
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

const nonLiveRequest = (final = false): PersistOfficialPlayInput & { kind: 'non_live' } => {
  const before = { ...match(), strikes: 2, ...(final ? { inning: 9, outs: 2,
    bases: { first: null, second: null, third: null }, score: { away: 1, home: 2 } } : {}) };
  const timeline = recordCountedPitch(createCanonicalPlateAppearanceTimeline(before, 1000), 1100, { kind: 'swinging_strike' });
  let adjudication = createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd: null });
  adjudication = recordCorrectRuleSnapshot(adjudication, 0, { eventId: 'rule-strikeout', tick: 1101,
    snapshotId: 'rule-strikeout', evidenceRevision: 1,
    ruling: { outsAfter: before.outs + 1, basesAfter: before.bases, scoredRunnerIds: [] } });
  adjudication = closeOfficialPlay(adjudication, 1, { eventId: 'close-strikeout', closureId: 'closure-strikeout', tick: 1102 });
  return { kind: 'non_live', matchId: 'game-1', applicationId: 'strikeout-1', expectedDurableRevision: 0,
    match: before, timeline, adjudication, context: { kind: 'strikeout' }, nextStartedAtTick: 1103, worldSetup: worldSetup() };
};
const finalRequest = (): PersistOfficialFinalInput => {
  const { nextStartedAtTick: _tick, worldSetup: _setup, ...input } = nonLiveRequest(true);
  return { ...input, applicationId: 'final-1', game: {
    seasonId: 'season-1', homeClubId: 'home', awayClubId: 'away',
    venueBinding: { gameId: 'game-1', venueId: 'neutral-venue', fixtureEventId: 'fixture-game-1', fixtureRevision: 1 },
    policy: { version: 'game-v1', minimumInnings: 9, tiesAllowed: false },
    lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({ inning: index + 1,
      awayRuns: index === 0 ? 1 : 0, homeRuns: index === 0 ? 2 : index === 8 ? null : 0 })),
      totals: { away: { runs: 1, hits: 4, errors: 0 }, home: { runs: 2, hits: 5, errors: 0 } } },
  } };
};
const commit = <T>(database: Database, work: PreparedWrite<T>): T => {
  database.exec('BEGIN IMMEDIATE');
  try { const result = work.write().readResult(); expect(database.isTransaction).toBe(true); database.exec('COMMIT'); return result; }
  catch (error) { if (database.isTransaction) database.exec('ROLLBACK'); throw error; }
};

describe('legacy official-state writer byte contract', () => {
  it.each(['live_ball', 'non_live'] as const)('pins pre-extraction %s raw rows independently of the shared writer', kind => {
    const input = kind === 'live_ball' ? liveRequest() : nonLiveRequest(), f = initialize(input);
    const expected = deriveOfficialPlayResult(input, 1);
    expect(f.store.applyAndActivate(input)).toEqual(expected);
    expect(hash(rows(f.database))).toBe(kind === 'live_ball'
      ? 'b08a214083d8b2de904017f62cfbff293d1ffe70861bc0d89cc19fe31ff380c5'
      : 'd1a889b29ff892548673fadad8a8dbf39fb1873bd06a3de6876aa7c7b01f3721');
    expect(rows(f.database).applications).toEqual([{ application_id: input.applicationId, match_id: input.matchId,
      closure_id: expected.receipt.closureId, request_hash: hash(input), result_json: json(expected) }]);
    expect(rows(f.database).matches).toEqual([{ match_id: input.matchId, durable_revision: 1,
      state_json: json(expected.activation.nextMatchState),
      activation_json: json({ activation: expected.activation, nextWorld: expected.nextWorld }) }]);
  });
  it('pins the pre-extraction final request envelope and final-only Match bytes', () => {
    const input = finalRequest(), f = initialize(input), expected = deriveOfficialFinalResult(input, 1);
    expect(f.store.applyAndFinalize(input)).toEqual(expected);
    expect(hash(rows(f.database))).toBe('ff39e3d64aa2428a2fb481baea2f6657b8460cf3d60a9439c5b9e11ff2698bc3');
    expect(rows(f.database).applications).toEqual([{ application_id: input.applicationId, match_id: input.matchId,
      closure_id: expected.receipt.closureId, request_hash: hash({ kind: 'game_final', request: input }), result_json: json(expected) }]);
    expect(rows(f.database).matches).toEqual([{ match_id: input.matchId, durable_revision: 1,
      state_json: json(expected.receipt.appliedMatchState), activation_json: json({ finalResult: expected.result }) }]);
  });
});

describe('shared official-state writer parity', () => {
  it('exists without opening a private connection, changing schema or taking a transaction', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input);
    const before = f.database.prepare('SELECT * FROM sqlite_master ORDER BY type,name').all();
    const writer = new Writer(f.database);
    expect(f.database.isTransaction).toBe(false);
    expect(f.database.prepare('SELECT * FROM sqlite_master ORDER BY type,name').all()).toEqual(before);
    expect(writer.getMatch(input.matchId)).toEqual(f.store.getMatch(input.matchId));
    expect(writer.getOfficialFixture(input.matchId)).toBeNull();
    const changes = f.database.prepare('SELECT total_changes() AS n').get()!.n;
    expect(writer.prepareActivation(input).kind).toBe('write');
    expect(f.database.isTransaction).toBe(false);
    expect(f.database.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
    expect(f.database.prepare('SELECT * FROM sqlite_master ORDER BY type,name').all()).toEqual(before);
    expect('close' in writer).toBe(false);
    expect(f.database.prepare('PRAGMA user_version').get()!.user_version).toBe(2);
  });

  it.each(['live_ball', 'non_live'] as const)('retains exact legacy %s request hash and durable row bytes', async kind => {
    const Writer = await loadWriter(), input = kind === 'live_ball' ? liveRequest() : nonLiveRequest();
    const legacy = initialize(input), shared = initialize(input);
    const expected = deriveOfficialPlayResult(input, 1), beforeInput = JSON.stringify(input);
    const phases: string[] = [];
    const writer = new Writer(shared.database, (connection, request, phase) => {
      expect(connection).toBe(shared.database); expect(request).toEqual(input);
      expect(shared.database.isTransaction).toBe(true); phases.push(phase);
    });
    const prepared = writer.prepareActivation(input);
    expect(prepared.kind).toBe('write');
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    expect(rows(shared.database).applications).toEqual([]);
    expect(commit(shared.database, prepared)).toEqual(expected);
    expect(legacy.store.applyAndActivate(input)).toEqual(expected);
    expect(JSON.stringify(input)).toBe(beforeInput);
    expect(rows(shared.database)).toEqual(rows(legacy.database));
    expect(rows(shared.database).applications).toEqual([{ application_id: input.applicationId, match_id: input.matchId,
      closure_id: expected.receipt.closureId, request_hash: hash(input), result_json: json(expected) }]);
    expect(rows(shared.database).matches).toEqual([{ match_id: input.matchId, durable_revision: 1,
      state_json: json(expected.activation.nextMatchState),
      activation_json: json({ activation: expected.activation, nextWorld: expected.nextWorld }) }]);
    expect(phases).toEqual(['write', 'written']);
  });

  it('retains finalization hash envelope, fixture, result bytes and retry phase', async () => {
    const Writer = await loadWriter(), input = finalRequest(), legacy = initialize(input), shared = initialize(input);
    const phases: string[] = [], writer = new Writer(shared.database, (_database, _input, phase) => phases.push(phase));
    const expected = deriveOfficialFinalResult(input, 1), prepared = writer.prepareFinalization(input);
    expect(shared.database.isTransaction).toBe(false);
    expect(commit(shared.database, prepared)).toEqual(expected);
    expect(legacy.store.applyAndFinalize(input)).toEqual(expected);
    expect(rows(shared.database)).toEqual(rows(legacy.database));
    expect(rows(shared.database).applications).toEqual([{ application_id: input.applicationId, match_id: input.matchId,
      closure_id: expected.receipt.closureId, request_hash: hash({ kind: 'game_final', request: input }), result_json: json(expected) }]);
    expect(rows(shared.database).matches).toEqual([{ match_id: input.matchId, durable_revision: 1,
      state_json: json(expected.receipt.appliedMatchState), activation_json: json({ finalResult: expected.result }) }]);
    expect(commit(shared.database, writer.prepareFinalization(input))).toEqual(expected);
    expect(phases).toEqual(['write', 'written', 'retry']);
    expect(writer.getOfficialFixture(input.matchId)).toEqual(input.game.venueBinding);
  });

  it('rejects a write without an active caller transaction before any durable change', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input), writer = new Writer(f.database);
    const before = rows(f.database), prepared = writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    expect(() => prepared.write()).toThrow('official state writer requires a caller-owned transaction');
    expect(rows(f.database)).toEqual(before);
    expect(f.database.isTransaction).toBe(false);
  });

  it('keeps application, Match and a caller companion write under the caller rollback', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input), writer = new Writer(f.database);
    f.database.exec('CREATE TABLE companion(value TEXT)');
    const before = rows(f.database), prepared = writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    f.database.exec('BEGIN IMMEDIATE');
    try {
      f.database.prepare('INSERT INTO companion VALUES(?)').run('queued-owner');
      prepared.write();
      expect(f.database.isTransaction).toBe(true);
      expect(rows(f.database).applications).toHaveLength(1);
      expect(f.store.getMatch(input.matchId)!.durableRevision).toBe(0);
    } finally { f.database.exec('ROLLBACK'); }
    expect(rows(f.database)).toEqual(before);
    expect(f.database.prepare('SELECT * FROM companion').all()).toEqual([]);
  });

  it('leaves failed INSERT rollback to the caller without committing partial Match or companion state', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input), writer = new Writer(f.database);
    f.database.exec(`CREATE TABLE companion(value TEXT);
      CREATE TRIGGER fail_application BEFORE INSERT ON applications BEGIN SELECT RAISE(ABORT, 'shared INSERT failure'); END`);
    const before = rows(f.database), prepared = writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    f.database.exec('BEGIN IMMEDIATE');
    try {
      f.database.prepare('INSERT INTO companion VALUES(?)').run('queued-owner');
      expect(() => prepared.write()).toThrow('shared INSERT failure');
      expect(f.database.isTransaction).toBe(true);
      expect(f.database.prepare('SELECT * FROM companion').all()).toEqual([{ value: 'queued-owner' }]);
      expect(f.store.getMatch(input.matchId)!.durableRevision).toBe(0);
    } finally { f.database.exec('ROLLBACK'); }
    expect(rows(f.database)).toEqual(before);
    expect(f.database.prepare('SELECT * FROM companion').all()).toEqual([]);
  });

  it('runs written evidence on the shared connection before the caller may commit', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input);
    f.database.exec(`CREATE TRIGGER corrupt_application AFTER INSERT ON applications
      BEGIN UPDATE matches SET state_json='{}' WHERE match_id='game-1'; END`);
    const phases: string[] = [], writer = new Writer(f.database, (database, _input, phase) => {
      phases.push(phase);
      if (phase === 'written' && database.prepare('SELECT state_json FROM matches').get()!.state_json === '{}') {
        throw new Error('shared written evidence differs');
      }
    });
    const before = rows(f.database), prepared = writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    expect(() => commit(f.database, prepared)).toThrow('shared written evidence differs');
    expect(phases).toEqual(['write', 'written']);
    expect(rows(f.database)).toEqual(before);
  });

  it('retains preflight retry and the in-transaction retry when another writer applied after preparation', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input), phases: string[] = [];
    const writer = new Writer(f.database, (_database, _input, phase) => phases.push(phase));
    const prepared = writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    const result = f.store.applyAndActivate(input), before = rows(f.database);
    expect(commit(f.database, prepared)).toEqual(result);
    expect(writer.prepareActivation(input)).toEqual({ kind: 'retry', result });
    expect(phases).toEqual(['retry', 'retry']);
    expect(rows(f.database)).toEqual(before);
    expect(() => writer.prepareActivation({ ...input, nextStartedAtTick: 0 }))
      .toThrow('applicationId was already used for different input');
  });

  it('preserves duplicate closure and stale revision rejections without a caller commit', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input), writer = new Writer(f.database);
    f.store.applyAndActivate(input);
    const before = rows(f.database), duplicate = writer.prepareActivation({ ...input, applicationId: 'other-id' });
    if (duplicate.kind !== 'write') throw new Error('different identity unexpectedly retried');
    expect(() => commit(f.database, duplicate)).toThrow('official closure was already applied');
    const adjudication = closeOfficialPlay(recordCorrectRuleSnapshot(createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd }), 0,
      { eventId: 'other-rule', tick: 501, snapshotId: 'other-snapshot', evidenceRevision: 1,
        ruling: { outsAfter: 2, basesAfter: { first: null, second: 'r1', third: null }, scoredRunnerIds: [] } }), 1,
      { eventId: 'other-close', closureId: 'other-closure', tick: 502 });
    const stale = writer.prepareActivation({ ...input, applicationId: 'stale-id', adjudication });
    if (stale.kind !== 'write') throw new Error('different identity unexpectedly retried');
    expect(() => commit(f.database, stale)).toThrow('stale durable MatchState revision');
    expect(rows(f.database)).toEqual(before);
  });

  it.each(['changed_hash', 'same_closure', 'stale_revision'] as const)('rejects a prepared write after a peer won with %s', async race => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input), writer = new Writer(f.database);
    const prepared = writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    const otherLedger = closeOfficialPlay(recordCorrectRuleSnapshot(createPlayAdjudicationLedger({ playId: 7, ruleProfileId, playEnd }), 0,
      { eventId: 'peer-rule', tick: 501, snapshotId: 'peer-snapshot', evidenceRevision: 1,
        ruling: { outsAfter: 2, basesAfter: { first: null, second: 'r1', third: null }, scoredRunnerIds: [] } }), 1,
      { eventId: 'peer-close', closureId: 'peer-closure', tick: 502 });
    f.store.applyAndActivate(race === 'changed_hash' ? { ...input, nextStartedAtTick: 504 }
      : { ...input, applicationId: 'peer-application', ...(race === 'stale_revision' ? { adjudication: otherLedger } : {}) });
    const before = rows(f.database);
    expect(() => commit(f.database, prepared)).toThrow(race === 'changed_hash' ? 'applicationId was already used for different input'
      : race === 'same_closure' ? 'official closure was already applied' : 'stale durable MatchState revision');
    expect(rows(f.database)).toEqual(before);
  });

  it('keeps a prepared write single-use after its successful outer transaction is rolled back', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input), writer = new Writer(f.database);
    const before = rows(f.database), prepared = writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    f.database.exec('BEGIN IMMEDIATE');
    try { prepared.write(); } finally { f.database.exec('ROLLBACK'); }
    f.database.exec('BEGIN IMMEDIATE');
    try { expect(() => prepared.write()).toThrow('official state prepared write was already used'); }
    finally { f.database.exec('ROLLBACK'); }
    expect(rows(f.database)).toEqual(before);
    const retry = writer.prepareActivation(input);
    if (retry.kind !== 'write') throw new Error('rolled-back application unexpectedly retried');
    expect(commit(f.database, retry).receipt.durableRevision).toBe(1);
  });

  it('keeps a prepared write single-use after an INSERT failure', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input), writer = new Writer(f.database);
    f.database.exec(`CREATE TRIGGER fail_application BEFORE INSERT ON applications
      BEGIN SELECT RAISE(ABORT, 'single-use INSERT failure'); END`);
    const before = rows(f.database), prepared = writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    expect(() => commit(f.database, prepared)).toThrow('single-use INSERT failure');
    expect(() => commit(f.database, prepared)).toThrow('official state prepared write was already used');
    expect(rows(f.database)).toEqual(before);
  });

  it('lets the caller atomically commit official and companion writes without exposing them early', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input), writer = new Writer(f.database);
    f.database.exec('CREATE TABLE companion(value TEXT)');
    const peer = tracked(new DatabaseSync(f.path)), prepared = writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    f.database.exec('BEGIN IMMEDIATE');
    let result: PersistOfficialPlayResult;
    try {
      f.database.prepare('INSERT INTO companion VALUES(?)').run('queued-owner');
      result = prepared.write().readResult();
      expect(f.database.isTransaction).toBe(true);
      expect(rows(peer).applications).toEqual([]);
      expect(peer.prepare('SELECT * FROM companion').all()).toEqual([]);
      f.database.exec('COMMIT');
    } catch (error) { if (f.database.isTransaction) f.database.exec('ROLLBACK'); throw error; }
    expect(rows(peer).applications).toHaveLength(1);
    expect(peer.prepare('SELECT * FROM companion').all()).toEqual([{ value: 'queued-owner' }]);
    expect(new Writer(peer).prepareActivation(input)).toEqual({ kind: 'retry', result });
  });

  it('retains finalization derivation before retry, unlike activation preflight retries', async () => {
    const Writer = await loadWriter(), input = finalRequest(), f = initialize(input), phases: string[] = [];
    f.store.applyAndFinalize(input);
    const writer = new Writer(f.database, (_database, _input, phase) => phases.push(phase));
    const invalid = { ...input, game: { ...input.game, policy: { ...input.game.policy, minimumInnings: 10 } } };
    expect(() => writer.prepareFinalization(invalid)).toThrow('official play does not complete the game');
    expect(() => f.store.applyAndFinalize(invalid)).toThrow('official play does not complete the game');
    expect(phases).toEqual([]);
    expect(f.database.isTransaction).toBe(false);
  });

  it('captures inert preparation bytes before the caller mutates the request', async () => {
    const Writer = await loadWriter(), input = liveRequest(), f = initialize(input), writer = new Writer(f.database);
    const original = structuredClone(input), prepared = writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    input.applicationId = 'mutated'; input.match = { ...input.match, score: { ...input.match.score, away: 99 } };
    const result = commit(f.database, prepared);
    expect(result).toEqual(deriveOfficialPlayResult(original, 1));
    expect(rows(f.database).applications[0].request_hash).toBe(hash(original));
  });
});

describe('official retry decode transaction parity', () => {
  it('commits a legacy final retry guard before decoding malformed saved result JSON', () => {
    const input = finalRequest(), f = initialize(input);
    f.store.applyAndFinalize(input);
    f.database.exec('CREATE TABLE retry_witness(value TEXT)');
    f.database.prepare('UPDATE applications SET result_json=? WHERE application_id=?').run('{', input.applicationId);
    const retrying = tracked(new SqliteOfficialStateStore(f.path, (database, _request, phase) => {
      if (phase === 'retry') database.prepare('INSERT INTO retry_witness VALUES(?)').run('committed-before-decode');
    }));
    expect(() => retrying.applyAndFinalize(input)).toThrow(SyntaxError);
    expect(f.database.prepare('SELECT * FROM retry_witness').all(),
      'legacy retry guard effect must commit before decoding saved result').toEqual([{ value: 'committed-before-decode' }]);
    expect(f.database.isTransaction).toBe(false);
  });

  it.each(['activation', 'finalization'] as const)('lets the borrowed %s caller decode a malformed retry before choosing rollback', async kind => {
    const Writer = await loadWriter(), input = kind === 'activation' ? liveRequest() : finalRequest(), f = initialize(input);
    f.database.exec('CREATE TABLE retry_witness(value TEXT)');
    const writer = new Writer(f.database, (database, _request, phase) => {
      if (phase === 'retry') database.prepare('INSERT INTO retry_witness VALUES(?)').run('borrowed-retry');
    });
    const prepared = 'game' in input ? writer.prepareFinalization(input) : writer.prepareActivation(input);
    if (prepared.kind !== 'write') throw new Error('fresh fixture unexpectedly retried');
    if ('game' in input) f.store.applyAndFinalize(input); else f.store.applyAndActivate(input);
    f.database.prepare('UPDATE applications SET result_json=? WHERE application_id=?').run('{', input.applicationId);
    const peer = tracked(new DatabaseSync(f.path));
    f.database.exec('BEGIN IMMEDIATE');
    try {
      const outcome = prepared.write();
      expect(f.database.isTransaction).toBe(true);
      expect(peer.prepare('SELECT * FROM retry_witness').all()).toEqual([]);
      expect(() => outcome.readResult()).toThrow(SyntaxError);
      expect(f.database.isTransaction).toBe(true);
      expect(f.database.prepare('SELECT * FROM retry_witness').all()).toEqual([{ value: 'borrowed-retry' }]);
    } finally { f.database.exec('ROLLBACK'); }
    expect(peer.prepare('SELECT * FROM retry_witness').all()).toEqual([]);
  });

});

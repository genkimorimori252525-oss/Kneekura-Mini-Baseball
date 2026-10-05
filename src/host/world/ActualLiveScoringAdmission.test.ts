// Source/transaction contract, not executed yet. Physical readers and the review
// projection reader below are substituted by disk fixture rows. Match/closure,
// current-pin selection, scoring, actual workload, readiness and SQLite are real.
import { afterEach, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { actualScoringFixture, rows, sourceTable, scoringFactory, type ScoringSource } from './ActualLiveScoringContract.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteOfficialScoringStore } from '../SqliteOfficialScoringStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

const fixtureInput = vi.hoisted(() => (db: Pick<DatabaseSync, 'prepare'>, kind: string): any => {
  const row = db.prepare('SELECT value_json FROM fixture_scoring_inputs WHERE kind=?').get(kind);
  return row ? JSON.parse(String(row.value_json)) : null;
});
vi.mock('./ActualLiveAdjudicationFromSqlite', () => ({ actualLiveAdjudicationEvidenceFromSqlite: (db: DatabaseSync) => ({
  read: (id: string) => id === 'adjudication' ? fixtureInput(db, 'adjudication') : null,
  readWithClosureInputs: (id: string) => id !== 'adjudication' ? null : ({ value: fixtureInput(db, 'adjudication'),
    end: fixtureInput(db, 'end'), prefix: { baseField: fixtureInput(db, 'baseField'), fields: [], executions: [{ source: { sourceId: 'execution' } }] } }),
}) }));
vi.mock('./SqliteActualFirstBasePlayEndStore', () => ({ actualFirstBaseClosedEvidenceFromSqlite: (db: DatabaseSync) => ({
  read: (id: string) => id === 'end' ? fixtureInput(db, 'end') : null,
}) }));
vi.mock('./SqliteBattedWorldFieldStore', async importOriginal => ({
  ...await importOriginal<typeof import('./SqliteBattedWorldFieldStore')>(),
  battedWorldFieldEvidenceFromSqlite: (db: DatabaseSync) => ({ read: () => fixtureInput(db, 'baseField'), scope: () => [] }),
}));
vi.mock('./SqliteBattedWorldFieldExecutionStore', async importOriginal => ({
  ...await importOriginal<typeof import('./SqliteBattedWorldFieldExecutionStore')>(),
  battedWorldFieldExecutionEvidenceFromSqlite: () => ({ scope: () => [{ source: { sourceId: 'execution' } }] }),
}));
vi.mock('./ActualPlayerKinematicsFromPrefix', () => ({ actualPlayersKinematicsFromPrefix: (_ids: unknown, prefix: any) => prefix.baseField.fixturePlayers }));
vi.mock('./ActualPostPlayReviewFromSqlite', () => ({ actualPostPlayReviewEvidenceFromSqlite: (db: DatabaseSync) => ({
  readCurrent: (id: string) => id === 'review' ? fixtureInput(db, 'review') : null,
}) }));

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const fixture = (options?: Parameters<typeof actualScoringFixture>[1]) => actualScoringFixture(cleanup, options);
const count = (db: DatabaseSync, table: string) => Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n);
const scoredRows = (db: DatabaseSync) => count(db, 'official_scoring_applications');

it.each(['base_hit', 'reached_on_error'] as const)('adds only accepted %s scoring to immutable actual closure and ten-role readiness', kind => {
  const f = fixture(), source: ScoringSource = { ...f.source, evidence: { ...f.source.evidence,
    judgment: kind === 'base_hit' ? { kind } : { kind, chargedFielderId: 'HOME-3' } } };
  f.sources.set(source.sourceId, source);
  const owner = f.open(), original = f.preserved(), ready = f.closure.readReadiness('closure');
  expect(ready.kind).toBe('ready'); expect(f.proposal.scoring.kind).toBe('unsupported');
  expect(count(f.db, 'world_player_workload_activities')).toBe(10);
  const result = owner.submit(source.sourceId);
  expect(result).toMatchObject({ sourceEventId: source.sourceId, officialApplicationId: 'apply', closureId: 'closure',
    record: { classification: kind, hitsCredited: kind === 'base_hit' ? 1 : 0, errorsCharged: kind === 'reached_on_error' ? 1 : 0 } });
  expect(owner.submit(source.sourceId)).toEqual(result);
  expect(count(f.db, sourceTable)).toBe(1); expect(scoredRows(f.db)).toBe(1);
  expect(f.preserved()).toEqual(original); expect(f.closure.readReadiness('closure')).toEqual(ready);
  const existingConsumer = f.keep(openSqliteOfficialScoringStore(f.path));
  expect(existingConsumer.readAcceptedPlay(source.scoringApplicationId)).toEqual({ scoring: result, application: f.proposal.application });
});

it.each(['missing', 'unapplied', 'fair_out'] as const)('does not accept a %s scorer dependency or fabricate a fair OUT category', fault => {
  const f = fixture({ out: fault === 'fair_out', apply: fault !== 'unapplied' }), owner = f.open();
  if (fault === 'missing') f.sources.clear();
  const original = f.preserved();
  expect(() => owner.enqueue(f.source.sourceId)).toThrow(/missing|applied|unsupported|scoring|closed.*play/);
  expect(rows(f.db, sourceTable)).toEqual([]); expect(scoredRows(f.db)).toBe(0); expect(f.preserved()).toEqual(original);
});

it.each(['game', 'closure_hash', 'ruling', 'record_tick', 'fair_event', 'batter', 'fielder', 'choice', 'source_alias'] as const)(
  'rejects %s substitution before accepting a scorer Source', fault => {
    const f = fixture(), owner = f.open(), source = JSON.parse(json(f.source));
    if (fault === 'game') source.gameId = 'foreign-game';
    if (fault === 'closure_hash') source.closureReference.proposalHash = 'a'.repeat(64);
    if (fault === 'ruling') source.evidence.basisRulingId = 'rule';
    if (fault === 'record_tick') source.evidence.recordedAtTick = 10;
    if (fault === 'fair_event') source.evidence.fairSequence = 0;
    if (fault === 'batter') source.evidence.batterRunnerId = 'HOME-0';
    if (fault === 'fielder') source.evidence.judgment = { kind: 'reached_on_error', chargedFielderId: 'foreign-fielder' };
    if (fault === 'choice') source.evidence.judgment = { kind: 'fielders_choice', retiredPriorRunnerId: 'invented-runner' };
    if (fault === 'source_alias') source.evidence.sourceEventId = 'different-event';
    f.sources.set(f.source.sourceId, source); const original = f.preserved();
    expect(() => owner.enqueue(f.source.sourceId)).toThrow();
    expect(rows(f.db, sourceTable)).toEqual([]); expect(scoredRows(f.db)).toBe(0); expect(f.preserved()).toEqual(original);
  });

it.each(['revision', 'headSourceId', 'headHash'] as const)('rejects an outcome-neutral stale review %s before scorer acceptance', key => {
  const f = fixture({ reviewed: true }), owner = f.open();
  const current = fixtureInput(f.db, 'review');
  current[key] = key === 'revision' ? current.revision + 1 : key === 'headHash' ? 'e'.repeat(64) : 'later-review-head';
  f.db.prepare("UPDATE fixture_scoring_inputs SET value_json=? WHERE kind='review'").run(json(current));
  const original = f.preserved();
  expect(() => owner.enqueue(f.source.sourceId)).toThrow(/review|pin|revision|head/);
  expect(rows(f.db, sourceTable)).toEqual([]); expect(scoredRows(f.db)).toBe(0); expect(f.preserved()).toEqual(original);
});

it('accepts the exact reviewed closure basis without replacing its original call', () => {
  const f = fixture({ reviewed: true }), owner = f.open(), original = f.preserved();
  expect(owner.submit(f.source.sourceId).record.basisRulingId).toBe(f.source.evidence.basisRulingId);
  expect(f.preserved()).toEqual(original); expect(f.closure.readReadiness('closure').kind).toBe('ready');
});

it('reserves one immutable scorer Source per closure and rejects changed accepted input', () => {
  const f = fixture(), owner = f.open(), accepted = owner.enqueue(f.source.sourceId);
  expect(accepted.status).toBe('QUEUED'); expect(scoredRows(f.db)).toBe(0);
  const rival = { ...f.source, sourceId: 'rival', scoringApplicationId: 'rival-score',
    evidence: { ...f.source.evidence, sourceEventId: 'rival' } };
  f.sources.set('rival', rival);
  expect(() => owner.enqueue('rival')).toThrow();
  f.sources.set(f.source.sourceId, { ...f.source, sourceVersion: 'changed' });
  expect(() => owner.enqueue(f.source.sourceId)).toThrow(/frozen|different|changed/);
  expect(owner.read(f.source.sourceId)).toEqual(accepted);
  expect(count(f.db, sourceTable)).toBe(1); expect(scoredRows(f.db)).toBe(0);
});

it.each(['source', 'scoring'] as const)('witnesses the actual %s INSERT before local corruption rolls back', stage => {
  const f = fixture({ reviewed: true }), owner = f.open();
  if (stage === 'scoring') owner.enqueue(f.source.sourceId);
  const original = f.preserved(), sourcesBefore = rows(f.db, sourceTable), scoresBefore = rows(f.db, 'official_scoring_applications');
  const table = stage === 'source' ? sourceTable : 'official_scoring_applications';
  f.db.exec(`CREATE TRIGGER corrupt_scorer_basis AFTER INSERT ON ${table} BEGIN
    UPDATE fixture_scoring_inputs SET value_json=json_set(value_json,'$.revision',99) WHERE kind='review'; END;`);
  const witness = witnessSqliteWrite(new RegExp(`^\\s*INSERT\\s+INTO\\s+${table}\\b`, 'i'), connection =>
    count(connection, table) === 1 && fixtureInput(connection, 'review').revision === 99);
  try {
    expect(() => stage === 'source' ? owner.enqueue(f.source.sourceId) : owner.resume(f.source.sourceId)).toThrow(/review|pin|revision|head|changed/);
    expect(witness.wasReached(), 'the real INSERT and AFTER INSERT trigger must execute').toBe(true);
  } finally { witness.close(); }
  expect(rows(f.db, sourceTable)).toEqual(sourcesBefore); expect(rows(f.db, 'official_scoring_applications')).toEqual(scoresBefore);
  expect(f.preserved()).toEqual(original);
});

it.each(['scoring_insert', 'completion_checkpoint'] as const)('recovers %s after all connections close without duplicating separate effects', stage => {
  const f = fixture(), owner = f.open(), ready = f.closure.readReadiness('closure'), original = f.preserved();
  owner.enqueue(f.source.sourceId);
  if (stage === 'scoring_insert') f.db.exec("CREATE TRIGGER stop_score BEFORE INSERT ON official_scoring_applications BEGIN SELECT RAISE(ABORT,'fixture scoring interrupted'); END;");
  else f.db.exec(`CREATE TRIGGER stop_score BEFORE UPDATE ON ${sourceTable} WHEN NEW.status='SCORED'
    BEGIN SELECT RAISE(ABORT,'fixture completion interrupted'); END;`);
  expect(() => owner.resume(f.source.sourceId)).toThrow(/fixture.*interrupted/);
  expect(owner.read(f.source.sourceId)?.status).toBe('QUEUED');
  expect(scoredRows(f.db)).toBe(stage === 'scoring_insert' ? 0 : 1); expect(f.preserved()).toEqual(original);
  f.db.exec('DROP TRIGGER stop_score');
  f.connections.armClosedBoundary(); const reopened = f.reopen(); f.connections.assertClosedBoundary();
  expect(f.db.isOpen).toBe(false);
  const scoring = f.keep(scoringFactory()(f.path));
  const result = scoring.resume(f.source.sourceId);
  expect(scoring.resume(f.source.sourceId)).toEqual(result);
  expect(scoring.read(f.source.sourceId)?.status).toBe('SCORED');
  expect(scoredRows(reopened.db)).toBe(1); expect(count(reopened.db, sourceTable)).toBe(1);
  for (const [table, expected] of Object.entries(original)) expect(rows(reopened.db, table)).toEqual(expected);
  expect(reopened.closure.readReadiness('closure')).toEqual(ready);
});

it.each(['source_json', 'proposal_json'] as const)('rejects escaped duplicate Source identity in %s without trusting cached scope', column => {
  const f = fixture(), owner = f.open(); owner.enqueue(f.source.sourceId);
  const before = rows(f.db, sourceTable)[0], original = String(before[column]);
  const corrupt = original.replace('"sourceId":"scorer-source"', '"source\\u0049d":"hidden-scorer","sourceId":"scorer-source"');
  expect(corrupt).not.toBe(original);
  f.db.prepare(`UPDATE ${sourceTable} SET ${column}=?`).run(corrupt);
  expect(() => owner.read('hidden-scorer')).toThrow(/identity|ownership|mirror|archive/);
  expect(() => owner.read(f.source.sourceId)).toThrow(/identity|ownership|mirror|archive/);
  expect(scoredRows(f.db)).toBe(0);
});

it.each(['closure', 'application', 'play', 'scoring_application'] as const)('rejects a rival raw %s claim hidden behind different SQL scope', claim => {
  const f = fixture(), owner = f.open(); owner.enqueue(f.source.sourceId);
  const original = rows(f.db, sourceTable)[0], rival = JSON.parse(String(original.source_json));
  rival.sourceId = 'hidden'; rival.evidence.sourceEventId = 'hidden'; rival.scoringApplicationId = 'hidden-score';
  rival.gameId = 'hidden-game'; rival.closureReference.sourceId = 'hidden-closure'; rival.evidence.closureId = 'hidden-closure'; rival.evidence.playId = 999;
  const proposal = JSON.parse(String(original.proposal_json)
    .replaceAll('scorer-source', 'hidden').replaceAll('score-actual', 'hidden-score')
    .replaceAll('series:1', 'hidden-game').replaceAll('\"closure\"', '\"hidden-closure\"').replaceAll('\"apply\"', '\"hidden-apply\"'));
  proposal.source = rival; proposal.gameId = 'hidden-game'; proposal.playId = 999;
  proposal.application.applicationId = 'hidden-apply'; proposal.application.matchId = 'hidden-game';
  proposal.application.match.playId = 999;
  if (claim === 'closure') rival.closureReference.sourceId = 'closure';
  if (claim === 'application') proposal.application.applicationId = 'apply';
  if (claim === 'play') { rival.gameId = f.source.gameId; rival.evidence.playId = f.source.evidence.playId; }
  if (claim === 'scoring_application') rival.scoringApplicationId = f.source.scoringApplicationId;
  f.db.prepare(`INSERT INTO ${sourceTable}(source_id,game_id,play_id,closure_id,scoring_application_id,official_application_id,status,source_json,source_hash,proposal_json,proposal_hash,result_json)
    VALUES('hidden','hidden-game',999,'hidden-closure','hidden-score','hidden-apply','QUEUED',?,'opaque',?,'opaque',NULL)`).run(json(rival),json(proposal));
  expect(() => owner.resume(f.source.sourceId)).toThrow(/identity|ownership|mirror|archive/);
  expect(scoredRows(f.db)).toBe(0);
});

it('reauthenticates a committed peer WAL change between preflight and BEGIN IMMEDIATE', async () => {
  const { createRequire } = await import('node:module');
  const { DatabaseSync: Database } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const f = fixture({ reviewed: true }), owner = f.open();
  const descriptor = Object.getOwnPropertyDescriptor(Database.prototype, 'exec')!, exec = descriptor.value;
  let changed = false;
  Object.defineProperty(Database.prototype, 'exec', { ...descriptor, value: function(this: DatabaseSync, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && !changed) {
      expect(this).not.toBe(f.db); expect(f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
      changed = true;
      f.db.exec("UPDATE fixture_scoring_inputs SET value_json=json_set(value_json,'$.revision',99) WHERE kind='review'");
    }
    return Reflect.apply(exec, this, [sql]);
  } });
  try { expect(() => owner.enqueue(f.source.sourceId)).toThrow(/review|pin|revision|head|changed/); }
  finally { Object.defineProperty(Database.prototype, 'exec', descriptor); }
  expect(changed).toBe(true); expect(rows(f.db, sourceTable)).toEqual([]); expect(scoredRows(f.db)).toBe(0);
  expect(fixtureInput(f.db, 'review').revision).toBe(99);
});

it('rejects accepted callback changes inside enqueue and keeps historical reads callback-free', () => {
  const f = fixture(); let reads = 0;
  const owner = f.open({ readAcceptedScoringSource: () => ++reads === 1 ? f.source : { ...f.source, sourceVersion: 'changed' } });
  expect(() => owner.enqueue(f.source.sourceId)).toThrow(/frozen|different|changed/);
  expect(reads).toBeGreaterThan(1); expect(rows(f.db, sourceTable)).toEqual([]);
  const acceptedOwner = f.open(), accepted = acceptedOwner.submit(f.source.sourceId);
  const historical = f.open({ readAcceptedScoringSource: () => { throw new Error('historical read invoked authority'); } });
  expect(historical.read(f.source.sourceId)?.result).toEqual(accepted);
});

it.each(['source', 'scoring'] as const)('witnesses %s INSERT before a local raw scorer archive mutation rolls back', stage => {
  const f = fixture(), owner = f.open(); if (stage === 'scoring') owner.enqueue(f.source.sourceId);
  const before = rows(f.db, sourceTable), preserved = f.preserved();
  const table = stage === 'source' ? sourceTable : 'official_scoring_applications';
  f.db.exec(`CREATE TRIGGER corrupt_score_archive AFTER INSERT ON ${table} BEGIN
    UPDATE ${table} SET ${stage === 'source' ? "source_json=json_set(source_json,'$.sourceVersion','changed')" : "result_json=json_set(result_json,'$.record.hitsCredited',0)"}; END;`);
  const witness = witnessSqliteWrite(new RegExp(`^\\s*INSERT\\s+INTO\\s+${table}\\b`, 'i'), connection => count(connection,table) === 1);
  try { expect(() => stage === 'source' ? owner.enqueue(f.source.sourceId) : owner.resume(f.source.sourceId)).toThrow(); expect(witness.wasReached()).toBe(true); }
  finally { witness.close(); }
  expect(rows(f.db, sourceTable)).toEqual(before); expect(scoredRows(f.db)).toBe(0); expect(f.preserved()).toEqual(preserved);
});


it.each(['base_hit', 'reached_on_error'] as const)('feeds accepted %s into existing contiguous line-score history exactly once', async kind => {
  const { readPhysicalClosureScoringHistory, derivePhysicalClosureLineScore } = await import('./PhysicalPlayClosureEvidenceFromSqlite');
  const f = fixture({ opening: true }), owner = f.open();
  f.sources.set(f.source.sourceId, { ...f.source, evidence: { ...f.source.evidence,
    judgment: kind === 'base_hit' ? { kind } : { kind, chargedFielderId: 'HOME-3' } } });
  owner.submit(f.source.sourceId); owner.resume(f.source.sourceId);
  const frame = { gameId: f.source.gameId, officialRevision: 1 };
  const history = readPhysicalClosureScoringHistory(f.db, frame);
  expect(history).toHaveLength(1);
  expect(history[0].scoring.scoringApplicationId).toBe(f.source.scoringApplicationId);
  expect(derivePhysicalClosureLineScore(history)).toEqual({
    innings: [{ inning: 1, awayRuns: 0, homeRuns: null }],
    totals: { away: { runs: 0, hits: kind === 'base_hit' ? 1 : 0, errors: 0 },
      home: { runs: 0, hits: 0, errors: kind === 'reached_on_error' ? 1 : 0 } },
  });
});

it('keeps missing prior scoring and incomplete game history explicit in the existing line-score consumer', async () => {
  const { readPhysicalClosureScoringHistory, derivePhysicalClosureLineScore } = await import('./PhysicalPlayClosureEvidenceFromSqlite');
  const f = fixture(), owner = f.open(), frame = { gameId: f.source.gameId, officialRevision: 1 };
  expect(() => readPhysicalClosureScoringHistory(f.db, frame)).toThrow('prior scoring history is missing');
  owner.submit(f.source.sourceId);
  expect(() => derivePhysicalClosureLineScore(readPhysicalClosureScoringHistory(f.db, frame))).toThrow('game history is incomplete');
  expect(() => readPhysicalClosureScoringHistory(f.db, { ...frame, officialRevision: 2 })).toThrow('prior application history is missing');
});

const receiptAliasCases = (['raw', 'escaped_duplicate'] as const).flatMap(encoding =>
  (['staging', 'closure_proposal', 'closure_result', 'application'] as const).flatMap(owner =>
    (['activation', 'result'] as const).flatMap(branch =>
      (['applicationId', 'closureId'] as const).map(field => ({ encoding, owner, branch, field })) )));
it.each(receiptAliasCases)('rejects $encoding $owner $branch $field ownership hidden in a rival raw receipt', c => {
  const f = fixture(), owner = f.open(); owner.enqueue(f.source.sourceId);
  const target = c.field === 'applicationId' ? 'apply' : 'closure';
  const key = c.field === 'applicationId' ? 'application\\u0049d' : 'closure\\u0049d';
  // Both spellings decode to the same ownership key. JSON.parse would retain
  // the last foreign value and hide the earlier target claim.
  const nested = c.encoding === 'raw' ? `{${JSON.stringify(c.field)}:${JSON.stringify(target)}}`
    : `{"${key}":${JSON.stringify(target)},${JSON.stringify(c.field)}:"hidden-owner"}`;
  const receipt = `{"${c.branch}":${nested}}`;
  const source = { ...f.source, sourceId: 'hidden-source', gameId: 'hidden-game', scoringApplicationId: 'hidden-score',
    closureReference: { ...f.source.closureReference, sourceId: 'hidden-closure' },
    evidence: { ...f.source.evidence, sourceEventId: 'hidden-source', closureId: 'hidden-closure', playId: 999 } };
  if (c.owner === 'staging') {
    const proposal = `{"source":${json(source)},"originalReceipt":${receipt}}`;
    f.db.prepare(`INSERT INTO ${sourceTable}(source_id,game_id,play_id,closure_id,scoring_application_id,official_application_id,status,source_json,source_hash,proposal_json,proposal_hash,result_json)
      VALUES('hidden-source','hidden-game',999,'hidden-closure','hidden-score','hidden-apply','QUEUED',?,'opaque',?,'opaque',NULL)`).run(json(source), proposal);
  } else if (c.owner === 'closure_proposal' || c.owner === 'closure_result') {
    const proposal = c.owner === 'closure_proposal' ? `{"expectedOfficial":${receipt}}` : '{}';
    const result = c.owner === 'closure_result' ? `{"official":${receipt}}` : null;
    f.db.prepare(`INSERT INTO actual_live_play_closures(source_id,game_id,play_id,application_id,status,source_json,source_hash,proposal_json,proposal_hash,result_json)
      VALUES('hidden-closure','hidden-game',999,'hidden-apply',?,'{}','opaque',?,'opaque',?)`)
      .run(result === null ? 'QUEUED' : 'OFFICIAL_APPLIED', proposal, result);
  } else {
    f.db.prepare('INSERT INTO matches(match_id,durable_revision,state_json,activation_json) VALUES(?,?,?,NULL)').run('hidden-game',0,json(f.before));
    f.db.prepare('INSERT INTO applications(application_id,match_id,closure_id,request_hash,result_json) VALUES(?,?,?,?,?)')
      .run('hidden-apply','hidden-game','hidden-closure','opaque',receipt);
  }
  const archives = rows(f.db, sourceTable), preserved = f.preserved();
  expect(() => owner.read(f.source.sourceId)).toThrow(/ownership/);
  expect(rows(f.db, sourceTable)).toEqual(archives); expect(f.preserved()).toEqual(preserved); expect(scoredRows(f.db)).toBe(0);
});

const receiptScopeCases = (['raw', 'escaped_duplicate'] as const).flatMap(encoding =>
  (['staging', 'closure_proposal', 'closure_result', 'application'] as const).flatMap(owner =>
    (owner === 'staging' ? ['activation', 'result'] as const : ['receipt', 'activation', 'result'] as const)
      .map(branch => ({ encoding, owner, branch, field: branch === 'result' ? 'gameId' as const : 'previousPlayId' as const }))));
type ReceiptScopeCase = typeof receiptScopeCases[number];
const insertReceiptScopeRival = (f: ReturnType<typeof fixture>, c: ReceiptScopeCase, targetClaim = true) => {
  const playClaim = c.field === 'previousPlayId';
  const gameId = playClaim ? f.source.gameId : 'hidden-game', playId = playClaim ? 999 : f.source.evidence.playId;
  const target = playClaim ? f.source.evidence.playId : f.source.gameId;
  const foreign = playClaim ? 999 : 'hidden-game';
  const key = playClaim ? 'previousPlay\\u0049d' : 'game\\u0049d';
  const nested = c.encoding === 'escaped_duplicate' && targetClaim
    ? `{"${key}":${json(target)},${json(c.field)}:${json(foreign)}}`
    : `{${json(c.field)}:${json(targetClaim ? target : foreign)}}`;
  const receipt = `{"${c.branch}":${nested}${playClaim ? '' : `,"receipt":{"previousPlayId":${playId}}`}}`;
  const source = { ...f.source, sourceId: 'scope-rival', gameId, scoringApplicationId: 'scope-rival-score',
    closureReference: { ...f.source.closureReference, sourceId: 'scope-rival-closure' },
    evidence: { ...f.source.evidence, sourceEventId: 'scope-rival', closureId: 'scope-rival-closure', playId } };
  if (c.owner === 'staging') {
    const proposal = `{"source":${json(source)},"originalReceipt":${receipt}}`;
    f.db.prepare(`INSERT INTO ${sourceTable}(source_id,game_id,play_id,closure_id,scoring_application_id,official_application_id,status,source_json,source_hash,proposal_json,proposal_hash,result_json)
      VALUES('scope-rival',?,?,'scope-rival-closure','scope-rival-score','scope-rival-apply','QUEUED',?,'opaque',?,'opaque',NULL)`).run(gameId, playId, json(source), proposal);
  } else if (c.owner === 'closure_proposal' || c.owner === 'closure_result') {
    const proposal = c.owner === 'closure_proposal' ? `{"expectedOfficial":${receipt}}` : '{}';
    const result = c.owner === 'closure_result' ? `{"official":${receipt}}` : null;
    f.db.prepare(`INSERT INTO actual_live_play_closures(source_id,game_id,play_id,application_id,status,source_json,source_hash,proposal_json,proposal_hash,result_json)
      VALUES('scope-rival-closure',?,?,'scope-rival-apply',?,'{}','opaque',?,'opaque',?)`)
      .run(gameId, playId, result === null ? 'QUEUED' : 'OFFICIAL_APPLIED', proposal, result);
  } else {
    if (gameId !== f.source.gameId) f.db.prepare('INSERT INTO matches VALUES(?,0,?,NULL)').run(gameId,json(f.before));
    f.db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('scope-rival-apply',gameId,'scope-rival-closure','opaque',receipt);
  }
};
it.each(receiptScopeCases)('rejects $encoding $owner $branch $field scope hidden in a rival raw receipt', c => {
  const f = fixture(), owner = f.open(); owner.enqueue(f.source.sourceId); insertReceiptScopeRival(f,c);
  const archives = rows(f.db, sourceTable), preserved = f.preserved();
  expect(() => owner.read(f.source.sourceId)).toThrow(/ownership/);
  expect(rows(f.db, sourceTable)).toEqual(archives); expect(f.preserved()).toEqual(preserved); expect(scoredRows(f.db)).toBe(0);
});
it.each(['staging', 'closure_proposal', 'closure_result', 'application'] as const)(
  'keeps unrelated later-play %s metadata outside the original game and play ownership pair', scope => {
    const f = fixture(), owner = f.open(), accepted = owner.enqueue(f.source.sourceId);
    insertReceiptScopeRival(f, { encoding: 'raw', owner: scope, branch: 'activation', field: 'previousPlayId' }, false);
    const archives = rows(f.db, sourceTable), preserved = f.preserved();
    expect(owner.read(f.source.sourceId)).toEqual(accepted);
    expect(rows(f.db, sourceTable)).toEqual(archives); expect(f.preserved()).toEqual(preserved); expect(scoredRows(f.db)).toBe(0);
  });

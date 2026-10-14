import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect, it } from 'vitest';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { prepareTerminalScoringCopy, requireTerminalScoring, scoringRows,
  type TerminalScoringStore } from './ActualFoulTerminalScoringFixture.test-support';

const literal = (value: string): string => "'" + value.replaceAll("'", "''") + "'";
const cleanup = (primary: unknown, failed: boolean, tasks: readonly (() => void)[]) => {
  const errors: unknown[] = [];
  for (const task of tasks) { try { task(); } catch (error) { errors.push(error); } }
  if (errors.length) throw new AggregateError(failed ? [primary, ...errors] : errors, 'terminal scoring test cleanup failed');
};
const sameDescriptor = (actual: PropertyDescriptor | undefined, expected: PropertyDescriptor) => actual !== undefined
  && (['configurable', 'enumerable', 'value', 'writable', 'get', 'set'] as const).every(key => actual[key] === expected[key]);

for (const fault of ['pitch', 'count', 'end', 'journal', 'acknowledgement', 'application', 'match',
  'inserted_result', 'inserted_identity', 'inserted_delete', 'byte_neutral_write',
  'mutate_restore', 'unrelated_write', 'raw_only_competitor'] as const)
it('S02 genuine terminal scoring rolls back real AFTER INSERT fault ' + fault, async () => {
  const f = prepareTerminalScoringCopy(), db = f.db, p = f.saved.proposal;
  let scorer: TerminalScoringStore | undefined, witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  let writer: Database | undefined, primary: unknown, failed = false;
  try {
    const open = await requireTerminalScoring();
    let mutation: string, verify: (connection: Database) => boolean;
    if (fault === 'inserted_result') {
      mutation = "UPDATE official_scoring_applications SET result_json='{}' WHERE scoring_application_id=NEW.scoring_application_id;";
      verify = connection => connection.prepare('SELECT result_json FROM official_scoring_applications WHERE scoring_application_id=?')
        .get(f.expected.scoringApplicationId)?.result_json === '{}';
    } else if (fault === 'inserted_identity') {
      mutation = "UPDATE official_scoring_applications SET scoring_application_id='foreign-scoring-id' WHERE scoring_application_id=NEW.scoring_application_id;";
      verify = connection => connection.prepare("SELECT 1 AS found FROM official_scoring_applications WHERE scoring_application_id='foreign-scoring-id'")
        .get()?.found === 1;
    } else if (fault === 'inserted_delete') {
      mutation = 'DELETE FROM official_scoring_applications WHERE scoring_application_id=NEW.scoring_application_id;';
      verify = connection => !connection.prepare('SELECT 1 FROM official_scoring_applications WHERE scoring_application_id=?')
        .get(f.expected.scoringApplicationId);
    } else if (fault === 'byte_neutral_write') {
      mutation = 'UPDATE matches SET state_json=state_json WHERE match_id=' + literal(p.gameId) + ';';
      verify = connection => connection.prepare('SELECT total_changes() AS n').get()!.n === 2;
    } else if (fault === 'mutate_restore') {
      const original = String(db.prepare('SELECT state_json FROM matches WHERE match_id=?').get(p.gameId)!.state_json);
      mutation = "UPDATE matches SET state_json='{}' WHERE match_id=" + literal(p.gameId) + ';'
        + 'UPDATE matches SET state_json=' + literal(original) + ' WHERE match_id=' + literal(p.gameId) + ';';
      verify = connection => connection.prepare('SELECT total_changes() AS n').get()!.n === 3
        && connection.prepare('SELECT state_json FROM matches WHERE match_id=?').get(p.gameId)!.state_json === original;
    } else if (fault === 'unrelated_write') {
      db.exec("CREATE TABLE terminal_scoring_fault_probe(value TEXT); INSERT INTO terminal_scoring_fault_probe VALUES('before')");
      mutation = "UPDATE terminal_scoring_fault_probe SET value='after';";
      verify = connection => connection.prepare('SELECT value FROM terminal_scoring_fault_probe').get()!.value === 'after';
    } else if (fault === 'raw_only_competitor') {
      // Deliberately invalid unrelated application metadata supplies only an
      // FK target for the corruption trigger. It is never an accepted second
      // origin, genuine fixture or a qualification claim for another play.
      db.prepare('INSERT INTO applications(application_id,match_id,closure_id,request_hash,result_json) VALUES(?,?,?,?,?)')
        .run('fault-foreign-application', p.gameId, 'fault-foreign-closure', 'fault-invalid-hash', '{}');
      const claim = JSON.stringify({ input: { officialApplication: { origin: {
        owner: 'actual_foul_terminal_applications', sourceId: f.sourceId } } } });
      mutation = 'INSERT INTO official_scoring_applications(scoring_application_id,match_id,official_application_id,closure_id,source_event_id,request_json,result_json)'
        + " VALUES('fault-foreign-scoring','fault-foreign-game','fault-foreign-application','fault-foreign-closure','fault-foreign-event',"
        + literal(claim) + ",'{}');";
      verify = connection => connection.prepare("SELECT request_json FROM official_scoring_applications WHERE scoring_application_id='fault-foreign-scoring'")
        .get()?.request_json === claim;
    } else {
      const [table, column, key, value] = fault === 'pitch'
        ? ['physical_pitch_progress_actions', 'snapshot_hash', 'source_id', p.physicalPitchSourceId]
        : fault === 'count' ? ['actual_foul_rule_consumptions', 'snapshot_hash', 'source_id', p.consumptionReference.sourceId]
        : fault === 'end' ? ['actual_foul_play_ends', 'snapshot_hash', 'source_id', p.physicalEndReference.sourceId]
        : fault === 'journal' ? ['actual_foul_official_events', 'source_hash', 'source_id', p.officialReference.headSourceId]
        : fault === 'acknowledgement' ? ['actual_foul_terminal_applications', 'result_json', 'source_id', f.sourceId]
        : fault === 'application' ? ['applications', 'request_hash', 'application_id', p.source.applicationId]
        : ['matches', 'activation_json', 'match_id', p.gameId];
      mutation = 'UPDATE ' + table + ' SET ' + column + "='corrupt-scoring-dependency' WHERE " + key + '=' + literal(value) + ';';
      verify = connection => connection.prepare('SELECT ' + column + ' AS value FROM main.' + table + ' WHERE ' + key + '=?')
        .get(value)?.value === 'corrupt-scoring-dependency';
    }
    witness = witnessSqliteWrite(/INSERT INTO (?:main\.)?official_scoring_applications\b/, connection => {
      writer = connection; return connection.isTransaction && verify(connection);
    });
    scorer = open(f.path);
    db.exec('CREATE TRIGGER terminal_scoring_fault AFTER INSERT ON official_scoring_applications '
      + 'WHEN NEW.scoring_application_id=' + literal(f.expected.scoringApplicationId) + ' BEGIN ' + mutation + ' END');
    const before = rawCensus(db), schema = schemaCensus(db);
    expect(() => scorer!.apply(f.sourceId)).toThrow(); expect(witness.wasReached()).toBe(true);
    expect(writer!.isTransaction).toBe(false);
    expect(writer!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(rawCensus(db)).toEqual(before); expect(schemaCensus(db)).toEqual(schema);
    expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } catch (error) { primary = error; failed = true; throw error; }
  finally { cleanup(primary, failed, [() => witness?.close(), () => scorer?.close(), () => db.close()]); }
}, 1_200_000);

it('S03 genuine terminal scoring rejects a peer commit just before write acquisition', async () => {
  const f = prepareTerminalScoringCopy(), db = f.db;
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let scorer: TerminalScoringStore | undefined, witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  let writer: Database | undefined, committed = false, inserted = false, patched = false;
  let descriptor: PropertyDescriptor | undefined, installed: PropertyDescriptor | undefined;
  let primary: unknown, failed = false;
  try {
    const open = await requireTerminalScoring();
    witness = witnessSqliteWrite(/INSERT INTO (?:main\.)?official_scoring_applications\b/, () => { inserted = true; return true; });
    scorer = open(f.path);
    descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec');
    if (!descriptor || typeof descriptor.value !== 'function') throw new Error('real SQLite exec descriptor is missing');
    const exec = descriptor.value as Database['exec'];
    installed = { ...descriptor, value: function(this: Database, sql: string) {
      if (!committed && sql === 'BEGIN IMMEDIATE') {
        committed = true; writer = this;
        db.prepare('UPDATE matches SET durable_revision=durable_revision+1 WHERE match_id=?').run(f.saved.proposal.gameId);
        expect(db.isTransaction).toBe(false);
      }
      return Reflect.apply(exec, this, [sql]);
    } };
    const beforeScoring = scoringRows(db), before = rawCensus(db), schema = schemaCensus(db);
    Object.defineProperty(DatabaseSync.prototype, 'exec', installed); patched = true;
    expect(() => scorer!.apply(f.sourceId)).toThrow();
    expect(committed).toBe(true); expect(inserted).toBe(false);
    expect(writer!.isTransaction).toBe(false);
    expect(writer!.prepare('SELECT total_changes() AS n').get()!.n).toBe(0);
    expect(scoringRows(db)).toEqual(beforeScoring);
    expect(rawCensus(db)).toEqual(before.map(owner => owner.table === 'matches' ? { ...owner,
      rows: owner.rows.map(row => row.match_id === f.saved.proposal.gameId
        ? { ...row, durable_revision: Number(row.durable_revision) + 1 } : row) } : owner));
    expect(schemaCensus(db)).toEqual(schema);
    expect(db.prepare('SELECT durable_revision FROM matches WHERE match_id=?').get(f.saved.proposal.gameId)!.durable_revision)
      .toBe(f.saved.result.official.receipt.durableRevision + 1);
    expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } catch (error) { primary = error; failed = true; throw error; }
  finally { cleanup(primary, failed, [() => witness?.close(), () => {
    if (!patched) return;
    if (!sameDescriptor(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec'), installed!)) {
      throw new Error('later SQLite exec interceptor was preserved');
    }
    Object.defineProperty(DatabaseSync.prototype, 'exec', descriptor!);
  }, () => scorer?.close(), () => db.close()]); }
}, 1_200_000);

it('S04 genuine terminal scoring retires its handle after transaction identity replacement', async () => {
  const f = prepareTerminalScoringCopy(), db = f.db;
  let scorer: TerminalScoringStore | undefined, witness: ReturnType<typeof witnessSqliteWrite> | undefined;
  let writer: Database | undefined, primary: unknown, failed = false;
  try {
    const open = await requireTerminalScoring();
    witness = witnessSqliteWrite(/INSERT INTO (?:main\.)?official_scoring_applications\b/, connection => {
      writer = connection; expect(connection.isTransaction).toBe(true);
      connection.exec('ROLLBACK; BEGIN IMMEDIATE'); return true;
    });
    scorer = open(f.path);
    const before = rawCensus(db), schema = schemaCensus(db);
    expect(() => scorer!.apply(f.sourceId)).toThrow(); expect(witness.wasReached()).toBe(true);
    expect(() => scorer!.read(f.sourceId)).toThrow(/closed|retired/);
    expect(() => writer!.prepare('SELECT 1')).toThrow();
    expect(rawCensus(db)).toEqual(before); expect(schemaCensus(db)).toEqual(schema);
    expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } catch (error) { primary = error; failed = true; throw error; }
  finally { cleanup(primary, failed, [() => witness?.close(), () => scorer?.close(), () => db.close()]); }
}, 1_200_000);

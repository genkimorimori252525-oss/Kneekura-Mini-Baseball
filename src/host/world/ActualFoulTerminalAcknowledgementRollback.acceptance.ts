import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect,it } from 'vitest';
import { officialStateSerialized as json } from '../OfficialStateEncoding';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { rawCensus,schemaCensus,fileHash }
  from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { expectedAcknowledgement } from './ActualFoulTerminalAcknowledgementWire.test-support';
import { prepareIntegrityFixture } from './ActualFoulTerminalAcknowledgementIntegrity.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const sourceId = 'terminal-application';
const sql = (value:string) => "'" + value.replaceAll("'","''") + "'";
const cleanup = (failed:boolean,primary:unknown,steps:readonly (() => void)[]) => {
  const errors:unknown[] = [];
  for (const step of steps) { try { step(); } catch (error) { errors.push(error); } }
  if (errors.length) throw new AggregateError(failed ? [primary,...errors] : errors,'acknowledgement test cleanup failed');
};
const sameDescriptor = (actual:PropertyDescriptor | undefined,expected:PropertyDescriptor) => actual !== undefined
  && (['configurable','enumerable','value','writable','get','set'] as const).every(key => actual[key] === expected[key]);
const prepare = () => prepareIntegrityFixture('capable-applied');

it.each(['end','pitch','journal','application','match','acknowledgement_only_claim','unrelated_write'] as const)
('A17 genuine acknowledgement rolls back the real terminal UPDATE after %s trigger effect',async fault => {
  const f = await prepare(),db = f.observer,p = f.applied.proposal;
  let primary:unknown,failed = false,witness:ReturnType<typeof witnessSqliteWrite> | undefined;
  try {
    let mutation:string,verify:(connection:Database) => boolean;
    if (fault === 'acknowledgement_only_claim') {
      const ackId = expectedAcknowledgement(f.applied).acknowledgementId;
      mutation = 'INSERT INTO actual_foul_terminal_applications VALUES(' + [
        'foreign-terminal','foreign-game',991,'foreign-application','foreign-pitch','foreign-end','foreign-child',
        'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY','{}','bad','{}','bad',
        json({ acknowledgement:{ acknowledgementId:ackId } }),
      ].map(value => typeof value === 'number' ? String(value) : sql(value)).join(',') + ');';
      verify = connection => !!connection.prepare("SELECT 1 FROM actual_foul_terminal_applications WHERE source_id='foreign-terminal'").get();
    } else if (fault === 'unrelated_write') {
      db.exec('CREATE TABLE acknowledgement_unrelated_probe(value TEXT)');
      mutation = "INSERT INTO acknowledgement_unrelated_probe VALUES('extra-change');";
      verify = connection => connection.prepare('SELECT count(*) AS n FROM acknowledgement_unrelated_probe').get()!.n === 1;
    } else {
      const [table,column,key,value] = fault === 'end' ? ['actual_foul_play_ends','snapshot_hash','source_id',p.physicalEndReference.sourceId]
        : fault === 'pitch' ? ['physical_pitch_progress_actions','snapshot_hash','source_id',p.physicalPitchSourceId]
        : fault === 'journal' ? ['actual_foul_official_events','source_hash','source_id',p.officialReference.headSourceId]
        : fault === 'application' ? ['applications','request_hash','application_id',p.source.applicationId]
        : ['matches','activation_json','match_id',p.gameId];
      mutation = 'UPDATE ' + table + ' SET ' + column + "='corrupt-acknowledgement-dependency' WHERE " + key + '=' + sql(value) + ';';
      verify = connection => connection.prepare('SELECT ' + column + ' AS value FROM ' + table + ' WHERE ' + key + '=?')
        .get(value)!.value === 'corrupt-acknowledgement-dependency';
    }
    db.exec('CREATE TRIGGER acknowledgement_rollback AFTER UPDATE OF status,result_json ON actual_foul_terminal_applications '
      + 'WHEN NEW.source_id=' + sql(sourceId) + ' BEGIN ' + mutation + ' END');
    const before = rawCensus(db),schema = schemaCensus(db);
    let writer:Database | undefined;
    witness = witnessSqliteWrite(/UPDATE main\.actual_foul_terminal_applications\b/,connection => {
      writer = connection; return connection.isTransaction && verify(connection);
    });
    expect(() => f.runner.acknowledge!(sourceId)).toThrow(); expect(witness.wasReached()).toBe(true);
    expect(writer!.isTransaction).toBe(false); expect(writer!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(rawCensus(db)).toEqual(before); expect(schemaCensus(db)).toEqual(schema);
    expect(fileHash(f.producer.sourcePath)).toBe(f.producer.sourceSha256);
  } catch (error) { primary = error; failed = true; throw error; }
  finally { cleanup(failed,primary,[() => witness?.close(),() => f.close()]); }
},1_200_000);

it('A18 genuine acknowledgement rejects a peer commit before BEGIN IMMEDIATE using fresh evidence',async () => {
  const f = await prepare(),db = f.observer,p = f.applied.proposal;
  let peerCommitted = false,writer:Database | undefined,writerReached = false;
  let descriptor:PropertyDescriptor | undefined,installed:PropertyDescriptor | undefined,patched = false;
  let witness:ReturnType<typeof witnessSqliteWrite> | undefined,primary:unknown,failed = false;
  try {
    descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'exec');
    if (!descriptor || typeof descriptor.value !== 'function') throw new Error('real SQLite exec descriptor is missing');
    const originalExec = descriptor.value as Database['exec'];
    installed = { ...descriptor,value:function(this:Database,text:string) {
      if (!peerCommitted && text === 'BEGIN IMMEDIATE') {
        peerCommitted = true; writer = this;
        db.prepare('UPDATE matches SET durable_revision=durable_revision+1 WHERE match_id=?').run(p.gameId);
        expect(db.isTransaction).toBe(false);
      }
      return Reflect.apply(originalExec,this,[text]);
    } };
    Object.defineProperty(DatabaseSync.prototype,'exec',installed); patched = true;
    witness = witnessSqliteWrite(/UPDATE main\.actual_foul_terminal_applications\b/,() => { writerReached = true; return true; });
    const before = db.prepare('SELECT * FROM actual_foul_terminal_applications').all();
    expect(() => f.runner.acknowledge!(sourceId)).toThrow();
    expect(peerCommitted).toBe(true); expect(writerReached).toBe(false);
    expect(writer!.isTransaction).toBe(false); expect(writer!.prepare('SELECT total_changes() AS n').get()!.n).toBe(0);
    expect(db.prepare('SELECT * FROM actual_foul_terminal_applications').all()).toEqual(before);
    expect(db.prepare('SELECT durable_revision FROM matches WHERE match_id=?').get(p.gameId)!.durable_revision)
      .toBe(f.applied.result.official.receipt.durableRevision + 1);
  } catch (error) { primary = error; failed = true; throw error; }
  finally { cleanup(failed,primary,[() => witness?.close(),() => {
    if (!patched) return;
    if (!sameDescriptor(Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'exec'),installed!)) throw new Error('later exec interceptor preserved');
    Object.defineProperty(DatabaseSync.prototype,'exec',descriptor!);
  },() => f.close()]); }
},1_200_000);

it('A19 genuine acknowledgement retires its handle after transaction identity replacement',async () => {
  const f = await prepare(),db = f.observer;
  let writer:Database | undefined,witness:ReturnType<typeof witnessSqliteWrite> | undefined,primary:unknown,failed = false;
  try {
    const before = rawCensus(db),schema = schemaCensus(db);
    witness = witnessSqliteWrite(/UPDATE main\.actual_foul_terminal_applications\b/,connection => {
      writer = connection;
      expect(connection.isTransaction).toBe(true);
      connection.exec('ROLLBACK; BEGIN IMMEDIATE');
      return true;
    });
    expect(() => f.runner.acknowledge!(sourceId)).toThrow(); expect(witness.wasReached()).toBe(true);
    expect(() => f.runner.read(sourceId)).toThrow(/closed|retired/);
    expect(() => writer!.prepare('SELECT 1')).toThrow();
    expect(rawCensus(db)).toEqual(before); expect(schemaCensus(db)).toEqual(schema);
  } catch (error) { primary = error; failed = true; throw error; }
  finally { cleanup(failed,primary,[() => witness?.close(),() => f.close()]); }
},1_200_000);

it('A20 genuine acknowledgement preserves primary failure and retires after rollback cleanup failure',async () => {
  const f = await prepare(),db = f.observer;
  let descriptor:PropertyDescriptor | undefined,installed:PropertyDescriptor | undefined,patched = false;
  let witness:ReturnType<typeof witnessSqliteWrite> | undefined,writer:Database | undefined;
  let injected = false,primary:unknown,failed = false;
  try {
    db.exec('CREATE TRIGGER acknowledgement_cleanup_fault AFTER UPDATE OF status,result_json ON actual_foul_terminal_applications '
      + 'WHEN NEW.source_id=' + sql(sourceId) + " BEGIN UPDATE actual_foul_play_ends SET snapshot_hash='corrupt-cleanup-proof' WHERE source_id="
      + sql(f.applied.proposal.physicalEndReference.sourceId) + '; END');
    const before = rawCensus(db),schema = schemaCensus(db);
    descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'exec');
    if (!descriptor || typeof descriptor.value !== 'function') throw new Error('real SQLite exec descriptor is missing');
    const originalExec = descriptor.value as Database['exec'];
    installed = { ...descriptor,value:function(this:Database,text:string) {
      if (!injected && /^ROLLBACK TO terminal_application_(?!proof_)/.test(text)) {
        injected = true; throw new Error('ACK_TEST_ROLLBACK_TO_FAILED');
      }
      return Reflect.apply(originalExec,this,[text]);
    } };
    Object.defineProperty(DatabaseSync.prototype,'exec',installed); patched = true;
    witness = witnessSqliteWrite(/UPDATE main\.actual_foul_terminal_applications\b/,connection => {
      writer = connection;
      return connection.isTransaction && connection.prepare('SELECT snapshot_hash FROM actual_foul_play_ends WHERE source_id=?')
        .get(f.applied.proposal.physicalEndReference.sourceId)!.snapshot_hash === 'corrupt-cleanup-proof';
    });
    let rejection:unknown;
    try { f.runner.acknowledge!(sourceId); } catch (error) { rejection = error; }
    expect(witness.wasReached()).toBe(true); expect(injected).toBe(true);
    expect(rejection).toBeInstanceOf(AggregateError);
    const messages = (error:unknown):string[] => error instanceof AggregateError
      ? [error.message,...error.errors.flatMap(messages)] : error instanceof Error ? [error.message] : [String(error)];
    expect(messages(rejection).join('\n')).toContain('ACK_TEST_ROLLBACK_TO_FAILED');
    expect((rejection as AggregateError).cause).toBeInstanceOf(Error);
    expect(() => writer!.prepare('SELECT 1')).toThrow();
    expect(() => f.runner.read(sourceId)).toThrow(/closed|retired/);
    expect(rawCensus(db)).toEqual(before); expect(schemaCensus(db)).toEqual(schema);
    expect(fileHash(f.producer.sourcePath)).toBe(f.producer.sourceSha256);
  } catch (error) { primary = error; failed = true; throw error; }
  finally { cleanup(failed,primary,[() => witness?.close(),() => {
    if (!patched) return;
    if (!sameDescriptor(Object.getOwnPropertyDescriptor(DatabaseSync.prototype,'exec'),installed!)) throw new Error('later exec interceptor preserved');
    Object.defineProperty(DatabaseSync.prototype,'exec',descriptor!);
  },() => f.close()]); }
},1_200_000);

it.each(['main','temp','user'] as const)
('A21 genuine acknowledgement rolls back a real writer %s schema change',async scope => {
  const f = await prepare(),db = f.observer;
  let witness:ReturnType<typeof witnessSqliteWrite> | undefined,writer:Database | undefined;
  let writerSchema:ReturnType<typeof schemaCensus> | undefined,primary:unknown,failed = false;
  try {
    const before = rawCensus(db),schema = schemaCensus(db);
    witness = witnessSqliteWrite(/UPDATE main\.actual_foul_terminal_applications\b/,connection => {
      writer = connection; writerSchema = schemaCensus(connection);
      expect(connection.isTransaction).toBe(true);
      if (scope === 'main') connection.exec('CREATE TABLE acknowledgement_schema_fault(value TEXT)');
      else if (scope === 'temp') connection.exec('CREATE TEMP TABLE acknowledgement_schema_fault(value TEXT)');
      else connection.exec('PRAGMA main.user_version=4');
      expect(schemaCensus(connection)).not.toEqual(writerSchema);
      return true;
    });
    expect(() => f.runner.acknowledge!(sourceId)).toThrow(); expect(witness.wasReached()).toBe(true);
    expect(writer!.isTransaction).toBe(false); expect(writer!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(schemaCensus(writer!)).toEqual(writerSchema);
    expect(rawCensus(db)).toEqual(before); expect(schemaCensus(db)).toEqual(schema);
  } catch (error) { primary = error; failed = true; throw error; }
  finally { cleanup(failed,primary,[() => witness?.close(),() => f.close()]); }
},1_200_000);

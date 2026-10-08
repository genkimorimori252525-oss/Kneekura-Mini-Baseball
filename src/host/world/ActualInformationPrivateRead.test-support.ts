import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { expect, vi } from 'vitest';
import * as fields from './SqliteBattedWorldFieldStore';
import * as executions from './SqliteBattedWorldFieldExecutionStore';
import { actualFirstBaseUmpireFixture } from './ActualFirstBaseUmpireFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';
import { openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import type { AcceptedActualCallCommunication, AcceptedActualCommunicationModel } from './ActualCallCommunication';
import { ownedScheduledMotionPhase } from './OwnedScheduledMotionTiming.test-support';

const { DatabaseSync: Sqlite } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
export type InformationKind = 'observation' | 'communication';
type Event = { name: string; db: DatabaseSync; transaction: boolean; queryOnly: number; writer: boolean;
  frame: object | null; traversal: boolean; depth: number };
type Callback = { transaction: boolean; queryOnly: number; frame: object | null };

// The observer only forwards real owner methods and records their actual private
// connection. Physical SQL/results, accepted rows and Native physics are unchanged.
// The compact legacy race is built prospectively; no failed artifact is reopened.
export const actualInformationPrivateReadFixture = (kind: InformationKind) => {
  const dir = mkdtempSync(join(tmpdir(), `information-private-${kind}-`));
  const cleanups: (() => void)[] = [() => rmSync(dir, { recursive: true, force: true })];
  const close = () => {
    const errors: unknown[] = [];
    while (cleanups.length) { try { cleanups.pop()!(); } catch (error) { errors.push(error); } }
    if (errors.length) throw new AggregateError(errors, 'information private-read cleanup failed');
  };
  try {
    const base = ownedScheduledMotionPhase(`${kind}:private-read-native-fixture`, () =>
      actualFirstBaseUmpireFixture(undefined, 0.04, 0.08, 0.1, join(dir, 'state.sqlite')));
    cleanups.push(() => base.f.close());
    expect(base.physical.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
    expect(base.physical.frame.prePitchRunner).toBeUndefined();
    expect(base.f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    const holder = base.acquired.execution.kind === 'acquisition' && base.acquired.execution.acquisition.kind === 'secured'
      ? base.acquired.execution.acquisition.acquirerPlayerId : null;
    expect(holder).not.toBeNull();
    const defender = base.physical.frame.batterActor!.defenderBindings.find(p => p.playerId !== holder)!;
    expect(defender).toBeDefined();
    const observer = kind === 'observation' ? installSyntheticObservation(base, defender.playerId, base.race.source.sourceId) : null;
    observer?.observations.close();
    let communication: AcceptedActualCallCommunication | null = null;
    let model: AcceptedActualCommunicationModel | null = null;
    if (kind === 'communication') {
      ownedScheduledMotionPhase('communication:private-read-owned-call', () => {
        base.umpires.acceptSetup(base.setup.sourceId); base.umpires.observe(base.observation.sourceId);
        const call = base.umpires.advanceCall(base.call.sourceId);
        expect(call.schedule.kind).toBe('called');
      });
      model = { sourceId: 'private-reception-model', sourceVersion: 'synthetic-v1',
        gameId: base.physical.frame.gameId, physicalPitchSourceId: base.physical.source.sourceId,
        parameters: { version: 'fixed_receiver_conditions_v1', timing: 'exact_sent_plus_core_delay_ticks_v1',
          receivers: [base.physical.frame.batterActor!.binding, ...base.physical.frame.batterActor!.defenderBindings].map(p => ({
            playerId: p.playerId, conditions: { propagationDelayTicks: 2, recognitionBaseDelayTicks: 3,
              maxAdditionalRecognitionDelayTicks: 2, audibility: 0.9, recognition: 0.8, attention: 0.7, minimumRecognizableQuality: 0.1 } })) } };
      communication = { sourceId: 'private-communication', sourceVersion: 'synthetic-v1', callSourceId: base.call.sourceId,
        modelSourceId: model.sourceId, currentExecutionSourceId: base.race.source.sourceId, previousCommunicationSourceId: null };
      const seed = base.f.track(openSqliteActualCommunicationStore(base.f.path, {
        readAcceptedModel: id => id === model!.sourceId ? model : null, readAcceptedCommunication: () => null }));
      seed.acceptModel(model.sourceId); seed.close();
    }

    const events: Event[] = [], callbacks: Callback[] = [], statements: string[] = [];
    const restores: { mockRestore(): void }[] = [];
    let db: DatabaseSync | undefined, writer = false, depth = 0;
    let before: ((event: Event) => void) | undefined, after: ((event: Event) => void) | undefined;
    let authorityHook: ((event: Callback) => void) | undefined;
    const traversals: unknown[] = [];
    cleanups.push(() => {
      before = undefined; after = undefined; authorityHook = undefined;
      try { if (db?.isTransaction) db.exec('ROLLBACK'); }
      finally { while (restores.length) restores.pop()!.mockRestore(); }
    });
    const attach = (raw: unknown) => {
      expect(raw).toBeInstanceOf(Sqlite); const connection = raw as DatabaseSync;
      if (!db) {
        db = connection; const exec = db.exec.bind(db);
        restores.push(vi.spyOn(db, 'exec').mockImplementation(sql => {
          const value = exec(sql); statements.push(sql);
          if (/^BEGIN IMMEDIATE\b/i.test(sql)) writer = true;
          if (/^(COMMIT|ROLLBACK)\s*;?$/i.test(sql)) writer = false;
          return value;
        }));
      }
      expect(connection).toBe(db); return connection;
    };
    const observe = <T>(name: string, raw: unknown, run: () => T): T => {
      const connection = attach(raw), event = { name, db: connection, transaction: connection.isTransaction,
        queryOnly: Number(connection.prepare('PRAGMA query_only').get()!.query_only), writer,
        frame: fields.activeBattedWorldFieldReadFrame(connection), traversal: traversals.includes(connection), depth };
      events.push(event); before?.(event); depth++;
      let value: T; try { value = run(); } finally { depth--; }
      after?.(event); return value;
    };
    const fieldOwner = fields.battedWorldFieldEvidenceFromSqlite;
    restores.push(vi.spyOn(fields, 'battedWorldFieldEvidenceFromSqlite').mockImplementation(connection => {
      attach(connection); const own = fieldOwner(connection);
      return { ...own, read: id => observe('field-read', connection, () => own.read(id)),
        scope: (...args) => observe('field-scope', connection, () => own.scope(...args)),
        current: value => observe('field-current', connection, () => own.current(value)) };
    }));
    const executionOwner = executions.battedWorldFieldExecutionEvidenceFromSqlite;
    restores.push(vi.spyOn(executions, 'battedWorldFieldExecutionEvidenceFromSqlite').mockImplementation(connection => {
      attach(connection); const own = executionOwner(connection);
      return { ...own, read: id => observe('execution-read', connection, () => own.read(id)),
        readWithExecutions: id => observe('execution-pair', connection, () => own.readWithExecutions(id)),
        scope: (...args) => observe('execution-scope', connection, () => own.scope(...args)),
        current: value => observe('execution-current', connection, () => own.current(value)) };
    }));
    const realTraversal = executions.withBattedWorldPhysicalReadTraversal;
    const traversal = <T>(connection: Parameters<typeof realTraversal>[0], body: () => T): T => realTraversal(connection, () => {
      traversals.push(connection); try { return body(); } finally { traversals.pop(); }
    });
    restores.push(vi.spyOn(executions, 'withBattedWorldPhysicalReadTraversal').mockImplementation(traversal));
    const authority = () => {
      expect(db).toBeInstanceOf(Sqlite);
      const event = { transaction: db!.isTransaction, queryOnly: Number(db!.prepare('PRAGMA query_only').get()!.query_only),
        frame: fields.activeBattedWorldFieldReadFrame(db!) };
      callbacks.push(event); authorityHook?.(event);
    };
    const source = observer?.observationSource ?? communication!;
    const store = observer
      ? base.f.track(openSqliteActualFieldObservationStore(base.f.path, { readAcceptedObservation: id => {
        authority(); return observer.observationSources.get(id) ?? null;
      } }))
      : base.f.track(openSqliteActualCommunicationStore(base.f.path, { readAcceptedModel: id => id === model!.sourceId ? model : null,
        readAcceptedCommunication: id => { authority(); return id === communication!.sourceId ? communication : null; } }));
    const table = observer ? 'actual_field_observations' : 'actual_call_communications';
    const headTable = observer ? 'actual_field_observation_heads' : 'actual_call_communication_heads';
    return { ...base, source, table, headTable, events, callbacks, statements, close,
      accept: () => store.accept(source.sourceId), read: () => store.read(source.sourceId),
      connection: () => { expect(db).toBeInstanceOf(Sqlite); return db!; },
      count: () => Number(base.f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n),
      rows: () => base.f.db.prepare(`SELECT * FROM ${table} ORDER BY source_id`).all(),
      setBefore(hook?: (event: Event) => void) { before = hook; },
      setAfter(hook?: (event: Event) => void) { after = hook; },
      setAuthority(hook?: (event: Callback) => void) { authorityHook = hook; } };
  } catch (error) {
    try { close(); } catch (cleanup) { throw new AggregateError([error, cleanup], 'information private-read fixture failed', { cause: error }); }
    throw error;
  }
};

export const expectInformationReadReleased = (x: ReturnType<typeof actualInformationPrivateReadFixture>) => {
  const db = x.connection(); expect(db.isTransaction).toBe(false);
  expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  expect(fields.activeBattedWorldFieldReadFrame(db)).toBeNull();
};

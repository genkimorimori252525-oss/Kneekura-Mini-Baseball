import { expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { fixture, withFixture } from './ActualLivePhysicalActivationReadPairFixtures.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';

// Held source-only regressions. The fixture keeps real activation, readiness,
// closure, settlement and SQLite guards; its lower physical inputs are synthetic.
// These are Native DatabaseSync observations, not an adversarial adapter claim.
// Every mutation case calls the existing activation API from a bare caller BEGIN.
// No explicit test traversal can catch a missing activation-owned outer bracket.
type Fixture = ReturnType<typeof fixture>;
const queryOnly = (db: DatabaseSync) => Number(db.prepare('PRAGMA query_only').get()!.query_only);
const totalChanges = (db: DatabaseSync) => Number(db.prepare('SELECT total_changes() AS changes').get()!.changes);
const probeBytes = (x: Fixture) => json(x.db.prepare('SELECT value FROM activation_read_pair_probe').all());
const caughtFrom = (body: () => unknown): unknown => {
  let failed = false, caught: unknown;
  try { body(); } catch (error) { failed = true; caught = error; }
  expect(failed).toBe(true);
  return caught;
};
const expectCaller = (x: Fixture, frame: object | null = null, setting = 0) => {
  expect(x.db.isTransaction).toBe(true);
  expect(activeBattedWorldFieldReadFrame(x.db)).toBe(frame);
  expect(queryOnly(x.db)).toBe(setting);
};
const expectReference = (x: Fixture, value: ReturnType<Fixture['activate']>) => {
  expect(value).not.toBeNull();
  expect(Object.isFrozen(value)).toBe(true);
  expect(json(value) === json(x.reference)).toBe(true);
};

it('activation guard: owns the full Native owner-capture to application-hash interval from a bare transaction', () => withFixture(fixture(), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  const ownerFrames: (object | null)[] = [], applicationFrames: (object | null)[] = [];
  const beforeFrames: (object | null)[] = [], afterFrames: (object | null)[] = [];
  const innerClosureFrames: (object | null)[] = [];
  const realPrepare = x.db.prepare.bind(x.db);
  const spy = vi.spyOn(x.db, 'prepare').mockImplementation((...args) => {
    const statement = realPrepare(...args), sql = args[0];
    const owner = /^SELECT \* FROM actual_live_play_closures WHERE application_id=\$id\b/.test(sql);
    const closure = /^SELECT \* FROM actual_live_play_closures WHERE source_id=\$id\b/.test(sql);
    const application = sql === 'SELECT * FROM applications WHERE application_id=? AND match_id=?';
    if (owner || closure || application) {
      (owner ? ownerFrames : closure ? innerClosureFrames : applicationFrames).push(activeBattedWorldFieldReadFrame(x.db));
      expect(queryOnly(x.db)).toBe(1); expect(x.db.isTransaction).toBe(true);
    }
    return statement;
  });
  x.restore(() => spy.mockRestore());
  x.hooks.beforeHistorical = (db, sourceId) => {
    expect(db).toBe(x.db); expect(sourceId).toBe(x.targetSourceId);
    beforeFrames.push(activeBattedWorldFieldReadFrame(db));
    expect(queryOnly(x.db)).toBe(1); expect(x.db.isTransaction).toBe(true);
  };
  x.hooks.afterHistorical = (db, sourceId) => {
    expect(db).toBe(x.db); expect(sourceId).toBe(x.targetSourceId);
    afterFrames.push(activeBattedWorldFieldReadFrame(db));
    expect(queryOnly(x.db)).toBe(1); expect(x.db.isTransaction).toBe(true);
  };
  x.db.exec('BEGIN');
  expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull();
  expectReference(x, x.activate());
  expect(beforeFrames).toHaveLength(1); expect(afterFrames).toHaveLength(1);
  const owned = beforeFrames[0];
  expect(owned).not.toBeNull(); expect(afterFrames[0]).toBe(owned);
  expect(ownerFrames).toHaveLength(2); expect(applicationFrames).toHaveLength(1);
  expect(ownerFrames.every(frame => frame === owned)).toBe(true);
  expect(applicationFrames[0]).toBe(owned);
  expect(innerClosureFrames).toHaveLength(1);
  expect(innerClosureFrames[0]).not.toBeNull(); expect(innerClosureFrames[0]).not.toBe(owned);
  expect(x.counts()).toEqual({ historicalEntries: 1, historicalCompleted: 1, closureAuthentications: 1 });
  expectCaller(x);
  expect(x.archiveBytes() === archives).toBe(true); expect(x.syntheticBytes() === synthetic).toBe(true);
}));

it('activation guard: rejects an ordinary UPDATE after real historical readiness returns', () => withFixture(fixture(), x => {
  const archives = x.archiveBytes(), probe = probeBytes(x);
  let reached = 0, escaped = false;
  x.hooks.afterHistorical = () => {
    x.hooks.afterHistorical = undefined; reached++;
    x.db.exec('UPDATE activation_read_pair_probe SET value=1');
  };
  x.db.exec('BEGIN');
  const caught = caughtFrom(() => { x.activate(); escaped = true; });
  expect(reached).toBe(1); expect(escaped).toBe(false);
  expect(caught).toBeInstanceOf(Error); expect((caught as Error).message).toMatch(/read.?only/i);
  expect(x.counts().historicalCompleted).toBe(1);
  expectCaller(x); expect(probeBytes(x) === probe).toBe(true); expect(x.archiveBytes() === archives).toBe(true);
}));

it('activation guard: rejects two real UPDATEs that restore bytes by checking the outer total_changes stamp', () => withFixture(fixture(), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes(), probe = probeBytes(x);
  let reached = 0, escaped = false, changesBefore = -1, changesAfter = -1, restoredSetting = -1;
  const writes: number[] = [];
  x.hooks.afterHistorical = () => {
    // Run once even on the legacy two-read implementation. The hook neither
    // supplies readiness nor changes the original authenticated return value.
    x.hooks.afterHistorical = undefined; reached++;
    const priorSetting = queryOnly(x.db);
    changesBefore = totalChanges(x.db);
    try {
      // This controlled test seam exercises the mutation stamp itself. A
      // query_only rejection of the first UPDATE is not this witness.
      x.db.exec('PRAGMA query_only=OFF');
      writes.push(Number(x.db.prepare('UPDATE activation_read_pair_probe SET value=1').run().changes));
      writes.push(Number(x.db.prepare('UPDATE activation_read_pair_probe SET value=0').run().changes));
      changesAfter = totalChanges(x.db);
    } finally {
      x.db.exec(`PRAGMA query_only=${priorSetting}`);
      restoredSetting = queryOnly(x.db);
    }
  };
  x.db.exec('BEGIN');
  const caught = caughtFrom(() => { x.activate(); escaped = true; });
  expect(reached).toBe(1); expect(writes).toEqual([1, 1]);
  expect(changesAfter - changesBefore).toBe(2); expect(restoredSetting).toBe(1);
  expect(probeBytes(x) === probe).toBe(true);
  expect(x.archiveBytes() === archives).toBe(true); expect(x.syntheticBytes() === synthetic).toBe(true);
  expect(escaped).toBe(false); expect(caught).toBeInstanceOf(Error);
  expect(caught).not.toBeInstanceOf(AggregateError);
  expect((caught as Error).message).toBe('physical read transaction or dependencies changed during traversal');
  expect(x.counts().historicalCompleted).toBe(1); expectCaller(x);
}));

it('activation guard: rejects TEMP DDL prepared before the bare caller transaction', () => withFixture(fixture(), x => {
  const archives = x.archiveBytes();
  let reached = 0, escaped = false;
  const prepared = x.db.prepare('CREATE TEMP VIEW activation_read_pair_guard_view AS SELECT value FROM main.activation_read_pair_probe');
  x.hooks.afterHistorical = () => {
    x.hooks.afterHistorical = undefined; reached++; prepared.run();
  };
  x.db.exec('BEGIN');
  const caught = caughtFrom(() => { x.activate(); escaped = true; });
  expect(reached).toBe(1); expect(escaped).toBe(false);
  expect(caught).toBeInstanceOf(Error); expect((caught as Error).message).toMatch(/read.?only|schema|changed/i);
  expect(x.db.prepare("SELECT name FROM sqlite_temp_master WHERE name='activation_read_pair_guard_view'").get()).toBeUndefined();
  expect(x.counts().historicalCompleted).toBe(1); expectCaller(x);
  expect(x.archiveBytes() === archives).toBe(true);
}));

it('activation guard: rejects rollback and rebegin after real readiness and permits a fresh transaction retry', () => withFixture(fixture(), x => {
  const archives = x.archiveBytes();
  let reached = 0, escaped = false;
  x.hooks.afterHistorical = () => {
    x.hooks.afterHistorical = undefined; reached++; x.db.exec('ROLLBACK; BEGIN');
  };
  x.db.exec('BEGIN');
  const caught = caughtFrom(() => { x.activate(); escaped = true; });
  expect(reached).toBe(1); expect(escaped).toBe(false);
  expect(caught).toBeInstanceOf(Error); expect((caught as Error).message).toMatch(/transaction|savepoint|cleanup/i);
  expect(x.counts().historicalCompleted).toBe(1); expectCaller(x);
  x.db.exec('ROLLBACK');
  x.resetCounts();
  expectReference(x, x.transaction(() => x.activate()));
  expect(x.counts()).toEqual({ historicalEntries: 1, historicalCompleted: 1, closureAuthentications: 1 });
  expect(x.db.isTransaction).toBe(false); expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull();
  expect(queryOnly(x.db)).toBe(0); expect(x.archiveBytes() === archives).toBe(true);
}));

it('activation guard: retains the current WAL snapshot and rejects peer settlement corruption in the next transaction', () => withFixture(fixture(), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  let reached = 0, peerWrites = 0;
  const observedHashes: unknown[] = [];
  const original = x.db.prepare('SELECT plan_hash FROM actual_role_workload_settlements WHERE closure_source_id=?').get(x.targetSourceId)!.plan_hash;
  expect(String(x.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toLowerCase()).toBe('wal');
  x.hooks.afterHistorical = () => {
    x.hooks.afterHistorical = undefined; reached++;
    observedHashes.push(x.db.prepare('SELECT plan_hash FROM actual_role_workload_settlements WHERE closure_source_id=?').get(x.targetSourceId)!.plan_hash);
    peerWrites = Number(x.peer.prepare("UPDATE actual_role_workload_settlements SET plan_hash='corrupt' WHERE closure_source_id=?").run(x.targetSourceId).changes);
    observedHashes.push(x.db.prepare('SELECT plan_hash FROM actual_role_workload_settlements WHERE closure_source_id=?').get(x.targetSourceId)!.plan_hash);
  };
  x.db.exec('BEGIN');
  expectReference(x, x.activate());
  expect(reached).toBe(1); expect(peerWrites).toBe(1);
  expect(observedHashes.length === 2 && observedHashes.every(value => value === original)).toBe(true);
  expect(x.archiveBytes() === archives).toBe(true); expectCaller(x);
  expect(x.counts()).toEqual({ historicalEntries: 1, historicalCompleted: 1, closureAuthentications: 1 });
  x.db.exec('COMMIT'); x.db.exec('BEGIN');
  expect(x.db.prepare('SELECT plan_hash FROM actual_role_workload_settlements WHERE closure_source_id=?').get(x.targetSourceId)!.plan_hash).toBe('corrupt');
  expect(() => x.activate()).toThrow('actual role workload frozen plan differs');
  expect(x.counts().historicalEntries).toBe(2); expect(x.counts().historicalCompleted).toBe(1);
  expectCaller(x); expect(x.archiveBytes() === archives).toBe(false); expect(x.syntheticBytes() === synthetic).toBe(true);
}));

const exercisePrimaryRestoration = (priorSetting: 0 | 1, enclosingParent = false) => withFixture(fixture(), x => {
  const primary = new Error('activation completed-readiness primary sentinel');
  const synthetic = x.syntheticBytes();
  x.db.exec('BEGIN');
  x.db.exec('UPDATE activation_read_pair_probe SET value=7');
  const archives = x.archiveBytes();
  x.db.exec(`PRAGMA query_only=${priorSetting}`);
  const exercise = () => {
    const parent = activeBattedWorldFieldReadFrame(x.db), expectedSetting = enclosingParent ? 1 : priorSetting;
    expect(enclosingParent ? parent !== null : parent === null).toBe(true);
    expectReference(x, x.activate()); expectCaller(x, parent, expectedSetting);
    const failedFrames: (object | null)[] = [], retryFrames: (object | null)[] = [];
    x.hooks.afterHistorical = db => {
      x.hooks.afterHistorical = undefined;
      failedFrames.push(activeBattedWorldFieldReadFrame(db));
      expect(queryOnly(x.db)).toBe(1); throw primary;
    };
    const caught = caughtFrom(() => x.activate());
    expect(caught).toBe(primary); expect(caught).not.toBeInstanceOf(AggregateError);
    expect(failedFrames).toHaveLength(1); expect(failedFrames[0]).not.toBeNull(); expect(failedFrames[0]).not.toBe(parent);
    expectCaller(x, parent, expectedSetting);
    x.hooks.afterHistorical = db => {
      x.hooks.afterHistorical = undefined; retryFrames.push(activeBattedWorldFieldReadFrame(db));
    };
    expectReference(x, x.activate());
    expect(retryFrames).toHaveLength(1); expect(retryFrames[0]).not.toBeNull();
    expect(retryFrames[0]).not.toBe(parent); expect(retryFrames[0]).not.toBe(failedFrames[0]);
    expect(x.counts()).toEqual({ historicalEntries: 3, historicalCompleted: 3, closureAuthentications: 3 });
    expectCaller(x, parent, expectedSetting);
    expect(x.db.prepare('SELECT value FROM activation_read_pair_probe').get()!.value).toBe(7);
  };
  if (enclosingParent) x.owned(exercise); else exercise();
  expectCaller(x, null, priorSetting);
  expect(x.archiveBytes() === archives).toBe(true); expect(x.syntheticBytes() === synthetic).toBe(true);
});

it('activation guard: preserves the exact primary sentinel and restores bare caller query_only=0', () => exercisePrimaryRestoration(0));
it('activation guard: preserves the exact primary sentinel and restores bare caller query_only=1', () => exercisePrimaryRestoration(1));
it('activation guard: restores the enclosing parent frame after success, primary failure and a fresh child retry', () => exercisePrimaryRestoration(0, true));

const exerciseCleanupFailure = (priorSetting: 0 | 1, enclosingParent = false) => withFixture(fixture(), x => {
  const primary = new Error('activation primary before cleanup'), cleanup = new Error('activation one-shot cleanup verification');
  const synthetic = x.syntheticBytes();
  const fault = { armed: false, released: false, fired: false, reads: 0, restorationWrites: 0,
    verifiedSetting: -1, verifiedFrame: null as object | null };
  try {
    // Observe the actual Native statements. Throw only after the second real
    // cleanup read has verified the restored setting; do not fake SQLite data.
    const realExec = x.db.exec.bind(x.db), realPrepare = x.db.prepare.bind(x.db);
    const execSpy = vi.spyOn(x.db, 'exec').mockImplementation(sql => {
      const value = realExec(sql);
      if (fault.armed && !fault.fired) {
        if (/^RELEASE\s+physical_field_read_/i.test(sql)) fault.released = true;
        if (fault.released && /^PRAGMA\s+query_only\s*=\s*0\s*;?$/i.test(sql)) fault.restorationWrites++;
      }
      return value;
    });
    x.restore(() => execSpy.mockRestore());
    const prepareSpy = vi.spyOn(x.db, 'prepare').mockImplementation((...args) => {
      const statement = realPrepare(...args);
      if (fault.armed && fault.released && !fault.fired && /^PRAGMA\s+query_only\s*;?$/i.test(args[0])) {
        const realGet = statement.get.bind(statement);
        const getSpy = vi.spyOn(statement, 'get').mockImplementation((...bindings) => {
          const row = realGet(...bindings);
          if (fault.armed && !fault.fired && ++fault.reads === 2) {
            fault.verifiedSetting = Number(row!.query_only);
            fault.verifiedFrame = activeBattedWorldFieldReadFrame(x.db);
            fault.fired = true; throw cleanup;
          }
          return row;
        });
        x.restore(() => getSpy.mockRestore());
      }
      return statement;
    });
    x.restore(() => prepareSpy.mockRestore());
    x.db.exec('BEGIN'); x.db.exec('UPDATE activation_read_pair_probe SET value=7');
    const archives = x.archiveBytes();
    x.db.exec(`PRAGMA query_only=${priorSetting}`);
    const exercise = () => {
      const parent = activeBattedWorldFieldReadFrame(x.db), expectedSetting = enclosingParent ? 1 : priorSetting;
      const failedFrames: (object | null)[] = [], retryFrames: (object | null)[] = [];
      let escaped = false;
      expect(enclosingParent ? parent !== null : parent === null).toBe(true);
      x.hooks.afterHistorical = db => {
        x.hooks.afterHistorical = undefined;
        failedFrames.push(activeBattedWorldFieldReadFrame(db));
        fault.armed = true; throw primary;
      };
      const caught = caughtFrom(() => { x.activate(); escaped = true; });
      expect(escaped).toBe(false); expect(failedFrames).toHaveLength(1);
      expect(failedFrames[0]).not.toBeNull(); expect(failedFrames[0]).not.toBe(parent);
      expect(caught).toBeInstanceOf(AggregateError);
      const aggregate = caught as AggregateError;
      expect(aggregate.message).toBe('physical read transaction or setting cleanup failed');
      expect(aggregate.cause).toBe(primary); expect(aggregate.errors).toHaveLength(2);
      expect(aggregate.errors[0]).toBe(primary); expect(aggregate.errors[1]).toBe(cleanup);
      expect(fault.released).toBe(true); expect(fault.fired).toBe(true); expect(fault.reads).toBe(2);
      expect(fault.verifiedSetting).toBe(expectedSetting); expect(fault.verifiedFrame).toBe(parent);
      expect(fault.restorationWrites).toBe(expectedSetting === 0 ? 1 : 0);
      fault.armed = false;
      expectCaller(x, parent, expectedSetting);
      expect(x.db.prepare('SELECT value FROM activation_read_pair_probe').get()!.value).toBe(7);
      expect(x.counts()).toEqual({ historicalEntries: 1, historicalCompleted: 1, closureAuthentications: 1 });
      x.hooks.afterHistorical = db => {
        x.hooks.afterHistorical = undefined; retryFrames.push(activeBattedWorldFieldReadFrame(db));
      };
      expectReference(x, x.activate());
      expect(retryFrames).toHaveLength(1); expect(retryFrames[0]).not.toBeNull();
      expect(retryFrames[0]).not.toBe(parent); expect(retryFrames[0]).not.toBe(failedFrames[0]);
      expect(x.counts()).toEqual({ historicalEntries: 2, historicalCompleted: 2, closureAuthentications: 2 });
      expectCaller(x, parent, expectedSetting);
    };
    if (enclosingParent) x.owned(exercise); else exercise();
    expectCaller(x, null, priorSetting);
    expect(x.archiveBytes() === archives).toBe(true); expect(x.syntheticBytes() === synthetic).toBe(true);
  } finally { fault.armed = false; }
});

it('activation guard: aggregates primary and cleanup failure after restoring bare caller query_only=0', () => exerciseCleanupFailure(0));
it('activation guard: aggregates primary and cleanup failure after restoring bare caller query_only=1', () => exerciseCleanupFailure(1));
it('activation guard: aggregates child cleanup failure and restores its parent before a fresh activation retry', () => exerciseCleanupFailure(0, true));

import type { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import * as pitches from './PhysicalPitchEvidenceFromSqlite';
import * as continuous from './ContinuousPlayerPitchRuntime';
import * as actors from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as executions from './SqliteBattedWorldFieldExecutionStore';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { battedBallFlightFixture } from './BattedBallFlightFixtures.test-support';
import { battedBallFlightEvidenceFromSqlite, type DurableBattedBallFlight } from './SqliteBattedBallFlightStore';
import type { DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';

type PairedRead = (db: Parameters<typeof pitches.readOriginalPhysicalPitchPrefixFromSqlite>[0], sourceId: string) => Readonly<{
  prefix: readonly DurablePhysicalPitch[];
  originalPitchRows: Readonly<{ actions: readonly string[]; head: string }>;
}>;
// This test-only optional view targets unchanged 4550. A paired case must fail
// explicitly if the approved API is absent; it never installs a substitute API.
type PairedModule = typeof pitches & { readOriginalPhysicalPitchWithRowsFromSqlite?: PairedRead };
const requirePairedModule = (): PairedModule & { readOriginalPhysicalPitchWithRowsFromSqlite: PairedRead } => {
  const module = pitches as PairedModule;
  if (typeof module.readOriginalPhysicalPitchWithRowsFromSqlite !== 'function') {
    throw new Error('required paired API readOriginalPhysicalPitchWithRowsFromSqlite is missing');
  }
  return module as PairedModule & { readOriginalPhysicalPitchWithRowsFromSqlite: PairedRead };
};

let x: ReturnType<typeof battedBallFlightFixture>;
let referenceFlight: DurableBattedBallFlight, referencePrefix: readonly DurablePhysicalPitch[], referenceArchive: string;
const archiveBytes = (db: DatabaseSync) => actors.actorJson({
  actions: db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY game_id,play_id,progress_revision').all(),
  heads: db.prepare('SELECT * FROM physical_pitch_progress_heads ORDER BY game_id,play_id').all(),
});
beforeAll(() => {
  // Real Native owners, two TAKEs and the original SWING. All reference work
  // precedes observation, and each case below owns only its caller transaction.
  x = battedBallFlightFixture(undefined, true, true, false, undefined, undefined, undefined,
    { precedingTakenPitches: 2 });
  referencePrefix = pitches.readOriginalPhysicalPitchPrefixFromSqlite(x.f.db, x.input.physicalPitchSourceId);
  referenceFlight = battedBallFlightEvidenceFromSqlite(x.f.db).derive(x.input, null);
  expect(referencePrefix.map(pitch => pitch.source.request.batter.action.kind)).toEqual(['take', 'take', 'swing']);
  expect(referenceFlight.originalPitchRows).toEqual(pitches.captureOriginalPhysicalPitchRows(x.f.db, x.input.physicalPitchSourceId));
  referenceArchive = archiveBytes(x.f.db);
  x.f.db.exec('CREATE TABLE paired_cleanup_sentinel(value TEXT NOT NULL)');
}, 60_000);
afterAll(() => x?.f.close());

type Entry = { frame: object | null; physicalDepth: number; queryOnly: number; rawLoads: number };
type Resolution = { pitchIndex: number; frame: object | null };
type CleanupFault = { error: Error; released: boolean; reads: number; fired: boolean;
  restorationWrites: number; verified?: { queryOnly: number; frame: object | null; physicalDepth: number } };
type Hooks = { entry?: (event: Entry) => void; resolved?: (event: Resolution) => void; audit?: () => void };

const observe = (paired: boolean) => {
  const module = paired ? requirePairedModule() : null;
  const db = x.f.db, restores: { mockRestore(): void }[] = [], statements: string[] = [];
  const physicalFrames: (object | null)[] = [], entries: Entry[] = [], pairFailures: unknown[] = [];
  const resolutions: Resolution[] = [], actorReads: object[] = [], hooks: Hooks = {};
  let activePair: Entry | undefined, cleanupFault: CleanupFault | undefined;
  const queryOnly = () => Number(db.prepare('PRAGMA query_only').get()!.query_only);
  const trackSpy = <T extends { mockRestore(): void }>(spy: T): T => { restores.push(spy); return spy; };
  const removeFaults = () => { delete hooks.entry; delete hooks.resolved; delete hooks.audit; cleanupFault = undefined; };
  const restoreSpies = (): unknown[] => {
    const errors: unknown[] = [];
    while (restores.length) {
      try { restores.pop()!.mockRestore(); } catch (error) { errors.push(error); }
    }
    return errors;
  };
  try {
    const realExec = db.exec.bind(db);
    trackSpy(vi.spyOn(db, 'exec')).mockImplementation(sql => {
      const result = realExec(sql); statements.push(sql);
      if (cleanupFault && !cleanupFault.fired) {
        if (/^RELEASE\s+physical_field_read_/i.test(sql)) cleanupFault.released = true;
        if (cleanupFault.released && /^PRAGMA\s+query_only\s*=\s*0\s*;?$/i.test(sql)) cleanupFault.restorationWrites++;
      }
      return result;
    });
    const realPrepare = db.prepare.bind(db);
    trackSpy(vi.spyOn(db, 'prepare')).mockImplementation((...args) => {
      const [sql] = args, statement = realPrepare(...args);
      if (/^PRAGMA\s+query_only\s*;?$/i.test(sql)) {
        const get = statement.get.bind(statement);
        trackSpy(vi.spyOn(statement, 'get')).mockImplementation((...args) => {
          const row = get(...args), fault = cleanupFault;
          if (fault?.released && !fault.fired && ++fault.reads === 2) {
            // The first cleanup read decides whether restoration is needed; this
            // second, real read verifies the restored setting before we throw C.
            fault.verified = { queryOnly: Number(row!.query_only), frame: activeBattedWorldFieldReadFrame(db),
              physicalDepth: physicalFrames.length };
            fault.fired = true;
            throw fault.error;
          }
          return row;
        });
      }
      if (/^SELECT\s+\*\s+FROM\s+physical_pitch_progress_actions\b/i.test(sql)
        && /progress_revision\s*<=\s*\?/i.test(sql)) {
        const all = statement.all.bind(statement);
        trackSpy(vi.spyOn(statement, 'all')).mockImplementation((...args) => {
          const rows = all(...args);
          if (activePair && ++activePair.rawLoads === 2) hooks.audit?.();
          return rows;
        });
      }
      return statement;
    });
    const realTraversal = executions.withBattedWorldPhysicalReadTraversal;
    const traversal = <T>(connection: Parameters<typeof realTraversal>[0], body: () => T): T => realTraversal(connection, () => {
      if (connection !== db) return body();
      physicalFrames.push(activeBattedWorldFieldReadFrame(connection));
      try { return body(); } finally { physicalFrames.pop(); }
    });
    trackSpy(vi.spyOn(executions, 'withBattedWorldPhysicalReadTraversal')).mockImplementation(traversal);
    const realResolver = continuous.resolveContinuousPlayerPitchAgainstBatterFromWorld;
    trackSpy(vi.spyOn(continuous, 'resolveContinuousPlayerPitchAgainstBatterFromWorld')).mockImplementation((...args) => {
      const result = realResolver(...args), input = args[1];
      if (input.delivery.playId === x.physical.frame.match.playId
        && input.delivery.playerId === x.physical.frame.workload.playerId) {
        const event = { pitchIndex: input.delivery.pitchIndex, frame: activeBattedWorldFieldReadFrame(db) };
        resolutions.push(event); hooks.resolved?.(event);
      }
      return result;
    });
    const realActor = actors.readPhysicalPlateAppearanceActorFromSqlite;
    trackSpy(vi.spyOn(actors, 'readPhysicalPlateAppearanceActorFromSqlite')).mockImplementation((...args) => {
      const result = realActor(...args);
      if (args[0] === db && args[1] === x.source.sourceId) {
        const frame = activeBattedWorldFieldReadFrame(db);
        expect(frame).not.toBeNull(); actorReads.push(frame!);
      }
      return result;
    });
    if (module) {
      const realPair = module.readOriginalPhysicalPitchWithRowsFromSqlite;
      trackSpy(vi.spyOn(module, 'readOriginalPhysicalPitchWithRowsFromSqlite')).mockImplementation((...args) => {
        if (args[0] !== db || args[1] !== x.input.physicalPitchSourceId) return realPair(...args);
        const event: Entry = { frame: activeBattedWorldFieldReadFrame(db), physicalDepth: physicalFrames.length,
          queryOnly: queryOnly(), rawLoads: 0 };
        entries.push(event);
        // Deliberately outside the real pair body: this observer sentinel must
        // retain direct identity, with no new domain envelope from derive.
        hooks.entry?.(event);
        const previous = activePair; activePair = event;
        try { return realPair(...args); }
        catch (error) { pairFailures.push(error); throw error; }
        finally { activePair = previous; }
      });
    }
    return { db, hooks, entries, pairFailures, resolutions, actorReads, physicalFrames, statements, queryOnly,
      derive: () => battedBallFlightEvidenceFromSqlite(db).derive(x.input, null),
      armCleanup(error: Error) {
        cleanupFault = { error, released: false, reads: 0, fired: false, restorationWrites: 0 };
        return cleanupFault;
      },
      removeFaults,
      clearObservations() { entries.length = 0; pairFailures.length = 0; resolutions.length = 0; actorReads.length = 0; },
      close() {
        removeFaults();
        const errors = restoreSpies();
        if (errors.length) throw new AggregateError(errors, 'paired cleanup observer restoration failed', { cause: errors[0] });
      },
    };
  } catch (error) {
    removeFaults();
    const cleanupErrors = restoreSpies();
    if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors],
      'paired cleanup observer setup and restoration failed', { cause: error });
    throw error;
  }
};
type Observation = ReturnType<typeof observe>;

const caughtFrom = (body: () => unknown): unknown => {
  let failed = false, caught: unknown;
  try { body(); } catch (error) { failed = true; caught = error; }
  expect(failed).toBe(true);
  return caught;
};
const singleEnvelope = (caught: unknown, sentinel: Error): Error => {
  expect(caught).toBeInstanceOf(Error);
  expect(caught).not.toBeInstanceOf(AggregateError);
  const primary = caught as Error;
  expect(primary.message).toBe('corrupt original physical pitch prefix');
  expect(primary.cause).toBe(sentinel);
  expect(sentinel.cause).toBeUndefined();
  return primary;
};
const expectCaller = (h: Observation, frame: object | null = null, physicalDepth = 0, queryOnly = 0) => {
  expect(h.db.isTransaction).toBe(true);
  expect(activeBattedWorldFieldReadFrame(h.db)).toBe(frame);
  expect(h.physicalFrames).toHaveLength(physicalDepth);
  if (physicalDepth) expect(h.physicalFrames.at(-1)).toBe(frame);
  expect(h.queryOnly()).toBe(queryOnly);
  expect(h.db.prepare('SELECT value FROM paired_cleanup_sentinel').all()).toEqual([{ value: 'caller write survives' }]);
  expect(h.statements.filter(sql => /(?:^|;)\s*(?:COMMIT|ROLLBACK)\b/i.test(sql))).toEqual([]);
  expect(archiveBytes(h.db)).toBe(referenceArchive);
};
const expectFreshAuthentication = (h: Observation, frame: object | null) => {
  expect(frame).not.toBeNull();
  expect(h.resolutions.map(event => event.pitchIndex)).toEqual([0, 1, 2]);
  expect(h.resolutions.every(event => event.frame === frame)).toBe(true);
  expect(h.actorReads).toHaveLength(1); expect(h.actorReads[0]).toBe(frame);
};
const expectFreshFlightRetry = (h: Observation, failedFrame: object | null, run = h.derive) => {
  h.removeFaults(); h.clearObservations();
  const value = run();
  expect(h.entries).toHaveLength(1);
  const entry = h.entries[0];
  expect(entry.frame).not.toBe(failedFrame);
  expect(entry.queryOnly).toBe(1);
  expect(entry.physicalDepth).toBeGreaterThan(0);
  expect(entry.rawLoads).toBe(2);
  expectFreshAuthentication(h, entry.frame);
  expect(actors.actorJson(value)).toBe(actors.actorJson(referenceFlight));
  expect(value.originalPitchRows).toEqual(referenceFlight.originalPitchRows);
};
const withCaller = (body: (h: Observation) => void, paired = true) => {
  // Check API availability before opening the caller transaction. The legacy
  // case deliberately needs no paired API and still exercises the old function.
  if (paired) requirePairedModule();
  x.f.db.exec('BEGIN IMMEDIATE');
  let h: Observation | undefined;
  let failed = false, failure: unknown;
  const cleanupErrors: unknown[] = [];
  try {
    x.f.db.prepare('INSERT INTO paired_cleanup_sentinel VALUES(?)').run('caller write survives');
    h = observe(paired); body(h);
  } catch (error) { failed = true; failure = error; }
  finally {
    try { h?.close(); } catch (error) { cleanupErrors.push(error); }
    finally {
      try { if (x.f.db.isTransaction) x.f.db.exec('ROLLBACK'); } catch (error) { cleanupErrors.push(error); }
      finally {
        try { x.f.db.exec('PRAGMA query_only=OFF'); } catch (error) { cleanupErrors.push(error); }
      }
    }
  }
  if (cleanupErrors.length) throw new AggregateError([...(failed ? [failure] : []), ...cleanupErrors],
    'paired cleanup caller fixture restoration failed', { cause: failed ? failure : cleanupErrors[0] });
  if (failed) throw failure;
};

// Source-only companion cases. The separate real derive-count case is the
// initial meaningful RED selection; missing-API failures here are not that RED.
it('paired cleanup: preserves an external pair-entry sentinel by identity in a caller writer', () => withCaller(h => {
  const sentinel = new Error('external paired entry sentinel');
  h.hooks.entry = () => { throw sentinel; };
  expect(caughtFrom(h.derive)).toBe(sentinel);
  expect(h.entries).toHaveLength(1);
  const failed = h.entries[0];
  expect(failed.frame).not.toBeNull(); expect(failed.queryOnly).toBe(1); expect(failed.physicalDepth).toBe(1);
  expect(h.pairFailures).toEqual([]); expect(h.resolutions).toEqual([]); expect(h.actorReads).toEqual([]);
  expectCaller(h);
  expectFreshFlightRetry(h, failed.frame);
  expectCaller(h);
}));

it('paired cleanup: wraps an internal real-resolver sentinel exactly once and freshly retries', () => withCaller(h => {
  const sentinel = new Error('internal paired resolver sentinel');
  h.hooks.resolved = event => { if (event.pitchIndex === 2) throw sentinel; };
  const primary = singleEnvelope(caughtFrom(h.derive), sentinel);
  expect(h.entries).toHaveLength(1); expect(h.pairFailures).toHaveLength(1); expect(h.pairFailures[0]).toBe(primary);
  const failedFrame = h.entries[0].frame;
  expectFreshAuthentication(h, failedFrame);
  expectCaller(h);
  expectFreshFlightRetry(h, failedFrame);
  expectCaller(h);
}));

it('paired cleanup: wraps a post-replay raw-audit sentinel exactly once and freshly retries', () => withCaller(h => {
  const sentinel = new Error('internal paired raw audit sentinel');
  let auditReached = false;
  h.hooks.audit = () => { auditReached = true; throw sentinel; };
  const primary = singleEnvelope(caughtFrom(h.derive), sentinel);
  expect(auditReached).toBe(true); expect(h.entries).toHaveLength(1);
  expect(h.entries[0].rawLoads).toBe(2); expect(h.pairFailures).toHaveLength(1); expect(h.pairFailures[0]).toBe(primary);
  const failedFrame = h.entries[0].frame;
  expectFreshAuthentication(h, failedFrame);
  expectCaller(h);
  expectFreshFlightRetry(h, failedFrame);
  expectCaller(h);
}));

it('paired cleanup: keeps the legacy public prefix resolver error envelope unchanged', () => withCaller(h => {
  const sentinel = new Error('legacy prefix resolver sentinel');
  const read = () => executions.withBattedWorldPhysicalReadTraversal(h.db,
    () => pitches.readOriginalPhysicalPitchPrefixFromSqlite(h.db, x.input.physicalPitchSourceId));
  h.hooks.resolved = event => { if (event.pitchIndex === 2) throw sentinel; };
  singleEnvelope(caughtFrom(read), sentinel);
  const failedFrame = h.resolutions[0]?.frame ?? null;
  expectFreshAuthentication(h, failedFrame); expectCaller(h);
  h.removeFaults(); h.clearObservations();
  const value = read(), retryFrame = h.resolutions[0]?.frame ?? null;
  expect(retryFrame).not.toBe(failedFrame); expectFreshAuthentication(h, retryFrame);
  expect(value.map(pitch => actors.actorJson(pitch))).toEqual(referencePrefix.map(pitch => actors.actorJson(pitch)));
  expectCaller(h);
}, false));

const exerciseCombinedFailure = (h: Observation, priorFrame: object | null, physicalDepth: number, priorSetting: 0 | 1) => {
  const sentinel = new Error('primary paired replay sentinel'), cleanup = new Error('one-shot cleanup verification sentinel');
  const injected: { fault?: CleanupFault } = {};
  h.hooks.resolved = event => {
    if (event.pitchIndex !== 2) return;
    injected.fault = h.armCleanup(cleanup); throw sentinel;
  };
  const run = priorFrame === null ? h.derive
    : () => executions.withBattedWorldPhysicalReadTraversal(h.db, h.derive);
  const caught = caughtFrom(run);
  expect(caught).toBeInstanceOf(AggregateError);
  expect(h.pairFailures).toHaveLength(1);
  const primary = singleEnvelope(h.pairFailures[0], sentinel), aggregate = caught as AggregateError;
  expect(aggregate.message).toBe('physical read transaction or setting cleanup failed');
  expect(aggregate.cause).toBe(primary);
  expect(aggregate.errors).toHaveLength(2);
  expect(aggregate.errors[0]).toBe(primary); expect(aggregate.errors[1]).toBe(cleanup);
  expect((aggregate.errors[0] as Error).cause).toBe(sentinel);
  const fault = injected.fault;
  expect(fault?.released).toBe(true); expect(fault?.fired).toBe(true); expect(fault?.reads).toBe(2);
  expect(fault?.verified?.queryOnly).toBe(priorSetting);
  expect(fault?.verified?.frame).toBe(priorFrame);
  expect(fault?.verified?.physicalDepth).toBe(physicalDepth);
  expect(fault?.restorationWrites).toBe(priorSetting === 0 ? 1 : 0);
  expect(h.entries).toHaveLength(1);
  const failedFrame = h.entries[0].frame;
  expect(failedFrame).not.toBe(priorFrame);
  expect(h.entries[0].physicalDepth).toBe(physicalDepth + 1);
  expectFreshAuthentication(h, failedFrame);
  // The verification fault is one-shot and already consumed. Remove all
  // injectors before proving the actual state, then retry in a fresh child.
  h.removeFaults(); expectCaller(h, priorFrame, physicalDepth, priorSetting);
  expectFreshFlightRetry(h, failedFrame, run);
  expect(h.entries[0].frame).not.toBe(priorFrame);
  expect(h.entries[0].physicalDepth).toBe(physicalDepth + 1);
  expectCaller(h, priorFrame, physicalDepth, priorSetting);
};

it('paired cleanup: aggregates primary and one-shot cleanup errors after restoring a caller writer', () => withCaller(h => {
  exerciseCombinedFailure(h, null, 0, 0);
}));

it('paired cleanup: aggregates child errors while preserving the parent frame and query-only traversal', () => withCaller(h => {
  executions.withBattedWorldPhysicalReadTraversal(h.db, () => {
    const parentFrame = activeBattedWorldFieldReadFrame(h.db);
    expect(parentFrame).not.toBeNull(); expectCaller(h, parentFrame, 1, 1);
    exerciseCombinedFailure(h, parentFrame, 1, 1);
  });
  expectCaller(h);
}));

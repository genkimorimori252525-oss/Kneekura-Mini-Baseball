import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync } from 'node:sqlite';
import * as actors from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as pitches from './PhysicalPitchEvidenceFromSqlite';
import * as closure from './PhysicalPlayClosureEvidenceFromSqlite';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { continuousPitchAction, continuousPitchFixture } from './ContinuousPitchFixtures.test-support';
import { openSqlitePhysicalPlateAppearanceActorStore } from './SqlitePhysicalPlateAppearanceActorStore';
import { openSqlitePhysicalPitchProgressStore } from './SqlitePhysicalPitchProgressStore';

const { DatabaseSync: RealDatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Event = { name: string; db: DatabaseSync; transaction: boolean; queryOnly: number; writer: boolean };
// Observe real owner functions and real private connections. No owner result,
// SQL, physical result, or closure is replaced; no global prepare spy is used.
const observeReads = (register: (cleanup: () => void) => void) => {
  const events: Event[] = [], statements: string[] = [], writers = new Map<DatabaseSync, boolean>();
  const restores: { mockRestore(): void }[] = [];
  let hook: ((event: Event) => void) | undefined;
  const close = () => { hook = undefined; while (restores.length) restores.pop()!.mockRestore(); };
  register(close); // Own restoration before the first spy installation can fail.
  const observe = (name: string, raw: unknown) => {
    expect(raw).toBeInstanceOf(RealDatabaseSync); const db = raw as DatabaseSync;
    if (!writers.has(db)) {
      writers.set(db, false); const exec = db.exec.bind(db);
      restores.push(vi.spyOn(db, 'exec').mockImplementation(sql => {
        const result = exec(sql); statements.push(sql);
        if (/^BEGIN IMMEDIATE\b/i.test(sql)) writers.set(db, true);
        if (/^(COMMIT|ROLLBACK)\s*;?$/i.test(sql)) writers.set(db, false);
        return result;
      }));
    }
    const event = { name, db, transaction: db.isTransaction,
      queryOnly: Number(db.prepare('PRAGMA query_only').get()!.query_only), writer: writers.get(db)! };
    events.push(event); hook?.(event);
  };
  const actorRead = actors.readPhysicalPlateAppearanceActorFromSqlite;
  restores.push(vi.spyOn(actors, 'readPhysicalPlateAppearanceActorFromSqlite').mockImplementation((...args) => {
    observe('actor-read', args[0]); return actorRead(...args);
  }));
  const actorDerive = actors.derivePhysicalPlateAppearanceActor;
  restores.push(vi.spyOn(actors, 'derivePhysicalPlateAppearanceActor').mockImplementation((...args) => {
    observe('actor-derive', args[0]); return actorDerive(...args);
  }));
  const actorFrame = actors.assertPhysicalActorOpenFrame;
  restores.push(vi.spyOn(actors, 'assertPhysicalActorOpenFrame').mockImplementation((...args) => {
    observe('actor-frame', args[0]); return actorFrame(...args);
  }));
  const actorForPlay = actors.readPhysicalActorForPlayFromSqlite;
  restores.push(vi.spyOn(actors, 'readPhysicalActorForPlayFromSqlite').mockImplementation((...args) => {
    observe('pitch-actor', args[0]); return actorForPlay(...args);
  }));
  const evidence = pitches.capturePhysicalPitchEvidence;
  restores.push(vi.spyOn(pitches, 'capturePhysicalPitchEvidence').mockImplementation((...args) => {
    observe('pitch-evidence', args[0]); return evidence(...args);
  }));
  const history = pitches.readPhysicalPitchProgressFromSqlite;
  restores.push(vi.spyOn(pitches, 'readPhysicalPitchProgressFromSqlite').mockImplementation((...args) => {
    observe('pitch-history', args[0]); return history(...args);
  }));
  const prior = closure.assertPriorPhysicalClosureCompleted;
  restores.push(vi.spyOn(closure, 'assertPriorPhysicalClosureCompleted').mockImplementation((...args) => {
    observe('prior-closure', args[0]); return prior(...args);
  }));
  return { events, statements, setHook(value?: (event: Event) => void) { hook = value; },
    close };
};

const fixture = (kind: 'actor' | 'pitch') => {
  const directory = mkdtempSync(join(tmpdir(), `next-private-${kind}-`)), path = join(directory, 'state.sqlite');
  const cleanups: (() => void)[] = [() => rmSync(directory, { recursive: true, force: true })];
  const close = () => {
    const errors: unknown[] = [];
    while (cleanups.length) { try { cleanups.pop()!(); } catch (error) { errors.push(error); } }
    if (errors.length) throw new AggregateError(errors, 'private-read fixture cleanup failed');
  };
  try {
  const actorFixture = kind === 'actor' ? physicalPlateAppearanceActorFixture(path) : null;
  const f = actorFixture?.f ?? continuousPitchFixture(path);
  cleanups.push(() => f.close()); // Own every returned fixture handle before later setup.
  const trace = observeReads(cleanup => cleanups.push(cleanup));
  const peerReads: boolean[] = [];
  const outside = () => { peerReads.push(trace.events.every(event => !event.db.isTransaction)); };
  const sources = { matches: { getMatch: (id: string) => { outside(); return f.official.getMatch(id); } },
    initialWorlds: f.initialWorlds, participation: f.participation };
  const source = actorFixture?.source ?? continuousPitchAction(f, 0, 0);
  const store = actorFixture
    ? f.track(openSqlitePhysicalPlateAppearanceActorStore(path, sources, { readAcceptedActor: () => {
      outside(); return actorFixture.source;
    } }))
    : f.track(openSqlitePhysicalPitchProgressStore(path, { ...sources, runtime: { ...f.stores,
      timing: { selectProfileAtDay: (...args: Parameters<typeof f.timing.selectProfileAtDay>) => {
        outside(); return f.timing.selectProfileAtDay(...args);
      } }, release: { selectAtDay: (...args: Parameters<typeof f.release.selectAtDay>) => {
        outside(); return f.release.selectAtDay(...args);
      } } } }, { readAcceptedAction: () => { outside(); return continuousPitchAction(f, 0, 0); } }));
  const table = kind === 'actor' ? 'physical_plate_appearance_actors' : 'physical_pitch_progress_actions';
  const accept = () => kind === 'actor'
    ? (store as ReturnType<typeof openSqlitePhysicalPlateAppearanceActorStore>).accept(source.sourceId)
    : (store as ReturnType<typeof openSqlitePhysicalPitchProgressStore>).accept(source.sourceId, 0);
  const read = () => kind === 'actor'
    ? (store as ReturnType<typeof openSqlitePhysicalPlateAppearanceActorStore>).read(source.sourceId)
    : (store as ReturnType<typeof openSqlitePhysicalPitchProgressStore>).readAcceptedPitch(source.sourceId);
  return { f, trace, peerReads, table, accept, read,
    count: () => Number(f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n),
    connection: () => { const db = trace.events[0]?.db; expect(db).toBeInstanceOf(RealDatabaseSync); return db!; },
    close };
  } catch (error) {
    try { close(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'private-read fixture setup failed', { cause: error }); }
    throw error;
  }
};

for (const kind of ['actor', 'pitch'] as const) {
  it(`${kind}: owns each private read snapshot and ends it before peers, writers and retries`, () => {
    const x = fixture(kind);
    try {
      const value = x.accept(); expect(x.accept()).toEqual(value); expect(x.read()).toEqual(value);
      expect(x.count()).toBe(1); expect(x.trace.events.length).toBeGreaterThan(5);
      expect(x.trace.events.every(event => event.transaction)).toBe(true);
      expect(x.trace.events.filter(event => !event.writer).every(event => event.queryOnly === 1)).toBe(true);
      expect(x.trace.events.some(event => event.writer)).toBe(true);
      expect(x.peerReads.length).toBeGreaterThan(0); expect(x.peerReads.every(Boolean)).toBe(true);
      expect(x.connection().isTransaction).toBe(false);
      expect(x.connection().prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    } finally { x.close(); }
  });

  it(`${kind}: preserves the exact owner error and rolls back only its private read before a fresh retry`, () => {
    const x = fixture(kind), failure = new Error(`private-${kind}-read-failure`);
    let thrown = false;
    x.trace.setHook(event => { if (!thrown && !event.writer) { thrown = true; throw failure; } });
    try {
      let caught: unknown; try { x.accept(); } catch (error) { caught = error; }
      expect(caught).toBe(failure); expect(x.count()).toBe(0);
      expect(x.trace.statements.filter(sql => /^ROLLBACK\s*;?$/i.test(sql))).toHaveLength(1);
      expect(x.connection().isTransaction).toBe(false);
      expect(x.connection().prepare('PRAGMA query_only').get()!.query_only).toBe(0);
      x.trace.setHook(); expect(x.accept()).toBeDefined(); expect(x.count()).toBe(1);
    } finally { x.close(); }
  });

  it(`${kind}: holds one WAL snapshot within a read and sees the committed peer change on the next operation`, () => {
    const x = fixture(kind); let changed = false; const snapshots: number[] = [];
    x.f.db.exec('CREATE TABLE private_read_probe(value INTEGER NOT NULL); INSERT INTO private_read_probe VALUES(0)');
    x.trace.setHook(event => {
      if (changed || event.writer) return; changed = true;
      snapshots.push(Number(event.db.prepare('SELECT value FROM private_read_probe').get()!.value));
      x.f.db.exec('UPDATE private_read_probe SET value=1');
      snapshots.push(Number(event.db.prepare('SELECT value FROM private_read_probe').get()!.value));
    });
    try {
      const value = x.accept(); expect(changed).toBe(true); expect(snapshots).toEqual([0, 0]);
      expect(x.connection().isTransaction).toBe(false); expect(x.accept()).toEqual(value);
      expect(x.connection().prepare('SELECT value FROM private_read_probe').get()!.value).toBe(1);
    } finally { x.close(); }
  });

  it(`${kind}: leaves an existing caller transaction owned by the caller through read and rollback/rebegin`, () => {
    const x = fixture(kind);
    try {
      const value = x.accept(), db = x.connection();
      db.exec('BEGIN'); expect(x.read()).toEqual(value); expect(db.isTransaction).toBe(true); db.exec('ROLLBACK');
      db.exec('BEGIN'); expect(x.read()).toEqual(value); expect(db.isTransaction).toBe(true); db.exec('COMMIT');
      expect(db.isTransaction).toBe(false); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    } finally { if (x.trace.events[0]?.db.isTransaction) x.trace.events[0].db.exec('ROLLBACK'); x.close(); }
  });

  it(`${kind}: preserves the real writer rollback and permits a clean write after trigger removal`, () => {
    const x = fixture(kind);
    x.f.db.exec(`CREATE TRIGGER private_read_writer_failure AFTER INSERT ON ${x.table} BEGIN SELECT RAISE(ABORT,'real writer failure'); END`);
    try {
      expect(() => x.accept()).toThrow('real writer failure'); expect(x.count()).toBe(0);
      expect(x.connection().isTransaction).toBe(false); expect(x.connection().prepare('PRAGMA query_only').get()!.query_only).toBe(0);
      x.f.db.exec('DROP TRIGGER private_read_writer_failure'); expect(x.accept()).toBeDefined(); expect(x.count()).toBe(1);
    } finally { x.close(); }
  });

  it(`${kind}: keeps competing writers excluded while its existing write transaction revalidates`, () => {
    const x = fixture(kind); let attempted = false, error: unknown;
    x.f.db.exec('PRAGMA busy_timeout=0');
    x.trace.setHook(event => {
      if (!event.writer || attempted) return; attempted = true;
      try { x.f.db.exec('UPDATE matches SET durable_revision=durable_revision+1'); } catch (caught) { error = caught; }
    });
    try {
      expect(x.accept()).toBeDefined(); expect(attempted).toBe(true); expect(error).toBeInstanceOf(Error);
      expect(String(error)).toMatch(/locked|busy/); expect(x.count()).toBe(1);
      expect(x.connection().isTransaction).toBe(false);
      x.f.db.exec('BEGIN IMMEDIATE'); x.f.db.exec('ROLLBACK');
    } finally { x.close(); }
  });
}

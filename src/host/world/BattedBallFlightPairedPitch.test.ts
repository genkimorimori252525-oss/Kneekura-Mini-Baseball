import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import * as pitches from './PhysicalPitchEvidenceFromSqlite';
import * as actors from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedBallFlightEvidenceFromSqlite } from './SqliteBattedBallFlightStore';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { assertNationalMatchBindings, readNationalMatchOrigin } from './NationalMatchOriginFromSqlite';
import { ownedRead, pairedPitchFixture, queryOnly, requirePairedReader, type RawPitchRow } from './BattedBallFlightPairedPitch.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('paired pitch returns exact legacy endpoint and raw-row identities from one fresh replay', () => {
  const x = pairedPitchFixture(); try {
    const read = requirePairedReader(), counts = x.observeReplay();
    const result = ownedRead(x.db, () => read(x.db, x.g.physical.source.sourceId));
    expect(result.prefix).toHaveLength(3); expect(result.prefix.at(-1)).toEqual(x.g.physical);
    expect(result.originalPitchRows).toEqual(x.legacyRows);
    expect(actors.actorJson(x.rows())).toBe(x.beforeRows);
    expect(counts).toEqual({ authentications: 1, executions: [0, 1, 2] });
    expect(Object.isFrozen(result.originalPitchRows)).toBe(true);
    expect(Object.isFrozen(result.originalPitchRows.actions)).toBe(true);
  } finally { x.close(); }
});

it('paired replay ignores an earlier TAKE alias mutated then restored before final audit', () => {
  const x = pairedPitchFixture(); let alias: RawPitchRow | undefined, original: RawPitchRow | undefined;
  let mutated = false, restoredDuringReplay = false;
  try {
    const read = requirePairedReader();
    x.observeOwnedRows((rows, ordinal) => {
      if (ordinal === 1) { expect(rows).toHaveLength(3); alias = rows[0]; original = { ...rows[0] };
        expect(JSON.parse(String(alias.source_json)).request.batter.action.kind).toBe('take'); }
    });
    const counts = x.observeReplay({ afterActor: () => {
      if (!mutated) {
        expect(alias).toBeDefined(); const source = JSON.parse(String(alias!.source_json));
        alias!.source_json = JSON.stringify({ ...source, sourceVersion: 'transient-earlier-take-alias' }); mutated = true;
      }
    }, beforeExecution: input => {
      if (!restoredDuringReplay && input.delivery.pitchIndex === 0) {
        expect(mutated).toBe(true); Object.assign(alias!, original!); restoredDuringReplay = true;
      }
    } });
    const result = ownedRead(x.db, () => read(x.db, x.g.physical.source.sourceId));
    expect(mutated).toBe(true); expect(restoredDuringReplay).toBe(true);
    expect(result.prefix[0].source.sourceVersion).toBe(JSON.parse(String(original!.source_json)).sourceVersion);
    expect(result.originalPitchRows).toEqual(x.legacyRows);
    expect(result.prefix.at(-1)).toEqual(x.g.physical);
    expect(counts).toEqual({ authentications: 1, executions: [0, 1, 2] });
    expect(actors.actorJson(x.rows())).toBe(x.beforeRows);
  } finally { if (alias && original) Object.assign(alias, original); x.close(); }
});

it('paired replay ignores a discarded initial row alias even when it stays mutated', () => {
  const x = pairedPitchFixture(); let alias: RawPitchRow | undefined, changed = false;
  try {
    const read = requirePairedReader();
    x.observeOwnedRows((rows, ordinal) => { if (ordinal === 1) alias = rows[0]; });
    const actorRead = actors.readPhysicalPlateAppearanceActorFromSqlite;
    x.restore(vi.spyOn(actors, 'readPhysicalPlateAppearanceActorFromSqlite').mockImplementation((...args) => {
      const value = actorRead(...args);
      if (!changed && args[0] === x.db) { expect(alias).toBeDefined(); alias!.source_json = '{discarded-alias'; changed = true; }
      return value;
    }));
    const result = ownedRead(x.db, () => read(x.db, x.g.physical.source.sourceId));
    expect(changed).toBe(true); expect(alias!.source_json).toBe('{discarded-alias');
    expect(result.originalPitchRows).toEqual(x.legacyRows); expect(result.prefix.at(-1)).toEqual(x.g.physical);
    expect(actors.actorJson(x.rows())).toBe(x.beforeRows);
  } finally { x.close(); }
});

it('paired read rejects a raw identity actually changed in its final audit result', () => {
  const x = pairedPitchFixture(); let changedAudit = false;
  try {
    const read = requirePairedReader();
    const reads = x.observeOwnedRows((rows, ordinal) => {
      if (ordinal === 2) { rows[0].source_hash = 'changed-in-final-audit'; changedAudit = true; }
    });
    expect(() => ownedRead(x.db, () => read(x.db, x.g.physical.source.sourceId))).toThrow('corrupt original physical pitch prefix');
    expect(changedAudit).toBe(true); expect(reads()).toBe(2);
    // Real SQLite results were passed through, then deliberately corrupted at the audit boundary.
    // Unlike the harmless discarded alias case, the changed object is consumed by the final audit.
    expect(actors.actorJson(x.rows())).toBe(x.beforeRows);
  } finally { x.close(); }
});

it('paired historical prefix ignores later payloads but rejects malformed later metadata', () => {
  const x = pairedPitchFixture(); try {
    const firstId = String(x.rows()[0].source_id), middleId = String(x.rows()[1].source_id);
    const expected = pitches.captureOriginalPhysicalPitchRows(x.db, firstId), middleRows = pitches.captureOriginalPhysicalPitchRows(x.db, middleId);
    const first = pitches.readOriginalPhysicalPitchPrefixFromSqlite(x.db, firstId)[0];
    const middle = pitches.readOriginalPhysicalPitchPrefixFromSqlite(x.db, middleId), read = requirePairedReader();
    x.db.prepare("UPDATE physical_pitch_progress_actions SET source_json='{' WHERE source_id=?").run(x.g.physical.source.sourceId);
    const result = ownedRead(x.db, () => read(x.db, firstId));
    expect(result.prefix).toEqual([first]); expect(result.originalPitchRows).toEqual(expected);
    const middleResult = ownedRead(x.db, () => read(x.db, middleId));
    expect(middleResult.prefix).toEqual(middle); expect(middleResult.originalPitchRows).toEqual(middleRows);
    expect(() => pitches.readPhysicalPitchProgressFromSqlite(x.db, x.g.physical.frame.gameId, x.g.physical.frame.match.playId)).toThrow('corrupt');
    x.db.prepare('UPDATE physical_pitch_progress_actions SET progress_revision=2.5 WHERE source_id=?').run('pitch-1');
    expect(() => ownedRead(x.db, () => read(x.db, firstId))).toThrow('corrupt original physical pitch prefix');
  } finally { x.close(); }
});

it('paired owner rejects native autocommit and prepare-only transaction claims', () => {
  const x = pairedPitchFixture(); try {
    const read = requirePairedReader();
    expect(x.db.isTransaction).toBe(false); expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull();
    expect(() => read(x.db, x.g.physical.source.sourceId)).toThrow(/owned|scope|frame/);
    const adapter = { prepare: x.db.prepare.bind(x.db), isTransaction: true };
    expect(() => read(adapter, x.g.physical.source.sourceId)).toThrow(/owned|scope|frame/);
    expect(x.db.isTransaction).toBe(false); expect(queryOnly(x.db)).toBe(0);
  } finally { x.close(); }
});

it('flight derives a fresh pair inside a writable caller transaction and restores its state', () => {
  const x = pairedPitchFixture(); try {
    requirePairedReader(); const frames: object[] = [];
    const counts = x.observeReplay({ afterActor: () => {
      expect(x.db.isTransaction).toBe(true); expect(queryOnly(x.db)).toBe(1);
      const frame = activeBattedWorldFieldReadFrame(x.db); expect(frame).not.toBeNull(); frames.push(frame!);
    } });
    x.db.exec('CREATE TABLE paired_caller_write(value INTEGER); BEGIN IMMEDIATE; INSERT INTO paired_caller_write VALUES(17)');
    const value = x.owner.derive(x.g.input, null);
    expect(actors.actorJson(value)).toBe(x.expectedJson); expect(counts).toEqual({ authentications: 1, executions: [0, 1, 2] });
    expect(frames).toHaveLength(1); expect(x.db.isTransaction).toBe(true); expect(queryOnly(x.db)).toBe(0);
    expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull();
    expect(x.db.prepare('SELECT value FROM paired_caller_write').get()!.value).toBe(17);
    x.db.exec('INSERT INTO paired_caller_write VALUES(18); ROLLBACK');
    expect(x.db.prepare('SELECT count(*) AS n FROM paired_caller_write').get()!.n).toBe(0);
  } finally { x.close(); }
});

it('direct autocommit flight derive retains independent legacy authentication and exact bytes', () => {
  const x = pairedPitchFixture(); try {
    const counts = x.observeReplay(), value = x.owner.derive(x.g.input, null);
    expect(actors.actorJson(value)).toBe(x.expectedJson);
    expect(counts).toEqual({ authentications: 2, executions: [0, 1, 2, 0, 1, 2] });
    expect(x.db.isTransaction).toBe(false); expect(queryOnly(x.db)).toBe(0);
  } finally { x.close(); }
});

it('prepare-only flight adapter retains bounded legacy reads despite a transaction claim', () => {
  const x = pairedPitchFixture(); try {
    const prepare = x.db.prepare.bind(x.db), adapter = { isTransaction: true, prepare: (sql: string) => {
      if (/SELECT \* FROM physical_pitch_progress_actions WHERE game_id=\? AND play_id=\? ORDER BY progress_revision/.test(sql)) {
        throw new Error('unbounded future payload read');
      }
      return prepare(sql);
    } };
    const counts = x.observeReplay(), value = battedBallFlightEvidenceFromSqlite(adapter).derive(x.g.input, null);
    expect(actors.actorJson(value)).toBe(x.expectedJson);
    // Resolver still executes twice; the actor counter is connection-identity-filtered and not asserted for this adapter.
    expect(counts.executions).toEqual([0, 1, 2, 0, 1, 2]); expect(x.db.isTransaction).toBe(false);
  } finally { x.close(); }
});

it.each(['table', 'view', 'upper_table', 'upper_view'] as const)('prepare-only Club adapter cannot bypass a National owner %s', kind => {
  const x = pairedPitchFixture(); try {
    const adapter = { isTransaction: true, prepare: x.db.prepare.bind(x.db) };
    if (kind === 'table') x.db.exec('CREATE TABLE world_national_match_origins(source_id TEXT)');
    else if (kind === 'view') x.db.exec('CREATE VIEW world_national_match_origins AS SELECT 1 AS source_id');
    else if (kind === 'upper_table') x.db.exec('CREATE TABLE WORLD_NATIONAL_MATCH_ORIGINS(source_id TEXT)');
    else x.db.exec('CREATE VIEW WORLD_NATIONAL_MATCH_ORIGINS AS SELECT 1 AS source_id');
    expect(() => assertNationalMatchBindings(adapter, x.g.physical.frame.bindings))
      .toThrow('National Match evidence requires a Native connection');
    expect(() => battedBallFlightEvidenceFromSqlite(adapter).derive(x.g.input, null))
      .toThrow('corrupt original physical pitch prefix');
  } finally { x.close(); }
});

it('prepare-only adapter cannot authenticate National bindings or an absent National origin', () => {
  const x = pairedPitchFixture(); try {
    const adapter = { isTransaction: true, prepare: x.db.prepare.bind(x.db) };
    const bindings = x.g.physical.frame.bindings.map(binding => ({ ...binding, nationalRosterSnapshotId: 'national-original' }));
    expect(() => assertNationalMatchBindings(adapter, bindings)).toThrow('National Match evidence requires a Native connection');
    expect(() => readNationalMatchOrigin(adapter, x.g.physical.frame.gameId)).toThrow('National Match evidence requires a Native connection');
  } finally { x.close(); }
});

it('legacy autocommit capture detects a dependency mutation between flight reads', () => {
  const x = pairedPitchFixture(); let mutated = false;
  try {
    const capture = pitches.captureOriginalPhysicalPitchRows;
    x.restore(vi.spyOn(pitches, 'captureOriginalPhysicalPitchRows').mockImplementation((...args) => {
      expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull(); expect(x.db.isTransaction).toBe(false);
      x.db.prepare("UPDATE physical_plate_appearance_actors SET source_hash='between-independent-reads' WHERE source_id=?")
        .run(x.g.physical.frame.batterActor!.source.sourceId); mutated = true;
      return capture(...args);
    }));
    expect(() => x.owner.derive(x.g.input, null)).toThrow('corrupt original physical pitch prefix');
    expect(mutated).toBe(true); expect(actors.actorJson(x.rows())).toBe(x.beforeRows);
  } finally { x.close(); }
});

it('successive owned pairs reauthenticate a dependency after a committed change', () => {
  const x = pairedPitchFixture(); try {
    const read = requirePairedReader(), sourceId = x.g.physical.frame.batterActor!.source.sourceId;
    const original = x.db.prepare('SELECT source_hash FROM physical_plate_appearance_actors WHERE source_id=?').get(sourceId)!.source_hash;
    const frames: object[] = [], run = () => ownedRead(x.db, () => { frames.push(activeBattedWorldFieldReadFrame(x.db)!); return read(x.db, x.g.physical.source.sourceId); });
    expect(run().originalPitchRows).toEqual(x.legacyRows);
    x.db.prepare("UPDATE physical_plate_appearance_actors SET source_hash='between-owned-pairs' WHERE source_id=?").run(sourceId);
    expect(() => run()).toThrow('corrupt original physical pitch prefix');
    x.db.prepare('UPDATE physical_plate_appearance_actors SET source_hash=? WHERE source_id=?').run(original, sourceId);
    expect(run().originalPitchRows).toEqual(x.legacyRows); expect(new Set(frames).size).toBe(3);
  } finally { x.close(); }
});

it('paired read in an existing parent scope retains that exact parent frame', () => {
  const x = pairedPitchFixture(); try {
    const read = requirePairedReader();
    ownedRead(x.db, () => {
      const parent = activeBattedWorldFieldReadFrame(x.db);
      expect(read(x.db, x.g.physical.source.sourceId).originalPitchRows).toEqual(x.legacyRows);
      expect(activeBattedWorldFieldReadFrame(x.db)).toBe(parent); expect(queryOnly(x.db)).toBe(1);
      withBattedWorldPhysicalReadTraversal(x.db, () => {
        expect(activeBattedWorldFieldReadFrame(x.db)).not.toBe(parent);
        expect(read(x.db, x.g.physical.source.sourceId).originalPitchRows).toEqual(x.legacyRows);
      });
      expect(activeBattedWorldFieldReadFrame(x.db)).toBe(parent);
    });
    expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull(); expect(queryOnly(x.db)).toBe(0);
  } finally { x.close(); }
});

it('writer-local paired derive denies DML and DDL then returns to a writable caller', () => {
  const x = pairedPitchFixture(); let attempted = false;
  try {
    requirePairedReader();
    x.db.exec('CREATE TABLE pair_guard_probe(value INTEGER); BEGIN IMMEDIATE');
    const counts = x.observeReplay({ afterActor: () => {
      expect(queryOnly(x.db)).toBe(1); attempted = true;
      expect(() => x.db.exec('INSERT INTO pair_guard_probe VALUES(1)')).toThrow(/readonly/i);
      expect(() => x.db.exec('CREATE TEMP TABLE forbidden_pair_ddl(value INTEGER)')).toThrow(/readonly/i);
    } });
    expect(actors.actorJson(x.owner.derive(x.g.input, null))).toBe(x.expectedJson);
    expect(attempted).toBe(true); expect(counts.authentications).toBe(1);
    expect(queryOnly(x.db)).toBe(0); expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull(); expect(x.db.isTransaction).toBe(true);
    expect(x.db.prepare('SELECT count(*) AS n FROM pair_guard_probe').get()!.n).toBe(0);
    x.db.exec('INSERT INTO pair_guard_probe VALUES(2); ROLLBACK');
  } finally { x.close(); }
});

it('owned pair rejects guard removal followed by a same-connection write', () => {
  const x = pairedPitchFixture(); let changed = false;
  try {
    const read = requirePairedReader(); x.db.exec('CREATE TABLE pair_change_probe(value INTEGER); INSERT INTO pair_change_probe VALUES(0)');
    x.observeReplay({ afterActor: () => {
      if (changed) return; changed = true;
      x.db.exec('PRAGMA query_only=OFF; UPDATE pair_change_probe SET value=1; PRAGMA query_only=ON');
    } });
    expect(() => ownedRead(x.db, () => read(x.db, x.g.physical.source.sourceId))).toThrow(/changed|transaction|cleanup/);
    expect(changed).toBe(true); expect(x.db.isTransaction).toBe(false); expect(queryOnly(x.db)).toBe(0);
    expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull();
    expect(x.db.prepare('SELECT value FROM pair_change_probe').get()!.value).toBe(0);
    expect(actors.actorJson(x.rows())).toBe(x.beforeRows);
  } finally { x.close(); }
});

it('owned pair rejects rollback-rebegin replacement even when a transaction remains active', () => {
  const x = pairedPitchFixture(); let replaced = false;
  try {
    const read = requirePairedReader();
    x.observeReplay({ afterActor: () => {
      if (replaced) return; replaced = true; x.db.exec('ROLLBACK; BEGIN');
    } });
    expect(() => ownedRead(x.db, () => read(x.db, x.g.physical.source.sourceId))).toThrow(/savepoint|transaction|cleanup/);
    expect(replaced).toBe(true); expect(x.db.isTransaction).toBe(false); expect(queryOnly(x.db)).toBe(0);
    expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull(); expect(actors.actorJson(x.rows())).toBe(x.beforeRows);
  } finally { x.close(); }
});

it('paired WAL snapshot stays consistent and the next independent read sees a peer mutation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'paired-prefix-wal-')), path = join(directory, 'state.sqlite');
  let x: ReturnType<typeof pairedPitchFixture> | undefined, peer: InstanceType<typeof DatabaseSync> | undefined;
  try {
    x = pairedPitchFixture(path); peer = new DatabaseSync(path);
    const own = x, other = peer, read = requirePairedReader();
    expect(own.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    const actorId = own.g.physical.frame.batterActor!.source.sourceId;
    let changed = false;
    own.observeReplay({ afterActor: () => {
      if (changed) return; changed = true;
      other.prepare("UPDATE physical_plate_appearance_actors SET source_hash='peer-after-snapshot' WHERE source_id=?").run(actorId);
    } });
    expect(ownedRead(own.db, () => read(own.db, own.g.physical.source.sourceId)).originalPitchRows).toEqual(own.legacyRows);
    expect(changed).toBe(true);
    expect(() => ownedRead(own.db, () => read(own.db, own.g.physical.source.sourceId))).toThrow('corrupt original physical pitch prefix');
    expect(own.db.isTransaction).toBe(false); expect(queryOnly(own.db)).toBe(0); expect(activeBattedWorldFieldReadFrame(own.db)).toBeNull();
  } finally {
    try { peer?.close(); } finally { try { x?.close(); } finally { rmSync(directory, { recursive: true, force: true }); } }
  }
});

it('paired audit rejects a duplicate metadata identity introduced after authenticated capture', () => {
  const x = pairedPitchFixture(); let loads = 0, changed = false;
  try {
    const read = requirePairedReader(), prepare = x.db.prepare.bind(x.db);
    x.restore(vi.spyOn(x.db, 'prepare').mockImplementation(sql => {
      const statement = prepare(sql);
      if (sql === 'SELECT source_id,progress_revision FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? ORDER BY progress_revision') {
        const all = statement.all;
        x.restore(vi.spyOn(statement, 'all').mockImplementation((...args: unknown[]) => {
          const rows = Reflect.apply(all, statement, args) as ReturnType<typeof statement.all>;
          if (++loads === 2) { expect(rows).toHaveLength(3); rows[1].source_id = rows[0].source_id; changed = true; }
          return rows;
        }));
      }
      return statement;
    }));
    expect(() => ownedRead(x.db, () => read(x.db, x.g.physical.source.sourceId))).toThrow('corrupt original physical pitch prefix');
    expect(changed).toBe(true); expect(loads).toBe(2); expect(actors.actorJson(x.rows())).toBe(x.beforeRows);
  } finally { x.close(); }
});

it('paired audit rejects an endpoint moved to a foreign game after authenticated capture', () => {
  const x = pairedPitchFixture(); let loads = 0, changed = false;
  try {
    const read = requirePairedReader(), prepare = x.db.prepare.bind(x.db);
    x.restore(vi.spyOn(x.db, 'prepare').mockImplementation(sql => {
      const statement = prepare(sql);
      if (sql === 'SELECT source_id,game_id,play_id,progress_revision FROM physical_pitch_progress_actions WHERE source_id=?') {
        const get = statement.get;
        x.restore(vi.spyOn(statement, 'get').mockImplementation((...args: unknown[]) => {
          const row = Reflect.apply(get, statement, args) as ReturnType<typeof statement.get>;
          if (++loads === 2) { expect(row).toBeDefined(); row!.game_id = 'foreign-game'; changed = true; }
          return row;
        }));
      }
      return statement;
    }));
    expect(() => ownedRead(x.db, () => read(x.db, x.g.physical.source.sourceId))).toThrow('corrupt original physical pitch prefix');
    expect(changed).toBe(true); expect(loads).toBe(2); expect(actors.actorJson(x.rows())).toBe(x.beforeRows);
  } finally { x.close(); }
});

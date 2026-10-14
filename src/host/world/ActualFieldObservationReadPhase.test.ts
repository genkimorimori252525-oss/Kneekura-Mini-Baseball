import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { actualFieldObservationFixture } from './ActualFieldObservationFixtures.test-support';
import * as physical from './SqliteBattedWorldFieldStore';
import * as responses from './SqliteBattedContactResponseStore';
import { openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

it('reuses original field roots within observation write phases and reauthenticates after writes and callbacks', () => {
  const directory = mkdtempSync(join(tmpdir(), 'observation-read-phase-'));
  const x = actualFieldObservationFixture(join(directory, 'state.sqlite'));
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let connection: import('node:sqlite').DatabaseSync | undefined, responseReads = 0, corruptInCallback = false;
  const reads: { frame: object | null; roots: number }[] = [];
  const responseOwner = responses.battedContactResponseEvidenceFromSqlite;
  // Passive witnesses delegate every original read and preserve its result.
  const responseWitness = vi.spyOn(responses, 'battedContactResponseEvidenceFromSqlite').mockImplementation(db => {
    const own = responseOwner(db);
    return { ...own, read(id) { responseReads++; return own.read(id); } };
  });
  const fieldOwner = physical.battedWorldFieldEvidenceFromSqlite;
  const fieldWitness = vi.spyOn(physical, 'battedWorldFieldEvidenceFromSqlite').mockImplementation(db => {
    if (!(db instanceof DatabaseSync)) throw new Error('observation phase witness requires Native ownership');
    connection ??= db;
    const own = fieldOwner(db);
    return { ...own, read(id) {
      const before = responseReads, frame = physical.activeBattedWorldFieldReadFrame(db);
      const value = own.read(id); reads.push({ frame, roots: responseReads - before }); return value;
    } };
  });
  const outsidePhase = () => {
    expect(connection!.isTransaction).toBe(false);
    expect(physical.activeBattedWorldFieldReadFrame(connection!)).toBeNull();
    expect(connection!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  };
  const store = x.f.track(openSqliteActualFieldObservationStore(x.f.path, { readAcceptedObservation() {
    outsidePhase();
    if (corruptInCallback) x.f.db.prepare("UPDATE batted_contact_responses SET snapshot_hash='callback-corruption' WHERE source_id=?")
      .run(x.baseField.response.source.sourceId);
    return x.observationSource;
  } }));
  const rows = () => ['actual_field_observations', 'actual_field_observation_heads', 'batted_world_field_actions',
    'batted_world_field_executions', 'batted_world_field_execution_heads']
    .map(table => x.f.db.prepare(`SELECT rowid,* FROM ${table} ORDER BY rowid`).all());
  try {
    const before = rows();
    x.f.db.exec(`CREATE TRIGGER corrupt_observation_original AFTER INSERT ON actual_field_observations
      BEGIN UPDATE batted_world_field_actions SET snapshot_hash='trigger-corruption'; END`);
    const written = witnessSqliteWrite('INSERT INTO actual_field_observations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', db =>
      db.prepare('SELECT snapshot_hash FROM batted_world_field_actions WHERE source_id=?').get(x.baseField.source.sourceId)!.snapshot_hash === 'trigger-corruption');
    try {
      expect(() => store.accept(x.observationSource.sourceId)).toThrow(/corrupt original actual field action snapshot/);
      expect(written.wasReached()).toBe(true);
    } finally { written.close(); }
    expect(rows()).toEqual(before);
    x.f.db.exec('DROP TRIGGER corrupt_observation_original'); reads.length = 0;

    const saved = store.accept(x.observationSource.sourceId);
    expect(saved.receipt.perceived.ball).not.toBeNull();
    expect(reads.every(read => read.frame !== null)).toBe(true);
    const firstFrames = [...new Set(reads.map(read => read.frame))];
    expect(firstFrames).toHaveLength(3);
    // Each phase authenticates the field root once; adjacent dependency reads
    // still audit the archives but reuse that completed original root.
    const phaseReads = firstFrames.map(frame => reads.filter(read => read.frame === frame));
    expect(phaseReads.map(phase => phase.reduce((total, read) => total + read.roots, 0))).toEqual([1, 1, 1]);
    expect(phaseReads.every(phase => phase.length > 1 && phase.some(read => read.roots === 0))).toBe(true);
    const accepted = rows(); reads.length = 0;
    expect(store.accept(x.observationSource.sourceId)).toEqual(saved);
    expect(store.read(x.observationSource.sourceId)).toEqual(saved);
    expect(reads.map(read => read.roots)).toEqual([1, 1, 1]);
    expect(new Set(reads.map(read => read.frame)).size).toBe(3);
    expect(reads.every(read => read.frame !== null && !firstFrames.includes(read.frame))).toBe(true);
    expect(rows()).toEqual(accepted);

    corruptInCallback = true;
    expect(() => store.accept(x.observationSource.sourceId)).toThrow(/corrupt original batted response archive/);
    outsidePhase();
  } finally {
    fieldWitness.mockRestore(); responseWitness.mockRestore(); x.f.close();
    rmSync(directory, { recursive: true, force: true });
  }
}, 45_000);

import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedScheduledMotionArchiveEncoding as encode } from './OwnedScheduledMotionArchive';
import { battedWorldFieldExecutionEvidenceFromSqlite, openSqliteBattedWorldFieldExecutionStore,
  type AcceptedBattedWorldFieldExecution, type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';

const state = vi.hoisted(() => ({ onReplay: null as ((sourceId: string) => void) | null }));
// Structural owner regression, not a genuine pitch/physics fixture: substitute
// only the lower field and plan calculation. Real SQL discovery, causal scope,
// archive encoding, raw-row/hash checks and private dependency contexts run.
vi.mock('./SqliteBattedWorldFieldStore', () => ({
  battedWorldFieldEvidenceFromSqlite: () => ({ scope: (base: DurableBattedWorldFieldAction) => [base] }),
}));
vi.mock('./OwnedScheduledMotionExecution', () => {
  return { createOwnedScheduledMotionExecutionReplay: () => ({
    snapshotIdentity: encode,
    derive(source: AcceptedBattedWorldFieldExecution, prefix: { baseField: DurableBattedWorldFieldAction }) {
      state.onReplay?.(source.sourceId);
      return { kind: 'owned_acquisition_plan_v1', field: prefix.baseField.field, plan: { fixture: source.sourceId } };
    },
  }) };
});
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it.each(['return', 'throw'] as const)('keeps each pitch ceiling during older-pitch ancestry and restores it after nested %s', outcome => {
  const directory = mkdtempSync(join(tmpdir(), 'motion-pitch-scope-')), path = join(directory, 'state.sqlite');
  const store = openSqliteBattedWorldFieldExecutionStore(path, { read: () => null });
  const db = new DatabaseSync(path), owner = battedWorldFieldExecutionEvidenceFromSqlite(db);
  db.exec(`CREATE TABLE batted_world_field_actions (source_id TEXT,physical_pitch_source_id TEXT,response_source_id TEXT,
    geometry_source_id TEXT,revision INTEGER,game_id TEXT);
    CREATE TABLE batted_world_field_heads (physical_pitch_source_id TEXT,source_id TEXT,revision INTEGER);`);
  const seed = (pitch: string, playId: number) => {
    const fieldSource = { sourceId: pitch + ':field', sourceVersion: 'structural-v1' };
    const base = { source: fieldSource, revision: 1, history: [fieldSource],
      response: { source: { sourceId: pitch + ':response' }, model: { gameId: 'game' },
        touch: { worldContact: { flight: { source: { physicalPitchSourceId: pitch }, physicalPitch: { frame: { match: { playId } } } } } } },
      geometry: { source: { sourceId: 'geometry' } }, field: { motion: {} } } as unknown as DurableBattedWorldFieldAction;
    const source: AcceptedBattedWorldFieldExecution = { sourceId: pitch + ':plan', sourceVersion: 'structural-v1',
      baseFieldSourceId: fieldSource.sourceId, previousExecutionSourceId: null,
      action: { kind: 'owned_acquisition_plan_v1', knownWork: Array.from({ length: 10 }, (_, i) => ({
        playerId: 'p' + i, decisionSourceId: null, motorSourceId: null })) } };
    const value = { source, baseField: base, revision: 1, history: [source], execution: {
      kind: 'owned_acquisition_plan_v1', field: base.field, plan: { fixture: source.sourceId } } } as unknown as DurableBattedWorldFieldExecution;
    const encoded = encode(value);
    db.prepare('INSERT INTO batted_world_field_actions VALUES (?,?,?,?,?,?)').run(fieldSource.sourceId, pitch, pitch + ':response', 'geometry', 1, 'game');
    db.prepare('INSERT INTO batted_world_field_heads VALUES (?,?,1)').run(pitch, fieldSource.sourceId);
    db.prepare('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)').run(source.sourceId, pitch, fieldSource.sourceId,
      null, 1, 'game', json(source), hash(source), encoded.json, encoded.hash);
    db.prepare('INSERT INTO batted_world_field_execution_heads VALUES (?,?,?,1)').run(pitch, fieldSource.sourceId, source.sourceId);
    return { base, source, value };
  };
  const older = seed('older-pitch', 7), newer = seed('newer-pitch', 8), marker = new Error('nested ancestry diagnostic');
  const rows = () => ['batted_world_field_executions', 'batted_world_field_execution_heads']
    .map(table => db.prepare(`SELECT rowid,* FROM ${table} ORDER BY rowid`).all());
  const before = rows(); let nestedReads = 0;
  const outerCeiling = () => {
    expect(owner.scope(newer.base, null)).toEqual([]);
    expect(() => owner.scope(newer.base, newer.source.sourceId)).toThrow('exceeds its proven physical predecessor');
    expect(() => owner.scope(newer.base)).toThrow('exceeds its proven physical predecessor');
  };
  state.onReplay = sourceId => {
    if (sourceId === newer.source.sourceId) {
      // The old stop's explicit zero-execution cut is outside this pitch's
      // rank namespace. Its own rows/head/identity metadata must still run.
      expect(owner.scope(older.base, null)).toEqual([]);
      if (outcome === 'throw') expect(() => owner.scope(older.base, older.source.sourceId)).toThrow(marker);
      else expect(json(owner.scope(older.base, older.source.sourceId))).toBe(json([older.value]));
      outerCeiling();
    } else {
      expect(sourceId).toBe(older.source.sourceId); nestedReads++;
      expect(owner.scope(older.base, null)).toEqual([]);
      expect(() => owner.scope(older.base, older.source.sourceId)).toThrow('exceeds its proven physical predecessor');
      outerCeiling(); // The older context must not hide the still-active outer one.
      if (outcome === 'throw') throw marker;
    }
  };
  try {
    expect(json(owner.scope(newer.base, newer.source.sourceId))).toBe(json([newer.value]));
    expect(nestedReads).toBe(1); expect(rows()).toEqual(before);
    state.onReplay = null;
    // Both private contexts must have gone after the outer read finishes.
    expect(json(owner.scope(newer.base, newer.source.sourceId))).toBe(json([newer.value]));
    expect(json(owner.scope(older.base, older.source.sourceId))).toBe(json([older.value]));
    db.prepare('UPDATE batted_world_field_executions SET snapshot_hash=? WHERE source_id=?').run('corrupt-old-archive', older.source.sourceId);
    expect(() => owner.scope(older.base, older.source.sourceId)).toThrow('corrupt actual field execution snapshot');
  } finally { state.onReplay = null; db.close(); store.close(); rmSync(directory, { recursive: true, force: true }); }
});

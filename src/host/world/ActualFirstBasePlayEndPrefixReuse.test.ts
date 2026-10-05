import { createRequire } from 'node:module';
import { beforeEach, expect, it, vi } from 'vitest';
import { assertOwnedMotionPhysicalMetadata } from './OwnedMotionPhysicalMetadata';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const state = vi.hoisted(() => ({ paired: 0, derived: 0, fieldReads: 0, fieldScopes: 0, executionScopes: 0,
  prefix: null as any, scope: null as any, current: [] as boolean[], admissionsHook: null as null | (() => void), metadataHook: null as null | ((db: any) => void) }));
vi.mock('./ActualLivePlayEvidenceFromSqlite', () => ({ actualLivePlayEvidenceFromSqlite: (db: any) => ({
  derive: (_source: unknown, current: boolean) => { state.derived++; state.current.push(current); state.metadataHook?.(db); return { scope: state.scope }; },
  deriveWithPhysicalPrefix: (_source: unknown, current: boolean) => { state.paired++; state.current.push(current); state.metadataHook?.(db); return { value: { scope: state.scope }, prefix: state.prefix }; },
}) }));
vi.mock('./SqliteBattedWorldFieldStore', () => ({ battedWorldFieldEvidenceFromSqlite: () => ({
  read: () => { state.fieldReads++; return state.prefix.baseField; },
  scope: () => { state.fieldScopes++; return state.prefix.fields; },
}) }));
vi.mock('./SqliteBattedWorldFieldExecutionStore', () => ({ battedWorldFieldExecutionEvidenceFromSqlite: () => ({
  scope: () => { state.executionScopes++; return state.prefix.executions; },
}) }));
vi.mock('./ActualLivePlayInventoryFromSqlite', () => ({ actualLiveOwnerInstalled: () => true }));
vi.mock('./SqliteActualLivePlayRuntimeStore', () => ({ actualLiveRuntimeEvidenceFromSqlite: () => ({
  read: () => ({ source: { physicalPitchSourceId: 'pitch' }, gameId: 'game', playId: 1, originalPitchHash: 'pitch-hash',
    membership: { scopeId: 'scope', participants: [], producers: [] } }),
  admissions: () => { state.admissionsHook?.(); return []; },
}) }));
import { actualFirstBasePlayEndEvidenceFromSqlite } from './ActualFirstBasePlayEndEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const source = { sourceId: 'end', sourceVersion: 'v1', runtimeSourceId: 'runtime', baseFieldSourceId: 'field', executionSourceId: 'execution',
  ruleConsumptionSourceId: 'rule', umpireCallSourceId: 'call', communicationSourceId: 'communication' };
beforeEach(() => {
  state.paired = 0; state.derived = 0; state.fieldReads = 0; state.fieldScopes = 0; state.executionScopes = 0;
  state.current = []; state.admissionsHook = null; state.metadataHook = null;
  state.scope = { gameId: 'game', playId: 1, originalPitchHash: 'pitch-hash', scopeId: 'scope', participation: 'supported_empty_base',
    participants: [], producers: [], physicalReferences: [] };
  // Deliberately no current first-base rule: reach a real pending result without
  // expensive physical fixtures or pretending this projection proves a PlayEnd.
  state.prefix = { baseField: { source: { sourceId: 'field' } }, fields: [], executions: [] };
});
it.each([false, undefined])('keeps the original untransactioned PlayEnd reconstruction (%s)', isTransaction => {
  const db = { isTransaction } as never;
  expect(actualFirstBasePlayEndEvidenceFromSqlite(db).derive(source).kind).toBe('pending');
  expect([state.derived, state.paired, state.fieldReads, state.fieldScopes, state.executionScopes]).toEqual([1, 0, 1, 1, 1]);
});
it('uses the fresh scope-owned prefix once per transaction derive with identical pending bytes and current flag', () => {
  const db = new DatabaseSync(':memory:'); try {
    const owner = actualFirstBasePlayEndEvidenceFromSqlite(db), before = json(owner.derive(source));
    db.exec('BEGIN');
    expect(json(owner.derive(source, true))).toBe(before);
    expect([state.derived, state.paired, state.fieldReads, state.fieldScopes, state.executionScopes]).toEqual([1, 1, 1, 1, 1]);
    expect(json(owner.derive(source))).toBe(before); expect(state.paired).toBe(2);
    expect(state.current).toEqual([false, true, false]);
    state.scope = { ...state.scope, originalPitchHash: 'changed' };
    expect(() => owner.derive(source)).toThrow(/membership differs/);
  } finally { db.close(); }
});
it('rejects a missing transaction-owned prefix without silently reconstructing it', () => {
  const db = new DatabaseSync(':memory:'); try {
    db.exec('BEGIN'); state.prefix = null;
    expect(() => actualFirstBasePlayEndEvidenceFromSqlite(db).derive(source)).toThrow(/physical prefix.*missing/);
    expect([state.derived, state.paired, state.fieldReads, state.fieldScopes, state.executionScopes]).toEqual([0, 1, 0, 0, 0]);
  } finally { db.close(); }
});
it('rejects an admissions hook writing on the same connection before the paired prefix is used', () => {
  const db = new DatabaseSync(':memory:'); try {
    db.exec('CREATE TABLE mutation(value TEXT); BEGIN');
    state.admissionsHook = () => db.exec("INSERT INTO mutation VALUES ('changed')");
    expect(() => actualFirstBasePlayEndEvidenceFromSqlite(db).derive(source)).toThrow(/changed during.*read|read.*changed/);
  } finally { db.close(); }
});

// Real metadata validation inside the narrow pending-result projection above.
// Count only SQL text; retaining StatementSync return values in a spy would
// itself keep every native statement alive and distort this regression.
it('prepares each exact metadata query once per PlayEnd derive while executing every validation', () => {
  const db = new DatabaseSync(':memory:'), prepare = db.prepare;
  const counts = new Map<string, number>();
  db.prepare = function(sql, ...options) {
    counts.set(sql, (counts.get(sql) ?? 0) + 1);
    return prepare.call(this, sql, ...options);
  };
  const sourceMetadata = { sourceId: 'execution', sourceVersion: 'v1', baseFieldSourceId: 'field', previousExecutionSourceId: null };
  const row = { source_id: 'execution', physical_pitch_source_id: 'pitch', base_field_source_id: 'field', previous_source_id: null,
    revision: 1, game_id: 'game', source_json: JSON.stringify(sourceMetadata), snapshot_json: JSON.stringify({ source: sourceMetadata,
      revision: 1, history: [sourceMetadata], baseField: { source: { sourceId: 'field' }, response: { model: { gameId: 'game' },
        touch: { worldContact: { flight: { source: { physicalPitchSourceId: 'pitch' } } } } } } }) };
  const bytes = JSON.stringify(row);
  state.metadataHook = actualDb => {
    expect(actualDb).toBe(db);
    assertOwnedMotionPhysicalMetadata(actualDb, row, [row]);
    assertOwnedMotionPhysicalMetadata(actualDb, row, [row]);
    // The same prepared query must execute with new raw bytes and still reject.
    const corrupt = { ...row, source_json: row.source_json.replace('"sourceVersion":', '"sourceVersion":"other","sourceVersion":') };
    expect(() => assertOwnedMotionPhysicalMetadata(actualDb, corrupt, [corrupt])).toThrow(/metadata/);
  };
  try {
    const owner = actualFirstBasePlayEndEvidenceFromSqlite(db);
    const first = json(owner.derive(source));
    expect(JSON.stringify(row)).toBe(bytes);
    expect([...counts.values()].every(count => count === 1)).toBe(true);
    const firstCounts = [...counts.entries()];
    counts.clear();
    expect(json(owner.derive(source))).toBe(first);
    expect([...counts.entries()]).toEqual(firstCounts);
  } finally { db.prepare = prepare; db.close(); }
});

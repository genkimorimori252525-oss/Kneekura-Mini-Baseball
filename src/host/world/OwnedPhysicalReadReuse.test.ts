import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type FieldOwnerModule = typeof import('./SqliteBattedWorldFieldStore');
type ExecutionOwnerModule = typeof import('./SqliteBattedWorldFieldExecutionStore');
const real = vi.hoisted(() => ({ field: null as FieldOwnerModule | null, execution: null as ExecutionOwnerModule | null }));
// Tiny owner-wiring tests: physics sampling is replaced by deterministic outputs.
// SQLite identity, snapshots, transactions and all umpire/communication reads are real.
const state = vi.hoisted(() => ({ reads: 0, scopes: 0, pairs: 0, fieldScopes: 0,
  missing: false, generation: 0, fieldHook: null as null | (() => void) }));
vi.mock('./PhysicalPitchEvidenceFromSqlite', () => ({ readOriginalPhysicalPitchPrefixFromSqlite: () => [{
  source: { sourceId: 'pitch' }, frame: { gameId: 'game', batterActor: { binding: { playerId: 'batter' } }, world: { runners: [], defenders: [] } },
}] }));
// Publish complete mocks before importing real traversal helpers. Loading either
// original module inside its factory crosses back through umpire/communication
// consumers while Vitest bypasses the still-resolving mock on that call stack.
vi.mock('./SqliteBattedWorldFieldStore', () => ({
  withBattedWorldFieldReadTraversal: <T>(db: Parameters<FieldOwnerModule['withBattedWorldFieldReadTraversal']>[0], body: () => T): T =>
    real.field!.withBattedWorldFieldReadTraversal(db, body),
  activeBattedWorldFieldReadFrame: (...args: Parameters<FieldOwnerModule['activeBattedWorldFieldReadFrame']>) =>
    real.field!.activeBattedWorldFieldReadFrame(...args),
  isAuthenticatedBattedWorldFieldTraversalValue: (...args: Parameters<FieldOwnerModule['isAuthenticatedBattedWorldFieldTraversalValue']>) =>
    real.field!.isAuthenticatedBattedWorldFieldTraversalValue(...args),
  battedWorldFieldEvidenceFromSqlite: () => ({ scope: () => {
  state.fieldScopes++; state.fieldHook?.(); return [];
} }) }));
vi.mock('./SqliteBattedWorldFieldExecutionStore', () => {
  const value = (id: string) => ({ source: { sourceId: id }, generation: state.generation, baseField: { source: { sourceId: 'field' } } });
  return { withBattedWorldPhysicalReadTraversal: <T>(db: Parameters<ExecutionOwnerModule['withBattedWorldPhysicalReadTraversal']>[0], body: () => T): T =>
    real.execution!.withBattedWorldPhysicalReadTraversal(db, body), battedWorldFieldExecutionEvidenceFromSqlite: () => ({
    read: (id: string) => { state.reads++; return value(id); },
    scope: (_base: unknown, id: string) => { state.scopes++; return [value(id)]; },
    readWithExecutions: (id: string) => { state.pairs++; return state.missing ? null : { value: value(id), executions: [value(id)] }; },
    current: () => {},
  }) };
});
vi.mock('./ActualFirstBaseUmpire', async importOriginal => ({
  ...await importOriginal<typeof import('./ActualFirstBaseUmpire')>(),
  sampleActualFirstBaseUmpireObservation: (source: any, setup: any, _current: any, prefix: any) => ({ source, setup,
    gameId: 'game', physicalPitchSourceId: 'pitch', playId: 1, batterRunnerId: 'batter', outsAtStart: 0,
    clock: { originTick: 0, ticksPerSecond: 1000 }, availability: { originTick: 0, tick: 1000, elapsedSeconds: 1 },
    ruleEvidenceRevision: 1, ruleEvidenceHash: 'rule', physicalPrefixHash: JSON.stringify(prefix),
    perception: { kind: 'pending', reason: 'calibration_unavailable' }, eventEvidence: null }),
  deriveActualFirstBaseUmpireCall: (source: any, observation: any, _current: any, prefix: any) => ({ source, observation,
    currentExecutionHash: JSON.stringify(prefix), advancedThrough: { originTick: 0, tick: 1000, elapsedSeconds: 1 },
    schedule: { kind: 'pending', reason: 'calibration_unavailable' }, onFieldCall: null }),
}));
vi.mock('./ActualCallCommunication', async importOriginal => ({
  ...await importOriginal<typeof import('./ActualCallCommunication')>(),
  deriveActualCallCommunication: (source: any, call: any, model: any, prefix: any) => ({ source, revision: 1, history: [source],
    gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch', callHash: hash(call), modelHash: model ? hash(model) : null,
    physicalPrefixHash: json(prefix), evaluatedThrough: { originTick: 0, tick: 1000, elapsedSeconds: 1 } }),
}));
import { openSqliteActualFirstBaseUmpireStore, actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { openSqliteActualCommunicationStore, actualCommunicationEvidenceFromSqlite } from './SqliteActualCommunicationStore';
real.field = await vi.importActual<FieldOwnerModule>('./SqliteBattedWorldFieldStore');
real.execution = await vi.importActual<ExecutionOwnerModule>('./SqliteBattedWorldFieldExecutionStore');
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const resetCounts = () => { state.reads = 0; state.scopes = 0; state.pairs = 0; state.fieldScopes = 0; };
beforeEach(() => { resetCounts(); state.missing = false; state.generation = 0; state.fieldHook = null; });
const setup = { sourceId: 'setup', sourceVersion: 'v1', gameId: 'game', physicalPitchSourceId: 'pitch', umpireId: 'umpire', pose: null, attention: null, calibration: null };
const observation = { sourceId: 'observation', sourceVersion: 'v1', setupSourceId: 'setup', ruleExecutionSourceId: 'rule-cut' };
const call = { sourceId: 'call', sourceVersion: 'v1', observationSourceId: 'observation', currentExecutionSourceId: 'current-cut' };
const communication = { sourceId: 'communication', sourceVersion: 'v1', callSourceId: 'call', modelSourceId: 'model',
  currentExecutionSourceId: 'current-cut', previousCommunicationSourceId: null };
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'owned-physical-read-')), path = join(directory, 'state.sqlite');
  const umpire = openSqliteActualFirstBaseUmpireStore(path, { readAcceptedSetup: () => setup,
    readAcceptedObservation: () => observation, readAcceptedCall: () => call });
  const comm = openSqliteActualCommunicationStore(path, { readAcceptedModel: () => ({ sourceId: 'model', sourceVersion: 'v1',
    gameId: 'game', physicalPitchSourceId: 'pitch', parameters: null }), readAcceptedCommunication: () => communication });
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE physical_pitch_progress_actions(source_id TEXT, game_id TEXT, play_id INTEGER); INSERT INTO physical_pitch_progress_actions VALUES ('pitch','game',1);");
  umpire.acceptSetup('setup'); umpire.observe('observation'); umpire.advanceCall('call'); comm.acceptModel('model');
  resetCounts();
  return { db, path, umpire, comm, close() { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); comm.close(); umpire.close(); rmSync(directory, { recursive: true, force: true }); } };
};
it.each([false, undefined])('retains independent read plus scope outside a transaction (%s)', isTransaction => {
  const x = fixture(); try {
    const db = { prepare: x.db.prepare.bind(x.db), ...(isTransaction === undefined ? {} : { isTransaction }) };
    actualFirstBaseUmpireEvidenceFromSqlite(db).readCall('call');
    expect([state.reads, state.scopes, state.pairs, state.fieldScopes]).toEqual([2, 2, 0, 2]);
    resetCounts(); actualCommunicationEvidenceFromSqlite(db).derive(communication);
    expect([state.reads, state.scopes, state.pairs, state.fieldScopes]).toEqual([3, 3, 0, 3]);
  } finally { x.close(); }
});
it('uses two fresh paired prefixes for an ordinary call and three for communication with exact same bytes', () => {
  const x = fixture(); try {
    const umpire = actualFirstBaseUmpireEvidenceFromSqlite(x.db), comm = actualCommunicationEvidenceFromSqlite(x.db);
    const baselineCall = json(umpire.readCall('call')), baselineComm = json(comm.derive(communication));
    x.db.exec('BEGIN'); resetCounts();
    expect(json(umpire.readCall('call'))).toBe(baselineCall);
    expect([state.reads, state.scopes, state.pairs, state.fieldScopes]).toEqual([0, 0, 2, 2]);
    resetCounts(); expect(json(comm.derive(communication))).toBe(baselineComm);
    expect([state.reads, state.scopes, state.pairs, state.fieldScopes]).toEqual([0, 0, 3, 3]);
    // Each independent invocation reauthenticates; no prior pair survives it.
    expect(json(comm.derive(communication))).toBe(baselineComm); expect(state.pairs).toBe(6);
    state.generation++;
    expect(() => umpire.readCall('call')).toThrow(/corrupt/);
    expect(() => comm.derive(communication)).toThrow(/corrupt/);
  } finally { x.close(); }
});
it('never retries a missing fresh execution pair through the legacy reader', () => {
  const x = fixture(); try {
    x.db.exec('BEGIN'); state.missing = true;
    expect(() => actualFirstBaseUmpireEvidenceFromSqlite(x.db).derive('observation', observation)).toThrow(/execution Source is missing/);
    expect([state.reads, state.scopes, state.pairs]).toEqual([0, 0, 1]);
    // Let the call's two pairs pass, then omit communication's own current cut.
    state.missing = false; resetCounts(); state.fieldHook = () => { if (state.fieldScopes === 2) state.missing = true; };
    expect(() => actualCommunicationEvidenceFromSqlite(x.db).derive(communication)).toThrow(/execution Source is unavailable/);
    expect([state.reads, state.scopes, state.pairs]).toEqual([0, 0, 3]);
  } finally { x.close(); }
});
it.each(['umpire', 'communication'] as const)('rejects same-connection writes inside the %s pair-to-use interval', owner => {
  const x = fixture(); try {
    x.db.exec('CREATE TABLE interval_mutation (value TEXT); BEGIN');
    state.fieldHook = () => { if (state.fieldScopes === (owner === 'umpire' ? 1 : 3)) x.db.exec("INSERT INTO interval_mutation VALUES ('changed')"); };
    const run = () => owner === 'umpire' ? actualFirstBaseUmpireEvidenceFromSqlite(x.db).derive('observation', observation)
      : actualCommunicationEvidenceFromSqlite(x.db).derive(communication);
    expect(run).toThrow(/changed during.*read|read.*changed/);
  } finally { x.close(); }
});
it('retains real disk/WAL snapshot visibility and rejects committed snapshot corruption in the next read transaction', () => {
  const x = fixture(), peer = new DatabaseSync(x.path); try {
    expect(x.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    const reader = actualFirstBaseUmpireEvidenceFromSqlite(x.db), original = json(reader.readCall('call'));
    x.db.exec('BEGIN'); expect(json(reader.readCall('call'))).toBe(original);
    peer.prepare('UPDATE actual_first_base_umpire_calls SET snapshot_hash=? WHERE source_id=?').run('corrupt', 'call');
    expect(json(reader.readCall('call'))).toBe(original);
    x.db.exec('COMMIT; BEGIN'); expect(() => reader.readCall('call')).toThrow(/corrupt/);
  } finally { peer.close(); x.close(); }
});
it('reauthenticates communication dependencies after its insert and rolls back a same-connection model mutation', () => {
  const x = fixture(); try {
    const before = x.db.prepare('SELECT snapshot_hash FROM actual_communication_models WHERE source_id=?').get('model');
    x.db.exec(`CREATE TRIGGER mutate_reception_model AFTER INSERT ON actual_call_communications
      BEGIN UPDATE actual_communication_models SET snapshot_hash='post-insert-corrupt' WHERE source_id='model'; END;`);
    expect(() => x.comm.accept('communication')).toThrow(/corrupt actual communication model/);
    expect(x.db.prepare('SELECT * FROM actual_call_communications').all()).toEqual([]);
    expect(x.db.prepare('SELECT snapshot_hash FROM actual_communication_models WHERE source_id=?').get('model')).toEqual(before);
  } finally { x.close(); }
});
it('keeps acceptance and identical retries fresh while preserving every stored communication byte', () => {
  const x = fixture(); try {
    const first = x.comm.accept('communication');
    expect(state.pairs).toBeGreaterThan(0);
    const before = x.db.prepare('SELECT * FROM actual_call_communications').all(); resetCounts();
    expect(json(x.comm.accept('communication'))).toBe(json(first));
    expect(state.reads).toBe(0); expect(state.scopes).toBe(0); expect(state.pairs).toBeGreaterThan(0);
    expect(x.db.prepare('SELECT * FROM actual_call_communications').all()).toEqual(before);
    x.db.prepare('UPDATE actual_communication_models SET snapshot_hash=?').run('changed-before-retry');
    expect(() => x.comm.accept('communication')).toThrow(/corrupt actual communication model/);
  } finally { x.close(); }
});

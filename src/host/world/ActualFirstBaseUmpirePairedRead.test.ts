import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Light owner-boundary regression only: replace expensive physical sampling.
// SQLite Source/row authentication, call availability and disposition stay real.
const state = vi.hoisted(() => ({ physicalReads: 0, generation: 0,
  callKind: 'out' as 'out' | 'safe' | 'pending' | 'scheduled' }));
vi.mock('./PhysicalPitchEvidenceFromSqlite', () => ({ readOriginalPhysicalPitchPrefixFromSqlite: () => [
  { source: { sourceId: 'pitch' }, frame: { gameId: 'game' } },
] }));
vi.mock('./SqliteBattedWorldFieldStore', () => ({ battedWorldFieldEvidenceFromSqlite: () => ({ scope: () => [] }) }));
vi.mock('./SqliteBattedWorldFieldExecutionStore', () => {
  const read = (id: string) => {
    state.physicalReads++;
    return { source: { sourceId: id }, generation: state.generation, baseField: { source: { sourceId: 'field' } } };
  };
  return { withBattedWorldPhysicalReadTraversal: <T>(_db: unknown, body: () => T): T => body(),
    battedWorldFieldExecutionEvidenceFromSqlite: () => ({ read, scope: () => [], current: () => {},
    readWithExecutions: (id: string) => ({ value: read(id), executions: [] }),
  }) };
});
vi.mock('./ActualFirstBaseUmpire', async importOriginal => ({
  ...await importOriginal<typeof import('./ActualFirstBaseUmpire')>(),
  sampleActualFirstBaseUmpireObservation: (source: any, setup: any, current: any) => ({ source, setup,
    gameId: 'game', physicalPitchSourceId: 'pitch', playId: 1, batterRunnerId: 'batter', outsAtStart: 0,
    clock: { originTick: 0, ticksPerSecond: 1000 }, availability: { originTick: 0, tick: 1000, elapsedSeconds: 1 },
    ruleEvidenceRevision: 1, ruleEvidenceHash: 'rule', physicalPrefixHash: JSON.stringify(current),
    perception: { kind: 'pending', reason: 'calibration_unavailable' }, eventEvidence: null }),
  deriveActualFirstBaseUmpireCall: (source: any, observation: any, current: any) => ({ source, observation,
    currentExecutionHash: JSON.stringify(current), advancedThrough: { originTick: 0, tick: 1000, elapsedSeconds: 1 },
    schedule: state.callKind === 'pending' ? { kind: 'pending', reason: 'calibration_unavailable' }
      : state.callKind === 'scheduled' ? { kind: 'scheduled', calledAtElapsedSeconds: 1 }
        : { kind: 'called', call: state.callKind, calledAtElapsedSeconds: 1, availableAtElapsedSeconds: 1, tick: 1000 },
    onFieldCall: state.callKind === 'pending' || state.callKind === 'scheduled' ? null
      : { callId: source.sourceId, tick: 1000, basisSnapshotId: 'rule', basisEvidenceRevision: 1,
        ruling: { outsAfter: state.callKind === 'out' ? 1 : 0,
          basesAfter: { first: state.callKind === 'safe' ? 'batter' : null, second: null, third: null }, scoredRunnerIds: [] } },
  }),
}));
import { actualFirstBaseUmpireEvidenceFromSqlite, openSqliteActualFirstBaseUmpireStore } from './SqliteActualFirstBaseUmpireStore';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const setup = { sourceId: 'setup', sourceVersion: 'v1', gameId: 'game', physicalPitchSourceId: 'pitch', umpireId: 'umpire', pose: null, attention: null, calibration: null };
const observation = { sourceId: 'observation', sourceVersion: 'v1', setupSourceId: 'setup', ruleExecutionSourceId: 'rule-cut' };
const source = { sourceId: 'call', sourceVersion: 'v1', observationSourceId: 'observation', currentExecutionSourceId: 'current-cut' };
const at = { originTick: 0, tick: 1000, elapsedSeconds: 1 };
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'umpire-paired-read-')), path = join(directory, 'state.sqlite');
  const store = openSqliteActualFirstBaseUmpireStore(path, { readAcceptedSetup: () => setup,
    readAcceptedObservation: () => observation, readAcceptedCall: () => source });
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE physical_pitch_progress_actions(source_id TEXT, game_id TEXT, play_id INTEGER); INSERT INTO physical_pitch_progress_actions VALUES ('pitch','game',1);");
  store.acceptSetup('setup'); store.observe('observation'); store.advanceCall('call');
  state.physicalReads = 0;
  return { db, path, store, close() { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); store.close(); rmSync(directory, { recursive: true, force: true }); } };
};
beforeEach(() => { state.physicalReads = 0; state.generation = 0; state.callKind = 'out'; });

it.each([false, true])('pairs one authenticated call with byte-identical disposition (transaction=%s)', transaction => {
  const x = fixture(); try {
    if (transaction) x.db.exec('BEGIN');
    const owner = actualFirstBaseUmpireEvidenceFromSqlite(x.db);
    const before = x.db.prepare('SELECT * FROM actual_first_base_umpire_calls').all();
    const expected = { call: owner.readAvailableCall('call', at), disposition: owner.offensiveDisposition('call', at) };
    expect(state.physicalReads).toBe(4);
    expect(owner).toHaveProperty('readAvailableCallWithDisposition', expect.any(Function));
    state.physicalReads = 0;
    const first = owner.readAvailableCallWithDisposition('call', at);
    expect(json(first)).toBe(json(expected)); expect(state.physicalReads).toBe(2);
    expect(first.disposition).toEqual({ kind: 'retired', runnerId: 'batter', causeCallSourceId: 'call', at });
    const second = owner.readAvailableCallWithDisposition('call', at);
    expect(json(second)).toBe(json(first)); expect(state.physicalReads).toBe(4);
    expect(second).not.toBe(first); expect(second.call).not.toBe(first.call);
    expect(second.disposition).not.toBe(first.disposition);
    expect(Object.isFrozen(first)).toBe(true); expect(Object.isFrozen(first.call?.observation)).toBe(true);
    expect(() => Object.assign(first.call!.source, { sourceVersion: 'changed' })).toThrow();
    expect(x.db.prepare('SELECT * FROM actual_first_base_umpire_calls').all()).toEqual(before);
    state.generation++;
    expect(() => owner.readAvailableCallWithDisposition('call', at)).toThrow(/corrupt/);
  } finally { x.close(); }
});

it.each(['out', 'safe', 'pending', 'scheduled'] as const)('preserves %s availability and disposition without accepting a caller receipt', callKind => {
  state.callKind = callKind;
  const x = fixture(); try {
    const owner = actualFirstBaseUmpireEvidenceFromSqlite(x.db);
    expect(owner).toHaveProperty('readAvailableCallWithDisposition', expect.any(Function));
    for (const [id, moment] of [['absent', at], ['call', { ...at, tick: 999, elapsedSeconds: 0.999 }], ['call', at]] as const) {
      const expected = { call: owner.readAvailableCall(id, moment), disposition: owner.offensiveDisposition(id, moment) };
      expect(json(owner.readAvailableCallWithDisposition(id, moment))).toBe(json(expected));
    }
    const result = owner.readAvailableCallWithDisposition('call', at);
    expect(result.disposition.kind).toBe(callKind === 'out' ? 'retired' : callKind === 'safe' ? 'active' : 'pending');
    expect(() => owner.readAvailableCallWithDisposition({ call: result.call } as never, at)).toThrow(/Source identity/);
    for (const moment of [{ ...at, originTick: 1 }, { ...at, tick: 1001 }, { ...at, elapsedSeconds: NaN }]) {
      expect(() => owner.readAvailableCall('call', moment)).toThrow();
      expect(() => owner.readAvailableCallWithDisposition('call', moment)).toThrow();
    }
    // As before, a missing call returns pending before consulting its absent clock.
    expect(owner.readAvailableCallWithDisposition('absent', { ...at, tick: 1001 })).toEqual({
      call: null, disposition: { kind: 'pending', reason: 'operative_call_unavailable' },
    });
  } finally { x.close(); }
});

it('reauthenticates raw call ownership on each paired read and preserves WAL visibility', () => {
  const x = fixture(), peer = new DatabaseSync(x.path); try {
    const owner = actualFirstBaseUmpireEvidenceFromSqlite(x.db);
    expect(owner).toHaveProperty('readAvailableCallWithDisposition', expect.any(Function));
    expect(x.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    x.db.exec('BEGIN');
    const original = json(owner.readAvailableCallWithDisposition('call', at));
    peer.prepare('UPDATE actual_first_base_umpire_calls SET snapshot_hash=? WHERE source_id=?').run('corrupt', 'call');
    expect(json(owner.readAvailableCallWithDisposition('call', at))).toBe(original);
    x.db.exec('COMMIT; BEGIN');
    expect(() => owner.readAvailableCallWithDisposition('call', at)).toThrow(/corrupt/);
  } finally { peer.close(); x.close(); }
});

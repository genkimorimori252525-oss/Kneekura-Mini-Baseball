import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const state = vi.hoisted(() => ({ currentId: 'cut-one', currentSeconds: 1 }));
vi.mock('./PhysicalPitchEvidenceFromSqlite', () => ({ readOriginalPhysicalPitchPrefixFromSqlite: () => [{ source: { sourceId: 'pitch' }, frame: { gameId: 'game' } }] }));
vi.mock('./SqliteBattedWorldFieldStore', () => ({ battedWorldFieldEvidenceFromSqlite: () => ({ scope: () => [] }) }));
vi.mock('./SqliteBattedWorldFieldExecutionStore', () => ({ battedWorldFieldExecutionEvidenceFromSqlite: () => ({
  read: (id: string) => ({ source: { sourceId: id }, seconds: id === 'cut-one' ? 1 : 2, baseField: { source: { sourceId: 'field' } } }),
  readWithExecutions: (id: string) => ({ value: { source: { sourceId: id }, seconds: id === 'cut-one' ? 1 : 2, baseField: { source: { sourceId: 'field' } } }, executions: [] }),
  scope: () => [], current: (value: { source: {sourceId: string} }) => { if (value.source.sourceId !== state.currentId) throw Error('stale cut'); },
}) }));
vi.mock('./ActualFirstBaseUmpire', async (importOriginal) => {
  const original = await importOriginal<typeof import('./ActualFirstBaseUmpire')>();
  return { ...original,
    sampleActualFirstBaseUmpireObservation: (source: any, setup: any) => ({ source, setup, gameId: 'game', physicalPitchSourceId: 'pitch',
      playId: 1, batterRunnerId: 'batter', outsAtStart: 0, clock: { originTick: 0, ticksPerSecond: 1000 },
      availability: { originTick: 0, tick: 1000, elapsedSeconds: 1 }, ruleEvidenceRevision: 1, ruleEvidenceHash: 'rule', physicalPrefixHash: 'physical',
      perception: { kind: 'pending', reason: 'calibration_unavailable' }, eventEvidence: null }),
    deriveActualFirstBaseUmpireCall: (source: any, observation: any, current: any) => ({ source, observation, currentExecutionHash: current.source.sourceId,
      advancedThrough: { originTick: 0, tick: current.seconds * 1000, elapsedSeconds: current.seconds },
      schedule: { kind: 'pending', reason: 'calibration_unavailable' }, onFieldCall: null }),
  };
});
import { openSqliteActualFirstBaseUmpireStore } from './SqliteActualFirstBaseUmpireStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
it.each(['rewrite', 'delete'] as const)('must not allow a call insertion trigger to %s a prior frozen call', (mutation) => {
  state.currentId = 'cut-one'; state.currentSeconds = 1;
  const path = join(mkdtempSync(join(tmpdir(), 'umpire-review-')), 'case.sqlite');
  const setup = { sourceId: 'setup', sourceVersion: 'v1', gameId: 'game', physicalPitchSourceId: 'pitch', umpireId: 'umpire', pose: null, attention: null, calibration: null };
  const observation = { sourceId: 'observation', sourceVersion: 'v1', setupSourceId: 'setup', ruleExecutionSourceId: 'cut-one' };
  const first = { sourceId: 'call-one', sourceVersion: 'v1', observationSourceId: 'observation', currentExecutionSourceId: 'cut-one' };
  const second = { ...first, sourceId: 'call-two', currentExecutionSourceId: 'cut-two' };
  const store = openSqliteActualFirstBaseUmpireStore(path, { readAcceptedSetup: () => setup, readAcceptedObservation: () => observation,
    readAcceptedCall: (id) => id === first.sourceId ? first : second });
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER); INSERT INTO physical_pitch_progress_actions VALUES('pitch','game',1);");
  try {
    expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    store.acceptSetup(setup.sourceId); store.observe(observation.sourceId);
    const prior = store.advanceCall(first.sourceId);
    const changedSource = { ...first, sourceVersion: 'trigger-rewrite' };
    const changed = { ...prior, source: changedSource };
    const sql = (value: string) => `'${value.replaceAll("'", "''")}'`;
    db.exec(`CREATE TRIGGER rewrite_old_call AFTER INSERT ON actual_first_base_umpire_calls WHEN NEW.source_id='call-two'
      BEGIN ${mutation === 'delete' ? "DELETE FROM actual_first_base_umpire_calls WHERE source_id='call-one'" : `UPDATE actual_first_base_umpire_calls SET source_version='trigger-rewrite',
      source_json=${sql(json(changedSource))}, source_hash=${sql(hash(changedSource))}, snapshot_json=${sql(json(changed))}, snapshot_hash=${sql(hash(changed))}
      WHERE source_id='call-one'`}; END;`);
    state.currentId = 'cut-two'; state.currentSeconds = 2;
    let error: unknown; try { store.advanceCall(second.sourceId); } catch (e) { error = e; }
    const rows = db.prepare('SELECT source_id,source_version FROM actual_first_base_umpire_calls ORDER BY source_id').all();
    console.log('review mutation outcome', { error: String(error), rows });
    expect(error, 'new call must roll back when the original frozen call changes').toBeDefined();
    expect(rows).toEqual([{source_id:'call-one',source_version:'v1'}]);
  } finally { store.close(); db.close(); }
});


it('keeps an original call readable without parsing opaque later call payloads', () => {
  state.currentId = 'cut-one'; state.currentSeconds = 1;
  const path = join(mkdtempSync(join(tmpdir(), 'umpire-bounded-read-')), 'case.sqlite');
  const setup = { sourceId: 'setup', sourceVersion: 'v1', gameId: 'game', physicalPitchSourceId: 'pitch', umpireId: 'umpire', pose: null, attention: null, calibration: null };
  const observation = { sourceId: 'observation', sourceVersion: 'v1', setupSourceId: 'setup', ruleExecutionSourceId: 'cut-one' };
  const first = { sourceId: 'call-one', sourceVersion: 'v1', observationSourceId: 'observation', currentExecutionSourceId: 'cut-one' };
  const second = { ...first, sourceId: 'call-two', currentExecutionSourceId: 'cut-two' };
  const store = openSqliteActualFirstBaseUmpireStore(path, { readAcceptedSetup: () => setup, readAcceptedObservation: () => observation,
    readAcceptedCall: id => id === first.sourceId ? first : second });
  const db = new DatabaseSync(path);
  db.exec("CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER); INSERT INTO physical_pitch_progress_actions VALUES('pitch','game',1);");
  try {
    expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    store.acceptSetup(setup.sourceId); store.observe(observation.sourceId); const original = store.advanceCall(first.sourceId);
    state.currentId = 'cut-two'; state.currentSeconds = 2; store.advanceCall(second.sourceId);
    db.prepare('UPDATE actual_first_base_umpire_calls SET source_json=? WHERE source_id=?').run('opaque-future-payload', second.sourceId);
    expect(store.readCall(first.sourceId)).toEqual(original);
    expect(() => store.readCall(second.sourceId)).toThrow();
  } finally { store.close(); db.close(); }
});

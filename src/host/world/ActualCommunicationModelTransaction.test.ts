import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { openSqliteActualCommunicationStore } from './SqliteActualCommunicationStore';
import type { AcceptedActualCommunicationModel } from './ActualCallCommunication';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('rejects actual original-pitch changes pre-BEGIN, post-BEGIN and post-INSERT, then reopens an immutable explicit model', () => {
  const dir = mkdtempSync(join(tmpdir(), 'actual-reception-model-wal-')), path = join(dir, 'state.sqlite');
  const x = physicalPlateAppearanceActorFixture(path); let closed = false;
  try {
    expect(x.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    expect(x.f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')?.file).toBe(path);
    x.actors.accept(x.source.sourceId); const pitch = x.pitch(0, 0);
    const source: AcceptedActualCommunicationModel = { sourceId: 'explicit-reception-model', sourceVersion: 'synthetic-v1',
      gameId: pitch.frame.gameId, physicalPitchSourceId: pitch.source.sourceId, parameters: null };
    const raw = new Map([[source.sourceId, source]]);
    const owner = x.f.track(openSqliteActualCommunicationStore(path, { readAcceptedModel: id => raw.get(id) ?? null, readAcceptedCommunication: () => null }));
    const original = x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE source_id=?').get(pitch.source.sourceId)!;
    const originalExec = DatabaseSync.prototype.exec;
    for (const when of ['pre-BEGIN', 'post-BEGIN', 'post-INSERT'] as const) {
      const s = { ...source, sourceId: `model-${when}` }; raw.set(s.sourceId, s);
      let changed = false;
      const mutate = (db: import('node:sqlite').DatabaseSync) => db.prepare('UPDATE physical_pitch_progress_actions SET snapshot_hash=? WHERE source_id=?').run('corrupt-test-hash', pitch.source.sourceId);
      const spy = when === 'post-INSERT' ? null : vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
        if (sql !== 'BEGIN IMMEDIATE' || changed) return originalExec.call(this, sql);
        changed = true;
        if (when === 'pre-BEGIN') { expect(this).not.toBe(x.f.db); mutate(x.f.db); }
        const result = originalExec.call(this, sql);
        if (when === 'post-BEGIN') mutate(this);
        return result;
      });
      if (when === 'post-INSERT') x.f.db.exec(`CREATE TRIGGER corrupt_reception_model_pitch AFTER INSERT ON actual_communication_models
        BEGIN UPDATE physical_pitch_progress_actions SET snapshot_hash='corrupt-test-hash' WHERE source_id='${pitch.source.sourceId}'; END;`);
      try {
        expect(() => owner.acceptModel(s.sourceId)).toThrow();
        expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_communication_models').get()).toEqual({ n: 0 });
        if (when !== 'pre-BEGIN') expect(x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE source_id=?').get(pitch.source.sourceId)).toEqual(original);
        else expect(x.f.db.prepare('SELECT snapshot_hash FROM physical_pitch_progress_actions WHERE source_id=?').get(pitch.source.sourceId)).toEqual({ snapshot_hash: 'corrupt-test-hash' });
      } finally {
        spy?.mockRestore();
        if (when === 'post-INSERT') x.f.db.exec('DROP TRIGGER corrupt_reception_model_pitch');
        x.f.db.prepare('UPDATE physical_pitch_progress_actions SET snapshot_hash=? WHERE source_id=?').run(original.snapshot_hash, pitch.source.sourceId);
      }
    }
    const accepted = owner.acceptModel(source.sourceId);
    expect(accepted.source.parameters).toBeNull();
    expect(accepted.originalPlayerIds).toHaveLength(10);
    const bytes = x.f.db.prepare('SELECT * FROM actual_communication_models').all();
    const next = { ...source, sourceId: 'second-explicit-model' }; raw.set(next.sourceId, next);
    x.f.db.exec(`CREATE TRIGGER delete_prior_reception_model AFTER INSERT ON actual_communication_models
      WHEN NEW.source_id='${next.sourceId}' BEGIN DELETE FROM actual_communication_models WHERE source_id='${source.sourceId}'; END;`);
    try {
      expect(() => owner.acceptModel(next.sourceId)).toThrow(/prior model rows/);
      expect(x.f.db.prepare('SELECT * FROM actual_communication_models').all()).toEqual(bytes);
    } finally { x.f.db.exec('DROP TRIGGER delete_prior_reception_model'); }
    raw.set(source.sourceId, { ...source, sourceVersion: 'changed' });
    expect(() => owner.acceptModel(source.sourceId)).toThrow('frozen differently');
    expect(x.f.db.prepare('SELECT * FROM actual_communication_models').all()).toEqual(bytes);
    x.f.close(); closed = true;
    const reopened = openSqliteActualCommunicationStore(path), disk = new DatabaseSync(path);
    try {
      expect(disk.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
      expect(reopened.acceptModel(source.sourceId)).toEqual(accepted);
      expect(disk.prepare('SELECT * FROM actual_communication_models').all()).toEqual(bytes);
    } finally { disk.close(); reopened.close(); }
  } finally { if (!closed) x.f.close(); rmSync(dir, { recursive: true }); }
});

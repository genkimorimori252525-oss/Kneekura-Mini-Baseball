import { expect, it } from 'vitest';
import { continuousPitchFixture, continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { readOriginalPhysicalPitchPrefixFromSqlite, captureOriginalPhysicalPitchRows, readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { captureClosurePitchRows } from './PhysicalPlayClosureEvidenceFromSqlite';

const fixture = () => {
  const f = continuousPitchFixture(), actions = new Map<string, AcceptedPhysicalPitchActionSource>();
  const store = f.track(openSqlitePhysicalPitchProgressStore(f.path, { matches: f.official, initialWorlds: f.initialWorlds,
    participation: f.participation, runtime: f.stores }, { readAcceptedAction: (id) => actions.get(id) ?? null }));
  const pitch = (index: number, at: number) => {
    const source = continuousPitchAction(f, index, at); actions.set(source.sourceId, source); return store.accept(source.sourceId, index);
  };
  return { f, store, pitch };
};
it('owns the unchanged earlier original prefix after later legitimately accepted pitches', () => {
  const g = fixture(); try {
    const first = g.pitch(0, 0), before = captureOriginalPhysicalPitchRows(g.f.db, first.source.sourceId);
    const currentBefore = captureClosurePitchRows(g.f.db, first.source.sourceId);
    expect(before).toEqual({ actions: currentBefore.actions, head: currentBefore.head });
    const second = g.pitch(1, first.result.pitch.resolution.timeline.lastEventTick);
    const third = g.pitch(2, second.result.pitch.resolution.timeline.lastEventTick);
    expect(readOriginalPhysicalPitchPrefixFromSqlite(g.f.db, first.source.sourceId)).toEqual([first]);
    expect(captureOriginalPhysicalPitchRows(g.f.db, first.source.sourceId)).toEqual(before);
    expect(readOriginalPhysicalPitchPrefixFromSqlite(g.f.db, second.source.sourceId)).toEqual([first, second]);
    expect(readPhysicalPitchProgressFromSqlite(g.f.db, first.frame.gameId, first.frame.match.playId)).toEqual([first, second, third]);
  } finally { g.f.close(); }
});
it('does not execute or parse a later Source when proving an earlier owned prefix', () => {
  const g = fixture(); try {
    const first = g.pitch(0, 0); const second = g.pitch(1, first.result.pitch.resolution.timeline.lastEventTick);
    // Deliberate future corruption probes the replay boundary; it is not legitimate progress.
    g.f.db.prepare("UPDATE physical_pitch_progress_actions SET source_json='{' WHERE source_id=?").run(second.source.sourceId);
    expect(readOriginalPhysicalPitchPrefixFromSqlite(g.f.db, first.source.sourceId)).toEqual([first]);
    expect(() => readPhysicalPitchProgressFromSqlite(g.f.db, first.frame.gameId, first.frame.match.playId)).toThrow('corrupt');
  } finally { g.f.close(); }
});
it.each(['missing', ' ', 'pitch-0 '])('rejects invalid or absent original Source identity %s', (sourceId) => {
  const g = fixture(); try { g.pitch(0, 0); expect(() => readOriginalPhysicalPitchPrefixFromSqlite(g.f.db, sourceId)).toThrow(); }
  finally { g.f.close(); }
});
it.each(["source_hash='changed'", "snapshot_hash='changed'", "snapshot_json='{}'", 'progress_revision=2'])('rejects original row corruption: %s', (mutation) => {
  const g = fixture(); try {
    const first = g.pitch(0, 0); g.f.db.exec(`UPDATE physical_pitch_progress_actions SET ${mutation}`);
    expect(() => readOriginalPhysicalPitchPrefixFromSqlite(g.f.db, first.source.sourceId)).toThrow();
  } finally { g.f.close(); }
});
it.each(['DELETE FROM physical_pitch_progress_heads', "UPDATE physical_pitch_progress_heads SET last_source_id='other'",
  'UPDATE physical_pitch_progress_heads SET revision=2'])('rejects incompatible current prefix structure: %s', (sql) => {
  const g = fixture(); try {
    const first = g.pitch(0, 0); g.f.db.exec(sql);
    expect(() => readOriginalPhysicalPitchPrefixFromSqlite(g.f.db, first.source.sourceId)).toThrow();
  } finally { g.f.close(); }
});
it.each(['progress_revision=2.5', "source_id=''", "source_id=' invalid '"])(
  'rejects malformed later prefix metadata without replaying future Sources: %s', (mutation) => {
    const g = fixture(); try {
      const first = g.pitch(0, 0), second = g.pitch(1, first.result.pitch.resolution.timeline.lastEventTick);
      g.pitch(2, second.result.pitch.resolution.timeline.lastEventTick);
      g.f.db.prepare(`UPDATE physical_pitch_progress_actions SET ${mutation} WHERE source_id=?`).run(second.source.sourceId);
      expect(() => readOriginalPhysicalPitchPrefixFromSqlite(g.f.db, first.source.sourceId)).toThrow('corrupt');
    } finally { g.f.close(); }
  });

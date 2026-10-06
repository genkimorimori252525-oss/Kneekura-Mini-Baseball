import { expect, it } from 'vitest';
import { continuousPitchAction } from './ContinuousPitchFixtures.test-support';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { physicalPitchActionInput } from './PhysicalPitchEvidenceFromSqlite';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';

const unavailableLiveSources = () => {
  let calls = 0;
  const unavailable = (): never => { calls++; throw new Error('unexpected live callback during archive reopen'); };
  const sources: Parameters<typeof openSqlitePhysicalPitchProgressStore>[1] = {
    matches: { getMatch: unavailable }, initialWorlds: { readAcceptedSource: unavailable },
    participation: { readPregameBinding: unavailable },
    runtime: {
      workload: { selectAtRevision: unavailable }, timing: { selectProfileAtDay: unavailable },
      release: { selectAtDay: unavailable }, policies: { readAcceptedPolicy: unavailable },
      effortPolicies: { readAcceptedPolicy: unavailable },
    },
  };
  return { sources, calls: () => calls };
};

// These protect the real legacy owner while the staged Native batting producer
// is unimplemented. They do not assert that a Core prediction is Native evidence.
it('keeps archived physical action and snapshot bytes unchanged across offline reopen', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    x.actors.accept(x.source.sourceId);
    const original = x.pitch(0, 0);
    const bytes = () => x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE source_id=?').get(original.source.sourceId);
    const head = () => x.f.db.prepare('SELECT * FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?')
      .get(original.frame.gameId, original.frame.match.playId);
    const originalBytes = bytes(), originalHead = head();
    x.actions.clear();
    const offline = unavailableLiveSources();
    const reopened = x.f.track(openSqlitePhysicalPitchProgressStore(x.f.path, offline.sources));
    expect(reopened.readAcceptedPitch(original.source.sourceId)).toEqual(original);
    expect(reopened.accept(original.source.sourceId, 0)).toEqual(original);
    expect(offline.calls()).toBe(0);
    expect(bytes()).toEqual(originalBytes);
    expect(head()).toEqual(originalHead);
  } finally { x.f.close(); }
});

it('does not reinterpret legacy Sources with caller supplied batting evidence as the staged path', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    const legacy = continuousPitchAction(x.f, 0, 0);
    for (const extra of [
      { battingSourceId: 'caller-source' },
      { battingCommitmentSourceId: 'caller-commitment' },
      { predictionEvidence: { sourceId: 'caller-prediction' } },
      { kernel: 'aerodynamic_rigid_batting_v1' },
    ]) {
      expect(() => physicalPitchActionInput({ ...legacy, ...extra } as AcceptedPhysicalPitchActionSource, legacy.sourceId)).toThrow();
    }
    expect(physicalPitchActionInput(legacy, legacy.sourceId)).toEqual(legacy);
  } finally { x.f.close(); }
});

it('rejects a foreign pitcher and stale progress revision without changing original bytes', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    x.actors.accept(x.source.sourceId);
    const original = x.pitch(0, 0);
    const rows = () => x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY progress_revision').all();
    const before = rows();
    const next = continuousPitchAction(x.f, 1, original.result.pitch.resolution.timeline.lastEventTick);
    x.actions.set(next.sourceId, { ...next, request: { ...next.request,
      delivery: { ...next.request.delivery, playerId: x.source.playerId } } });
    expect(() => x.pitches.accept(next.sourceId, 1)).toThrow();
    expect(rows()).toEqual(before);
    x.actions.set(next.sourceId, next);
    expect(() => x.pitches.accept(next.sourceId, 0)).toThrow();
    expect(rows()).toEqual(before);
    expect(x.pitches.readProgress(original.frame.gameId, original.frame.match.playId)).toEqual(original);
  } finally { x.f.close(); }
});

it('rolls back a changed batter Person during append and resumes the original prefix offline', () => {
  const x = physicalPlateAppearanceActorFixture();
  try {
    x.actors.accept(x.source.sourceId);
    const original = x.pitch(0, 0);
    const actionsBefore = x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY progress_revision').all();
    const headBefore = x.f.db.prepare('SELECT * FROM physical_pitch_progress_heads').all();
    const next = continuousPitchAction(x.f, 1, original.result.pitch.resolution.timeline.lastEventTick);
    x.actions.set(next.sourceId, next);
    x.f.db.exec("CREATE TRIGGER corrupt_batter_during_pitch AFTER INSERT ON physical_pitch_progress_actions BEGIN DELETE FROM world_player_person_links WHERE source_id='intake-away-1'; END");
    expect(() => x.pitches.accept(next.sourceId, 1)).toThrow();
    expect(x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY progress_revision').all()).toEqual(actionsBefore);
    expect(x.f.db.prepare('SELECT * FROM physical_pitch_progress_heads').all()).toEqual(headBefore);
    expect(x.actors.read(x.source.sourceId)!.binding.personId).toBe('person-away-1');
    x.f.db.exec('DROP TRIGGER corrupt_batter_during_pitch');
    x.actions.clear();
    const offline = unavailableLiveSources();
    const reopened = x.f.track(openSqlitePhysicalPitchProgressStore(x.f.path, offline.sources));
    expect(reopened.readAcceptedPitch(original.source.sourceId)).toEqual(original);
    expect(reopened.accept(original.source.sourceId, 0)).toEqual(original);
    expect(offline.calls()).toBe(0);
    x.actions.set(next.sourceId, next);
    expect(x.pitches.accept(next.sourceId, 1).progressRevision).toBe(2);
  } finally { x.f.close(); }
});

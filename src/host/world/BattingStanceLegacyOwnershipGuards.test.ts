import { expect, it } from 'vitest';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingModelStanceFixture as fixture, stanceRows, modelRows, originalRows, unchangedOriginal }
  from './NativeBattingModelStanceFixtures.test-support';

it.each(['snapshot-source-game', 'before-timeline-play', 'result-timeline-play', 'sql-game-json-play', 'json-game-sql-play'] as const)
('rejects first stance after actual legacy execution hidden through the remaining %s scope mirror', kind => {
  const f = fixture();
  try {
    const model = f.modelStore.accept(f.source.sourceId), pitch = f.x.pitch(0, 0);
    expect(pitch.frame.batterActor).toEqual(f.actor);
    const game = f.stance.gameId, play = f.stance.playId, hiddenGame = 'hidden-game', hiddenPlay = play + 1;
    const timelineCase = kind === 'before-timeline-play' || kind === 'result-timeline-play';
    const sqlGame = timelineCase || kind === 'sql-game-json-play' ? game : hiddenGame;
    const sqlPlay = kind === 'json-game-sql-play' ? play : hiddenPlay;
    const sourceGame = timelineCase || kind === 'json-game-sql-play' ? game : hiddenGame;
    const snapshotGame = timelineCase || kind === 'snapshot-source-game' ? game : hiddenGame;
    const frameGame = timelineCase ? game : hiddenGame;
    const framePlay = kind === 'snapshot-source-game' || kind === 'sql-game-json-play' ? play : hiddenPlay;
    const actor = { ...f.actor, source: { ...f.actor.source, gameId: frameGame },
      binding: { ...f.actor.binding, gameId: frameGame }, worldFixture: { ...f.actor.worldFixture,
        game: { ...f.actor.worldFixture.game, gameId: frameGame } }, match: { ...f.actor.match, playId: framePlay } };
    const source = { ...pitch.source, gameId: sourceGame };
    const changed = { ...pitch, source: { ...pitch.source, gameId: snapshotGame },
      frame: { ...pitch.frame, gameId: frameGame, match: { ...pitch.frame.match, playId: framePlay }, batterActor: actor },
      beforeTimeline: { ...pitch.beforeTimeline, playId: kind === 'before-timeline-play' ? play : hiddenPlay },
      result: { ...pitch.result, pitch: { ...pitch.result.pitch, resolution: { ...pitch.result.pitch.resolution,
        timeline: { ...pitch.result.pitch.resolution.timeline, playId: kind === 'result-timeline-play' ? play : hiddenPlay } } } } };
    if (kind === 'snapshot-source-game') expect(changed.source.gameId).toBe(game);
    if (kind === 'before-timeline-play') expect(changed.beforeTimeline.playId).toBe(play);
    if (kind === 'result-timeline-play') expect(changed.result.pitch.resolution.timeline.playId).toBe(play);
    if (kind === 'sql-game-json-play') { expect(sqlGame).toBe(game); expect(changed.frame.match.playId).toBe(play); }
    if (kind === 'json-game-sql-play') { expect(source.gameId).toBe(game); expect(sqlPlay).toBe(play); }
    f.x.f.db.prepare(`UPDATE physical_pitch_progress_actions SET game_id=?,play_id=?,source_json=?,source_hash=?,
      snapshot_json=?,snapshot_hash=? WHERE source_id=?`)
      .run(sqlGame, sqlPlay, json(source), hash(source), json(changed), hash(changed), pitch.source.sourceId);
    f.x.f.db.prepare('UPDATE physical_pitch_progress_heads SET game_id=?,play_id=?').run(sqlGame, sqlPlay);
    const store = f.stanceStore(), before = originalRows(f), modelsBefore = modelRows(f);
    let rejected = false;
    try { store.accept(f.stance.sourceId); } catch (error) { if (!(error instanceof Error)) throw error; rejected = true; }
    expect(rejected,
      `BATTING_STANCE_LEGACY_${kind.toUpperCase().replaceAll('-', '_')}_GUARD_MISSING: actual pitch accepted before complementary scope mirrors moved`).toBe(true);
    expect(stanceRows(f)).toEqual([]); expect(modelRows(f)).toEqual(modelsBefore);
    expect(f.modelStore.read(model.source.sourceId)).toEqual(model); unchangedOriginal(f, before);
  } finally { f.close(); }
});

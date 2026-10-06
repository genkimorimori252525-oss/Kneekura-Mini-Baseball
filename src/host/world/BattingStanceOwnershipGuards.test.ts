import { expect, it } from 'vitest';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingModelStanceFixture as fixture, stanceRows, modelRows, originalRows, unchangedOriginal }
  from './NativeBattingModelStanceFixtures.test-support';

it.each(['actor-source', 'actor-binding', 'actor-world-fixture', 'duplicate-actor-container'] as const)
('rejects new stance admission when a hidden %s archive still claims the original physical play', kind => {
  const f = fixture();
  try {
    const model = f.modelStore.accept(f.source.sourceId), store = f.stanceStore(), original = store.accept(f.stance.sourceId);
    expect(original.model).toEqual(model); expect(original.actor).toEqual(f.actor);
    const hiddenSource = { ...f.stance, sourceId: 'hidden-stance', gameId: 'hidden-game', playId: f.stance.playId + 1,
      physicalActorSourceId: 'hidden-actor' };
    const hiddenActor = { ...original.actor,
      source: { ...original.actor.source, sourceId: 'hidden-actor', gameId: kind === 'actor-source' ? f.stance.gameId : 'hidden-game' },
      binding: { ...original.actor.binding, gameId: kind === 'actor-binding' ? f.stance.gameId : 'hidden-game' },
      worldFixture: { ...original.actor.worldFixture, game: { ...original.actor.worldFixture.game,
        gameId: kind === 'actor-world-fixture' ? f.stance.gameId : 'hidden-game' } },
      match: { ...original.actor.match, playId: kind === 'duplicate-actor-container' ? f.stance.playId + 1 : f.stance.playId } };
    const changed = { ...original, source: hiddenSource, actor: hiddenActor };
    const retainedActor = { ...hiddenActor, source: { ...hiddenActor.source, gameId: f.stance.gameId },
      match: { ...hiddenActor.match, playId: f.stance.playId } };
    const rawSnapshot = kind === 'duplicate-actor-container' ? '{"actor":' + json(retainedActor) + ',' + json(changed).slice(1) : json(changed);
    f.x.f.db.prepare(`UPDATE world_batting_stances SET source_id=?,game_id=?,play_id=?,physical_actor_source_id=?,
      source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=? WHERE source_id=?`)
      .run(hiddenSource.sourceId, hiddenSource.gameId, hiddenSource.playId, hiddenSource.physicalActorSourceId,
        json(hiddenSource), hash(hiddenSource), rawSnapshot, hash(changed), f.stance.sourceId);
    const fresh = { ...f.stance, sourceId: 'fresh-stance-after-hidden-claim' };
    f.stances.set(fresh.sourceId, fresh);
    const bytes = stanceRows(f), modelsBefore = modelRows(f), before = originalRows(f);
    let rejected = false;
    try { store.accept(fresh.sourceId); } catch (error) { if (!(error instanceof Error)) throw error; rejected = true; }
    expect(rejected,
      `BATTING_STANCE_NESTED_${kind.toUpperCase().replaceAll('-', '_')}_SCOPE_GUARD_MISSING: genuine original stance accepted before hidden play claim`).toBe(true);
    expect(stanceRows(f)).toEqual(bytes); expect(modelRows(f)).toEqual(modelsBefore); unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('rejects first stance admission after real legacy execution whose SQL game indices moved', () => {
  const f = fixture();
  try {
    const model = f.modelStore.accept(f.source.sourceId);
    const pitch = f.x.pitch(0, 0);
    expect(pitch.frame.batterActor).toEqual(f.actor);
    expect(f.x.f.db.prepare('SELECT COUNT(*) AS n FROM physical_pitch_progress_actions').get()).toEqual({ n: 1 });
    f.x.f.db.prepare('UPDATE physical_pitch_progress_actions SET game_id=?').run('hidden-game');
    f.x.f.db.prepare('UPDATE physical_pitch_progress_heads SET game_id=?').run('hidden-game');
    const store = f.stanceStore(), before = originalRows(f), modelsBefore = modelRows(f);
    let rejected = false;
    try { store.accept(f.stance.sourceId); } catch (error) { if (!(error instanceof Error)) throw error; rejected = true; }
    expect(rejected,
      'BATTING_STANCE_ORIGINAL_LEGACY_SCOPE_GUARD_MISSING: actual pitch accepted before moved SQL indices and first stance admission').toBe(true);
    expect(stanceRows(f)).toEqual([]); expect(modelRows(f)).toEqual(modelsBefore);
    expect(f.modelStore.read(model.source.sourceId)).toEqual(model); unchangedOriginal(f, before);
  } finally { f.close(); }
});

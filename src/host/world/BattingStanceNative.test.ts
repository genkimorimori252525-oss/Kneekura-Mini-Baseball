import { expect, it } from 'vitest';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battingModelStanceFixture as fixture, modelRows, stanceRows, originalRows, unchangedOriginal, ref }
  from './NativeBattingModelStanceFixtures.test-support';

it('accepts a prospective stance from the actual original actor and exact explicit body readiness and eye inputs', () => {
  const f = fixture();
  try {
    const model = f.modelStore.accept(f.source.sourceId), before = originalRows(f), modelsBefore = modelRows(f);
    const stances = f.stanceStore(), value = stances.accept(f.stance.sourceId);
    expect(value).toEqual({ source: f.stance, model, actor: f.actor,
      physicalState: { startTick: f.actor.world.tick, centerOfMass: f.stance.centerOfMass, eyePosition: f.stance.eyePosition } });
    expect(value.source.modelRef).toEqual(ref(model.source));
    expect(value.source.bodyReadyTick).toBe(100_000);
    expect(Object.isFrozen(value.physicalState.centerOfMass)).toBe(true);
    expect(stances.read(f.stance.sourceId)).toEqual(value);
    const rows = stanceRows(f);
    expect(rows).toHaveLength(1);
    expect(rows[0].source_json).toBe(json(f.stance));
    expect(rows[0].source_hash).toBe(hash(f.stance));
    expect(rows[0].snapshot_json).toBe(json(value));
    expect(rows[0].snapshot_hash).toBe(hash(value));
    expect(modelRows(f)).toEqual(modelsBefore);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('reopens the saved stance with no live callbacks and keeps original source and snapshot bytes', () => {
  const f = fixture();
  try {
    f.modelStore.accept(f.source.sourceId);
    const store = f.stanceStore(), value = store.accept(f.stance.sourceId), bytes = stanceRows(f), before = originalRows(f);
    const open = f.openStance(), offline = f.x.f.track(open(f.x.f.path));
    expect(offline.read(f.stance.sourceId)).toEqual(value);
    expect(offline.accept(f.stance.sourceId)).toEqual(value);
    let calls = 0;
    const readOnly = f.x.f.track(open(f.x.f.path, { readAcceptedStance: () => { calls++; throw new Error('unexpected live stance callback'); } }));
    expect(readOnly.read(f.stance.sourceId)).toEqual(value);
    expect(calls).toBe(0);
    expect(stanceRows(f)).toEqual(bytes);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it.each(['person', 'game', 'fixture', 'play', 'actor', 'world', 'start-tick', 'future-day', 'model-version'] as const)
('rejects prospective stance %s mismatch against the actual registered actor', kind => {
  const f = fixture();
  try {
    f.modelStore.accept(f.source.sourceId);
    const stance = kind === 'person' ? { ...f.stance, personId: 'person-away-2' }
      : kind === 'game' ? { ...f.stance, gameId: 'other-game' }
      : kind === 'fixture' ? { ...f.stance, fixtureEventId: 'other-fixture' }
      : kind === 'play' ? { ...f.stance, playId: f.stance.playId + 1 }
      : kind === 'actor' ? { ...f.stance, physicalActorSourceId: 'unowned-actor' }
      : kind === 'world' ? { ...f.stance, initialWorldSourceId: 'unowned-world' }
      : kind === 'start-tick' ? { ...f.stance, startedAtTick: f.stance.startedAtTick + 1 }
      : kind === 'future-day' ? { ...f.stance, acceptedAtDay: f.day + 1 }
      : { ...f.stance, modelRef: { ...f.stance.modelRef, sourceVersion: 'different-version' } };
    f.stances.set(stance.sourceId, stance);
    const store = f.stanceStore(), before = originalRows(f), modelsBefore = modelRows(f);
    expect(() => store.accept(stance.sourceId)).toThrow();
    expect(stanceRows(f)).toEqual([]);
    expect(modelRows(f)).toEqual(modelsBefore);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('rejects a second stance alias for the same original actor instead of creating independent physical truth', () => {
  const f = fixture();
  try {
    f.modelStore.accept(f.source.sourceId);
    const store = f.stanceStore(), first = store.accept(f.stance.sourceId), bytes = stanceRows(f);
    const alias = { ...f.stance, sourceId: 'alternate-stance-alias' };
    f.stances.set(alias.sourceId, alias);
    expect(() => store.accept(alias.sourceId)).toThrow();
    expect(store.read(f.stance.sourceId)).toEqual(first);
    expect(stanceRows(f)).toEqual(bytes);
  } finally { f.close(); }
});

it('rejects new stance admission after legacy pitch execution while retaining historical read and same-source retry', () => {
  const f = fixture();
  try {
    f.modelStore.accept(f.source.sourceId);
    const store = f.stanceStore(), original = store.accept(f.stance.sourceId), bytes = stanceRows(f);
    f.x.pitch(0, 0);
    const before = originalRows(f);
    expect(store.read(f.stance.sourceId)).toEqual(original);
    expect(store.accept(f.stance.sourceId)).toEqual(original);
    const later = { ...f.stance, sourceId: 'late-stance' };
    f.stances.set(later.sourceId, later);
    expect(() => store.accept(later.sourceId)).toThrow();
    expect(stanceRows(f)).toEqual(bytes);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('rejects a first new stance after legacy pitch even when no earlier stance reserves its scope', () => {
  const f = fixture();
  try {
    f.modelStore.accept(f.source.sourceId);
    f.x.pitch(0, 0);
    const store = f.stanceStore(), before = originalRows(f);
    expect(() => store.accept(f.stance.sourceId)).toThrow();
    expect(stanceRows(f)).toEqual([]);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('rejects a stale model selection for first new stance admission at the actual game day', () => {
  const f = fixture({ modelDay: 9 });
  try {
    const original = f.modelStore.accept(f.source.sourceId);
    const later = { ...f.source, sourceId: 'model-later', sourceVersion: 'native-batting-model-v2', acceptedAtDay: f.day };
    f.models.set(later.sourceId, later);
    const applicable = f.modelStore.accept(later.sourceId), store = f.stanceStore(), before = originalRows(f);
    expect(f.modelStore.selectAtDay(f.scope.careerId, f.scope.playerId, f.day)).toEqual(applicable);
    expect(() => store.accept(f.stance.sourceId)).toThrow();
    expect(stanceRows(f)).toEqual([]);
    expect(f.modelStore.read(original.source.sourceId)).toEqual(original);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('preserves original stance history and same-source retry after a later legitimate model becomes applicable', () => {
  const f = fixture({ modelDay: 9 });
  try {
    const original = f.modelStore.accept(f.source.sourceId), store = f.stanceStore(), stance = store.accept(f.stance.sourceId), bytes = stanceRows(f);
    const later = { ...f.source, sourceId: 'model-later', sourceVersion: 'native-batting-model-v2', acceptedAtDay: f.day };
    f.models.set(later.sourceId, later); f.modelStore.accept(later.sourceId);
    expect(f.modelStore.read(original.source.sourceId)).toEqual(original);
    expect(store.read(f.stance.sourceId)).toEqual(stance);
    expect(store.accept(f.stance.sourceId)).toEqual(stance);
    expect(stanceRows(f)).toEqual(bytes);
  } finally { f.close(); }
});

it('rejects changed same-ID stance bytes and a hidden original identity after moving its SQL index', () => {
  const f = fixture();
  try {
    f.modelStore.accept(f.source.sourceId);
    const store = f.stanceStore(), value = store.accept(f.stance.sourceId), bytes = stanceRows(f);
    f.stances.set(f.stance.sourceId, { ...f.stance, centerOfMass: { ...f.stance.centerOfMass, x: 4 } });
    expect(() => store.accept(f.stance.sourceId)).toThrow();
    expect(store.read(f.stance.sourceId)).toEqual(value);
    expect(stanceRows(f)).toEqual(bytes);
    f.stances.set(f.stance.sourceId, f.stance);
    f.x.f.db.prepare('UPDATE world_batting_stances SET source_id=? WHERE source_id=?').run('moved-stance-index', f.stance.sourceId);
    const corruptBytes = stanceRows(f);
    expect(() => store.read(f.stance.sourceId)).toThrow();
    expect(() => store.accept(f.stance.sourceId)).toThrow();
    expect(stanceRows(f)).toEqual(corruptBytes);
  } finally { f.close(); }
});

it.each(['sql-scope', 'sql-day', 'sql-version', 'source-scope', 'snapshot-scope'] as const)
('rejects a stance with corrupt %s mirrors even when supplied hashes match the changed JSON', kind => {
  const f = fixture();
  try {
    f.modelStore.accept(f.source.sourceId);
    const store = f.stanceStore(), value = store.accept(f.stance.sourceId), before = originalRows(f), modelsBefore = modelRows(f);
    if (kind === 'sql-scope') f.x.f.db.prepare('UPDATE world_batting_stances SET game_id=? WHERE source_id=?')
      .run('other-game', f.stance.sourceId);
    if (kind === 'sql-day') f.x.f.db.prepare('UPDATE world_batting_stances SET accepted_at_day=? WHERE source_id=?')
      .run(f.day + 1, f.stance.sourceId);
    if (kind === 'sql-version') f.x.f.db.prepare('UPDATE world_batting_stances SET source_version=? WHERE source_id=?')
      .run('tampered-stance-version', f.stance.sourceId);
    if (kind === 'source-scope') {
      const changed = { ...f.stance, gameId: 'other-game' };
      f.x.f.db.prepare('UPDATE world_batting_stances SET source_json=?,source_hash=? WHERE source_id=?')
        .run(json(changed), hash(changed), f.stance.sourceId);
    }
    if (kind === 'snapshot-scope') {
      const changed = { ...value, source: { ...value.source, gameId: 'other-game' } };
      f.x.f.db.prepare('UPDATE world_batting_stances SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
        .run(json(changed), hash(changed), f.stance.sourceId);
    }
    const corruptBytes = stanceRows(f);
    expect(() => store.read(f.stance.sourceId)).toThrow();
    expect(() => store.accept(f.stance.sourceId)).toThrow();
    expect(stanceRows(f)).toEqual(corruptBytes);
    expect(modelRows(f)).toEqual(modelsBefore);
    unchangedOriginal(f, before);
  } finally { f.close(); }
});

it('rolls back stance insertion and trigger deletion of the original actor, then reopens the successful retry', () => {
  const f = fixture();
  try {
    f.modelStore.accept(f.source.sourceId);
    const store = f.stanceStore(), before = originalRows(f), modelsBefore = modelRows(f);
    f.x.f.db.exec(`CREATE TRIGGER corrupt_stance_actor AFTER INSERT ON world_batting_stances
      BEGIN DELETE FROM physical_plate_appearance_actors WHERE source_id='batter-1'; END`);
    expect(() => store.accept(f.stance.sourceId)).toThrow();
    expect(stanceRows(f)).toEqual([]);
    expect(modelRows(f)).toEqual(modelsBefore);
    unchangedOriginal(f, before);
    f.x.f.db.exec('DROP TRIGGER corrupt_stance_actor');
    const value = store.accept(f.stance.sourceId), reopened = f.x.f.track(f.openStance()(f.x.f.path));
    expect(reopened.read(f.stance.sourceId)).toEqual(value);
  } finally { f.close(); }
});

import { expect, it } from 'vitest';
import { playerObservationModelFixture } from './PlayerObservationModelFixtures.test-support';
import { playerFieldingModelFixture } from './PlayerFieldingModelFixtures.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const cases = [
  ['fielding', 'source'], ['fielding', 'person'],
  ['observation', 'source'], ['observation', 'fielding'], ['observation', 'person'],
] as const;

it.each([
  ['fielding', 'source'], ['fielding', 'snapshot'], ['observation', 'source'], ['observation', 'snapshot'],
] as const)('rejects hidden %s Source ID retained only by its %s JSON mirror', (kind, proof) => {
  const f = kind === 'observation' ? playerObservationModelFixture() : playerFieldingModelFixture();
  try {
    const original = f.models.accept(f.source.sourceId), table = `world_player_${kind}_models`;
    const moved = { careerId: 'moved-career', playerId: 'moved-player' };
    const source = { ...f.source, ...moved, sourceId: proof === 'source' ? f.source.sourceId : 'moved-id' };
    const snapshot = JSON.parse(json(original));
    Object.assign(snapshot.source, moved, { sourceId: proof === 'snapshot' ? f.source.sourceId : 'moved-id' });
    if (kind === 'fielding') Object.assign(snapshot.person, moved);
    else {
      Object.assign(snapshot.fieldingModel.source, moved);
      Object.assign(snapshot.fieldingModel.person, moved);
    }
    f.db.prepare(`UPDATE ${table} SET source_id=?,career_id=?,player_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`).run(
      'moved-id', moved.careerId, moved.playerId, json(source), hash(source), json(snapshot), hash(snapshot));
    const before = f.db.prepare(`SELECT * FROM ${table}`).all();
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(() => f.models.read(f.source.sourceId)).toThrow();
    expect(f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual(before);
  } finally { f.close(); }
});

it.each(cases)('keeps original %s ownership discoverable through its %s snapshot identity', (kind, proof) => {
  const f = kind === 'observation' ? playerObservationModelFixture() : playerFieldingModelFixture();
  try {
    const original = f.models.accept(f.source.sourceId), table = `world_player_${kind}_models`;
    const moved = { careerId: 'moved-career', playerId: 'moved-player' };
    const movedSource = { ...f.source, ...moved };
    const snapshot = JSON.parse(json(original));
    if (proof !== 'source') Object.assign(snapshot.source, moved);
    if (kind === 'fielding') {
      if (proof !== 'person') Object.assign(snapshot.person, moved);
    } else {
      if (proof !== 'fielding') Object.assign(snapshot.fieldingModel.source, moved);
      if (proof !== 'person') Object.assign(snapshot.fieldingModel.person, moved);
    }
    f.db.prepare(`UPDATE ${table} SET career_id=?,player_id=?,source_json=?,snapshot_json=?`).run(
      moved.careerId, moved.playerId, json(movedSource), json(snapshot));
    const before = f.db.prepare(`SELECT * FROM ${table}`).all();
    const replacement = { ...f.source, sourceId: `${kind}-replacement` };
    (f.sources as Map<string, typeof replacement>).set(replacement.sourceId, replacement);
    expect(() => f.models.selectAtDay(f.source.careerId, f.source.playerId, f.source.acceptedAtDay)).toThrow();
    expect(() => f.models.accept(replacement.sourceId)).toThrow();
    expect(f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual(before);
    expect(f.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()).toEqual({ n: 1 });
  } finally { f.close(); }
});

it.each(['fielding', 'observation'] as const)('preserves healthy %s archive bytes on read, day selection and immutable retry', (kind) => {
  const f = kind === 'observation' ? playerObservationModelFixture() : playerFieldingModelFixture();
  try {
    const original = f.models.accept(f.source.sourceId), table = `world_player_${kind}_models`;
    const before = f.db.prepare(`SELECT * FROM ${table}`).all();
    expect(f.models.read(f.source.sourceId)).toEqual(original);
    expect(f.models.selectAtDay(f.source.careerId, f.source.playerId, f.source.acceptedAtDay)).toEqual(original);
    expect(f.models.accept(f.source.sourceId)).toEqual(original);
    expect(f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual(before);
  } finally { f.close(); }
});

it.each(['fielding', 'observation'] as const)('rejects multiple %s rows claiming the same original Source ID across different Player mirrors', (kind) => {
  const f = kind === 'observation' ? playerObservationModelFixture() : playerFieldingModelFixture();
  try {
    const original = f.models.accept(f.source.sourceId), table = `world_player_${kind}_models`;
    const moved = { careerId: 'moved-career', playerId: 'moved-player' }, source = { ...f.source, ...moved };
    const snapshot = JSON.parse(json(original));
    Object.assign(snapshot.source, moved);
    if (kind === 'fielding') Object.assign(snapshot.person, moved);
    else {
      Object.assign(snapshot.fieldingModel.source, moved);
      Object.assign(snapshot.fieldingModel.person, moved);
    }
    const extra = kind === 'observation' ? 'source_version,' : '';
    const model = kind === 'observation' ? 'fielding_model_source_id,' : '';
    f.db.prepare(`INSERT INTO ${table} SELECT 'moved-id',${extra}'moved-career','moved-player',person_link_source_id,${model}accepted_at_day,?,?,?,?
      FROM ${table} WHERE source_id=?`).run(json(source), hash(source), json(snapshot), hash(snapshot), f.source.sourceId);
    const before = f.db.prepare(`SELECT * FROM ${table}`).all();
    expect(() => f.models.read(f.source.sourceId)).toThrow(/Source ownership/);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/Source ownership/);
    expect(f.db.prepare(`SELECT * FROM ${table}`).all()).toEqual(before);
  } finally { f.close(); }
});

import { expect, it } from 'vitest';
import { playerObservationModelFixture as fixture } from './PlayerObservationModelFixtures.test-support';
import { openSqlitePlayerObservationModelStore, playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('owns the actual Player/Person and exact fielding baseline, then reopens without an authority', () => {
  const f = fixture();
  try {
    const value = f.models.accept(f.source.sourceId);
    expect(value.source).toEqual(f.source); expect(value.fieldingModel).toEqual(f.fieldingModel);
    expect(value.fieldingModel.person).toEqual(f.person);
    expect(value.source.calibration.perceptionAbility).toBe(0.8);
    expect(value.fieldingModel.source.ratings.situationalAwareness).toBe(0.5);
    expect(value.source).not.toHaveProperty('ratings'); expect(value.source).not.toHaveProperty('view');
    expect(Object.isFrozen(value)).toBe(true); expect(Object.isFrozen(value.source.calibration.qualityParameters.weights)).toBe(true);
    expect(Object.isFrozen(value.fieldingModel.source.ratings)).toBe(true);
    const reopened = f.track(openSqlitePlayerObservationModelStore(f.path));
    expect(reopened.read(f.source.sourceId)).toEqual(value);
    expect(reopened.accept(f.source.sourceId)).toEqual(value);
    expect(reopened.selectAtDay('career-a', 'player-a', 11)).toEqual(value);
    expect(playerObservationModelEvidenceFromSqlite(f.db).read(f.source.sourceId)).toEqual(value);
    expect(playerObservationModelEvidenceFromSqlite(f.db).selectAtDay('career-a', 'player-a', 12)).toEqual(value);
    expect(() => reopened.selectAtDay('career-a', 'player-a', 10)).toThrow(/future/);
    expect(() => reopened.selectAtDay('career-a', 'player-b', 11)).toThrow(/missing/);
    expect(() => reopened.selectAtDay('other-career', 'player-a', 11)).toThrow(/missing/);
  } finally { f.close(); }
});
it.each(['career', 'player', 'person-link', 'fielding-model', 'before-model'] as const)('rejects foreign or unavailable %s evidence', (kind) => {
  const f = fixture();
  try {
    const changed = kind === 'career' ? { ...f.source, careerId: 'other-career' }
      : kind === 'player' ? { ...f.source, playerId: 'player-b' }
      : kind === 'person-link' ? { ...f.source, personLinkSourceId: 'other-person-link' }
      : kind === 'fielding-model' ? { ...f.source, fieldingModelSourceId: 'other-model' }
      : { ...f.source, acceptedAtDay: 9 };
    f.sources.set(f.source.sourceId, changed); expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_observation_models').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('rejects a future fielding model even when the Person is already available', () => {
  const f = fixture();
  try {
    const source = { ...f.fieldingModel.source, acceptedAtDay: 12 }, model = { ...f.fieldingModel, source };
    f.db.prepare('UPDATE world_player_fielding_models SET accepted_at_day=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run(12, json(source), hash(source), json(model), hash(model));
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/scope|future/);
  } finally { f.close(); }
});
it.each([
  { sourceVersion: '' }, { sourceId: 'wrong-id' }, { acceptedAtDay: 1.5 }, { result: 'safe' },
  { calibration: null }, { ratings: { situationalAwareness: 0.5 } },
])('rejects malformed accepted Source %j', (changed) => {
  const f = fixture();
  try {
    f.sources.set(f.source.sourceId, { ...f.source, ...changed } as unknown as typeof f.source);
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_observation_models').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('rejects incomplete parameters instead of promoting fixture calibration or ratings into a default', () => {
  const f = fixture();
  try {
    const calibration = { ...f.source.calibration, perceptionAbility: undefined };
    f.sources.set(f.source.sourceId, { ...f.source, calibration } as unknown as typeof f.source);
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    f.sources.delete(f.source.sourceId); expect(() => f.models.accept(f.source.sourceId)).toThrow(/missing/);
    expect(f.models.read(f.source.sourceId)).toBeNull();
  } finally { f.close(); }
});
it('preserves the original baseline, refuses another version, and detects changed authority on retry', () => {
  const f = fixture();
  try {
    const value = f.models.accept(f.source.sourceId);
    const next = { ...f.source, sourceId: 'observation-v2', sourceVersion: 'synthetic-v2', acceptedAtDay: 12 };
    f.sources.set(next.sourceId, next); expect(() => f.models.accept(next.sourceId)).toThrow(/baseline/);
    expect(f.models.selectAtDay('career-a', 'player-a', 12)).toEqual(value);
    f.sources.set(f.source.sourceId, { ...f.source, calibration: { ...f.source.calibration, perceptionAbility: 0.1 } });
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/frozen/);
    expect(f.models.read(f.source.sourceId)).toEqual(value);
    f.sources.delete(f.source.sourceId); expect(f.models.accept(f.source.sourceId)).toEqual(value);
  } finally { f.close(); }
});
it.each([
  "UPDATE world_player_observation_models SET source_version='changed'",
  "UPDATE world_player_observation_models SET source_hash='changed'",
  "UPDATE world_player_observation_models SET snapshot_hash='changed'",
  "UPDATE world_player_observation_models SET career_id='changed'",
  "UPDATE world_player_observation_models SET player_id='changed'",
  "UPDATE world_player_observation_models SET person_link_source_id='changed'",
  "UPDATE world_player_observation_models SET fielding_model_source_id='changed'",
  'UPDATE world_player_observation_models SET accepted_at_day=12',
  "UPDATE world_player_fielding_models SET snapshot_hash='changed'",
  "UPDATE world_player_person_links SET person_id='changed'",
])('reconstructs original Source and its bindings on read and retry: %s', (sql) => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId); f.db.exec(sql);
    expect(() => f.models.read(f.source.sourceId)).toThrow();
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(() => f.models.selectAtDay('career-a', 'player-a', 11)).toThrow();
  } finally { f.close(); }
});
it('rejects a fully rehashed Person rebinding against the previously accepted observation snapshot', () => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId);
    const person = { ...f.person, personId: 'different-person' }, fieldingModel = { ...f.fieldingModel, person };
    f.db.prepare('UPDATE world_player_person_links SET person_id=?,source_json=?').run(person.personId, json(person));
    f.db.prepare('UPDATE world_player_fielding_models SET snapshot_json=?,snapshot_hash=?').run(json(fieldingModel), hash(fieldingModel));
    expect(f.fieldingModels.read(f.fieldingModel.source.sourceId)).toEqual(fieldingModel);
    expect(() => f.models.read(f.source.sourceId)).toThrow(/archive/);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/archive/);
  } finally { f.close(); }
});
it('rejects changed but rehashed fielding calibration instead of silently refreshing its exact reference', () => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId);
    const source = { ...f.fieldingModel.source, ratings: { ...f.fieldingModel.source.ratings, situationalAwareness: 0.9 } };
    const model = { ...f.fieldingModel, source };
    f.db.prepare('UPDATE world_player_fielding_models SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run(json(source), hash(source), json(model), hash(model));
    expect(f.fieldingModels.read(source.sourceId)).toEqual(model);
    expect(() => f.models.read(f.source.sourceId)).toThrow(/archive/);
  } finally { f.close(); }
});
it('validates query inputs and closed stores without creating data', () => {
  const f = fixture();
  try {
    expect(() => f.models.read(' ')).toThrow(); expect(() => f.models.accept(' ')).toThrow();
    expect(() => f.models.selectAtDay('career-a', 'player-a', NaN)).toThrow();
    expect(() => f.models.selectAtDay('career-a', 'player-a', -1)).toThrow();
    expect(() => f.models.selectAtDay('', 'player-a', 11)).toThrow();
    expect(() => openSqlitePlayerObservationModelStore('')).toThrow();
    expect(() => openSqlitePlayerObservationModelStore(f.path, {} as never)).toThrow();
    f.models.close(); f.models.close();
    expect(() => f.models.read(f.source.sourceId)).toThrow(/closed/);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/closed/);
    expect(() => f.models.selectAtDay('career-a', 'player-a', 11)).toThrow(/closed/);
  } finally { f.close(); }
});

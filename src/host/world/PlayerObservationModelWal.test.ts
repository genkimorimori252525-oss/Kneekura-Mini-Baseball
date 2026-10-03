import { expect, it } from 'vitest';
import { playerObservationModelFixture as fixture } from './PlayerObservationModelFixtures.test-support';
import { openSqlitePlayerObservationModelStore } from './SqlitePlayerObservationModelStore';

it.each([
  "UPDATE world_player_person_links SET person_id='wrong';",
  "UPDATE world_player_fielding_models SET snapshot_hash='wrong';",
  "UPDATE world_player_observation_models SET source_hash='wrong';",
  "UPDATE world_player_observation_models SET snapshot_hash='wrong';",
  "UPDATE world_player_observation_models SET fielding_model_source_id='wrong';",
  'DELETE FROM world_player_observation_models;',
])('rolls back late original/model mutation after actual insertion: %s', (sql) => {
  const f = fixture();
  try {
    f.db.exec(`CREATE TRIGGER mutate_observation AFTER INSERT ON world_player_observation_models BEGIN ${sql} END`);
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_observation_models').get()).toEqual({ n: 0 });
    expect(f.fieldingModels.read(f.fieldingModel.source.sourceId)).toEqual(f.fieldingModel);
    expect(f.links.readLink(f.person.sourceId)).toEqual(f.person);
    f.db.exec('DROP TRIGGER mutate_observation'); expect(f.models.accept(f.source.sourceId).fieldingModel).toEqual(f.fieldingModel);
  } finally { f.close(); }
});
it('rolls back a hidden duplicate Player scope after insertion', () => {
  const f = fixture();
  try {
    f.db.exec(`CREATE TRIGGER orphan_observation AFTER INSERT ON world_player_observation_models BEGIN
      INSERT INTO world_player_observation_models SELECT 'orphan-observation',source_version,career_id||'-other',player_id||'-other',
        person_link_source_id,fielding_model_source_id,accepted_at_day,source_json,source_hash,snapshot_json,snapshot_hash
      FROM world_player_observation_models WHERE source_id=NEW.source_id; END`);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/scope/);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_observation_models').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER orphan_observation'); expect(f.models.accept(f.source.sourceId).source).toEqual(f.source);
  } finally { f.close(); }
});
it.each([
  "UPDATE world_player_observation_models SET snapshot_hash='changed'",
  "UPDATE world_player_fielding_models SET source_hash='changed'",
  "UPDATE world_player_person_links SET person_id='changed'",
  'DELETE FROM world_player_observation_models',
])('re-reads the original archive on retry after an authority callback mutates it: %s', (sql) => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId);
    const changed = f.track(openSqlitePlayerObservationModelStore(f.path, { readAcceptedModel: () => {
      f.db.exec(sql); return f.source;
    } }));
    expect(() => changed.accept(f.source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('rejects an original Person mutated by initial authority callback before writing', () => {
  const f = fixture();
  try {
    const changed = f.track(openSqlitePlayerObservationModelStore(f.path, { readAcceptedModel: () => {
      f.db.exec("UPDATE world_player_person_links SET person_id='changed'"); return f.source;
    } }));
    expect(() => changed.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_observation_models').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('observes WAL writes from a second store and leaves one immutable baseline', () => {
  const f = fixture();
  try {
    const peer = f.track(openSqlitePlayerObservationModelStore(f.path, f.authority));
    const value = f.models.accept(f.source.sourceId);
    expect(peer.accept(f.source.sourceId)).toEqual(value);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_observation_models').get()).toEqual({ n: 1 });
  } finally { f.close(); }
});

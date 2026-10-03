import { expect, it } from 'vitest';
import { playerFieldingModelFixture as fixture } from './PlayerFieldingModelFixtures.test-support';
import { openSqlitePlayerFieldingModelStore } from './SqlitePlayerFieldingModelStore';

it.each([
  "UPDATE world_player_person_links SET person_id='wrong';",
  "UPDATE world_player_fielding_models SET source_hash='wrong';",
  "UPDATE world_player_fielding_models SET snapshot_hash='wrong';",
  "UPDATE world_player_fielding_models SET person_link_source_id='wrong';",
  'DELETE FROM world_player_fielding_models;',
])('rolls back late original/model mutation after the actual model insert: %s', (sql) => {
  const f = fixture();
  try {
    f.db.exec(`CREATE TRIGGER mutate_fielding AFTER INSERT ON world_player_fielding_models BEGIN ${sql} END`);
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_fielding_models').get()).toEqual({ n: 0 });
    expect(f.links.readLink(f.person.sourceId)).toEqual(f.person);
    f.db.exec('DROP TRIGGER mutate_fielding'); expect(f.models.accept(f.source.sourceId).person).toEqual(f.person);
  } finally { f.close(); }
});
it('rolls back a hidden duplicate Player scope introduced after the actual insert', () => {
  const f = fixture();
  try {
    f.db.exec(`CREATE TRIGGER orphan_fielding AFTER INSERT ON world_player_fielding_models BEGIN
      INSERT INTO world_player_fielding_models SELECT 'orphan-model',career_id||'-other',player_id||'-other',person_link_source_id,
        accepted_at_day,source_json,source_hash,snapshot_json,snapshot_hash FROM world_player_fielding_models WHERE source_id=NEW.source_id; END`);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/scope/);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_fielding_models').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER orphan_fielding'); expect(f.models.accept(f.source.sourceId).source).toEqual(f.source);
  } finally { f.close(); }
});
it('re-reads the actual own baseline on an identical retry after an authority callback changes it', () => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId);
    const changed = f.track(openSqlitePlayerFieldingModelStore(f.path, { readAcceptedModel: () => {
      f.db.exec("UPDATE world_player_fielding_models SET snapshot_hash='changed'"); return f.source;
    } }));
    expect(() => changed.accept(f.source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('rejects a torn original Person changed by the initial authority callback before writing a model', () => {
  const f = fixture();
  try {
    const changed = f.track(openSqlitePlayerFieldingModelStore(f.path, { readAcceptedModel: () => {
      f.db.exec("UPDATE world_player_person_links SET person_id='changed'"); return f.source;
    } }));
    expect(() => changed.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_fielding_models').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

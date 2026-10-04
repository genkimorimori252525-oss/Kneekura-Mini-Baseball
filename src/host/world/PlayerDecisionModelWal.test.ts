import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerDecisionModelFixture as fixture } from './PlayerDecisionModelFixtures.test-support';
import { openSqlitePlayerDecisionModelStore } from './SqlitePlayerDecisionModelStore';

it.each([
  "UPDATE world_player_person_links SET person_id='wrong';",
  "UPDATE world_player_fielding_models SET snapshot_hash='wrong';",
  "UPDATE world_player_decision_models SET source_hash='wrong';",
  "UPDATE world_player_decision_models SET snapshot_hash='wrong';",
  "UPDATE world_player_decision_models SET fielding_model_source_id='wrong';",
  'DELETE FROM world_player_decision_models;',
])('rolls back late original/model mutation after actual insertion: %s', (sql) => {
  const f = fixture();
  try {
    f.db.exec(`CREATE TRIGGER mutate_decision AFTER INSERT ON world_player_decision_models BEGIN ${sql} END`);
    expect(() => f.models.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_decision_models').get()).toEqual({ n: 0 });
    expect(f.fieldingModels.read(f.fieldingModel.source.sourceId)).toEqual(f.fieldingModel);
    expect(f.links.readLink(f.person.sourceId)).toEqual(f.person);
    f.db.exec('DROP TRIGGER mutate_decision'); expect(f.models.accept(f.source.sourceId).fieldingModel).toEqual(f.fieldingModel);
  } finally { f.close(); }
});
it('rolls back a hidden duplicate Player scope after insertion', () => {
  const f = fixture();
  try {
    f.db.exec(`CREATE TRIGGER orphan_decision AFTER INSERT ON world_player_decision_models BEGIN
      INSERT INTO world_player_decision_models SELECT 'orphan-decision',source_version,career_id||'-other',player_id||'-other',
        person_link_source_id,fielding_model_source_id,accepted_at_day,source_json,source_hash,snapshot_json,snapshot_hash
      FROM world_player_decision_models WHERE source_id=NEW.source_id; END`);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/scope/);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_decision_models').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER orphan_decision'); expect(f.models.accept(f.source.sourceId).source).toEqual(f.source);
  } finally { f.close(); }
});
it.each([
  "UPDATE world_player_decision_models SET snapshot_hash='changed'",
  "UPDATE world_player_fielding_models SET source_hash='changed'",
  "UPDATE world_player_person_links SET person_id='changed'",
  'DELETE FROM world_player_decision_models',
])('re-reads the original archive on retry after an authority callback mutates it: %s', (sql) => {
  const f = fixture();
  try {
    f.models.accept(f.source.sourceId);
    const changed = f.track(openSqlitePlayerDecisionModelStore(f.path, { readAcceptedModel: () => {
      f.db.exec(sql); return f.source;
    } }));
    expect(() => changed.accept(f.source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('rejects an original Person mutated by initial authority callback before writing', () => {
  const f = fixture();
  try {
    const changed = f.track(openSqlitePlayerDecisionModelStore(f.path, { readAcceptedModel: () => {
      f.db.exec("UPDATE world_player_person_links SET person_id='changed'"); return f.source;
    } }));
    expect(() => changed.accept(f.source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_decision_models').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('observes WAL writes from a second store and leaves one immutable baseline', () => {
  const f = fixture();
  try {
    const peer = f.track(openSqlitePlayerDecisionModelStore(f.path, f.authority));
    const value = f.models.accept(f.source.sourceId);
    expect(peer.accept(f.source.sourceId)).toEqual(value);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_decision_models').get()).toEqual({ n: 1 });
  } finally { f.close(); }
});

it('rechecks a fully valid but changed fielding original committed by a WAL peer before BEGIN', () => {
  const f = fixture(), { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const exec = DatabaseSync.prototype.exec; let changed = false;
  const source = { ...f.fieldingModel.source, ratings: { ...f.fieldingModel.source.ratings, firstStep: 0.9 } };
  const model = { ...f.fieldingModel, source };
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: import('node:sqlite').DatabaseSync, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && !changed) {
      changed = true;
      f.db.prepare('UPDATE world_player_fielding_models SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
        .run(json(source), hash(source), json(model), hash(model));
    }
    return exec.call(this, sql);
  });
  try {
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/original changed/);
    expect(changed).toBe(true);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_decision_models').get()).toEqual({ n: 0 });
    expect(f.fieldingModels.read(source.sourceId)).toEqual(model);
  } finally { hook.mockRestore(); f.close(); }
});
it.each(['person', 'fielding'] as const)('rolls back %s mutation inside BEGIN before the first insert', (kind) => {
  const f = fixture(), { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const exec = DatabaseSync.prototype.exec; let changed = false;
  const before = { fielding: f.db.prepare('SELECT * FROM world_player_fielding_models').all(),
    people: f.db.prepare('SELECT * FROM world_player_person_links').all() };
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: import('node:sqlite').DatabaseSync, sql: string) {
    exec.call(this, sql);
    if (sql === 'BEGIN IMMEDIATE' && !changed) {
      changed = true;
      exec.call(this, kind === 'person' ? "UPDATE world_player_person_links SET person_id='wrong'"
        : "UPDATE world_player_fielding_models SET source_hash='wrong'");
    }
  });
  try {
    expect(() => f.models.accept(f.source.sourceId)).toThrow(); expect(changed).toBe(true);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_decision_models').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT * FROM world_player_fielding_models').all()).toEqual(before.fielding);
    expect(f.db.prepare('SELECT * FROM world_player_person_links').all()).toEqual(before.people);
  } finally { hook.mockRestore(); f.close(); }
});
it('preserves a competing WAL acceptance committed between preflight and BEGIN', () => {
  const f = fixture(), peer = f.track(openSqlitePlayerDecisionModelStore(f.path, f.authority));
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const exec = DatabaseSync.prototype.exec; let changed = false;
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: import('node:sqlite').DatabaseSync, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; peer.accept(f.source.sourceId); }
    return exec.call(this, sql);
  });
  try {
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/baseline/); expect(changed).toBe(true);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_decision_models').get()).toEqual({ n: 1 });
    expect(f.models.accept(f.source.sourceId)).toEqual(peer.read(f.source.sourceId));
  } finally { hook.mockRestore(); f.close(); }
});
it('rolls back a post-insert duplicate hidden from both indexed and Source scope but owned by its snapshot', () => {
  const f = fixture();
  try {
    const original = { fielding: f.db.prepare('SELECT * FROM world_player_fielding_models').all(),
      people: f.db.prepare('SELECT * FROM world_player_person_links').all() };
    f.db.exec(`CREATE TRIGGER hide_decision AFTER INSERT ON world_player_decision_models BEGIN
      INSERT INTO world_player_decision_models SELECT 'hidden-decision',source_version,'other-career','other-player',
      person_link_source_id,fielding_model_source_id,accepted_at_day,
      json_set(source_json,'$.sourceId','hidden-decision','$.careerId','other-career','$.playerId','other-player'),
      source_hash,snapshot_json,snapshot_hash FROM world_player_decision_models WHERE source_id=NEW.source_id; END`);
    expect(() => f.models.accept(f.source.sourceId)).toThrow(/scope/);
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_decision_models').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT * FROM world_player_fielding_models').all()).toEqual(original.fielding);
    expect(f.db.prepare('SELECT * FROM world_player_person_links').all()).toEqual(original.people);
    f.db.exec('DROP TRIGGER hide_decision'); expect(f.models.accept(f.source.sourceId).source).toEqual(f.source);
  } finally { f.close(); }
});

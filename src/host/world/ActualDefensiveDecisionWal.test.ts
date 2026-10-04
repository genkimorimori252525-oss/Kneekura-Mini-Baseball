import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { actualDefensiveDecisionFixture as fixture } from './ActualDefensiveDecisionFixtures.test-support';
import { openSqliteActualDefensiveDecisionStore } from './SqliteActualDefensiveDecisionStore';

it('rolls back postinsert original/observation/model/plan/identity/head mutations without archive changes', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId);
    const tables = ['batted_world_field_actions', 'batted_world_field_executions', 'actual_field_observations', 'actual_field_observation_heads',
      'world_player_decision_models', 'world_player_person_links', 'world_player_fielding_models', 'actual_defensive_plans'];
    const archives = () => tables.map(t => x.f.db.prepare(`SELECT * FROM ${t}`).all()), original = archives();
    for (const [sql, table] of [
      ["UPDATE batted_world_field_actions SET source_hash='changed'", 'actual_defensive_decisions'],
      ["UPDATE actual_field_observations SET snapshot_hash='changed'", 'actual_defensive_decisions'],
      ['UPDATE actual_field_observation_heads SET revision=revision+1', 'actual_defensive_decisions'],
      ["UPDATE world_player_decision_models SET source_hash='changed'", 'actual_defensive_decisions'],
      ["UPDATE world_player_person_links SET person_id='changed'", 'actual_defensive_decisions'],
      ["UPDATE actual_defensive_plans SET source_hash='changed'", 'actual_defensive_decisions'],
      ["UPDATE actual_defensive_decisions SET player_id='changed'", 'actual_defensive_decisions'],
      ["UPDATE actual_defensive_decisions SET snapshot_hash='changed'", 'actual_defensive_decisions'],
      ['UPDATE actual_defensive_decision_heads SET revision=revision+1', 'actual_defensive_decision_heads'],
    ]) {
      x.f.db.exec(`CREATE TRIGGER mutation AFTER INSERT ON ${table} BEGIN ${sql}; END`);
      expect(() => x.decisions.accept(x.decisionSource.sourceId), sql).toThrow();
      expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decisions').get()).toEqual({ n: 0 });
      expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decision_heads').get()).toEqual({ n: 0 });
      expect(archives()).toEqual(original); x.f.db.exec('DROP TRIGGER mutation');
    }
    expect(x.decisions.accept(x.decisionSource.sourceId).revision).toBe(1); expect(archives()).toEqual(original);
  } finally { x.f.close(); }
});

it('rechecks own DB dependencies inside BEGIN and rolls back injected changes before insertion', () => {
  const x = fixture(), { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  x.plans.accept(x.planSource.sourceId); const original = x.f.db.prepare('SELECT * FROM actual_defensive_plans').all();
  const exec = DatabaseSync.prototype.exec; let changed = false;
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
    exec.call(this, sql);
    if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; exec.call(this, "UPDATE actual_defensive_plans SET source_hash='wrong'"); }
  });
  try {
    expect(() => x.decisions.accept(x.decisionSource.sourceId)).toThrow(); expect(changed).toBe(true);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decisions').get()).toEqual({ n: 0 });
    expect(x.f.db.prepare('SELECT * FROM actual_defensive_plans').all()).toEqual(original);
  } finally { hook.mockRestore(); x.f.close(); }
});

it('preserves a competing acceptance committed immediately before BEGIN', () => {
  const x = fixture(), { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  x.plans.accept(x.planSource.sourceId); const peer = x.f.track(openSqliteActualDefensiveDecisionStore(x.f.path, x.decisionAuthority));
  const exec = DatabaseSync.prototype.exec; let changed = false;
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; peer.accept(x.decisionSource.sourceId); }
    return exec.call(this, sql);
  });
  try {
    expect(() => x.decisions.accept(x.decisionSource.sourceId)).toThrow(/predecessor/); expect(changed).toBe(true);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decisions').get()).toEqual({ n: 1 });
    expect(x.decisions.accept(x.decisionSource.sourceId)).toEqual(peer.read(x.decisionSource.sourceId));
  } finally { hook.mockRestore(); x.f.close(); }
});

it('rejects a newer observation committed by a WAL peer before BEGIN without deleting peer evidence', () => {
  const x = fixture(), { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  x.plans.accept(x.planSource.sourceId);
  const source = { ...x.observationSource, sourceId: 'wal-later-observation', previousObservationSourceId: x.observationSource.sourceId };
  x.observationSources.set(source.sourceId, source);
  const exec = DatabaseSync.prototype.exec; let changed = false;
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; x.observations.accept(source.sourceId); }
    return exec.call(this, sql);
  });
  try {
    expect(() => x.decisions.accept(x.decisionSource.sourceId)).toThrow(/prefix changed/); expect(changed).toBe(true);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decisions').get()).toEqual({ n: 0 });
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_field_observations').get()).toEqual({ n: 2 });
    expect(x.observations.read(source.sourceId)?.revision).toBe(2);
  } finally { hook.mockRestore(); x.f.close(); }
});

it('rolls back a new contextual plan and dependency mutations after insertion', () => {
  const x = fixture();
  try {
    const tables = ['actual_field_observations', 'actual_field_observation_heads', 'world_player_person_links'];
    const before = tables.map(t => x.f.db.prepare(`SELECT * FROM ${t}`).all());
    for (const sql of ["UPDATE actual_field_observations SET source_hash='wrong'", 'UPDATE actual_field_observation_heads SET revision=revision+1',
      "UPDATE world_player_person_links SET person_id='wrong'", "UPDATE actual_defensive_plans SET observation_source_id='wrong'"]) {
      x.f.db.exec(`CREATE TRIGGER mutate_plan AFTER INSERT ON actual_defensive_plans BEGIN ${sql}; END`);
      expect(() => x.plans.accept(x.planSource.sourceId)).toThrow();
      expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_plans').get()).toEqual({ n: 0 });
      expect(tables.map(t => x.f.db.prepare(`SELECT * FROM ${t}`).all())).toEqual(before);
      x.f.db.exec('DROP TRIGGER mutate_plan');
    }
  } finally { x.f.close(); }
});

it('rolls back a postinsert hidden history duplicate and restores the original empty decision head', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId);
    x.f.db.exec(`CREATE TRIGGER hide_decision AFTER INSERT ON actual_defensive_decisions BEGIN
      INSERT INTO actual_defensive_decisions SELECT 'hidden-decision',source_version,'foreign-pitch','foreign-player',
      observation_source_id,decision_model_source_id,plan_source_id,previous_source_id,revision,
      json_set(source_json,'$.sourceId','hidden-decision','$.physicalPitchSourceId','foreign-pitch','$.playerId','foreign-player'),source_hash,
      json_set(snapshot_json,'$.source.sourceId','hidden-decision','$.source.physicalPitchSourceId','foreign-pitch','$.source.playerId','foreign-player'),snapshot_hash
      FROM actual_defensive_decisions WHERE source_id=NEW.source_id; END`);
    expect(() => x.decisions.accept(x.decisionSource.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decisions').get()).toEqual({ n: 0 });
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decision_heads').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it('rolls back a hidden observation history dependency introduced after decision insertion', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId);
    const observations = x.f.db.prepare('SELECT * FROM actual_field_observations').all();
    x.f.db.exec(`CREATE TRIGGER hide_observation AFTER INSERT ON actual_defensive_decisions BEGIN
      INSERT INTO actual_field_observations SELECT 'hidden-observation','foreign-pitch','foreign-player',base_field_source_id,
      execution_source_id,observation_model_source_id,previous_source_id,revision,
      json_set(source_json,'$.sourceId','hidden-observation','$.physicalPitchSourceId','foreign-pitch','$.playerId','foreign-player'),source_hash,
      json_set(snapshot_json,'$.source.sourceId','hidden-observation','$.source.physicalPitchSourceId','foreign-pitch','$.source.playerId','foreign-player',
        '$.history[0].sourceId','hidden-observation'),snapshot_hash FROM actual_field_observations; END`);
    expect(() => x.decisions.accept(x.decisionSource.sourceId)).toThrow(/observation.*scope/);
    expect(x.f.db.prepare('SELECT * FROM actual_field_observations').all()).toEqual(observations);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decisions').get()).toEqual({ n: 0 });
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decision_heads').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

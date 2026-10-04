import { expect, it } from 'vitest';
import { actualDefensiveDecisionFixture as fixture } from './ActualDefensiveDecisionFixtures.test-support';

it('rejects a decision duplicate hidden from indexes, Source and snapshot Source but still owning original receipt history', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId); const original = x.decisions.accept(x.decisionSource.sourceId);
    x.f.db.exec(`INSERT INTO actual_defensive_decisions SELECT 'hidden-decision',source_version,'foreign-pitch','foreign-player',
      observation_source_id,decision_model_source_id,plan_source_id,previous_source_id,revision,
      json_set(source_json,'$.sourceId','hidden-decision','$.physicalPitchSourceId','foreign-pitch','$.playerId','foreign-player'),source_hash,
      json_set(snapshot_json,'$.source.sourceId','hidden-decision','$.source.physicalPitchSourceId','foreign-pitch','$.source.playerId','foreign-player'),snapshot_hash
      FROM actual_defensive_decisions`);
    expect(() => x.decisions.read(original.source.sourceId)).toThrow();
  } finally { x.f.close(); }
});

it('rejects hidden plan scope still owned by its pinned original observation metadata', () => {
  const x = fixture();
  try {
    const original = x.plans.accept(x.planSource.sourceId);
    x.f.db.exec(`INSERT INTO actual_defensive_plans SELECT 'hidden-plan',source_version,'foreign-pitch','foreign-career','foreign-player',
      person_link_source_id,fielding_model_source_id,game_day,observation_source_id,
      json_set(source_json,'$.sourceId','hidden-plan','$.physicalPitchSourceId','foreign-pitch','$.playerId','foreign-player'),source_hash,
      json_set(snapshot_json,'$.source.sourceId','hidden-plan','$.source.physicalPitchSourceId','foreign-pitch','$.source.playerId','foreign-player'),snapshot_hash
      FROM actual_defensive_plans`);
    expect(() => x.plans.read(original.source.sourceId)).toThrow(/scope/);
  } finally { x.f.close(); }
});

it('does not consume unrelated opaque future history entries while finding the original scope', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId); const original = x.decisions.accept(x.decisionSource.sourceId);
    x.f.db.exec(`INSERT INTO actual_defensive_decisions SELECT 'unrelated',source_version,'unrelated-pitch','unrelated-player',
      'unrelated-observation',decision_model_source_id,plan_source_id,previous_source_id,revision,
      '{"sourceId":"unrelated","physicalPitchSourceId":"unrelated-pitch","playerId":"unrelated-player"}',source_hash,
      '{"source":{"sourceId":"unrelated","physicalPitchSourceId":"unrelated-pitch","playerId":"unrelated-player"},"history":["opaque future payload"]}',snapshot_hash
      FROM actual_defensive_decisions`);
    expect(x.decisions.read(original.source.sourceId)).toEqual(original);
  } finally { x.f.close(); }
});

it('rejects a hidden original observation-history dependency without changing the older observation owner', () => {
  const x = fixture();
  try {
    x.f.db.exec(`INSERT INTO actual_field_observations SELECT 'hidden-observation','foreign-pitch','foreign-player',base_field_source_id,
      execution_source_id,observation_model_source_id,previous_source_id,revision,
      json_set(source_json,'$.sourceId','hidden-observation','$.physicalPitchSourceId','foreign-pitch','$.playerId','foreign-player'),source_hash,
      json_set(snapshot_json,'$.source.sourceId','hidden-observation','$.source.physicalPitchSourceId','foreign-pitch','$.source.playerId','foreign-player',
        '$.history[0].sourceId','hidden-observation'),snapshot_hash FROM actual_field_observations`);
    expect(() => x.plans.accept(x.planSource.sourceId)).toThrow(/observation.*(scope|identity)/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_plans').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

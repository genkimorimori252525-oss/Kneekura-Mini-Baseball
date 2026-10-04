import { expect, it } from 'vitest';
import { actualDefensiveDecisionFixture as fixture } from './ActualDefensiveDecisionFixtures.test-support';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const literal = (s: string) => `'${s.replaceAll("'", "''")}'`;
const duplicate = (first: object, last: object) => `${JSON.stringify(first).slice(0, -1)},${JSON.stringify(last).slice(1)}`;

it('rolls back a postinsert hidden duplicate-container claim and preserves original archives byte-for-byte', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId);
    const predicted = actualDefensiveDecisionEvidenceFromSqlite(x.f.db).derive(x.decisionSource);
    const foreign = { ...x.decisionSource, sourceId: 'hidden', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player', observationSourceId: 'foreign-observation' };
    const source = duplicate(foreign, x.decisionSource), snapshot = duplicate({ ...predicted, source: foreign, history: [foreign],
      receipt: { self: { playerId: 'foreign-player' }, originObservationSourceId: 'foreign-observation' } }, predicted);
    const tables = ['batted_world_field_actions', 'actual_field_observations', 'actual_field_observation_heads', 'actual_defensive_plans', 'world_player_decision_models'];
    const original = tables.map(t => x.f.db.prepare(`SELECT * FROM ${t}`).all());
    x.f.db.exec(`CREATE TRIGGER hide_metadata AFTER INSERT ON actual_defensive_decisions BEGIN
      INSERT INTO actual_defensive_decisions SELECT 'hidden',source_version,'foreign-pitch','foreign-player','foreign-observation',
      decision_model_source_id,plan_source_id,previous_source_id,revision,${literal(source)},'hidden-source-hash',${literal(snapshot)},'hidden-snapshot-hash'
      FROM actual_defensive_decisions WHERE source_id=NEW.source_id; END`);
    expect(() => x.decisions.accept(x.decisionSource.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decisions').get()).toEqual({ n: 0 });
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decision_heads').get()).toEqual({ n: 0 });
    expect(tables.map(t => x.f.db.prepare(`SELECT * FROM ${t}`).all())).toEqual(original);
    x.f.db.exec('DROP TRIGGER hide_metadata');
    const saved = x.decisions.accept(x.decisionSource.sourceId);
    expect(saved).toEqual(predicted);
    const bytes = x.f.db.prepare('SELECT source_json,snapshot_json FROM actual_defensive_decisions').get()!;
    expect(bytes).toEqual({ source_json: json(saved.source), snapshot_json: json(saved) });
    expect(x.decisions.read(saved.source.sourceId)).toEqual(saved);
    expect(x.decisions.accept(saved.source.sourceId)).toEqual(saved);
    expect(x.f.db.prepare('SELECT source_json,snapshot_json FROM actual_defensive_decisions').get()).toEqual(bytes);
  } finally { x.f.close(); }
});

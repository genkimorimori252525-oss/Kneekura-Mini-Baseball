import { expect, it } from 'vitest';
import { actualDefensiveDecisionFixture as fixture } from './ActualDefensiveDecisionFixtures.test-support';
import { openSqliteActualDefensiveDecisionStore } from './SqliteActualDefensiveDecisionStore';
import { openSqliteActualDefensivePlanStore } from './SqliteActualDefensivePlanStore';

it('imports contextual priorities at owned availability and freezes individual perception-only pending intent', () => {
  const x = fixture();
  try {
    const tables = ['batted_world_field_actions', 'batted_world_field_executions', 'world_player_fielding_models', 'world_player_person_links'];
    const before = tables.map(t => x.f.db.prepare(`SELECT * FROM ${t}`).all());
    const plan = x.plans.accept(x.planSource.sourceId), value = x.decisions.accept(x.decisionSource.sourceId);
    expect(plan.availability).toEqual(x.observation.receipt.at);
    expect(plan.source.provenance).toBe('accepted_at_actual_observation');
    expect(value.receipt.selected.intent).toEqual({ kind: 'ball_handler' });
    expect(value.receipt.target).toEqual({ x: x.observation.receipt.perceived.ball!.estimate.position.x,
      z: x.observation.receipt.perceived.ball!.estimate.position.z });
    expect(value.receipt.self).toMatchObject({ playerId: 'p2', positionConvention: 'identity_only_no_position_consumed' });
    expect(value.receipt.availability).toEqual(x.observation.receipt.at);
    expect(value.receipt.scheduling.decisionTick).toBeGreaterThan(value.receipt.scheduling.startedAtTick);
    expect(value.receipt.scheduling.movementStartTick).toBeGreaterThan(value.receipt.scheduling.decisionTick);
    expect(value.receipt.lifecycle.status).toBe('pending_decision');
    expect(value.receipt.lifecycle.issuedAt).toBeNull();
    expect(x.decisions.accept(value.source.sourceId)).toEqual(value);
    expect(x.f.track(openSqliteActualDefensiveDecisionStore(x.f.path)).accept(value.source.sourceId)).toEqual(value);
    expect(x.f.track(openSqliteActualDefensivePlanStore(x.f.path)).accept(plan.source.sourceId)).toEqual(plan);
    expect(tables.map(t => x.f.db.prepare(`SELECT * FROM ${t}`).all())).toEqual(before);
  } finally { x.f.close(); }
});

it('rejects caller outcome, clock, self, hidden context and wrong scope before writing', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId);
    for (const key of ['at', 'outcome', 'target', 'confidence', 'self', 'knownContext', 'decisionTick']) {
      x.decisionSources.set(x.decisionSource.sourceId, { ...x.decisionSource, [key]: 0 });
      expect(() => x.decisions.accept(x.decisionSource.sourceId)).toThrow();
    }
    for (const key of ['playerId', 'physicalPitchSourceId', 'observationSourceId', 'decisionModelSourceId', 'planSourceId', 'previousDecisionSourceId']) {
      x.decisionSources.set(x.decisionSource.sourceId, { ...x.decisionSource, [key]: 'foreign' });
      expect(() => x.decisions.accept(x.decisionSource.sourceId)).toThrow();
    }
    let getterCalled = false;
    x.decisionSources.set(x.decisionSource.sourceId, Object.defineProperty({ ...x.decisionSource }, 'observationSourceId', {
      enumerable: true, get() { getterCalled = true; return x.observationSource.sourceId; },
    }));
    expect(() => x.decisions.accept(x.decisionSource.sourceId)).toThrow(/accessors/); expect(getterCalled).toBe(false);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_decisions').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});

it('preserves original pending choice and deadlines across genuinely later observation, then issues once', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId); const first = x.decisions.accept(x.decisionSource.sourceId);
    const sameObs = { ...x.observationSource, sourceId: 'same-time-observation', previousObservationSourceId: x.observationSource.sourceId };
    x.observationSources.set(sameObs.sourceId, sameObs); x.observations.accept(sameObs.sourceId);
    const sameDecision = { ...x.decisionSource, sourceId: 'same-time-decision', observationSourceId: sameObs.sourceId, previousDecisionSourceId: first.source.sourceId };
    x.decisionSources.set(sameDecision.sourceId, sameDecision);
    expect(() => x.decisions.accept(sameDecision.sourceId)).toThrow(/later/);
    let previousObservation = sameObs.sourceId, previousExecution: string | null = null;
    const advance = (name: string, tick: number, previousDecision: string) => {
      const previousTick = previousExecution === null ? x.baseField.field.motion.world.moment.ball.tick
        : x.executions.read(previousExecution)!.execution.field.motion.world.moment.ball.tick;
      const execution = { ...x.source, sourceId: `execution-${name}`, previousExecutionSourceId: previousExecution,
        action: { kind: 'motion' as const, availableAtTick: previousTick, throughTick: tick, commands: x.fieldSource.commands } };
      x.sources.set(execution.sourceId, execution); x.executions.accept(execution.sourceId); previousExecution = execution.sourceId;
      const obs = { ...x.observationSource, sourceId: `observation-${name}`, previousObservationSourceId: previousObservation, executionSourceId: execution.sourceId };
      x.observationSources.set(obs.sourceId, obs); x.observations.accept(obs.sourceId); previousObservation = obs.sourceId;
      const source = { ...x.decisionSource, sourceId: `decision-${name}`, previousDecisionSourceId: previousDecision, observationSourceId: obs.sourceId };
      x.decisionSources.set(source.sourceId, source); return source;
    };
    const midSource = advance('recognized', first.receipt.scheduling.decisionTick, first.source.sourceId);
    const mid = x.decisions.accept(midSource.sourceId);
    expect(mid.receipt.lifecycle.status).toBe('pending_first_step');
    expect(mid.receipt.selected).toEqual(first.receipt.selected);
    expect(mid.receipt.scheduling).toEqual(first.receipt.scheduling);
    expect(mid.receipt.target).toEqual(first.receipt.target);
    const lastSource = advance('eligible', first.receipt.scheduling.movementStartTick, mid.source.sourceId);
    const issued = x.decisions.accept(lastSource.sourceId);
    expect(issued.receipt.lifecycle.status).toBe('issued');
    expect(issued.receipt.lifecycle.issuedBySourceId).toBe(lastSource.sourceId);
    expect(issued.receipt.availability).toEqual(first.receipt.availability);
    expect(x.decisions.accept(first.source.sourceId)).toEqual(first);
    expect(x.decisions.read(mid.source.sourceId)).toEqual(mid);
    expect(x.decisions.accept(lastSource.sourceId)).toEqual(issued);
    const repeat = advance('repeat', first.receipt.scheduling.movementStartTick + 1, issued.source.sourceId);
    expect(() => x.decisions.accept(repeat.sourceId)).toThrow(/repeated issuance/);
    for (const [column, path] of [['source_json', '$.sourceId'], ['snapshot_json', '$.history[0].playerId']] as const) {
      const original = x.f.db.prepare(`SELECT ${column} AS v FROM actual_defensive_decisions WHERE source_id=?`).get(lastSource.sourceId)!.v;
      x.f.db.prepare(`UPDATE actual_defensive_decisions SET ${column}=json_set(${column},?,'foreign') WHERE source_id=?`).run(path, lastSource.sourceId);
      expect(() => x.decisions.read(first.source.sourceId)).toThrow(/metadata/);
      x.f.db.prepare(`UPDATE actual_defensive_decisions SET ${column}=? WHERE source_id=?`).run(original, lastSource.sourceId);
    }
    x.f.db.prepare("UPDATE actual_defensive_decisions SET source_json='future-payload-not-parsed',snapshot_json='future-payload-not-parsed' WHERE source_id=?").run(lastSource.sourceId);
    expect(x.decisions.read(first.source.sourceId)).toEqual(first);
    x.f.db.prepare("UPDATE actual_defensive_decisions SET observation_source_id='missing' WHERE source_id=?").run(lastSource.sourceId);
    expect(() => x.decisions.read(first.source.sourceId)).toThrow(/metadata/);
  } finally { x.f.close(); }
});

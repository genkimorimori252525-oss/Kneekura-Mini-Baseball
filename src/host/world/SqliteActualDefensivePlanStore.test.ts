import { expect, it } from 'vitest';
import { actualDefensiveDecisionFixture as fixture } from './ActualDefensiveDecisionFixtures.test-support';
import type { AcceptedActualDefensivePlan } from './SqliteActualDefensivePlanStore';

it('rejects unowned provenance, hidden context, extra and aliased fields, invalid priorities and wrong original scope', () => {
  const x = fixture();
  try {
    let getterCalled = false;
    const rejects = [
      ...['physicalPitchSourceId', 'careerId', 'playerId', 'personLinkSourceId', 'fieldingModelSourceId', 'observationSourceId'].map(k => ({ ...x.planSource, [k]: 'wrong' })),
      { ...x.planSource, gameDay: x.planSource.gameDay + 1 }, { ...x.planSource, provenance: 'executed_pre_play' },
      ...['at', 'outs', 'occupiedBases', 'teammateIntent', 'availableAtTick'].map(k => ({ ...x.planSource, [k]: 0 })),
      { ...x.planSource, priorities: { ...x.planSource.priorities, holdPriority: NaN } },
      { ...x.planSource, priorities: { ...x.planSource.priorities, holdPriority: 1.01 } },
      { ...x.planSource, priorities: { ...x.planSource.priorities, 'a|b': 0 } },
      { ...x.planSource, priorities: { ...x.planSource.priorities, baseCoverPriorities: [{ base: 0, priority: 1 }] } },
      { ...x.planSource, priorities: { ...x.planSource.priorities, baseCoverPriorities: [{ base: 1, priority: 1 }, { base: 1, priority: 0 }] } },
      Object.defineProperty({ ...x.planSource }, 'priorities', { get() { getterCalled = true; return x.planSource.priorities; }, enumerable: true }),
    ];
    for (const source of rejects) {
      x.planSources.set(x.planSource.sourceId, source as AcceptedActualDefensivePlan);
      expect(() => x.plans.accept(x.planSource.sourceId)).toThrow();
    }
    expect(getterCalled).toBe(false);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_defensive_plans').get()).toEqual({ n: 0 });
    x.planSources.set(x.planSource.sourceId, x.planSource); const original = x.plans.accept(x.planSource.sourceId);
    x.planSources.set(x.planSource.sourceId, { ...x.planSource, priorities: { ...x.planSource.priorities, holdPriority: 1 } });
    expect(() => x.plans.accept(x.planSource.sourceId)).toThrow(/frozen/);
    const duplicate = { ...x.planSource, sourceId: 'duplicate-plan' }; x.planSources.set(duplicate.sourceId, duplicate);
    expect(() => x.plans.accept(duplicate.sourceId)).toThrow(/baseline/);
    expect(x.plans.read(original.source.sourceId)).toEqual(original);
  } finally { x.f.close(); }
});

it('requires current actual availability for a new import and rejects corrupted identity mirrors', () => {
  const x = fixture();
  try {
    const later = { ...x.observationSource, sourceId: 'new-observation', previousObservationSourceId: x.observationSource.sourceId };
    x.observationSources.set(later.sourceId, later); x.observations.accept(later.sourceId);
    expect(() => x.plans.accept(x.planSource.sourceId)).toThrow(/prefix changed/);
    const source = { ...x.planSource, observationSourceId: later.sourceId }; x.planSources.set(source.sourceId, source);
    const saved = x.plans.accept(source.sourceId);
    for (const column of ['source_version', 'physical_pitch_source_id', 'career_id', 'player_id', 'person_link_source_id', 'fielding_model_source_id', 'observation_source_id', 'source_hash', 'snapshot_hash']) {
      const original = x.f.db.prepare(`SELECT ${column} AS v FROM actual_defensive_plans`).get()!.v;
      x.f.db.prepare(`UPDATE actual_defensive_plans SET ${column}='corrupt'`).run();
      expect(() => x.plans.read(source.sourceId), column).toThrow();
      x.f.db.prepare(`UPDATE actual_defensive_plans SET ${column}=?`).run(original);
    }
    expect(x.plans.read(source.sourceId)).toEqual(saved);
  } finally { x.f.close(); }
});

import { originalSettledFoulRuntimeFixture } from './ActualSettledFoulStopFixtures.test-support';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { battedVenueFoulCountEvidenceFromSqlite } from './BattedVenueFoulCountEvidenceFromSqlite';
import { openSqliteActualSettledFoulStopProducerStore } from './SqliteActualSettledFoulStopProducerStore';
import type { AcceptedActualSettledFoulStopProduction } from './ActualSettledFoulStopProducer';
import type { AcceptedActualFoulRuleConsumption, AcceptedOriginalFoulRuleRuntime, ActualFoulRuleConsumerQuery } from './ActualFoulRuleConsumption';
import { openSqliteActualFoulRuleConsumptionStore } from './SqliteActualFoulRuleConsumptionStore';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

export type FoulRuleScenario = 'ordinary_0' | 'ordinary_2' | 'bunt_2' | 'legacy_2';
export const originalFoulRuleFixture = (path: string, scenario: FoulRuleScenario, producerOnly = false) => {
  const twoStrikes = scenario !== 'ordinary_0', attempt = scenario === 'legacy_2' ? undefined : scenario === 'bunt_2' ? 'bunt' : 'ordinary_swing';
  const x = originalSettledFoulRuntimeFixture(path, {
    pitchPhysics: { velocity: { x: twoStrikes ? 3 : 1, y: 0, z: -30 } },
    originalContact: { precedingTakenPitches: twoStrikes ? 2 : 0, ...(attempt ? { attempt } : {}) },
  });
  try {
    // The future policy is deliberately outside the current runtime parser's
    // accepted union. The first gate must expose that real capability rejection.
    const candidate: AcceptedOriginalFoulRuleRuntime = { sourceId: 'foul-count-runtime', sourceVersion: 'explicit-test-v1',
      capability: 'causal_original_settled_foul_count_runtime_v1', physicalPitchSourceId: x.physical.source.sourceId };
    const runtimeSource = producerOnly ? { ...candidate, capability: 'causal_original_settled_foul_runtime_v1' as const } : candidate;
    x.runtimeSources.set(runtimeSource.sourceId, runtimeSource as never);
    const runtime = x.runtimes.accept(runtimeSource.sourceId), foul = x.advanceToFoul(), policy = x.acceptPolicy(foul.first);
    const productionSource: AcceptedActualSettledFoulStopProduction = { sourceId: 'foul-count-stop', sourceVersion: 'explicit-test-v1',
      capability: 'actual_original_settled_foul_stop_producer_v1', physicalPitchSourceId: x.physical.source.sourceId,
      runtimeSourceId: runtime.source.sourceId, policySourceId: policy.policy.source.sourceId,
      baseFieldSourceId: foul.last.source.sourceId, executionSourceId: null };
    const producer = x.f.track(openSqliteActualSettledFoulStopProducerStore(path, {
      readAcceptedProduction: id => id === productionSource.sourceId ? productionSource : null,
    }));
    const production = producer.accept(productionSource.sourceId);
    const countEvidence = battedVenueFoulCountEvidenceFromSqlite(x.f.db).read({ version: 'batted_venue_foul_count_observation_v1',
      policySourceId: productionSource.policySourceId, baseFieldSourceId: productionSource.baseFieldSourceId, executionSourceId: null });
    const prefix = readOriginalPhysicalPitchPrefixFromSqlite(x.f.db, x.physical.source.sourceId), timeline = x.physical.result.pitch.resolution.timeline;
    if (timeline.status.kind !== 'batted_ball_pending' || timeline.status.count.strikes !== (twoStrikes ? 2 : 0)
      || countEvidence.basis.evidence.interpretation.kind !== 'dead_ball') throw new Error('foul consumption fixture lacks its real original count and stop');
    const source: AcceptedActualFoulRuleConsumption = { sourceId: 'foul-rule-consumption', sourceVersion: 'explicit-test-v1',
      capability: 'actual_original_settled_foul_rule_consumption_v1', runtimeSourceId: runtime.source.sourceId, stopProductionSourceId: production.source.sourceId };
    const sources = new Map([[source.sourceId, source]]), store = x.f.track(openSqliteActualFoulRuleConsumptionStore(path, {
      readAcceptedConsumption: id => sources.get(id) ?? null,
    }));
    const query: ActualFoulRuleConsumerQuery = { version: 'actual_foul_rule_consumers_v1', runtimeSourceId: runtime.source.sourceId,
      cut: { kind: 'field_execution', baseFieldSourceId: foul.last.source.sourceId, executionSourceId: null } };
    return { ...x, foul, policy, runtimeSource, runtime, production, productionSource, producer, prefix,
      countEvidence, source, sources, store, query, scenario };
  } catch (error) { x.f.close(); throw error; }
};

/** Real later motion through the existing owner, using the already accepted
 * commands. The one-tick query horizon is a test cut, not a reset or rule value. */
export const advanceOriginalFoulFieldExecution = (f: ReturnType<typeof originalFoulRuleFixture>) => {
  const original = f.foul.last.source, moment = f.foul.last.field.motion.world.moment;
  if (!('commands' in original) || !('availableAtTick' in original)) throw new Error('foul fixture lacks its original motion command Source');
  const source: AcceptedBattedWorldFieldExecution = { sourceId: 'later-real-foul-execution', sourceVersion: 'explicit-test-v1',
    baseFieldSourceId: f.foul.last.source.sourceId, previousExecutionSourceId: null,
    action: { kind: 'motion', availableAtTick: original.availableAtTick, throughTick: moment.ball.tick + 1, commands: original.commands } };
  const executions = f.f.track(openSqliteBattedWorldFieldExecutionStore(f.f.path, f.fields, {
    readAcceptedExecution: id => id === source.sourceId ? source : null,
  }));
  const value = executions.accept(source.sourceId);
  if (value.execution.kind !== 'motion' || value.execution.field.motion.world.moment.elapsedSeconds <= moment.elapsedSeconds
    || value.execution.field.motion.world.moment.ball.tick <= moment.ball.tick) throw new Error('foul fixture did not admit genuine later physical work');
  return { source, value, executions };
};

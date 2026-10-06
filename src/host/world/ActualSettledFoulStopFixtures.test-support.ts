import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { deriveBallWorldFieldTerritory } from '../../core/rules/BallWorldFieldTerritory';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { battedWorldFieldEvidenceFromSqlite, type DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { nativeSettledFoulInputArchiveBytes } from './NativeSettledFoulPhysicalFixtures.test-support';
import { openSqliteActualLivePlayRuntimeStore } from './SqliteActualLivePlayRuntimeStore';
import type { AcceptedActualLivePlayRuntime } from './ActualLivePlayRuntime';
import type { AcceptedOriginalSettledFoulRuntime } from './ActualSettledFoulStopProducer';
import { openSqliteBattedVenueLegalPolicyStore, type AcceptedBattedVenueLegalPolicy } from './SqliteBattedVenueLegalPolicyStore';

/** Original zero-horizon roots only. Runtime registration happens explicitly in the test. */
export const originalSettledFoulRuntimeFixture = (path: string,
  original?: Pick<NonNullable<Parameters<typeof battedWorldFieldFixture>[4]>, 'pitchPhysics' | 'originalContact'>) => {
  const x = battedWorldFieldFixture(path, true, false, undefined, {
    originalProfile: { ruleProfileId: NPB_2026_RULE_PROFILE.id },
    pitchPhysics: original?.pitchPhysics ?? { velocity: { x: 1, y: 0, z: -30 } }, originalContact: original?.originalContact,
  });
  try {
  const pitch = x.physical, runtimeSources = new Map<string, AcceptedActualLivePlayRuntime | AcceptedOriginalSettledFoulRuntime>();
  const runtimes = x.f.track(openSqliteActualLivePlayRuntimeStore(path, {
    readAcceptedRuntime: id => (runtimeSources.get(id) ?? null) as never,
  }));
  const source = (capability: AcceptedActualLivePlayRuntime['capability'] | AcceptedOriginalSettledFoulRuntime['capability']) => ({
    sourceId: 'foul-runtime', sourceVersion: 'explicit-test-v1', capability, physicalPitchSourceId: pitch.source.sourceId,
  });
  const register = (capability: AcceptedActualLivePlayRuntime['capability'] | AcceptedOriginalSettledFoulRuntime['capability']) => {
    const accepted = source(capability); runtimeSources.set(accepted.sourceId, accepted); return runtimes.accept(accepted.sourceId);
  };
  const inputArchiveBytes = () => nativeSettledFoulInputArchiveBytes(x.f.db);
  const beforePhysicalBytes = inputArchiveBytes(), originalMatchBytes = JSON.stringify(x.f.official.getMatch('game-1'));
  const advanceToFoul = () => {
    const fields: DurableBattedWorldFieldAction[] = [x.fields.accept(x.source.sourceId)];
    const first = fields[0], horizonTick = first.field.motion.world.moment.ball.tick + 100_000_000;
    for (let step = 0; step < 32; step++) {
      const previous = fields.at(-1)!, world = previous.field.motion.world;
      if (world.kind === 'boundary' && world.contacts.length === 1 && world.contacts[0].kind === 'rolling_stop') break;
      if (world.kind !== 'boundary' || world.contacts.length !== 1 || world.contacts[0].kind !== 'ground') {
        throw new Error('registered original fixture encountered unsupported contact before its actual stop');
      }
      const next = { ...x.source, sourceId: `registered-foul-field-${step + 2}`,
        previousFieldSourceId: previous.source.sourceId, throughTick: horizonTick };
      x.sources.set(next.sourceId, next); fields.push(x.fields.accept(next.sourceId));
    }
    const last = fields.at(-1)!, reader = battedWorldFieldEvidenceFromSqlite(x.f.db);
    const accepted = reader.read(last.source.sourceId)!;
    const prefix = { baseField: accepted, fields: reader.scope(accepted, accepted.source.sourceId), executions: [] };
    const physical = battedWorldFieldPhysicalPrefix(prefix), territory = deriveBallWorldFieldTerritory(physical.field);
    if (territory.kind !== 'resolved' || territory.territory !== 'foul' || territory.basis !== 'settling'
      || last.field.motion.world.kind !== 'boundary' || last.field.motion.world.contacts.length !== 1
      || last.field.motion.world.contacts[0].kind !== 'rolling_stop') throw new Error('registered original fixture did not derive the actual foul stop');
    if (inputArchiveBytes() !== beforePhysicalBytes) throw new Error('registered original fixture changed accepted input bytes');
    return { first, last: accepted, prefix, physical, fields };
  };
  const acceptPolicy = (first: DurableBattedWorldFieldAction) => {
    const world = first.response.touch.worldContact;
    const policySource: AcceptedBattedVenueLegalPolicy = { sourceId: 'registered-foul-policy', sourceVersion: 'explicit-test-v1', version: 'batted_venue_legal_policy_v1',
      gameId: world.model.gameId, careerId: world.model.careerId, fixtureEventId: world.model.fixtureEventId, venueId: world.model.venueId,
      availableAtDay: world.model.availableAtDay, baseFieldSourceId: first.source.sourceId, worldModelSourceId: world.model.sourceId,
      responseModelSourceId: first.response.model.sourceId, fieldGeometrySourceId: first.geometry.source.sourceId,
      baseGeometrySourceId: first.geometry.baseGeometry.source.sourceId,
      rulePolicy: { version: 'untouched_settled_foul_dead_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id, rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision } };
    const policies = x.f.track(openSqliteBattedVenueLegalPolicyStore(path, { readAcceptedPolicy: id => id === policySource.sourceId ? policySource : null }));
    return { policySource, policies, policy: policies.accept(policySource.sourceId) };
  };
  return { ...x, runtimeSources, runtimes, runtimeSource: source, register, advanceToFoul, acceptPolicy,
    inputArchiveBytes, beforePhysicalBytes, originalMatchBytes };
  } catch (error) { x.f.close(); throw error; }
};

import type { AcceptedActualSettledFoulStopProduction, ActualSettledFoulStopCensusQuery } from './ActualSettledFoulStopProducer';
import { openSqliteActualSettledFoulStopProducerStore } from './SqliteActualSettledFoulStopProducerStore';
export const actualSettledFoulStopProducerFixture = (path: string, legacy = false) => {
  const x = originalSettledFoulRuntimeFixture(path);
  try {
    const runtime = x.register(legacy ? 'causal_original_live_play_runtime_v1' : 'causal_original_settled_foul_runtime_v1');
    const foul = x.advanceToFoul(), policy = x.acceptPolicy(foul.first);
    const production: AcceptedActualSettledFoulStopProduction = { sourceId: 'foul-production', sourceVersion: 'explicit-test-v1',
      capability: 'actual_original_settled_foul_stop_producer_v1', physicalPitchSourceId: x.physical.source.sourceId,
      runtimeSourceId: runtime.source.sourceId, policySourceId: policy.policySource.sourceId,
      baseFieldSourceId: foul.last.source.sourceId, executionSourceId: null };
    const productions = new Map<string, AcceptedActualSettledFoulStopProduction>([[production.sourceId, production]]);
    const store = x.f.track(openSqliteActualSettledFoulStopProducerStore(path, {
      readAcceptedProduction: id => productions.get(id) ?? null,
    }));
    const query: ActualSettledFoulStopCensusQuery = { version: 'actual_settled_foul_stop_census_v1',
      runtimeSourceId: runtime.source.sourceId, cut: { kind: 'field_execution', baseFieldSourceId: foul.last.source.sourceId, executionSourceId: null } };
    return { ...x, ...foul, ...policy, originalPhysicalPitch: x.physical, runtime, production, productions, store, query };
  } catch (error) { x.f.close(); throw error; }
};

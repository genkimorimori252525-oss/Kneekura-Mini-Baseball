import { expect } from 'vitest';
import { existsSync } from 'node:fs';
import { playerFieldingModelFixture } from './PlayerFieldingModelFixtures.test-support';
// Explicit synthetic priorities copied from Core's contract fixture, not runtime defaults.
// src/core/sim/fielding/ReceivedUmpireDefenderReplan.contract.test-support.ts
// SHA-256 7e1ad727c1dbfaadfb143a37989aa8a161d767cba52672ce434e0af0692a4eb4
export const receivedPolicySource = (model: ReturnType<typeof playerFieldingModelFixture>) => ({
  sourceId: 'policy-a', sourceVersion: 'synthetic-core-contract-v1',
  capability: 'received_umpire_defender_policy_data_v1' as const, provenance: 'explicit_imported_policy_data_v1' as const,
  careerId: 'career-a', playerId: 'player-a', personLinkSourceId: model.person.sourceId,
  fieldingModelSourceId: model.source.sourceId, acceptedAtDay: 11,
  profiles: { out: { ballPursuitPriority: 0.1, holdPriority: 0.9 }, safe: { ballPursuitPriority: 0.9, holdPriority: 0.1 } },
});

export const policyFixture = async () => {
  const path = './SqliteReceivedUmpireDefenderPolicyDataStore';
  expect(existsSync(new URL(path + '.ts', import.meta.url)), 'RECEIVED_POLICY_DATA_OWNER_MISSING').toBe(true);
  const { openSqliteReceivedUmpireDefenderPolicyDataStore: open } = await import(path) as typeof import('./SqliteReceivedUmpireDefenderPolicyDataStore');
  const f = playerFieldingModelFixture(), fieldingModel = f.models.accept(f.source.sourceId), source = receivedPolicySource(f);
  const sources = new Map<string, unknown>([[source.sourceId, source]]);
  const authority = { readAcceptedPolicyData: (id: string) => (sources.get(id) ?? null) as import('./SqliteReceivedUmpireDefenderPolicyDataStore').AcceptedReceivedUmpireDefenderPolicyData | null };
  const store = f.track(open(f.path, authority));
  const rows = () => f.db.prepare('SELECT * FROM world_received_umpire_defender_policy_data ORDER BY source_id').all();
  return { ...f, source, fieldingModel, sources, authority, store, open, rows };
};

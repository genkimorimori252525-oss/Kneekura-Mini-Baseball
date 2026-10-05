import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { deriveBallWorldFieldTerritory } from '../../core/rules/BallWorldFieldTerritory';
import { nativeSettledFoulPhysicalFixture } from './NativeSettledFoulPhysicalFixtures.test-support';
import { openSqliteBattedVenueLegalPolicyStore, type AcceptedBattedVenueLegalPolicy } from './SqliteBattedVenueLegalPolicyStore';
import type { BattedVenueFoulCountObservation } from './BattedVenueFoulCountEvidenceFromSqlite';

export type FoulCountScenario = 'ordinary_0' | 'ordinary_2' | 'bunt_2' | 'legacy_2';
export const battedVenueFoulCountFixture = (path: string, scenario: FoulCountScenario) => {
  const twoStrikes = scenario !== 'ordinary_0';
  const attempt = scenario === 'legacy_2' ? undefined : scenario === 'bunt_2' ? 'bunt' : 'ordinary_swing';
  const x = nativeSettledFoulPhysicalFixture(path, { pitchPhysics: { velocity: { x: twoStrikes ? 3 : 1, y: 0, z: -30 } },
    originalContact: { ...(attempt ? { attempt } : {}), precedingTakenPitches: twoStrikes ? 2 : 0 } });
  try {
    const territory = deriveBallWorldFieldTerritory(x.physical.field);
    if (territory.kind !== 'resolved' || territory.territory !== 'foul' || territory.basis !== 'settling') {
      throw new Error('count fixture requires an actually derived original foul stop');
    }
    const pitch = x.last.response.touch.worldContact.flight.physicalPitch, status = pitch.result.pitch.resolution.timeline.status;
    if (status.kind !== 'batted_ball_pending' || status.count.strikes !== (twoStrikes ? 2 : 0)) {
      throw new Error('count fixture original physical count differs');
    }
    const world = x.first.response.touch.worldContact;
    const policySource: AcceptedBattedVenueLegalPolicy = { sourceId: 'declared-foul-policy', sourceVersion: 'explicit-test-v1', version: 'batted_venue_legal_policy_v1',
      gameId: world.model.gameId, careerId: world.model.careerId, fixtureEventId: world.model.fixtureEventId, venueId: world.model.venueId,
      availableAtDay: world.model.availableAtDay, baseFieldSourceId: x.first.source.sourceId, worldModelSourceId: world.model.sourceId,
      responseModelSourceId: x.first.response.model.sourceId, fieldGeometrySourceId: x.first.geometry.source.sourceId,
      baseGeometrySourceId: x.first.geometry.baseGeometry.source.sourceId,
      rulePolicy: { version: 'untouched_settled_foul_dead_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id, rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision } };
    const policies = x.f.track(openSqliteBattedVenueLegalPolicyStore(x.f.path, { readAcceptedPolicy: id => id === policySource.sourceId ? policySource : null }));
    const policy = policies.accept(policySource.sourceId);
    const query: BattedVenueFoulCountObservation = { version: 'batted_venue_foul_count_observation_v1', policySourceId: policySource.sourceId,
      baseFieldSourceId: x.last.source.sourceId, executionSourceId: null };
    return { ...x, policySource, policy, query, scenario };
  } catch (error) { x.f.close(); throw error; }
};

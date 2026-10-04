import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { openSqlitePlayerDecisionModelStore } from './SqlitePlayerDecisionModelStore';
import { openSqliteActualDefensivePlanStore, type AcceptedActualDefensivePlan } from './SqliteActualDefensivePlanStore';
import { openSqliteActualDefensiveDecisionStore, type AcceptedActualDefensiveDecision } from './SqliteActualDefensiveDecisionStore';

export const actualDefensiveDecisionFixture = (path?: string, options?: Readonly<{
  kind?: 'free' | 'candidate'; captureTiming?: Parameters<typeof battedWorldFieldExecutionFixture>[3]; calibration?: ReturnType<typeof playerDecisionCalibrationFixture>;
  observation?: Parameters<typeof installSyntheticObservation>[4]; fielding?: Parameters<typeof installSyntheticObservation>[5];
}>) => {
  const x = battedWorldFieldExecutionFixture(path, options?.kind, undefined, options?.captureTiming);
  const obs = installSyntheticObservation(x, 'p2', null, undefined, options?.observation, options?.fielding), observation = obs.observations.accept(obs.observationSource.sourceId);
  const fielding = obs.observationModel.fieldingModel, actor = x.baseField.response.touch.worldContact.modelActorEvidence.find(a => a.binding.playerId === 'p2')!;
  const modelSource = { sourceId: 'decision-model', sourceVersion: 'synthetic-v1', careerId: actor.binding.careerId,
    playerId: 'p2', personLinkSourceId: actor.binding.personLinkSourceId, fieldingModelSourceId: fielding.source.sourceId,
    acceptedAtDay: actor.binding.gameDay, calibration: options?.calibration ?? playerDecisionCalibrationFixture() };
  const decisionModel = x.f.track(openSqlitePlayerDecisionModelStore(x.f.path, { readAcceptedModel: () => modelSource })).accept(modelSource.sourceId);
  const planSource: AcceptedActualDefensivePlan = { sourceId: 'actual-plan', sourceVersion: 'synthetic-priorities-v1',
    provenance: 'accepted_at_actual_observation', physicalPitchSourceId: observation.source.physicalPitchSourceId,
    careerId: actor.binding.careerId, playerId: 'p2', personLinkSourceId: actor.binding.personLinkSourceId,
    gameDay: actor.binding.gameDay, fieldingModelSourceId: fielding.source.sourceId, observationSourceId: observation.source.sourceId,
    priorities: { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 } };
  const planSources = new Map([[planSource.sourceId, planSource]]), planAuthority = { readAcceptedPlan: (id: string) => planSources.get(id) ?? null };
  const plans = x.f.track(openSqliteActualDefensivePlanStore(x.f.path, planAuthority));
  const source: AcceptedActualDefensiveDecision = { sourceId: 'actual-decision-1', sourceVersion: 'synthetic-v1',
    physicalPitchSourceId: observation.source.physicalPitchSourceId, playerId: 'p2', observationSourceId: observation.source.sourceId,
    decisionModelSourceId: decisionModel.source.sourceId, planSourceId: planSource.sourceId, previousDecisionSourceId: null };
  const decisionSources = new Map([[source.sourceId, source]]), decisionAuthority = { readAcceptedDecision: (id: string) => decisionSources.get(id) ?? null };
  const decisions = x.f.track(openSqliteActualDefensiveDecisionStore(x.f.path, decisionAuthority));
  return { ...x, ...obs, observation, decisionModel, modelSource, planSource, planSources, planAuthority, plans,
    decisionSource: source, decisionSources, decisionAuthority, decisions };
};

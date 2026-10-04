import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { openSqlitePlayerDecisionModelStore } from './SqlitePlayerDecisionModelStore';
import { openSqliteActualDefensivePlanStore } from './SqliteActualDefensivePlanStore';
import { openSqliteActualDefensiveDecisionStore, type AcceptedActualDefensiveDecision } from './SqliteActualDefensiveDecisionStore';
import { openSqlitePlayerLocomotionModelStore } from './SqlitePlayerLocomotionModelStore';
import { openSqliteActualLocomotionStore, type AcceptedActualLocomotion } from './SqliteActualLocomotionStore';
import type { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { ownedScheduledMotionPhase } from './OwnedScheduledMotionTiming.test-support';

type Fixture = Pick<ReturnType<typeof ownedScheduledMotionFixture>, 'f' | 'baseField'>;
/** Synthetic source-owned timing/coverage. Every observation, decision and motor is
 * still admitted by its real Native owner; this never supplies an acceleration. */
export const installOwnedScheduledDecision = (x: Fixture, playerId: string, executionSourceId: string,
  delayTicks = 0, coverageTicks = 1_000_000) => {
  const phase = <T>(name: string, run: () => T) => ownedScheduledMotionPhase(`${playerId}:${name}`, run);
  const observer = phase('install-observation', () => installSyntheticObservation(x, playerId, executionSourceId));
  const observation = phase('accept-observation', () => observer.observations.accept(observer.observationSource.sourceId));
  const fielding = observer.observationModel.fieldingModel, b = x.baseField.response.touch.worldContact
    .modelActorEvidence.find(a => a.binding.playerId === playerId)!.binding;
  const calibration = { ...playerDecisionCalibrationFixture(),
    decisionTimingParameters: { minimumDecisionDelayTicks: delayTicks, maximumDecisionDelayTicks: delayTicks, fixedProcessingOffsetTicks: 0 },
    firstStepTimingParameters: { minimumFirstStepDelayTicks: 0, maximumFirstStepDelayTicks: 0, fixedMotorOffsetTicks: 0 } };
  const decisionModelSource = { sourceId: `scheduled-decision-model-${playerId}`, sourceVersion: 'synthetic-v1', careerId: b.careerId,
    playerId, personLinkSourceId: b.personLinkSourceId, fieldingModelSourceId: fielding.source.sourceId, acceptedAtDay: b.gameDay, calibration };
  phase('accept-decision-model', () => x.f.track(openSqlitePlayerDecisionModelStore(x.f.path, { readAcceptedModel: () => decisionModelSource })).accept(decisionModelSource.sourceId));
  const planSource = { sourceId: `scheduled-priorities-${playerId}`, sourceVersion: 'synthetic-v1', provenance: 'accepted_at_actual_observation' as const,
    physicalPitchSourceId: observation.source.physicalPitchSourceId, careerId: b.careerId, playerId, personLinkSourceId: b.personLinkSourceId,
    gameDay: b.gameDay, fieldingModelSourceId: fielding.source.sourceId, observationSourceId: observation.source.sourceId,
    priorities: { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 } };
  phase('accept-defensive-plan', () => x.f.track(openSqliteActualDefensivePlanStore(x.f.path, { readAcceptedPlan: () => planSource })).accept(planSource.sourceId));
  const decisionSource: AcceptedActualDefensiveDecision = { sourceId: `scheduled-decision-${playerId}`, sourceVersion: 'synthetic-v1', physicalPitchSourceId: observation.source.physicalPitchSourceId,
    playerId, observationSourceId: observation.source.sourceId, decisionModelSourceId: decisionModelSource.sourceId,
    planSourceId: planSource.sourceId, previousDecisionSourceId: null };
  const decisionSources = new Map([[decisionSource.sourceId, decisionSource]]);
  const decisions = x.f.track(openSqliteActualDefensiveDecisionStore(x.f.path, { readAcceptedDecision: id => decisionSources.get(id) ?? null }));
  let decision = phase('accept-decision', () => decisions.accept(decisionSource.sourceId)), observationId = observation.source.sourceId;
  const revise = (executionSourceId: string, suffix: string) => {
    const source = { ...observer.observationSource, sourceId: `scheduled-observation-${playerId}-${suffix}`,
      previousObservationSourceId: observationId, executionSourceId };
    observer.observationSources.set(source.sourceId, source); phase(`revise-observation:${suffix}`, () => observer.observations.accept(source.sourceId)); observationId = source.sourceId;
    const next = { ...decisionSource, sourceId: `scheduled-decision-${playerId}-${suffix}`, observationSourceId: source.sourceId,
      previousDecisionSourceId: decision.source.sourceId };
    decisionSources.set(next.sourceId, next); decision = phase(`revise-decision:${suffix}`, () => decisions.accept(next.sourceId)); return decision;
  };
  const modelSource = { sourceId: `scheduled-locomotion-model-${playerId}`, sourceVersion: 'synthetic-v1', capability: 'defender_locomotion_v1' as const,
    careerId: b.careerId, playerId, personLinkSourceId: b.personLinkSourceId, fieldingModelSourceId: fielding.source.sourceId,
    acceptedAtDay: b.gameDay, calibration: { ...playerLocomotionCalibrationFixture(), maxIntegrationStepTicks: coverageTicks } };
  phase('accept-locomotion-model', () => x.f.track(openSqlitePlayerLocomotionModelStore(x.f.path, { readAcceptedModel: () => modelSource })).accept(modelSource.sourceId));
  const motorSources = new Map<string, AcceptedActualLocomotion>();
  const motors = x.f.track(openSqliteActualLocomotionStore(x.f.path, { readAcceptedLocomotion: id => motorSources.get(id) ?? null }));
  const issue = (executionSourceId: string) => {
    const source: AcceptedActualLocomotion = { sourceId: `scheduled-motor-${playerId}`, sourceVersion: 'synthetic-v1', capability: 'initial_defender_step_v1',
      physicalPitchSourceId: decision.source.physicalPitchSourceId, playerId, decisionSourceId: decision.source.sourceId,
      locomotionModelSourceId: modelSource.sourceId, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId };
    motorSources.set(source.sourceId, source); return phase('issue-initial-motor', () => motors.accept(source.sourceId));
  };
  return { observer, observation, fielding, b, decision, decisions, decisionSources, revise, issue, motors, motorSources };
};

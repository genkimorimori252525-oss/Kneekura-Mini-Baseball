import assert from 'node:assert/strict';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
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

type Fixture = Readonly<{ f: Pick<ReturnType<typeof ownedScheduledMotionFixture>['f'], 'path' | 'track'>;
  baseField: ReturnType<typeof ownedScheduledMotionFixture>['baseField'] }>;
/** Synthetic source-owned timing/coverage. Every observation, decision and motor is
 * still admitted by its real Native owner; this never supplies an acceleration. */
export const installOwnedScheduledDecision = (x: Fixture, playerId: string, executionSourceId: string,
  delayTicks = 0, coverageTicks = 1_000_000, retained?: 'observation_and_model' | 'decision_and_locomotion_model' | 'adopted_motor') => {
  const phase = <T>(name: string, run: () => T) => ownedScheduledMotionPhase(`${playerId}:${name}`, run);
  const observer = phase('install-observation', () => installSyntheticObservation(x, playerId, executionSourceId));
  const observation = retained ? phase('read-original-observation', () => {
    const saved = observer.observations.read(observer.observationSource.sourceId);
    assert(saved, 'retained original observation is missing');
    assert.equal(json(saved.source), json(observer.observationSource), 'retained observation differs from the original fixture Source');
    return saved;
  }) : phase('accept-observation', () => observer.observations.accept(observer.observationSource.sourceId));
  const fielding = observer.observationModel.fieldingModel, b = x.baseField.response.touch.worldContact
    .modelActorEvidence.find(a => a.binding.playerId === playerId)!.binding;
  const calibration = { ...playerDecisionCalibrationFixture(),
    decisionTimingParameters: { minimumDecisionDelayTicks: delayTicks, maximumDecisionDelayTicks: delayTicks, fixedProcessingOffsetTicks: 0 },
    firstStepTimingParameters: { minimumFirstStepDelayTicks: 0, maximumFirstStepDelayTicks: 0, fixedMotorOffsetTicks: 0 } };
  const decisionModelSource = { sourceId: `scheduled-decision-model-${playerId}`, sourceVersion: 'synthetic-v1', careerId: b.careerId,
    playerId, personLinkSourceId: b.personLinkSourceId, fieldingModelSourceId: fielding.source.sourceId, acceptedAtDay: b.gameDay, calibration };
  if (retained) phase('read-original-decision-model', () => {
    const saved = x.f.track(openSqlitePlayerDecisionModelStore(x.f.path)).read(decisionModelSource.sourceId);
    assert(saved, 'retained original decision model is missing');
    assert.equal(json(saved.source), json(decisionModelSource), 'retained decision model differs from the original fixture Source');
    assert.equal(json(saved.fieldingModel), json(fielding), 'retained decision model original fielding owner differs');
  });
  else phase('accept-decision-model', () => x.f.track(openSqlitePlayerDecisionModelStore(x.f.path, { readAcceptedModel: () => decisionModelSource })).accept(decisionModelSource.sourceId));
  const planSource = { sourceId: `scheduled-priorities-${playerId}`, sourceVersion: 'synthetic-v1', provenance: 'accepted_at_actual_observation' as const,
    physicalPitchSourceId: observation.source.physicalPitchSourceId, careerId: b.careerId, playerId, personLinkSourceId: b.personLinkSourceId,
    gameDay: b.gameDay, fieldingModelSourceId: fielding.source.sourceId, observationSourceId: observation.source.sourceId,
    priorities: { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 } };
  if ((retained === 'decision_and_locomotion_model' || retained === 'adopted_motor')) phase('read-original-defensive-plan', () => {
    const saved = x.f.track(openSqliteActualDefensivePlanStore(x.f.path)).read(planSource.sourceId);
    assert(saved, 'retained original defensive plan is missing');
    assert.equal(json(saved.source), json(planSource), 'retained defensive plan differs from original fixture Source');
  });
  else phase('accept-defensive-plan', () => x.f.track(openSqliteActualDefensivePlanStore(x.f.path, { readAcceptedPlan: () => planSource })).accept(planSource.sourceId));
  const decisionSource: AcceptedActualDefensiveDecision = { sourceId: `scheduled-decision-${playerId}`, sourceVersion: 'synthetic-v1', physicalPitchSourceId: observation.source.physicalPitchSourceId,
    playerId, observationSourceId: observation.source.sourceId, decisionModelSourceId: decisionModelSource.sourceId,
    planSourceId: planSource.sourceId, previousDecisionSourceId: null };
  const decisionSources = new Map([[decisionSource.sourceId, decisionSource]]);
  const decisions = x.f.track(openSqliteActualDefensiveDecisionStore(x.f.path, { readAcceptedDecision: id => decisionSources.get(id) ?? null }));
  let decision = (retained === 'decision_and_locomotion_model' || retained === 'adopted_motor') ? phase('read-original-decision', () => {
    const saved = decisions.read(decisionSource.sourceId);
    assert(saved, 'retained original defensive decision is missing');
    assert.equal(json(saved.source), json(decisionSource), 'retained defensive decision differs from original fixture Source');
    return saved;
  }) : phase('accept-decision', () => decisions.accept(decisionSource.sourceId)), observationId = observation.source.sourceId;
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
  if ((retained === 'decision_and_locomotion_model' || retained === 'adopted_motor')) phase('read-original-locomotion-model', () => {
    const saved = x.f.track(openSqlitePlayerLocomotionModelStore(x.f.path)).read(modelSource.sourceId);
    assert(saved, 'retained original locomotion model is missing');
    assert.equal(json(saved.source), json(modelSource), 'retained locomotion model differs from original fixture Source');
    assert.equal(json(saved.fieldingModel), json(fielding), 'retained locomotion model original fielding owner differs');
  });
  else phase('accept-locomotion-model', () => x.f.track(openSqlitePlayerLocomotionModelStore(x.f.path, { readAcceptedModel: () => modelSource })).accept(modelSource.sourceId));
  const motorSources = new Map<string, AcceptedActualLocomotion>();
  const motors = x.f.track(openSqliteActualLocomotionStore(x.f.path, { readAcceptedLocomotion: id => motorSources.get(id) ?? null }));
  const issue = (executionSourceId: string) => {
    const source: AcceptedActualLocomotion = { sourceId: `scheduled-motor-${playerId}`, sourceVersion: 'synthetic-v1', capability: 'initial_defender_step_v1',
      physicalPitchSourceId: decision.source.physicalPitchSourceId, playerId, decisionSourceId: decision.source.sourceId,
      locomotionModelSourceId: modelSource.sourceId, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId };
    motorSources.set(source.sourceId, source);
    if (retained === 'adopted_motor') return phase('read-original-motor', () => {
      const saved = motors.read(source.sourceId);
      assert(saved, 'retained original motor is missing');
      assert.equal(json(saved.source), json(source), 'retained motor differs from original fixture Source');
      return saved;
    });
    return phase('issue-initial-motor', () => motors.accept(source.sourceId));
  };
  return { observer, observation, fielding, b, decision, decisions, decisionSources, revise, issue, motors, motorSources };
};

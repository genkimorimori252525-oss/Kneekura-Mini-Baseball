import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { openSqlitePlayerDecisionModelStore } from './SqlitePlayerDecisionModelStore';
import { openSqliteActualDefensivePlanStore } from './SqliteActualDefensivePlanStore';
import { openSqliteActualDefensiveDecisionStore } from './SqliteActualDefensiveDecisionStore';
import { openSqlitePlayerLocomotionModelStore } from './SqlitePlayerLocomotionModelStore';
import { openSqliteActualLocomotionStore, type AcceptedActualLocomotion } from './SqliteActualLocomotionStore';

/** Synthetic values only. The real confirmation fence supplies an exact actual boundary
 * with original coverage; no decision is sampled before that fence in this fixture. */
export const actualLocomotionFixture = (options?: Readonly<{ hold?: boolean; calibration?: ReturnType<typeof playerLocomotionCalibrationFixture>;
  ratings?: { acceleration: number; routeEfficiency: number } }>) => {
  const x = battedWorldFieldExecutionFixture(join(mkdtempSync(join(tmpdir(), 'actual-locomotion-')), 'state.sqlite'), 'candidate', world => {
    const source = world.sources.get(world.source.sourceId)!;
    world.sources.set(source.sourceId, { ...source, commands: source.commands.map(c => c.playerId !== 'p2' ? c : { ...c,
      primitiveMotions: c.primitiveMotions.map(p => p.role === 'glove' ? p : { ...p,
        offsetVelocity: { x: 0.2, y: 0.1, z: -0.15 }, offsetAcceleration: { x: 0.25, y: -0.5, z: 0.75 } }) }) });
    const model = world.models.get(world.model.sourceId)!;
    world.models.set(model.sourceId, { ...model, actors: model.actors.map(a => a.playerId !== 'p2' ? a : { ...a,
      primitives: a.primitives.map(p => p.role !== 'body' ? p : { ...p, offset: { x: 0.2, y: 0.1, z: 0.3 } }) }) });
  });
  const plan = { ...x.source, sourceId: 'locomotion-capture-plan', action: { kind: 'acquisition_plan' as const } };
  x.sources.set(plan.sourceId, plan); const planned = x.executions.accept(plan.sourceId);
  if (planned.execution.kind !== 'acquisition_plan') throw new Error('fixture capture plan');
  const advance = { ...plan, sourceId: 'locomotion-capture-fence', previousExecutionSourceId: plan.sourceId,
    action: { kind: 'acquisition_advance' as const, planSourceId: plan.sourceId, throughElapsedSeconds: planned.execution.plan.fenceElapsedSeconds } };
  x.sources.set(advance.sourceId, advance); const executed = x.executions.accept(advance.sourceId);
  const obs = installSyntheticObservation(x, 'p2', executed.source.sourceId, undefined, undefined,
    s => ({ ...s, ratings: { ...s.ratings, ...options?.ratings } }));
  const observation = obs.observations.accept(obs.observationSource.sourceId), fielding = obs.observationModel.fieldingModel;
  const b = x.baseField.response.touch.worldContact.modelActorEvidence.find(a => a.binding.playerId === 'p2')!.binding;
  const calibration = { ...playerDecisionCalibrationFixture(), minimumCueConfidence: options?.hold ? 1 : 0.4,
    decisionTimingParameters: { minimumDecisionDelayTicks: 0, maximumDecisionDelayTicks: 0, fixedProcessingOffsetTicks: 0 },
    firstStepTimingParameters: { minimumFirstStepDelayTicks: 0, maximumFirstStepDelayTicks: 0, fixedMotorOffsetTicks: 0 } };
  const decisionModelSource = { sourceId: 'locomotion-decision-model', sourceVersion: 'synthetic-v1', careerId: b.careerId,
    playerId: 'p2', personLinkSourceId: b.personLinkSourceId, fieldingModelSourceId: fielding.source.sourceId, acceptedAtDay: b.gameDay, calibration };
  const decisionModel = x.f.track(openSqlitePlayerDecisionModelStore(x.f.path, { readAcceptedModel: () => decisionModelSource })).accept(decisionModelSource.sourceId);
  const planSource = { sourceId: 'locomotion-priorities', sourceVersion: 'synthetic-v1', provenance: 'accepted_at_actual_observation' as const,
    physicalPitchSourceId: observation.source.physicalPitchSourceId, careerId: b.careerId, playerId: 'p2', personLinkSourceId: b.personLinkSourceId,
    gameDay: b.gameDay, fieldingModelSourceId: fielding.source.sourceId, observationSourceId: observation.source.sourceId,
    priorities: { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 } };
  x.f.track(openSqliteActualDefensivePlanStore(x.f.path, { readAcceptedPlan: () => planSource })).accept(planSource.sourceId);
  const decisionSource = { sourceId: 'locomotion-decision', sourceVersion: 'synthetic-v1', physicalPitchSourceId: observation.source.physicalPitchSourceId,
    playerId: 'p2', observationSourceId: observation.source.sourceId, decisionModelSourceId: decisionModel.source.sourceId,
    planSourceId: planSource.sourceId, previousDecisionSourceId: null };
  const decisions = x.f.track(openSqliteActualDefensiveDecisionStore(x.f.path, { readAcceptedDecision: () => decisionSource }));
  const decision = decisions.accept(decisionSource.sourceId);
  const modelSource = { sourceId: 'actual-locomotion-model', sourceVersion: 'synthetic-v1', capability: 'defender_locomotion_v1' as const,
    careerId: b.careerId, playerId: 'p2', personLinkSourceId: b.personLinkSourceId,
    fieldingModelSourceId: fielding.source.sourceId, acceptedAtDay: b.gameDay, calibration: options?.calibration ?? playerLocomotionCalibrationFixture() };
  const model = x.f.track(openSqlitePlayerLocomotionModelStore(x.f.path, { readAcceptedModel: () => modelSource })).accept(modelSource.sourceId);
  const source: AcceptedActualLocomotion = { sourceId: 'actual-locomotion-1', sourceVersion: 'synthetic-v1', capability: 'initial_defender_step_v1',
    physicalPitchSourceId: decision.source.physicalPitchSourceId, playerId: 'p2', decisionSourceId: decision.source.sourceId,
    locomotionModelSourceId: model.source.sourceId, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: executed.source.sourceId };
  const sources = new Map([[source.sourceId, source]]), authority = { readAcceptedLocomotion: (id: string) => sources.get(id) ?? null };
  const locomotion = x.f.track(openSqliteActualLocomotionStore(x.f.path, authority));
  return { ...x, ...obs, decision, decisions, model, locomotionSource: source, locomotionSources: sources, locomotionAuthority: authority, locomotion, executed };
};

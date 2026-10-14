import { expect, it } from 'vitest';
import { physicalCapabilityExposureFixture } from './PhysicalCapabilityDevelopment.test-support';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import { openSqlitePlayerRunnerDecisionMotionModelStore, type AcceptedPlayerRunnerDecisionMotionModel } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { openSqlitePlayerLocomotionModelStore, type AcceptedPlayerLocomotionModel } from './SqlitePlayerLocomotionModelStore';
import { openSqlitePlayerObservationModelStore, type AcceptedPlayerObservationModel } from './SqlitePlayerObservationModelStore';
import { openSqlitePlayerDecisionModelStore, type AcceptedPlayerDecisionModel } from './SqlitePlayerDecisionModelStore';
import { openSqlitePlayerBatterRunTransitionModelStore, playerBatterRunTransitionModelEvidenceFromSqlite } from './SqlitePlayerBatterRunTransitionModelStore';
import type { AcceptedPlayerBatterRunTransitionModel } from './PlayerBatterRunTransitionModel';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { playerObservationCalibrationFixture } from '../../core/sim/perception/PlayerObservationCalibrationFixtures.test-support';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { input as runnerInput } from './PrePitchRunnerFixtures.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('appends explicit physical capabilities and rebinds unchanged calibrations while preserving original models and offline history', async () => {
  const cleanup: (() => void)[] = [];
  try {
    const { f, provenance } = await physicalCapabilityExposureFixture(cleanup);
    const common = { sourceVersion: 'explicit-v1', careerId: 'career-a', playerId: 'p1', personLinkSourceId: 'intake-p1', acceptedAtDay: 12 };
    const field: AcceptedPlayerFieldingModel = { ...common, sourceId: 'fielding-original',
      ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
        firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5, armStrength: 0.5,
        throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
      transferParameters: { minimumTransferDelayTicks: 100, maximumTransferDelayTicks: 300, fixedGripOffsetTicks: 10 },
      throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } };
    const runner: AcceptedPlayerRunnerDecisionMotionModel = { ...common, sourceId: 'runner-original', capability: 'runner_decision_motion_v1',
      decision: { minimumCueConfidence: 0.5, coachTrust: 1, minimumAdvanceSafetyMarginTicks: 50_000, decisionAbility: 0.8,
        timingParameters: { minimumDecisionDelayTicks: 30_000, maximumDecisionDelayTicks: 180_000, fixedRecognitionOffsetTicks: 10_000 } }, motion: runnerInput().parameters };
    const motor: AcceptedPlayerLocomotionModel = { ...common, sourceId: 'locomotion-original', capability: 'defender_locomotion_v1',
      fieldingModelSourceId: field.sourceId, calibration: playerLocomotionCalibrationFixture() };
    const observation: AcceptedPlayerObservationModel = { ...common, sourceId: 'observation-original', fieldingModelSourceId: field.sourceId, calibration: playerObservationCalibrationFixture() };
    const decision: AcceptedPlayerDecisionModel = { ...common, sourceId: 'decision-original', fieldingModelSourceId: field.sourceId, calibration: playerDecisionCalibrationFixture() };
    const fields = new Map([[field.sourceId, field]]), runners = new Map([[runner.sourceId, runner]]), motors = new Map([[motor.sourceId, motor]]),
      observations = new Map([[observation.sourceId, observation]]), decisions = new Map([[decision.sourceId, decision]]);
    const fieldOwner = openSqlitePlayerFieldingModelStore(f.path, { readAcceptedModel: id => fields.get(id) ?? null }); cleanup.push(fieldOwner.close);
    const runnerOwner = openSqlitePlayerRunnerDecisionMotionModelStore(f.path, { readAcceptedModel: id => runners.get(id) ?? null }); cleanup.push(runnerOwner.close);
    const motorOwner = openSqlitePlayerLocomotionModelStore(f.path, { readAcceptedModel: id => motors.get(id) ?? null }); cleanup.push(motorOwner.close);
    const observationOwner = openSqlitePlayerObservationModelStore(f.path, { readAcceptedModel: id => observations.get(id) ?? null }); cleanup.push(observationOwner.close);
    const decisionOwner = openSqlitePlayerDecisionModelStore(f.path, { readAcceptedModel: id => decisions.get(id) ?? null }); cleanup.push(decisionOwner.close);
    const oldField = fieldOwner.accept(field.sourceId), oldRunner = runnerOwner.accept(runner.sourceId), oldMotor = motorOwner.accept(motor.sourceId),
      oldObservation = observationOwner.accept(observation.sourceId), oldDecision = decisionOwner.accept(decision.sourceId);
    const transition: AcceptedPlayerBatterRunTransitionModel = { ...common, sourceId: 'exit-original', capability: 'batter_run_transition_model_v1',
      runnerModelReference: reference('world_player_runner_decision_motion_models', oldRunner), parameters: { ticksPerSecond: runner.motion.ticksPerSecond,
        maximumBodyTurnRateRadiansPerSecond: 4, lateralRealignmentAccelerationMps2: 3, backwardRecoveryAccelerationMps2: 2 } };
    const transitions = new Map([[transition.sourceId, transition]]), transitionOwner = openSqlitePlayerBatterRunTransitionModelStore(f.path, { readAcceptedModel: id => transitions.get(id) ?? null }); cleanup.push(transitionOwner.close);
    const oldTransition = transitionOwner.accept(transition.sourceId);
    const baselineTables = ['world_player_fielding_models', 'world_player_runner_decision_motion_models', 'world_player_locomotion_models', 'world_player_observation_models', 'world_player_decision_models'];
    const before = baselineTables.map(table => f.snapshot(table)), workBefore = f.snapshot('world_player_workload_activities');
    const changedField = { ...field, sourceId: 'fielding-developed', acceptedAtDay: 16, ratings: { ...field.ratings, acceleration: 0.7 } };
    const newField: AcceptedPlayerFieldingModel = { ...changedField, developmentProvenance: provenance(changedField, oldField, 'fielding') }; fields.set(newField.sourceId, newField);
    f.db.exec("CREATE TRIGGER corrupt_original_capability AFTER INSERT ON world_player_fielding_model_developments BEGIN UPDATE pitch_practice_attempts SET immutable_hash='broken' WHERE sequence=1; END");
    expect(() => fieldOwner.accept(newField.sourceId)).toThrow(); expect(f.count('world_player_fielding_model_developments')).toBe(0);
    expect(f.db.prepare('SELECT immutable_hash FROM pitch_practice_attempts WHERE sequence=1').get()!.immutable_hash).not.toBe('broken');
    f.db.exec('DROP TRIGGER corrupt_original_capability');
    const nextField = fieldOwner.accept(newField.sourceId);
    const changedRunner = { ...runner, sourceId: 'runner-developed', acceptedAtDay: 16, motion: { ...runner.motion, topSpeedMps: runner.motion.topSpeedMps + 0.5 } };
    const newRunner: AcceptedPlayerRunnerDecisionMotionModel = { ...changedRunner, developmentProvenance: provenance(changedRunner, oldRunner, 'runner_decision_motion') }; runners.set(newRunner.sourceId, newRunner);
    const nextRunner = runnerOwner.accept(newRunner.sourceId);
    const changedMotor = { ...motor, sourceId: 'locomotion-developed', acceptedAtDay: 16, fieldingModelSourceId: nextField.source.sourceId,
      calibration: { ...motor.calibration, topSpeedMps: motor.calibration.topSpeedMps + 0.5 } };
    const newMotor: AcceptedPlayerLocomotionModel = { ...changedMotor, developmentProvenance: provenance(changedMotor, oldMotor, 'defender_locomotion') }; motors.set(newMotor.sourceId, newMotor);
    const nextMotor = motorOwner.accept(newMotor.sourceId);
    const rebind = (original: typeof oldObservation | typeof oldDecision) => ({ kind: 'accepted_fielding_model_rebinding_v1' as const,
      originalModelRef: { sourceId: original.source.sourceId, sourceVersion: original.source.sourceVersion }, originalModelSourceHash: hash(original.source), originalModelSnapshotHash: hash(original) });
    const newObservation = { ...observation, sourceId: 'observation-rebound', acceptedAtDay: 16, fieldingModelSourceId: nextField.source.sourceId, fieldingRebinding: rebind(oldObservation) };
    const newDecision = { ...decision, sourceId: 'decision-rebound', acceptedAtDay: 16, fieldingModelSourceId: nextField.source.sourceId, fieldingRebinding: rebind(oldDecision) };
    observations.set(newObservation.sourceId, newObservation); decisions.set(newDecision.sourceId, newDecision);
    const nextObservation = observationOwner.accept(newObservation.sourceId), nextDecision = decisionOwner.accept(newDecision.sourceId);
    const newTransition: AcceptedPlayerBatterRunTransitionModel = { ...transition, sourceId: 'exit-rebound', acceptedAtDay: 16,
      runnerModelReference: reference('world_player_runner_decision_motion_models', nextRunner),
      runnerRebinding: { kind: 'accepted_runner_model_rebinding_v1', originalModelReference: reference('world_player_batter_run_transition_models', oldTransition) } };
    transitions.set(newTransition.sourceId, newTransition); const nextTransition = transitionOwner.accept(newTransition.sourceId);
    expect(nextMotor.fieldingModel).toEqual(nextField); expect(nextObservation.fieldingModel).toEqual(nextField); expect(nextDecision.fieldingModel).toEqual(nextField);
    expect(nextTransition.runnerModel).toEqual(nextRunner); expect(nextTransition.source.parameters).toEqual(oldTransition.source.parameters);
    for (const [owner, original, updated] of [[fieldOwner, oldField, nextField], [runnerOwner, oldRunner, nextRunner], [motorOwner, oldMotor, nextMotor],
      [observationOwner, oldObservation, nextObservation], [decisionOwner, oldDecision, nextDecision]] as const) {
      expect(owner.read(original.source.sourceId)).toEqual(original);
      expect(owner.selectAtDay('career-a', 'p1', 15)).toEqual(original);
      expect(owner.selectAtDay('career-a', 'p1', 16)).toEqual(updated);
      expect(owner.accept(updated.source.sourceId)).toEqual(updated);
    }
    expect(transitionOwner.read(oldTransition.source.sourceId)).toEqual(oldTransition);
    // The borrowed transition reader retains the same Native query-only
    // contract as direct historical reads and the normal batter-exit owner.
    f.db.exec('BEGIN; PRAGMA query_only=ON');
    try {
      expect(playerBatterRunTransitionModelEvidenceFromSqlite(f.db).selectAtDay('career-a', 'p1', 15)).toEqual(oldTransition);
      expect(playerBatterRunTransitionModelEvidenceFromSqlite(f.db).selectAtDay('career-a', 'p1', 16)).toEqual(nextTransition);
    } finally { f.db.exec('ROLLBACK; PRAGMA query_only=OFF'); }
    expect(baselineTables.map(table => f.snapshot(table))).toEqual(before); expect(f.snapshot('world_player_workload_activities')).toBe(workBefore);
    const offline = openSqlitePlayerLocomotionModelStore(f.path); cleanup.push(offline.close);
    const offlineTransition = openSqlitePlayerBatterRunTransitionModelStore(f.path); cleanup.push(offlineTransition.close);
    expect(offline.accept(nextMotor.source.sourceId)).toEqual(nextMotor); expect(offlineTransition.accept(nextTransition.source.sourceId)).toEqual(nextTransition);
    f.db.exec("UPDATE pitch_practice_attempts SET immutable_hash='broken' WHERE sequence=1");
    expect(() => offline.read(nextMotor.source.sourceId)).toThrow(); expect(() => offlineTransition.accept(nextTransition.source.sourceId)).toThrow();
  } finally { while (cleanup.length) cleanup.pop()!(); }
});

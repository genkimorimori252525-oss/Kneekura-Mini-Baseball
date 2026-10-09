import { expect, it } from 'vitest';
import { readSamePaFieldRuleEvidenceFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { appendNativePhysicalFieldActions } from './SamePlateAppearancePhysicalFieldActionsNative.test-support';
import { prepareNativePhysicalThrowCalibration } from './SamePlateAppearancePhysicalThrowNative.test-support';
import { physicalThrowSceneFixture } from './SamePlateAppearancePhysicalThrowScene.test-support';
import { appendNativePhysicalThrowReception } from './SamePlateAppearancePhysicalThrowReception.test-support';
import { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { openSqliteBattingPerceptionStore } from './SqliteBattingPerceptionStore';
import { openSqliteBattingExecutionInputStore, readCurrentSamePaBattingExecutionInputFromSqlite } from './SqliteBattingExecutionInputStore';
import { openSqliteBattingEmotionExecutionStore } from './SqliteBattingEmotionExecutionStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

/** One real Native scenario for the integrated batch. The exact-observation
 * declaration is an independent finite synthetic calibration; nominal model
 * bytes remain owned and unchanged. It is not a production response model. */
it('IFN01 owned in-flight samples, delayed delivery, explicit appraisal and prepared input feed atomic ordinary swing commitment', () => {
  const declared = dispatchCalibrationValues().batter_observation;
  const explicitBatterObservation = { ...declared, calibration: { ...declared.calibration, errorParameters: { ...declared.calibration.errorParameters,
    minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0, minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } };
  const defenderValues = dispatchCalibrationValues().defender_observation;
  const explicitDefenderObservation = { ...defenderValues,
    memoryDecayParameters: { ...defenderValues.memoryDecayParameters, ticksPerSecond: 1_000_000 },
    errorParameters: { ...defenderValues.errorParameters, minimumDetectionQuality: 0,
      minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0, minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } };
  const throwScene = physicalThrowSceneFixture();
  const h = samePaPhysicalLifecycleFixture({ explicitBatterObservation, explicitDefenderObservation, explicitDefenderGloveOffsets: throwScene.gloveOffsets }), { f } = h;
  try {
    const before = h.current(), readyAtUs = Math.max(before.view.cut.evaluationTick, before.view.cut.bodyCut.completedAtTick);
    const originalHeads = f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all();
    const action = h.prepareAction('in-flight-fixture:pitch3', 'observer_decision', { ...h.original.nominalPitch,
      delivery: { ...h.original.nominalPitch.delivery, readyAtUs, physics: { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } } } },
      { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS });
    const fieldPreparations: ReturnType<typeof prepareFreshPhysicalFieldFixture>[] = [];
    const s = prepareInFlightBattingSwing(h, action, 'in-flight-fixture:pitch3', owned => {
      fieldPreparations.push(prepareFreshPhysicalFieldFixture(h, action, owned.posture, owned.postureReference, 'in-flight-fixture:field3'));
    });
    expect(s.beforeLaunch.eventCount).toBe(1); expect(s.beforeLaunch.worldRevision).toBe(0);
    expect(s.intent.originalIntent.attempt).toBe('ordinary_swing');
    expect(s.posture.source.actionReference).toEqual(action.actionReference);
    expect(s.capture.source.observedTick).toBe(s.captureCut.evaluationTick);
    expect(s.capture.calculation.input.target).toEqual({ position: s.captureCut.ball.position, velocity: s.captureCut.ball.velocity });
    expect(s.capture.calculation.status).toBe('AWAITING_DELIVERY'); expect(s.capture.calculation.deliveredMemory).toBeNull();
    expect(s.capture.calculation.nominalValues).toEqual(s.posture.model.observationCalibration.values);
    expect(s.capture.calculation.effectiveValues).toEqual(explicitBatterObservation);
    expect(s.capture.calculation.effectiveValues).not.toEqual(s.capture.calculation.nominalValues);
    expect(s.wrongTimeRejected).toBe(true); expect(s.staleCutRejected).toBe(true);
    expect(s.perception.readObservation('in-flight-fixture:pitch3:wrong-time-capture')).toBeNull();
    expect(s.perception.readDelivery('in-flight-fixture:pitch3:stale-cut-delivery')).toBeNull();
    expect(s.earlyDelivery).toMatchObject({ kind: 'pending', reason: 'later_owned_physical_cut_required' });
    expect(s.perception.readDelivery('in-flight-fixture:pitch3:same-cut-delivery')).toBeNull();
    expect(s.delivery.delivery.evaluatedAtTick).toBe(s.deliveryCut.evaluationTick);
    expect(s.deliveryCut.evaluationTick - s.captureCut.evaluationTick).toBe(explicitBatterObservation.deliveryLatencyTicks);
    expect(s.delivery.originalCaptureHash).toBe(hash(s.capture));
    expect(s.forecast.forecast.availableTick).toBe(s.deliveryCut.evaluationTick);
    expect(s.score.prediction.swingScore).toBe(0.9);
    expect(s.preparedWorldRevision).toBe(s.emotion.acceptance.afterWorldRevision);
    expect(s.input).not.toHaveProperty('calculation');
    expect(s.commitment.source.inputReference).toEqual(s.inputReference);
    expect(s.commitment.commitment.decisionTick).toBe(s.decisionCut.evaluationTick);
    expect(() => withSqliteReadTransaction(f.db, () => readCurrentSamePaBattingExecutionInputFromSqlite(f.db, s.inputReference))).toThrow();
    expect(s.commitment.source.intentReference).toEqual(s.intentReference);
    expect(s.commitment.calculation.nominalRequest).toEqual(s.input.nominalRequest);
    expect(s.commitment.calculation.effectiveValues).toEqual(s.input.effectiveValues);
    expect(s.commitment.originalIntent).toEqual(s.intent.originalIntent);
    expect(s.commitment.commitment.action).toBe('SWING');
    expect(s.resolution.contact).not.toBeNull();
    expect(s.resolution.timeline.status.kind).toBe('batted_ball_pending');
    expect(s.resolution.timeline.events.filter(e => e.kind === 'BatBallContact')).toHaveLength(1);
    expect(s.commitment.afterWorldRevision).toBe(s.preparedWorldRevision + 1);
    expect(h.worldOwner.readHead(f.actor.binding.careerId)!.worldRevision).toBe(s.commitment.afterWorldRevision);
    expect(f.db.prepare('SELECT count(*) n FROM batting_execution_v1_executions').get()!.n).toBe(0);
    expect(fieldPreparations).toHaveLength(1);
    const fieldPreparation = fieldPreparations[0];
    expect(fieldPreparation.calibration.source.actionReference).toEqual(action.actionReference);
    expect(fieldPreparation.model.actors).toHaveLength(10);
    expect(fieldPreparation.model.actors.flatMap(a => a.primitives)).toHaveLength(50);
    const field = fieldPreparation.appendField(s.resolution, s.resolutionReference);
    expect(field.root.source.fieldInputs).toEqual({ kind: 'fresh_physical_field_calibration_v1', calibrationReference: fieldPreparation.calibrationReference });
    expect(field.root.response.world.flight.initialBall.tick).toBe(s.resolution.contact!.tick);
    expect(field.step.evaluationTick).toBeGreaterThanOrEqual(field.root.evaluationTick);
    const thrown = appendNativePhysicalThrowReception(h, field, 'in-flight-fixture:throw');
    expect(thrown.secured.value.field.motion.carrierPlayerId).toBe('p2');
    expect(thrown.calibration.value.source.response).toEqual({ kind: 'accepted_execution_values_v1', values: throwScene.values });
    expect(thrown.calibration.replay).toEqual(thrown.calibration.value);
    expect(thrown.planned.value.field).toEqual(thrown.secured.value.field);
    expect(thrown.transfer.value.field.motion.carrierPlayerId).toBe('p2');
    expect(thrown.released.value.field.motion.carrierPlayerId).toBeNull();
    expect(thrown.reception.value.evaluationTick).toBeGreaterThan(thrown.released.value.evaluationTick);
    expect(thrown.reception.value.field.motion.response.kind).toBe('capture_candidate');
    expect(thrown.received.value.field.motion.carrierPlayerId).toBe('home-1');
    expect(thrown.received.value.field.motion.actors).toHaveLength(50);
    const fieldActions = appendNativePhysicalFieldActions(h, thrown.fieldForActions, 'in-flight-fixture:field-actions');
    const observation = fieldActions.observation.value.actionResult, decision = fieldActions.decision.value.actionResult, motor = fieldActions.motion.value.actionResult;
    if (observation?.kind !== 'defender_observation_v1' || decision?.kind !== 'defender_decision_v1' || motor?.kind !== 'defender_motion_v1') throw new Error('IFN01 actual field chain kinds differ');
    expect(observation.receipt.at.tick).toBe(thrown.received.value.evaluationTick);
    expect(observation.receipt.samples.ball).not.toBeNull();
    expect(decision.observationReference).toEqual(fieldActions.observation.operationReference);
    expect(decision.calculation.selected.intent.kind).toBe('ball_handler');
    expect(decision.target).toEqual({ x: observation.receipt.perceived.ball!.estimate.position.x, z: observation.receipt.perceived.ball!.estimate.position.z });
    expect(fieldActions.motion.value.source.viewReference).toEqual(fieldActions.motionViewReference);
    expect(motor.motors).toHaveLength(1); expect(motor.motors[0].self.playerId).toBe(fieldActions.playerId);
    expect(motor.motors[0].segment.startTick).toBeGreaterThanOrEqual(fieldActions.dueTick);
    expect(motor.motors[0].self.originalFieldReference).toEqual(field.rootReference);
    expect(Math.hypot(motor.motors[0].segment.acceleration.x, motor.motors[0].segment.acceleration.z)).toBeGreaterThan(0);
    expect(fieldActions.motion.value.field.motion.actors).toHaveLength(50);
    expect(fieldActions.replay.record).toEqual(fieldActions.motion.value);
    const throwCut = h.current().viewReference, physicalEventCount = h.events.length;
    const throwCalibration = prepareNativePhysicalThrowCalibration(h, fieldActions.playerId, 'in-flight-fixture:throw-preparation');
    expect(throwCalibration.value.source.viewReference).toEqual(throwCut);
    expect(throwCalibration.replay).toEqual(throwCalibration.value);
    expect(throwCalibration.value.nominalInputHash).toBe(hash(throwCalibration.model));
    expect(h.current().calibrationSet.calibrations).toHaveLength(32);
    expect(h.current().viewReference).toEqual(throwCut); expect(h.events).toHaveLength(physicalEventCount);
    expect(h.current().view.cut.stage).toBe('field_active');
    const fieldView = h.current().viewReference;
    const changesBeforeRule = f.db.prepare('SELECT total_changes() n').get()!.n;
    const fieldRule = withSqliteReadTransaction(f.db, () => readSamePaFieldRuleEvidenceFromSqlite(f.db, fieldView, 'current'));
    if (fieldRule.kind !== 'same_pa_field_rule_evidence_v1') throw new Error('IFN01 original field rule bridge is pending');
    expect(fieldRule.physicalOperationReference).toEqual(fieldActions.motion.operationReference);
    expect(fieldRule.evidence.physical.field.evidence.horizon).toEqual(fieldActions.motion.value.field.motion.world.moment);
    expect(fieldRule.evidence.defendersFirstBase).toHaveLength(9);
    expect(fieldRule.evidence.batterFirstBase.history.playerId).toBe(f.actor.binding.playerId);
    expect(fieldRule.evidence.terminal).toEqual({ kind: 'pending', reason: 'reserved_live_play_end_owner_missing', physicalEnd: null });
    expect(f.db.prepare('SELECT total_changes() n').get()!.n).toBe(changesBeforeRule);
    const oldFieldRule = withSqliteReadTransaction(f.db, () => readSamePaFieldRuleEvidenceFromSqlite(f.db, fieldActions.motionViewReference, 'historical'));
    expect(oldFieldRule.kind).toBe('same_pa_field_rule_evidence_v1');
    expect(() => withSqliteReadTransaction(f.db, () => readSamePaFieldRuleEvidenceFromSqlite(f.db, fieldActions.motionViewReference, 'current'))).toThrow();

    expect(f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all()).toEqual(originalHeads);
    const reopenedPerception = f.x.f.track(openSqliteBattingPerceptionStore(f.path));
    const reopenedInput = f.x.f.track(openSqliteBattingExecutionInputStore(f.path));
    const reopenedEmotion = f.x.f.track(openSqliteBattingEmotionExecutionStore(f.path));
    expect(reopenedPerception.acceptObservation(s.capture.source.sourceId)).toEqual(s.capture);
    expect(reopenedPerception.acceptDelivery(s.delivery.source.sourceId)).toEqual(s.delivery);
    expect(reopenedInput.acceptInput(s.input.source.sourceId)).toEqual(s.input);
    expect(reopenedEmotion.accept(s.emotion.source.sourceId)).toEqual(s.emotion);
    expect(h.physical.readOperation(reference('pa_physical_v1_commitments', s.commitment)).record).toEqual(s.commitment);
  } finally { h.close(); }
}, 1_200_000);

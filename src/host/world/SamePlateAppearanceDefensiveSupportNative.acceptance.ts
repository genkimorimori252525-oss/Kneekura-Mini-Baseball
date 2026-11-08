import { appendFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import { physicalThrowSceneFixture } from './SamePlateAppearancePhysicalThrowScene.test-support';
import { appendNativePhysicalThrowReception } from './SamePlateAppearancePhysicalThrowReception.test-support';
import { appendNativePhysicalFieldActions } from './SamePlateAppearancePhysicalFieldActionsNative.test-support';
import { samePaPhysicalDefenderSelf } from './SamePlateAppearancePhysicalFieldMotor';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** One actual SQLite source-only scenario. Unlike calculation fixtures, every
 * posture, model, physical action and admission passes its original Native owner. */
it('SN01 accepted support geometry issues real cover/relay movement and reopens original SQLite evidence', () => {
  const stage = (name: string) => {
    if (process.env.BASEBALL_GATE_ERRORS) appendFileSync(process.env.BASEBALL_GATE_ERRORS + '.SN01-stages.jsonl', JSON.stringify({ name, at: Date.now() }) + '\n');
  };
  stage('fixture-start');
  const declared = dispatchCalibrationValues(), scene = physicalThrowSceneFixture();
  const observation = declared.defender_observation;
  const h = samePaPhysicalLifecycleFixture({ profile: { ruleProfileId: NPB_2026_RULE_PROFILE.id },
    explicitBatterObservation: { ...declared.batter_observation, calibration: { ...declared.batter_observation.calibration,
      errorParameters: { ...declared.batter_observation.calibration.errorParameters, minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0,
        minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } },
    explicitDefenderObservation: { ...observation, memoryDecayParameters: { ...observation.memoryDecayParameters, ticksPerSecond: 1_000_000 },
      errorParameters: { ...observation.errorParameters, minimumDetectionQuality: 0, minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0,
        minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } },
    explicitDefenderLocomotion: { ...declared.defender_locomotion, maxIntegrationStepTicks: 500_000 },
    explicitDefenderGloveOffsets: scene.gloveOffsets,
    originalBaseCenters: { first: { x: 19.09, z: 19.09 }, second: { x: 0, z: 38.18 }, third: { x: -19.09, z: 19.09 } } });
  try {
    stage('fixture-ready');
    const before = h.current(), readyAtUs = Math.max(before.view.cut.evaluationTick, before.view.cut.bodyCut.completedAtTick);
    const prepared = h.prepareAction('support-native:pitch3', 'observer_decision', { ...h.original.nominalPitch,
      delivery: { ...h.original.nominalPitch.delivery, readyAtUs, physics: { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } } } },
      { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81, aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS });
    const fields: ReturnType<typeof prepareFreshPhysicalFieldFixture>[] = [];
    const swing = prepareInFlightBattingSwing(h, prepared, 'support-native:pitch3', owned => {
      fields.push(prepareFreshPhysicalFieldFixture(h, prepared, owned.posture, owned.postureReference, 'support-native:field'));
    });
    stage('swing-ready');
    const field = fields[0].appendField(swing.resolution, swing.resolutionReference);
    const thrown = appendNativePhysicalThrowReception(h, field, 'support-native:throw');
    stage('throw-ready');
    const handler = appendNativePhysicalFieldActions(h, thrown.fieldForActions, 'support-native:handler');
    expect(handler.decision.value.actionResult).toMatchObject({ calculation: { selected: { intent: { kind: 'ball_handler' } } } });
    const helperPlayerId = h.f.actor.defenderBindings.find(b => b.playerId !== handler.playerId)!.playerId;
    const cover = appendNativePhysicalFieldActions(h, { ...field, step: handler.motion.value, stepReference: handler.motion.operationReference }, 'support-native:cover', {
      playerId: helperPlayerId, priorities: { ballPursuitPriority: 0, baseCoverPriorities: [{ base: 1, priority: 1 }],
        relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0.01 },
      supportGeometry: { kind: 'perceived_ball_support_geometry_v1', base: 1, teammateMotionReference: handler.motion.operationReference } });
    stage('cover-ready');
    expect(cover.decision.value.actionResult).toMatchObject({ calculation: { selected: { intent: { kind: 'base_cover', base: 1 } } } });
    const relayPlayerId = h.f.actor.defenderBindings.find(b => b.playerId !== handler.playerId && b.playerId !== helperPlayerId)!.playerId;
    const relay = appendNativePhysicalFieldActions(h, { ...field, step: cover.motion.value, stepReference: cover.motion.operationReference }, 'support-native:relay', {
      playerId: relayPlayerId, priorities: { ballPursuitPriority: 0, baseCoverPriorities: [], relayPriority: 1, backupPriority: 0,
        deepCoveragePriority: 0, holdPriority: 0.01 }, supportGeometry: { kind: 'perceived_ball_support_geometry_v1', base: 1 } });
    stage('relay-ready');
    const originals = [cover, relay];
    for (const original of originals) {
      const r = original.motion.value.actionResult;
      if (r?.kind !== 'defender_motion_v1') throw new Error('Native support motor missing');
      const motor = r.motors[0];
      expect(['base_cover', 'relay']).toContain(motor.intent.kind);
      expect(Math.hypot(motor.segment.acceleration.x, motor.segment.acceleration.z)).toBeGreaterThan(0);
      const body = swing.posture.sceneBodies.find(b => b.source.playerId === original.playerId)!.actor;
      const self = samePaPhysicalDefenderSelf(prepared.action, field.root, original.motion.value, body);
      expect(Math.hypot(self.root.position.x - motor.self.root.position.x, self.root.position.z - motor.self.root.position.z)).toBeGreaterThan(0);
      expect(original.replay.record).toEqual(original.motion.value);
      expect(hash(original.replay.record)).toBe(original.motion.operationReference.snapshotHash);
      expect(original.motion.value.field.motion.actors).toHaveLength(50);
    }
    stage('reopen-proved');
  } finally { h.f.close(); }
}, 1_800_000);

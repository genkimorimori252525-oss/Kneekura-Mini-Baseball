import { expect, it } from 'vitest';
import { actualDefensiveDecisionFixture } from './ActualDefensiveDecisionFixtures.test-support';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { openSqlitePlayerLocomotionModelStore } from './SqlitePlayerLocomotionModelStore';
import { openSqliteActualLocomotionStore, type AcceptedActualLocomotion } from './SqliteActualLocomotionStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';

it('orders actual individual deadlines and atomically adopts one owned motor with longer retained peer and role authority', () => {
  const x = actualDefensiveDecisionFixture();
  try {
    x.plans.accept(x.planSource.sourceId); let decision = x.decisions.accept(x.decisionSource.sourceId);
    const due = decision.receipt.scheduling, batter = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId;
    const commands = x.fieldSource.commands.map(c => ({ ...c, bodyAcceleration: { x: 0.02, y: c.playerId === batter ? 0.04 : 0, z: 0.01 },
      primitiveMotions: c.primitiveMotions.map((p, i) => ({ ...p, offsetAcceleration: { x: 0.001 * (i + 1), y: -0.002 * (i + 1), z: 0.003 * (i + 1) } })) }));
    const bootstrap: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'lifecycle-bootstrap', action: { kind: 'motion_checkpoint_v1',
      availableAtTick: x.fieldSource.availableAtTick, checkpointThroughTick: due.decisionTick - 1, coverageThroughTick: due.movementStartTick + 1000, commands } };
    x.sources.set(bootstrap.sourceId, bootstrap); let current = x.executions.accept(bootstrap.sourceId);
    const prefix = () => ({ baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField),
      executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, current.source.sourceId) });
    let motor: ReturnType<ReturnType<typeof openSqliteActualLocomotionStore>['accept']> | null = null;
    const action = (checkpointThroughTick: number, useMotor = false) => {
      const p = prefix(), selves = commands.map(c => actualPlayerKinematicsFromPrefix(c.playerId, p));
      return { kind: 'owned_motion_v1' as const, checkpointThroughTick,
        contributions: selves.map(s => useMotor && s.playerId === 'p2' ? { kind: 'motor' as const, playerId: s.playerId, motorSourceId: motor!.source.sourceId }
          : { kind: 'retained' as const, playerId: s.playerId, command: s.activeCommand }),
        knownWork: selves.map(s => ({ playerId: s.playerId, decisionSourceId: s.playerId === 'p2' ? decision.source.sourceId : null,
          motorSourceId: s.playerId === 'p2' ? motor?.source.sourceId ?? null : null })) };
    };
    const advance = (sourceId: string, checkpoint: number, useMotor = false) => {
      const source: AcceptedBattedWorldFieldExecution = { ...bootstrap, sourceId, previousExecutionSourceId: current.source.sourceId, action: action(checkpoint, useMotor) };
      x.sources.set(sourceId, source); current = x.executions.accept(sourceId); return current;
    };
    let observationSourceId = x.observationSource.sourceId;
    const observeAndRevise = (suffix: string) => {
      const observation = { ...x.observationSource, sourceId: `lifecycle-observation-${suffix}`, previousObservationSourceId: observationSourceId,
        executionSourceId: current.source.sourceId };
      x.observationSources.set(observation.sourceId, observation); x.observations.accept(observation.sourceId); observationSourceId = observation.sourceId;
      const source = { ...x.decisionSource, sourceId: `lifecycle-decision-${suffix}`, previousDecisionSourceId: decision.source.sourceId,
        observationSourceId: observation.sourceId };
      x.decisionSources.set(source.sourceId, source); decision = x.decisions.accept(source.sourceId);
    };
    const boundary = advance('lifecycle-at-decision', due.movementStartTick + 100);
    expect(boundary.execution.field.motion.world.moment.elapsedSeconds).toBe((due.decisionTick - decision.receipt.availability.originTick) / decision.receipt.ticksPerSecond);
    expect(boundary.execution).toMatchObject({ liveWork: { unresolvedSuccessor: 'actual_defensive_decision_owner',
      pendingDecisionHandoffs: [{ playerId: 'p2', decisionSourceId: decision.source.sourceId, kind: 'decision_revision', status: 'pending' }] } });
    expect(() => advance('skip-owned-decision', due.movementStartTick + 100)).toThrow(/due decision/);
    observeAndRevise('decision'); expect(decision.receipt.lifecycle.status).toBe('pending_first_step');
    const firstStepBoundary = advance('lifecycle-at-motor', due.movementStartTick + 100);
    expect(firstStepBoundary.execution).toMatchObject({ liveWork: { unresolvedSuccessor: 'actual_defensive_decision_owner',
      pendingDecisionHandoffs: [{ playerId: 'p2', decisionSourceId: decision.source.sourceId, kind: 'first_step_revision', status: 'pending' }] } });
    expect(() => advance('skip-owned-first-step', due.movementStartTick + 100)).toThrow(/due decision/);
    observeAndRevise('motor'); expect(decision.receipt.lifecycle.status).toBe('issued');
    expect(() => advance('skip-owned-issuance', due.movementStartTick + 100)).toThrow(/awaits motor/);
    const f = x.observationModel.fieldingModel;
    const modelSource = { sourceId: 'lifecycle-locomotion-model', sourceVersion: 'synthetic-v1', capability: 'defender_locomotion_v1' as const,
      careerId: f.source.careerId, playerId: 'p2', personLinkSourceId: f.source.personLinkSourceId, fieldingModelSourceId: f.source.sourceId,
      acceptedAtDay: f.source.acceptedAtDay, calibration: playerLocomotionCalibrationFixture() };
    x.f.track(openSqlitePlayerLocomotionModelStore(x.f.path, { readAcceptedModel: () => modelSource })).accept(modelSource.sourceId);
    const motorSource: AcceptedActualLocomotion = { sourceId: 'lifecycle-motor', sourceVersion: 'synthetic-v1', capability: 'initial_defender_step_v1',
      physicalPitchSourceId: decision.source.physicalPitchSourceId, playerId: 'p2', decisionSourceId: decision.source.sourceId,
      locomotionModelSourceId: modelSource.sourceId, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: current.source.sourceId };
    const motors = x.f.track(openSqliteActualLocomotionStore(x.f.path, { readAcceptedLocomotion: () => motorSource }));
    motor = motors.accept(motorSource.sourceId);
    const beforePrefix = prefix(), before = commands.map(c => actualPlayerKinematicsFromPrefix(c.playerId, beforePrefix));
    expect(before.find(s => s.playerId === batter)!.root.velocity.y).not.toBe(0);
    const archive = x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').all();
    expect(() => advance('omit-due-motor', due.movementStartTick + 5)).toThrow(/due motor/);
    const adopted = advance('lifecycle-adopt-motor', due.movementStartTick + 5, true);
    if (adopted.execution.kind !== 'owned_motion_v1') throw new Error('missing owned motion');
    expect(adopted.execution.composition.mode).toBe('rebase');
    expect(adopted.execution.adoption.contributors.filter(c => c.motorAdoptionEventId !== null)).toHaveLength(1);
    expect(adopted.execution.adoption.acceptedCoverageThroughTick).toBe(due.movementStartTick + 10);
    expect(adopted.execution.composition.contributors.filter(c => c.playerId !== 'p2').every(c => c.coverageThroughTick === due.movementStartTick + 1000)).toBe(true);
    expect(adopted.execution.composition.contributors.every(c => c.retainedRoles.every(p => p.acceptedThroughTick === due.movementStartTick + 1000))).toBe(true);
    const afterPrefix = prefix();
    for (const old of before) {
      const now = actualPlayerKinematicsFromPrefix(old.playerId, afterPrefix);
      expect(now.root.acceleration).toEqual(old.playerId === 'p2' ? motor.receipt.command.bodyAcceleration : old.root.acceleration);
      expect(now.roles.map(p => p.relativeAcceleration)).toEqual(old.roles.map(p => p.relativeAcceleration));
      expect(now.ownedMotionCoverage?.physicalThroughTick).toBe(due.movementStartTick + 10);
      expect(now.ownedMotionCoverage?.roleAuthorities.every(p => p.acceptedThroughTick === due.movementStartTick + 1000)).toBe(true);
      if (old.playerId !== 'p2') expect(now.ownedMotionCoverage?.rootAuthority.acceptedThroughTick).toBe(due.movementStartTick + 1000);
    }
    expect(motors.read(motor.source.sourceId)).toEqual(motor);
    expect(motor.receipt.lifecycle).toEqual({ status: 'adoption_pending', executedThrough: null });
    expect(x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').all()).toEqual(archive);
    expect(wholePlayPhysicalHistoryFromPrefix(prefix()).horizon).toEqual(adopted.execution.field.motion.world.moment);
    expect(() => advance('duplicate-motor-adoption', due.movementStartTick + 9, true)).toThrow();
    advance('lifecycle-retained-tail', due.movementStartTick + 1000);
    if (current.execution.kind !== 'owned_motion_v1') throw new Error('missing coverage handoff');
    expect(current.execution.adoption.status).toBe('coverage_exhausted');
    expect(current.execution.adoption.executedThrough.tick).toBe(due.movementStartTick + 10);
    expect(() => advance('invented-root-renewal', due.movementStartTick + 11)).toThrow(/coverage exhausted/);
  } finally { x.f.close(); }
});

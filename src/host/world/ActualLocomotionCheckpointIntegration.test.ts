import { expect, it } from 'vitest';
import { actualDefensiveDecisionFixture } from './ActualDefensiveDecisionFixtures.test-support';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { openSqlitePlayerLocomotionModelStore } from './SqlitePlayerLocomotionModelStore';
import { openSqliteActualLocomotionStore, type AcceptedActualLocomotion } from './SqliteActualLocomotionStore';
import type { AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('binds an ordinary contact-free issued decision to a first motor receipt without exhausting or renewing retained role coverage', () => {
  const x = actualDefensiveDecisionFixture();
  try {
    x.plans.accept(x.planSource.sourceId); const pending = x.decisions.accept(x.decisionSource.sourceId), due = pending.receipt.scheduling;
    const commands = x.fieldSource.commands.map(c => c.playerId !== 'p2' ? c : { ...c, bodyAcceleration: { x: 0.2, y: 0, z: 0.1 },
      primitiveMotions: c.primitiveMotions.map(p => ({ ...p, offsetAcceleration: { x: 0.1, y: 0.2, z: -0.3 } })) });
    const first: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'motor-owned-coverage', action: {
      kind: 'motion_checkpoint_v1', availableAtTick: x.fieldSource.availableAtTick, checkpointThroughTick: due.decisionTick,
      coverageThroughTick: due.movementStartTick + 1000, commands } };
    x.sources.set(first.sourceId, first); const initial = x.executions.accept(first.sourceId);
    expect(initial.execution.field.motion.world.kind).not.toBe('boundary');
    const next: AcceptedBattedWorldFieldExecution = { ...first, sourceId: 'motor-due-retained-checkpoint', previousExecutionSourceId: first.sourceId,
      action: { kind: 'retained_motion_checkpoint_v1', checkpointThroughTick: due.movementStartTick } };
    x.sources.set(next.sourceId, next); const executed = x.executions.accept(next.sourceId);
    expect(executed.execution.field.motion.world.kind).not.toBe('boundary');
    expect(executed.execution.field.motion.actors).toEqual(initial.execution.field.motion.actors);
    const obs = { ...x.observationSource, sourceId: 'motor-due-observation', previousObservationSourceId: x.observationSource.sourceId,
      executionSourceId: next.sourceId };
    x.observationSources.set(obs.sourceId, obs); x.observations.accept(obs.sourceId);
    const decisionSource = { ...x.decisionSource, sourceId: 'motor-due-issued-decision', observationSourceId: obs.sourceId,
      previousDecisionSourceId: pending.source.sourceId };
    x.decisionSources.set(decisionSource.sourceId, decisionSource); const issued = x.decisions.accept(decisionSource.sourceId);
    expect(issued.receipt.lifecycle.status).toBe('issued'); expect(issued.receipt.target).toEqual(pending.receipt.target);
    const fielding = x.observationModel.fieldingModel;
    const modelSource = { sourceId: 'ordinary-motor-model', sourceVersion: 'synthetic-v1', capability: 'defender_locomotion_v1' as const,
      careerId: fielding.source.careerId, playerId: 'p2', personLinkSourceId: fielding.source.personLinkSourceId,
      fieldingModelSourceId: fielding.source.sourceId, acceptedAtDay: fielding.source.acceptedAtDay, calibration: playerLocomotionCalibrationFixture() };
    x.f.track(openSqlitePlayerLocomotionModelStore(x.f.path, { readAcceptedModel: () => modelSource })).accept(modelSource.sourceId);
    const source: AcceptedActualLocomotion = { sourceId: 'ordinary-owned-motor', sourceVersion: 'synthetic-v1', capability: 'initial_defender_step_v1',
      physicalPitchSourceId: issued.source.physicalPitchSourceId, playerId: 'p2', decisionSourceId: issued.source.sourceId,
      locomotionModelSourceId: modelSource.sourceId, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: next.sourceId };
    const store = x.f.track(openSqliteActualLocomotionStore(x.f.path, { readAcceptedLocomotion: () => source }));
    const archives = x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    const value = store.accept(source.sourceId), r = value.receipt;
    expect(r.startAt).toEqual(issued.receipt.lifecycle.issuedAt);
    expect(r.startAt.elapsedSeconds).toBe((due.movementStartTick - r.startAt.originTick) / r.self.ticksPerSecond);
    expect(r.segment.startTick).toBe(due.movementStartTick); expect(r.coverageEndTick).toBe(due.movementStartTick + 10);
    expect(r.physicalAvailability).toMatchObject({ status: 'unblocked_at_original_cut', lastPhysicalSourceId: next.sourceId, at: r.startAt });
    expect(r.self.activeCommand).toMatchObject({ sourceId: first.sourceId, acceptedThroughTick: due.movementStartTick + 1000 });
    expect(r.retainedRoles.every(p => p.command.sourceId === first.sourceId && p.acceptedThroughTick === due.movementStartTick + 1000)).toBe(true);
    expect(r.command.primitiveMotions).toEqual(commands.find(c => c.playerId === 'p2')!.primitiveMotions);
    expect(r.self.roles.map(p => p.canonicalActor)).toEqual(executed.execution.field.motion.actors.filter(a => a.playerId === 'p2'));
    expect(r.lifecycle).toEqual({ status: 'adoption_pending', executedThrough: null });
    expect(value.originDecisionHash).toBe(actorHash(pending)); expect(value.decisionHash).toBe(actorHash(issued));
    expect(value.originDecisionHash).not.toBe(value.decisionHash);
    expect(store.read(source.sourceId)).toEqual(value);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all()).toEqual(archives);
  } finally { x.f.close(); }
});

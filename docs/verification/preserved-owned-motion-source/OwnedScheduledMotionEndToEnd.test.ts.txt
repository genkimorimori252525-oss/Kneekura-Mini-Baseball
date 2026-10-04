import { expect, it } from 'vitest';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { installOwnedScheduledDecision } from './OwnedScheduledMotionDecisionFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { ownedScheduledMotionActualState } from './OwnedScheduledMotionState';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';

it('owns the real ten-Player chain through independently due motors during damping and transfer without reissuing either', () => {
  // These explicit synthetic source values define this proof only. A real 1-second
  // initial segment covers the operation; checkpoints never lengthen it.
  const x = ownedScheduledMotionFixture(undefined, 1000, 5000);
  try {
    const origin = x.baseField.response.touch.worldContact.flight.flight.initialBall.tick;
    const tps = x.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
    expect(x.baseField.field.motion.world.kind).not.toBe('boundary');
    const bootstrap: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'scheduled-bootstrap', action: { kind: 'motion_checkpoint_v1',
      availableAtTick: x.baseField.field.motion.world.moment.ball.tick, coverageThroughTick: origin + 2_000_000,
      checkpointThroughTick: origin + 6000, commands: x.fieldSource.commands } };
    x.sources.set(bootstrap.sourceId, bootstrap); let current = x.executions.accept(bootstrap.sourceId);
    current = x.step('scheduled-owned-opt-in', current.source.sourceId, { kind: 'motion', throughTick: origin + 8000 });
    const archiveRows = x.f.db.prepare('SELECT source_id,source_json,source_hash,snapshot_json,snapshot_hash FROM batted_world_field_executions ORDER BY revision').all();
    current = x.step('scheduled-actual-candidate', current.source.sourceId, { kind: 'motion', throughTick: origin + 20_000 });
    expect(current.execution.field.motion.response.kind).toBe('capture_candidate');
    const capture = x.plan('scheduled-capture-plan', current.source.sourceId);
    if (capture.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('capture plan');
    const capturePlan = capture.execution.plan;
    current = x.step('scheduled-constraint', capture.source.sourceId,
      { kind: 'operation', planSourceId: capture.source.sourceId, throughElapsedSeconds: capturePlan.contactMoment.elapsedSeconds });
    const peers = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.defenderBindings
      .map(b => b.playerId).filter(id => id !== capturePlan.acquirerPlayerId);
    const damping = installOwnedScheduledDecision(x, peers[0], current.source.sourceId, 100, 1_000_000);
    const captureDeadline = damping.decision.receipt.scheduling.decisionTick;
    expect((captureDeadline - origin) / tps).toBeLessThan(capturePlan.secureElapsedSeconds);
    current = x.step('scheduled-damping-due', current.source.sourceId,
      { kind: 'operation', planSourceId: capture.source.sourceId, throughElapsedSeconds: capturePlan.fenceElapsedSeconds });
    if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'acquisition') throw new Error('capture progress');
    expect(current.execution.adoption.executedThrough).toEqual({ originTick: origin, elapsedSeconds: (captureDeadline - origin) / tps, tick: captureDeadline });
    expect(current.execution.operation.progress.kind).toBe('capturing');
    expect(current.execution.liveWork.pendingDecisionHandoffs).toMatchObject([{ playerId: peers[0], status: 'pending' }]);
    expect(() => x.step('scheduled-skip-damping-work', current.source.sourceId,
      { kind: 'operation', planSourceId: capture.source.sourceId, throughElapsedSeconds: capturePlan.fenceElapsedSeconds })).toThrow(/due decision/);
    expect(damping.revise(current.source.sourceId, 'due').receipt.lifecycle.status).toBe('issued');
    const firstMotor = damping.issue(current.source.sourceId);
    const before = x.selves(current.source.sourceId), start = current.source.sourceId;
    current = x.step('scheduled-adopt-damping-motor', current.source.sourceId,
      { kind: 'operation', planSourceId: capture.source.sourceId, throughElapsedSeconds: capturePlan.fenceElapsedSeconds }, [peers[0]]);
    if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'acquisition') throw new Error('capture progress');
    expect(current.execution.operation.plan).toEqual(capturePlan);
    expect(current.execution.operation.progress.kind).toBe('fence_pending');
    const secureMoment = current.execution.operation.progress.dissipationMoment;
    expect(secureMoment?.elapsedSeconds).toBe(capturePlan.secureElapsedSeconds);
    expect(current.execution.adoption.contributors.filter(c => c.motorAdoptionEventId !== null)).toHaveLength(1);
    expect(current.execution.adoption.predecessor.executionSourceId).toBe(start);
    const after = x.selves(current.source.sourceId);
    expect(after.flatMap(s => s.roles)).toHaveLength(50);
    for (const old of before) {
      const now = after.find(s => s.playerId === old.playerId)!;
      expect(now.roles.map(p => p.relativeAcceleration)).toEqual(old.roles.map(p => p.relativeAcceleration));
      expect(now.root.acceleration).toEqual(old.playerId === peers[0] ? firstMotor.receipt.command.bodyAcceleration : old.root.acceleration);
      expect(now.adoptions.length).toBe(old.adoptions.length + Number(old.playerId === peers[0]));
    }
    current = x.step('scheduled-confirm-capture', current.source.sourceId,
      { kind: 'operation', planSourceId: capture.source.sourceId, throughElapsedSeconds: capturePlan.fenceElapsedSeconds });
    if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'acquisition'
      || current.execution.operation.progress.kind !== 'secured') throw new Error('confirmed capture');
    expect(current.execution.operation.progress.acquisition.moment).toEqual(secureMoment);
    expect(current.execution.liveWork.operation?.handoffs.map(h => h.kind)).toEqual(['custody', 'rule_evidence']);
    const fielding = installSyntheticObservation(x, capturePlan.acquirerPlayerId, current.source.sourceId).observationModel.fieldingModel;
    const throwSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'scheduled-throw-plan', previousExecutionSourceId: current.source.sourceId,
      action: { kind: 'owned_throw_plan_v1', modelSourceId: fielding.source.sourceId, receiverPlayerId: peers[1], knownWork: x.knownWork() } };
    x.sources.set(throwSource.sourceId, throwSource); const plannedThrow = x.executions.accept(throwSource.sourceId);
    if (plannedThrow.execution.kind !== 'owned_throw_plan_v1') throw new Error('throw plan');
    const throwPlan = plannedThrow.execution.plan;
    const transfer = installOwnedScheduledDecision(x, peers[1], plannedThrow.source.sourceId, 100, 1_000_000);
    current = x.step('scheduled-transfer-due', plannedThrow.source.sourceId,
      { kind: 'operation', planSourceId: plannedThrow.source.sourceId, throughElapsedSeconds: throwPlan.releaseElapsedSeconds });
    if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'throw') throw new Error('transfer');
    expect(current.execution.operation.progress.kind).toBe('transfer');
    expect(current.execution.adoption.executedThrough.tick).toBe(transfer.decision.receipt.scheduling.decisionTick);
    expect(transfer.revise(current.source.sourceId, 'due').receipt.lifecycle.status).toBe('issued');
    const secondMotor = transfer.issue(current.source.sourceId);
    current = x.step('scheduled-adopt-transfer-motor', current.source.sourceId,
      { kind: 'operation', planSourceId: plannedThrow.source.sourceId, throughElapsedSeconds: throwPlan.releaseElapsedSeconds }, [peers[1]]);
    if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'throw'
      || current.execution.operation.progress.kind !== 'released') throw new Error('released transfer');
    expect(current.execution.operation.plan).toEqual(throwPlan);
    expect(current.execution.operation.progress.transfer).toEqual(throwPlan.transfer);
    expect(current.execution.operation.progress.seed).toEqual(throwPlan.input.seed);
    expect(current.execution.operation.progress.releaseCursor.moment.elapsedSeconds).toBe(throwPlan.releaseElapsedSeconds);
    expect(current.execution.adoption.contributors.filter(c => c.motorSourceId !== null).map(c => c.motorSourceId)).toEqual([secondMotor.source.sourceId]);
    expect(current.execution.liveWork.operation?.receipts[0].releaseCursor).toEqual(current.execution.operation.progress.releaseCursor);
    expect(current.execution.liveWork.operation?.handoffs[0].cursor).toEqual(current.execution.field.motion.cursor);
    expect(current.execution.liveWork.operation?.handoffs[0].status).toBe('pending');
    const prefix = x.prefix(current.source.sourceId), state = ownedScheduledMotionActualState(x.baseField.field, prefix.executions);
    expect(x.selves(current.source.sourceId).every(s => s.at.elapsedSeconds === state.moment.elapsedSeconds)).toBe(true);
    const history = wholePlayPhysicalHistoryFromPrefix(prefix);
    expect(history.horizon).toEqual(state.moment); expect(history.end).toEqual({ kind: 'unestablished' });
    expect(battedWorldFieldPhysicalPrefix(prefix).controlWindows.every(w => w.endElapsedSeconds <= throwPlan.releaseElapsedSeconds)).toBe(true);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_locomotion_receipts').get()!.n).toBe(2);
    expect(damping.motors.read(firstMotor.source.sourceId)).toEqual(firstMotor);
    expect(transfer.motors.read(secondMotor.source.sourceId)).toEqual(secondMotor);
    expect(x.f.db.prepare('SELECT source_id,source_json,source_hash,snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE revision<=2 ORDER BY revision').all()).toEqual(archiveRows);
    expect(x.executions.accept(current.source.sourceId)).toEqual(current);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(current.source.sourceId)).toEqual(current);
    expect(reopened.accept(current.source.sourceId)).toEqual(current);
  } finally { x.f.close(); }
});

it('leaves capture and controller work pending at genuine initial motor coverage exhaustion', () => {
  const x = ownedScheduledMotionFixture(undefined, 1000);
  try {
    const planned = x.plan('exhausted-capture-plan');
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('plan');
    const plan = planned.execution.plan, tps = x.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
    let current = x.step('exhausted-init', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.contactMoment.elapsedSeconds });
    current = x.step('exhausted-integer', current.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: (plan.contactMoment.ball.tick + 2 - plan.contactMoment.originTick) / tps });
    const peerId = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.defenderBindings
      .find(b => b.playerId !== plan.acquirerPlayerId)!.playerId;
    const decision = installOwnedScheduledDecision(x, peerId, current.source.sourceId, 0, 10), motor = decision.issue(current.source.sourceId);
    current = x.step('exhausted-motor', current.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.fenceElapsedSeconds }, [peerId]);
    if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'acquisition') throw new Error('pending capture');
    expect(current.execution.adoption.status).toBe('coverage_exhausted');
    expect(current.execution.adoption.executedThrough.tick).toBe(motor.receipt.coverageEndTick);
    expect(current.execution.operation.progress.kind).toBe('capturing');
    expect(current.execution.operation.progress.acquisition).toBeNull();
    expect(current.execution.liveWork.unresolvedSuccessor).toBe('next_owned_controller_command');
    expect(current.execution.liveWork.operation?.source).not.toHaveProperty('completion');
    expect(current.execution.liveWork.operation?.handoffs).toEqual([]);
    expect(() => x.step('expired-root-renewal', current.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.fenceElapsedSeconds })).toThrow(/coverage|covered/);
    expect(() => x.step('expired-root-reissue', current.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.fenceElapsedSeconds }, [peerId])).toThrow(/already adopted|original cut|self cut/);
    expect(x.executions.read(current.source.sourceId)).toEqual(current);
  } finally { x.f.close(); }
});

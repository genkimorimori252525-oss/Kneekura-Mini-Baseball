import { expect, it } from 'vitest';
import { ownedBattedWorldMotionFixture as fixture } from './OwnedBattedWorldMotionFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';
import { playerLocomotionCalibrationFixture } from '../../core/sim/fielding/PlayerLocomotionCalibrationFixtures.test-support';
import { openSqlitePlayerDecisionModelStore } from './SqlitePlayerDecisionModelStore';
import { openSqliteActualDefensivePlanStore } from './SqliteActualDefensivePlanStore';
import { openSqliteActualDefensiveDecisionStore } from './SqliteActualDefensiveDecisionStore';
import { openSqlitePlayerLocomotionModelStore } from './SqlitePlayerLocomotionModelStore';
import { openSqliteActualLocomotionStore, type AcceptedActualLocomotion } from './SqliteActualLocomotionStore';
import { type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import type { OwnedMotionAction } from './OwnedBattedWorldMotion';

type Fixture = ReturnType<typeof fixture>;
// Synthetic zero delays make two independently owned decisions due at the same exact
// physical cut. Each receipt is still produced by its real Native SQLite owner.
const issueDecision = (x: Fixture, playerId: string, executionSourceId: string, delayTicks = 0) => {
  const observer = installSyntheticObservation(x, playerId, executionSourceId);
  const observation = observer.observations.accept(observer.observationSource.sourceId);
  const fielding = observer.observationModel.fieldingModel, b = x.baseField.response.touch.worldContact
    .modelActorEvidence.find(a => a.binding.playerId === playerId)!.binding;
  const calibration = { ...playerDecisionCalibrationFixture(),
    decisionTimingParameters: { minimumDecisionDelayTicks: delayTicks, maximumDecisionDelayTicks: delayTicks, fixedProcessingOffsetTicks: 0 },
    firstStepTimingParameters: { minimumFirstStepDelayTicks: 0, maximumFirstStepDelayTicks: 0, fixedMotorOffsetTicks: 0 } };
  const decisionModelSource = { sourceId: `multi-decision-model-${playerId}`, sourceVersion: 'synthetic-v1', careerId: b.careerId,
    playerId, personLinkSourceId: b.personLinkSourceId, fieldingModelSourceId: fielding.source.sourceId, acceptedAtDay: b.gameDay, calibration };
  x.f.track(openSqlitePlayerDecisionModelStore(x.f.path, { readAcceptedModel: () => decisionModelSource })).accept(decisionModelSource.sourceId);
  const planSource = { sourceId: `multi-priorities-${playerId}`, sourceVersion: 'synthetic-v1', provenance: 'accepted_at_actual_observation' as const,
    physicalPitchSourceId: observation.source.physicalPitchSourceId, careerId: b.careerId, playerId, personLinkSourceId: b.personLinkSourceId,
    gameDay: b.gameDay, fieldingModelSourceId: fielding.source.sourceId, observationSourceId: observation.source.sourceId,
    priorities: { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 } };
  x.f.track(openSqliteActualDefensivePlanStore(x.f.path, { readAcceptedPlan: () => planSource })).accept(planSource.sourceId);
  const decisionSource = { sourceId: `multi-decision-${playerId}`, sourceVersion: 'synthetic-v1', physicalPitchSourceId: observation.source.physicalPitchSourceId,
    playerId, observationSourceId: observation.source.sourceId, decisionModelSourceId: decisionModelSource.sourceId,
    planSourceId: planSource.sourceId, previousDecisionSourceId: null };
  const decisions = x.f.track(openSqliteActualDefensiveDecisionStore(x.f.path, { readAcceptedDecision: () => decisionSource }));
  const decision = decisions.accept(decisionSource.sourceId);
  return { decision, fielding, b };
};
const issueInitialMotor = (x: Fixture, playerId: string, executionSourceId: string) => {
  const { decision, fielding, b } = issueDecision(x, playerId, executionSourceId);
  expect(decision.receipt.lifecycle.status).toBe('issued');
  const modelSource = { sourceId: `multi-locomotion-model-${playerId}`, sourceVersion: 'synthetic-v1', capability: 'defender_locomotion_v1' as const,
    careerId: b.careerId, playerId, personLinkSourceId: b.personLinkSourceId, fieldingModelSourceId: fielding.source.sourceId,
    acceptedAtDay: b.gameDay, calibration: playerLocomotionCalibrationFixture() };
  x.f.track(openSqlitePlayerLocomotionModelStore(x.f.path, { readAcceptedModel: () => modelSource })).accept(modelSource.sourceId);
  const motorSource: AcceptedActualLocomotion = { sourceId: `multi-motor-${playerId}`, sourceVersion: 'synthetic-v1', capability: 'initial_defender_step_v1',
    physicalPitchSourceId: decision.source.physicalPitchSourceId, playerId, decisionSourceId: decision.source.sourceId,
    locomotionModelSourceId: modelSource.sourceId, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId };
  const motors = x.f.track(openSqliteActualLocomotionStore(x.f.path, { readAcceptedLocomotion: () => motorSource }));
  const motor = motors.accept(motorSource.sourceId);
  return { decision, motor, motors };
};

const selvesAt = (x: Fixture, executionSourceId: string) => {
  const prefix = x.prefix(executionSourceId);
  return x.fieldSource.commands.map(c => actualPlayerKinematicsFromPrefix(c.playerId, prefix));
};
const sourceFor = (x: Fixture, sourceId: string, previousExecutionSourceId: string, checkpointThroughTick: number,
  selves: ReturnType<typeof selvesAt>, known: readonly ReturnType<typeof issueInitialMotor>[], selected: readonly string[]) => {
  const action: OwnedMotionAction = { kind: 'owned_motion_v1', checkpointThroughTick,
    contributions: selves.map(s => selected.includes(s.playerId)
      ? { kind: 'motor', playerId: s.playerId, motorSourceId: known.find(k => k.motor.source.playerId === s.playerId)!.motor.source.sourceId }
      : { kind: 'retained', playerId: s.playerId, command: s.activeCommand }),
    knownWork: selves.map(s => {
      const work = known.find(k => k.motor.source.playerId === s.playerId);
      return { playerId: s.playerId, decisionSourceId: work?.decision.source.sourceId ?? null, motorSourceId: work?.motor.source.sourceId ?? null };
    }) };
  const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId, previousExecutionSourceId, action };
  x.sources.set(sourceId, source);
  return source;
};

it('requires simultaneous due motors to be adopted together while retaining all eight peers and fifty role accelerations', () => {
  const x = fixture();
  try {
    const peerId = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!
      .defenderBindings.find(b => b.playerId !== 'p2')!.playerId;
    const p2 = issueInitialMotor(x, 'p2', x.first.source.sourceId), peer = issueInitialMotor(x, peerId, x.first.source.sourceId);
    expect(p2.motor.receipt.startAt).toEqual(peer.motor.receipt.startAt);
    expect(p2.decision.receipt.lifecycle.issuedAt).toEqual(peer.decision.receipt.lifecycle.issuedAt);
    const before = selvesAt(x, x.first.source.sourceId), checkpoint = p2.motor.receipt.startAt.tick + 5;
    expect(before).toHaveLength(10);
    expect(before.find(s => s.playerId === x.batterId)?.origin.kind).toBe('batter_swing_grip');
    const physicalRows = x.f.db.prepare('SELECT * FROM batted_world_field_executions').all();
    const heads = x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
    const receipts = x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').all();
    const incomplete = sourceFor(x, 'multi-omit-peer', x.first.source.sourceId, checkpoint, before, [p2, peer], ['p2']);
    expect(() => x.executions.accept(incomplete.sourceId)).toThrow(/due motor.*atomically adopted/);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions').all()).toEqual(physicalRows);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(heads);
    const source = sourceFor(x, 'multi-adopt-both', x.first.source.sourceId, checkpoint, before, [p2, peer], ['p2', peerId]);
    const saved = x.executions.accept(source.sourceId);
    if (saved.execution.kind !== 'owned_motion_v1') throw new Error('missing simultaneous owned motion');
    const adoption = saved.execution.adoption, composition = saved.execution.composition;
    expect(composition.mode).toBe('rebase');
    expect(adoption.executedThrough.tick).toBe(checkpoint);
    const consumed = adoption.contributors.filter(c => c.motorSourceId !== null);
    expect(consumed.map(c => [c.playerId, c.motorSourceId])).toEqual([['p2', p2.motor.source.sourceId], [peerId, peer.motor.source.sourceId]]);
    expect(consumed.every(c => c.motorAdoptionEventId !== null)).toBe(true);
    expect(new Set(consumed.map(c => c.motorAdoptionEventId)).size).toBe(2);
    expect(adoption.contributors.filter(c => c.motorSourceId === null)).toHaveLength(8);
    const after = selvesAt(x, source.sourceId);
    for (const old of before) {
      const now = after.find(s => s.playerId === old.playerId)!, issued = [p2, peer].find(p => p.motor.source.playerId === old.playerId);
      expect(now.root.acceleration).toEqual(issued?.motor.receipt.command.bodyAcceleration ?? old.root.acceleration);
      expect(now.roles.map(p => p.relativeAcceleration)).toEqual(old.roles.map(p => p.relativeAcceleration));
      expect(now.ownedMotionCoverage?.roleAuthorities.every(p => p.command.sourceId === x.bootstrap.sourceId
        && p.acceptedThroughTick === x.at + 2000)).toBe(true);
      expect(now.ownedMotionCoverage?.rootAuthority.sourceId).toBe(issued?.motor.source.sourceId ?? x.bootstrap.sourceId);
      expect(now.ownedMotionCoverage?.rootAuthority.acceptedThroughTick).toBe(issued?.motor.receipt.coverageEndTick ?? x.at + 2000);
    }
    expect(x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').all()).toEqual(receipts);
    expect([p2, peer].map(p => p.motor.receipt.lifecycle)).toEqual([
      { status: 'adoption_pending', executedThrough: null }, { status: 'adoption_pending', executedThrough: null }]);
  } finally { x.f.close(); }
});

it('cuts an adopted player interval at another player\'s independent decision deadline and leaves that revision pending', () => {
  const x = fixture();
  try {
    const peerId = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!
      .defenderBindings.find(b => b.playerId !== 'p2')!.playerId;
    const p2 = issueInitialMotor(x, 'p2', x.first.source.sourceId), start = p2.motor.receipt.startAt.tick;
    const peer = issueDecision(x, peerId, x.first.source.sourceId, 2);
    expect(peer.decision.receipt.lifecycle.status).toBe('pending_decision');
    expect(peer.decision.receipt.scheduling.decisionTick).toBe(start + 2);
    const base = sourceFor(x, 'multi-independent-deadline', x.first.source.sourceId, start + 5,
      selvesAt(x, x.first.source.sourceId), [p2], ['p2']);
    if (base.action.kind !== 'owned_motion_v1') throw new Error('missing owned Source');
    const source = { ...base, action: { ...base.action, knownWork: base.action.knownWork.map(w => w.playerId === peerId
      ? { ...w, decisionSourceId: peer.decision.source.sourceId } : w) } };
    x.sources.set(source.sourceId, source);
    const saved = x.executions.accept(source.sourceId);
    if (saved.execution.kind !== 'owned_motion_v1') throw new Error('missing independent deadline adoption');
    expect(saved.execution.adoption.executedThrough.tick).toBe(start + 2);
    expect(saved.execution.adoption.acceptedCoverageThroughTick).toBe(p2.motor.receipt.coverageEndTick);
    expect(saved.execution.adoption.contributors.filter(c => c.motorAdoptionEventId !== null).map(c => c.playerId)).toEqual(['p2']);
    expect(saved.execution.liveWork).toMatchObject({ unresolvedSuccessor: 'actual_defensive_decision_owner',
      pendingDecisionHandoffs: [{ playerId: peerId, decisionSourceId: peer.decision.source.sourceId, kind: 'decision_revision', status: 'pending' }] });
    expect(saved.execution.liveWork.contributors.find(c => c.playerId === 'p2')?.unexecutedTail).not.toBeNull();
    const tail = sourceFor(x, 'multi-skip-independent-deadline', source.sourceId, start + 5,
      selvesAt(x, source.sourceId), [p2], []);
    if (tail.action.kind !== 'owned_motion_v1') throw new Error('missing retained Source');
    x.sources.set(tail.sourceId, { ...tail, action: { ...tail.action, knownWork: source.action.knownWork } });
    const rows = x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    expect(() => x.executions.accept(tail.sourceId)).toThrow(/due decision revision/);
    expect(x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all()).toEqual(rows);
  } finally { x.f.close(); }
});

it('replays a strictly earlier adoption when another player issues its initial motor at a later exact cut', () => {
  const x = fixture();
  try {
    const peerId = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!
      .defenderBindings.find(b => b.playerId !== 'p2')!.playerId;
    const p2 = issueInitialMotor(x, 'p2', x.first.source.sourceId), start = p2.motor.receipt.startAt.tick;
    const firstSource = sourceFor(x, 'multi-first-p2', x.first.source.sourceId, start + 3, selvesAt(x, x.first.source.sourceId), [p2], ['p2']);
    const first = x.executions.accept(firstSource.sourceId);
    if (first.execution.kind !== 'owned_motion_v1') throw new Error('missing first owned motion');
    const before = selvesAt(x, first.source.sourceId);
    const peer = issueInitialMotor(x, peerId, first.source.sourceId);
    expect(peer.motor.receipt.startAt.elapsedSeconds).toBeGreaterThan(p2.motor.receipt.startAt.elapsedSeconds);
    expect(peer.motor.source.executionSourceId).toBe(first.source.sourceId);
    expect(peer.motor.receipt.self.activeCommand.sourceId).toBe(first.source.sourceId);
    const receipts = x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').all();
    const secondSource = sourceFor(x, 'multi-later-peer', first.source.sourceId, start + 6, before, [p2, peer], [peerId]);
    const second = x.executions.accept(secondSource.sourceId);
    if (second.execution.kind !== 'owned_motion_v1') throw new Error('missing later owned motion');
    expect(second.execution.adoption.adoptedAt).toEqual(first.execution.adoption.executedThrough);
    expect(second.execution.adoption.executedThrough.tick).toBe(start + 6);
    expect(second.execution.adoption.acceptedCoverageThroughTick).toBe(p2.motor.receipt.coverageEndTick);
    expect(second.execution.composition.knownWork.filter(w => w.motorAdoptedPreviously).map(w => w.playerId)).toEqual(['p2']);
    expect(second.execution.adoption.contributors.filter(c => c.motorSourceId !== null).map(c => c.playerId)).toEqual([peerId]);
    const firstEvent = first.execution.adoption.contributors.find(c => c.playerId === 'p2')!.motorAdoptionEventId;
    const secondEvent = second.execution.adoption.contributors.find(c => c.playerId === peerId)!.motorAdoptionEventId;
    expect(firstEvent).not.toBeNull(); expect(secondEvent).not.toBeNull(); expect(secondEvent).not.toBe(firstEvent);
    const prefix = x.prefix(second.source.sourceId);
    expect(prefix.executions.find(v => v.source.sourceId === first.source.sourceId)).toEqual(first);
    expect(wholePlayPhysicalHistoryFromPrefix(prefix).horizon).toEqual(second.execution.field.motion.world.moment);
    const after = x.fieldSource.commands.map(c => actualPlayerKinematicsFromPrefix(c.playerId, prefix));
    for (const old of before) {
      const now = after.find(s => s.playerId === old.playerId)!;
      expect(now.root.acceleration).toEqual(old.playerId === peerId ? peer.motor.receipt.command.bodyAcceleration : old.root.acceleration);
      expect(now.ownedMotionCoverage?.roleAuthorities).toEqual(old.ownedMotionCoverage?.roleAuthorities);
      expect(now.roles.map(p => p.relativeAcceleration)).toEqual(old.roles.map(p => p.relativeAcceleration));
      if (old.playerId !== peerId) expect(now.ownedMotionCoverage?.rootAuthority).toEqual(old.ownedMotionCoverage?.rootAuthority);
    }
    expect(x.f.db.prepare('SELECT * FROM actual_locomotion_receipts').all()).toEqual(receipts);
  } finally { x.f.close(); }
});

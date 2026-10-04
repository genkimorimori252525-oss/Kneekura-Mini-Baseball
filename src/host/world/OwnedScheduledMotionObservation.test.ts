import { expect, it } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { actualBattedWorldObservationMoment } from './ActualFieldObservation';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { actualLocomotionPhysicalAvailabilityFromSqlite } from './ActualLocomotionPhysicalAvailability';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';

it('samples actual initialized constraint and admits a current motor cut without claiming custody', () => {
  const x = ownedScheduledMotionFixture();
  try {
    const planned = x.plan('observation-owned-plan');
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('fixture plan');
    const plan = planned.execution.plan, before = wholePlayPhysicalHistoryFromPrefix(x.prefix(planned.source.sourceId));
    expect(actualBattedWorldObservationMoment(before)).toBeNull();
    const cut = (id: string, playerId = x.playerIds[0]) => ({ baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: id,
      physicalPitchSourceId: x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId, playerId, mode: 'current' as const });
    const initialSelf = x.selves(planned.source.sourceId)[0];
    expect(() => actualLocomotionPhysicalAvailabilityFromSqlite(x.f.db, cut(planned.source.sourceId), initialSelf)).toThrow(/unresolved|pending/);
    const initialized = x.step('observation-owned-init', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.contactMoment.elapsedSeconds });
    const prefix = x.prefix(initialized.source.sourceId), history = wholePlayPhysicalHistoryFromPrefix(prefix);
    expect(actualBattedWorldObservationMoment(history)).toEqual(plan.initialConstraintMoment);
    expect(history.cursor).toBeNull(); expect(history.carrierPlayerId).toBeNull();
    expect(battedWorldFieldPhysicalPrefix(prefix).controlWindows).toEqual([]);
    const self = x.selves(initialized.source.sourceId).find(s => s.playerId !== plan.acquirerPlayerId && history.origin.defenderIds.includes(s.playerId))!;
    const availability = actualLocomotionPhysicalAvailabilityFromSqlite(x.f.db, cut(initialized.source.sourceId, self.playerId), self);
    expect(availability).toMatchObject({ status: 'owned_scheduled_operation_at_original_cut_v1', planSourceId: planned.source.sourceId,
      planHash: hash(plan), stepSourceId: initialized.source.sourceId, phase: 'capturing' });
    expect(availability.at).toEqual(self.at);
    expect(availability.lastPhysicalSourceId).toBe(initialized.source.sourceId);
    expect(() => actualLocomotionPhysicalAvailabilityFromSqlite(x.f.db, cut(initialized.source.sourceId, self.playerId), {
      at: { ...self.at, elapsedSeconds: self.at.elapsedSeconds + 1e-9 } })).toThrow(/cut/);
    const observation = installSyntheticObservation(x, self.playerId, initialized.source.sourceId);
    const sampled = observation.observations.accept(observation.observationSource.sourceId);
    expect(sampled.receipt.results.find(r => r.target.kind === 'ball')?.status).not.toBe('physical_state_unavailable');
    expect(sampled.receipt.at).toEqual(self.at);
  } finally { x.f.close(); }
});

import { scheduledAcquisitionHistoryFixture } from './ScheduledFieldAcquisitionHistory.test-support';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { scheduledConstraintGroundFixture } from './ScheduledFieldAcquisitionConstraint.test-support';

it('keeps legacy pending capture unavailable until its exact zero-time owned bridge is validated', () => {
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const planned = x.accept('legacy-motor-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('fixture');
    const plan = planned.execution.plan, at = plan.contactMoment.elapsedSeconds;
    const advance = x.accept('legacy-motor-advance', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: (at + planned.execution.plan.secureElapsedSeconds) / 2 });
    const playerId = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.defenderBindings.find(b => b.playerId !== plan.acquirerPlayerId)!.playerId;
    const original = JSON.stringify(advance), self = actualPlayerKinematicsFromPrefix(playerId, x.prefix());
    const cut = { baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: advance.source.sourceId,
      physicalPitchSourceId: self.physicalPitchSourceId, playerId: self.playerId, mode: 'current' as const };
    expect(() => actualLocomotionPhysicalAvailabilityFromSqlite(x.f.db, cut, self)).toThrow(/pending scheduled acquisition/);
    const bridge = x.accept('legacy-motor-bridge', { kind: 'owned_motion_v2', checkpoint: { kind: 'operation', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: self.at.elapsedSeconds }, knownWork: x.fieldSource.commands.map(c => ({ playerId: c.playerId, decisionSourceId: null, motorSourceId: null })),
      contributions: x.fieldSource.commands.map(c => ({ kind: 'retained', playerId: c.playerId,
        command: actualPlayerKinematicsFromPrefix(c.playerId, x.prefix()).activeCommand })) });
    const current = actualPlayerKinematicsFromPrefix(playerId, x.prefix());
    expect(actualLocomotionPhysicalAvailabilityFromSqlite(x.f.db, { ...cut, executionSourceId: bridge.source.sourceId }, current).at).toEqual(self.at);
    expect(current.activeCommand).toEqual(self.activeCommand);
    expect(JSON.stringify(x.executions.read(advance.source.sourceId))).toBe(original);
  } finally { x.f.close(); }
});

it('keeps a real zero-time constraint interruption unavailable and preserves its first incoming rule frame', () => {
  const x = scheduledConstraintGroundFixture();
  try {
    const prefix = () => ({ baseField: x.baseField, fields: x.ownFields, executions: x.prefix });
    const knownWork = x.baseField.source.commands.map(c => ({ playerId: c.playerId, decisionSourceId: null, motorSourceId: null }));
    const incoming = battedWorldFieldPhysicalPrefix(prefix()).field.evidence.horizon;
    const planned = x.accept('owned-constraint-plan', { kind: 'owned_acquisition_plan_v1', knownWork });
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('fixture');
    const stopped = x.accept('owned-constraint-init', { kind: 'owned_motion_v2', checkpoint: { kind: 'operation', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: incoming.elapsedSeconds }, knownWork, contributions: knownWork.map(w => ({ kind: 'retained', playerId: w.playerId,
        command: actualPlayerKinematicsFromPrefix(w.playerId, prefix()).activeCommand })) });
    if (stopped.execution.kind !== 'owned_motion_v2' || stopped.execution.operation?.kind !== 'acquisition') throw new Error('fixture');
    const op = stopped.execution.operation;
    expect(op.progress.kind).toBe('interrupted');
    expect(op.progress.world.moment.ball.velocity.y).toBe(-1);
    const physical = battedWorldFieldPhysicalPrefix(prefix()), history = wholePlayPhysicalHistoryFromPrefix(prefix());
    expect(physical.field.evidence.contacts.at(-1)?.moment).toEqual(incoming);
    expect(physical.field.evidence.contacts.at(-1)?.contacts).toEqual(expect.arrayContaining([{ kind: 'ground' },
      { kind: 'actor', playerId: op.plan.acquirerPlayerId, role: 'glove' }]));
    expect(actualBattedWorldObservationMoment(history)).toBeNull();
    expect(physical.controlWindows).toEqual([]);
    const playerId = history.origin.defenderIds.find(id => id !== op.plan.acquirerPlayerId)!;
    const self = actualPlayerKinematicsFromPrefix(playerId, prefix());
    expect(() => actualLocomotionPhysicalAvailabilityFromSqlite(x.f.db,
      { baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: stopped.source.sourceId,
        physicalPitchSourceId: self.physicalPitchSourceId, playerId: self.playerId, mode: 'current' }, self)).toThrow(/unresolved|interrupted/);
  } finally { x.f.close(); }
});

it('refuses new motor admission at expired complete physical coverage while retaining the pending operation', () => {
  const x = ownedScheduledMotionFixture(undefined, 0.0001);
  try {
    const planned = x.plan('expired-owned-plan');
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('fixture');
    const plan = planned.execution.plan;
    const initialized = x.step('expired-owned-init', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.contactMoment.elapsedSeconds });
    const exhausted = x.step('expired-owned-coverage', initialized.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.secureElapsedSeconds });
    if (exhausted.execution.kind !== 'owned_motion_v2' || exhausted.execution.operation?.kind !== 'acquisition') throw new Error('fixture');
    expect(exhausted.execution.operation.progress.kind).toBe('capturing');
    const self = x.selves(exhausted.source.sourceId)[0];
    expect(self.at.tick).toBe(exhausted.execution.composition.coverageThroughTick);
    expect(() => actualLocomotionPhysicalAvailabilityFromSqlite(x.f.db, { baseFieldSourceId: x.baseField.source.sourceId,
      executionSourceId: exhausted.source.sourceId, physicalPitchSourceId: self.physicalPitchSourceId, playerId: self.playerId, mode: 'current' }, self)).toThrow(/coverage|expired/);
    expect(wholePlayPhysicalHistoryFromPrefix(x.prefix(exhausted.source.sourceId)).end.kind).toBe('unestablished');
  } finally { x.f.close(); }
});

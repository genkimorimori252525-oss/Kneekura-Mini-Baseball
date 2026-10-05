import { expect, it, vi } from 'vitest';
import * as archive from './OwnedScheduledMotionArchive';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { scheduledAcquisitionHistoryFixture } from './ScheduledFieldAcquisitionHistory.test-support';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { actualPlayerKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { actualObservationPhysicalPrefixEvidence } from './ActualObservationPhysicalPrefixHash';
import type { OwnedScheduledMotionAction } from './OwnedScheduledBattedWorldMotion';

it('keeps owned plans metadata-only and records every actual zero-time constraint and retained capture segment', () => {
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const prefix = structuredClone(x.prefix()), before = battedWorldFieldPhysicalPrefix(prefix), prior = wholePlayPhysicalHistoryFromPrefix(prefix);
    const knownWork = x.fieldSource.commands.map(c => ({ playerId: c.playerId, decisionSourceId: null, motorSourceId: null }));
    const planned = x.accept('owned-capture-plan', { kind: 'owned_acquisition_plan_v1', knownWork });
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('owned capture plan fixture');
    const plan = planned.execution.plan;
    expect(battedWorldFieldPhysicalPrefix(x.prefix()).segments).toEqual(before.segments);
    expect(wholePlayPhysicalHistoryFromPrefix(x.prefix()).physicalSteps).toEqual(prior.physicalSteps);
    expect(actualObservationPhysicalPrefixEvidence(x.prefix()).physicalPrefixHashConvention).toBe('owned_motion_observation_prefix_manifest_v1');
    const step = (sourceId: string, throughElapsedSeconds: number) => {
      const contributions = x.fieldSource.commands.map(c => ({ kind: 'retained' as const, playerId: c.playerId,
        command: actualPlayerKinematicsFromPrefix(c.playerId, x.prefix()).activeCommand }));
      const action: OwnedScheduledMotionAction = { kind: 'owned_motion_v2', checkpoint: { kind: 'operation', planSourceId: planned.source.sourceId,
        throughElapsedSeconds }, contributions, knownWork };
      return x.accept(sourceId, action);
    };
    const initialized = step('owned-capture-init', plan.contactMoment.elapsedSeconds);
    expect(initialized.execution).toMatchObject({ kind: 'owned_motion_v2', operation: { kind: 'acquisition', progress: { kind: 'capturing' } } });
    const initial = battedWorldFieldPhysicalPrefix(x.prefix());
    expect(initial.segments).toHaveLength(before.segments.length + 1);
    expect(initial.segments.at(-1)).toMatchObject({ startElapsedSeconds: plan.contactMoment.elapsedSeconds, endElapsedSeconds: plan.contactMoment.elapsedSeconds });
    expect(initial.controlWindows).toEqual([]);
    for (const mutation of ['forward-plan', 'missing-step', 'changed-world'] as const) {
      const forged = structuredClone(x.prefix()), execution = forged.executions.at(-1)!.execution;
      if (execution.kind !== 'owned_motion_v2' || execution.operation?.kind !== 'acquisition') throw new Error('fixture');
      const operation = execution.operation;
      const changed = mutation === 'forward-plan' ? { ...operation, planSourceId: initialized.source.sourceId }
        : mutation === 'missing-step' ? { ...operation, previousSteps: [{ sourceId: 'unexecuted', sourceHash: 'none', snapshotHash: 'none' }] }
          : { ...operation, progress: { ...operation.progress, world: { ...operation.progress.world, moment: {
            ...operation.progress.world.moment, ball: { ...operation.progress.world.moment.ball, velocity: { x: 999, y: 999, z: 999 } } } } } };
      forged.executions[forged.executions.length - 1] = { ...forged.executions.at(-1)!, execution: { ...execution, operation: changed } };
      expect(() => battedWorldFieldPhysicalPrefix(forged)).toThrow();
      expect(() => wholePlayPhysicalHistoryFromPrefix(forged)).toThrow();
    }
    const observed = x.accept('owned-capture-view', { kind: 'whole_play_history' }), oldBytes = JSON.stringify(observed);
    step('owned-capture-secure', plan.secureElapsedSeconds);
    if (plan.fenceElapsedSeconds > plan.secureElapsedSeconds) step('owned-capture-confirmed', plan.fenceElapsedSeconds);
    const physical = battedWorldFieldPhysicalPrefix(x.prefix()), history = wholePlayPhysicalHistoryFromPrefix(x.prefix());
    expect(physical.controlWindows).toEqual([{ playerId: plan.acquirerPlayerId, startElapsedSeconds: plan.secureElapsedSeconds,
      endElapsedSeconds: plan.fenceElapsedSeconds, endInclusive: true }]);
    expect(history.originalTimeline).toEqual(prior.originalTimeline);
    expect(history.end).toEqual({ kind: 'unestablished' });
    expect(history.physicalSteps.filter(s => s.kind === 'owned_motion_v2')).toHaveLength(physical.segments.length - before.segments.length);
    for (const c of x.fieldSource.commands) {
      const old = actualPlayerKinematicsFromPrefix(c.playerId, prefix), current = actualPlayerKinematicsFromPrefix(c.playerId, x.prefix());
      expect(current.adoptions).toHaveLength(old.adoptions.length);
      expect(current.roles).toHaveLength(5);
      expect(current.at.elapsedSeconds).toBe(plan.fenceElapsedSeconds);
    }
    expect(JSON.stringify(x.executions.read(observed.source.sourceId))).toBe(oldBytes);
    const currentPrefix = x.prefix();
    const referenced = new Set(currentPrefix.executions.flatMap(v => v.execution.kind === 'owned_motion_v2' && v.execution.operation
      ? [v.execution.operation.planSourceId, ...v.execution.operation.previousSteps.map(s => s.sourceId)] : []));
    const digests = vi.spyOn(archive, 'ownedScheduledMotionArchiveEncoding');
    try {
      expect(battedWorldFieldPhysicalPrefix(currentPrefix)).toEqual(physical);
      expect(digests).toHaveBeenCalledTimes(referenced.size);
      expect(battedWorldFieldPhysicalPrefix(currentPrefix)).toEqual(physical);
      expect(digests).toHaveBeenCalledTimes(referenced.size * 2);
      const changed = structuredClone(currentPrefix), at = changed.executions.findIndex(v => v.execution.kind === 'owned_motion_v2');
      const firstStep = changed.executions[at];
      if (firstStep.execution.kind !== 'owned_motion_v2') throw new Error('fixture');
      // A different body reusing an earlier Source ID must not reuse its digest.
      changed.executions[at] = { ...firstStep, execution: { ...firstStep.execution,
        adoption: { ...firstStep.execution.adoption, status: 'physical_boundary' } } };
      expect(() => battedWorldFieldPhysicalPrefix(freeze(changed))).toThrow(/manifest|lineage/);
      const beforeNewCall = digests.mock.calls.length;
      expect(battedWorldFieldPhysicalPrefix(currentPrefix)).toEqual(physical);
      expect(digests).toHaveBeenCalledTimes(beforeNewCall + referenced.size);
    } finally { digests.mockRestore(); }

  } finally { x.f.close(); }
});

import { scheduledAcquisitionRaceFixture } from './ScheduledFieldAcquisitionRace.test-support';

it('keeps the owned pending first-base race unconfirmed until original secure evidence survives the fence', () => {
  const x = scheduledAcquisitionRaceFixture();
  try {
    const prefix = () => ({ baseField: x.baseField, fields: x.fieldPrefix, executions: x.executionPrefix });
    const knownWork = x.baseField.source.commands.map(c => ({ playerId: c.playerId, decisionSourceId: null, motorSourceId: null }));
    const planned = x.accept('owned-race-plan', { kind: 'owned_acquisition_plan_v1', knownWork });
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('fixture');
    const plan = planned.execution.plan;
    const step = (sourceId: string, throughElapsedSeconds: number) => x.accept(sourceId, { kind: 'owned_motion_v2',
      checkpoint: { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds }, knownWork,
      contributions: knownWork.map(w => ({ kind: 'retained', playerId: w.playerId, command: actualPlayerKinematicsFromPrefix(w.playerId, prefix()).activeCommand })) });
    step('owned-race-init', plan.contactMoment.elapsedSeconds);
    step('owned-race-secure', plan.secureElapsedSeconds);
    step('owned-race-before-fence', x.observationElapsedSeconds);
    const pending = x.accept('owned-race-pending-observer', { kind: 'first_base_race' });
    expect(pending.execution).toMatchObject({ kind: 'first_base_race', groundRule: null,
      possessionGuard: { blocked: true, earliestPotentialControlElapsedSeconds: plan.secureElapsedSeconds } });
    const pendingBytes = JSON.stringify(pending);
    step('owned-race-confirm', plan.fenceElapsedSeconds);
    const confirmed = x.accept('owned-race-confirmed-observer', { kind: 'first_base_race' });
    if (confirmed.execution.kind !== 'first_base_race') throw new Error('fixture');
    expect(confirmed.execution.groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe('out');
    expect(confirmed.execution.groundRule?.actualChronology.firstDefenderControls[0].elapsedSeconds).toBe(plan.secureElapsedSeconds);
    expect(JSON.stringify(x.executions.read(pending.source.sourceId))).toBe(pendingBytes);
    expect(wholePlayPhysicalHistoryFromPrefix(prefix()).end.kind).toBe('unestablished');
  } finally { x.f.close(); }
});

import { actualLocomotionPhysicalAvailabilityFromSqlite } from './ActualLocomotionPhysicalAvailability';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';

it('closes every prior inclusive control endpoint at the exact owned zero-delay release', () => {
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const knownWork = x.fieldSource.commands.map(c => ({ playerId: c.playerId, decisionSourceId: null, motorSourceId: null }));
    const planned = x.accept('owned-release-capture-plan', { kind: 'owned_acquisition_plan_v1', knownWork });
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('fixture');
    const capture = planned.execution.plan;
    const step = (id: string, planSourceId: string, throughElapsedSeconds: number) => x.accept(id, { kind: 'owned_motion_v2',
      checkpoint: { kind: 'operation', planSourceId, throughElapsedSeconds }, knownWork,
      contributions: knownWork.map(w => ({ kind: 'retained', playerId: w.playerId, command: actualPlayerKinematicsFromPrefix(w.playerId, x.prefix()).activeCommand })) });
    step('owned-release-init', planned.source.sourceId, capture.contactMoment.elapsedSeconds);
    let confirmed = step('owned-release-secure', planned.source.sourceId, capture.secureElapsedSeconds);
    if (capture.fenceElapsedSeconds > capture.secureElapsedSeconds) confirmed = step('owned-release-fence', planned.source.sourceId, capture.fenceElapsedSeconds);
    const fielding = installSyntheticObservation(x, capture.acquirerPlayerId, confirmed.source.sourceId, undefined, undefined,
      source => ({ ...source, transferParameters: { minimumTransferDelayTicks: 0, maximumTransferDelayTicks: 0, fixedGripOffsetTicks: 0 } })).observationModel.fieldingModel;
    const receiver = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.defenderBindings.find(b => b.playerId !== capture.acquirerPlayerId)!;
    const before = battedWorldFieldPhysicalPrefix(x.prefix());
    const throwing = x.accept('owned-release-throw-plan', { kind: 'owned_throw_plan_v1', modelSourceId: fielding.source.sourceId,
      receiverPlayerId: receiver.playerId, knownWork });
    if (throwing.execution.kind !== 'owned_throw_plan_v1') throw new Error('fixture');
    expect(throwing.execution.plan.releaseElapsedSeconds).toBe(capture.fenceElapsedSeconds);
    expect(battedWorldFieldPhysicalPrefix(x.prefix()).segments).toEqual(before.segments);
    const self = actualPlayerKinematicsFromPrefix(receiver.playerId, x.prefix());
    expect(() => actualLocomotionPhysicalAvailabilityFromSqlite(x.f.db, { baseFieldSourceId: x.baseField.source.sourceId,
      executionSourceId: throwing.source.sourceId, physicalPitchSourceId: self.physicalPitchSourceId, playerId: self.playerId, mode: 'current' }, self)).toThrow(/due|release|transition/);
    const released = step('owned-release-now', throwing.source.sourceId, throwing.execution.plan.releaseElapsedSeconds);
    if (released.execution.kind !== 'owned_motion_v2' || released.execution.operation?.kind !== 'throw'
      || released.execution.operation.progress.kind !== 'released') throw new Error('release fixture');
    const p = released.execution.operation.progress, physical = battedWorldFieldPhysicalPrefix(x.prefix());
    expect(physical.controlWindows.filter(w => w.endElapsedSeconds === capture.fenceElapsedSeconds).every(w => !w.endInclusive)).toBe(true);
    expect(physical.controlWindows[0].startElapsedSeconds).toBe(capture.secureElapsedSeconds);
    const history = wholePlayPhysicalHistoryFromPrefix(x.prefix());
    expect(history.physicalSteps.at(-1)).toMatchObject({ kind: 'owned_motion_v2', operation: { kind: 'throw', progress: { releaseCursor: p.releaseCursor } } });
    expect(history.cursor).toEqual(p.field.motion.cursor);
    expect(history.carrierPlayerId).toBeNull(); expect(history.end.kind).toBe('unestablished');
    expect(history.frames.at(-1)!.occurrences.map(o => o.phase)).toEqual(expect.arrayContaining(['acquisition_confirmed', 'throw_release']));
  } finally { x.f.close(); }
});

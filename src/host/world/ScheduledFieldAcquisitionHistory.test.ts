import { expect, it } from 'vitest';
import { scheduledAcquisitionHistoryFixture } from './ScheduledFieldAcquisitionHistory.test-support';
import { battedWorldFieldPhysicalPrefix, battedWorldFieldBaseTouchHistoryFromPrefix } from './BattedWorldFieldPhysicalPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';

it('records only executed capture deltas and confirms original secure evidence at the current fence', () => {
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const before = battedWorldFieldPhysicalPrefix(x.prefix()), beforeHistory = wholePlayPhysicalHistoryFromPrefix(x.prefix());
    const planned = x.accept('history-capture-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('capture plan fixture');
    const plan = planned.execution.plan, admitted = battedWorldFieldPhysicalPrefix(x.prefix());
    expect(admitted.segments).toEqual(before.segments);
    expect(admitted.field).toEqual(before.field);
    expect(admitted.controlWindows).toEqual([]);
    expect(admitted.possessionEvidence?.pending).toEqual([{ planSourceId: planned.source.sourceId, playerId: plan.acquirerPlayerId,
      contactElapsedSeconds: plan.contactMoment.elapsedSeconds, phase: 'capturing', earliestPotentialControlElapsedSeconds: plan.secureElapsedSeconds }]);
    const history = wholePlayPhysicalHistoryFromPrefix(x.prefix());
    expect(history.frames).toEqual(beforeHistory.frames);
    expect(history.physicalSteps).toEqual(beforeHistory.physicalSteps);
    expect(history.scheduledAcquisitionPlans).toHaveLength(1);
    const initialView = x.accept('history-capture-admitted-view', { kind: 'whole_play_history' });
    expect(initialView.execution).toMatchObject({ kind: 'whole_play_history', physicalHistory: history });
    const firstAt = plan.contactMoment.elapsedSeconds + (plan.secureElapsedSeconds - plan.contactMoment.elapsedSeconds) / 2;
    const first = x.accept('history-capture-first', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId, throughElapsedSeconds: firstAt });
    expect(first.execution).toMatchObject({ kind: 'acquisition_advance', progress: { kind: 'capturing', cursor: null, acquisition: null } });
    const partial = battedWorldFieldPhysicalPrefix(x.prefix());
    expect(partial.segments.slice(0, -1)).toEqual(before.segments);
    expect(partial.segments.at(-1)).toMatchObject({ startElapsedSeconds: plan.contactMoment.elapsedSeconds, endElapsedSeconds: firstAt });
    expect(partial.field.evidence.acquisitions).toEqual([]);
    expect(partial.controlWindows).toEqual([]);
    const base = x.baseField.geometry.geometry.baseGeometry.bases.first;
    const baseInput = { ...x.prefix(), playerId: plan.acquirerPlayerId, base: base.region, baseSurfaceHeightMeters: base.surfaceHeightMeters };
    const bounded = battedWorldFieldBaseTouchHistoryFromPrefix(baseInput);
    expect(bounded.custodyEvidence?.status).toBe('bounded_unconfirmed');
    expect(bounded.controlledContacts).toEqual([]);
    const pendingView = x.accept('history-capture-pending-view', { kind: 'whole_play_history' });
    const pendingBytes = JSON.stringify(pendingView);
    const fencePending = x.accept('history-capture-fence-pending', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: plan.secureElapsedSeconds });
    expect(fencePending.execution).toMatchObject({ kind: 'acquisition_advance', progress: { kind: 'fence_pending', cursor: null, transport: { remainingEnergyJ: 0 } } });
    expect(battedWorldFieldPhysicalPrefix(x.prefix()).controlWindows).toEqual([]);
    const reached = wholePlayPhysicalHistoryFromPrefix(x.prefix());
    expect(reached.frames.flatMap((frame) => frame.occurrences).filter((o) => o.phase === 'acquisition_dissipation_complete')).toHaveLength(1);
    const confirmed = x.accept('history-capture-confirmed', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: plan.fenceElapsedSeconds });
    if (confirmed.execution.kind !== 'acquisition_advance' || confirmed.execution.progress.kind !== 'secured') throw new Error('confirmed fixture');
    const finalPrefix = battedWorldFieldPhysicalPrefix(x.prefix()), finalHistory = wholePlayPhysicalHistoryFromPrefix(x.prefix());
    expect(finalPrefix.field.evidence.horizon.elapsedSeconds).toBe(plan.fenceElapsedSeconds);
    expect(finalPrefix.field.evidence.acquisitions).toEqual([confirmed.execution.progress.acquisition]);
    expect(finalPrefix.field.evidence.contacts).toEqual(before.field.evidence.contacts);
    expect(finalPrefix.field.evidence.acquisitions[0].contactMoment).toEqual(plan.contactMoment);
    expect(finalPrefix.controlWindows).toEqual([{ playerId: plan.acquirerPlayerId, startElapsedSeconds: plan.secureElapsedSeconds,
      endElapsedSeconds: plan.fenceElapsedSeconds, endInclusive: true }]);
    expect(finalPrefix.possessionEvidence?.pending).toEqual([]);
    expect(finalHistory.cursor).toEqual(confirmed.execution.progress.cursor);
    expect(finalHistory.cursor?.moment.elapsedSeconds).toBe(plan.fenceElapsedSeconds);
    expect(finalHistory.frames.flatMap((frame) => frame.occurrences).filter((o) => o.phase === 'acquisition_dissipation_complete')).toHaveLength(1);
    expect(finalHistory.frames.at(-1)?.occurrences.map((o) => o.phase)).toEqual(['acquisition_confirmed']);
    expect(finalHistory.end).toEqual({ kind: 'unestablished' });
    expect(finalHistory.originalTimeline.events.some((event) => event.kind === 'LiveBallPlayEnded')).toBe(false);
    expect(JSON.stringify(x.executions.read(pendingView.source.sourceId))).toBe(pendingBytes);
  } finally { x.f.close(); }
});

it('samples bounded constrained capture despite null custody and preserves the earlier immutable receipt', () => {
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const planned = x.accept('observe-capture-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('capture plan fixture');
    const plan = planned.execution.plan;
    const partial = x.accept('observe-capture-partial', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: plan.contactMoment.elapsedSeconds + (plan.secureElapsedSeconds - plan.contactMoment.elapsedSeconds) / 2 });
    const observation = installSyntheticObservation(x, plan.acquirerPlayerId, partial.source.sourceId);
    const sampled = observation.observations.accept(observation.observationSource.sourceId), bytes = JSON.stringify(sampled);
    expect(sampled.receipt.at.elapsedSeconds).toBe(wholePlayPhysicalHistoryFromPrefix(x.prefix()).horizon.elapsedSeconds);
    expect(sampled.receipt.results.find((r) => r.target.kind === 'ball')?.status).not.toBe('physical_state_unavailable');
    expect(wholePlayPhysicalHistoryFromPrefix(x.prefix()).cursor).toBeNull();
    x.accept('observe-capture-secured', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.fenceElapsedSeconds });
    expect(JSON.stringify(observation.observations.read(observation.observationSource.sourceId))).toBe(bytes);
    expect(sampled.receipt.at.elapsedSeconds).toBeLessThan(plan.secureElapsedSeconds);
  } finally { x.f.close(); }
});

it('starts an immediate scheduled throw at the fence and closes capture custody at that exact release endpoint', async () => {
  const { openSqlitePlayerFieldingModelStore } = await import('./SqlitePlayerFieldingModelStore');
  const x = scheduledAcquisitionHistoryFixture();
  try {
    const planned = x.accept('release-capture-plan', { kind: 'acquisition_plan' });
    if (planned.execution.kind !== 'acquisition_plan') throw new Error('capture plan fixture');
    const plan = planned.execution.plan;
    const confirmed = x.accept('release-capture-secured', { kind: 'acquisition_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: plan.fenceElapsedSeconds });
    if (confirmed.execution.kind !== 'acquisition_advance' || confirmed.execution.progress.kind !== 'secured') throw new Error('secured fixture');
    const actor = x.baseField.response.touch.worldContact.modelActorEvidence.find((value) => value.binding.playerId === plan.acquirerPlayerId)!;
    const receiver = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.defenderBindings.find((binding) => binding.playerId !== plan.acquirerPlayerId)!;
    const modelSource = { sourceId: 'release-capture-model', sourceVersion: 'synthetic-v1', careerId: actor.binding.careerId,
      playerId: actor.binding.playerId, personLinkSourceId: actor.binding.personLinkSourceId, acceptedAtDay: actor.binding.gameDay,
      ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
        firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
        armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
      transferParameters: { minimumTransferDelayTicks: 0, maximumTransferDelayTicks: 0, fixedGripOffsetTicks: 0 },
      throwCalibration: { minimumReleaseSpeedMps: 20, maximumReleaseSpeedMps: 20, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 0 } };
    const models = x.f.track(openSqlitePlayerFieldingModelStore(x.f.path, { readAcceptedModel: () => modelSource }));
    models.accept(modelSource.sourceId);
    const throwing = x.accept('release-capture-throw-plan', { kind: 'throw_plan', modelSourceId: modelSource.sourceId,
      receiverPlayerId: receiver.playerId, availableAtTick: confirmed.execution.progress.cursor.moment.ball.tick,
      throughTick: confirmed.execution.progress.cursor.moment.ball.tick + 1000, commands: x.fieldSource.commands });
    if (throwing.execution.kind !== 'throw_plan') throw new Error('throw plan fixture');
    expect(throwing.execution.plan.input.cursor).toEqual(confirmed.execution.progress.cursor);
    expect(throwing.execution.plan.releaseElapsedSeconds).toBe(plan.fenceElapsedSeconds);
    const released = x.accept('release-capture-throw-release', { kind: 'throw_advance', planSourceId: throwing.source.sourceId,
      throughElapsedSeconds: plan.fenceElapsedSeconds });
    expect(released.execution).toMatchObject({ kind: 'throw_advance', progress: { kind: 'released' } });
    const actual = battedWorldFieldPhysicalPrefix(x.prefix()), history = wholePlayPhysicalHistoryFromPrefix(x.prefix());
    expect(actual.controlWindows[0]).toEqual({ playerId: plan.acquirerPlayerId, startElapsedSeconds: plan.secureElapsedSeconds,
      endElapsedSeconds: plan.fenceElapsedSeconds, endInclusive: false });
    expect(actual.controlWindows.filter((window) => window.endElapsedSeconds === plan.fenceElapsedSeconds).every((window) => !window.endInclusive)).toBe(true);
    expect(history.horizon.elapsedSeconds).toBe(plan.fenceElapsedSeconds);
    expect(history.carrierPlayerId).toBeNull();
    expect(history.frames.at(-1)?.occurrences.map((o) => o.phase)).toContain('throw_release');
    expect(history.end.kind).toBe('unestablished');
  } finally { x.f.close(); }
});

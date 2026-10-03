import { expect, it } from 'vitest';
import { battedWorldFieldThrowFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import type { AcceptedBattedWorldFieldExecution, DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('observes admitted and partially executed throws without advancing time or duplicating custody and actor spans', () => {
  const x = battedWorldFieldThrowFixture();
  try {
    if (x.source.action.kind !== 'throw') throw new Error('throw fixture');
    const plannedSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'history-throw-plan',
      action: { ...x.source.action, kind: 'throw_plan' } };
    x.sources.set(plannedSource.sourceId, plannedSource);
    const planned = x.executions.accept(plannedSource.sourceId);
    if (planned.execution.kind !== 'throw_plan') throw new Error('throw plan fixture');
    const plan = planned.execution.plan, executions: DurableBattedWorldFieldExecution[] = [x.acquired];
    const prefix = () => ({ baseField: x.baseField, fields: [x.baseField], executions });
    const before = battedWorldFieldPhysicalPrefix(prefix()), oldHistory = wholePlayPhysicalHistoryFromPrefix(prefix());
    executions.push(planned);
    expect(battedWorldFieldPhysicalPrefix(prefix())).toEqual(before);
    const admittedHistory = wholePlayPhysicalHistoryFromPrefix(prefix());
    expect(admittedHistory.physicalSteps).toEqual(oldHistory.physicalSteps);
    expect(admittedHistory.frames).toEqual(oldHistory.frames);
    expect(admittedHistory.scheduledThrowPlans).toHaveLength(1);
    const accept = (sourceId: string, action: AcceptedBattedWorldFieldExecution['action']) => {
      const source = { ...plannedSource, sourceId, previousExecutionSourceId: executions.at(-1)!.source.sourceId, action };
      x.sources.set(sourceId, source); const result = x.executions.accept(sourceId); executions.push(result); return result;
    };
    const admissionView = accept('history-plan-view', { kind: 'whole_play_history' });
    if (admissionView.execution.kind !== 'whole_play_history') throw new Error('admission view fixture');
    expect(admissionView.execution.physicalHistory).toEqual(admittedHistory);
    expect(battedWorldFieldPhysicalPrefix(prefix())).toEqual(before);
    const start = plan.input.cursor.moment.elapsedSeconds, checkpoint = start + (plan.releaseElapsedSeconds - start) / 2;
    const first = accept('history-throw-first', { kind: 'throw_advance', planSourceId: plannedSource.sourceId, throughElapsedSeconds: checkpoint });
    if (first.execution.kind !== 'throw_advance') throw new Error('first advance fixture');
    expect(first.execution.progress.kind).toBe('transfer');
    const progressPrefix = battedWorldFieldPhysicalPrefix(prefix());
    expect(progressPrefix.field.evidence.horizon.elapsedSeconds).toBe(checkpoint);
    expect(progressPrefix.segments.slice(0, -1)).toEqual(before.segments);
    expect(progressPrefix.segments.at(-1)).toMatchObject({ startElapsedSeconds: start, endElapsedSeconds: checkpoint });
    expect(progressPrefix.controlWindows.at(-1)).toEqual({ playerId: plan.input.carrierPlayerId,
      startElapsedSeconds: start, endElapsedSeconds: checkpoint, endInclusive: true });
    const race = accept('history-transfer-race', { kind: 'first_base_race' });
    expect(race.execution.kind).toBe('first_base_race');
    expect(battedWorldFieldPhysicalPrefix(prefix())).toEqual(progressPrefix);
    const transferView = accept('history-transfer-view', { kind: 'whole_play_history' });
    if (transferView.execution.kind !== 'whole_play_history') throw new Error('transfer view fixture');
    expect(transferView.execution.physicalHistory.horizon.elapsedSeconds).toBe(checkpoint);
    expect(transferView.execution.physicalHistory.physicalSteps.map((step) => step.kind)).toEqual(['motion', 'acquisition', 'throw_advance']);
    const release = accept('history-throw-release', { kind: 'throw_advance', planSourceId: plannedSource.sourceId,
      throughElapsedSeconds: plan.releaseElapsedSeconds + 0.001 });
    if (release.execution.kind !== 'throw_advance') throw new Error('release fixture');
    expect(release.execution.progress.kind).toBe('released');
    const releasedPrefix = battedWorldFieldPhysicalPrefix(prefix());
    expect(releasedPrefix.segments.slice(0, -1)).toEqual(progressPrefix.segments);
    expect(releasedPrefix.segments.at(-1)).toMatchObject({ startElapsedSeconds: checkpoint, endElapsedSeconds: plan.releaseElapsedSeconds });
    expect(releasedPrefix.controlWindows.at(-1)).toEqual({ playerId: plan.input.carrierPlayerId,
      startElapsedSeconds: checkpoint, endElapsedSeconds: plan.releaseElapsedSeconds, endInclusive: false });
    const releaseView = accept('history-release-view', { kind: 'whole_play_history' });
    if (releaseView.execution.kind !== 'whole_play_history') throw new Error('release view fixture');
    const history = releaseView.execution.physicalHistory;
    expect(history.horizon.elapsedSeconds).toBe(plan.releaseElapsedSeconds);
    expect(history.carrierPlayerId).toBeNull();
    expect(history.frames.flatMap((frame) => frame.occurrences).filter((value) => value.phase === 'throw_release')).toHaveLength(1);
    expect(history.end).toEqual({ kind: 'unestablished' });
  } finally { x.f.close(); }
});

it('makes an immediate scheduled release exclusive of custody already observed at the same carried-motion horizon', () => {
  const x = battedWorldFieldThrowFixture(undefined, 0);
  try {
    if (x.source.action.kind !== 'throw') throw new Error('throw fixture');
    const throughTick = x.capture.secureTick + 1000;
    const moveSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'history-before-immediate',
      action: { kind: 'motion', availableAtTick: x.capture.secureTick, throughTick, commands: x.source.action.commands } };
    x.sources.set(moveSource.sourceId, moveSource); const moved = x.executions.accept(moveSource.sourceId);
    const planSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'history-immediate-plan', previousExecutionSourceId: moveSource.sourceId,
      action: { ...x.source.action, kind: 'throw_plan', availableAtTick: throughTick } };
    x.sources.set(planSource.sourceId, planSource); const planned = x.executions.accept(planSource.sourceId);
    if (planned.execution.kind !== 'throw_plan') throw new Error('immediate plan fixture');
    const at = planned.execution.plan.releaseElapsedSeconds;
    expect(at).toBe(moved.execution.field.motion.world.moment.elapsedSeconds);
    const releaseSource: AcceptedBattedWorldFieldExecution = { ...planSource, sourceId: 'history-immediate-release',
      previousExecutionSourceId: planSource.sourceId, action: { kind: 'throw_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: at } };
    x.sources.set(releaseSource.sourceId, releaseSource); const released = x.executions.accept(releaseSource.sourceId);
    expect(released.execution).toMatchObject({ kind: 'throw_advance', progress: { kind: 'released' } });
    const actual = battedWorldFieldPhysicalPrefix({ baseField: x.baseField, fields: [x.baseField], executions: [x.acquired, moved, planned, released] });
    expect(battedWorldFieldPhysicalPrefix({ baseField: x.baseField, fields: [x.baseField],
      executions: [x.acquired, moved, planned, released], custodyPolicy: 'release_exclusive_v1' })).toEqual(actual);
    expect(actual.controlWindows.filter((window) => window.endElapsedSeconds === at).every((window) => !window.endInclusive)).toBe(true);
    expect(actual.controlWindows.at(-1)).toMatchObject({ startElapsedSeconds: at, endElapsedSeconds: at, endInclusive: false });
  } finally { x.f.close(); }
});

it('retains Native same-time post-release floor contacts and its adopted response instead of reviving launch velocity', async () => {
  const { battedWorldFieldRaceFixture } = await import('./BattedWorldFieldRaceFixtures.test-support');
  const { openSqlitePlayerFieldingModelStore } = await import('./SqlitePlayerFieldingModelStore');
  const x = battedWorldFieldRaceFixture(undefined, 0.04, 0.08, 0.045, 0);
  try {
    if (x.acquired.execution.kind !== 'acquisition' || x.acquired.execution.acquisition.kind !== 'secured') throw new Error('floor capture fixture');
    const carrier = x.acquired.execution.acquisition.acquirerPlayerId, world = x.response.touch.worldContact;
    const actor = world.modelActorEvidence.find((value) => value.binding.playerId === carrier)!;
    const receiver = world.flight.physicalPitch.frame.batterActor!.defenderBindings.find((value) => value.playerId !== carrier)!.playerId;
    const modelSource = { sourceId: 'history-floor-model', sourceVersion: 'synthetic-v1', careerId: actor.binding.careerId,
      playerId: carrier, personLinkSourceId: actor.binding.personLinkSourceId, acceptedAtDay: actor.binding.gameDay,
      ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
        firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
        armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
      transferParameters: { minimumTransferDelayTicks: 100_000, maximumTransferDelayTicks: 100_000, fixedGripOffsetTicks: 0 },
      throwCalibration: { minimumReleaseSpeedMps: 20, maximumReleaseSpeedMps: 20, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 0 } };
    const fielding = x.f.track(openSqlitePlayerFieldingModelStore(x.f.path, { readAcceptedModel: () => modelSource }));
    fielding.accept(modelSource.sourceId);
    const at = x.moved.execution.field.motion.world.moment;
    expect(at.ball.position.y).toBe(world.flight.source.execution.ballFlightParameters.ballRadius);
    if (x.move.action.kind !== 'motion') throw new Error('floor motion fixture');
    const planSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'history-floor-plan',
      action: { kind: 'throw_plan', availableAtTick: at.ball.tick, throughTick: at.ball.tick + 1_000_000,
        modelSourceId: modelSource.sourceId, receiverPlayerId: receiver,
        commands: x.move.action.commands.map((command) => command.playerId !== receiver ? command : { ...command,
          primitiveMotions: command.primitiveMotions.map((motion) => motion.role !== 'glove' ? motion : { ...motion,
            offsetAcceleration: { x: 0, y: -2000, z: 0 } }) }) } };
    x.sources.set(planSource.sourceId, planSource); const planned = x.executions.accept(planSource.sourceId);
    if (planned.execution.kind !== 'throw_plan') throw new Error('floor plan fixture');
    const advanceSource: AcceptedBattedWorldFieldExecution = { ...planSource, sourceId: 'history-floor-release',
      previousExecutionSourceId: planSource.sourceId, action: { kind: 'throw_advance', planSourceId: planSource.sourceId,
        throughElapsedSeconds: planned.execution.plan.releaseElapsedSeconds } };
    x.sources.set(advanceSource.sourceId, advanceSource); const released = x.executions.accept(advanceSource.sourceId);
    expect(released.execution).toMatchObject({ kind: 'throw_advance', progress: { kind: 'released' },
      field: { motion: { world: { kind: 'boundary' }, response: { kind: 'ground' }, carrierPlayerId: null } } });
    if (released.execution.kind !== 'throw_advance' || released.execution.progress.kind !== 'released') throw new Error('floor release fixture');
    expect(released.execution.progress.releaseCursor.moment.ball.velocity.y).toBeLessThan(0);
    expect(released.execution.field.motion.cursor?.moment.ball.velocity.y).toBe(0);
    const historySource: AcceptedBattedWorldFieldExecution = { ...advanceSource, sourceId: 'history-floor-view',
      previousExecutionSourceId: advanceSource.sourceId, action: { kind: 'whole_play_history' } };
    x.sources.set(historySource.sourceId, historySource); const view = x.executions.accept(historySource.sourceId);
    if (view.execution.kind !== 'whole_play_history') throw new Error('floor history fixture');
    expect(view.execution.physicalHistory.physicalSteps.at(-1)?.field).toEqual(released.execution.field);
    expect(view.execution.physicalHistory.cursor).toEqual(released.execution.field.motion.cursor);
    expect(view.execution.physicalHistory.cursor).not.toEqual(released.execution.progress.releaseCursor);
    expect(view.execution.physicalHistory.frames.at(-1)?.occurrences.map((value) => value.phase)).toEqual(['throw_release', 'world_boundary', 'response_cursor']);
    expect(view.execution.physicalHistory.end).toEqual({ kind: 'unestablished' });
  } finally { x.f.close(); }
});

it('keeps Native interrupted transfer bag evidence and pending contact without creating a release or overlapping earlier spans', async () => {
  const { fieldPhysicalBagFixture } = await import('./BattedWorldFieldPhysicalPrefixFixtures.test-support');
  const x = fieldPhysicalBagFixture('transfer', true);
  try {
    if (!('executions' in x) || !x.executions || !x.executionSources) throw new Error('scheduled bag owner fixture');
    const planned = x.prefix.at(-1)!;
    if (planned.execution.kind !== 'throw_plan') throw new Error('scheduled bag plan fixture');
    const plan = planned.execution.plan, at = plan.input.cursor.moment.elapsedSeconds;
    const sources = x.executionSources, owner = x.executions, prefix = [...x.prefix];
    const accept = (sourceId: string, action: AcceptedBattedWorldFieldExecution['action']) => {
      const source = { ...planned.source, sourceId, previousExecutionSourceId: prefix.at(-1)!.source.sourceId, action };
      sources.set(sourceId, source); const result = owner.accept(sourceId); prefix.push(result); return result;
    };
    const first = accept('bag-scheduled-first', { kind: 'throw_advance', planSourceId: planned.source.sourceId, throughElapsedSeconds: at + 0.001 });
    expect(first.execution).toMatchObject({ kind: 'throw_advance', progress: { kind: 'transfer' } });
    const prior = battedWorldFieldPhysicalPrefix({ baseField: x.baseField, fields: [x.baseField], executions: prefix });
    const stopped = accept('bag-scheduled-interrupted', { kind: 'throw_advance', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: plan.releaseElapsedSeconds });
    expect(stopped.execution).toMatchObject({ kind: 'throw_advance', progress: { kind: 'interrupted' } });
    const physical = battedWorldFieldPhysicalPrefix({ baseField: x.baseField, fields: [x.baseField], executions: prefix });
    expect(physical.segments.slice(0, -1)).toEqual(prior.segments);
    expect(physical.field.baseContacts).toEqual(stopped.execution.field.baseContacts);
    expect(physical.field.baseContacts).toHaveLength(1);
    expect(physical.controlWindows.at(-1)).toMatchObject({ startElapsedSeconds: at + 0.001,
      endElapsedSeconds: physical.field.evidence.horizon.elapsedSeconds, endInclusive: false });
    const view = accept('bag-scheduled-history', { kind: 'whole_play_history' });
    if (view.execution.kind !== 'whole_play_history') throw new Error('interrupted view fixture');
    expect(view.execution.physicalHistory.cursor).toBeNull();
    expect(view.execution.physicalHistory.carrierPlayerId).toBe(plan.input.carrierPlayerId);
    expect(view.execution.physicalHistory.physicalSteps.at(-1)?.field).toEqual(stopped.execution.field);
    expect(view.execution.physicalHistory.frames.flatMap((frame) => frame.occurrences).some((value) => value.phase === 'throw_release')).toBe(false);
    expect(view.execution.physicalHistory.end).toEqual({ kind: 'unestablished' });
  } finally { x.f.close(); }
});

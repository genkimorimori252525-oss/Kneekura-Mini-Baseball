import { expect, it } from 'vitest';
import { actualFieldObservationFixture as fixture, installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { sampleActualFieldObservation, type AcceptedActualFieldObservation } from './ActualFieldObservation';
import type { AcceptedBattedWorldFieldExecution, DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('samples pending actual transfer and distinct sub-tick moments without promoting the future plan to truth', () => {
  const x = fixture();
  try {
    const first = x.observations.accept(x.observationSource.sourceId);
    if (x.source.action.kind !== 'throw') throw new Error('throw fixture');
    const planSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'observed-plan', action: { ...x.source.action, kind: 'throw_plan',
      commands: x.source.action.commands.map((command) => command.playerId === x.actor.binding.playerId
        ? { ...command, bodyAcceleration: { x: 10, y: 0, z: 0 } } : command) } };
    x.sources.set(planSource.sourceId, planSource); const planned = x.executions.accept(planSource.sourceId);
    if (planned.execution.kind !== 'throw_plan') throw new Error('planned fixture');
    const plan = planned.execution.plan, executions: DurableBattedWorldFieldExecution[] = [x.acquired, planned];
    let previousObservation = first;
    const observe = (id: string, changeAttention = false) => {
      const source: AcceptedActualFieldObservation = { ...x.observationSource, sourceId: id,
        executionSourceId: executions.at(-1)!.source.sourceId, previousObservationSourceId: previousObservation.source.sourceId,
        view: changeAttention ? { ...x.observationSource.view, attentionTarget: { kind: 'player', playerId: x.receiver.playerId } } : x.observationSource.view };
      x.observationSources.set(id, source); const result = x.observations.accept(id); previousObservation = result; return result;
    };
    const admitted = observe('observation-plan');
    expect(admitted.receipt.at).toEqual(first.receipt.at);
    expect(admitted.receipt.samples).toEqual(first.receipt.samples);
    expect(admitted.receipt).not.toHaveProperty('scheduledThrowPlans');
    const advance = (id: string, at: number) => {
      const source: AcceptedBattedWorldFieldExecution = { ...planSource, sourceId: id, previousExecutionSourceId: executions.at(-1)!.source.sourceId,
        action: { kind: 'throw_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: at } };
      x.sources.set(id, source); const value = x.executions.accept(id); executions.push(value); return value;
    };
    const p = x.observationModel.source.calibration.memoryDecayParameters.ticksPerSecond;
    const checkpoint1 = (Math.ceil(plan.input.cursor.moment.elapsedSeconds * p) + 0.1) / p;
    const checkpoint2 = (Math.ceil(plan.input.cursor.moment.elapsedSeconds * p) + 0.2) / p;
    advance('observed-transfer-a', checkpoint1); const partial = observe('observation-transfer-a');
    const perfect = { ...x.observationModel, source: { ...x.observationModel.source, calibration: { ...x.observationModel.source.calibration,
      errorParameters: { minimumDetectionQuality: 0.1, minimumPositionErrorMeters: 0, maximumPositionErrorMeters: 0,
        minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } } };
    const durationModel = { ...perfect, source: { ...perfect.source, calibration: { ...perfect.source.calibration,
      refreshPolicy: { attendedIntervalTicks: 1, peripheralIntervalTicks: 1 },
      qualityParameters: { ...perfect.source.calibration.qualityParameters,
        weights: { distance: 0, relativeSpeed: 0, attention: 0, duration: 1, ability: 0 } } } } };
    const instantaneous = sampleActualFieldObservation(partial.source, { baseField: x.baseField, fields: [x.baseField], executions },
      durationModel, { source: first.source, receipt: first.receipt });
    expect(instantaneous.focusStartedAt).toEqual(first.receipt.at);
    expect(instantaneous.samples.ball!.sample.confidence).toBe(durationModel.source.calibration.qualityParameters.instantaneousDurationQuality);
    const actual = executions.at(-1)!.execution.field.motion, body = actual.actors.find((actor) => actor.playerId === x.actor.binding.playerId && actor.primitive.role === 'body')!;
    const primitive = body.primitive, dt = (partial.receipt.at.originTick - primitive.startTick) / p + partial.receipt.at.elapsedSeconds - (body.startElapsedSeconds ?? 0);
    const ball = actual.cursor!.moment.ball.position, reverse = { x: 0, y: 0, z: 0 };
    for (const axis of ['x', 'y', 'z'] as const) reverse[axis] = primitive.startCenter[axis] + primitive.startVelocity[axis] * dt
      + 0.5 * primitive.acceleration[axis] * dt * dt + first.source.view.bodyRelativeEyeOffset[axis] - ball[axis];
    const hidden = sampleActualFieldObservation({ ...partial.source, view: { ...partial.source.view, forward: reverse } },
      { baseField: x.baseField, fields: [x.baseField], executions }, durationModel, { source: first.source, receipt: first.receipt });
    expect(hidden.results[0].status).toBe('not_detected');
    expect(hidden.samples.ball).toEqual(first.receipt.samples.ball);
    expect(hidden.perceived.ball!.sourceObservedAt).toBe(first.receipt.at.tick);
    const a = sampleActualFieldObservation(partial.source, { baseField: x.baseField, fields: [x.baseField], executions }, perfect, null);
    const secondMotion = advance('observed-transfer-b', checkpoint2); const subTick = observe('observation-transfer-b', true);
    const b = sampleActualFieldObservation(subTick.source, { baseField: x.baseField, fields: [x.baseField], executions }, perfect, null);
    expect(subTick.receipt.at.tick).toBe(partial.receipt.at.tick);
    expect(subTick.receipt.at.elapsedSeconds).toBeGreaterThan(partial.receipt.at.elapsedSeconds);
    expect(a.samples.ball!.sample.estimate.position).not.toEqual(b.samples.ball!.sample.estimate.position);
    expect(subTick.receipt.focusStartedAt).toEqual(subTick.receipt.at);
    expect(subTick.receipt.samples.ball).toEqual(first.receipt.samples.ball);
    expect(subTick.receipt.perceived.ball!.sourceObservedAt).toBe(first.receipt.at.tick);
    expect(subTick.receipt.perceived.ball!.confidence).toBeLessThan(first.receipt.perceived.ball!.confidence);
    expect(secondMotion.execution).toMatchObject({ kind: 'throw_advance', progress: { kind: 'transfer' } });
    expect(subTick.receipt.at.elapsedSeconds).toBeLessThan(plan.releaseElapsedSeconds);
    const stale = { ...x.observationSource, sourceId: 'retroactive-evidence', previousObservationSourceId: subTick.source.sourceId };
    x.observationSources.set(stale.sourceId, stale);
    expect(() => x.observations.accept(stale.sourceId)).toThrow();
    // Historical receipts validate future metadata, but do not consume future physical/observation payloads.
    x.f.db.prepare("UPDATE batted_world_field_executions SET source_json='invalid-future-payload' WHERE source_id=?").run(secondMotion.source.sourceId);
    x.f.db.prepare("UPDATE actual_field_observations SET source_json='invalid-future-payload' WHERE source_id=?").run(subTick.source.sourceId);
    expect(x.observations.read(partial.source.sourceId)).toEqual(partial);
    expect(x.observations.read(first.source.sourceId)).toEqual(first);
    x.f.db.prepare('UPDATE actual_field_observation_heads SET revision=revision+1').run();
    expect(() => x.observations.read(first.source.sourceId)).toThrow(/head/);
  } finally { x.f.close(); }
});

it('rejects an owned but future-day calibration and a foreign observer model', () => {
  const x = fixture();
  try {
    const other = installSyntheticObservation(x, x.receiver.playerId, x.acquired.source.sourceId, undefined,
      (source) => ({ ...source, acceptedAtDay: source.acceptedAtDay + 1 }));
    expect(() => other.observations.accept(other.observationSource.sourceId)).toThrow(/day/);
    x.observationSources.set(x.observationSource.sourceId, { ...x.observationSource, observationModelSourceId: other.observationModel.source.sourceId });
    expect(() => x.observations.accept(x.observationSource.sourceId)).toThrow(/scope/);
  } finally { x.f.close(); }
});

it('captures the adopted same-time post-release response instead of the incoming release velocity', async () => {
  const { battedWorldFieldRaceFixture } = await import('./BattedWorldFieldRaceFixtures.test-support');
  const { openSqlitePlayerFieldingModelStore } = await import('./SqlitePlayerFieldingModelStore');
  const x = battedWorldFieldRaceFixture(undefined, 0.04, 0.08, 0.045, 0);
  try {
    if (x.acquired.execution.kind !== 'acquisition' || x.acquired.execution.acquisition.kind !== 'secured') throw new Error('floor capture fixture');
    const carrier = x.acquired.execution.acquisition.acquirerPlayerId, world = x.response.touch.worldContact;
    const actor = world.modelActorEvidence.find((value) => value.binding.playerId === carrier)!;
    const receiver = world.flight.physicalPitch.frame.batterActor!.defenderBindings.find((value) => value.playerId !== carrier)!.playerId;
    const modelSource = { sourceId: 'observed-floor-model', sourceVersion: 'synthetic-v1', careerId: actor.binding.careerId,
      playerId: carrier, personLinkSourceId: actor.binding.personLinkSourceId, acceptedAtDay: actor.binding.gameDay,
      ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
        firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
        armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
      transferParameters: { minimumTransferDelayTicks: 100_000, maximumTransferDelayTicks: 100_000, fixedGripOffsetTicks: 0 },
      throwCalibration: { minimumReleaseSpeedMps: 20, maximumReleaseSpeedMps: 20, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 0 } };
    const fielding = x.f.track(openSqlitePlayerFieldingModelStore(x.f.path, { readAcceptedModel: () => modelSource }));
    const model = fielding.accept(modelSource.sourceId);
    const at = x.moved.execution.field.motion.world.moment;
    if (x.move.action.kind !== 'motion') throw new Error('floor motion fixture');
    const planSource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'observed-floor-plan',
      action: { kind: 'throw_plan', availableAtTick: at.ball.tick, throughTick: at.ball.tick + 1_000_000,
        modelSourceId: modelSource.sourceId, receiverPlayerId: receiver,
        commands: x.move.action.commands.map((command) => command.playerId !== receiver ? command : { ...command,
          primitiveMotions: command.primitiveMotions.map((motion) => motion.role !== 'glove' ? motion : { ...motion,
            offsetAcceleration: { x: 0, y: -2000, z: 0 } }) }) } };
    x.sources.set(planSource.sourceId, planSource); const planned = x.executions.accept(planSource.sourceId);
    if (planned.execution.kind !== 'throw_plan') throw new Error('floor plan fixture');
    const source: AcceptedBattedWorldFieldExecution = { ...planSource, sourceId: 'observed-floor-release', previousExecutionSourceId: planSource.sourceId,
      action: { kind: 'throw_advance', planSourceId: planSource.sourceId, throughElapsedSeconds: planned.execution.plan.releaseElapsedSeconds } };
    x.sources.set(source.sourceId, source); const released = x.executions.accept(source.sourceId);
    if (released.execution.kind !== 'throw_advance' || released.execution.progress.kind !== 'released') throw new Error('floor release fixture');
    expect(released.execution.progress.releaseCursor.moment.ball.velocity.y).toBeLessThan(0);
    expect(released.execution.field.motion.cursor!.moment.ball.velocity.y).toBe(0);
    const observer = installSyntheticObservation(x, carrier, source.sourceId, model, (input) => ({ ...input,
      calibration: { ...input.calibration, errorParameters: { minimumDetectionQuality: 0.1, minimumPositionErrorMeters: 0,
        maximumPositionErrorMeters: 0, minimumVelocityErrorMps: 0, maximumVelocityErrorMps: 0 } } }));
    const receipt = observer.observations.accept(observer.observationSource.sourceId).receipt;
    expect(receipt.samples.ball!.sample.estimate.velocity).toEqual(released.execution.field.motion.cursor!.moment.ball.velocity);
    expect(receipt.samples.ball!.sample.estimate.velocity).not.toEqual(released.execution.progress.releaseCursor.moment.ball.velocity);
    expect(receipt.at.elapsedSeconds).toBe(released.execution.progress.releaseCursor.moment.elapsedSeconds);
  } finally { x.f.close(); }
});

it('preserves old noisy memory when an actual later sightline intersects an owned wall with unknown optical policy', async () => {
  const { battedWorldFieldThrowFixture } = await import('./BattedWorldFieldExecutionFixtures.test-support');
  const x = battedWorldFieldThrowFixture(undefined, 1000, (world) => {
    const model = world.models.get(world.model.sourceId)!;
    // Explicit synthetic overhead wall: ball stays below it; the observer's eye ray can cross it.
    world.models.set(model.sourceId, { ...model, surfaces: [{ surfaceId: 'optically-unmodeled-wall',
      start: { x: 0.12, z: -100 }, end: { x: 0.12, z: 100 }, minimumHeight: 2.5, maximumHeight: 10 }] });
  });
  try {
    const observer = installSyntheticObservation(x, x.actor.binding.playerId, x.acquired.source.sourceId, x.model);
    const first = observer.observations.accept(observer.observationSource.sourceId);
    expect(first.receipt.results[0].status).toBe('detected');
    if (x.source.action.kind !== 'throw') throw new Error('throw fixture');
    const plan: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'optical-wall-plan',
      action: { ...x.source.action, kind: 'throw_plan', commands: x.source.action.commands.map((command) => command.playerId === x.actor.binding.playerId
        ? { ...command, bodyAcceleration: { x: 20_000_000, y: 0, z: 0 } } : command) } };
    x.sources.set(plan.sourceId, plan); const planned = x.executions.accept(plan.sourceId);
    if (planned.execution.kind !== 'throw_plan') throw new Error('optical plan fixture');
    const advance: AcceptedBattedWorldFieldExecution = { ...plan, sourceId: 'optical-wall-motion', previousExecutionSourceId: plan.sourceId,
      action: { kind: 'throw_advance', planSourceId: plan.sourceId,
        throughElapsedSeconds: planned.execution.plan.input.cursor.moment.elapsedSeconds + 0.0001 } };
    x.sources.set(advance.sourceId, advance); const advanced = x.executions.accept(advance.sourceId);
    expect(advanced.execution).toMatchObject({ kind: 'throw_advance', progress: { kind: 'transfer' } });
    const source = { ...observer.observationSource, sourceId: 'optical-wall-observation', executionSourceId: advance.sourceId,
      previousObservationSourceId: first.source.sourceId };
    observer.observationSources.set(source.sourceId, source); const second = observer.observations.accept(source.sourceId);
    expect(second.receipt.results[0].status).toBe('surface_visibility_unavailable');
    expect(second.receipt.samples.ball).toEqual(first.receipt.samples.ball);
    expect(second.receipt.perceived.ball!.sourceObservedAt).toBe(first.receipt.at.tick);
    expect(second.receipt.perceived.ball!.confidence).toBeLessThan(first.receipt.perceived.ball!.confidence);
  } finally { x.f.close(); }
});

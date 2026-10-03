import { expect, it } from 'vitest';
import { battedWorldRunnerContactFixture as fixture } from './BattedWorldRunnerContactFixtures.test-support';
import { battedWorldBaseContactFixture } from './BattedWorldBaseContactFixtures.test-support';
import { openSqliteBattedWorldExecutionStore, type AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';

const source = (g: ReturnType<typeof fixture>, sourceId = 'whole-base-touch-history', previousExecutionSourceId: string | null = null): AcceptedBattedWorldExecution => ({
  ...g.source, sourceId, previousExecutionSourceId, action: { kind: 'base_touch_history', geometrySourceId: g.geometrySource.sourceId,
    playerId: g.batter.binding.playerId, base: 'home' } });
it('separates actual defender feet from controlled contact until the own true acquisition moment', () => {
  const g = battedWorldBaseContactFixture(); try {
    const carrier = g.motion.motion.carrierPlayerId!, acquisition = g.motion.acquisition!.result;
    if (acquisition.kind !== 'secured') throw new Error('secured fixture');
    const original: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'carrier-full-history', action: { kind: 'base_touch_history',
      geometrySourceId: g.geometrySource.sourceId, playerId: carrier, base: 'home' } };
    g.sources.set(original.sourceId, original); const value = g.executions.accept(original.sourceId);
    if (value.execution.kind !== 'base_touch_history') throw new Error('history fixture');
    expect(value.execution.history.events[0].elapsedSeconds).toBeLessThan(acquisition.moment.elapsedSeconds);
    expect(value.execution).toHaveProperty('controlledContacts', [{ playerId: carrier, originTick: acquisition.moment.originTick,
      elapsedSeconds: acquisition.moment.elapsedSeconds, tick: acquisition.secureTick }]);
    expect(value.execution).toHaveProperty('physicalRuleFacts', [{ kind: 'controlled_base_contact', defenderId: carrier,
      base: 4, tick: acquisition.secureTick }]);
  } finally { g.f.close(); }
});
it.each([[100, true], [210, true], [300, true], [300, false]] as const)(
  'owns sole contact at %i microseconds with moving receiver=%s and respects actual transfer/release/World end', (touchMicroseconds, moveReceiver) => {
  const g = battedWorldBaseContactFixture(); try {
    const carrier = g.motion.motion.carrierPlayerId!, world = g.motion.response.touch.worldContact;
    const actor = world.modelActorEvidence.find((value) => value.binding.playerId === carrier)!;
    const receiver = world.flight.physicalPitch.frame.batterActor!.defenderBindings.find((value) => value.playerId !== carrier)!;
    const fieldingSource: AcceptedPlayerFieldingModel = { sourceId: 'history-throw-model', sourceVersion: 'fixture-v1',
      careerId: actor.binding.careerId, playerId: carrier, personLinkSourceId: actor.binding.personLinkSourceId, acceptedAtDay: actor.binding.gameDay,
      ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
        firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
        armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
      transferParameters: { minimumTransferDelayTicks: 100, maximumTransferDelayTicks: 300, fixedGripOffsetTicks: 10 },
      throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } };
    const fielding = g.f.track(openSqlitePlayerFieldingModelStore(g.f.path, { readAcceptedModel: () => fieldingSource }));
    fielding.accept(fieldingSource.sourceId);
    const soles = (accelerationY: number) => g.motionSource.commands.map((command) => command.playerId !== carrier ? command : { ...command,
      primitiveMotions: command.primitiveMotions.map((motion) => !motion.role.endsWith('foot') ? motion : { ...motion,
        offsetAcceleration: { x: 0, y: accelerationY, z: 0 } }) });
    const rise: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'carrier-actual-sole-rise', action: { kind: 'motion',
      availableAtTick: g.motion.motion.world.moment.ball.tick, throughTick: g.motion.motion.world.moment.ball.tick + 1000, commands: soles(1_000_000) } };
    g.sources.set(rise.sourceId, rise); const moved = g.executions.accept(rise.sourceId);
    expect(moved.execution.motion.world.kind).toBe('moving');
    const seconds = touchMicroseconds / 1_000_000;
    // Move the actual receiver glove away on the release side. The old stationary target sends the ball
    // back into the holding glove and correctly stops World at release instead of executing free flight.
    const transferCommands = soles(-2 * (0.5 + 1000 * seconds) / seconds ** 2).map((command) => !moveReceiver || command.playerId !== receiver.playerId ? command
      : { ...command, primitiveMotions: command.primitiveMotions.map((motion) => motion.role !== 'glove' ? motion : { ...motion,
        offsetAcceleration: { x: 0, y: 0, z: -2 * 100 / (210 / 1_000_000) ** 2 } }) });
    const throwSource: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'carrier-actual-throw', previousExecutionSourceId: rise.sourceId,
      action: { kind: 'throw', modelSourceId: fieldingSource.sourceId, receiverPlayerId: receiver.playerId,
        availableAtTick: moved.execution.motion.world.moment.ball.tick, throughTick: moved.execution.motion.world.moment.ball.tick + 100_000,
        commands: transferCommands } };
    g.sources.set(throwSource.sourceId, throwSource); const thrown = g.executions.accept(throwSource.sourceId);
    if (thrown.execution.kind !== 'throw' || thrown.execution.throw.kind !== 'released') throw new Error('released fixture');
    if (moveReceiver) {
      expect(thrown.execution.motion.world.kind).toBe('moving');
      expect(thrown.execution.motion.world.moment.elapsedSeconds).toBeGreaterThan(moved.execution.motion.world.moment.elapsedSeconds + seconds);
    } else {
      expect(thrown.execution.motion.world.kind).toBe('boundary');
      expect(thrown.execution.motion.world.moment.elapsedSeconds).toBe(thrown.execution.throw.releaseCursor.moment.elapsedSeconds);
      expect(thrown.execution.motion.world.moment.elapsedSeconds).toBeLessThan(moved.execution.motion.world.moment.elapsedSeconds + seconds);
    }
    const observe: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'history-after-transfer', previousExecutionSourceId: throwSource.sourceId,
      action: { kind: 'base_touch_history', geometrySourceId: g.geometrySource.sourceId, playerId: carrier, base: 'home' } };
    g.sources.set(observe.sourceId, observe); const value = g.executions.accept(observe.sourceId);
    if (value.execution.kind !== 'base_touch_history') throw new Error('history fixture');
    expect(value.execution.history.endElapsedSeconds).toBe(thrown.execution.motion.world.moment.elapsedSeconds);
    const secure = g.motion.acquisition!.result;
    if (secure.kind !== 'secured') throw new Error('secured fixture');
    expect(value.execution.controlledContacts[0].elapsedSeconds).toBe(secure.moment.elapsedSeconds);
    expect(value.execution.history.events.filter((e) => e.kind === 'touch')).toHaveLength(moveReceiver ? 2 : 1);
    const controlled = value.execution.controlledContacts.filter((e) => e.elapsedSeconds > secure.moment.elapsedSeconds);
    expect(controlled).toHaveLength(touchMicroseconds < 210 ? 1 : 0);
    if (controlled.length) expect(controlled[0].elapsedSeconds).toBeCloseTo(moved.execution.motion.world.moment.elapsedSeconds + seconds, 14);
    expect(g.executions.read(rise.sourceId)).toEqual(moved); expect(g.executions.read(throwSource.sourceId)).toEqual(thrown);
  } finally { g.f.close(); }
});
it('owns actual departure and retouch from successive accepted sole motion without changing old observations', () => {
  const g = fixture(); try {
    const original = source(g); g.sources.set(original.sourceId, original); const before = g.executions.accept(original.sourceId);
    const append = (id: string, previous: typeof before, ticks: number, soleAccelerationY: number) => {
      const action: AcceptedBattedWorldExecution = { ...original, sourceId: id, previousExecutionSourceId: previous.source.sourceId,
        action: { kind: 'motion', availableAtTick: previous.execution.motion.world.moment.ball.tick,
          throughTick: previous.execution.motion.world.moment.ball.tick + ticks,
          commands: g.motionSource.commands.map((command) => command.playerId !== g.batter.binding.playerId ? command : { ...command,
            primitiveMotions: command.primitiveMotions.map((motion) => !motion.role.endsWith('foot') ? motion : { ...motion,
              offsetAcceleration: { x: 0, y: soleAccelerationY, z: 0 } }) }) } };
      g.sources.set(action.sourceId, action); return g.executions.accept(action.sourceId);
    };
    // Explicit synthetic sole commands verify actual causality, not production locomotion ratings or contact outcomes.
    const rise = append('actual-sole-rise', before, 1000, 1_000_000);
    expect(rise.execution.motion.world.kind).toBe('moving');
    const back = append('actual-sole-return', rise, 3000, -2 * (0.5 + 1000 * 0.003) / 0.003 ** 2);
    expect(back.execution.motion.world.kind).toBe('moving');
    const later = append('actual-sole-later', back, 1000, 0);
    expect(later.execution.motion.world.kind).toBe('moving');
    const observation = source(g, 'history-after-actual-retouch', later.source.sourceId); g.sources.set(observation.sourceId, observation);
    const value = g.executions.accept(observation.sourceId);
    if (value.execution.kind !== 'base_touch_history') throw new Error('history fixture');
    expect(value.execution.history.events.map((e) => e.kind)).toEqual(['touch', 'departure', 'touch', 'departure']);
    expect(value.execution).toHaveProperty('physicalRuleFacts', value.execution.history.events.map((e) => ({
      kind: e.kind === 'touch' ? 'runner_base_touch' : 'runner_base_departure', runnerId: g.batter.binding.playerId, base: 4, tick: e.tick })));
    expect(value.execution.history.events[1].elapsedSeconds).toBe(before.execution.motion.world.moment.elapsedSeconds);
    expect(value.execution.history.events[2].elapsedSeconds).toBeCloseTo(back.execution.motion.world.moment.elapsedSeconds, 14);
    expect(g.executions.read(original.sourceId)).toEqual(before);
  } finally { g.f.close(); }
});
it('owns the complete actual registered batter prefix and repeated observation without invented departure, then reopens', () => {
  const g = fixture(); try {
    const original = source(g); g.sources.set(original.sourceId, original);
    const value = g.executions.accept(original.sourceId);
    if (value.execution.kind !== 'base_touch_history') throw new Error('history fixture');
    expect(value.execution.history.startElapsedSeconds).toBe(0);
    expect(value.execution.history.endElapsedSeconds).toBe(g.motion.motion.world.moment.elapsedSeconds);
    expect(value.execution.history.events.map((e) => e.kind)).toEqual(['touch']);
    expect(value.execution.history.contactAtHorizon).toBe(true);
    expect(value.execution).not.toHaveProperty('officialOccupancy'); expect(value.execution).not.toHaveProperty('playEnd');
    const repeated = source(g, 'repeated-observation', original.sourceId); g.sources.set(repeated.sourceId, repeated);
    const next = g.executions.accept(repeated.sourceId);
    if (next.execution.kind !== 'base_touch_history') throw new Error('history fixture');
    expect(next.execution.history).toEqual(value.execution.history);
    const reopened = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, { read: () => null }));
    expect(reopened.read(original.sourceId)).toEqual(value); expect(reopened.read(repeated.sourceId)).toEqual(next);
  } finally { g.f.close(); }
});
it('includes actual acquisition capture before a history observation and preserves the secured state for future motion', () => {
  const g = fixture(undefined, 'candidate'); try {
    const acquire: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'actual-acquire', action: { kind: 'acquisition' } };
    g.sources.set(acquire.sourceId, acquire); const captured = g.executions.accept(acquire.sourceId);
    if (captured.execution.kind !== 'acquisition' || captured.execution.acquisition.kind !== 'secured') throw new Error('secured fixture');
    const observation = source(g, 'history-after-capture', acquire.sourceId); g.sources.set(observation.sourceId, observation);
    const value = g.executions.accept(observation.sourceId);
    if (value.execution.kind !== 'base_touch_history') throw new Error('history fixture');
    const secure = captured.execution.acquisition;
    expect(value.execution.history.endElapsedSeconds).toBe(secure.moment.elapsedSeconds);
    expect(secure.moment.elapsedSeconds).toBeGreaterThan(captured.execution.motion.world.moment.elapsedSeconds);
    const move: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'motion-after-history', previousExecutionSourceId: observation.sourceId,
      action: { kind: 'motion', availableAtTick: secure.secureTick, throughTick: secure.secureTick + 1000, commands: g.motionSource.commands } };
    g.sources.set(move.sourceId, move); const moved = g.executions.accept(move.sourceId);
    expect(moved.execution.motion.carrierPlayerId).toBe(secure.acquirerPlayerId);
    const later = source(g, 'history-after-actual-motion', move.sourceId); g.sources.set(later.sourceId, later);
    const updated = g.executions.accept(later.sourceId);
    if (updated.execution.kind !== 'base_touch_history') throw new Error('history fixture');
    expect(updated.execution.history.endElapsedSeconds).toBe(moved.execution.motion.world.moment.elapsedSeconds);
    expect(g.executions.read(observation.sourceId)).toEqual(value);
  } finally { g.f.close(); }
});
it.each(['unknown', 'other_batter', 'desired_result', 'transported_history', 'geometry'] as const)('rejects %s history evidence injection', (kind) => {
  const g = fixture(); try {
    const original = source(g);
    if (original.action.kind !== 'base_touch_history') throw new Error('history fixture');
    const action = { ...original.action, playerId: kind === 'unknown' ? 'unknown' : kind === 'other_batter' ? 'away-2' : original.action.playerId,
      geometrySourceId: kind === 'geometry' ? 'missing' : original.action.geometrySourceId,
      ...(kind === 'desired_result' ? { safe: true } : kind === 'transported_history' ? { history: [] } : {}) };
    g.sources.set(original.sourceId, { ...original, action } as AcceptedBattedWorldExecution);
    expect(() => g.executions.accept(original.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
  } finally { g.f.close(); }
});

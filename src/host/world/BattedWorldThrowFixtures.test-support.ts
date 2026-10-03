import { battedWorldExecutionFixture } from './BattedWorldExecutionFixtures.test-support';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import type { AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

export const battedWorldThrowFixture = () => {
  const base = battedWorldExecutionFixture(undefined, 'carried'), world = base.response.touch.worldContact;
  const carrierId = base.motion.motion.carrierPlayerId!;
  const actor = world.modelActorEvidence.find((value) => value.binding.playerId === carrierId)!;
  const receiver = world.flight.physicalPitch.frame.batterActor!.defenderBindings.find((binding) => binding.playerId !== carrierId)!;
  const fieldingSource: AcceptedPlayerFieldingModel = { sourceId: 'throw-fielding-model', sourceVersion: 'fixture-v1',
    careerId: actor.binding.careerId, playerId: carrierId, personLinkSourceId: actor.binding.personLinkSourceId, acceptedAtDay: actor.binding.gameDay,
    ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
      firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
      armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
    transferParameters: { minimumTransferDelayTicks: 100, maximumTransferDelayTicks: 300, fixedGripOffsetTicks: 10 },
    throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } };
  const fieldingSources = new Map([[fieldingSource.sourceId, fieldingSource]]);
  const fielding = base.f.track(openSqlitePlayerFieldingModelStore(base.f.path, { readAcceptedModel: (id) => fieldingSources.get(id) ?? null }));
  const model = fielding.accept(fieldingSource.sourceId);
  const source: AcceptedBattedWorldExecution = { ...base.source, sourceId: 'throw-execution', action: { kind: 'throw',
    modelSourceId: fieldingSource.sourceId, receiverPlayerId: receiver.playerId, availableAtTick: base.motion.motion.world.moment.ball.tick,
    throughTick: base.motion.motion.world.moment.ball.tick + 100_000, commands: base.motionSource.commands } };
  base.sources.set(source.sourceId, source);
  return { ...base, source, model, fielding, fieldingSource, fieldingSources, actor, receiver };
};

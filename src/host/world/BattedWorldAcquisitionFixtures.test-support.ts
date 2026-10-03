import { battedContactResponseFixture } from './BattedContactResponseFixtures.test-support';
import { openSqliteBattedWorldAcquisitionStore, type AcceptedBattedWorldAcquisition } from './SqliteBattedWorldAcquisitionStore';
import { respondToBallContact } from '../../core/sim/ball/BallContactResponse';
import { openSqliteBattedWorldContinuationStore, type AcceptedBattedWorldContinuation } from './SqliteBattedWorldContinuationStore';

export const battedWorldAcquisitionFixture = (path?: string, kind: 'original' | 'later' = 'original') => {
  let laterAcquirerPlayerId: string | null = null;
  const base = battedContactResponseFixture(path, kind === 'original' ? 'glove' : 'body', kind === 'original' ? undefined : (world) => {
    const initial = world.flight.flight.initialBall, original = world.flight.physicalPitch.frame.world;
    laterAcquirerPlayerId = world.flight.physicalPitch.frame.batterActor!.defenderBindings.find((binding) => binding.playerId !== 'p2')!.playerId;
    const pitcher = original.defenders.find((actor) => actor.playerId === 'p2')!, receiver = original.defenders.find((actor) => actor.playerId === laterAcquirerPlayerId)!;
    const ball = respondToBallContact({ ball: initial, normal: { x: 0, y: 0, z: -1 }, surfaceVelocity: { x: pitcher.velocity.x, y: 0, z: pitcher.velocity.z },
      material: { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 } });
    const p = world.flight.source.execution.ballFlightParameters, dt = 0.01;
    const center = { x: ball.position.x + ball.velocity.x * dt, y: ball.position.y + ball.velocity.y * dt + 0.5 * p.gravityY * dt * dt,
      z: ball.position.z + ball.velocity.z * dt };
    const updated = world.models.get(world.model.sourceId)!;
    world.models.set(updated.sourceId, { ...updated, actors: updated.actors.map((actor) => actor.playerId !== laterAcquirerPlayerId ? actor : { ...actor,
      primitives: actor.primitives.map((primitive) => {
        if (primitive.role !== 'glove') return primitive;
        const relative = { x: ball.velocity.x - receiver.velocity.x, y: ball.velocity.y + p.gravityY * dt, z: ball.velocity.z - receiver.velocity.z };
        const length = Math.hypot(relative.x, relative.y, relative.z), radius = p.ballRadius + primitive.radius;
        const elapsed = (initial.tick - original.tick) / p.ticksPerSecond + dt;
        return { ...primitive, offset: { x: center.x + relative.x / length * radius - receiver.position.x - receiver.velocity.x * elapsed,
          y: center.y + relative.y / length * radius, z: center.z + relative.z / length * radius - receiver.position.z - receiver.velocity.z * elapsed } };
      }) } ) });
  });
  const model = { ...base.responseModel, actors: base.responseModel.actors.map((actor) => ({ ...actor,
    primitives: actor.primitives.map((profile) => profile.role !== 'glove' ? profile : { ...profile,
      parameters: { ...profile.parameters, captureDissipationPowerW: 100_000_000 } }) })) };
  base.responseModels.set(model.sourceId, model);
  const response = base.responses.accept(base.responseSource.sourceId);
  let continuation = null;
  let continuations = null;
  if (kind === 'later') {
    const prefix: AcceptedBattedWorldContinuation = { sourceId: 'actual-capture-prefix', sourceVersion: 'fixture-v1',
      responseSourceId: response.source.sourceId, previousContinuationSourceId: null, throughTick: response.touch.worldContact.actors[0].primitive.endTick };
    continuations = base.f.track(openSqliteBattedWorldContinuationStore(base.f.path, base.responses,
      { readAcceptedContinuation: (id) => id === prefix.sourceId ? prefix : null }));
    continuation = continuations.accept(prefix.sourceId);
  }
  const source: AcceptedBattedWorldAcquisition = { sourceId: 'acquisition', sourceVersion: 'fixture-v1',
    responseSourceId: response.source.sourceId, continuationSourceId: continuation?.source.sourceId ?? null };
  const sources = new Map([[source.sourceId, source]]);
  const authority = { readAcceptedAcquisition: (id: string) => sources.get(id) ?? null };
  const acquisitions = base.f.track(openSqliteBattedWorldAcquisitionStore(base.f.path, base.responses, authority));
  return { ...base, response, continuation, continuations, laterAcquirerPlayerId, acquisitionSource: source, acquisitionSources: sources, acquisitionAuthority: authority, acquisitions };
};

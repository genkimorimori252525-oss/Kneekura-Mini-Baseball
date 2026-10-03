import { battedWorldMotionFixture } from './BattedWorldMotionFixtures.test-support';
import { battedContactResponseFixture } from './BattedContactResponseFixtures.test-support';
import { respondToBallContact } from '../../core/sim/ball/BallContactResponse';
import { openSqliteBattedWorldMotionStore, type AcceptedBattedWorldMotion } from './SqliteBattedWorldMotionStore';
import { openSqliteBattedWorldExecutionStore, type AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

export const battedWorldExecutionFixture = (path?: string, kind: 'free' | 'carried' | 'candidate' | 'ground' | 'ground_candidate' = 'free', alignFieldWithInitialBases = false) => {
  const candidateKind = kind === 'candidate' || kind === 'ground_candidate';
  const ordinary = candidateKind ? null : battedWorldMotionFixture(path, kind, alignFieldWithInitialBases);
  const candidate = !candidateKind ? null : battedContactResponseFixture(path, kind === 'ground_candidate' ? 'ground' : 'body', (world) => {
    if (kind === 'ground_candidate') {
      const target = world.flight.flight.firstGroundContact!, frame = world.flight.physicalPitch.frame.world;
      const pitcher = frame.defenders.find((actor) => actor.playerId === 'p2')!, p = world.flight.source.execution.ballFlightParameters;
      const dt = (target.tick - frame.tick) / p.ticksPerSecond, model = world.models.get(world.model.sourceId)!;
      // Forecast positions a synthetic glove after ground; only actual World contact/capture proves pickup.
      world.models.set(model.sourceId, { ...model, actors: model.actors.map((actor) => actor.playerId !== 'p2' ? actor : { ...actor,
        primitives: actor.primitives.map((s) => s.role !== 'glove' ? s : { ...s, offset: {
          x: target.state.position.x - pitcher.position.x - pitcher.velocity.x * dt, y: p.ballRadius + 0.02,
          z: target.state.position.z + 0.12 - pitcher.position.z - pitcher.velocity.z * dt,
        } }) }) });
      return;
    }
    const initial = world.flight.flight.initialBall, frame = world.flight.physicalPitch.frame.world;
    const receiverId = world.flight.physicalPitch.frame.batterActor!.defenderBindings.find((binding) => binding.playerId !== 'p2')!.playerId;
    const pitcher = frame.defenders.find((actor) => actor.playerId === 'p2')!, receiver = frame.defenders.find((actor) => actor.playerId === receiverId)!;
    const ball = respondToBallContact({ ball: initial, normal: { x: 0, y: 0, z: -1 }, surfaceVelocity: { x: pitcher.velocity.x, y: 0, z: pitcher.velocity.z },
      material: { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 } });
    const p = world.flight.source.execution.ballFlightParameters, dt = 0.01, model = world.models.get(world.model.sourceId)!;
    const center = { x: ball.position.x + ball.velocity.x * dt, y: ball.position.y + ball.velocity.y * dt + 0.5 * p.gravityY * dt * dt,
      z: ball.position.z + ball.velocity.z * dt };
    world.models.set(model.sourceId, { ...model, actors: model.actors.map((actor) => actor.playerId !== receiverId ? actor : { ...actor,
      primitives: actor.primitives.map((s) => {
        if (s.role !== 'glove') return s;
        const relative = { x: ball.velocity.x - receiver.velocity.x, y: ball.velocity.y + p.gravityY * dt, z: ball.velocity.z - receiver.velocity.z },
          length = Math.hypot(relative.x, relative.y, relative.z), radius = p.ballRadius + s.radius, elapsed = (initial.tick - frame.tick) / p.ticksPerSecond + dt;
        return { ...s, offset: { x: center.x + relative.x / length * radius - receiver.position.x - receiver.velocity.x * elapsed,
          y: center.y + relative.y / length * radius, z: center.z + relative.z / length * radius - receiver.position.z - receiver.velocity.z * elapsed } };
      }) }) });
  }, alignFieldWithInitialBases);
  const base = ordinary ?? candidate!;
  if (candidate) candidate.responseModels.set(candidate.responseModel.sourceId, { ...candidate.responseModel,
    actors: candidate.responseModel.actors.map((actor) => ({ ...actor, primitives: actor.primitives.map((profile) => profile.role !== 'glove' ? profile
      : { ...profile, parameters: { ...profile.parameters, captureDissipationPowerW: 100_000_000 } }) })) });
  const response = base.responses.accept(base.responseSource.sourceId);
  const motionSource: AcceptedBattedWorldMotion = ordinary?.motionSource ?? { sourceId: 'motion-candidate', sourceVersion: 'fixture-v1',
    responseSourceId: response.source.sourceId, continuationSourceId: null, acquisitionSourceId: null, previousMotionSourceId: null,
    availableAtTick: response.result.kind === 'rebound' || response.result.kind === 'ground' ? response.result.ball.tick : 0,
    throughTick: response.touch.worldContact.actors[0].primitive.endTick,
    commands: response.touch.worldContact.source.commands.map((command) => ({ playerId: command.playerId, bodyAcceleration: command.bodyAcceleration,
      primitiveMotions: command.primitiveMotions.map((motion) => ({ role: motion.role, offsetAcceleration: motion.offsetAcceleration })) })) };
  const motionSources = ordinary?.motionSources ?? new Map([[motionSource.sourceId, motionSource]]);
  const motions = ordinary?.motions ?? base.f.track(openSqliteBattedWorldMotionStore(base.f.path, base.responses,
    { readAcceptedMotion: (id) => motionSources.get(id) ?? null }));
  const motion = motions.accept(motionSource.sourceId);
  const source: AcceptedBattedWorldExecution = { sourceId: 'execution-1', sourceVersion: 'fixture-v1', baseMotionSourceId: motion.source.sourceId,
    previousExecutionSourceId: null, action: candidateKind ? { kind: 'acquisition' } : { kind: 'motion', commands: motionSource.commands,
      availableAtTick: motion.motion.world.moment.ball.tick, throughTick: motionSource.throughTick + 1000 } };
  const sources = new Map([[source.sourceId, source]]), authority = { readAcceptedExecution: (id: string) => sources.get(id) ?? null };
  const executions = base.f.track(openSqliteBattedWorldExecutionStore(base.f.path, motions, authority));
  return { ...base, response, motions, motion, motionSource, motionSources, source, sources, authority, executions };
};

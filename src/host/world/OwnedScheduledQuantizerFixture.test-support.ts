import { vi } from 'vitest';
import * as kinematics from './ActualPlayerKinematicsFromPrefix';
import type { ActualPlayerKinematics } from './ActualPlayerKinematicsFromPrefix';
import type { OwnedMotionV2Action } from './OwnedScheduledBattedWorldMotion';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { fixture, v } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory.test-support';
import type { BattedActorResponseProfile } from '../../core/sim/ball/BattedBallContactResponse';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { deriveBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { deriveOwnedScheduledMotionExecution } from './OwnedScheduledMotionExecution';

// Adapter-only unit fixture: the prerequisite reader supplies validated self records.
// All ball/actor physics below runs the real Core; real Native Sources are tested separately.
export const quantizerFixture = (originTick = 100, ticksPerSecond = 3, coverageOffset = 12,
  configure?: (actors: BallWorldMotionActor[]) => BallWorldMotionActor[]) => {
  const core = fixture(originTick, 1000, 10, 10), roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
  const parameters = { ...core.response.world.parameters, ticksPerSecond };
  const flight = createBattedBallFlightEvidence({ contact: core.response.world.flight.contact, parameters, searchDurationTicks: 0 });
  const bindings = Array.from({ length: 10 }, (_, i) => ({ playerId: `player-${i}`, personId: `person-${i}`,
    personLinkSourceId: `link-${i}`, gameDay: 1, gameId: 'game' }));
  let actors: BallWorldMotionActor[] = bindings.flatMap((binding, i) => roles.map(role => ({ playerId: binding.playerId,
    primitive: { role, radius: .125, startTick: originTick, endTick: originTick + coverageOffset, ticksPerSecond,
      startCenter: v(-100 - i, 0, -100), startVelocity: v(0, 0, 0), acceleration: v(0, 0, 0) } })));
  if (configure) actors = configure(actors);
  const glove = core.response.actors[0].profile;
  if (glove.role !== 'glove') throw new Error('glove fixture');
  const profiles = bindings.map(binding => ({ playerId: binding.playerId, primitives: roles.map((role): BattedActorResponseProfile => role === 'glove'
    ? { ...glove, role, parameters: { ...glove.parameters, ticksPerSecond } }
    : { role, material: { restitution: .5, tangentialDamping: 0, spinDamping: 0 } }) }));
  const response = { world: { flight, parameters, throughTick: originTick, actors, surfaces: [] },
    actors: profiles.flatMap(a => a.primitives.map(profile => ({ playerId: a.playerId, profile }))), surfaces: [] };
  const field = deriveBattedWorldFieldMotionCheckpoint({ response, geometry: core.geometry, availableAtTick: originTick,
    coverageThroughTick: originTick + coverageOffset, checkpointThroughTick: originTick + 1, actors, carrierPlayerId: null,
    cursor: { moment: { originTick, elapsedSeconds: 0, ball: flight.initialBall }, previousContacts: [] }, commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })) });
  const world = { flight: { flight, source: { physicalPitchSourceId: 'pitch', execution: { ballFlightParameters: parameters }, searchDurationTicks: 0 },
    physicalPitch: { frame: { batterActor: { binding: bindings[0], defenderBindings: bindings.slice(1) } } } },
    model: { surfaces: [] }, actors };
  const baseField = { source: { sourceId: 'field', sourceVersion: 'fixture-v1' }, field, response: { touch: { worldContact: world }, model: { gameId: 'game', actors: profiles, surfaces: [] } },
    geometry: { geometry: core.geometry } } as unknown as DurableBattedWorldFieldAction;
  const at = { originTick, elapsedSeconds: field.motion.world.moment.elapsedSeconds, tick: field.motion.world.moment.ball.tick };
  const selves = bindings.map(binding => {
    const activeCommand = { kind: 'field' as const, owner: 'batted_world_field_actions' as const, sourceId: 'field', sourceVersion: 'fixture-v1',
      sourceHash: 'field-hash', adoptionSourceId: 'field', adoptionSourceHash: 'field-hash', adoptedAt: { originTick, elapsedSeconds: 0, tick: originTick },
      executedThrough: at, acceptedThroughTick: originTick + coverageOffset };
    return { ...binding, physicalPitchSourceId: 'pitch', at, ticksPerSecond, root: { acceleration: v(0, 0, 0) }, activeCommand,
      roles: field.motion.actors.filter(a => a.playerId === binding.playerId).map(canonicalActor => ({ role: canonicalActor.primitive.role,
        radiusMeters: canonicalActor.primitive.radius, canonicalActor, declaredPose: { relativeAcceleration: v(0, 0, 0) },
        canonicalRoundingResidual: { acceleration: v(0, 0, 0) } })) } as unknown as ActualPlayerKinematics;
  });
  const reader = vi.spyOn(kinematics, 'actualPlayersKinematicsFromPrefix').mockImplementation(() => selves);
  const knownWork = bindings.map(b => ({ playerId: b.playerId, decisionSourceId: null, motorSourceId: null }));
  const action = (checkpoint: OwnedMotionV2Action['checkpoint']): OwnedMotionV2Action => ({ kind: 'owned_motion_v2', checkpoint,
    contributions: selves.map(s => ({ kind: 'retained', playerId: s.playerId, command: s.activeCommand })), knownWork });
  const source = (checkpoint: OwnedMotionV2Action['checkpoint']) => ({ sourceId: 'checkpoint', sourceVersion: 'fixture-v1', baseFieldSourceId: 'field',
    previousExecutionSourceId: null, action: action(checkpoint) });
  const prefix = { baseField, fields: [baseField], executions: [] as DurableBattedWorldFieldExecution[] };
  const execute = (checkpoint: OwnedMotionV2Action['checkpoint'], decisions: Parameters<typeof deriveOwnedScheduledMotionExecution>[3] = []) =>
    deriveOwnedScheduledMotionExecution(source(checkpoint), prefix, [], decisions, null);
  const moveCut = (elapsedSeconds: number) => {
    const moment = { ...field.motion.world.moment, elapsedSeconds, ball: { ...field.motion.world.moment.ball,
      tick: quantizeEventTick(originTick, elapsedSeconds, ticksPerSecond) } };
    const moved = { ...field, motion: { ...field.motion, world: { ...field.motion.world, moment },
      cursor: field.motion.cursor && { ...field.motion.cursor, moment } } };
    prefix.executions = [{ source: { sourceId: 'earlier' }, execution: { kind: 'motion', field: moved } } as unknown as DurableBattedWorldFieldExecution];
    for (const self of selves) Object.assign(self.at, { elapsedSeconds, tick: moment.ball.tick });
  };
  return { core, parameters, response, field, selves, baseField, prefix, at, bindings, knownWork, action, source, execute, moveCut,
    restore: () => reader.mockRestore() };
};

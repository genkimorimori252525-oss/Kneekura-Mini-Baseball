import { fixture, v } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory.test-support';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { BattedBallContactResponseInput } from '../../core/sim/ball/BattedBallContactResponse';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';

/** Tiny pure Core motion and synthetic host envelopes, never a Native admission fixture. */
export const fieldNormalizationFixture = () => {
  const f = fixture(), roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
  const players = Array.from({ length: 10 }, (_, index) => `player-${index}-日本語["\\]`);
  const actors = players.flatMap((playerId, index) => roles.map(role => ({ playerId, primitive: {
    ...f.response.world.actors[0].primitive, role, startCenter: v(20 + index, 2, 20), startVelocity: v(0, 0, 0),
  } })));
  const profiles = roles.map(role => role === 'glove' ? f.response.actors[0].profile
    : { role, material: { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 } });
  const responseInput: BattedBallContactResponseInput = { ...f.response, world: { ...f.response.world, actors },
    actors: players.flatMap(playerId => profiles.map(profile => ({ playerId, profile }))) };
  const bindings = players.map(playerId => ({ playerId }));
  const flight = { source: { sourceId: 'flight', physicalPitchSourceId: 'pitch', searchDurationTicks: 0,
    execution: { ballFlightParameters: responseInput.world.parameters } }, flight: responseInput.world.flight,
    physicalPitch: { frame: { batterActor: { binding: bindings[0], defenderBindings: bindings.slice(1) } } } };
  const airborne = { kind: 'airborne', throughTick: f.availableAtTick, ball: responseInput.world.flight.initialBall };
  const response = { source: { sourceId: 'response' }, result: airborne,
    touch: { worldContact: { flight, source: { previousContactSourceId: null }, result: airborne, actors,
      model: { surfaces: [] }, modelActorEvidence: bindings.map(binding => ({ binding })) } },
    model: { gameId: 'game', surfaces: [], actors: players.map(playerId => ({ playerId, primitives: profiles })) } };
  const geometry = { source: { sourceId: 'geometry', sourceVersion: 'pure-v1', baseGeometrySourceId: 'bases', baseModels: f.geometry.baseModels }, geometry: f.geometry,
    baseGeometry: { source: { sourceId: 'bases', flightSourceId: 'flight' }, flight, geometry: f.geometry.baseGeometry, fixture: { game_id: 'game' } } };
  const source = { sourceId: 'field', sourceVersion: 'pure-v1', previousFieldSourceId: null,
    responseSourceId: 'response', geometrySourceId: 'geometry', availableAtTick: f.availableAtTick, throughTick: f.availableAtTick + 1000,
    commands: players.map(playerId => ({ playerId, bodyAcceleration: v(0, 0, 0),
      primitiveMotions: roles.map(role => ({ role, offsetAcceleration: v(0, 0, 0) })) })) };
  const field = deriveInitialBattedWorldFieldMotion({ ...f, response: responseInput, throughTick: source.throughTick,
    commands: actors.map(actor => ({ playerId: actor.playerId, role: actor.primitive.role, acceleration: v(0, 0, 0) })) });
  const baseField = { source, revision: 1, history: [source], response, geometry, field } as unknown as DurableBattedWorldFieldAction;
  return { baseField, fields: [baseField], executions: [] };
};

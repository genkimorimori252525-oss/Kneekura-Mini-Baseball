import { battedBallFlightFixture, type BattedFixturePitchPhysics } from './BattedBallFlightFixtures.test-support';
import { openSqliteBattedWorldContactStore, type AcceptedBattedWorldModel, type AcceptedBattedWorldContact } from './SqliteBattedWorldContactStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';

export const battedWorldContactFixture = (path?: string, alignFieldWithInitialBases = false, initialOnly = false, rollingDecelerationMps2?: number, groundRestitution?: number, pitchPhysics?: BattedFixturePitchPhysics) => {
  const base = battedBallFlightFixture(path, true, true, alignFieldWithInitialBases, undefined, pitchPhysics), { f, physical, flights, acceptedFlights } = base;
  const input = rollingDecelerationMps2 === undefined && groundRestitution === undefined ? base.input : { ...base.input, execution: { ...base.input.execution,
    ballFlightParameters: { ...base.input.execution.ballFlightParameters, ...(rollingDecelerationMps2 === undefined ? {} : { groundRollingDecelerationMps2: rollingDecelerationMps2 }),
      ...(groundRestitution === undefined ? {} : { groundRestitution }) } } };
  acceptedFlights.set(input.sourceId, input);
  flights.accept(input.sourceId);
  const flightInput = { ...input, sourceId: 'flight-full', previousFlightSourceId: input.sourceId, searchDurationTicks: 2_000_000 };
  if (!initialOnly) acceptedFlights.set(flightInput.sourceId, flightInput);
  const flight = initialOnly ? flights.read(input.sourceId)! : flights.accept(flightInput.sourceId), batter = physical.frame.batterActor!;
  const model: AcceptedBattedWorldModel = { sourceId: 'world-model', sourceVersion: 'fixture-v1', gameId: batter.source.gameId,
    careerId: batter.binding.careerId, fixtureEventId: batter.binding.fixtureEventId, venueId: input.execution.venueId, availableAtDay: 1,
    actors: f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=?').all(batter.source.gameId)
      .map((row) => JSON.parse(row.binding_json as string) as OfficialParticipantBinding).map((binding) => ({ playerId: binding.playerId, personId: binding.personId,
      heightMeters: binding.playerId === physical.frame.workload.playerId ? physical.frame.release.body.heightMeters : 1.8,
      bodyOriginHeightMeters: 0,
      primitives: (['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const).map((role) => ({ role, radius: 0.05,
        offset: { x: role === 'left_foot' ? -0.1 : role === 'right_foot' ? 0.1 : 0, y: role.endsWith('foot') ? 0.05 : 0.9, z: 0 } })) })),
    batterGripOffset: { x: 0.5, y: 0.9, z: 0 }, surfaces: [] };
  const source: AcceptedBattedWorldContact = { sourceId: 'world-contact', sourceVersion: 'fixture-v1', flightSourceId: flight.source.sourceId,
    modelSourceId: model.sourceId, previousContactSourceId: null, commands: model.actors.filter((a) => [...batter.defenderBindings, batter.binding]
      .some((b) => b.playerId === a.playerId)).map((actor) => ({ playerId: actor.playerId,
      bodyAcceleration: { x: 0, y: 0, z: 0 }, primitiveMotions: actor.primitives.map((p) => ({ role: p.role,
        offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } })) })) };
  const models = new Map([[model.sourceId, model]]), sources = new Map([[source.sourceId, source]]);
  const authority = { readAcceptedModel: (id: string) => models.get(id) ?? null, readAcceptedContact: (id: string) => sources.get(id) ?? null };
  const contacts = f.track(openSqliteBattedWorldContactStore(f.path, flights, authority));
  return { ...base, input, flight, model, source, models, sources, authority, contacts };
};

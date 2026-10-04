import type { BattedFixturePitchPhysics } from './BattedBallFlightFixtures.test-support';
import { battedWorldContactFixture } from './BattedWorldContactFixtures.test-support';
import { openSqliteBattedFirstFielderTouchStore, type AcceptedBattedFirstFielderTouch } from './SqliteBattedFirstFielderTouchStore';
import { openSqliteBattedContactResponseStore, type AcceptedBattedContactResponse, type AcceptedBattedContactResponseModel } from './SqliteBattedContactResponseStore';

export const battedContactResponseFixture = (path?: string, kind: 'body' | 'glove' | 'failed_glove' | 'ground' | 'surface' | 'airborne' | 'simultaneous' = 'body',
  configure?: (base: ReturnType<typeof battedWorldContactFixture>) => void, alignFieldWithInitialBases = false, initialOnly = false, rollingDecelerationMps2?: number, groundRestitution?: number, pitchPhysics?: BattedFixturePitchPhysics) => {
  const base = battedWorldContactFixture(path, alignFieldWithInitialBases, initialOnly, rollingDecelerationMps2, groundRestitution, pitchPhysics), { f, model, models, source, sources, flight, contacts } = base;
  const at = flight.flight.contact.tick, ball = flight.flight.initialBall.position;
  if (kind === 'airborne') sources.set(source.sourceId, { ...source, flightSourceId: base.input.sourceId });
  else if (kind === 'surface') models.set(model.sourceId, { ...model, surfaces: [{ surfaceId: 'panel',
    start: { x: ball.x - 1, z: ball.z + 0.02 }, end: { x: ball.x + 1, z: ball.z + 0.02 }, minimumHeight: 0, maximumHeight: ball.y + 1 }] });
  else if (kind !== 'ground') {
    const original = flight.physicalPitch.frame.world, pitcher = original.defenders.find((d) => d.playerId === 'p2')!;
    const dt = (at - original.tick) / flight.source.execution.ballFlightParameters.ticksPerSecond;
    const root = { x: pitcher.position.x + pitcher.velocity.x * dt, y: 0, z: pitcher.position.z + pitcher.velocity.z * dt };
    models.set(model.sourceId, { ...model, actors: model.actors.map((a) => a.playerId !== 'p2' ? a : { ...a,
      primitives: a.primitives.map((p) => p.role === (kind.includes('glove') ? 'glove' : 'body') || kind === 'simultaneous' && p.role === 'glove'
        ? { ...p, offset: { x: ball.x - root.x, y: ball.y, z: ball.z + 0.08 - root.z } } : p) }) });
  }
  configure?.(base);
  const worldContact = contacts.accept(source.sourceId);
  const touchSource: AcceptedBattedFirstFielderTouch = { sourceId: 'touch', sourceVersion: 'fixture-v1', worldContactSourceId: source.sourceId };
  const touches = f.track(openSqliteBattedFirstFielderTouchStore(f.path, contacts, { readAcceptedTouch: (id) => id === touchSource.sourceId ? touchSource : null }));
  const touch = touches.accept(touchSource.sourceId), p = flight.source.execution.ballFlightParameters;
  const material = { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 };
  const responseModel: AcceptedBattedContactResponseModel = { sourceId: 'response-model', sourceVersion: 'fixture-v1',
    gameId: model.gameId, careerId: model.careerId, fixtureEventId: model.fixtureEventId, venueId: model.venueId, availableAtDay: 1,
    actors: model.actors.map((a) => ({ playerId: a.playerId, personId: a.personId,
      primitives: a.primitives.map((s) => s.role !== 'glove' ? { role: s.role, material } : {
        role: 'glove', pocketCenterOffset: { x: 0, y: 0, z: -0.08 }, bodyStability: kind === 'failed_glove' ? 0 : 1,
        parameters: { ticksPerSecond: p.ticksPerSecond, ballMassKg: 0.145, ballRadiusMeters: p.ballRadius,
          pocketRadiusMeters: 0.2, centerRetentionCapacityJ: 1_000_000, captureDissipationPowerW: 1000,
          failedContactRestitution: material.restitution, failedTangentialDamping: material.tangentialDamping, failedSpinDamping: material.spinDamping },
      }) })), surfaces: worldContact.model.surfaces.map((s) => ({ surfaceId: s.surfaceId, material })) };
  const responseSource: AcceptedBattedContactResponse = { sourceId: 'response', sourceVersion: 'fixture-v1',
    firstFielderTouchSourceId: touchSource.sourceId, responseModelSourceId: responseModel.sourceId };
  const responseModels = new Map([[responseModel.sourceId, responseModel]]), responseSources = new Map([[responseSource.sourceId, responseSource]]);
  const responseAuthority = { readAcceptedResponse: (id: string) => responseSources.get(id) ?? null, readAcceptedModel: (id: string) => responseModels.get(id) ?? null };
  const responses = f.track(openSqliteBattedContactResponseStore(f.path, touches, responseAuthority));
  return { ...base, worldContact, touchSource, touches, touch, responseModel, responseSource, responseModels, responseSources, responseAuthority, responses };
};

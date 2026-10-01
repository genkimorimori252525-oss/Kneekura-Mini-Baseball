import { battedWorldContactFixture } from './BattedWorldContactFixtures.test-support';
import type { DefenderPhysicalPrimitiveRole } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { openSqliteBattedFirstFielderTouchStore, type AcceptedBattedFirstFielderTouch } from './SqliteBattedFirstFielderTouchStore';

export const battedFirstFielderTouchFixture = (path?: string, role: DefenderPhysicalPrimitiveRole | 'ground' | 'surface' | 'batter' | 'simultaneous' | 'airborne' = 'body') => {
  const base = battedWorldContactFixture(path), { f, model, models, source, sources, flight, contacts } = base;
  const at = flight.flight.contact.tick, ball = flight.flight.initialBall.position;
  if (role === 'airborne') sources.set(source.sourceId, { ...source, flightSourceId: base.input.sourceId });
  else if (role === 'surface') models.set(model.sourceId, { ...model, surfaces: [{ surfaceId: 'panel',
    start: { x: ball.x - 1, z: ball.z }, end: { x: ball.x + 1, z: ball.z }, minimumHeight: 0, maximumHeight: ball.y + 1 }] });
  else if (role !== 'ground') {
    const original = flight.physicalPitch.frame.world;
    const pitcher = original.defenders.find((d) => d.playerId === 'p2')!;
    const dt = (at - original.tick) / flight.source.execution.ballFlightParameters.ticksPerSecond;
    const root = { x: pitcher.position.x + pitcher.velocity.x * dt, y: 0, z: pitcher.position.z + pitcher.velocity.z * dt };
    models.set(model.sourceId, { ...model, actors: model.actors.map((a) => a.playerId === 'p2'
      ? { ...a, primitives: a.primitives.map((p) => p.role === (role === 'simultaneous' ? 'body' : role)
        || role === 'simultaneous' && p.role === 'glove' ? { ...p, offset: { x: ball.x - root.x, y: ball.y, z: ball.z - root.z } } : p) }
      : role === 'batter' && a.playerId === flight.physicalPitch.frame.batterActor!.binding.playerId
        ? { ...a, primitives: a.primitives.map((p) => p.role === 'body' ? { ...p,
          offset: { x: model.batterGripOffset.x + 0.4, y: model.batterGripOffset.y, z: model.batterGripOffset.z } } : p) } : a) });
  }
  const worldContact = contacts.accept(source.sourceId);
  const touchSource: AcceptedBattedFirstFielderTouch = { sourceId: 'first-fielder-touch', sourceVersion: 'fixture-v1', worldContactSourceId: source.sourceId };
  const touchSources = new Map([[touchSource.sourceId, touchSource]]);
  const touchAuthority = { readAcceptedTouch: (id: string) => touchSources.get(id) ?? null };
  const touches = f.track(openSqliteBattedFirstFielderTouchStore(f.path, contacts, touchAuthority));
  return { ...base, worldContact, touchSource, touchSources, touchAuthority, touches };
};

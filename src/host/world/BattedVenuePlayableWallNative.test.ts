// Genuine Native consumer gate for the coordinator's consolidated run.
import { expect, it } from 'vitest';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { AcceptedBattedVenuePlayableWallPolicy } from './BattedVenuePlayableWallPolicy';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('WALL-N01 binds an actual later wall to accepted grounded-fair policy and replays its immutable original venue', () => {
  // This explicit test geometry/material is a physical input, not game calibration.
  const x = battedWorldFieldFixture(undefined, true, false, undefined, { groundRestitution: 0,
    world(world) {
      const parameters = world.flight.source.execution.ballFlightParameters;
      const forecast = createBattedBallFlightEvidence({ contact: world.flight.flight.contact, parameters, searchDurationTicks: 2_000_000 });
      const ground = forecast.firstGroundContact!;
      const v = ground.state.velocity, length = Math.hypot(v.x, v.z);
      if (!(length > 0)) throw new Error('WALL_NATIVE_GROUND_APPROACH_REQUIRED');
      const center = { x: ground.state.position.x + v.x / length * 0.5, z: ground.state.position.z + v.z / length * 0.5 };
      const model = world.models.get(world.model.sourceId)!;
      world.models.set(model.sourceId, { ...model, surfaces: [{ surfaceId: 'accepted-playable-wall',
        start: { x: center.x - v.z / length * 10, z: center.z + v.x / length * 10 },
        end: { x: center.x + v.z / length * 10, z: center.z - v.x / length * 10 }, minimumHeight: 0, maximumHeight: 10 }] });
    } });
  try {
    let field = x.fields.accept(x.source.sourceId);
    const isWall = () => field.field.motion.world.kind === 'boundary'
      && field.field.motion.world.contacts.length === 1
      && field.field.motion.world.contacts[0].kind === 'surface'
      && field.field.motion.world.contacts[0].surfaceId === 'accepted-playable-wall';
    for (let i = 0; i < 16 && !isWall(); i++) {
      const source = { ...x.source, sourceId: `wall-physical-${i}`, previousFieldSourceId: field.source.sourceId };
      x.sources.set(source.sourceId, source); field = x.fields.accept(source.sourceId);
    }
    expect(isWall(), 'WALL_NATIVE_PHYSICAL_CONTACT_PREREQUISITE').toBe(true);
    const world = field.response.touch.worldContact, pitch = world.flight.physicalPitch;
    const policy: AcceptedBattedVenuePlayableWallPolicy = { sourceId: 'venue-wall', sourceVersion: 'explicit-fixture-v1',
      version: 'batted_venue_playable_wall_policy_v1', gameId: pitch.frame.gameId, playId: pitch.frame.match.playId,
      physicalPitchSourceId: pitch.source.sourceId, fixtureEventId: world.model.fixtureEventId, venueId: world.model.venueId,
      baseFieldSourceId: field.source.sourceId, worldModelSourceId: world.model.sourceId,
      worldModelSourceVersion: world.model.sourceVersion, availableAtDay: pitch.frame.batterActor!.binding.gameDay,
      rulePolicy: { version: 'grounded_fair_playable_wall_v1', ruleProfileId: pitch.frame.match.ruleProfileId,
        rulesRevision: '2026', surfaceIds: ['accepted-playable-wall'] } };
    const legacy: AcceptedBattedWorldFieldExecution = { sourceId: 'wall-rule-legacy', sourceVersion: 'v1',
      baseFieldSourceId: field.source.sourceId, previousExecutionSourceId: null, action: { kind: 'first_base_race' } };
    const sources = new Map([[legacy.sourceId, legacy]]), authority = { readAcceptedExecution: (id: string) => sources.get(id) ?? null };
    const store = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, authority));
    const old = store.accept(legacy.sourceId);
    if (old.execution.kind !== 'first_base_race') throw new Error('first-base rule expected');
    expect(old.execution.pendingContacts).toContainEqual(expect.objectContaining({ reason: 'surface_policy_pending' }));
    expect(old.execution.groundRule).toBeNull();
    const source: AcceptedBattedWorldFieldExecution = { ...legacy, sourceId: 'wall-rule-policy', previousExecutionSourceId: legacy.sourceId,
      action: { kind: 'first_base_race', venuePolicy: policy } };
    sources.set(source.sourceId, source);
    const originalMatch = json(x.f.official.getMatch(pitch.frame.gameId));
    const physicalRows = () => json(x.f.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY source_id').all());
    const before = physicalRows(), value = store.accept(source.sourceId);
    if (value.execution.kind !== 'first_base_race') throw new Error('first-base rule expected');
    expect(value.execution.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair' });
    expect(value.execution.pendingContacts).toEqual([]); expect(value.execution.groundRule).not.toBeNull();
    expect(value.execution.playableWallEvidence?.contacts).toHaveLength(1);
    expect(value.execution.venuePolicyReference?.rawContacts).toContainEqual(expect.objectContaining({ sourceId: field.source.sourceId,
      contact: expect.objectContaining({ kind: 'surface', surfaceId: 'accepted-playable-wall' }) }));
    expect(physicalRows()).toBe(before); expect(json(x.f.official.getMatch(pitch.frame.gameId))).toBe(originalMatch);
    expect(value.execution).not.toHaveProperty('playEnd'); expect(value.execution).not.toHaveProperty('officialRuling');
    expect(store.accept(source.sourceId)).toEqual(value);
    const reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    expect(reopened.read(source.sourceId)).toEqual(value); expect(reopened.accept(source.sourceId)).toEqual(value);
    const foreign: AcceptedBattedWorldFieldExecution = { ...source, sourceId: 'wall-rule-foreign', previousExecutionSourceId: source.sourceId,
      action: { kind: 'first_base_race', venuePolicy: { ...policy, venueId: 'foreign-venue' } } };
    sources.set(foreign.sourceId, foreign);
    const executionsBefore = json(x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY source_id').all());
    expect(() => store.accept(foreign.sourceId)).toThrow('playable-wall policy differs from original physical venue scope');
    expect(json(x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY source_id').all())).toBe(executionsBefore);
    expect(physicalRows()).toBe(before);
  } finally { x.f.close(); }
}, 120_000);

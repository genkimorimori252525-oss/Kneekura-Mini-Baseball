import { expect, it } from 'vitest';
import { battedWorldContactFixture as fixture } from './BattedWorldContactFixtures.test-support';
import { openSqliteBattedWorldContactStore } from './SqliteBattedWorldContactStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('executes the actual ten Player/Person actors from original World and swing, then reopens without caller contact or rule results', () => {
  const { f, flight, source, model, contacts, flights, models, sources } = fixture();
  try {
    const value = contacts.accept(source.sourceId);
    expect(value.flight).toEqual(flight);
    expect(value.model).toEqual(model);
    expect(value.actors).toHaveLength(50);
    expect(new Set(value.actors.map((a) => a.playerId))).toEqual(new Set(source.commands.map((a) => a.playerId)));
    const body = value.actors.find((a) => a.playerId === 'p2' && a.primitive.role === 'body')!;
    const original = flight.physicalPitch.frame.world.defenders.find((d) => d.playerId === 'p2')!;
    expect(body.primitive.startCenter.x).toBe(original.position.x);
    expect(body.primitive.startCenter.z).toBe(original.position.z);
    expect(value.result.kind).toBe('contact');
    expect(value.result).toMatchObject({ contacts: [{ kind: 'ground' }] });
    expect(value.timeline.events.at(-1)?.kind).toBe('BattedBallFirstGroundContact');
    expect(value.timeline.status.kind).toBe('batted_ball_pending');
    expect(f.official.getMatch('game-1')!.durableRevision).toBe(0);
    expect(f.workload.readHead('career-a', 'p2')!.revision).toBe(0);
    models.clear(); sources.clear();
    const reopened = f.track(openSqliteBattedWorldContactStore(f.path, flights));
    expect(reopened.read(source.sourceId)).toEqual(value);
    expect(reopened.accept(source.sourceId)).toEqual(value);
  } finally { f.close(); }
});

it('does not append a forecast ground event when an actual surface is contacted earlier', () => {
  const { f, flight, model, models, source, contacts } = fixture();
  try {
    const ball = flight.flight.initialBall.position;
    models.set(model.sourceId, { ...model, surfaces: [{ surfaceId: 'actual-venue-panel', start: { x: ball.x - 1, z: ball.z },
      end: { x: ball.x + 1, z: ball.z }, minimumHeight: 0, maximumHeight: ball.y + 1 }] });
    const value = contacts.accept(source.sourceId);
    expect(value.result).toMatchObject({ kind: 'contact', tick: flight.flight.contact.tick,
      contacts: [{ kind: 'surface', surfaceId: 'actual-venue-panel' }] });
    expect(value.timeline).toEqual(flight.physicalPitch.result.pitch.resolution.timeline);
    expect(value.timeline.events.some((e) => e.kind === 'BattedBallFirstGroundContact')).toBe(false);
  } finally { f.close(); }
});

it.each(['missing_actor', 'wrong_person', 'pitcher_body', 'missing_primitive', 'wrong_venue', 'future_day', 'caller_result'])
('rejects %s rather than silently replacing actual geometry or scope', (kind) => {
  const { f, model, source, models, sources, contacts } = fixture();
  try {
    if (kind === 'missing_actor') models.set(model.sourceId, { ...model, actors: model.actors.filter((a) => a.playerId !== 'p2') });
    if (kind === 'wrong_person') models.set(model.sourceId, { ...model, actors: model.actors.map((a, i) => i ? a : { ...a, personId: 'another-person' }) });
    if (kind === 'pitcher_body') models.set(model.sourceId, { ...model, actors: model.actors.map((a) => a.playerId === 'p2' ? { ...a, heightMeters: a.heightMeters + 0.1 } : a) });
    if (kind === 'missing_primitive') models.set(model.sourceId, { ...model, actors: model.actors.map((a, i) => i ? a : { ...a, primitives: a.primitives.slice(1) }) });
    if (kind === 'wrong_venue') models.set(model.sourceId, { ...model, venueId: 'another-venue' });
    if (kind === 'future_day') models.set(model.sourceId, { ...model, availableAtDay: 12 });
    if (kind === 'caller_result') sources.set(source.sourceId, { ...source, result: { kind: 'out' } } as typeof source);
    expect(() => contacts.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_contacts').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

it('extends only an airborne original prefix with unchanged model and commands', () => {
  const { f, input, source, contacts, sources, flight, flights } = fixture();
  try {
    const first = { ...source, sourceId: 'early-contact', flightSourceId: input.sourceId };
    sources.set(first.sourceId, first);
    const early = contacts.accept(first.sourceId);
    expect(early.result.kind).toBe('airborne');
    sources.set(source.sourceId, { ...source, previousContactSourceId: first.sourceId });
    const extended = contacts.accept(source.sourceId);
    expect(extended.revision).toBe(2);
    expect(extended.flight).toEqual(flight);
    expect(contacts.read(first.sourceId)).toEqual(early);
    const bad = { ...source, sourceId: 'changed-commands', previousContactSourceId: source.sourceId,
      commands: source.commands.map((c, i) => i ? c : { ...c, bodyAcceleration: { x: 1, y: 0, z: 0 } }) };
    sources.set(bad.sourceId, bad);
    expect(() => contacts.accept(bad.sourceId)).toThrow();
    expect(flights.read(input.sourceId)).not.toBeNull();
  } finally { f.close(); }
});

it('freezes the actual full registered game roster without executing reserve actors or losing their Person evidence', () => {
  const { f, model, models, source, contacts } = fixture();
  try {
    const bindings = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=?').all(model.gameId)
      .map((row) => JSON.parse(row.binding_json as string) as OfficialParticipantBinding);
    expect(bindings).toHaveLength(18);
    const full = { ...model, actors: bindings.map((b) => model.actors.find((a) => a.playerId === b.playerId)
      ?? { ...model.actors[0], playerId: b.playerId, personId: b.personId }) };
    models.set(model.sourceId, full);
    const value = contacts.accept(source.sourceId);
    expect(value.model.actors).toHaveLength(18);
    expect(value.modelActorEvidence).toHaveLength(18);
    expect(value.actors).toHaveLength(50);
    f.db.prepare("UPDATE world_player_person_links SET person_id='changed' WHERE player_id=?").run(bindings.find((b) => !source.commands.some((a) => a.playerId === b.playerId))!.playerId);
    expect(() => contacts.read(source.sourceId)).toThrow();
  } finally { f.close(); }
});

it.each(['roster_revision', 'future_person'])('rejects invalid reserve %s before freezing original model evidence', (kind) => {
  const { f, model, source, contacts } = fixture();
  try {
    const reserve = model.actors.find((a) => !source.commands.some((c) => c.playerId === a.playerId))!;
    if (kind === 'roster_revision') {
      const row = f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get(model.gameId, reserve.playerId)!;
      const b = { ...JSON.parse(row.binding_json as string), rosterRevision: -1 };
      f.db.prepare('UPDATE official_participant_bindings SET binding_json=? WHERE game_id=? AND player_id=?').run(JSON.stringify(b), model.gameId, reserve.playerId);
    } else {
      const row = f.db.prepare('SELECT source_json FROM world_player_person_links WHERE player_id=?').get(reserve.playerId)!;
      const person = { ...JSON.parse(row.source_json as string), acceptedAtDay: 999 };
      f.db.prepare('UPDATE world_player_person_links SET source_json=?,accepted_at_day=? WHERE player_id=?').run(actorJson(person), person.acceptedAtDay, reserve.playerId);
    }
    expect(() => contacts.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_contacts').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});

import { expect, it, vi } from 'vitest';
import { ownedRunnerFieldInputs, zero } from './OwnedRunnerFieldFixtures.test-support';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { prePitchRunnerContactPrimitives, buildPrePitchRunnerController } from './PrePitchRunnerExecution';
import { sampleRouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any, bases: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases }) }));
const fixture = (configure?: (x: ReturnType<typeof ownedRunnerFieldInputs>) => void) => {
  const x = ownedRunnerFieldInputs(); configure?.(x); state.flight = x.flight;
  const world = x.deriveWorld(), root = x.deriveRoot(world); state.response = root.response; state.bases = x.bases;
  return { ...x, ...root, world, own: battedWorldFieldEvidenceFromSqlite(x.db) };
};
const identities = (actors: readonly { playerId: string; primitive: { role: string } }[]) => actors.map(a => json([a.playerId, a.primitive.role])).sort();

// RED target: field-specific response/runner retention is absent; the generic adapter rejects the root.
it('advances all eleven actors to two real field horizons without creating an eleventh caller command', () => {
  const x = fixture();
  try {
    const first = x.own.derive(x.source); x.archive(first);
    expect(first.field.motion.world.kind).toBe('moving');
    expect(first.field.motion.world.moment.elapsedSeconds).toBeCloseTo(0.1, 12);
    const next = { ...x.source, sourceId: 'runner-field-2', previousFieldSourceId: first.source.sourceId, throughTick: x.source.throughTick + 100_000 };
    const second = x.own.derive(next);
    expect(second.revision).toBe(2); expect(second.field.motion.world.moment.elapsedSeconds).toBeCloseTo(0.2, 12);
    expect(second.field.motion.actors).toHaveLength(55);
    expect(identities(second.field.motion.actors)).toEqual(identities(x.world.actors));
    expect(second.source.commands).toHaveLength(10);
    expect(second.source.commands.some(c => c.playerId === 'runner')).toBe(false);
    const runner = x.flight.physicalPitch.frame.prePitchRunner, shape = x.model.actors.find(a => a.playerId === 'runner')!;
    const expected = prePitchRunnerContactPrimitives(runner.source, runner.canonical, runner.controller, shape.primitives, shape.bodyOriginHeightMeters,
      x.flight.flight.contact.tick, next.throughTick, 1_000_000);
    for (const actual of second.field.motion.actors.filter(a => a.playerId === 'runner')) {
      const original = expected.find(a => a.primitive.role === actual.primitive.role)!.primitive;
      const dt = (actual.primitive.startTick - original.startTick) / 1_000_000 + (actual.startElapsedSeconds ?? 0);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(actual.primitive.startCenter[axis]).toBeCloseTo(original.startCenter[axis] + original.startVelocity[axis] * dt + 0.5 * original.acceleration[axis] * dt * dt, 11);
        expect(actual.primitive.startVelocity[axis]).toBeCloseTo(original.startVelocity[axis] + original.acceleration[axis] * dt, 11);
        expect(actual.primitive.acceleration[axis]).toBe(original.acceleration[axis]);
      }
    }
  } finally { x.db.close(); }
});

it('finds an actual later moving-runner collision that a stationary counterfactual misses', () => {
  const x = fixture();
  try {
    const source = { ...x.source, throughTick: x.flight.flight.contact.tick + 500_000 }, value = x.own.derive(source);
    const world = value.field.motion.world;
    expect(world.kind).toBe('boundary');
    if (world.kind !== 'boundary') throw new Error('expected actual runner boundary');
    expect(world.contacts).toMatchObject([{ kind: 'actor', playerId: 'runner', role: 'body' }]);
    expect(world.moment.elapsedSeconds).toBeGreaterThan(0); expect(world.moment.elapsedSeconds).toBeLessThan(0.5);
    const stationary = x.world.actors.map(a => a.playerId === 'runner' ? { ...a, primitive: { ...a.primitive, startVelocity: zero, acceleration: zero } } : a);
    const commands = stationary.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: zero }));
    const counterfactual = deriveInitialBattedWorldFieldMotion({ response: { ...x.responseInput, world: { ...x.responseInput.world, actors: stationary } },
      geometry: x.geometry.geometry, availableAtTick: source.availableAtTick, throughTick: source.throughTick, commands });
    expect(counterfactual.motion.world.kind).toBe('moving');
    expect(value.field.motion.carrierPlayerId).toBeNull(); expect(value).not.toHaveProperty('playEnd');
  } finally { x.db.close(); }
});

it('retains every nonzero runner relative-pose velocity and acceleration from original World time', () => {
  const x = fixture(x => {
    const runner = x.flight.physicalPitch.frame.prePitchRunner as any;
    runner.source.bodyPose.primitiveMotions.forEach((part: any, index: number) => {
      part.offsetVelocity = { x: 0.1 * (index + 1), y: 0.02 * index, z: -0.03 * index };
      part.offsetAcceleration = { x: 0.04 * (index + 1), y: 0.01 * index, z: -0.02 * index };
    });
    x.db.prepare('UPDATE batted_world_field_geometries SET snapshot_json=?,snapshot_hash=?').run(json(x.geometry), hash(x.geometry));
  });
  try {
    const value = x.own.derive(x.source), runner = x.flight.physicalPitch.frame.prePitchRunner;
    const actualTime = value.field.motion.world.moment.elapsedSeconds, absoluteTick = x.flight.flight.contact.tick + Math.round(actualTime * 1_000_000);
    expect(absoluteTick).toBe(x.source.throughTick);
    const root = sampleRouteFollowingController(runner.controller, runner.canonical, absoluteTick);
    const fromWorld = (absoluteTick - runner.canonical.tick) / 1_000_000;
    const parts = value.field.motion.actors.filter(a => a.playerId === 'runner'); expect(parts).toHaveLength(5);
    for (const part of parts) {
      const pose = runner.source.bodyPose.primitiveMotions.find(p => p.role === part.primitive.role)!;
      const expectedRoot = { x: root.position.x, y: runner.source.bodyPose.bodyOriginHeightMeters, z: root.position.z };
      const dt = (x.flight.flight.contact.tick - part.primitive.startTick) / 1_000_000 + actualTime - (part.startElapsedSeconds ?? 0);
      for (const axis of ['x', 'y', 'z'] as const) {
        const actual = part.primitive.startCenter[axis] + part.primitive.startVelocity[axis] * dt + 0.5 * part.primitive.acceleration[axis] * dt * dt;
        const expected = expectedRoot[axis] + pose.startOffset[axis] + pose.offsetVelocity[axis] * fromWorld + 0.5 * pose.offsetAcceleration[axis] * fromWorld * fromWorld;
        expect(actual).toBeCloseTo(expected, 11);
      }
    }
  } finally { x.db.close(); }
});

it('continues from a genuine fractional rebound cursor without advancing runner bodies to its rounded tick', () => {
  const x = fixture();
  try {
    const first = x.own.derive({ ...x.source, throughTick: x.source.availableAtTick + 500_000 });
    expect(first.field.motion.response.kind).toBe('rebound');
    const cursor = first.field.motion.cursor;
    if (!cursor) throw new Error('fixture requires an actual runner-body rebound cursor');
    const exact = cursor.moment.elapsedSeconds, rounded = (cursor.moment.ball.tick - cursor.moment.originTick) / 1_000_000;
    expect(exact).toBeGreaterThan(0); expect(rounded).toBeGreaterThan(exact);
    expect(rounded - exact).toBeLessThan(1 / 1_000_000);
    x.archive(first);
    const source = { ...x.source, sourceId: 'runner-field-after-rebound', previousFieldSourceId: first.source.sourceId,
      throughTick: x.source.availableAtTick + 600_000 };
    const second = x.own.derive(source);
    expect(second.field.motion.world.kind).toBe('moving');
    expect(second.field.motion.world.moment.elapsedSeconds).toBeCloseTo(0.6, 12);
    expect(identities(second.field.motion.actors)).toEqual(identities(first.field.motion.actors));
    for (const actor of second.field.motion.actors.filter(a => a.playerId === 'runner')) {
      const prior = first.field.motion.actors.find(a => a.playerId === actor.playerId && a.primitive.role === actor.primitive.role)!;
      const dt = (cursor.moment.originTick - prior.primitive.startTick) / 1_000_000 + exact - (prior.startElapsedSeconds ?? 0);
      expect(actor.startElapsedSeconds).toBe(exact); expect(actor.primitive.endTick).toBe(source.throughTick);
      for (const axis of ['x', 'y', 'z'] as const) {
        const expectedPosition = prior.primitive.startCenter[axis] + prior.primitive.startVelocity[axis] * dt + 0.5 * prior.primitive.acceleration[axis] * dt * dt;
        const expectedVelocity = prior.primitive.startVelocity[axis] + prior.primitive.acceleration[axis] * dt;
        expect(actor.primitive.startCenter[axis]).toBeCloseTo(expectedPosition, 11);
        expect(actor.primitive.startVelocity[axis]).toBeCloseTo(expectedVelocity, 11);
      }
      const roundedDt = dt + rounded - exact;
      const roundedX = prior.primitive.startCenter.x + prior.primitive.startVelocity.x * roundedDt + 0.5 * prior.primitive.acceleration.x * roundedDt * roundedDt;
      expect(Math.abs(actor.primitive.startCenter.x - roundedX)).toBeGreaterThan(1e-10);
    }
  } finally { x.db.close(); }
});

// Review RED target: the legacy field kernel compares the requested horizon to
// the rounded event tick, rejecting a still-unexecuted fraction of this curve.
it('executes the remaining fraction of the final covered tick after a real runner rebound', () => {
  const x = fixture(x => {
    const runner = x.flight.physicalPitch.frame.prePitchRunner as any;
    const model = x.model.actors.find(actor => actor.playerId === 'runner')!;
    const body = prePitchRunnerContactPrimitives(runner.source, runner.canonical, runner.controller, model.primitives,
      model.bodyOriginHeightMeters, x.source.availableAtTick, x.source.availableAtTick, 1_000_000).find(actor => actor.primitive.role === 'body')!.primitive;
    const remaining = x.flight.flight.initialBall.position.x - body.startCenter.x - body.radius - x.flight.source.execution.ballFlightParameters.ballRadius;
    const collisionSeconds = (-body.startVelocity.x + Math.sqrt(body.startVelocity.x ** 2 + 2 * body.acceleration.x * remaining)) / body.acceleration.x;
    runner.source.coverageThroughTick = x.source.availableAtTick + Math.ceil(collisionSeconds * 1_000_000);
    runner.controller = buildPrePitchRunnerController(runner.source, runner.canonical);
    x.db.prepare('UPDATE batted_world_field_geometries SET snapshot_json=?,snapshot_hash=?').run(json(x.geometry), hash(x.geometry));
  });
  try {
    const throughTick = x.flight.physicalPitch.frame.prePitchRunner.source.coverageThroughTick;
    const first = x.own.derive({ ...x.source, throughTick }), cursor = first.field.motion.cursor;
    expect(first.field.motion.response.kind).toBe('rebound');
    if (!cursor) throw new Error('fixture requires a real fractional rebound');
    expect(cursor.moment.ball.tick).toBe(throughTick);
    const endpoint = (throughTick - cursor.moment.originTick) / 1_000_000;
    expect(cursor.moment.elapsedSeconds).toBeLessThan(endpoint);
    x.archive(first);
    const source = { ...x.source, sourceId: 'runner-last-covered-fraction', previousFieldSourceId: first.source.sourceId, throughTick };
    const second = x.own.derive(source);
    expect(second.field.motion.world.kind).toBe('moving');
    expect(second.field.motion.world.moment.elapsedSeconds).toBe(endpoint);
    expect(second.field.motion.world.moment.ball.tick).toBe(throughTick);
    expect(second.field.motion.actors).toHaveLength(55);
    expect(second.field.motion.actors.filter(actor => actor.playerId === 'runner').every(actor => actor.primitive.endTick === throughTick)).toBe(true);
    expect(() => x.own.derive({ ...source, sourceId: 'runner-beyond-covered-fraction', throughTick: throughTick + 1 })).toThrow(/coverage/);
  } finally { x.db.close(); }
});

it('keeps registered inactive calibration profiles outside the fifty-five active field parts', () => {
  const x = fixture(x => {
    const row = x.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE player_id=?').get('defender-0')!;
    const originalBinding = JSON.parse(row.binding_json as string);
    const binding = { ...originalBinding, playerId: 'bench-defender', personId: 'bench-person', personLinkSourceId: 'bench-link' };
    const originalPerson = x.db.prepare('SELECT source_json FROM world_player_person_links WHERE source_id=?').get(originalBinding.personLinkSourceId)!;
    const person = { ...JSON.parse(originalPerson.source_json as string), sourceId: binding.personLinkSourceId,
      playerId: binding.playerId, personId: binding.personId, sourceRecordId: 'bench-intake' };
    x.db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run(binding.gameId, binding.playerId, JSON.stringify(binding));
    x.db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(person.sourceId, person.careerId, person.playerId,
      person.personId, person.rosterRevision, person.acceptedAtDay, json(person));
    (x.model.actors as any[]).push({ ...x.model.actors[1], playerId: binding.playerId, personId: binding.personId });
    (x.responseModel.actors as any[]).push({ ...x.responseModel.actors[1], playerId: binding.playerId, personId: binding.personId });
  });
  try {
    expect(x.response.model.actors).toHaveLength(12);
    const value = x.own.derive(x.source);
    expect(value.field.motion.actors).toHaveLength(55);
    expect(value.field.motion.actors.some(a => a.playerId === 'bench-defender')).toBe(false);
    expect(identities(value.field.motion.actors)).toEqual(identities(x.world.actors));
  } finally { x.db.close(); }
});

it('reopens a bounded field cut without replaying a future payload, but rejects corrupt future metadata', () => {
  const x = fixture();
  try {
    const first = x.own.derive(x.source); x.archive(first);
    const second = x.own.derive({ ...x.source, sourceId: 'runner-field-2', previousFieldSourceId: first.source.sourceId, throughTick: x.source.throughTick + 100_000 });
    x.archive(second);
    x.db.prepare('UPDATE batted_world_field_actions SET source_json=?,snapshot_json=? WHERE source_id=?').run('{future-unreadable', '{future-unreadable', second.source.sourceId);
    expect(battedWorldFieldEvidenceFromSqlite(x.db).read(first.source.sourceId)).toEqual(first);
    x.db.prepare('UPDATE batted_world_field_actions SET revision=? WHERE source_id=?').run(2.5, second.source.sourceId);
    expect(() => battedWorldFieldEvidenceFromSqlite(x.db).read(first.source.sourceId)).toThrow(/metadata|head/);
  } finally { x.db.close(); }
});

it.each(['untagged', 'wrong_runner', 'runner_command', 'missing_defender', 'coverage', 'source_result'] as const)
('rejects %s instead of broadening owned runner field authority', kind => {
  const x = fixture();
  try {
    const source = structuredClone(x.source) as any;
    if (kind === 'untagged') { delete source.kind; delete source.prePitchRunnerSourceId; }
    if (kind === 'wrong_runner') source.prePitchRunnerSourceId = 'another-runner';
    if (kind === 'runner_command') source.commands.push({ ...source.commands[0], playerId: 'runner' });
    if (kind === 'missing_defender') source.commands[0].playerId = 'runner';
    if (kind === 'coverage') source.throughTick = x.flight.physicalPitch.frame.prePitchRunner.source.coverageThroughTick + 1;
    if (kind === 'source_result') source.afterWorld = x.world;
    expect(() => x.own.derive(source)).toThrow();
  } finally { x.db.close(); }
});

it('rejects a field endpoint beyond a fractional top-speed boundary even though original future coverage is longer', () => {
  const x = fixture(x => {
    const runner = x.flight.physicalPitch.frame.prePitchRunner as any;
    runner.source.parameters.topSpeedMps = 4.2000005;
    runner.controller = buildPrePitchRunnerController(runner.source, runner.canonical);
    // The original frame Source and geometry dependency share this prospective fixture input.
    x.db.prepare('UPDATE batted_world_field_geometries SET snapshot_json=?,snapshot_hash=?').run(json(x.geometry), hash(x.geometry));
  });
  try {
    expect(x.flight.physicalPitch.frame.prePitchRunner.controller.trajectory.segments).toHaveLength(2);
    const before = x.own.derive(x.source);
    expect(before.field.motion.world.moment.elapsedSeconds).toBeCloseTo(0.1, 12);
    expect(() => x.own.derive({ ...x.source, throughTick: x.source.throughTick + 1 })).toThrow(/analytic|boundary|coverage/);
  } finally { x.db.close(); }
});

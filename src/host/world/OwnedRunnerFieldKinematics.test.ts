import { expect, it, vi } from 'vitest';
import { ownedRunnerKinematicsFixture, requireOwnedRunnerFieldRead } from './OwnedRunnerFieldKinematicsContracts.test-support';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';
import { actualPlayerKinematicsFromOriginalContact } from './ActualPlayerKinematicsFromOriginalContact';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { sampleRouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { buildPrePitchRunnerController } from './PrePitchRunnerExecution';
import { ownedRunnerFieldInputs } from './OwnedRunnerFieldFixtures.test-support';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { createBattedWorldBaseGeometry } from '../../core/sim/ball/BattedWorldBaseGeometry';
import { createBattedWorldFieldGeometry } from '../../core/sim/ball/BattedWorldFieldMotion';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any, bases: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases }) }));

it('reads all eleven identities and fifty-five parts at the selected actual field cut', () => {
  const x = ownedRunnerKinematicsFixture(state);
  try {
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db));
    const players = [...new Set(x.second.field.motion.actors.map(actor => actor.playerId))];
    const values = players.map(playerId => read({ ...x.cut, playerId }));
    expect(values).toHaveLength(11); expect(values.flatMap(value => value.roles)).toHaveLength(55);
    for (const value of values) {
      expect(value.version).toBe('owned_runner_field_kinematics_v1');
      expect(value.personId).toBe(`${value.playerId}-person`);
      expect(value.at).toEqual({ originTick: x.source.availableAtTick, elapsedSeconds: 0.2, tick: x.second.source.throughTick });
      expect(value.physicalPrefix.version).toBe('owned_runner_field_physical_prefix_v1');
      expect(value.physicalPrefix.participants).toHaveLength(11);
      expect(value.physicalPrefix.segments).toHaveLength(3);
      expect(value.physicalPrefix.segments[0]).toEqual({ originTick: x.source.availableAtTick,
        startElapsedSeconds: 0, endElapsedSeconds: 0, actors: x.world.actors });
      expect(value.physicalPrefix.segments.at(-1)!.actors).toEqual(x.second.field.motion.actors);
      const executed = value.physicalPrefix.segments.filter(segment => segment.endElapsedSeconds > segment.startElapsedSeconds);
      const firstAt = x.first.field.motion.world.moment.elapsedSeconds, secondAt = x.second.field.motion.world.moment.elapsedSeconds;
      expect(executed.map(segment => [segment.startElapsedSeconds, segment.endElapsedSeconds])).toEqual([[0, firstAt], [firstAt, secondAt]]);
      expect(executed.map(segment => segment.actors)).toEqual([x.first.field.motion.actors, x.second.field.motion.actors]);
      expect(value.physicalPrefix.segments.every(segment => segment.endElapsedSeconds <= value.at.elapsedSeconds)).toBe(true);
      expect(value.execution).toEqual({ owner: 'batted_world_field_actions', sourceId: x.second.source.sourceId, revision: 2,
        sourceHash: hash(x.second.source), snapshotHash: hash(x.second), executedThrough: value.at });
      expect(value.dependencyHashes.field).toBe(hash(x.second));
      expect(value.dependencyHashes.worldContact).toBe(hash(x.world));
      expect(value.dependencyHashes.physicalPrefix).toBe(hash(value.physicalPrefix));
      expect(value).not.toHaveProperty('activeCommand'); expect(value).not.toHaveProperty('playEnd');
      expect(value.physicalPrefix).not.toHaveProperty('controlWindows'); expect(value.physicalPrefix).not.toHaveProperty('ruleEvidence');
    }
  } finally { x.db.close(); }
});

it('keeps original runner controller authority distinct from field execution and unexecuted accepted coverage', () => {
  const x = ownedRunnerKinematicsFixture(state);
  try {
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), value = read(x.cut);
    const runner = x.flight.physicalPitch.frame.prePitchRunner;
    const canonical = sampleRouteFollowingController(runner.controller, runner.canonical, value.at.tick);
    const expected = { position: { x: canonical.position.x, y: runner.source.bodyPose.bodyOriginHeightMeters, z: canonical.position.z },
      velocity: { x: canonical.velocity.x, y: 0, z: canonical.velocity.z } };
    // Contact- and World-anchored analytic forms retain the existing finite
    // reconciliation tolerance; identity and cleanup-sensitive roots remain exact.
    for (const part of ['position', 'velocity'] as const) for (const axis of ['x', 'y', 'z'] as const) {
      const actual = value.root[part][axis], reference = expected[part][axis];
      expect(Math.abs(actual - reference)).toBeLessThanOrEqual(Number.EPSILON * Math.max(1, Math.abs(actual), Math.abs(reference)) * 32);
    }
    expect(value.authority).toMatchObject({ owner: 'physical_pitch_progress_actions', sourceId: x.flight.source.physicalPitchSourceId,
      runnerSourceId: runner.source.sourceId, runnerSourceHash: hash(runner.source), motionRevision: runner.source.motionRevision,
      acceptedThroughTick: runner.source.coverageThroughTick });
    expect(value.at.tick).toBeLessThan(value.authority.acceptedThroughTick);
    expect(value.execution.sourceId).toBe(x.second.source.sourceId);
    expect(value.roles.every(role => role.canonicalActor.primitive.endTick === x.second.source.throughTick)).toBe(true);
    expect(value.origin.kind).toBe('pre_pitch_runner_controller');
  } finally { x.db.close(); }
});

it('uses actual defender command changes without assigning those commands to the original runner', () => {
  const x = ownedRunnerKinematicsFixture(state);
  try {
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db));
    const defender = read({ ...x.cut, playerId: 'defender-0' });
    expect(defender.origin.kind).toBe('defender_world_projection');
    expect(defender.authority).toMatchObject({ owner: 'batted_world_field_actions', sourceId: x.second.source.sourceId, acceptedThroughTick: x.second.source.throughTick });
    expect(defender.root.position.x).toBeCloseTo(-199.99, 11);
    expect(defender.root.velocity.x).toBeCloseTo(0.2, 11);
    expect(defender.root.acceleration.x).toBe(2);
    const foot = defender.roles.find(role => role.role === 'right_foot')!;
    expect(foot.declaredPose.offset.z).toBeCloseTo(0.002, 12);
    expect(foot.declaredPose.relativeVelocity.z).toBeCloseTo(0.04, 12);
    expect(read(x.cut).authority.owner).toBe('physical_pitch_progress_actions');
    expect(read({ ...x.cut, playerId: 'batter' }).origin.kind).toBe('batter_swing_grip');
  } finally { x.db.close(); }
});

it('keeps a fractional collision state at its real time instead of sampling the rounded event tick', () => {
  const x = ownedRunnerKinematicsFixture(state);
  try {
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db));
    const third = x.own.derive({ ...x.second.source, sourceId: 'runner-field-contact-cut', previousFieldSourceId: x.second.source.sourceId,
      throughTick: x.source.availableAtTick + 500_000 }); x.archive(third);
    const actual = third.field.motion.world.moment, value = read({ ...x.cut, fieldSourceId: third.source.sourceId });
    expect(value.at.elapsedSeconds).toBe(actual.elapsedSeconds); expect(value.at.tick).toBe(actual.ball.tick);
    expect(value.at.elapsedSeconds).toBeLessThan((value.at.tick - value.at.originTick) / 1_000_000);
    const elapsed = (value.at.originTick - x.flight.physicalPitch.frame.world.tick) / 1_000_000 + value.at.elapsedSeconds;
    expect(value.root.position.x).toBeCloseTo(10 + elapsed * elapsed, 11);
    expect(value.root.velocity.x).toBeCloseTo(2 * elapsed, 11);
    const runner = x.flight.physicalPitch.frame.prePitchRunner;
    const rounded = sampleRouteFollowingController(runner.controller, runner.canonical, value.at.tick);
    expect(Math.abs(value.root.position.x - rounded.position.x)).toBeGreaterThan(1e-10);
    expect(value.at.tick).toBeLessThan(third.source.throughTick);
  } finally { x.db.close(); }
});

it('preserves root and relative parts when reconciling every canonical field primitive', () => {
  const x = ownedRunnerKinematicsFixture(state);
  try {
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db));
    for (const playerId of ['runner', 'batter', 'defender-0']) {
      const value = read({ ...x.cut, playerId });
      for (const role of value.roles) {
        const primitive = role.canonicalActor.primitive;
        const dt = (value.at.originTick - primitive.startTick) / value.ticksPerSecond + value.at.elapsedSeconds - (role.canonicalActor.startElapsedSeconds ?? 0);
        for (const axis of ['x', 'y', 'z'] as const) {
          const center = primitive.startCenter[axis] + primitive.startVelocity[axis] * dt + 0.5 * primitive.acceleration[axis] * dt * dt;
          expect(value.root.position[axis] + role.declaredPose.offset[axis] + role.canonicalRoundingResidual.position[axis]).toBeCloseTo(center, 11);
          expect(value.root.velocity[axis] + role.declaredPose.relativeVelocity[axis] + role.canonicalRoundingResidual.velocity[axis])
            .toBeCloseTo(primitive.startVelocity[axis] + primitive.acceleration[axis] * dt, 11);
        }
      }
    }
  } finally { x.db.close(); }
});

it('leaves the legacy field reader closed and original-contact state at its earlier horizon', () => {
  const x = ownedRunnerKinematicsFixture(state);
  try {
    const owner = actualPlayerKinematicsEvidenceFromSqlite(x.db), read = requireOwnedRunnerFieldRead(owner);
    const original = actualPlayerKinematicsFromOriginalContact('runner', x.world);
    const observed = read(x.cut);
    expect(observed.at.elapsedSeconds).toBeGreaterThan(original.at.elapsedSeconds);
    expect(actualPlayerKinematicsFromOriginalContact('runner', x.world)).toEqual(original);
    expect(() => owner.read({ physicalPitchSourceId: x.cut.physicalPitchSourceId, playerId: 'runner', baseFieldSourceId: x.cut.fieldSourceId,
      executionSourceId: null, mode: 'original' })).toThrow(/unsupported original pre-pitch runner consumer/);
  } finally { x.db.close(); }
});

it('retains a nonzero canonical runner root and its explicit primitive cleanup residual', () => {
  const x = ownedRunnerKinematicsFixture(state, undefined, x => {
    const pitch = x.flight.physicalPitch as any, runner = pitch.frame.prePitchRunner;
    const source = { ...runner.source, route: { segments: [{ kind: 'line' as const, start: { x: 10, z: 1e-13 }, end: { x: 100, z: 1e-13 } }] } };
    const canonical = { ...runner.canonical, position: { x: 10, z: 1e-13 } };
    pitch.frame.world.runners[0].position = canonical.position;
    pitch.source.prePitchRunner = source;
    pitch.frame.prePitchRunner = { ...runner, source, canonical, controller: buildPrePitchRunnerController(source, canonical) };
    x.db.prepare('UPDATE batted_world_field_geometries SET snapshot_json=?,snapshot_hash=?').run(json(x.geometry), hash(x.geometry));
  });
  try {
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), value = read(x.cut);
    expect(value.root.position.z).toBe(1e-13);
    for (const role of value.roles) {
      expect(role.declaredPose.offset.z).toBe(0);
      expect(role.canonicalRoundingResidual.position.z).toBe(-1e-13);
      expect(role.canonicalActor.primitive.startCenter.z).toBe(0);
      expect(value.root.position.z + role.offset.z).toBe(0);
    }
  } finally { x.db.close(); }
});

it('reads an authenticated zero-time bag boundary without inventing elapsed motion', () => {
  const x = ownedRunnerFieldInputs();
  try {
    const ball = x.flight.flight.initialBall;
    const center = x.bases.source.bases.first.region.center;
    const baseSource = { ...x.bases.source, bases: { ...x.bases.source.bases, first: { ...x.bases.source.bases.first,
      region: { ...x.bases.source.bases.first.region, halfSize: { x: Math.abs(ball.position.x - center.x) + 1,
        z: Math.abs(ball.position.z - center.z) + 1 } }, surfaceHeightMeters: ball.position.y + 1 } } };
    const bases = { ...x.bases, source: baseSource, geometry: createBattedWorldBaseGeometry({ field: x.bases.geometry.field, bases: baseSource.bases }) };
    const geometry = { ...x.geometry, baseGeometry: bases,
      geometry: createBattedWorldFieldGeometry({ baseGeometry: bases.geometry, baseModels: x.geometry.source.baseModels }) };
    x.db.prepare('UPDATE batted_world_field_geometries SET snapshot_json=?,snapshot_hash=?').run(json(geometry), hash(geometry));
    state.flight = x.flight; state.bases = bases;
    const world = x.deriveWorld(); state.response = x.deriveRoot(world).response;
    const field = battedWorldFieldEvidenceFromSqlite(x.db).derive(x.source); x.archive(field);
    expect(field.field.motion.world).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: 0 } });
    expect(field.field.motion.response).toMatchObject({ kind: 'unresolved', reason: 'degenerate_normal', cursor: null });
    const original = actualPlayerKinematicsFromOriginalContact('runner', world);
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db));
    const value = read({ kind: 'owned_runner_field_v1', physicalPitchSourceId: x.flight.source.physicalPitchSourceId,
      fieldSourceId: field.source.sourceId, playerId: 'runner' });
    expect(value.at).toEqual(original.at); expect(value.root).toEqual(original.root);
    expect(value.roles.map(role => role.declaredPose)).toEqual(original.roles.map(role => role.declaredPose));
    expect(value.physicalPrefix.segments.map(segment => [segment.startElapsedSeconds, segment.endElapsedSeconds])).toEqual([[0, 0], [0, 0]]);
    expect(value.execution.executedThrough).toEqual(original.at);
    expect(value).not.toHaveProperty('activeCommand'); expect(value.physicalPrefix).not.toHaveProperty('ruleEvidence');
  } finally { x.db.close(); }
});

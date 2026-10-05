import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { runnerFieldPiecesFixture, appendRunnerPieceRow, requireRunnerPiecesRead, deriveRunnerPieces, type RunnerPiecesCut } from './OwnedRunnerFieldPiecesContracts.test-support';
import { actualPlayerKinematicsEvidenceFromSqlite, openSqliteActualPlayerKinematicsReader } from './SqliteActualPlayerKinematicsReader';
import { actualPlayerKinematicsFromOriginalContact } from './ActualPlayerKinematicsFromOriginalContact';
import { sampleRouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { projectedActorState } from './PrePitchRunnerFieldPiecesContracts.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any, bases: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases }) }));

it('reads every executed piece with row and piece provenance for all eleven identities and fifty-five parts', () => {
  const x = runnerFieldPiecesFixture(state);
  try {
    const read = requireRunnerPiecesRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), { first, second, cut } = appendRunnerPieceRow(x);
    const boundary = x.runner.controller.trajectory.segments[0].endElapsedSeconds - 2;
    const players = [...new Set(second.field.motion.actors.map(actor => actor.playerId))], values = players.map(playerId => read({ ...cut, playerId }));
    expect(values).toHaveLength(11); expect(values.flatMap(value => value.roles)).toHaveLength(55);
    for (const value of values) {
      expect(value.version).toBe('owned_runner_field_pieces_kinematics_v1'); expect(value.personId).toBe(`${value.playerId}-person`);
      expect(value.at).toEqual({ originTick: x.source.availableAtTick, elapsedSeconds: 0.3, tick: second.source.throughTick });
      expect(value.physicalPrefix.version).toBe('owned_runner_field_pieces_prefix_v1');
      expect(value.physicalPrefix.participants).toHaveLength(11);
      const segments = value.physicalPrefix.segments;
      expect(segments.map(segment => [segment.startElapsedSeconds, segment.endElapsedSeconds])).toEqual([[0, 0], [0, 0.1], [0.1, boundary], [boundary, 0.3]]);
      expect(segments.map(segment => segment.actors)).toEqual([x.world.actors, first.field.motion.actors, ...second.pieceExecution.pieces.map(piece => piece.field.motion.actors)]);
      expect(segments.map(segment => segment.execution)).toEqual([
        { owner: 'batted_world_contacts', sourceId: x.world.source.sourceId, revision: x.world.revision, pieceOrdinal: null },
        { owner: 'batted_world_field_actions', sourceId: first.source.sourceId, revision: 1, pieceOrdinal: null },
        { owner: 'batted_world_field_actions', sourceId: second.source.sourceId, revision: 2, pieceOrdinal: 0 },
        { owner: 'batted_world_field_actions', sourceId: second.source.sourceId, revision: 2, pieceOrdinal: 1 },
      ]);
      expect(value.execution).toEqual({ owner: 'batted_world_field_actions', sourceId: second.source.sourceId, revision: 2,
        sourceHash: hash(second.source), snapshotHash: hash(second), executedThrough: value.at });
      expect(value.dependencyHashes.field).toBe(hash(second)); expect(value.dependencyHashes.physicalPrefix).toBe(hash(value.physicalPrefix));
      expect(value).not.toHaveProperty('activeCommand'); expect(value.physicalPrefix).not.toHaveProperty('controlWindows');
    }
  } finally { x.db.close(); }
});

it('samples the executed runner phase while retaining original authority and actual ten-player command anchors', () => {
  const x = runnerFieldPiecesFixture(state);
  try {
    const read = requireRunnerPiecesRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), { second, cut } = appendRunnerPieceRow(x), runner = read(cut);
    const expected = sampleRouteFollowingController(x.runner.controller, x.runner.canonical, second.source.throughTick);
    expect(runner.root.position.x).toBeCloseTo(expected.position.x, 11); expect(runner.root.velocity.x).toBeCloseTo(expected.velocity.x, 11);
    expect(runner.root.acceleration.x).toBe(0);
    expect(runner.authority).toMatchObject({ owner: 'physical_pitch_progress_actions', sourceId: x.flight.source.physicalPitchSourceId,
      runnerSourceId: x.runner.source.sourceId, runnerSourceHash: hash(x.runner.source), motionRevision: x.runner.source.motionRevision,
      acceptedThroughTick: x.runner.source.coverageThroughTick });
    expect(runner.at.tick).toBeLessThan(runner.authority.acceptedThroughTick);
    const defender = read({ ...cut, playerId: 'defender-0' });
    expect(defender.root.position.x).toBeCloseTo(-199.96, 11); expect(defender.root.velocity.x).toBeCloseTo(0.4, 11);
    expect(defender.authority).toMatchObject({ owner: 'batted_world_field_actions', sourceId: second.source.sourceId });
    const foot = defender.roles.find(role => role.role === 'right_foot')!;
    expect(foot.declaredPose.offset.z).toBeCloseTo(0.008, 12); expect(foot.declaredPose.relativeVelocity.z).toBeCloseTo(0.08, 12);
  } finally { x.db.close(); }
});

it('retains the final executed acceleration at an exact phase-end cut after a later piece has been accepted', () => {
  const x = runnerFieldPiecesFixture(state, { phase: 'integer' });
  try {
    const read = requireRunnerPiecesRead(actualPlayerKinematicsEvidenceFromSqlite(x.db));
    const first = deriveRunnerPieces(x.own, { ...x.source, throughTick: x.source.availableAtTick + 125_000 }); x.archive(first);
    const cut: RunnerPiecesCut = { kind: 'owned_runner_field_pieces_v1', physicalPitchSourceId: x.flight.source.physicalPitchSourceId,
      fieldSourceId: first.source.sourceId, playerId: 'runner' }, original = read(cut);
    expect(original.at.elapsedSeconds).toBe(0.125); expect(original.root.acceleration.x).toBe(2);
    const second = deriveRunnerPieces(x.own, { ...x.source, sourceId: 'runner-pieces-later', previousFieldSourceId: first.source.sourceId,
      throughTick: x.source.availableAtTick + 200_000 }); x.archive(second);
    expect(read(cut)).toEqual(original);
    expect(read({ ...cut, fieldSourceId: second.source.sourceId }).root.acceleration.x).toBe(0);
  } finally { x.db.close(); }
});

it('observes a genuine zero-time unresolved field piece without advancing the original runner state', () => {
  const x = runnerFieldPiecesFixture(state, { phase: 'integer', zeroBag: true });
  try {
    const read = requireRunnerPiecesRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), field = deriveRunnerPieces(x.own, x.source); x.archive(field);
    expect(field.field.motion.response).toMatchObject({ kind: 'unresolved', reason: 'degenerate_normal', cursor: null });
    const value = read({ kind: 'owned_runner_field_pieces_v1', physicalPitchSourceId: x.flight.source.physicalPitchSourceId,
      fieldSourceId: field.source.sourceId, playerId: 'runner' });
    const original = actualPlayerKinematicsFromOriginalContact('runner', x.world);
    expect(value.at).toEqual(original.at); expect(value.root).toEqual(original.root);
    expect(value.roles.map(role => role.declaredPose)).toEqual(original.roles.map(role => role.declaredPose));
    expect(value.physicalPrefix.segments.map(segment => [segment.startElapsedSeconds, segment.endElapsedSeconds])).toEqual([[0, 0], [0, 0]]);
  } finally { x.db.close(); }
});

it('samples a genuine fractional collision from its executed piece without advancing to the rounded tick', () => {
  const x = runnerFieldPiecesFixture(state, { collision: 'after' });
  try {
    const read = requireRunnerPiecesRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), field = deriveRunnerPieces(x.own, x.source); x.archive(field);
    expect(field.field.motion.world.kind).toBe('boundary');
    const moment = field.field.motion.world.moment;
    const value = read({ kind: 'owned_runner_field_pieces_v1', physicalPitchSourceId: x.flight.source.physicalPitchSourceId,
      fieldSourceId: field.source.sourceId, playerId: 'runner' });
    expect(value.at).toEqual({ originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick });
    expect(value.at.elapsedSeconds).toBeLessThan((value.at.tick - value.at.originTick) / 1_000_000);
    const body = field.field.motion.actors.find(actor => actor.playerId === 'runner' && actor.primitive.role === 'body')!;
    const actual = projectedActorState(body, moment.originTick, moment.elapsedSeconds);
    expect(value.root.position.x).toBeCloseTo(actual.position.x, 11); expect(value.root.velocity.x).toBeCloseTo(actual.velocity.x, 11);
    expect(value.root.acceleration.x).toBe(0);
    const rounded = sampleRouteFollowingController(x.runner.controller, x.runner.canonical, value.at.tick);
    expect(Math.abs(value.root.position.x - rounded.position.x)).toBeGreaterThan(1e-10);
  } finally { x.db.close(); }
});

it('preserves a nonzero original root and cleanup residual across the retained phase boundary', () => {
  const x = runnerFieldPiecesFixture(state, { rootZ: 1e-13 });
  try {
    const read = requireRunnerPiecesRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), { cut } = appendRunnerPieceRow(x), value = read(cut);
    expect(value.root.position.z).toBe(1e-13);
    for (const role of value.roles) {
      expect(role.declaredPose.offset.z).toBe(0); expect(role.canonicalRoundingResidual.position.z).toBe(-1e-13);
      expect(role.canonicalActor.primitive.startCenter.z).toBe(0); expect(value.root.position.z + role.offset.z).toBe(0);
    }
  } finally { x.db.close(); }
});

it.each(['kind', 'pitch', 'player', 'field', 'time', 'current', 'state', 'pieces', 'controller', 'result'] as const)
('rejects caller %s fields after proving the piece reader exists', kind => {
  const x = runnerFieldPiecesFixture(state);
  try {
    const read = requireRunnerPiecesRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), { cut } = appendRunnerPieceRow(x);
    expect(read(cut).playerId).toBe('runner'); const raw = { ...cut } as any;
    if (kind === 'kind') raw.kind = 'owned_runner_field_v1';
    if (kind === 'pitch') raw.physicalPitchSourceId = 'other';
    if (kind === 'player') raw.playerId = 'bench';
    if (kind === 'field') raw.fieldSourceId = 'unowned';
    if (kind === 'time') raw.atTick = x.runner.source.coverageThroughTick;
    if (kind === 'current') raw.mode = 'current';
    if (kind === 'state') raw.position = { x: 27, z: 27 };
    if (kind === 'pieces') raw.pieces = [];
    if (kind === 'controller') raw.controller = x.runner.controller;
    if (kind === 'result') raw.result = 'safe';
    expect(() => read(raw)).toThrow();
  } finally { x.db.close(); }
});

it('rejects a getter without executing it', () => {
  const x = runnerFieldPiecesFixture(state);
  try {
    const read = requireRunnerPiecesRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), { cut } = appendRunnerPieceRow(x); let called = false;
    expect(() => read({ ...cut, get fieldSourceId() { called = true; return cut.fieldSourceId; } })).toThrow(/accessor|inert/);
    expect(called).toBe(false);
  } finally { x.db.close(); }
});

it.each(['omitted_piece', 'piece_order', 'piece_index', 'gap', 'coverage', 'mirror', 'source', 'head', 'person', 'controller'] as const)
('reauthenticates %s even when altered snapshots are rehashed', kind => {
  const x = runnerFieldPiecesFixture(state);
  try {
    const read = requireRunnerPiecesRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), { second, cut } = appendRunnerPieceRow(x);
    expect(read(cut).playerId).toBe('runner');
    if (['omitted_piece', 'piece_order', 'piece_index', 'gap', 'coverage', 'mirror'].includes(kind)) {
      const forged = structuredClone(second) as any, pieces = forged.pieceExecution.pieces;
      if (kind === 'omitted_piece') { pieces.shift(); pieces[0].ordinal = 0; }
      if (kind === 'piece_order') pieces.reverse();
      if (kind === 'piece_index') pieces[1].controllerSegmentIndex = 0;
      if (kind === 'gap') pieces[1].startMoment.elapsedSeconds += 1e-7;
      if (kind === 'coverage') pieces[1].coverageThroughElapsedSeconds = 1.000001;
      if (kind === 'mirror') forged.field.motion.actors[0].primitive.startCenter.x += 1;
      x.db.prepare('UPDATE batted_world_field_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(json(forged), hash(forged), cut.fieldSourceId);
    }
    if (kind === 'source') {
      const forged = { ...second.source, prePitchRunnerSourceId: 'unowned' };
      x.db.prepare('UPDATE batted_world_field_actions SET source_json=?,source_hash=? WHERE source_id=?').run(json(forged), hash(forged), cut.fieldSourceId);
    }
    if (kind === 'head') x.db.prepare('UPDATE batted_world_field_heads SET revision=3').run();
    if (kind === 'person' || kind === 'controller') {
      state.response = structuredClone(state.response);
      if (kind === 'person') state.response.touch.worldContact.modelActorEvidence.find((actor: any) => actor.binding.playerId === 'runner').person.personId = 'forged';
      else state.response.touch.worldContact.flight.physicalPitch.frame.prePitchRunner.controller.trajectory.segments[0].accelerationMps2 += 1;
    }
    expect(() => read(cut)).toThrow();
  } finally { x.db.close(); }
});

it('preserves an earlier piece cut under opaque future payloads while validating every later metadata link', () => {
  const x = runnerFieldPiecesFixture(state);
  try {
    const read = requireRunnerPiecesRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)), { second, cut } = appendRunnerPieceRow(x), original = read(cut);
    const later = deriveRunnerPieces(x.own, { ...x.source, sourceId: 'runner-pieces-future', previousFieldSourceId: second.source.sourceId,
      throughTick: x.source.availableAtTick + 350_000 }); x.archive(later);
    x.db.prepare('UPDATE batted_world_field_actions SET source_json=?,snapshot_json=? WHERE source_id=?').run('{opaque future', '{opaque future', later.source.sourceId);
    expect(read(cut)).toEqual(original);
    x.db.prepare('UPDATE batted_world_field_actions SET previous_source_id=? WHERE source_id=?').run('unowned', later.source.sourceId);
    expect(() => read(cut)).toThrow(/metadata|prefix/);
  } finally { x.db.close(); }
});

it('keeps the historical v1 reader and all legacy unsupported-consumer boundaries intact', () => {
  const x = runnerFieldPiecesFixture(state);
  try {
    const owner = actualPlayerKinematicsEvidenceFromSqlite(x.db), read = requireRunnerPiecesRead(owner), { first, second, cut } = appendRunnerPieceRow(x);
    expect(read(cut).root.acceleration.x).toBe(0);
    const oldCut = { kind: 'owned_runner_field_v1' as const, physicalPitchSourceId: cut.physicalPitchSourceId,
      fieldSourceId: first.source.sourceId, playerId: 'runner' };
    const historical = owner.readOwnedRunnerField(oldCut);
    expect(historical.version).toBe('owned_runner_field_kinematics_v1'); expect(historical.at.elapsedSeconds).toBe(0.1);
    expect(() => owner.readOwnedRunnerField({ ...oldCut, fieldSourceId: second.source.sourceId })).toThrow();
    expect(() => owner.read({ physicalPitchSourceId: cut.physicalPitchSourceId, playerId: 'runner', baseFieldSourceId: first.source.sourceId,
      executionSourceId: null, mode: 'original' })).toThrow(/unsupported original pre-pitch runner consumer/);
    expect(() => x.own.interpret(second.source.sourceId)).toThrow(/unsupported original pre-pitch runner consumer/);
  } finally { x.db.close(); }
});

it('reopens the public reader read-only without changing field rows, geometry, identities or schema', () => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-pieces-reader-')), path = join(directory, 'source.sqlite');
  const x = runnerFieldPiecesFixture(state, { path }), readers: ReturnType<typeof openSqliteActualPlayerKinematicsReader>[] = [];
  try {
    const first = openSqliteActualPlayerKinematicsReader(path); readers.push(first);
    const read = requireRunnerPiecesRead(first), { cut } = appendRunnerPieceRow(x);
    const snapshot = () => ({ schema: x.db.prepare('SELECT name,type,sql FROM sqlite_master ORDER BY name').all(),
      fields: x.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all(), heads: x.db.prepare('SELECT * FROM batted_world_field_heads').all(),
      geometry: x.db.prepare('SELECT * FROM batted_world_field_geometries ORDER BY source_id').all(),
      participants: x.db.prepare('SELECT * FROM official_participant_bindings ORDER BY player_id').all(), people: x.db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all() });
    const before = snapshot(), value = read(cut); expect(read(cut)).toEqual(value); expect(snapshot()).toEqual(before);
    first.close(); expect(() => read(cut)).toThrow(/closed/);
    const reopened = openSqliteActualPlayerKinematicsReader(path); readers.push(reopened);
    expect(requireRunnerPiecesRead(reopened)(cut)).toEqual(value); expect(snapshot()).toEqual(before);
  } finally { for (const reader of readers) reader.close(); x.db.close(); rmSync(directory, { recursive: true, force: true }); }
});

import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ownedRunnerFieldNativeFixture } from './OwnedRunnerFieldNativeFixtures.test-support';
import { openSqliteActualPlayerKinematicsReader } from './SqliteActualPlayerKinematicsReader';
import { openSqliteBattedWorldFieldStore } from './SqliteBattedWorldFieldStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { battedFirstFielderTouchEvidenceFromSqlite } from './SqliteBattedFirstFielderTouchStore';
import { battedBallFlightEvidenceFromSqlite } from './SqliteBattedBallFlightStore';
import { openSqliteBattedContactResponseStore } from './SqliteBattedContactResponseStore';
import { openSqliteBattedWorldBaseGeometryStore } from './SqliteBattedWorldBaseGeometryStore';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';

/** One genuine registered-profile construction, reused for rollback, replay and tamper checks. */
it('persists original runner pieces and reads their exact field cut through a genuine Native chain', () => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-pieces-native-')), path = join(directory, 'state.sqlite');
  let fixture: ReturnType<typeof ownedRunnerFieldNativeFixture> | undefined, fixtureClosed = false;
  const reopenedHandles: { close(): void }[] = [], track = <T extends { close(): void }>(value: T): T => { reopenedHandles.push(value); return value; };
  try {
    const x = fixture = ownedRunnerFieldNativeFixture({ retainedSpeedBoundary: true, databasePath: path }), { f } = x;
    expect(f.db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    expect(f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(x.originalMatch.ruleProfileId).toBe('npb-2026');
    x.touches.accept(x.touchSource.sourceId); x.responses.accept(x.responseSource.sourceId);
    x.bases.accept(x.baseSource.sourceId); x.fields.acceptGeometry(x.geometrySource.sourceId);
    const first = x.fields.accept(x.source.sourceId);
    expect(first.field.motion.world.kind).toBe('moving');
    const source = { ...x.source, kind: 'owned_runner_field_pieces_v1' as const, sourceId: 'runner-retained-pieces-native',
      previousFieldSourceId: first.source.sourceId, throughTick: x.throughTick };
    x.sources.set(source.sourceId, source);
    const before = { heads: f.db.prepare('SELECT * FROM batted_world_field_heads').all(),
      binding: f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get('game-1', x.runner.playerId) };
    f.db.exec(`CREATE TRIGGER tamper_runner_pieces AFTER INSERT ON batted_world_field_actions WHEN NEW.source_id='runner-retained-pieces-native' BEGIN
      UPDATE official_participant_bindings SET binding_json='{}' WHERE game_id='game-1' AND player_id='away-1'; END;`);
    const witness = witnessSqliteWrite('INSERT INTO batted_world_field_actions VALUES (?,?,?,?,?,?,?,?,?,?,?)', writer =>
      writer.prepare('SELECT source_id FROM batted_world_field_actions WHERE source_id=?').get(source.sourceId)?.source_id === source.sourceId
      && writer.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get('game-1', x.runner.playerId)?.binding_json === '{}');
    try {
      expect(() => x.fields.accept(source.sourceId)).toThrow();
      expect(witness.wasReached()).toBe(true);
    } finally { witness.close(); }
    expect(f.db.prepare('SELECT source_id FROM batted_world_field_actions ORDER BY revision').all()).toEqual([{ source_id: first.source.sourceId }]);
    expect(f.db.prepare('SELECT * FROM batted_world_field_heads').all()).toEqual(before.heads);
    expect(f.db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get('game-1', x.runner.playerId)).toEqual(before.binding);
    f.db.exec('DROP TRIGGER tamper_runner_pieces');
    const field = x.fields.accept(source.sourceId), pieces = field.pieceExecution!.pieces, boundary = field.field.motion.world;
    expect(pieces.map(piece => piece.controllerSegmentIndex)).toEqual([0, 1]);
    expect(pieces.map(piece => piece.ordinal)).toEqual([0, 1]);
    expect(pieces[0].throughElapsedSeconds).toBeCloseTo(0.125, 11);
    expect(boundary.kind).toBe('boundary');
    if (boundary.kind !== 'boundary') throw new Error('Native fixture requires the actual moving runner contact');
    expect(boundary.contacts).toMatchObject([{ kind: 'actor', playerId: x.runner.playerId, role: 'body' }]);
    expect(boundary.moment.elapsedSeconds).toBeGreaterThan(pieces[0].throughElapsedSeconds);
    expect(pieces.every(piece => piece.field.motion.actors.length === 55)).toBe(true);
    expect(pieces[0].field.motion.actors.filter(actor => actor.playerId !== x.runner.playerId))
      .toEqual(pieces[1].field.motion.actors.filter(actor => actor.playerId !== x.runner.playerId));
    expect(field.field).toEqual(pieces[1].field); expect(x.fields.accept(source.sourceId)).toEqual(field);
    const cut = { kind: 'owned_runner_field_pieces_v1' as const, physicalPitchSourceId: x.action.sourceId,
      fieldSourceId: source.sourceId, playerId: x.runner.playerId };
    const reader = f.track(openSqliteActualPlayerKinematicsReader(f.path)), value = reader.readOwnedRunnerFieldPieces(cut);
    expect(value.physicalPrefix.segments).toHaveLength(4); expect(value.physicalPrefix.participants).toHaveLength(11);
    expect(value.at.elapsedSeconds).toBe(boundary.moment.elapsedSeconds);
    expect(Math.hypot(...Object.values(value.root.acceleration))).toBe(0);
    expect(value.authority).toMatchObject({ owner: 'physical_pitch_progress_actions', sourceId: x.action.sourceId,
      motionRevision: x.runner.motionRevision, runnerSourceHash: hash(x.runner), acceptedThroughTick: x.runner.coverageThroughTick });
    expect(reader.readOwnedRunnerField({ ...cut, kind: 'owned_runner_field_v1', fieldSourceId: first.source.sourceId }).at.elapsedSeconds).toBeCloseTo(0.05, 11);
    expect(() => x.fields.interpret(source.sourceId)).toThrow(/unsupported original pre-pitch runner consumer/);
    const originalOfficial = f.official.getMatch('game-1');
    expect(originalOfficial!.matchState).toEqual(x.originalMatch); expect(originalOfficial!.durableRevision).toBe(x.actor.officialRevision);
    const savedRows = f.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all();
    // All construction writers, dependency handles and the first reader close
    // before any fresh connection is opened. No accepted-Source callbacks survive.
    fixtureClosed = true; f.close();
    expect(() => reader.readOwnedRunnerFieldPieces(cut)).toThrow(/closed/);
    expect(() => f.db.prepare('SELECT 1')).toThrow();
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = track(new DatabaseSync(path));
    expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all()).toEqual(savedRows);
    const reopened = track(openSqliteActualPlayerKinematicsReader(path));
    expect(reopened.readOwnedRunnerFieldPieces(cut)).toEqual(value);
    const responses = track(openSqliteBattedContactResponseStore(path, battedFirstFielderTouchEvidenceFromSqlite(db)));
    const bases = track(openSqliteBattedWorldBaseGeometryStore(path, battedBallFlightEvidenceFromSqlite(db)));
    const fields = track(openSqliteBattedWorldFieldStore(path, responses, bases));
    expect(responses.read(source.responseSourceId)).toEqual(field.response);
    expect(bases.read(field.geometry.source.baseGeometrySourceId)).toEqual(field.geometry.baseGeometry);
    expect(fields.read(source.sourceId)).toEqual(field);
    expect(fields.accept(source.sourceId)).toEqual(field);
    expect(db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all()).toEqual(savedRows);
    const row = db.prepare('SELECT snapshot_json,snapshot_hash FROM batted_world_field_actions WHERE source_id=?').get(source.sourceId)!;
    const corrupt = JSON.parse(row.snapshot_json as string); corrupt.pieceExecution.pieces.shift(); corrupt.pieceExecution.pieces[0].ordinal = 0;
    db.prepare('UPDATE batted_world_field_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(json(corrupt), hash(corrupt), source.sourceId);
    expect(() => reopened.readOwnedRunnerFieldPieces(cut)).toThrow();
    db.prepare('UPDATE batted_world_field_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(row.snapshot_json, row.snapshot_hash, source.sourceId);
    expect(reopened.readOwnedRunnerFieldPieces(cut)).toEqual(value);
    expect(track(new SqliteOfficialStateStore(path)).getMatch('game-1')).toEqual(originalOfficial);
    expect(db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all()).toEqual(savedRows);
  } finally {
    try { while (reopenedHandles.length) reopenedHandles.pop()!.close(); }
    finally { try { if (fixture && !fixtureClosed) { fixtureClosed = true; fixture.f.close(); } }
      finally { rmSync(directory, { recursive: true, force: true }); } }
  }
}, 180_000);

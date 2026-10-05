import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { ownedRunnerKinematicsFixture, requireOwnedRunnerFieldRead } from './OwnedRunnerFieldKinematicsContracts.test-support';
import { actualPlayerKinematicsEvidenceFromSqlite, openSqliteActualPlayerKinematicsReader } from './SqliteActualPlayerKinematicsReader';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const state = vi.hoisted(() => ({ flight: null as any, response: null as any, bases: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
vi.mock('./SqliteBattedContactResponseStore', () => ({ battedContactResponseEvidenceFromSqlite: () => ({ read: () => state.response }) }));
vi.mock('./SqliteBattedWorldBaseGeometryStore', () => ({ battedWorldBaseGeometryEvidenceFromSqlite: () => ({ read: () => state.bases }) }));

it.each(['wrong_kind', 'wrong_pitch', 'unknown_player', 'unknown_field', 'sample_time', 'current_mode', 'caller_state', 'controller', 'execution', 'result'] as const)
('rejects %s without opening a new runner execution capability', kind => {
  const x = ownedRunnerKinematicsFixture(state);
  try {
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db));
    const cut = { ...x.cut } as any;
    if (kind === 'wrong_kind') cut.kind = 'owned_runner_contact_v1';
    if (kind === 'wrong_pitch') cut.physicalPitchSourceId = 'other-pitch';
    if (kind === 'unknown_player') cut.playerId = 'bench';
    if (kind === 'unknown_field') cut.fieldSourceId = 'unowned';
    if (kind === 'sample_time') cut.atTick = x.flight.physicalPitch.frame.prePitchRunner.source.coverageThroughTick;
    if (kind === 'current_mode') cut.mode = 'current';
    if (kind === 'caller_state') cut.position = { x: 27, z: 27 };
    if (kind === 'controller') cut.controller = x.flight.physicalPitch.frame.prePitchRunner.controller;
    if (kind === 'execution') cut.executionSourceId = null;
    if (kind === 'result') cut.result = 'safe';
    expect(() => read(cut)).toThrow();
  } finally { x.db.close(); }
});

it('rejects accessors without executing them', () => {
  const x = ownedRunnerKinematicsFixture(state);
  try {
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db)); let called = false;
    const cut = { ...x.cut, get fieldSourceId() { called = true; return x.cut.fieldSourceId; } };
    expect(() => read(cut)).toThrow(/accessor|inert/); expect(called).toBe(false);
  } finally { x.db.close(); }
});

it.each(['snapshot', 'source', 'geometry', 'head', 'person', 'controller'] as const)
('reauthenticates %s for each exact-cut read rather than trusting a transported snapshot', kind => {
  const x = ownedRunnerKinematicsFixture(state);
  try {
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db));
    expect(read(x.cut).playerId).toBe('runner');
    if (kind === 'snapshot') {
      const forged = structuredClone(x.second); (forged.field.motion.actors[0].primitive.startCenter as any).x += 1;
      x.db.prepare('UPDATE batted_world_field_actions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(json(forged), hash(forged), x.cut.fieldSourceId);
    }
    if (kind === 'source') {
      const forged = { ...x.second.source, prePitchRunnerSourceId: 'different-runner-source' };
      x.db.prepare('UPDATE batted_world_field_actions SET source_json=?,source_hash=? WHERE source_id=?').run(json(forged), hash(forged), x.cut.fieldSourceId);
    }
    if (kind === 'geometry') {
      const forged = structuredClone(x.geometry) as any; forged.geometry.bases.first.topY += 0.01;
      x.db.prepare('UPDATE batted_world_field_geometries SET snapshot_json=?,snapshot_hash=?').run(json(forged), hash(forged));
    }
    if (kind === 'head') x.db.prepare('UPDATE batted_world_field_heads SET revision=3').run();
    if (kind === 'person' || kind === 'controller') {
      state.response = structuredClone(state.response);
      if (kind === 'person') state.response.touch.worldContact.modelActorEvidence.find((actor: any) => actor.binding.playerId === 'runner').person.personId = 'forged';
      else state.response.touch.worldContact.flight.physicalPitch.frame.prePitchRunner.controller.trajectory.segments[0].startSpeedMps += 1;
    }
    expect(() => read(x.cut)).toThrow();
  } finally { x.db.close(); }
});

it('keeps an earlier field cut stable under opaque future payloads while authenticating future metadata', () => {
  const x = ownedRunnerKinematicsFixture(state);
  try {
    const read = requireOwnedRunnerFieldRead(actualPlayerKinematicsEvidenceFromSqlite(x.db));
    const cut = { ...x.cut, fieldSourceId: x.first.source.sourceId }, original = read(cut);
    x.db.prepare('UPDATE batted_world_field_actions SET source_json=?,snapshot_json=? WHERE source_id=?').run('{opaque future', '{opaque future', x.second.source.sourceId);
    expect(read(cut)).toEqual(original);
    expect(read(cut).at.elapsedSeconds).toBe(0.1);
    x.db.prepare('UPDATE batted_world_field_actions SET previous_source_id=? WHERE source_id=?').run('unowned-predecessor', x.second.source.sourceId);
    expect(() => read(cut)).toThrow(/metadata|prefix/);
  } finally { x.db.close(); }
});

it('reopens the public readonly reader without creating rows, schema or executable authority', () => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-field-kinematics-'));
  const path = join(directory, 'source.sqlite'), x = ownedRunnerKinematicsFixture(state, path);
  const readers: ReturnType<typeof openSqliteActualPlayerKinematicsReader>[] = [];
  try {
    const snapshot = () => ({ schema: x.db.prepare('SELECT name,type,sql FROM sqlite_master ORDER BY name').all(),
      fields: x.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all(),
      heads: x.db.prepare('SELECT * FROM batted_world_field_heads').all(),
      geometry: x.db.prepare('SELECT * FROM batted_world_field_geometries ORDER BY source_id').all(),
      participants: x.db.prepare('SELECT * FROM official_participant_bindings ORDER BY game_id,player_id').all(),
      people: x.db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all() });
    const before = snapshot(), first = openSqliteActualPlayerKinematicsReader(path); readers.push(first);
    const read = requireOwnedRunnerFieldRead(first), value = read(x.cut);
    expect(read(x.cut)).toEqual(value); expect(snapshot()).toEqual(before);
    first.close(); expect(() => read(x.cut)).toThrow(/closed/);
    const reopened = openSqliteActualPlayerKinematicsReader(path); readers.push(reopened);
    expect(requireOwnedRunnerFieldRead(reopened)(x.cut)).toEqual(value); expect(snapshot()).toEqual(before);
  } finally { for (const reader of readers) reader.close(); x.db.close(); rmSync(directory, { recursive: true, force: true }); }
});

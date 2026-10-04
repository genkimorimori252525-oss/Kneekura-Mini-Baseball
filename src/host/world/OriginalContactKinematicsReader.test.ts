import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { prePitchRunnerContactFixture } from './PrePitchRunnerContactFixtures.test-support';
import { battedWorldContactEvidenceFromSqlite } from './SqliteBattedWorldContactStore';
import { actualPlayerKinematicsEvidenceFromSqlite, openSqliteActualPlayerKinematicsReader } from './SqliteActualPlayerKinematicsReader';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const state = vi.hoisted(() => ({ flight: null as any }));
vi.mock('./SqliteBattedBallFlightStore', () => ({ battedBallFlightEvidenceFromSqlite: () => ({ read: () => state.flight }) }));
const cut = { kind: 'owned_runner_contact_v1' as const, physicalPitchSourceId: 'pitch', worldContactSourceId: 'contact', playerId: 'runner' };
const fixture = (path?: string) => {
  const x = prePitchRunnerContactFixture(path); state.flight = x.flight;
  const world = battedWorldContactEvidenceFromSqlite(x.db).derive(x.source, x.model, null);
  // Tiny genuine SQLite reader proof; pitch/flight ownership is the only mocked upstream dependency.
  x.db.exec(`CREATE TABLE batted_world_models(source_id TEXT,game_id TEXT,source_json TEXT,source_hash TEXT);
    CREATE TABLE batted_world_contacts(source_id TEXT,physical_pitch_source_id TEXT,game_id TEXT,revision INTEGER,previous_source_id TEXT,source_json TEXT,source_hash TEXT,snapshot_json TEXT,snapshot_hash TEXT);
    CREATE TABLE batted_world_contact_heads(physical_pitch_source_id TEXT,source_id TEXT,revision INTEGER);`);
  x.db.prepare('INSERT INTO batted_world_models VALUES(?,?,?,?)').run(x.model.sourceId, x.model.gameId, json(x.model), hash(x.model));
  x.db.prepare('INSERT INTO batted_world_contacts VALUES(?,?,?,?,?,?,?,?,?)').run(x.source.sourceId, 'pitch', 'game', 1, null, json(x.source), hash(x.source), json(world), hash(world));
  x.db.prepare('INSERT INTO batted_world_contact_heads VALUES(?,?,?)').run('pitch', x.source.sourceId, 1);
  return { ...x, world };
};
it('reads only the owned original-contact endpoint through the existing read-only SQLite adapter, without a field owner or mutation', () => {
  const directory = mkdtempSync(join(tmpdir(), 'original-runner-reader-')), path = join(directory, 'test.sqlite'), x = fixture(path);
  const reader = openSqliteActualPlayerKinematicsReader(path);
  try {
    const rows = x.db.prepare('SELECT * FROM batted_world_contacts').all();
    const first = reader.readOriginalContact(cut);
    expect(first.playerId).toBe('runner'); expect(first.cut).toEqual(cut);
    expect(first.origin.kind).toBe('pre_pitch_runner_controller'); expect(first.physicalPrefix.participants).toHaveLength(11);
    expect(first.dependencyHashes.worldContact).toBe(hash(x.world));
    expect(first.dependencyHashes.physicalPrefix).toBe(hash(first.physicalPrefix));
    expect(first.at.tick).toBe(x.world.result.kind === 'contact' ? x.world.result.tick : x.world.result.throughTick);
    expect(reader.readOriginalContact(cut)).toEqual(first);
    expect(x.db.prepare('SELECT * FROM batted_world_contacts').all()).toEqual(rows);
    expect(x.db.prepare("SELECT name FROM sqlite_master WHERE name='batted_world_field_actions'").all()).toEqual([]);
  } finally { reader.close(); x.db.close(); rmSync(directory, { recursive: true }); }
});
it.each(['wrong_pitch', 'future_time', 'current_mode', 'extra_field', 'unknown_player', 'unknown_contact'])('rejects %s rather than exposing unexecuted or different player state', kind => {
  const x = fixture();
  try {
    const request = { ...cut } as any;
    if (kind === 'wrong_pitch') request.physicalPitchSourceId = 'other';
    if (kind === 'future_time') request.atTick = 9_000_000;
    if (kind === 'current_mode') request.mode = 'current';
    if (kind === 'extra_field') request.result = 'safe';
    if (kind === 'unknown_player') request.playerId = 'reserve';
    if (kind === 'unknown_contact') request.worldContactSourceId = 'unknown';
    expect(() => actualPlayerKinematicsEvidenceFromSqlite(x.db).readOriginalContact(request)).toThrow(/original contact/);
  } finally { x.db.close(); }
});
it.each(['snapshot', 'source', 'head', 'person'])('authenticates actual %s evidence on every read', kind => {
  const x = fixture();
  try {
    const own = actualPlayerKinematicsEvidenceFromSqlite(x.db);
    expect(own.readOriginalContact(cut).playerId).toBe('runner');
    if (kind === 'snapshot') {
      const forged = structuredClone(x.world); (forged.actors[0].primitive.startCenter as any).x += 1;
      x.db.prepare('UPDATE batted_world_contacts SET snapshot_json=?,snapshot_hash=?').run(json(forged), hash(forged));
    }
    if (kind === 'source') {
      const forged = { ...x.source, prePitchRunnerSourceId: 'different' };
      x.db.prepare('UPDATE batted_world_contacts SET source_json=?,source_hash=?').run(json(forged), hash(forged));
    }
    if (kind === 'head') x.db.prepare('UPDATE batted_world_contact_heads SET revision=2').run();
    if (kind === 'person') x.db.prepare("UPDATE world_player_person_links SET person_id='forged' WHERE player_id='runner'").run();
    expect(() => own.readOriginalContact(cut)).toThrow();
  } finally { x.db.close(); }
});
it('authenticates current metadata but does not interpret future payloads beyond the selected original contact', () => {
  const x = fixture();
  try {
    const own = actualPlayerKinematicsEvidenceFromSqlite(x.db), first = own.readOriginalContact(cut);
    x.db.prepare('INSERT INTO batted_world_contacts VALUES(?,?,?,?,?,?,?,?,?)').run('future', 'pitch', 'game', 2, 'contact', 'future opaque source', 'hash', 'future opaque snapshot', 'hash');
    x.db.prepare("UPDATE batted_world_contact_heads SET source_id='future',revision=2").run();
    expect(own.readOriginalContact(cut)).toEqual(first);
    x.db.prepare("UPDATE batted_world_contact_heads SET source_id='unowned'").run();
    expect(() => own.readOriginalContact(cut)).toThrow();
  } finally { x.db.close(); }
});

it.each(['game', 'parent', 'duplicate_source'])('rejects future %s ownership metadata without interpreting future payloads', kind => {
  const x = fixture();
  try {
    const own = actualPlayerKinematicsEvidenceFromSqlite(x.db);
    x.db.prepare('INSERT INTO batted_world_contacts VALUES(?,?,?,?,?,?,?,?,?)').run('future', 'pitch', kind === 'game' ? 'other-game' : 'game', 2,
      kind === 'parent' ? 'unowned' : 'contact', 'opaque source', 'hash', 'opaque snapshot', 'hash');
    if (kind === 'duplicate_source') x.db.prepare("UPDATE batted_world_contacts SET source_id='contact' WHERE revision=2").run();
    x.db.prepare('UPDATE batted_world_contact_heads SET source_id=?,revision=2').run(kind === 'duplicate_source' ? 'contact' : 'future');
    expect(() => own.readOriginalContact(cut)).toThrow(/original contact.*metadata/);
  } finally { x.db.close(); }
});

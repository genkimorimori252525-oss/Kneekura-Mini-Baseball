import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import * as inert from '../../core/adjudication/OfficialWindowPolicy';
import * as canonical from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { fieldNormalizationFixture } from './BattedWorldFieldNormalizationFixtures.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const mutable = (value: unknown) => value as Record<string, any>;

it('normalizes actor identities linearly per segment with exact deterministic output and input bytes', () => {
  const prefix = fieldNormalizationFixture(), before = canonical.actorJson(prefix);
  const count = prefix.baseField.field.motion.actors.length, calls = vi.spyOn(canonical, 'actorJson');
  try {
    const value = battedWorldFieldPhysicalPrefix(prefix);
    const identities = calls.mock.calls.filter(([v]) => Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'string'));
    console.log('prefix normalization evidence', { actors: count, identities: identities.length, hash: canonical.actorHash(value) });
    expect(identities.length).toBe(count * 4);
    expect(canonical.actorHash(value)).toBe('5089fab4243f3ef0ad6787869f80bcbecf92180b26e768ae01a34a074d8a653e');
    expect(canonical.actorJson(prefix)).toBe(before);
    expect(value.segments.map(s => s.actors.map(a => [a.playerId, a.primitive.role])))
      .toEqual([prefix.baseField.response.touch.worldContact.actors, prefix.baseField.field.motion.actors].map(actors => actors.map(a => [a.playerId, a.primitive.role])));
    expect(canonical.actorJson(battedWorldFieldPhysicalPrefix(structuredClone(prefix)))).toBe(canonical.actorJson(value));
  } finally { calls.mockRestore(); }
});

it.each(['duplicate', 'missing', 'foreign', 'radius', 'coverage', 'continuity', 'start', 'nonfinite', 'accessor'] as const)
('rejects %s actor changes on later calls without retaining identity state', kind => {
  const prefix = fieldNormalizationFixture();
  battedWorldFieldPhysicalPrefix(prefix);
  const changed = structuredClone(prefix), motion = mutable(changed.baseField.field.motion), actor = motion.actors[0];
  let getterCalls = 0;
  if (kind === 'duplicate') motion.actors[1] = actor;
  if (kind === 'missing') motion.actors.pop();
  if (kind === 'foreign') actor.playerId = 'foreign';
  if (kind === 'radius') actor.primitive.radius += 1;
  if (kind === 'coverage') actor.primitive.endTick = 0;
  if (kind === 'continuity') actor.primitive.startCenter.x += 1;
  if (kind === 'start') actor.startElapsedSeconds = 1;
  if (kind === 'nonfinite') actor.primitive.startVelocity.y = Infinity;
  if (kind === 'accessor') Object.defineProperty(actor, 'playerId', { enumerable: true, get() { getterCalls++; return 'foreign'; } });
  expect(() => battedWorldFieldPhysicalPrefix(changed)).toThrow(/actor|rebase|coverage|finite|inert|accessor/);
  expect(getterCalls).toBe(0);
  expect(canonical.actorHash(battedWorldFieldPhysicalPrefix(prefix))).toBe('5089fab4243f3ef0ad6787869f80bcbecf92180b26e768ae01a34a074d8a653e');
});

it('preserves a valid reordered segment and observes changed mutable inputs on each invocation', () => {
  const first = fieldNormalizationFixture(), expected = battedWorldFieldPhysicalPrefix(first);
  const second = structuredClone(first); mutable(second.baseField.field.motion).actors.reverse();
  const value = battedWorldFieldPhysicalPrefix(second);
  expect(value.segments[1].actors).toEqual([...expected.segments[1].actors].reverse());
  expect(value.field).toEqual(expected.field);
  const changed = structuredClone(second); mutable(changed.baseField.field.motion).actors[0].primitive.radius += 1;
  expect(() => battedWorldFieldPhysicalPrefix(changed)).toThrow(/rebase/);
});

const sqliteFixture = () => {
  const db = new DatabaseSync(':memory:');
  // Seed only the tiny field scope. Root owner replays are
  // outside this test; scope still validates real SQL rows and rederives Core motion.
  db.exec(`CREATE TABLE batted_world_field_actions (source_id TEXT, physical_pitch_source_id TEXT, response_source_id TEXT,
    geometry_source_id TEXT, previous_source_id TEXT, revision INTEGER, game_id TEXT, source_json TEXT, source_hash TEXT, snapshot_json TEXT, snapshot_hash TEXT);
    CREATE TABLE batted_world_field_heads (physical_pitch_source_id TEXT, response_source_id TEXT, geometry_source_id TEXT, source_id TEXT, revision INTEGER);`);
  const value = fieldNormalizationFixture().baseField, source = value.source;
  const sourceJson = canonical.actorJson(source), snapshotJson = canonical.actorJson(value);
  db.prepare('INSERT INTO batted_world_field_actions VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(source.sourceId, 'pitch', 'response', 'geometry', null, 1, 'game',
    sourceJson, canonical.actorHash(source), snapshotJson, canonical.actorHash(value));
  db.prepare('INSERT INTO batted_world_field_heads VALUES (?,?,?,?,?)').run('pitch', 'response', 'geometry', source.sourceId, 1);
  return { db, value, sourceJson, snapshotJson, owner: battedWorldFieldEvidenceFromSqlite(db), close() { db.close(); } };
};

it('normalizes each rederived source and snapshot once for both exact bytes and SHA256', () => {
  const x = sqliteFixture(), calls = vi.spyOn(inert, 'cloneInert');
  try {
    const value = x.owner.scope(x.value)[0];
    const sources = calls.mock.calls.filter(([v]) => mutable(v)?.sourceId === 'field' && mutable(v)?.previousFieldSourceId === null);
    const snapshots = calls.mock.calls.filter(([v]) => mutable(v)?.source?.sourceId === 'field' && mutable(v)?.revision === 1);
    console.log('scope normalization evidence', { sourceClones: sources.length, snapshotClones: snapshots.length,
      sourceHash: canonical.actorHash(value.source), snapshotHash: canonical.actorHash(value) });
    // Source input validation remains separate; JSON normalization is exactly one more clone.
    expect(sources.length).toBe(2); expect(snapshots.length).toBe(1);
    expect(canonical.actorJson(value.source)).toBe(x.sourceJson); expect(canonical.actorJson(value)).toBe(x.snapshotJson);
    expect(canonical.actorHash(value.source)).toBe('5e9d230a459fd6f74be1776ae9e96fc7349e212281163a176546964974c55d45');
    expect(canonical.actorHash(value)).toBe('b3411613b167c5b730f2890f0fce1103c042bfea4acc460c476f85396642a97c');
    calls.mockClear();
    expect(canonical.actorJson(x.owner.scope(x.value)[0])).toBe(x.snapshotJson);
    expect(calls.mock.calls.filter(([v]) => mutable(v)?.sourceId === 'field' && mutable(v)?.previousFieldSourceId === null)).toHaveLength(2);
  } finally { calls.mockRestore(); x.close(); }
});

it.each(['source_json', 'source_hash', 'snapshot_json', 'snapshot_hash'] as const)('rejects changed %s on a fresh scope read', column => {
  const x = sqliteFixture(); try {
    expect(canonical.actorJson(x.owner.scope(x.value)[0])).toBe(x.snapshotJson);
    const value = column === 'source_json' ? x.sourceJson.replace('pure-v1', 'changed')
      : column === 'snapshot_json' ? x.snapshotJson.replace('pure-v1', 'changed') : 'bad-hash';
    x.db.prepare(`UPDATE batted_world_field_actions SET ${column}=?`).run(value);
    expect(() => x.owner.scope(x.value)).toThrow(/Source|snapshot/);
  } finally { x.close(); }
});

it('rederives every scope from the current root and rejects malformed or nonfinite source data', () => {
  const x = sqliteFixture(); try {
    const expected = x.owner.scope(x.value)[0], changed = structuredClone(x.value);
    mutable(changed.response.touch.worldContact.actors[0].primitive).startCenter.x += 1;
    expect(() => x.owner.scope(changed)).toThrow(/snapshot/);
    expect(canonical.actorJson(x.owner.scope(x.value)[0])).toBe(canonical.actorJson(expected));
    for (const change of [ (s: any) => { s.extra = 1; }, (s: any) => { s.commands[0].bodyAcceleration.x = null; } ]) {
      const source = structuredClone(x.value.source); change(source);
      x.db.prepare('UPDATE batted_world_field_actions SET source_json=?').run(JSON.stringify(source));
      expect(() => x.owner.scope(x.value)).toThrow(/invalid/);
    }
  } finally { x.close(); }
});

it('does not retain segment identity maps when the same mutable input is replaced between calls', () => {
  const prefix = structuredClone(fieldNormalizationFixture()), before = battedWorldFieldPhysicalPrefix(prefix);
  const actors = structuredClone(prefix.baseField.field.motion.actors);
  mutable(actors[0]).playerId = 'same-input-new-foreign-actor';
  mutable(prefix.baseField.field.motion).actors = actors;
  expect(() => battedWorldFieldPhysicalPrefix(prefix)).toThrow(/coverage/);
  mutable(prefix.baseField.field.motion).actors = before.segments[1].actors;
  expect(canonical.actorJson(battedWorldFieldPhysicalPrefix(prefix))).toBe(canonical.actorJson(before));
});

it.each(['source_json', 'snapshot_json'] as const)('rejects noncanonical raw %s even when the value and hash are unchanged', column => {
  const x = sqliteFixture(); try {
    x.db.prepare(`UPDATE batted_world_field_actions SET ${column}=?`).run(' ' + (column === 'source_json' ? x.sourceJson : x.snapshotJson));
    expect(() => x.owner.scope(x.value)).toThrow(/Source|snapshot/);
  } finally { x.close(); }
});

it.each(['duplicate', 'foreign'] as const)('still rejects %s original actor identities before building segments', kind => {
  const prefix = structuredClone(fieldNormalizationFixture()), actors = mutable(prefix.baseField.response.touch.worldContact).actors;
  if (kind === 'duplicate') actors[1] = actors[0];
  else actors[0].playerId = 'foreign-original';
  expect(() => battedWorldFieldPhysicalPrefix(prefix)).toThrow(/original actor identity/);
});

it.each(['elapsed', 'ball'] as const)('rejects nonfinite %s horizons', kind => {
  const prefix = structuredClone(fieldNormalizationFixture()), moment = mutable(prefix.baseField.field.motion.world.moment);
  if (kind === 'elapsed') moment.elapsedSeconds = Infinity;
  else moment.ball.position.x = NaN;
  expect(() => battedWorldFieldPhysicalPrefix(prefix)).toThrow(/finite|moment/);
});

it('keeps bounded history and every prefix metadata guard when later SQL rows change', async () => {
  const x = sqliteFixture(); try {
    const { deriveBattedWorldFieldMotion } = await import('../../core/sim/ball/BattedWorldFieldMotion');
    const { battedWorldResponseInput } = await import('./SqliteBattedWorldContinuationStore');
    const { battedWorldMotionPrimitiveCommands } = await import('./SqliteBattedWorldMotionStore');
    const first = x.owner.scope(x.value)[0], source = { ...first.source, sourceId: 'field-2', previousFieldSourceId: first.source.sourceId,
      throughTick: first.source.throughTick + 1000 };
    const field = deriveBattedWorldFieldMotion({ response: battedWorldResponseInput(first.response), geometry: first.geometry.geometry,
      commands: battedWorldMotionPrimitiveCommands(first.response, source.commands), actors: first.field.motion.actors,
      cursor: first.field.motion.cursor!, carrierPlayerId: first.field.motion.carrierPlayerId,
      availableAtTick: source.availableAtTick, throughTick: source.throughTick });
    const second = { ...first, source, revision: 2, history: [...first.history, source], field };
    x.db.prepare('INSERT INTO batted_world_field_actions VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('field-2', 'pitch', 'response', 'geometry', 'field', 2, 'game',
      canonical.actorJson(source), canonical.actorHash(source), canonical.actorJson(second), canonical.actorHash(second));
    x.db.exec("UPDATE batted_world_field_heads SET source_id='field-2',revision=2");
    expect(canonical.actorJson(x.owner.scope(x.value))).toBe(canonical.actorJson([first, second]));
    const rows = x.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all();
    expect(canonical.actorJson(x.owner.scope(x.value, 'field'))).toBe(canonical.actorJson([first]));
    expect(x.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all()).toEqual(rows);
    expect(() => x.owner.scope(x.value, 'foreign')).toThrow(/outside/);
    x.db.exec("UPDATE batted_world_field_actions SET source_json='broken future payload' WHERE source_id='field-2'");
    expect(canonical.actorJson(x.owner.scope(x.value, 'field'))).toBe(canonical.actorJson([first]));
    expect(() => x.owner.scope(x.value)).toThrow();
    x.db.exec("UPDATE batted_world_field_actions SET game_id='foreign-game' WHERE source_id='field-2'");
    expect(() => x.owner.scope(x.value, 'field')).toThrow(/metadata/);
  } finally { x.close(); }
});

it('rederives a replaced valid source on the same connection instead of retaining either raw or derived rows', async () => {
  const x = sqliteFixture(); try {
    const before = x.owner.scope(x.value)[0];
    const { deriveInitialBattedWorldFieldMotion } = await import('../../core/sim/ball/BattedWorldFieldMotion');
    const { battedWorldResponseInput } = await import('./SqliteBattedWorldContinuationStore');
    const { battedWorldMotionPrimitiveCommands } = await import('./SqliteBattedWorldMotionStore');
    const source = { ...before.source, sourceVersion: 'replacement-v1', throughTick: before.source.throughTick + 1000 };
    const field = deriveInitialBattedWorldFieldMotion({ response: battedWorldResponseInput(before.response), geometry: before.geometry.geometry,
      commands: battedWorldMotionPrimitiveCommands(before.response, source.commands), availableAtTick: source.availableAtTick, throughTick: source.throughTick });
    const changed = { ...before, source, history: [source], field };
    x.db.prepare('UPDATE batted_world_field_actions SET source_json=?,source_hash=?').run(canonical.actorJson(source), canonical.actorHash(source));
    expect(() => x.owner.scope(x.value)).toThrow(/snapshot/);
    x.db.prepare('UPDATE batted_world_field_actions SET snapshot_json=?,snapshot_hash=?').run(canonical.actorJson(changed), canonical.actorHash(changed));
    const after = x.owner.scope(x.value)[0];
    expect(canonical.actorJson(after)).toBe(canonical.actorJson(changed));
    expect(canonical.actorHash(after)).not.toBe(canonical.actorHash(before));
  } finally { x.close(); }
});

it.each(['nonfinite', 'oversized'] as const)('retains generic snapshot normalization rejection for %s rederived roots', kind => {
  const x = sqliteFixture(); try {
    const changed = structuredClone(x.value);
    mutable(changed.response).extra = kind === 'nonfinite' ? Infinity : Array.from({ length: 100_001 }, () => 0);
    expect(() => x.owner.scope(changed)).toThrow(/finite|size limits/);
    expect(canonical.actorJson(x.owner.scope(x.value)[0])).toBe(x.snapshotJson);
  } finally { x.close(); }
});

import { createRequire } from 'node:module';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { battedWorldFieldThrowFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { battedWorldFieldPhysicalPrefix, battedWorldFieldBaseTouchHistoryFromPrefix } from './BattedWorldFieldPhysicalPrefix';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution,
  type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { createControlledBaseFactsFromBallWorldContacts } from '../../core/rules/BallWorldBaseContactPhysicalAdapter';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const policy = { custodyPolicy: 'release_exclusive_v1' as const };
let x: ReturnType<typeof battedWorldFieldThrowFixture>, moved: DurableBattedWorldFieldExecution, thrown: DurableBattedWorldFieldExecution;
let legacy: DurableBattedWorldFieldExecution, release: number;
const originalDir = mkdtempSync(join(tmpdir(), 'original-release-policy-'));
const prefix = () => ({ baseField: x.baseField, fields: [x.baseField], executions: [x.acquired, moved, thrown] });
const source = (kind: 'base_touch_history' | 'first_base_race', versioned = false): AcceptedBattedWorldFieldExecution => ({
  ...x.source, sourceId: `compat-${kind}${versioned ? '-exclusive' : ''}`, previousExecutionSourceId: thrown.source.sourceId,
  action: kind === 'first_base_race' ? { kind, ...(versioned ? policy : {}) }
    : { kind, playerId: x.capture.acquirerPlayerId, base: 'first', ...(versioned ? policy : {}) },
});
const archive = (db: import('node:sqlite').DatabaseSync, sourceId: string) => db.prepare(
  'SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(sourceId);
beforeAll(() => {
  x = battedWorldFieldThrowFixture(join(originalDir, 'state.sqlite'), 0);
  if (x.source.action.kind !== 'throw') throw new Error('atomic throw fixture');
  const throughTick = x.capture.secureTick + 1000;
  const carry: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'compat-carry', action: {
    kind: 'motion', availableAtTick: x.capture.secureTick, throughTick, commands: x.source.action.commands } };
  x.sources.set(carry.sourceId, carry); moved = x.executions.accept(carry.sourceId);
  const toss = { ...x.source, sourceId: 'compat-throw', previousExecutionSourceId: carry.sourceId,
    action: { ...x.source.action, availableAtTick: throughTick } };
  x.sources.set(toss.sourceId, toss); thrown = x.executions.accept(toss.sourceId);
  if (thrown.execution.kind !== 'throw' || thrown.execution.throw.kind !== 'released') throw new Error('released fixture');
  release = thrown.execution.throw.releaseCursor.moment.elapsedSeconds;
  const oldSource = source('base_touch_history'), surface = x.geometry.geometry.baseGeometry.bases.first;
  const history = battedWorldFieldBaseTouchHistoryFromPrefix({ ...prefix(), playerId: x.capture.acquirerPlayerId,
    base: surface.region, baseSurfaceHeightMeters: surface.surfaceHeightMeters });
  legacy = { source: oldSource, baseField: x.baseField, revision: thrown.revision + 1, history: [...thrown.history, oldSource],
    execution: { kind: 'base_touch_history', field: thrown.execution.field, playerId: x.capture.acquirerPlayerId, base: 'first', ...history,
      physicalRuleFacts: createControlledBaseFactsFromBallWorldContacts({ history: history.history, contacts: history.controlledContacts, base: 'first' }) } };
  x.f.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
}, 120_000);
afterAll(() => { x?.f.close(); rmSync(originalDir, { recursive: true, force: true }); });

// A read-only archive fixture is inserted as historical bytes, never through fresh Source admission.
const seedArchive = (db: import('node:sqlite').DatabaseSync, value: DurableBattedWorldFieldExecution) => {
  const pitch = value.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId;
  db.prepare('INSERT INTO batted_world_field_executions VALUES (?,?,?,?,?,?,?,?,?,?)').run(value.source.sourceId, pitch,
    value.source.baseFieldSourceId, value.source.previousExecutionSourceId, value.revision, value.baseField.response.model.gameId,
    json(value.source), hash(value.source), json(value), hash(value));
  db.prepare('UPDATE batted_world_field_execution_heads SET source_id=?,revision=?').run(value.source.sourceId, value.revision);
};
const withCopy = (run: (f: { db: import('node:sqlite').DatabaseSync; owner: ReturnType<typeof openSqliteBattedWorldFieldExecutionStore>;
  sources: Map<string, AcceptedBattedWorldFieldExecution>; path: string }) => void, archived = false) => {
  const dir = mkdtempSync(join(tmpdir(), 'release-policy-')), path = join(dir, 'state.sqlite');
  copyFileSync(x.f.path, path);
  const db = new DatabaseSync(path), sources = new Map<string, AcceptedBattedWorldFieldExecution>();
  const owner = openSqliteBattedWorldFieldExecutionStore(path, x.fields, { readAcceptedExecution: (id) => sources.get(id) ?? null });
  try {
    if (archived) seedArchive(db, legacy);
    run({ db, owner, sources, path });
  } finally { owner.close(); db.close(); rmSync(dir, { recursive: true, force: true }); }
};

it('reproduces the Native exact-release boundary and explicitly closes every previous inclusive carrier endpoint', () => {
  expect(release).toBe(0.011001);
  expect(moved.execution.field.motion.world.moment.elapsedSeconds).toBe(release);
  expect(thrown.execution.field.motion.carrierPlayerId).toBeNull();
  const old = battedWorldFieldPhysicalPrefix(prefix());
  expect(old.controlWindows.filter((w) => w.endElapsedSeconds === release).map((w) => w.endInclusive)).toEqual([true, false]);
  const corrected = battedWorldFieldPhysicalPrefix({ ...prefix(), ...policy });
  expect(corrected.controlWindows.filter((w) => w.endElapsedSeconds === release).map((w) => w.endInclusive)).toEqual([false, false]);
  expect(corrected.field).toEqual(old.field);
  expect(corrected.segments).toEqual(old.segments);
});

it('pins the original Native archive bytes recorded before the interpretation upgrade', () => withCopy(({ owner, sources }) => {
  // Recorded by the pre-correction Native accept path, not regenerated expectations.
  expect(hash(legacy)).toBe('282d93ebac8f07d676dcc4248e074115b62583d9f8be61567df8ac9d400cd210');
  expect(hash(legacy.source)).toBe('28cf49952957ccd3b4e24748e0a5d472f40dbafafb94c4aa215f56f437177b88');
  sources.set(legacy.source.sourceId, legacy.source);
  expect(owner.read(legacy.source.sourceId)).toEqual(legacy);
  expect(owner.accept(legacy.source.sourceId)).toEqual(legacy);
}, true));

it.each(['base_touch_history', 'first_base_race'] as const)('rejects newly admitted unsafe omitted-policy %s observations', (kind) => withCopy(({ db, owner, sources }) => {
  const observation = source(kind); sources.set(observation.sourceId, observation);
  expect(() => owner.accept(observation.sourceId)).toThrow(/custody policy/);
  expect(db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 3 });
  expect(db.prepare('SELECT revision FROM batted_world_field_execution_heads').get()).toEqual({ revision: 3 });
}), 120_000);

it.each(['base_touch_history', 'first_base_race'] as const)('admits explicit %s interpretation without advancing physical time', (kind) => withCopy(({ owner, sources }) => {
  const observation = source(kind, true); sources.set(observation.sourceId, observation);
  const result = owner.accept(observation.sourceId);
  expect(result.source).toEqual(observation);
  expect(result.execution.field).toEqual(thrown.execution.field);
  expect(owner.read(observation.sourceId)).toEqual(result);
  expect(owner.accept(observation.sourceId)).toEqual(result);
  sources.set(observation.sourceId, { ...observation, action: source(kind).action });
  expect(() => owner.accept(observation.sourceId)).toThrow(/frozen differently/);
}), 120_000);

it('retains archived JSON and hashes across reopen/retry and bounds reads before corrupt future payloads', () => withCopy(({ db, owner, sources, path }) => {
  const saved = archive(db, legacy.source.sourceId);
  expect(owner.read(legacy.source.sourceId)).toEqual(legacy);
  expect(owner.accept(legacy.source.sourceId)).toEqual(legacy);
  const future = { ...source('first_base_race', true), previousExecutionSourceId: legacy.source.sourceId };
  sources.set(future.sourceId, future); owner.accept(future.sourceId);
  db.prepare("UPDATE batted_world_field_executions SET source_json='invalid-future-payload' WHERE source_id=?").run(future.sourceId);
  const reopened = openSqliteBattedWorldFieldExecutionStore(path, x.fields);
  try {
    expect(reopened.read(legacy.source.sourceId)).toEqual(legacy);
    expect(reopened.accept(legacy.source.sourceId)).toEqual(legacy);
    expect(owner.accept(legacy.source.sourceId)).toEqual(legacy);
    expect(archive(db, legacy.source.sourceId)).toEqual(saved);
    db.prepare('UPDATE batted_world_field_executions SET revision=1.5 WHERE source_id=?').run(future.sourceId);
    expect(() => reopened.read(legacy.source.sourceId)).toThrow(/metadata|prefix head/);
  } finally { reopened.close(); }
}, true), 120_000);

it('rejects wrong policy values and changed policy Sources rather than falling back to legacy semantics', () => withCopy(({ db, owner, sources }) => {
  for (const bad of ['release_inclusive_v1', 'release_exclusive_v2', null, 1]) {
    const observation = source('base_touch_history', true);
    const changed = { ...observation, action: { ...observation.action, custodyPolicy: bad } } as unknown as AcceptedBattedWorldFieldExecution;
    sources.set(changed.sourceId, changed);
    expect(() => owner.accept(changed.sourceId)).toThrow(/policy|Source/);
    expect(() => battedWorldFieldPhysicalPrefix({ ...prefix(), custodyPolicy: bad } as unknown as Parameters<typeof battedWorldFieldPhysicalPrefix>[0]))
      .toThrow(/policy/);
  }
  const observation = source('base_touch_history', true); sources.set(observation.sourceId, observation);
  owner.accept(observation.sourceId);
  const changed = { ...observation, action: source('base_touch_history').action };
  db.prepare('UPDATE batted_world_field_executions SET source_json=?,source_hash=? WHERE source_id=?')
    .run(json(changed), hash(changed), observation.sourceId);
  expect(() => owner.read(observation.sourceId)).toThrow(/snapshot/);
}), 120_000);

it.each([
  ['Player', "UPDATE world_player_person_links SET person_id='changed';"],
  ['geometry', "UPDATE batted_world_field_geometries SET source_hash='changed';"],
  ['observation', "UPDATE batted_world_field_executions SET snapshot_hash='changed' WHERE source_id=NEW.source_id;"],
])('rolls back a versioned observation after a late %s mutation', (_name, mutation) => withCopy(({ db, owner, sources }) => {
  const saved = archive(db, thrown.source.sourceId), observation = source('base_touch_history', true);
  sources.set(observation.sourceId, observation);
  db.exec(`CREATE TRIGGER change_custody_basis AFTER INSERT ON batted_world_field_executions BEGIN ${mutation} END`);
  expect(() => owner.accept(observation.sourceId)).toThrow();
  expect(db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 3 });
  expect(db.prepare('SELECT revision FROM batted_world_field_execution_heads').get()).toEqual({ revision: 3 });
  expect(archive(db, thrown.source.sourceId)).toEqual(saved);
  db.exec('DROP TRIGGER change_custody_basis');
  expect(owner.accept(observation.sourceId).source).toEqual(observation);
}), 120_000);


it('keeps an archived interpretation after real recovery but rejects a fresh versioned observation with stale workload', () => withCopy(({ db, owner, sources, path }) => {
  const rest = { sourceEventId: 'release-policy-rest', sourceVersion: 'synthetic-v1', evidenceId: 'actual-rest',
    careerId: 'career-a', playerId: 'p2', atDay: 11, kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
  const workload = openSqlitePlayerWorkloadRecoveryStore(path, x.f.links, { readAcceptedBaseline: () => null,
    readAcceptedActivity: (id) => id === rest.sourceEventId ? rest : null });
  try {
    const saved = archive(db, legacy.source.sourceId);
    workload.apply(rest.sourceEventId, 0);
    expect(owner.read(legacy.source.sourceId)).toEqual(legacy);
    expect(owner.accept(legacy.source.sourceId)).toEqual(legacy);
    const observation = { ...source('base_touch_history', true), previousExecutionSourceId: legacy.source.sourceId };
    sources.set(observation.sourceId, observation);
    expect(() => owner.accept(observation.sourceId)).toThrow(/workload/);
    expect(archive(db, legacy.source.sourceId)).toEqual(saved);
    expect(db.prepare('SELECT count(*) AS n FROM batted_world_field_executions').get()).toEqual({ n: 4 });
  } finally { workload.close(); }
}, true), 120_000);


it('preserves an archived Native same-time foot/control fact while new observers retain only the actual foot touch', () => {
  const y = battedWorldFieldThrowFixture(undefined, 0);
  try {
    if (y.source.action.kind !== 'throw') throw new Error('atomic throw fixture');
    const { ticksPerSecond } = y.response.touch.worldContact.flight.source.execution.ballFlightParameters;
    const throughTick = y.capture.secureTick + 1000, at = (throughTick - y.capture.moment.originTick) / ticksPerSecond;
    const dt = at - y.capture.moment.elapsedSeconds, surface = y.geometry.geometry.baseGeometry.bases.first;
    const foot = y.acquired.execution.field.motion.actors.find((a) => a.playerId === y.capture.acquirerPlayerId && a.primitive.role === 'left_foot')!;
    const p = foot.primitive, local = (y.capture.moment.originTick - p.startTick) / ticksPerSecond
      + y.capture.moment.elapsedSeconds - (foot.startElapsedSeconds ?? 0);
    const acceleration = (axis: 'x' | 'y' | 'z') => {
      const start = p.startCenter[axis] + p.startVelocity[axis] * local + 0.5 * p.acceleration[axis] * local ** 2;
      const velocity = p.startVelocity[axis] + p.acceleration[axis] * local;
      const target = axis === 'y' ? surface.surfaceHeightMeters : surface.region.center[axis];
      return 2 * (target - start - velocity * dt) / dt ** 2;
    };
    // Synthetic accepted motors target the real bag before any motion is adopted.
    // No archived actors, Source, moment or foot facts are altered to make contact.
    const commands = y.source.action.commands.map((c) => c.playerId !== y.capture.acquirerPlayerId ? c : { ...c,
      primitiveMotions: c.primitiveMotions.map((m) => m.role !== 'left_foot' ? m : { ...m, offsetAcceleration: {
        x: acceleration('x') - c.bodyAcceleration.x, y: acceleration('y') - c.bodyAcceleration.y, z: acceleration('z') - c.bodyAcceleration.z } }) });
    const carry: AcceptedBattedWorldFieldExecution = { ...y.source, sourceId: 'foot-carry', action: {
      kind: 'motion', availableAtTick: y.capture.secureTick, throughTick, commands } };
    y.sources.set(carry.sourceId, carry); const carried = y.executions.accept(carry.sourceId);
    const toss = { ...y.source, sourceId: 'foot-toss', previousExecutionSourceId: carry.sourceId,
      action: { ...y.source.action, availableAtTick: throughTick } };
    y.sources.set(toss.sourceId, toss); const released = y.executions.accept(toss.sourceId);
    if (released.execution.kind !== 'throw' || released.execution.throw.kind !== 'released') throw new Error('released fixture');
    expect(released.execution.throw.releaseCursor.moment.elapsedSeconds).toBe(at);
    const oldSource: AcceptedBattedWorldFieldExecution = { ...toss, sourceId: 'foot-archived-observer', previousExecutionSourceId: toss.sourceId,
      action: { kind: 'base_touch_history', playerId: y.capture.acquirerPlayerId, base: 'first' } };
    const history = battedWorldFieldBaseTouchHistoryFromPrefix({ baseField: y.baseField, fields: [y.baseField],
      executions: [y.acquired, carried, released], playerId: y.capture.acquirerPlayerId,
      base: surface.region, baseSurfaceHeightMeters: surface.surfaceHeightMeters });
    expect(history.history.episodes).toEqual([{ startElapsedSeconds: at, endElapsedSeconds: at }]);
    expect(history.controlledContacts).toHaveLength(1);
    const old: DurableBattedWorldFieldExecution = { source: oldSource, baseField: y.baseField, revision: released.revision + 1,
      history: [...released.history, oldSource], execution: { kind: 'base_touch_history', field: released.execution.field,
        playerId: y.capture.acquirerPlayerId, base: 'first', ...history, physicalRuleFacts: createControlledBaseFactsFromBallWorldContacts({
          history: history.history, contacts: history.controlledContacts, base: 'first' }) } };
    seedArchive(y.f.db, old); const saved = archive(y.f.db, oldSource.sourceId);
    expect(y.executions.read(oldSource.sourceId)).toEqual(old);
    const next: AcceptedBattedWorldFieldExecution = { ...oldSource, sourceId: 'foot-exclusive-observer', previousExecutionSourceId: oldSource.sourceId,
      action: { kind: 'base_touch_history', playerId: y.capture.acquirerPlayerId, base: 'first', ...policy } };
    y.sources.set(next.sourceId, next); const observed = y.executions.accept(next.sourceId);
    expect(observed.execution).toMatchObject({ kind: 'base_touch_history', history: history.history, controlledContacts: [], physicalRuleFacts: [] });
    const race: AcceptedBattedWorldFieldExecution = { ...next, sourceId: 'foot-exclusive-race', previousExecutionSourceId: next.sourceId,
      action: { kind: 'first_base_race', ...policy } };
    y.sources.set(race.sourceId, race); const result = y.executions.accept(race.sourceId);
    if (result.execution.kind !== 'first_base_race') throw new Error('race observation');
    expect(result.execution.defendersFirstBase.find((d) => d.history.playerId === y.capture.acquirerPlayerId))
      .toEqual({ history: history.history, controlledContacts: [] });
    expect(y.executions.accept(oldSource.sourceId)).toEqual(old);
    expect(archive(y.f.db, oldSource.sourceId)).toEqual(saved);
  } finally { y.f.close(); }
}, 120_000);

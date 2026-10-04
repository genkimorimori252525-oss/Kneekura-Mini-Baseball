import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { openSqliteActualFieldObservationStore, type DurableActualFieldObservation } from './SqliteActualFieldObservationStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Db = import('node:sqlite').DatabaseSync;
type Row = Record<string, string | number | null>;
let directory: string;
let physical: ReturnType<typeof battedWorldFieldExecutionFixture>;
let x: ReturnType<typeof installSyntheticObservation>;
let first: DurableActualFieldObservation, second: DurableActualFieldObservation;
let firstRows: Row[], futureRows: Row[], firstHeads: Row[], futureHeads: Row[];
const rows = (db: Db, table: string) => db.prepare(`SELECT * FROM ${table} ORDER BY source_id`).all() as Row[];
const insert = (db: Db, row: Row) => db.prepare(`INSERT INTO actual_field_observations (${Object.keys(row).join(',')})
  VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
const restore = (future = false) => {
  physical.f.db.exec('DELETE FROM actual_field_observations; DELETE FROM actual_field_observation_heads;');
  for (const row of future ? futureRows : firstRows) insert(physical.f.db, row);
  for (const head of future ? futureHeads : firstHeads) physical.f.db.prepare('INSERT INTO actual_field_observation_heads VALUES (?,?,?,?)')
    .run(head.physical_pitch_source_id, head.player_id, head.source_id, head.revision);
};
const update = (row: Row) => physical.f.db.prepare(`UPDATE actual_field_observations SET ${Object.keys(row).map(key => `${key}=?`).join(',')}
  WHERE source_id=?`).run(...Object.values(row), row.source_id);
const rehash = (row: Row) => {
  for (const column of ['source', 'snapshot']) row[`${column}_hash`] = hash(JSON.parse(row[`${column}_json`] as string));
  return row;
};
const hidden = (keepOriginalHistoryScope = true): Row => {
  const row = structuredClone(firstRows[0]);
  const scope = { sourceId: 'hidden-observation', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player' };
  const source = { ...first.source, ...scope }, snapshot = JSON.parse(json(first));
  Object.assign(snapshot.source, scope);
  Object.assign(snapshot.history[0], keepOriginalHistoryScope ? { sourceId: scope.sourceId } : scope);
  Object.assign(row, { source_id: scope.sourceId, physical_pitch_source_id: scope.physicalPitchSourceId, player_id: scope.playerId,
    source_json: json(source), snapshot_json: json(snapshot) });
  return rehash(row);
};
const pending = () => {
  const source = { ...first.source, sourceId: 'pending-observation', previousObservationSourceId: first.source.sourceId };
  x.observationSources.set(source.sourceId, source); return source;
};
const assertNoWrite = (callback: () => unknown) => {
  const before = rows(physical.f.db, 'actual_field_observations'), heads = rows(physical.f.db, 'actual_field_observation_heads');
  expect(callback).toThrow();
  expect(rows(physical.f.db, 'actual_field_observations')).toEqual(before);
  expect(rows(physical.f.db, 'actual_field_observation_heads')).toEqual(heads);
};
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'observation-integrity-'));
  physical = battedWorldFieldExecutionFixture(join(directory, 'state.sqlite')); x = installSyntheticObservation(physical, 'p2', null);
  expect(physical.f.db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
  first = x.observations.accept(x.observationSource.sourceId);
  firstRows = rows(physical.f.db, 'actual_field_observations'); firstHeads = rows(physical.f.db, 'actual_field_observation_heads');
  const source = { ...first.source, sourceId: 'later-observation', previousObservationSourceId: first.source.sourceId };
  x.observationSources.set(source.sourceId, source); second = x.observations.accept(source.sourceId);
  futureRows = rows(physical.f.db, 'actual_field_observations'); futureHeads = rows(physical.f.db, 'actual_field_observation_heads');
  restore();
}, 120_000);
afterEach(() => { vi.restoreAllMocks(); restore(); });
afterAll(() => { physical.f.close(); rmSync(directory, { recursive: true, force: true }); });

it.each(['read', 'retry', 'fresh'] as const)('finds a rehashed hidden history owner during public %s', operation => {
  const copy = hidden();
  const snapshot = JSON.parse(copy.snapshot_json as string);
  expect(snapshot.source.physicalPitchSourceId).toBe('foreign-pitch');
  expect(snapshot.history[0].physicalPitchSourceId).toBe(first.source.physicalPitchSourceId);
  expect(snapshot.history[0].playerId).toBe(first.source.playerId);
  expect(snapshot.history[0].sourceId).toBe(copy.source_id);
  insert(physical.f.db, copy);
  assertNoWrite(() => operation === 'read' ? x.observations.read(first.source.sourceId)
    : x.observations.accept(operation === 'retry' ? first.source.sourceId : pending().sourceId));
});

it('discovers original ownership in an earlier history entry even when the last entry moved away', () => {
  const row = structuredClone(futureRows.find(row => row.source_id === second.source.sourceId)!);
  const source = JSON.parse(row.source_json as string), snapshot = JSON.parse(row.snapshot_json as string);
  const scope = { sourceId: 'hidden-later-owner', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player' };
  Object.assign(source, scope); Object.assign(snapshot.source, scope); Object.assign(snapshot.history[1], scope);
  Object.assign(row, { source_id: scope.sourceId, physical_pitch_source_id: scope.physicalPitchSourceId, player_id: scope.playerId,
    source_json: json(source), snapshot_json: json(snapshot) });
  insert(physical.f.db, rehash(row));
  assertNoWrite(() => x.observations.read(first.source.sourceId));
  assertNoWrite(() => x.observations.accept(pending().sourceId));
});

it.each(['source', 'snapshot', 'last-history'] as const)('finds a moved Source ID through its %s identity mirror before a replacement write', mirror => {
  const row = hidden(false), source = JSON.parse(row.source_json as string), snapshot = JSON.parse(row.snapshot_json as string);
  if (mirror === 'source') source.sourceId = first.source.sourceId;
  else (mirror === 'snapshot' ? snapshot.source : snapshot.history[0]).sourceId = first.source.sourceId;
  row.source_json = json(source); row.snapshot_json = json(snapshot); rehash(row);
  physical.f.db.exec('DELETE FROM actual_field_observations; DELETE FROM actual_field_observation_heads;');
  insert(physical.f.db, row);
  physical.f.db.prepare('INSERT INTO actual_field_observation_heads VALUES (?,?,?,?)')
    .run(row.physical_pitch_source_id, row.player_id, row.source_id, 1);
  assertNoWrite(() => x.observations.read(first.source.sourceId));
  assertNoWrite(() => x.observations.accept(first.source.sourceId));
});

it.each(['source', 'snapshot', 'last-history'] as const)('rejects a duplicate Source ID hidden in a foreign %s mirror', mirror => {
  const row = hidden(false), source = JSON.parse(row.source_json as string), snapshot = JSON.parse(row.snapshot_json as string);
  if (mirror === 'source') source.sourceId = first.source.sourceId;
  else (mirror === 'snapshot' ? snapshot.source : snapshot.history[0]).sourceId = first.source.sourceId;
  row.source_json = json(source); row.snapshot_json = json(snapshot); insert(physical.f.db, rehash(row));
  assertNoWrite(() => x.observations.read(first.source.sourceId));
  assertNoWrite(() => x.observations.accept(first.source.sourceId));
  assertNoWrite(() => x.observations.accept(pending().sourceId));
});

it.each(['source', 'snapshot', 'history'] as const)('checks future %s ownership metadata without replaying that payload', mirror => {
  for (const key of ['sourceId', 'physicalPitchSourceId', 'playerId', 'baseFieldSourceId', 'executionSourceId',
    'observationModelSourceId', 'previousObservationSourceId'] as const) {
    restore(true);
    const row = structuredClone(futureRows.find(row => row.source_id === second.source.sourceId)!);
    const source = JSON.parse(row.source_json as string), snapshot = JSON.parse(row.snapshot_json as string);
    const target = mirror === 'source' ? source : mirror === 'snapshot' ? snapshot.source : snapshot.history[1];
    target[key] = 'foreign-metadata';
    row.source_json = json(source); row.snapshot_json = json(snapshot); update(rehash(row));
    expect(() => x.observations.read(first.source.sourceId), `${mirror}.${key}`).toThrow();
  }
});

it('checks every historical identity entry and snapshot revision/length even on a future row', () => {
  for (const mutate of [
    (s: Record<string, any>) => { s.history[0].sourceId = 'foreign-earlier-id'; },
    (s: Record<string, any>) => { s.history[0].physicalPitchSourceId = 'foreign-earlier-pitch'; },
    (s: Record<string, any>) => { s.history[0].playerId = 'foreign-earlier-player'; },
    (s: Record<string, any>) => { s.history[0].baseFieldSourceId = 'foreign-earlier-base'; },
    (s: Record<string, any>) => { s.history.pop(); },
    (s: Record<string, any>) => { s.history = { 0: s.history[0], 1: s.history[1] }; },
    (s: Record<string, any>) => { s.history[0] = 'not-an-identity'; },
    (s: Record<string, any>) => { s.revision = 8; },
  ]) {
    restore(true);
    const row = structuredClone(futureRows.find(row => row.source_id === second.source.sourceId)!);
    const snapshot = JSON.parse(row.snapshot_json as string); mutate(snapshot); row.snapshot_json = json(snapshot); update(rehash(row));
    expect(() => x.observations.read(first.source.sourceId)).toThrow();
  }
});

const duplicate = (object: string, key: string, value: string) => `${object.slice(0, -1)},${JSON.stringify(key)}:${value}}`;
it.each(['Source identity', 'snapshot Source identity', 'history identity', 'snapshot Source container',
  'history container', 'snapshot revision'] as const)('rejects duplicate future %s metadata without inspecting its payload', kind => {
  restore(true);
  const row = structuredClone(futureRows.find(row => row.source_id === second.source.sourceId)!);
  const snapshot = JSON.parse(row.snapshot_json as string);
  const ambiguous = duplicate(json(second.source), 'sourceId', JSON.stringify('foreign-later-key'));
  if (kind === 'Source identity') row.source_json = ambiguous;
  else if (kind === 'snapshot Source identity') row.snapshot_json = (row.snapshot_json as string).replace(`"source":${json(second.source)}`, `"source":${ambiguous}`);
  else if (kind === 'history identity') row.snapshot_json = (row.snapshot_json as string)
    .replace(`"history":${json(snapshot.history)}`, `"history":[${json(first.source)},${ambiguous}]`);
  else if (kind === 'snapshot Source container') row.snapshot_json = duplicate(row.snapshot_json as string, 'source', ambiguous);
  else if (kind === 'history container') row.snapshot_json = duplicate(row.snapshot_json as string, 'history', `[${json(first.source)},${ambiguous}]`);
  else row.snapshot_json = duplicate(row.snapshot_json as string, 'revision', '9');
  update(row);
  assertNoWrite(() => x.observations.read(first.source.sourceId));
});

it.each(['Source', 'snapshot Source', 'history', 'Source container', 'history container'].flatMap(kind =>
  ['scope', 'ID'].map(mode => [kind, mode] as const)))(
  'discovers hidden original %s ownership appearing only in later duplicate %s keys', (kind, mode) => {
    const row = hidden(false), source = JSON.parse(row.source_json as string), snapshot = JSON.parse(row.snapshot_json as string);
    const claim = { ...source, ...(mode === 'ID' ? { sourceId: first.source.sourceId }
      : { physicalPitchSourceId: first.source.physicalPitchSourceId, playerId: first.source.playerId }) };
    const ambiguous = mode === 'ID' ? duplicate(json(source), 'sourceId', json(first.source.sourceId))
      : duplicate(duplicate(json(source), 'physicalPitchSourceId', json(first.source.physicalPitchSourceId)), 'playerId', json(first.source.playerId));
    if (kind === 'Source') row.source_json = ambiguous;
    else if (kind === 'snapshot Source') row.snapshot_json = (row.snapshot_json as string).replace(`"source":${json(snapshot.source)}`, `"source":${ambiguous}`);
    else if (kind === 'history') row.snapshot_json = (row.snapshot_json as string).replace(`"history":${json(snapshot.history)}`, `"history":[${ambiguous}]`);
    else if (kind === 'Source container') row.snapshot_json = duplicate(row.snapshot_json as string, 'source', json(claim));
    else row.snapshot_json = duplicate(row.snapshot_json as string, 'history', `[${json(claim)}]`);
    insert(physical.f.db, row);
    assertNoWrite(() => x.observations.read(first.source.sourceId));
    assertNoWrite(() => x.observations.accept(first.source.sourceId));
    assertNoWrite(() => x.observations.accept(pending().sourceId));
  });

it('does not enforce duplicate-key rules on future view/receipt payloads outside identity metadata', () => {
  restore(true);
  const row = structuredClone(futureRows.find(row => row.source_id === second.source.sourceId)!);
  row.source_json = duplicate(row.source_json as string, 'view', '{"forward":null,"forward":"unread"}');
  row.snapshot_json = duplicate(row.snapshot_json as string, 'receipt', '{"samples":null,"samples":"unread"}');
  update(row);
  expect(x.observations.read(first.source.sourceId)).toEqual(first);
});

it('keeps later Sources distinct from inherited Source IDs and preserves healthy archive bytes on reopen', () => {
  restore(true);
  const reopened = physical.f.track(openSqliteActualFieldObservationStore(physical.f.path));
  expect(reopened.read(first.source.sourceId)).toEqual(first);
  expect(reopened.accept(first.source.sourceId)).toEqual(first);
  expect(reopened.read(second.source.sourceId)).toEqual(second);
  expect(reopened.accept(second.source.sourceId)).toEqual(second);
  expect(rows(physical.f.db, 'actual_field_observations')).toEqual(futureRows);
  expect(rows(physical.f.db, 'actual_field_observation_heads')).toEqual(futureHeads);
});

it('ignores future view/receipt payloads and invalid JSON while still enforcing available valid identity metadata', () => {
  restore(true);
  const row = structuredClone(futureRows.find(row => row.source_id === second.source.sourceId)!);
  const source = JSON.parse(row.source_json as string), snapshot = JSON.parse(row.snapshot_json as string);
  source.view = 'unread-future-view'; snapshot.source.view = null; snapshot.receipt = 'unread-future-perception';
  snapshot.history.forEach((entry: Record<string, unknown>) => { entry.view = ['unread-future-view']; });
  row.source_json = json(source); row.snapshot_json = json(snapshot); update(rehash(row));
  expect(x.observations.read(first.source.sourceId)).toEqual(first);
  expect(x.observations.accept(first.source.sourceId)).toEqual(first);
  assertNoWrite(() => x.observations.read(second.source.sourceId));
  row.source_json = 'invalid-future-source'; row.snapshot_json = 'invalid-future-snapshot'; update(row);
  expect(x.observations.read(first.source.sourceId)).toEqual(first);
  expect(x.observations.accept(first.source.sourceId)).toEqual(first);
  assertNoWrite(() => x.observations.accept(pending().sourceId));
});

it('rechecks a retry when the authority callback injects a hidden history owner', () => {
  const store = physical.f.track(openSqliteActualFieldObservationStore(physical.f.path, { readAcceptedObservation: () => {
    insert(physical.f.db, hidden()); return first.source;
  } }));
  expect(() => store.accept(first.source.sourceId)).toThrow();
  expect(rows(physical.f.db, 'actual_field_observations')).toHaveLength(2);
});

it.each(['before-BEGIN', 'inside-BEGIN', 'post-insert'].flatMap(phase =>
  ['ordinary', 'duplicate-key'].map(kind => [phase, kind] as const)))('detects hidden history ownership %s (%s) and preserves transaction boundaries', (phase, kind) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const exec = DatabaseSync.prototype.exec; let changed = false;
  const source = pending(), copy = hidden(kind === 'ordinary');
  if (kind === 'duplicate-key') {
    const snapshot = JSON.parse(copy.snapshot_json as string);
    const ambiguous = duplicate(duplicate(json(snapshot.history[0]), 'physicalPitchSourceId', json(first.source.physicalPitchSourceId)),
      'playerId', json(first.source.playerId));
    copy.snapshot_json = (copy.snapshot_json as string).replace(`"history":${json(snapshot.history)}`, `"history":[${ambiguous}]`);
  }
  const physicalBefore = rows(physical.f.db, 'batted_world_field_actions');
  if (phase === 'post-insert') {
    // Trigger uses the same hidden ownership shape; the later checks must see its own uncommitted row.
    const quote = (value: string | number | null) => value === null ? 'NULL' : typeof value === 'number' ? value : `'${value.replaceAll("'", "''")}'`;
    physical.f.db.exec(`CREATE TRIGGER hidden_history AFTER INSERT ON actual_field_observations
      WHEN NEW.source_id='${source.sourceId}' BEGIN INSERT INTO actual_field_observations VALUES (${Object.values(copy).map(quote).join(',')}); END`);
  } else vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function (this: Db, sql: string) {
    if (phase === 'before-BEGIN' && sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; insert(physical.f.db, copy); }
    exec.call(this, sql);
    if (phase === 'inside-BEGIN' && sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; insert(this, copy); }
  });
  try {
    expect(() => x.observations.accept(source.sourceId)).toThrow();
    if (phase !== 'post-insert') expect(changed).toBe(true);
    expect(rows(physical.f.db, 'actual_field_observations')).toEqual(phase === 'before-BEGIN' ? [...firstRows, copy] : firstRows);
    expect(rows(physical.f.db, 'actual_field_observation_heads')).toEqual(firstHeads);
    expect(rows(physical.f.db, 'batted_world_field_actions')).toEqual(physicalBefore);
  } finally { vi.restoreAllMocks(); if (phase === 'post-insert') physical.f.db.exec('DROP TRIGGER hidden_history'); }
});

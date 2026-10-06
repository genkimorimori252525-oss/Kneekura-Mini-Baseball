import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { originalFoulRuleFixture } from './ActualFoulRuleFixtures.test-support';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Added after recovery. These cases are additional to the unchanged reviewed49;
// no old RED or GREEN receipt is attributed to them.
let directory: string, fixture: ReturnType<typeof originalFoulRuleFixture>;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'foul-original-count-metadata-'));
  fixture = originalFoulRuleFixture(join(directory, 'original.sqlite'), 'ordinary_0');
  fixture.store.accept(fixture.source.sourceId);
}, 120_000);
afterAll(() => { fixture?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });
const table = 'actual_foul_rule_consumptions';
const state = () => json({ rows: fixture.f.db.prepare('SELECT * FROM main.' + table + ' ORDER BY source_id').all(),
  admissions: fixture.f.db.prepare('SELECT * FROM main.actual_live_play_admissions ORDER BY sequence').all() });
const early = () => ({ ...fixture.query, cut: { kind: 'original_pitch' as const } });

it('rejects changed embedded original-count pitch identity before the count payload is available', () => {
  const db = fixture.f.db, reader = actualFoulRuleConsumptionEvidenceFromSqlite(db), result = fixture.store.read(fixture.source.sourceId)!;
  const changed = JSON.parse(json(result)); changed.countEvidence.basis.originalCount.physicalPitchSourceId = 'foreign-pitch';
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE main.' + table + ' SET snapshot_json=? WHERE source_id=?').run(json(changed), result.source.sourceId);
    const before = state(); expect(() => reader.census(early())).toThrow(); expect(() => reader.read(result.source.sourceId)).toThrow();
    expect(state()).toBe(before);
  } finally { db.exec('ROLLBACK'); }
});
it.each(['plain', 'duplicate_escaped'] as const)('discovers a foreign-indexed consumer through its %s original-count pitch claim', kind => {
  const db = fixture.f.db, reader = actualFoulRuleConsumptionEvidenceFromSqlite(db), result = fixture.store.read(fixture.source.sourceId)!;
  const original = state(), baseline = reader.census(early());
  const foreign = (value: unknown): unknown => typeof value === 'string' ? 'foreign:' + value : Array.isArray(value) ? value.map(foreign)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, foreign(v)])) : value;
  const source = { ...fixture.source, sourceId: 'foreign-count-consumer', runtimeSourceId: 'foreign-runtime', stopProductionSourceId: 'foreign-stop' };
  const value = JSON.parse(json(foreign(result))); value.source = source; value.history = [source]; value.gameId = 'foreign-game'; value.playId = 999;
  const row = { ...db.prepare('SELECT * FROM main.' + table + ' WHERE source_id=?').get(result.source.sourceId)! };
  for (const key of Object.keys(row)) if (key.endsWith('_id') || key.endsWith('_key')) row[key] = 'foreign-' + key;
  Object.assign(row, { source_id: source.sourceId, runtime_source_id: source.runtimeSourceId, stop_production_source_id: source.stopProductionSourceId,
    physical_pitch_source_id: value.physicalPitchSourceId, first_physical_pitch_source_id: value.firstPhysicalPitchSourceId,
    scope_id: value.scopeId, game_id: value.gameId, play_id: value.playId, source_json: json(source), source_hash: hash(source),
    snapshot_json: json(value), snapshot_hash: hash(value) });
  const keys = Object.keys(row);
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO main.' + table + '(' + keys.join(',') + ') VALUES(' + keys.map(() => '?').join(',') + ')').run(...keys.map(k => row[k]));
    expect(reader.read(result.source.sourceId)).toEqual(result); expect(reader.census(early())).toEqual(baseline);
    let changed = json(value);
    if (kind === 'plain') { value.countEvidence.basis.originalCount.physicalPitchSourceId = fixture.physical.source.sourceId; changed = json(value); }
    else {
      const count = value.countEvidence.basis.originalCount;
      changed = changed.replace('"originalCount":' + json(count), '"originalCount":{"physicalPitchSource\\u0049d":'
        + json(fixture.physical.source.sourceId) + ',' + json(count).slice(1));
    }
    db.prepare('UPDATE main.' + table + ' SET snapshot_json=? WHERE source_id=?').run(changed, source.sourceId);
    const before = state(); expect(() => reader.census(early())).toThrow(); expect(() => reader.read(result.source.sourceId)).toThrow();
    expect(state()).toBe(before);
  } finally { db.exec('ROLLBACK'); }
  expect(state()).toBe(original);
});

it.each(['plain', 'duplicate_escaped', 'count_evidence_array', 'basis_array'] as const)('discovers a foreign-indexed consumer through its %s physical-prefix field claim', kind => {
  const db = fixture.f.db, reader = actualFoulRuleConsumptionEvidenceFromSqlite(db), result = fixture.store.read(fixture.source.sourceId)!;
  const original = state(), baseline = reader.census(early());
  const target = result.countEvidence.basis.physicalPrefixReferences.find(reference => reference.owner === 'batted_world_field_actions');
  expect(target).toBeDefined();
  const foreign = (value: unknown): unknown => typeof value === 'string' ? 'foreign:' + value : Array.isArray(value) ? value.map(foreign)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, foreign(v)])) : value;
  const source = { ...fixture.source, sourceId: 'foreign-prefix-consumer', runtimeSourceId: 'foreign-runtime', stopProductionSourceId: 'foreign-stop' };
  const value = JSON.parse(json(foreign(result))); value.source = source; value.history = [source]; value.gameId = 'foreign-game'; value.playId = 999;
  const row = { ...db.prepare('SELECT * FROM main.' + table + ' WHERE source_id=?').get(result.source.sourceId)! };
  for (const key of Object.keys(row)) if (key.endsWith('_id') || key.endsWith('_key')) row[key] = 'foreign-' + key;
  Object.assign(row, { source_id: source.sourceId, runtime_source_id: source.runtimeSourceId, stop_production_source_id: source.stopProductionSourceId,
    physical_pitch_source_id: value.physicalPitchSourceId, first_physical_pitch_source_id: value.firstPhysicalPitchSourceId,
    scope_id: value.scopeId, game_id: value.gameId, play_id: value.playId, source_json: json(source), source_hash: hash(source),
    snapshot_json: json(value), snapshot_hash: hash(value) });
  const keys = Object.keys(row);
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO main.' + table + '(' + keys.join(',') + ') VALUES(' + keys.map(() => '?').join(',') + ')').run(...keys.map(k => row[k]));
    expect(reader.read(result.source.sourceId)).toEqual(result); expect(reader.census(early())).toEqual(baseline);
    // The only target identity added to this fully foreign row is a source ID
    // inside an explicit governed field reference; preserve its owner domain.
    const references = value.countEvidence.basis.physicalPrefixReferences;
    const index = result.countEvidence.basis.physicalPrefixReferences.indexOf(target!);
    // A target Source under a foreign owner must not borrow the field owner from
    // a different reference object whose Source is unrelated to this pitch.
    const foreignSourceId = references[index].sourceId;
    references[index].sourceId = target!.sourceId;
    references.push({ ...references[index], owner: 'batted_world_field_actions', sourceId: 'foreign-prefix-source' });
    db.prepare('UPDATE main.' + table + ' SET snapshot_json=? WHERE source_id=?').run(json(value), source.sourceId);
    const foreignOwnerState = state();
    expect(reader.read(result.source.sourceId)).toEqual(result); expect(reader.census(early())).toEqual(baseline);
    expect(state()).toBe(foreignOwnerState);
    references.pop(); references[index].sourceId = foreignSourceId;
    references[index].owner = 'batted_world_field_actions';
    let changed: string;
    if (kind === 'plain') { references[index].sourceId = target!.sourceId; changed = json(value); }
    else if (kind === 'duplicate_escaped') {
      const reference = references[index];
      const raw = '{"source\\u0049d":' + json(target!.sourceId) + ',' + json(reference).slice(1);
      changed = json(value).replace(json(reference), raw);
    } else {
      references[index].sourceId = target!.sourceId;
      if (kind === 'count_evidence_array') value.countEvidence = [value.countEvidence];
      else value.countEvidence.basis = [value.countEvidence.basis];
      changed = json(value);
    }
    db.prepare('UPDATE main.' + table + ' SET snapshot_json=? WHERE source_id=?').run(changed, source.sourceId);
    const before = state(); expect(() => reader.census(early())).toThrow(); expect(() => reader.read(result.source.sourceId)).toThrow();
    expect(state()).toBe(before);
  } finally { db.exec('ROLLBACK'); }
  expect(state()).toBe(original);
});

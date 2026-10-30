import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { openSqliteRuleSourceRegistryStore, ruleSourceRegistryEvidenceFromSqlite } from './SqliteRuleSourceRegistryStore';
import { deriveProjectFairPoleRuleRegistrationV1, type AcceptedProjectFairPoleRuleSourceV1 } from './RuleSourceRegistryV1';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const table = 'rule_source_registry_v1_sources';
let directory: string, path: string, db: InstanceType<typeof DatabaseSync>, store: ReturnType<typeof openSqliteRuleSourceRegistryStore>;
let source: AcceptedProjectFairPoleRuleSourceV1;
const accepted = new Map<string, unknown>();
const count = () => db.prepare("SELECT 1 FROM main.sqlite_schema WHERE type='table' AND name=?").get(table)
  ? Number(db.prepare('SELECT count(*) n FROM main.' + table).get()!.n) : 0;
beforeEach(() => {
  directory = mkdtempSync(join(resolve('work'), 'rule-source-v215-test-')); path = join(directory, 'fresh.sqlite');
  db = new DatabaseSync(path);
  source = { sourceId: 'explicit-project-rule', sourceVersion: 'test-v1', kind: 'project_fair_pole_rule_source_v1', evidenceAuthority: 'EXPLICIT_PROJECT_RULE_MODEL',
    scope: { ruleModelId: 'test-game', ruleModelRevision: '1' }, baseProfile: { ruleProfileId: 'npb-2026', rulesRevision: '2026' },
    interpretation: 'ADOPTED_FAIR_POLE_CONTACT_IS_FAIR_V1', availableFromDay: 40,
    provenance: { kind: 'INLINE_PROJECT_DEFINITION', definitionText: 'A test game definition, without a verified official citation.' } };
  accepted.clear(); accepted.set(source.sourceId, source);
  store = openSqliteRuleSourceRegistryStore(path, { readAcceptedSource: id => accepted.get(id) ?? null });
});
afterEach(() => {
  store?.close(); db?.close();
  if (directory) { if (!resolve(directory).startsWith(resolve('work') + sep)) throw Error('test cleanup escaped owned work directory'); rmSync(directory, { recursive: true, force: true }); }
});

it('RSQL215-01 reads an empty registry without creating schema and returns a real missing-Source pending', () => {
  const schema = db.prepare('SELECT * FROM main.sqlite_schema').all(), version = db.prepare('PRAGMA main.schema_version').get();
  expect(store.read('missing')).toBeNull(); expect(ruleSourceRegistryEvidenceFromSqlite(db).read('missing')).toBeNull();
  expect(store.accept('missing')).toEqual({ kind: 'pending', missingAcceptedSourceIds: ['missing'] });
  expect(db.prepare('SELECT * FROM main.sqlite_schema').all()).toEqual(schema); expect(db.prepare('PRAGMA main.schema_version').get()).toEqual(version);
});

it('RSQL215-02 registers exactly one immutable row and normally reads it after close and reopen', () => {
  const value = store.accept(source.sourceId); if (value.kind === 'pending') throw Error('test Source missing');
  expect(count()).toBe(1); expect(value.authorityLimit).toBe('PROJECT_RULE_MODEL_ONLY');
  const row = db.prepare('SELECT rowid,* FROM main.' + table).get(); const schema = db.prepare('PRAGMA main.schema_version').get();
  expect(store.accept(source.sourceId)).toEqual(value); expect(db.prepare('SELECT rowid,* FROM main.' + table).get()).toEqual(row);
  expect(db.prepare('PRAGMA main.schema_version').get()).toEqual(schema);
  store.close(); store = openSqliteRuleSourceRegistryStore(path);
  expect(store.read(source.sourceId)).toEqual(value); expect(store.accept(source.sourceId)).toEqual(value);
  const evidence = ruleSourceRegistryEvidenceFromSqlite(db); expect(evidence.readReference(reference(table, value))).toEqual(value);
  expect(() => evidence.readReference({ ...reference(table, value), snapshotHash: '0'.repeat(64) })).toThrow();
  expect(db.prepare("SELECT name FROM main.sqlite_schema WHERE type='table' ORDER BY name").all()).toEqual([{ name: table }]);
});

it('RSQL215-03 rejects Source replacement and canonical-scope aliases, while an explicit new model revision can register separately', () => {
  const value = store.accept(source.sourceId), rows = db.prepare('SELECT rowid,* FROM main.' + table).all();
  accepted.set(source.sourceId, { ...source, sourceVersion: 'replacement' }); expect(() => store.accept(source.sourceId)).toThrow();
  const alias = { ...source, sourceId: 'alias', sourceVersion: 'another-version' }; accepted.set(alias.sourceId, alias); expect(() => store.accept(alias.sourceId)).toThrow();
  expect(db.prepare('SELECT rowid,* FROM main.' + table).all()).toEqual(rows); expect(store.read(source.sourceId)).toEqual(value);
  const next = { ...source, sourceId: 'model-revision-2', scope: { ...source.scope, ruleModelRevision: '2' } }; accepted.set(next.sourceId, next);
  expect(store.accept(next.sourceId).kind).toBe('registered_project_rule_source_v1'); expect(count()).toBe(2);
});

it.each(['source_hash', 'snapshot_hash', 'source_version', 'rule_model_id', 'rules_revision', 'available_from_day'] as const)(
  'RSQL215-04 rejects corrupt persisted %s mirrors', column => {
    store.accept(source.sourceId); db.prepare('UPDATE main.' + table + ' SET ' + column + '=?').run(column === 'available_from_day' ? 41 : 'corrupt');
    expect(() => store.read(source.sourceId)).toThrow();
  });

it.each(['source_json', 'snapshot_json'] as const)('RSQL215-05 finds a hidden canonical scope through %s instead of admitting an alias', survivingMirror => {
  const value = store.accept(source.sourceId); if (value.kind === 'pending') throw Error('test Source missing');
  const hiddenSource = { ...source, scope: { ruleModelId: 'hidden', ruleModelRevision: 'hidden' } };
  db.prepare('UPDATE main.' + table + " SET rule_model_id='hidden',rule_model_revision='hidden',source_json=?,snapshot_json=?")
    .run(survivingMirror === 'source_json' ? json(source) : json(hiddenSource), survivingMirror === 'snapshot_json' ? json(value) : json({ ...value, source: hiddenSource }));
  const alias = { ...source, sourceId: 'hidden-alias' }; accepted.set(alias.sourceId, alias);
  expect(() => store.accept(alias.sourceId)).toThrow(); expect(count()).toBe(1);
});

it('RSQL215-06 discovers an alias Source ID claimed inside a snapshot and rejects duplicate JSON identity claims', () => {
  const value = store.accept(source.sourceId); if (value.kind === 'pending') throw Error('test Source missing');
  const aliasValue = { ...value, source: { ...source, sourceId: 'claimed-alias' } };
  db.prepare('UPDATE main.' + table + ' SET snapshot_json=?,snapshot_hash=?').run(json(aliasValue), hash(aliasValue));
  expect(() => store.read('claimed-alias')).toThrow();
  const forged = '{"sourceId":"hidden","sourceId":"' + source.sourceId + '"}';
  db.prepare('UPDATE main.' + table + ' SET source_id=?,source_json=?').run('hidden', forged);
  expect(() => store.read(source.sourceId)).toThrow();
});

it('RSQL215-07 rejects forged official authority even when the attacker recomputes the archive hashes', () => {
  const value = store.accept(source.sourceId); if (value.kind === 'pending') throw Error('test Source missing');
  const forgedSource = { ...source, evidenceAuthority: 'VERIFIED_OFFICIAL_NPB_SOURCE' }, forgedValue = { ...value, source: forgedSource };
  db.prepare('UPDATE main.' + table + ' SET evidence_authority=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
    .run(forgedSource.evidenceAuthority, json(forgedSource), hash(forgedSource), json(forgedValue), hash(forgedValue));
  expect(() => store.read(source.sourceId)).toThrow();
});

it('RSQL215-08 rejects arbitrary profile objects, unknown revisions and unsupported authority without creating schema', () => {
  for (const changed of [{ profile: NPB_2026_RULE_PROFILE }, { evidenceAuthority: 'VERIFIED_OFFICIAL_NPB_SOURCE' }, { baseProfile: { ruleProfileId: 'npb-2026', rulesRevision: 'future' } }]) {
    accepted.set(source.sourceId, { ...source, ...changed }); expect(() => store.accept(source.sourceId)).toThrow(); expect(count()).toBe(0);
  }
  expect(db.prepare('SELECT * FROM main.sqlite_schema').all()).toEqual([]);
});

it('RSQL215-09 rolls back trigger writes outside the one owned insert and permits an exact retry', () => {
  store.accept(source.sourceId);
  const next = { ...source, sourceId: 'revision-2', scope: { ...source.scope, ruleModelRevision: '2' } }; accepted.set(next.sourceId, next);
  db.exec('CREATE TABLE sentinel(n INTEGER); INSERT INTO sentinel VALUES(7)');
  db.exec('CREATE TRIGGER mutate_registry_dependency AFTER INSERT ON ' + table + ' BEGIN UPDATE sentinel SET n=8; END');
  const before = db.prepare('SELECT rowid,* FROM main.' + table).all();
  expect(() => store.accept(next.sourceId)).toThrow(); expect(db.prepare('SELECT * FROM sentinel').all()).toEqual([{ n: 7 }]);
  expect(db.prepare('SELECT rowid,* FROM main.' + table).all()).toEqual(before);
  db.exec('DROP TRIGGER mutate_registry_dependency'); expect(store.accept(next.sourceId).kind).toBe('registered_project_rule_source_v1'); expect(count()).toBe(2);
});

it('RSQL215-10 rejects TEMP and attached authority even when the main registry is absent, preserving an enclosing read transaction', () => {
  db.exec('CREATE TEMP TABLE shadow(n INTEGER)'); expect(() => ruleSourceRegistryEvidenceFromSqlite(db).read('missing')).toThrow(); db.exec('DROP TABLE temp.shadow');
  db.exec("ATTACH DATABASE ':memory:' AS foreign_rules"); expect(() => ruleSourceRegistryEvidenceFromSqlite(db).read('missing')).toThrow(); db.exec('DETACH DATABASE foreign_rules');
  db.exec('BEGIN'); expect(ruleSourceRegistryEvidenceFromSqlite(db).read('missing')).toBeNull(); expect(db.isTransaction).toBe(true); db.exec('ROLLBACK');
  expect(() => ruleSourceRegistryEvidenceFromSqlite({ prepare: db.prepare.bind(db) } as unknown as InstanceType<typeof DatabaseSync>).read('missing')).toThrow();
});

it('RSQL215-11 rejects a malformed owner schema and does not repair it', () => {
  db.exec('CREATE TABLE ' + table + '(source_id TEXT PRIMARY KEY)'); const before = db.prepare('SELECT * FROM main.sqlite_schema').all();
  expect(() => store.read('missing')).toThrow(); expect(() => store.accept(source.sourceId)).toThrow(); expect(db.prepare('SELECT * FROM main.sqlite_schema').all()).toEqual(before);
});

it('RSQL215-12 rederives the production profile on read instead of trusting its stored hash', () => {
  store.accept(source.sourceId); const original = NPB_2026_RULE_PROFILE.tagUp.legalReleaseBasis;
  try {
    Object.assign(NPB_2026_RULE_PROFILE.tagUp, { legalReleaseBasis: 'secure_catch' }); expect(() => store.read(source.sourceId)).toThrow();
  } finally { Object.assign(NPB_2026_RULE_PROFILE.tagUp, { legalReleaseBasis: original }); }
  expect(store.read(source.sourceId)?.source).toEqual(source);
});

it('RSQL215-13 rejects a valid archive replacement made by an authority callback after the first immutable read', () => {
  store.accept(source.sourceId); store.close();
  const replacement = { ...source, sourceVersion: 'callback-replacement' }, replacementValue = deriveProjectFairPoleRuleRegistrationV1(replacement, source.sourceId);
  store = openSqliteRuleSourceRegistryStore(path, { readAcceptedSource() {
    db.prepare('UPDATE main.' + table + ' SET source_version=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run(replacement.sourceVersion, json(replacement), hash(replacement), json(replacementValue), hash(replacementValue));
    return null;
  } });
  expect(() => store.accept(source.sourceId)).toThrow(); expect(count()).toBe(1);
});

import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedContactResponseEvidenceFromSqlite } from './SqliteBattedContactResponseStore';
import { nativeSettledFoulPhysicalFixture } from './NativeSettledFoulPhysicalFixtures.test-support';
import { battedVenueLegalPolicyEvidenceFromSqlite, openSqliteBattedVenueLegalPolicyStore,
  type AcceptedBattedVenueLegalPolicy, type SqliteBattedVenueLegalPolicyStore } from './SqliteBattedVenueLegalPolicyStore';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let directory: string, x: ReturnType<typeof nativeSettledFoulPhysicalFixture>;
let source: AcceptedBattedVenueLegalPolicy, policies: SqliteBattedVenueLegalPolicyStore;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'venue-policy-boundary-'));
  x = nativeSettledFoulPhysicalFixture(join(directory, 'world.sqlite'));
}, 60_000);
beforeEach(() => {
  if (x.f.db.prepare("SELECT 1 FROM main.sqlite_master WHERE name='batted_venue_legal_policies'").get()) {
    x.f.db.exec('DELETE FROM main.batted_venue_legal_policies');
  }
  const world = x.first.response.touch.worldContact;
  source = { sourceId: 'boundary-policy', sourceVersion: 'explicit-test-v1', version: 'batted_venue_legal_policy_v1',
    gameId: world.model.gameId, careerId: world.model.careerId, fixtureEventId: world.model.fixtureEventId,
    venueId: world.model.venueId, availableAtDay: world.model.availableAtDay,
    baseFieldSourceId: x.first.source.sourceId, worldModelSourceId: world.model.sourceId,
    responseModelSourceId: x.first.response.model.sourceId, fieldGeometrySourceId: x.first.geometry.source.sourceId,
    baseGeometrySourceId: x.first.geometry.baseGeometry.source.sourceId,
    rulePolicy: { version: 'untouched_settled_foul_dead_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id,
      rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision } };
  policies = openSqliteBattedVenueLegalPolicyStore(x.f.path, { readAcceptedPolicy: id => id === source.sourceId ? source : null });
});
afterEach(() => policies?.close());
afterAll(() => { x?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

it('rolls back unrelated current Match writes caused by the policy insert trigger', () => {
  const before = x.f.db.prepare('SELECT * FROM main.matches WHERE match_id=?').get(source.gameId)!;
  const originalInputs = x.inputArchiveBytes();
  x.f.db.exec("CREATE TRIGGER mutate_current_match AFTER INSERT ON batted_venue_legal_policies BEGIN UPDATE matches SET durable_revision=durable_revision+1 WHERE match_id='game-1'; END");
  try {
    expect(() => policies.accept(source.sourceId)).toThrow();
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_venue_legal_policies').get()!.n).toBe(0);
    expect(x.f.db.prepare('SELECT * FROM main.matches WHERE match_id=?').get(source.gameId)).toEqual(before);
    expect(x.inputArchiveBytes()).toBe(originalInputs);
  } finally {
    x.f.db.exec('DROP TRIGGER mutate_current_match');
    // Keep the independently failing pre-fix case from contaminating later cases.
    x.f.db.prepare('UPDATE main.matches SET durable_revision=?,state_json=?,activation_json=? WHERE match_id=?')
      .run(before.durable_revision!, before.state_json!, before.activation_json!, source.gameId);
  }
});

it('rejects an unaccepted canonical policy supplied through a TEMP table shadow', () => {
  const value = policies.accept(source.sourceId), fakeSource = { ...source, sourceId: 'unaccepted-temp-policy' };
  const fake = { ...value, source: fakeSource };
  x.f.db.exec('CREATE TEMP TABLE batted_venue_legal_policies AS SELECT * FROM main.batted_venue_legal_policies');
  x.f.db.prepare(`UPDATE temp.batted_venue_legal_policies SET source_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?`)
    .run(fakeSource.sourceId, json(fakeSource), hash(fakeSource), json(fake), hash(fake));
  try {
    expect(x.f.db.prepare('SELECT count(*) AS n FROM main.batted_venue_legal_policies WHERE source_id=?').get(fakeSource.sourceId)!.n).toBe(0);
    expect(() => battedVenueLegalPolicyEvidenceFromSqlite(x.f.db).read(fakeSource.sourceId)).toThrow();
    expect(x.f.db.isTransaction).toBe(false);
  } finally { x.f.db.exec('DROP TABLE temp.batted_venue_legal_policies'); }
  expect(battedVenueLegalPolicyEvidenceFromSqlite(x.f.db).read(source.sourceId)).toEqual(value);
});

it('rejects a pre-existing TEMP shadow of the original physical field owner', () => {
  const value = policies.accept(source.sourceId);
  x.f.db.exec('CREATE TEMP TABLE batted_world_field_actions AS SELECT * FROM main.batted_world_field_actions');
  try {
    expect(() => battedVenueLegalPolicyEvidenceFromSqlite(x.f.db).read(source.sourceId)).toThrow();
    expect(x.f.db.isTransaction).toBe(false);
  } finally { x.f.db.exec('DROP TABLE temp.batted_world_field_actions'); }
  expect(battedVenueLegalPolicyEvidenceFromSqlite(x.f.db).read(source.sourceId)).toEqual(value);
});

it('preserves the caller transaction, query-only setting and connection authorizer', () => {
  const value = policies.accept(source.sourceId);
  x.f.db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
  x.f.db.exec('BEGIN; PRAGMA query_only=ON');
  try {
    expect(battedVenueLegalPolicyEvidenceFromSqlite(x.f.db).read(source.sourceId)).toEqual(value);
    expect(x.f.db.isTransaction).toBe(true);
    expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(() => x.f.db.prepare('DELETE FROM main.batted_venue_legal_policies')).toThrow(/authorized/i);
  } finally {
    x.f.db.exec('ROLLBACK; PRAGMA query_only=OFF');
    x.f.db.setAuthorizer(null);
  }
});

it('keeps the original WAL snapshot and rejects peer policy corruption on the next read', () => {
  const value = policies.accept(source.sourceId), peer = new DatabaseSync(x.f.path);
  const original = peer.prepare('SELECT snapshot_hash FROM main.batted_venue_legal_policies WHERE source_id=?').get(source.sourceId)!;
  try {
    x.f.db.exec('BEGIN');
    expect(battedVenueLegalPolicyEvidenceFromSqlite(x.f.db).read(source.sourceId)).toEqual(value);
    peer.prepare("UPDATE main.batted_venue_legal_policies SET snapshot_hash='corrupt' WHERE source_id=?").run(source.sourceId);
    expect(battedVenueLegalPolicyEvidenceFromSqlite(x.f.db).read(source.sourceId)).toEqual(value);
    x.f.db.exec('COMMIT');
    expect(() => battedVenueLegalPolicyEvidenceFromSqlite(x.f.db).read(source.sourceId)).toThrow();
    expect(x.f.db.isTransaction).toBe(false);
  } finally {
    if (x.f.db.isTransaction) x.f.db.exec('ROLLBACK');
    peer.prepare('UPDATE main.batted_venue_legal_policies SET snapshot_hash=? WHERE source_id=?').run(original.snapshot_hash!, source.sourceId);
    peer.close();
  }
});


it.each(['temp', 'attached'] as const)('rejects a missing main response-model authority replaced through %s storage', replacement => {
  const value = policies.accept(source.sourceId), before = x.inputArchiveBytes();
  const schema = x.f.db.prepare("SELECT sql FROM main.sqlite_master WHERE type='table' AND name='batted_contact_response_models'").get()!.sql;
  if (typeof schema !== 'string') throw new Error('original response-model schema is unavailable');
  if (replacement === 'attached') x.f.db.prepare('ATTACH DATABASE ? AS replacement').run(join(directory, 'replacement.sqlite'));
  const replacementSchema = replacement === 'temp' ? 'temp' : 'replacement';
  let mainDropped = false;
  try {
    x.f.db.exec(`CREATE TABLE ${replacementSchema}.batted_contact_response_models AS SELECT * FROM main.batted_contact_response_models`);
    x.f.db.exec('DROP TABLE main.batted_contact_response_models'); mainDropped = true;
    expect(x.f.db.prepare("SELECT name FROM main.sqlite_master WHERE name='batted_contact_response_models'").get()).toBeUndefined();
    // This precondition distinguishes the newly guarded boundary from an already
    // rejecting legacy path: its original unqualified reader accepts the copy.
    expect(battedContactResponseEvidenceFromSqlite(x.f.db).read(x.first.response.source.sourceId)).toEqual(x.first.response);
    expect(() => battedVenueLegalPolicyEvidenceFromSqlite(x.f.db).read(source.sourceId)).toThrow();
    expect(x.f.db.isTransaction).toBe(false);
  } finally {
    if (mainDropped) {
      x.f.db.exec(schema);
      x.f.db.exec(`INSERT INTO main.batted_contact_response_models SELECT * FROM ${replacementSchema}.batted_contact_response_models`);
    }
    x.f.db.exec(`DROP TABLE IF EXISTS ${replacementSchema}.batted_contact_response_models`);
    if (replacement === 'attached') x.f.db.exec('DETACH DATABASE replacement');
  }
  expect(x.inputArchiveBytes()).toBe(before);
  expect(battedVenueLegalPolicyEvidenceFromSqlite(x.f.db).read(source.sourceId)).toEqual(value);
});

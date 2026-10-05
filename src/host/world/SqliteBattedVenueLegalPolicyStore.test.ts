import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { deriveBallWorldFieldTerritory } from '../../core/rules/BallWorldFieldTerritory';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { nativeSettledFoulPhysicalFixture } from './NativeSettledFoulPhysicalFixtures.test-support';
import { openSqliteBattedVenueLegalPolicyStore, type AcceptedBattedVenueLegalPolicy,
  type SqliteBattedVenueLegalPolicyStore } from './SqliteBattedVenueLegalPolicyStore';

let directory: string, x: ReturnType<typeof nativeSettledFoulPhysicalFixture>;
let source: AcceptedBattedVenueLegalPolicy, policies: SqliteBattedVenueLegalPolicyStore;
const accepted = new Map<string, AcceptedBattedVenueLegalPolicy>();
const tableExists = () => !!x.f.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='batted_venue_legal_policies'").get();
const policyRows = () => tableExists() ? Number(x.f.db.prepare('SELECT count(*) AS n FROM batted_venue_legal_policies').get()!.n) : 0;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'venue-legal-policy-'));
  x = nativeSettledFoulPhysicalFixture(join(directory, 'world.sqlite'));
  expect(deriveBallWorldFieldTerritory(x.physical.field)).toMatchObject({ kind: 'resolved', territory: 'foul', basis: 'settling' });
}, 60_000);
beforeEach(() => {
  if (tableExists()) x.f.db.exec('DELETE FROM batted_venue_legal_policies');
  const world = x.first.response.touch.worldContact;
  source = { sourceId: 'venue-legal-policy', sourceVersion: 'explicit-test-v1', version: 'batted_venue_legal_policy_v1',
    gameId: world.model.gameId, careerId: world.model.careerId, fixtureEventId: world.model.fixtureEventId,
    venueId: world.model.venueId, availableAtDay: world.model.availableAtDay,
    baseFieldSourceId: x.first.source.sourceId, worldModelSourceId: world.model.sourceId,
    responseModelSourceId: x.first.response.model.sourceId, fieldGeometrySourceId: x.first.geometry.source.sourceId,
    baseGeometrySourceId: x.first.geometry.baseGeometry.source.sourceId,
    rulePolicy: { version: 'untouched_settled_foul_dead_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id,
      rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision } };
  accepted.clear(); accepted.set(source.sourceId, source);
  policies = openSqliteBattedVenueLegalPolicyStore(x.f.path, { readAcceptedPolicy: id => accepted.get(id) ?? null });
});
afterEach(() => policies?.close());
afterAll(() => { x?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

it('pins the accepted original fixture/model/geometry/profile and anchor without applying any rule result', () => {
  const heads = JSON.stringify(x.f.db.prepare('SELECT * FROM batted_world_field_heads').all());
  const actions = JSON.stringify(x.f.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all());
  const causalBytes = () => JSON.stringify(['actual_live_play_admissions', 'actual_first_base_play_ends', 'actual_live_play_fences']
    .map(table => { const schema = x.f.db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name=?").all(table);
      return { table, schema, rows: schema.length ? x.f.db.prepare(`SELECT * FROM ${table}`).all() : null }; }));
  const causalBefore = causalBytes();
  const inputs = x.inputArchiveBytes(), official = JSON.stringify(x.f.official.getMatch('game-1'));
  const value = policies.accept(source.sourceId), world = x.first.response.touch.worldContact;
  expect(value.source).toEqual(source);
  expect(value).toMatchObject({ physicalPitchSourceId: world.flight.source.physicalPitchSourceId,
    playId: world.flight.physicalPitch.frame.match.playId, fixtureRevision: x.first.geometry.baseGeometry.fixture.fixture_revision,
    ruleProfileHash: hash(NPB_2026_RULE_PROFILE), anchor: { owner: 'batted_world_field_actions',
      sourceId: x.first.source.sourceId, sourceVersion: x.first.source.sourceVersion, revision: x.first.revision,
      sourceHash: hash(x.first.source), snapshotHash: hash(x.first) } });
  expect(value.dependencies).toEqual({ physicalPitchHash: hash(world.flight.physicalPitch),
    fixtureHash: hash(x.first.geometry.baseGeometry.fixture), worldModelHash: hash(world.model),
    responseModelHash: hash(x.first.response.model), fieldGeometryHash: hash(x.first.geometry),
    baseGeometryHash: hash(x.first.geometry.baseGeometry) });
  expect(Object.isFrozen(value)).toBe(true);
  expect(Object.isFrozen(value.source.rulePolicy)).toBe(true);
  expect(policyRows()).toBe(1);
  expect(x.inputArchiveBytes()).toBe(inputs);
  expect(JSON.stringify(x.f.db.prepare('SELECT * FROM batted_world_field_heads').all())).toBe(heads);
  expect(JSON.stringify(x.f.db.prepare('SELECT * FROM batted_world_field_actions ORDER BY revision').all())).toBe(actions);
  expect(causalBytes()).toBe(causalBefore);
  expect(JSON.stringify(x.f.official.getMatch('game-1'))).toBe(official);
  for (const key of ['ruleResult', 'deadBall', 'countAfter', 'out', 'playEnd', 'officialClosure']) expect(value).not.toHaveProperty(key);
});

it('returns no invented policy for an unknown Source and requires explicit acceptance authority', () => {
  expect(policies.read('missing')).toBeNull();
  expect(() => policies.accept('missing')).toThrow();
  expect(policyRows()).toBe(0);
});

it('reopens the durable policy without callbacks and retains exact immutable retries', () => {
  const value = policies.accept(source.sourceId), bytes = JSON.stringify(value);
  policies.close(); accepted.clear();
  policies = openSqliteBattedVenueLegalPolicyStore(x.f.path);
  expect(JSON.stringify(policies.read(source.sourceId))).toBe(bytes);
  expect(JSON.stringify(policies.accept(source.sourceId))).toBe(bytes);
  expect(policyRows()).toBe(1);
});

it('rejects changed same-Source content and a second policy identity for the same original pitch/version', () => {
  const original = policies.accept(source.sourceId);
  accepted.set(source.sourceId, { ...source, sourceVersion: 'changed' });
  expect(() => policies.accept(source.sourceId)).toThrow();
  accepted.set(source.sourceId, source);
  const alias = { ...source, sourceId: 'policy-alias' }; accepted.set(alias.sourceId, alias);
  expect(() => policies.accept(alias.sourceId)).toThrow();
  const laterAnchor = { ...source, sourceId: 'later-anchor-alias', sourceVersion: 'another-source-version',
    baseFieldSourceId: x.last.source.sourceId };
  expect(laterAnchor.baseFieldSourceId).not.toBe(source.baseFieldSourceId);
  accepted.set(laterAnchor.sourceId, laterAnchor);
  expect(() => policies.accept(laterAnchor.sourceId)).toThrow();
  expect(policies.read(source.sourceId)).toEqual(original);
  expect(policyRows()).toBe(1);
});

it.each(['gameId', 'careerId', 'fixtureEventId', 'venueId', 'baseFieldSourceId', 'worldModelSourceId',
  'responseModelSourceId', 'fieldGeometrySourceId', 'baseGeometrySourceId'] as const)(
  'rejects a foreign %s binding before saving a policy', (key) => {
    accepted.set(source.sourceId, { ...source, [key]: 'foreign' });
    expect(() => policies.accept(source.sourceId)).toThrow();
    expect(policyRows()).toBe(0);
  });

it('rejects a policy unavailable on the original game day', () => {
  const gameDay = x.first.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.gameDay;
  accepted.set(source.sourceId, { ...source, availableAtDay: gameDay + 1 });
  expect(() => policies.accept(source.sourceId)).toThrow();
  expect(policyRows()).toBe(0);
});

it.each(['version', 'ruleProfileId', 'rulesRevision'] as const)('rejects an unsupported rule-policy %s', key => {
  accepted.set(source.sourceId, { ...source, rulePolicy: { ...source.rulePolicy, [key]: 'foreign' } } as never);
  expect(() => policies.accept(source.sourceId)).toThrow();
  expect(policyRows()).toBe(0);
});

it.each(['fairResult', 'deadBall', 'out', 'buntAttempt', 'count', 'ruleProfile', 'dependencyHashes'])(
  'rejects injected %s instead of treating it as policy authority', key => {
    accepted.set(source.sourceId, { ...source, [key]: true } as never);
    expect(() => policies.accept(source.sourceId)).toThrow();
    expect(policyRows()).toBe(0);
  });

it.each(['outer_version', 'source_id', 'fractional_day', 'negative_day', 'nested_result', 'getter'] as const)(
  'rejects invalid Source shape %s before any policy write or getter evaluation', kind => {
    let reads = 0;
    const changed = kind === 'outer_version' ? { ...source, version: 'foreign' }
      : kind === 'source_id' ? { ...source, sourceId: 'foreign-source' }
        : kind === 'fractional_day' ? { ...source, availableAtDay: 0.5 }
          : kind === 'negative_day' ? { ...source, availableAtDay: -1 }
            : kind === 'nested_result' ? { ...source, rulePolicy: { ...source.rulePolicy, deadBall: true } }
              : Object.defineProperty({ ...source }, 'rulePolicy', { enumerable: true,
                get: () => { reads += 1; return source.rulePolicy; } });
    accepted.set(source.sourceId, changed as never);
    expect(() => policies.accept(source.sourceId)).toThrow();
    expect(reads).toBe(0);
    expect(policyRows()).toBe(0);
  });

it.each(['source_hash', 'snapshot_hash', 'venue_id', 'physical_pitch_source_id'])(
  'rejects a corrupt persisted %s mirror', column => {
    policies.accept(source.sourceId);
    x.f.db.prepare(`UPDATE batted_venue_legal_policies SET ${column}=? WHERE source_id=?`).run('corrupt', source.sourceId);
    expect(() => policies.read(source.sourceId)).toThrow();
  });

it('discovers the original pitch/version claim even when its index mirrors are hidden', () => {
  policies.accept(source.sourceId);
  x.f.db.exec("UPDATE batted_venue_legal_policies SET physical_pitch_source_id='hidden',game_id='hidden'");
  const alias = { ...source, sourceId: 'hidden-policy-alias' }; accepted.set(alias.sourceId, alias);
  expect(() => policies.accept(alias.sourceId)).toThrow();
  expect(policyRows()).toBe(1);
});

it('rejects a changed original anchor dependency instead of trusting the policy snapshot', () => {
  policies.accept(source.sourceId);
  const row = x.f.db.prepare('SELECT source_hash FROM batted_world_field_geometries WHERE source_id=?')
    .get(source.fieldGeometrySourceId)!;
  try {
    x.f.db.prepare('UPDATE batted_world_field_geometries SET source_hash=? WHERE source_id=?').run('corrupt', source.fieldGeometrySourceId);
    expect(() => policies.read(source.sourceId)).toThrow();
  } finally {
    x.f.db.prepare('UPDATE batted_world_field_geometries SET source_hash=? WHERE source_id=?').run(row.source_hash!, source.fieldGeometrySourceId);
  }
});

it('rolls back a late policy insert trigger that changes original geometry and permits an exact retry', () => {
  // Acceptance must install its schema before this fixture-owned trigger is created.
  expect(policies.read('missing')).toBeNull();
  expect(tableExists()).toBe(true);
  const before = x.inputArchiveBytes();
  x.f.db.exec("CREATE TRIGGER corrupt_venue_policy AFTER INSERT ON batted_venue_legal_policies BEGIN UPDATE batted_world_field_geometries SET source_hash='corrupt'; END");
  try {
    expect(() => policies.accept(source.sourceId)).toThrow();
    expect(policyRows()).toBe(0);
    expect(x.inputArchiveBytes()).toBe(before);
  } finally { x.f.db.exec('DROP TRIGGER corrupt_venue_policy'); }
  expect(policies.accept(source.sourceId).source).toEqual(source);
  expect(policyRows()).toBe(1);
});

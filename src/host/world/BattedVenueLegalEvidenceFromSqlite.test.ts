import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualObservationPhysicalPrefixEvidence } from './ActualObservationPhysicalPrefixHash';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { nativeSettledFoulInputArchiveBytes, nativeSettledFoulPhysicalFixture } from './NativeSettledFoulPhysicalFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { openSqliteBattedVenueLegalPolicyStore, type AcceptedBattedVenueLegalPolicy } from './SqliteBattedVenueLegalPolicyStore';
import { battedVenueLegalEvidenceFromSqlite, type BattedVenueLegalObservation } from './BattedVenueLegalEvidenceFromSqlite';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let originalsClosed = false;
let directory: string, x: ReturnType<typeof nativeSettledFoulPhysicalFixture>;
let policies: ReturnType<typeof openSqliteBattedVenueLegalPolicyStore>, policySource: AcceptedBattedVenueLegalPolicy;
const policySources = new Map<string, AcceptedBattedVenueLegalPolicy>();
const request = (): BattedVenueLegalObservation => ({ version: 'batted_venue_legal_observation_v1',
  policySourceId: policySource.sourceId, baseFieldSourceId: x.last.source.sourceId, executionSourceId: null });
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'venue-legal-observer-'));
  x = nativeSettledFoulPhysicalFixture(join(directory, 'world.sqlite'));
  const world = x.first.response.touch.worldContact;
  policySource = { sourceId: 'observation-policy', sourceVersion: 'explicit-test-v1', version: 'batted_venue_legal_policy_v1',
    gameId: world.model.gameId, careerId: world.model.careerId, fixtureEventId: world.model.fixtureEventId,
    venueId: world.model.venueId, availableAtDay: world.model.availableAtDay,
    baseFieldSourceId: x.first.source.sourceId, worldModelSourceId: world.model.sourceId,
    responseModelSourceId: x.first.response.model.sourceId, fieldGeometrySourceId: x.first.geometry.source.sourceId,
    baseGeometrySourceId: x.first.geometry.baseGeometry.source.sourceId,
    rulePolicy: { version: 'untouched_settled_foul_dead_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id,
      rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision } };
  policies = x.f.track(openSqliteBattedVenueLegalPolicyStore(x.f.path, { readAcceptedPolicy: id => policySources.get(id) ?? null }));
}, 60_000);
beforeEach(() => {
  x.f.db.exec('DELETE FROM main.batted_venue_legal_policies');
  policySources.clear(); policySources.set(policySource.sourceId, policySource);
  policies.accept(policySource.sourceId);
});
afterAll(() => { if (!originalsClosed) x?.f.close(); if (directory) rmSync(directory, { recursive: true, force: true }); });

it('observes the later owned foul cut from an earlier exact policy anchor without writes or count inference', () => {
  const changes = x.f.db.prepare('SELECT total_changes() AS n').get()!.n;
  const schema = x.f.db.prepare('SELECT name,type,sql FROM main.sqlite_master ORDER BY name').all();
  const heads = x.f.db.prepare('SELECT * FROM main.batted_world_field_heads').all();
  const rows = x.f.db.prepare('SELECT * FROM main.batted_world_field_actions ORDER BY revision').all();
  const inputs = x.inputArchiveBytes(), official = x.f.official.getMatch('game-1');
  const policy = policies.read(policySource.sourceId)!;
  const value = battedVenueLegalEvidenceFromSqlite(x.f.db).read(request());
  expect(value).toMatchObject({ version: 'batted_venue_legal_evidence_v1', gameId: policySource.gameId,
    physicalPitchSourceId: policy.physicalPitchSourceId, fixtureEventId: policySource.fixtureEventId,
    venueId: policySource.venueId, ruleProfileId: policySource.rulePolicy.ruleProfileId,
    policyReference: { owner: 'batted_venue_legal_policies', sourceId: policySource.sourceId,
      sourceVersion: policySource.sourceVersion, sourceHash: hash(policySource), snapshotHash: hash(policy), ruleProfileHash: policy.ruleProfileHash },
    physicalCut: { baseFieldSourceId: x.last.source.sourceId, baseFieldRevision: x.last.revision,
      executionSourceId: null, executionRevision: null }, originalCount: { physicalPitchSourceId: policy.physicalPitchSourceId,
      count: { balls: 0, strikes: 0 } }, evidence: { interpretation: { kind: 'dead_ball', reason: 'untouched_settled_foul',
        moment: x.physical.field.evidence.horizon }, countEffect: { kind: 'unresolved', reason: 'bunt_intent_pending' } } });
  expect(value.evidence.physicalContacts).toEqual(x.physical.field.evidence.contacts);
  expect(value.physicalPrefixReference).toEqual(actualObservationPhysicalPrefixEvidence(x.prefix));
  expect(Object.isFrozen(value)).toBe(true);
  expect(Object.isFrozen(value.originalCount.count)).toBe(true);
  expect(Object.isFrozen(value.evidence.physicalContacts)).toBe(true);
  expect(value.physicalPrefixReferences).toEqual(x.prefix.fields.map(field => ({ owner: 'batted_world_field_actions',
    sourceId: field.source.sourceId, sourceVersion: field.source.sourceVersion, revision: field.revision,
    sourceHash: hash(field.source), snapshotHash: hash(field) })));
  for (const [kind, expected] of [['firstGround', x.first], ['decisiveStop', x.last]] as const) {
    expect(value.contactOrigins?.[kind]).toEqual([{ reference: { owner: 'batted_world_field_actions', sourceId: expected.source.sourceId,
      sourceVersion: expected.source.sourceVersion, revision: expected.revision, sourceHash: hash(expected.source), snapshotHash: hash(expected) },
      location: 'field.motion.world.contacts', rawContactIndex: 0,
      kind: kind === 'firstGround' ? 'ground' : 'rolling_stop', moment: expected.field.motion.world.moment }]);
  }
  expect(x.f.db.isTransaction).toBe(false);
  expect(x.f.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
  expect(x.f.db.prepare('SELECT name,type,sql FROM main.sqlite_master ORDER BY name').all()).toEqual(schema);
  expect(x.f.db.prepare('SELECT * FROM main.batted_world_field_heads').all()).toEqual(heads);
  expect(x.f.db.prepare('SELECT * FROM main.batted_world_field_actions ORDER BY revision').all()).toEqual(rows);
  expect(x.inputArchiveBytes()).toBe(inputs);
  expect(x.f.official.getMatch('game-1')).toEqual(official);
  for (const key of ['playEnd', 'officialClosure', 'out', 'countAfter', 'onFieldCall']) expect(value).not.toHaveProperty(key);
}, 60_000);

it('retains an incomplete grounded prefix as unresolved without inventing a stop', () => {
  const value = battedVenueLegalEvidenceFromSqlite(x.f.db).read({ ...request(), baseFieldSourceId: x.first.source.sourceId });
  const original = battedWorldFieldPhysicalPrefix({ baseField: x.first, fields: [x.first], executions: [] });
  expect(value.evidence.interpretation.kind).toBe('unresolved');
  expect(value.evidence.physicalContacts).toEqual(original.field.evidence.contacts);
  expect(value.contactOrigins).toBeNull();
});

it('rejects an accepted policy anchor that lies after the requested cut', () => {
  x.f.db.exec('DELETE FROM main.batted_venue_legal_policies');
  const later = { ...policySource, sourceId: 'later-anchor-policy', baseFieldSourceId: x.last.source.sourceId };
  policySources.set(later.sourceId, later); policies.accept(later.sourceId);
  expect(() => battedVenueLegalEvidenceFromSqlite(x.f.db).read({ ...request(), policySourceId: later.sourceId,
    baseFieldSourceId: x.first.source.sourceId })).toThrow();
});

it('accepts explicit null against absent execution ownership but rejects non-null and partial ownership', () => {
  const reader = battedVenueLegalEvidenceFromSqlite(x.f.db), before = x.f.db.prepare('SELECT name FROM main.sqlite_master ORDER BY name').all();
  expect(reader.read(request()).physicalCut.executionSourceId).toBeNull();
  expect(x.f.db.prepare('SELECT name FROM main.sqlite_master ORDER BY name').all()).toEqual(before);
  expect(() => reader.read({ ...request(), executionSourceId: 'missing-execution' })).toThrow();
  x.f.db.exec('CREATE TABLE batted_world_field_execution_heads(physical_pitch_source_id TEXT PRIMARY KEY,base_field_source_id TEXT,source_id TEXT,revision INTEGER)');
  try { expect(() => reader.read(request())).toThrow(); }
  finally { x.f.db.exec('DROP TABLE batted_world_field_execution_heads'); }
});

it.each(['policySourceId', 'baseFieldSourceId'] as const)('rejects a foreign observation %s', key => {
  expect(() => battedVenueLegalEvidenceFromSqlite(x.f.db).read({ ...request(), [key]: 'foreign' })).toThrow();
});

it.each(['fairResult', 'deadBall', 'out', 'count', 'buntAttempt', 'physicalPrefix', 'ruleProfile'])(
  'rejects injected observation %s', key => {
    expect(() => battedVenueLegalEvidenceFromSqlite(x.f.db).read({ ...request(), [key]: true } as never)).toThrow();
  });

it('requires an explicit execution cut and rejects getters without reading them', () => {
  const reader = battedVenueLegalEvidenceFromSqlite(x.f.db), original = request();
  expect(() => reader.read({ ...original, executionSourceId: undefined } as never)).toThrow();
  let calls = 0;
  const query = Object.defineProperty({ ...original }, 'policySourceId', { enumerable: true,
    get: () => { calls += 1; return original.policySourceId; } });
  expect(() => reader.read(query)).toThrow(); expect(calls).toBe(0);
});

it('retains owner identity, skips observation contact duplicates and keeps a null historical execution cut bounded', () => {
  const source: AcceptedBattedWorldFieldExecution = { sourceId: x.last.source.sourceId, sourceVersion: 'explicit-observation-v1',
    baseFieldSourceId: x.last.source.sourceId, previousExecutionSourceId: null, action: { kind: 'whole_play_history' } };
  const executions = openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields,
    { readAcceptedExecution: id => id === source.sourceId ? source : null });
  try {
    const adopted = executions.accept(source.sourceId), reader = battedVenueLegalEvidenceFromSqlite(x.f.db);
    const historic = reader.read(request());
    const value = reader.read({ ...request(), executionSourceId: source.sourceId });
    expect(value.physicalPrefixReferences.filter(reference => reference.sourceId === source.sourceId).map(reference => reference.owner))
      .toEqual(['batted_world_field_actions', 'batted_world_field_executions']);
    expect(value.physicalCut.executionRevision).toBe(adopted.revision);
    expect(value.contactOrigins).toEqual(historic.contactOrigins);
    const row = x.f.db.prepare('SELECT source_json FROM main.batted_world_field_executions WHERE source_id=?').get(source.sourceId)!;
    try {
      x.f.db.prepare("UPDATE main.batted_world_field_executions SET source_json='opaque future payload' WHERE source_id=?").run(source.sourceId);
      expect(reader.read(request())).toEqual(historic);
      expect(() => reader.read({ ...request(), executionSourceId: source.sourceId })).toThrow();
      x.f.db.prepare('UPDATE main.batted_world_field_executions SET revision=1.5 WHERE source_id=?').run(source.sourceId);
      expect(() => reader.read(request())).toThrow();
    } finally {
      x.f.db.prepare('UPDATE main.batted_world_field_executions SET source_json=?,revision=? WHERE source_id=?').run(row.source_json!, adopted.revision, source.sourceId);
    }
  } finally {
    executions.close();
    x.f.db.exec('DROP TABLE main.batted_world_field_execution_heads; DROP TABLE main.batted_world_field_executions');
  }
}, 60_000);

it('uses the caller read snapshot without changing its authorizer or query-only state', () => {
  const expected = battedVenueLegalEvidenceFromSqlite(x.f.db).read(request());
  x.f.db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
  x.f.db.exec('BEGIN; PRAGMA query_only=ON');
  try {
    expect(battedVenueLegalEvidenceFromSqlite(x.f.db).read(request())).toEqual(expected);
    expect(x.f.db.isTransaction).toBe(true);
    expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(() => x.f.db.prepare('DELETE FROM main.batted_venue_legal_policies')).toThrow(/authorized/i);
  } finally { x.f.db.exec('ROLLBACK; PRAGMA query_only=OFF'); x.f.db.setAuthorizer(null); }
});

it('rejects a selected physical payload mutation beyond the unchanged earlier policy anchor', () => {
  const row = x.f.db.prepare('SELECT source_json FROM main.batted_world_field_actions WHERE source_id=?').get(x.last.source.sourceId)!;
  x.f.db.prepare("UPDATE main.batted_world_field_actions SET source_json='corrupt selected payload' WHERE source_id=?").run(x.last.source.sourceId);
  try { expect(() => battedVenueLegalEvidenceFromSqlite(x.f.db).read(request())).toThrow(); }
  finally { x.f.db.prepare('UPDATE main.batted_world_field_actions SET source_json=? WHERE source_id=?').run(row.source_json!, x.last.source.sourceId); }
});

it('rejects a pre-existing TEMP replacement of a physical dependency', () => {
  x.f.db.exec('CREATE TEMP TABLE batted_world_field_actions AS SELECT * FROM main.batted_world_field_actions');
  try { expect(() => battedVenueLegalEvidenceFromSqlite(x.f.db).read(request())).toThrow(); }
  finally { x.f.db.exec('DROP TABLE temp.batted_world_field_actions'); }
});

it('requires a real SQLite connection instead of caller-supplied dependency readers', () => {
  let calls = 0;
  const fake = { prepare() { calls += 1; throw new Error('fake reader must not run'); } };
  expect(() => battedVenueLegalEvidenceFromSqlite(fake as never).read(request())).toThrow();
  expect(calls).toBe(0);
});

it('reobserves identical evidence after every original handle closes and a fresh readonly file connection opens', () => {
  const value = battedVenueLegalEvidenceFromSqlite(x.f.db).read(request());
  const expected = JSON.stringify(value), query = request(), path = x.f.path;
  const before = x.inputArchiveBytes();
  x.f.close(); originalsClosed = true;
  expect(() => x.f.db.prepare('SELECT 1').get()).toThrow();
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const result = battedVenueLegalEvidenceFromSqlite(db).read(query);
    expect(JSON.stringify(result)).toBe(expected);
    expect(db.isTransaction).toBe(false);
    expect(result.evidence.interpretation.kind).toBe('dead_ball');
    expect(result.policyReference).toEqual(value.policyReference);
    expect(nativeSettledFoulInputArchiveBytes(db)).toBe(before);
  } finally { db.close(); }
}, 60_000);

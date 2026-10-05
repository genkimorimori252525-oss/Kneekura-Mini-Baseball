import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { battedVenueLegalEvidenceFromSqlite } from './BattedVenueLegalEvidenceFromSqlite';
import { deriveOriginalBattingIntentEvidence } from './OriginalBattingIntent';
import { nativeSettledFoulInputArchiveBytes } from './NativeSettledFoulPhysicalFixtures.test-support';
import { battedVenueFoulCountFixture, type FoulCountScenario } from './BattedVenueFoulCountFixtures.test-support';
import { battedVenueFoulCountEvidenceFromSqlite } from './BattedVenueFoulCountEvidenceFromSqlite';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Fixture = ReturnType<typeof battedVenueFoulCountFixture>;
let directory: string;
const fixtures = new Map<FoulCountScenario, Fixture>(), closed = new Set<FoulCountScenario>();
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'venue-foul-count-'));
  for (const scenario of ['ordinary_0', 'ordinary_2', 'bunt_2', 'legacy_2'] as const) {
    fixtures.set(scenario, battedVenueFoulCountFixture(join(directory, scenario + '.sqlite'), scenario));
  }
}, 120_000);
afterAll(() => {
  for (const [scenario, x] of fixtures) if (!closed.has(scenario)) x.f.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
});
const own = (scenario: FoulCountScenario) => fixtures.get(scenario)!;
const baseQuery = (x: Fixture) => ({ ...x.query, version: 'batted_venue_legal_observation_v1' as const });
const logicalBytes = (x: Fixture) => JSON.stringify(x.f.db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' ORDER BY name").all()
  .map(row => ({ table: row.name, rows: x.f.db.prepare('SELECT * FROM main."' + String(row.name).replaceAll('"', '""') + '"').all() })));

it.each(['ordinary_0', 'ordinary_2', 'bunt_2'] as const)('derives the owned %s foul count without applying an event, count or closure', scenario => {
  const x = own(scenario), before = logicalBytes(x), changes = x.f.db.prepare('SELECT total_changes() AS n').get()!.n;
  const basis = battedVenueLegalEvidenceFromSqlite(x.f.db).read(baseQuery(x));
  const pitch = x.pitches.readAcceptedPitch(basis.physicalPitchSourceId)!;
  const result = battedVenueFoulCountEvidenceFromSqlite(x.f.db).read(x.query);
  expect(result.version).toBe('batted_venue_foul_count_evidence_v1');
  expect(result.basis).toEqual(basis);
  expect(result.battingIntent).toEqual(deriveOriginalBattingIntentEvidence(pitch));
  expect(result.battingIntent.physicalPitch.sourceId).toBe(basis.physicalPitchSourceId);
  expect(result.battingIntent.contact.resultTimelineHash).toBe(basis.originalCount.resultTimelineHash);
  expect(result.countConsequence).toEqual({ kind: 'derived', rule: { kind: 'uncaught_foul', ballDead: true,
    countResult: scenario === 'bunt_2' ? { kind: 'strikeout', terminalCount: { balls: 0, strikes: 3 }, cause: 'foul_bunt' }
      : { kind: 'continue', count: { balls: 0, strikes: scenario === 'ordinary_0' ? 1 : 2 }, cause: 'foul' } } });
  expect(result.basis.evidence.countEffect).toEqual({ kind: 'unresolved', reason: 'bunt_intent_pending' });
  expect(battedVenueLegalEvidenceFromSqlite(x.f.db).read(baseQuery(x))).toEqual(basis);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.countConsequence)).toBe(true);
  expect(logicalBytes(x)).toBe(before);
  expect(x.f.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(changes);
  expect(x.f.db.isTransaction).toBe(false);
  expect(x.pitches.readAcceptedPitch(pitch.source.sourceId)!.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
  for (const key of ['appliedCount', 'playEnd', 'officialClosure', 'resumeReceipt', 'projectedTimeline']) expect(result).not.toHaveProperty(key);
}, 60_000);

it('retains unknown legacy intent at two actual strikes instead of defaulting to ordinary foul', () => {
  const x = own('legacy_2'), before = x.inputArchiveBytes();
  const result = battedVenueFoulCountEvidenceFromSqlite(x.f.db).read(x.query);
  expect(result.basis.originalCount.count).toEqual({ balls: 0, strikes: 2 });
  expect(result.battingIntent.intent).toEqual({ kind: 'unresolved', reason: 'original_batting_intent_missing' });
  expect(result.countConsequence).toEqual({ kind: 'unresolved', reason: 'original_batting_intent_missing' });
  expect(x.inputArchiveBytes()).toBe(before);
});

it('keeps a valid earlier physical cut unresolved even when original intent is declared', () => {
  const x = own('ordinary_2');
  const result = battedVenueFoulCountEvidenceFromSqlite(x.f.db).read({ ...x.query, baseFieldSourceId: x.first.source.sourceId });
  expect(result.battingIntent.intent.kind).toBe('declared');
  expect(result.basis.evidence.interpretation.kind).toBe('unresolved');
  expect(result.countConsequence).toEqual({ kind: 'unresolved', reason: 'untouched_settled_foul_unproved' });
});
it.each(['buntAttempt', 'count', 'intent', 'ruleResult', 'physicalEvidence'] as const)('rejects caller-supplied %s', field => {
  const x = own('ordinary_2');
  expect(() => battedVenueFoulCountEvidenceFromSqlite(x.f.db).read({ ...x.query, [field]: true } as never)).toThrow();
});
it('requires the exact new observation version and an explicit execution cut', () => {
  const x = own('ordinary_2'), reader = battedVenueFoulCountEvidenceFromSqlite(x.f.db);
  expect(() => reader.read({ ...x.query, version: 'batted_venue_legal_observation_v1' } as never)).toThrow();
  expect(() => reader.read({ ...x.query, executionSourceId: undefined } as never)).toThrow();
});
it('revalidates original declared intent through the physical owner after a persisted mutation', () => {
  const x = own('bunt_2'), pitch = x.last.response.touch.worldContact.flight.physicalPitch;
  const row = x.f.db.prepare('SELECT source_json FROM physical_pitch_progress_actions WHERE source_id=?').get(pitch.source.sourceId)!;
  const changed = JSON.parse(String(row.source_json)); changed.battingIntent.attempt = 'ordinary_swing';
  x.f.db.prepare('UPDATE physical_pitch_progress_actions SET source_json=? WHERE source_id=?').run(JSON.stringify(changed), pitch.source.sourceId);
  try { expect(() => battedVenueFoulCountEvidenceFromSqlite(x.f.db).read(x.query)).toThrow(); }
  finally { x.f.db.prepare('UPDATE physical_pitch_progress_actions SET source_json=? WHERE source_id=?').run(row.source_json!, pitch.source.sourceId); }
});
it('rejects an injected dependency reader without calling it', () => {
  const x = own('ordinary_2'); let calls = 0;
  const fake = { prepare() { calls += 1; throw new Error('fake dependency reader must not run'); } };
  expect(() => battedVenueFoulCountEvidenceFromSqlite(fake as never).read(x.query)).toThrow(); expect(calls).toBe(0);
});
it('rejects observation getters without evaluating them', () => {
  const x = own('ordinary_2'); let calls = 0;
  const query = Object.defineProperty({ ...x.query }, 'policySourceId', { enumerable: true,
    get() { calls += 1; return x.query.policySourceId; } });
  expect(() => battedVenueFoulCountEvidenceFromSqlite(x.f.db).read(query)).toThrow(); expect(calls).toBe(0);
});
it('preserves the caller snapshot, query-only setting and authorizer', () => {
  const x = own('ordinary_0'), expected = battedVenueFoulCountEvidenceFromSqlite(x.f.db).read(x.query);
  x.f.db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
  x.f.db.exec('BEGIN; PRAGMA query_only=ON');
  try {
    expect(battedVenueFoulCountEvidenceFromSqlite(x.f.db).read(x.query)).toEqual(expected);
    expect(x.f.db.isTransaction).toBe(true); expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    expect(() => x.f.db.prepare('DELETE FROM main.batted_venue_legal_policies')).toThrow(/authorized/i);
  } finally { x.f.db.exec('ROLLBACK; PRAGMA query_only=OFF'); x.f.db.setAuthorizer(null); }
});
it('rejects a foreign policy instead of synthesizing a rule choice', () => {
  const x = own('ordinary_2');
  expect(() => battedVenueFoulCountEvidenceFromSqlite(x.f.db).read({ ...x.query, policySourceId: 'foreign' })).toThrow();
});
it('reopens identical read-only count evidence after all original handles for the file close', () => {
  const x = own('ordinary_2'), expected = battedVenueFoulCountEvidenceFromSqlite(x.f.db).read(x.query);
  const bytes = x.inputArchiveBytes(), path = x.f.path, query = x.query;
  x.f.close(); closed.add('ordinary_2');
  expect(() => x.f.db.prepare('SELECT 1').get()).toThrow();
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    expect(battedVenueFoulCountEvidenceFromSqlite(db).read(query)).toEqual(expected);
    expect(nativeSettledFoulInputArchiveBytes(db)).toBe(bytes);
    expect(db.isTransaction).toBe(false);
  } finally { db.close(); }
}, 60_000);

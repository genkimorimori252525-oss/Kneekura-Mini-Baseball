import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { originalLiveOwnerDomains, prospectiveLiveOwnerDomainsV3, assertActualLiveRegistrationBeforeWork,
  assertSamePaRegistrationBeforeWork } from './ActualLiveRuntimeRegistration';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const digest = () => createHash('sha256').update(JSON.stringify(originalLiveOwnerDomains())).digest('hex');
// Captured independently from df61388's literal original domain registry.
const frozenV1Digest = '5ab505c53eb9e8924fb58fb57551e8a8c2b0876a94b30932f8a56c1382fa3e2a';
const scope = { gameId: 'game', playId: 7, physicalPitchSourceId: 'pitch' };

it('retains exact frozen-v1 census bytes independently of v3 tables or their future work', () => {
  const db = new DatabaseSync(':memory:');
  try {
    expect(digest()).toBe(frozenV1Digest);
    expect(originalLiveOwnerDomains()).toHaveLength(24);
    expect(originalLiveOwnerDomains().some(d => d.owner === 'batted_world_continuations_v3')).toBe(false);
    expect(prospectiveLiveOwnerDomainsV3().some(d => d.owner === 'batted_world_continuations_v3')).toBe(true);
    db.exec('CREATE TABLE batted_world_continuations_v3 (source_id TEXT,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT)');
    db.exec('CREATE TABLE batted_world_continuation_heads_v3 (source_id TEXT,physical_pitch_source_id TEXT)');
    expect(digest()).toBe(frozenV1Digest);
    db.prepare('INSERT INTO batted_world_continuations_v3 VALUES (?,?,?,?)').run('work', 'pitch', '{}', '{}');
    expect(digest()).toBe(frozenV1Digest);
    expect(() => assertActualLiveRegistrationBeforeWork(db, scope)).toThrow('registered before governed work');
    expect(() => assertSamePaRegistrationBeforeWork(db, { ...scope, actorSourceId: 'actor' })).toThrow('precede every original physical work');
    expect(digest()).toBe(frozenV1Digest);
  } finally { db.close(); }
});

it('detects raw v3 pitch claims when cached scope columns point at another pitch', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE batted_world_continuations_v3 (source_id TEXT,physical_pitch_source_id TEXT,source_json TEXT,snapshot_json TEXT)');
    const snapshot = { response: { touch: { worldContact: { flight: { source: { physicalPitchSourceId: 'pitch' } } } } } };
    db.prepare('INSERT INTO batted_world_continuations_v3 VALUES (?,?,?,?)').run('work', 'foreign', '{}', JSON.stringify(snapshot));
    expect(() => assertActualLiveRegistrationBeforeWork(db, scope)).toThrow('registered before governed work');
    expect(() => assertSamePaRegistrationBeforeWork(db, { ...scope, actorSourceId: 'actor' })).toThrow('precede every original physical work');
    expect(digest()).toBe(frozenV1Digest);
  } finally { db.close(); }
});

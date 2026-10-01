import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';

const policy = { sourceId: 'response-source', sourceVersion: 'fixture-v1', policyId: 'response', version: 'v1', availableAtDay: 1,
  motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: 0.5, spinRetentionAtFullFatigue: 0.75 };
it('freezes accepted response policy, rejects changed versions and reopens without live authority', () => {
  const path = `file:pitch-response-policy-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  let live = policy;
  const store = openSqlitePitchFatiguePolicyStore(path, { readAcceptedPolicy: () => live });
  let reopened: ReturnType<typeof openSqlitePitchFatiguePolicyStore> | undefined;
  try {
    expect(store.accept(policy.sourceId)).toEqual(policy);
    live = { ...policy, sourceVersion: 'changed' }; expect(() => store.accept(policy.sourceId)).toThrow('frozen');
    live = { ...policy, sourceId: 'alias', velocityRetentionAtFullFatigue: 0.8 };
    expect(() => store.accept('alias')).toThrow('version');
    store.close(); const offline = openSqlitePitchFatiguePolicyStore(path); reopened = offline;
    expect(offline.accept(policy.sourceId)).toEqual(policy); expect(offline.readAcceptedPolicy(policy.sourceId)).toEqual(policy);
    expect(offline.readAcceptedPolicy('missing')).toBeNull(); expect(() => offline.accept('missing')).toThrow('missing');
    db.exec("UPDATE world_pitch_fatigue_policies SET source_json=json_set(source_json,'$.sourceVersion','changed')");
    expect(() => offline.readAcceptedPolicy(policy.sourceId)).toThrow('corrupt');
  } finally { reopened?.close(); store.close(); db.close(); }
});
it('detaches input and rolls back late altered or failed policy writes', () => {
  const path = `file:pitch-response-policy-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path), store = openSqlitePitchFatiguePolicyStore(path, { readAcceptedPolicy: () => policy });
  try {
    db.exec("CREATE TRIGGER alter_policy AFTER INSERT ON world_pitch_fatigue_policies BEGIN UPDATE world_pitch_fatigue_policies SET source_json=json_set(source_json,'$.sourceVersion','changed'),source_version='changed' WHERE source_id=NEW.source_id; END");
    expect(() => store.accept(policy.sourceId)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM world_pitch_fatigue_policies').get()).toEqual({ n: 0 });
    db.exec('DROP TRIGGER alter_policy');
    db.exec("CREATE TRIGGER fail_policy BEFORE INSERT ON world_pitch_fatigue_policies BEGIN SELECT RAISE(ABORT,'fixture policy failure'); END");
    expect(() => store.accept(policy.sourceId)).toThrow('fixture policy failure');
    expect(db.prepare('SELECT count(*) AS n FROM world_pitch_fatigue_policies').get()).toEqual({ n: 0 });
    db.exec('DROP TRIGGER fail_policy'); expect(store.accept(policy.sourceId)).toEqual(policy);
  } finally { store.close(); db.close(); }
});
it('detects valid provenance rewritten in both saved fields after commit without live authority', () => {
  const path = `file:pitch-response-policy-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path), store = openSqlitePitchFatiguePolicyStore(path, { readAcceptedPolicy: () => policy });
  const offline = openSqlitePitchFatiguePolicyStore(path);
  try {
    store.accept(policy.sourceId);
    db.exec("UPDATE world_pitch_fatigue_policies SET source_json=json_set(source_json,'$.sourceVersion','changed-after-commit'),source_version='changed-after-commit'");
    expect(() => offline.readAcceptedPolicy(policy.sourceId)).toThrow('corrupt');
    expect(() => offline.accept(policy.sourceId)).toThrow('corrupt');
  } finally { offline.close(); store.close(); db.close(); }
});

import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { openSqliteRunnerContactWaitStore, runnerContactWaitPolicyViewEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { runnerContactWaitProspectiveFixture } from './RunnerNativeContactWaitFixtures.test-support';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Fixture = ReturnType<typeof runnerContactWaitProspectiveFixture>;
const snapshot = (x: Fixture) => ({ rows:x.allRows(),changes:x.f.db.prepare('SELECT total_changes() AS n').get()!.n,
  mainSchema:x.f.db.prepare('PRAGMA main.schema_version').get()!.schema_version,
  tempSchema:x.f.db.prepare('PRAGMA temp.schema_version').get()!.schema_version });

it('preserves the caller transaction, query-only setting and authorizer during authentic main policy and historical view reads', () => {
  const x = runnerContactWaitProspectiveFixture();
  try {
    const store = x.f.track(openSqliteRunnerContactWaitStore(x.f.path,x.authority));
    const policy = store.acceptPolicy(x.policy.sourceId), view = store.acceptView(x.view.sourceId);
    x.advancePitch();
    const evidence = runnerContactWaitPolicyViewEvidenceFromSqlite(x.f.db);
    x.f.db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
    try {
      for (const queryOnly of [0,1]) {
        x.f.db.exec('BEGIN'); x.f.db.exec('PRAGMA query_only='+queryOnly);
        try {
          const before = snapshot(x);
          expect(evidence.readPolicy(x.policy.sourceId)).toEqual(policy);
          expect(evidence.readView(x.view.sourceId)).toEqual(view);
          expect(x.f.db.isTransaction).toBe(true);
          expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(queryOnly);
          expect(snapshot(x)).toEqual(before);
          expect(() => x.f.db.prepare('DELETE FROM main.actual_runner_event_views')).toThrow(/authorized/i);
        } finally { x.f.db.exec('ROLLBACK'); x.f.db.exec('PRAGMA query_only=OFF'); }
      }
    } finally { x.f.db.setAuthorizer(null); }
  } finally { try { x.f.close(); } finally { x.cleanupFile(); } }
});

it('keeps a caller WAL snapshot and sees uncommitted main corruption without taking over its rollback', () => {
  const x = runnerContactWaitProspectiveFixture();
  let peer: InstanceType<typeof DatabaseSync> | undefined;
  try {
    const store = x.f.track(openSqliteRunnerContactWaitStore(x.f.path,x.authority));
    const policy = store.acceptPolicy(x.policy.sourceId), view = store.acceptView(x.view.sourceId);
    const evidence = runnerContactWaitPolicyViewEvidenceFromSqlite(x.f.db);
    peer = new DatabaseSync(x.f.path);
    const original = peer.prepare('SELECT snapshot_hash FROM main.actual_runner_contact_wait_policies WHERE source_id=?')
      .get(x.policy.sourceId)!.snapshot_hash;
    try {
      x.f.db.exec('BEGIN');
      expect(evidence.readPolicy(x.policy.sourceId)).toEqual(policy);
      expect(peer.prepare("UPDATE main.actual_runner_contact_wait_policies SET snapshot_hash='corrupt-peer' WHERE source_id=?")
        .run(x.policy.sourceId).changes).toBe(1);
      const before = snapshot(x);
      expect(evidence.readPolicy(x.policy.sourceId)).toEqual(policy); expect(evidence.readView(x.view.sourceId)).toEqual(view);
      expect(x.f.db.isTransaction).toBe(true); expect(snapshot(x)).toEqual(before);
      x.f.db.exec('COMMIT');
      expect(() => evidence.readPolicy(x.policy.sourceId)).toThrow(/corrupt/i);
      expect(x.f.db.isTransaction).toBe(false);
    } finally {
      if (x.f.db.isTransaction) x.f.db.exec('ROLLBACK');
      peer.prepare('UPDATE main.actual_runner_contact_wait_policies SET snapshot_hash=? WHERE source_id=?').run(original,x.policy.sourceId);
    }
    x.f.db.exec('BEGIN');
    try {
      expect(x.f.db.prepare("UPDATE main.actual_runner_contact_wait_policies SET snapshot_hash='corrupt-uncommitted' WHERE source_id=?")
        .run(x.policy.sourceId).changes).toBe(1);
      const before = snapshot(x);
      expect(() => evidence.readPolicy(x.policy.sourceId)).toThrow(/corrupt/i);
      expect(x.f.db.isTransaction).toBe(true); expect(snapshot(x)).toEqual(before);
    } finally { x.f.db.exec('ROLLBACK'); }
    expect(evidence.readPolicy(x.policy.sourceId)).toEqual(policy); expect(evidence.readView(x.view.sourceId)).toEqual(view);
    expect(x.f.db.isTransaction).toBe(false); expect(x.f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  } finally { try { peer?.close(); x.f.close(); } finally { x.cleanupFile(); } }
});

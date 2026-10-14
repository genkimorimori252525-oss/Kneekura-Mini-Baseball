import { expect, test, vi } from 'vitest';
import { createRequire } from 'node:module';
import { policyFixture } from './ReceivedUmpireDefenderPolicyDataFixtures.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const archive = (db: InstanceType<typeof DatabaseSync>) => ({ fielding: db.prepare('SELECT * FROM world_player_fielding_models').all(),
  people: db.prepare('SELECT * FROM world_player_person_links').all(), roster: db.prepare('SELECT * FROM world_roster_heads').all() });

test('RP-T01 valid original dependency changes before BEGIN are rejected without undoing peer writes', async () => {
  const f = await policyFixture(), exec = DatabaseSync.prototype.exec;
  const source = { ...f.fieldingModel.source, ratings: { ...f.fieldingModel.source.ratings, firstStep: 0.9 } };
  const model = { ...f.fieldingModel, source }; let changed = false;
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && !changed) {
      changed = true; f.db.prepare('UPDATE world_player_fielding_models SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
        .run(json(source), hash(source), json(model), hash(model));
    }
    return exec.call(this, sql);
  });
  try {
    expect(() => f.store.accept('policy-a')).toThrow(/changed/); expect(changed).toBe(true); expect(f.rows()).toEqual([]);
    expect(f.models.read(source.sourceId)).toEqual(model);
  } finally { hook.mockRestore(); f.close(); }
});

test('RP-T02 original dependency mutation inside BEGIN rolls back and leaves the handle reusable', async () => {
  for (const sql of ["UPDATE world_player_person_links SET person_id='wrong'", "UPDATE world_player_fielding_models SET snapshot_hash='wrong'",
    "DELETE FROM world_roster_heads", "UPDATE world_player_fielding_models SET source_hash=source_hash"]) {
    const f = await policyFixture(), exec = DatabaseSync.prototype.exec, before = archive(f.db); let changed = false;
    const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, command: string) {
      exec.call(this, command);
      if (command === 'BEGIN IMMEDIATE' && !changed) { changed = true; exec.call(this, sql); }
    });
    try {
      expect(() => f.store.accept('policy-a')).toThrow(); expect(changed).toBe(true); expect(f.rows()).toEqual([]);
      expect(archive(f.db)).toEqual(before); hook.mockRestore(); expect(f.store.accept('policy-a').source).toEqual(f.source);
    } finally { hook.mockRestore(); f.close(); }
  }
});

test('RP-T03 retry reauthenticates original rows after callback mutation instead of returning a cached receipt', async () => {
  for (const sql of ["UPDATE world_player_person_links SET person_id='wrong'", "UPDATE world_player_fielding_models SET snapshot_hash='wrong'",
    'DELETE FROM world_received_umpire_defender_policy_data']) {
    const f = await policyFixture();
    try {
      f.store.accept('policy-a');
      const store = f.track(f.open(f.path, { readAcceptedPolicyData: () => { f.db.exec(sql); return f.source; } }));
      expect(() => store.accept('policy-a')).toThrow();
    } finally { f.close(); }
  }
});

test('RP-T04 competing WAL baseline remains exact and cannot be overwritten by an earlier preflight', async () => {
  const f = await policyFixture(), exec = DatabaseSync.prototype.exec;
  const peer = f.track(f.open(f.path, f.authority)); let changed = false;
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, sql: string) {
    if (sql === 'BEGIN IMMEDIATE' && !changed) { changed = true; peer.accept('policy-a'); }
    return exec.call(this, sql);
  });
  try {
    expect(() => f.store.accept('policy-a')).toThrow(/baseline/); expect(changed).toBe(true); expect(f.rows().length).toBe(1);
    expect(f.store.accept('policy-a')).toEqual(peer.read('policy-a'));
  } finally { hook.mockRestore(); f.close(); }
});

test('RP-T05 read proofs prohibit side effects and reject transaction replacement', async () => {
  for (const mode of ['write', 'replace-transaction']) {
    const f = await policyFixture(), exec = DatabaseSync.prototype.exec, before = archive(f.db); let attempted = false;
    f.store.accept('policy-a');
    const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, sql: string) {
      exec.call(this, sql);
      if (sql === 'PRAGMA query_only=1' && !attempted) {
        attempted = true;
        if (mode === 'write') exec.call(this, "UPDATE world_player_fielding_models SET source_hash='wrong'");
        else { exec.call(this, 'ROLLBACK'); exec.call(this, 'BEGIN'); }
      }
    });
    try {
      expect(() => f.store.read('policy-a')).toThrow(); expect(attempted).toBe(true); expect(archive(f.db)).toEqual(before);
    } finally { hook.mockRestore(); f.close(); }
  }
});

test('RP-T06 rollback failure retires the handle and preserves the original error as evidence', async () => {
  const f = await policyFixture(), exec = DatabaseSync.prototype.exec; let attempted = false;
  const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, sql: string) {
    if (sql === 'ROLLBACK') { attempted = true; throw new Error('injected rollback failure'); }
    exec.call(this, sql);
    if (sql === 'BEGIN IMMEDIATE') exec.call(this, "UPDATE world_player_fielding_models SET source_hash='wrong'");
  });
  try {
    expect(() => f.store.accept('policy-a')).toThrow(/rollback failed/); expect(attempted).toBe(true);
    expect(() => f.store.read('policy-a')).toThrow(/closed/); expect(f.rows()).toEqual([]);
    expect(f.models.read(f.fieldingModel.source.sourceId)).toEqual(f.fieldingModel);
  } finally { hook.mockRestore(); f.close(); }
});

test('RP-T07 reentrant callbacks cannot close or recursively accept into the active owner', async () => {
  const f = await policyFixture();
  let store: ReturnType<typeof f.open>;
  try {
    store = f.track(f.open(f.path, { readAcceptedPolicyData: () => {
      expect(() => store.accept('policy-a')).toThrow(/re-entry/); expect(() => store.close()).toThrow(/re-entry/); return f.source;
    } }));
    expect(store.accept('policy-a').source).toEqual(f.source); expect(f.rows().length).toBe(1);
  } finally { f.close(); }
});

test('RP-T08 an exception after real BEGIN acquisition rolls back and releases the transaction', async () => {
  for (const command of ['BEGIN', 'BEGIN IMMEDIATE']) {
    const f = await policyFixture(), exec = DatabaseSync.prototype.exec, connections: InstanceType<typeof DatabaseSync>[] = [];
    const hook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, sql: string) {
      exec.call(this, sql);
      if (sql === command && connections.length === 0) { connections.push(this); throw new Error('injected after BEGIN'); }
    });
    try {
      expect(() => command === 'BEGIN' ? f.store.read('policy-a') : f.store.accept('policy-a')).toThrow('injected after BEGIN');
      expect(connections.length).toBe(1);
      expect(connections[0].isTransaction, 'ACQUIRED_BEGIN_LEFT_ACTIVE').toBe(false);
      hook.mockRestore(); expect(f.store.accept('policy-a').source).toEqual(f.source);
    } finally { hook.mockRestore(); f.close(); }
  }
});

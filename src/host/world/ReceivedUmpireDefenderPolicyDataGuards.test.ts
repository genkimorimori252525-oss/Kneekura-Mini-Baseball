import { expect, test, vi } from 'vitest';
import { createRequire } from 'node:module';
import { policyFixture } from './ReceivedUmpireDefenderPolicyDataFixtures.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const table = 'world_received_umpire_defender_policy_data';

test('RP-G01 original Person owner authentication rejects unsupported intake on first and historical reads', async () => {
  for (const accepted of [false, true]) {
    const f = await policyFixture();
    try {
      if (accepted) f.store.accept('policy-a');
      f.db.exec("DELETE FROM world_roster_heads WHERE career_id='career-a'");
      expect(() => accepted ? f.store.read('policy-a') : f.store.accept('policy-a'), 'ORIGINAL_PERSON_OWNER_NOT_REPLAYED').toThrow();
      expect(f.rows().length).toBe(accepted ? 1 : 0);
    } finally { f.close(); }
  }
});

test('RP-G02 owner schema admission rejects views weakened constraints extra columns and triggers', async () => {
  for (const kind of ['view', 'no-unique', 'extra-column', 'trigger']) {
    const f = await policyFixture();
    try {
      f.store.close();
      const schema = f.db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(table)!.sql as string;
      if (kind === 'view') { f.db.exec(`ALTER TABLE ${table} RENAME TO original_policy; CREATE VIEW ${table} AS SELECT * FROM original_policy`); }
      if (kind === 'no-unique') { f.db.exec(`DROP TABLE ${table}`); f.db.exec(schema.replace(/,\s*UNIQUE\(career_id,player_id\)/, '')); }
      if (kind === 'extra-column') f.db.exec(`ALTER TABLE ${table} ADD COLUMN hidden TEXT`);
      if (kind === 'trigger') f.db.exec(`CREATE TRIGGER policy_effect AFTER INSERT ON ${table} BEGIN SELECT 1; END`);
      expect(() => f.track(f.open(f.path)), 'POLICY_OWNER_SCHEMA_NOT_ADMITTED').toThrow(/schema/);
    } finally { f.close(); }
  }
});

test('RP-G03 changed callback Source between preflight and write cannot become a baseline', async () => {
  const f = await policyFixture(); let calls = 0;
  try {
    const store = f.track(f.open(f.path, { readAcceptedPolicyData: () => ++calls === 1 ? f.source :
      { ...f.source, profiles: { ...f.source.profiles, safe: null } } }));
    expect(() => store.accept('policy-a'), 'CALLBACK_SOURCE_DRIFT_ACCEPTED').toThrow(/changed|frozen/);
    expect(calls).toBe(2); expect(f.rows()).toEqual([]);
  } finally { f.close(); }
});

test('RP-G04 post-insert non-owner writes and schema changes roll back with a real INSERT witness', async () => {
  for (const effect of ["UPDATE world_player_fielding_models SET source_hash=source_hash", 'CREATE TABLE unrelated_policy_effect(value TEXT)']) {
    const f = await policyFixture(), prepare = DatabaseSync.prototype.prepare;
    let inserted = false;
    const hook = vi.spyOn(DatabaseSync.prototype, 'prepare').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, sql: string) {
      const statement = prepare.call(this, sql);
      if (/INSERT INTO (?:main\.)?world_received_umpire_defender_policy_data/.test(sql)) {
        const run = statement.run, db = this;
        statement.run = function(this: typeof statement, ...args: Parameters<typeof run>) {
          const result = run.apply(this, args); inserted = result.changes === 1; db.exec(effect); return result;
        } as typeof run;
      }
      return statement;
    });
    try {
      expect(() => f.store.accept('policy-a'), 'NON_OWNER_WRITE_CONSERVATION_MISSING').toThrow();
      expect(inserted).toBe(true); expect(f.rows()).toEqual([]);
      expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name='unrelated_policy_effect'").all()).toEqual([]);
    } finally { hook.mockRestore(); f.close(); }
  }
});

test('RP-G05 COMMIT replaced by ROLLBACK fails durable own-row verification and retires the handle', async () => {
  const f = await policyFixture(), exec = DatabaseSync.prototype.exec, prepare = DatabaseSync.prototype.prepare;
  let inserted = false, substituted = false, callbackAfterCommit = false;
  const store = f.track(f.open(f.path, { readAcceptedPolicyData: () => { callbackAfterCommit ||= substituted; return f.source; } }));
  const prepareHook = vi.spyOn(DatabaseSync.prototype, 'prepare').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, sql: string) {
    const statement = prepare.call(this, sql);
    if (/INSERT INTO (?:main\.)?world_received_umpire_defender_policy_data/.test(sql)) {
      const run = statement.run;
      statement.run = function(this: typeof statement, ...args: Parameters<typeof run>) { const result = run.apply(this, args); inserted = result.changes === 1; return result; } as typeof run;
    }
    return statement;
  });
  const execHook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: InstanceType<typeof DatabaseSync>, sql: string) {
    if (sql === 'COMMIT' && inserted && !substituted) { substituted = true; return exec.call(this, 'ROLLBACK'); }
    return exec.call(this, sql);
  });
  try {
    expect(() => store.accept('policy-a'), 'ROLLED_BACK_POLICY_REPORTED_DURABLE').toThrow();
    expect(inserted && substituted).toBe(true); expect(callbackAfterCommit).toBe(false); expect(f.rows()).toEqual([]);
    expect(() => store.read('policy-a')).toThrow(/closed|retired/);
  } finally { prepareHook.mockRestore(); execHook.mockRestore(); f.close(); }
});

test('RP-G06 original dependency ownership cannot be supplied by a table with missing uniqueness', async () => {
  for (const original of ['world_player_fielding_models', 'world_player_person_links', 'world_roster_heads']) {
    const f = await policyFixture();
    try {
      f.db.exec(`CREATE TABLE replacement_original AS SELECT * FROM ${original}; DROP TABLE ${original}; ALTER TABLE replacement_original RENAME TO ${original}`);
      expect(() => f.store.accept('policy-a'), 'WEAKENED_ORIGINAL_SCHEMA_ACCEPTED').toThrow(/schema/);
      expect(f.rows()).toEqual([]);
    } finally { f.close(); }
  }
});

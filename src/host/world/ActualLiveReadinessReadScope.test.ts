import { expect, it, vi } from 'vitest';
import { fixture, withFixture, targetSourceId } from './ActualLivePhysicalActivationReadPairFixtures.test-support';
import { actualLivePlayReadinessFromSqlite, withActualLiveReadinessReadScope } from './ActualLivePlayReadinessFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as readinessModule from './ActualLivePlayReadinessFromSqlite';
import { battedEpisodeFieldBindingEvidenceFromSqlite } from './SqliteBattedEpisodeFieldBindingStore';

type Fixture = ReturnType<typeof fixture>;
const historical = (f: Fixture) => actualLivePlayReadinessFromSqlite(f.db).readHistorical(targetSourceId);
const scoped = <T>(f: Fixture, work: () => T) => f.transaction(() => f.owned(() => withActualLiveReadinessReadScope(f.db, work)));
const deeplyFrozen = (value: unknown): boolean => value === null || typeof value !== 'object'
  || Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);

// Real Native closure/official/ten-effect/readiness owners. The existing fixture
// labels its deep physical/adjudication/kinematics seams as synthetic.
it('authenticates repeated historical readiness once within one owned snapshot', () => withFixture(fixture(), f => {
  const before = f.archiveBytes(), synthetic = f.syntheticBytes();
  const values = f.transaction(() => f.owned(() => withActualLiveReadinessReadScope(f.db, () => [
    actualLivePlayReadinessFromSqlite(f.db).readHistorical(targetSourceId),
    actualLivePlayReadinessFromSqlite(f.db).readHistorical(targetSourceId),
  ])));
  expect(values.map(value => value.kind)).toEqual(['ready', 'ready']);
  expect(json(values[0])).toBe(json(values[1]));
  expect(values.every(deeplyFrozen)).toBe(true);
  expect(f.syntheticBytes()).toBe(synthetic);
  expect(f.archiveBytes()).toBe(before); expect(f.roleEffects()).toBe(10);
  expect(f.db.isTransaction).toBe(false);
  expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  expect(f.counts().historicalCompleted).toBe(2);
  console.log(JSON.stringify({ schema: 'actual_readiness_scope_counterexample_v1',
    readinessCompletions: f.counts().historicalCompleted, closureAuthentications: f.counts().closureAuthentications,
    identicalFrozenBytes: true, archivesUnchanged: true, realRoleEffects: f.roleEffects() }));
  expect(f.counts().closureAuthentications).toBe(1);
}));

it('keeps bare transactions and physical traversals freshly authenticated', () => withFixture(fixture(), f => {
  f.transaction(() => f.owned(() => { historical(f); historical(f); }));
  expect(f.counts().closureAuthentications).toBe(2);
}));

it('starts each separate scope empty even in the same enclosing transaction', () => withFixture(fixture(), f => {
  f.transaction(() => f.owned(() => {
    withActualLiveReadinessReadScope(f.db, () => historical(f));
    withActualLiveReadinessReadScope(f.db, () => historical(f));
  }));
  expect(f.counts().closureAuthentications).toBe(2);
  scoped(f, () => historical(f));
  expect(f.counts().closureAuthentications).toBe(3);
}));

it('keeps nested scopes empty and never promotes their completed values', () => withFixture(fixture(), f => {
  scoped(f, () => {
    const child = withActualLiveReadinessReadScope(f.db, () => historical(f));
    const parent = historical(f);
    expect(parent).not.toBe(child); expect(json(parent)).toBe(json(child));
    expect(withActualLiveReadinessReadScope(f.db, () => historical(f))).not.toBe(parent);
    expect(historical(f)).toBe(parent);
  });
  expect(f.counts().historicalCompleted).toBe(4);
  expect(f.counts().closureAuthentications).toBe(3);
}));

it('does not use historical readiness to satisfy current workload heads', () => withFixture(fixture(), f => {
  f.db.exec('UPDATE world_player_workload_heads SET revision=revision+1');
  scoped(f, () => {
    expect(historical(f).kind).toBe('ready');
    expect(() => actualLivePlayReadinessFromSqlite(f.db).read(targetSourceId)).toThrow('actual role workload head differs');
  });
}));

it('keeps different closure Sources distinct inside one scope', () => withFixture(fixture(), f => {
  scoped(f, () => {
    historical(f);
    expect(() => actualLivePlayReadinessFromSqlite(f.db).readHistorical('missing-closure')).toThrow();
    expect(historical(f).kind).toBe('ready');
  });
  expect(f.counts().closureAuthentications).toBe(1);
}));

it('authenticates independently on two Native connections with overlapping scopes', () => withFixture(fixture(), f => {
  scoped(f, () => {
    const first = historical(f); expect(f.counts().closureAuthentications).toBe(1);
    f.resetCounts(f.peer); f.peer.exec('BEGIN; PRAGMA query_only=ON');
    try {
      withActualLiveReadinessReadScope(f.peer, () => {
        const other = actualLivePlayReadinessFromSqlite(f.peer).readHistorical(targetSourceId);
        expect(other).not.toBe(first); expect(json(other)).toBe(json(first));
        expect(f.counts().closureAuthentications).toBe(1);
      });
    } finally { f.peer.exec('ROLLBACK; PRAGMA query_only=OFF'); }
    expect(historical(f)).toBe(first);
  });
}));

it('retains a pinned WAL snapshot and freshly rejects peer corruption next time', () => withFixture(fixture(), f => {
  const before = f.archiveBytes();
  scoped(f, () => {
    const first = historical(f);
    expect(f.peer.prepare("UPDATE actual_role_workload_settlements SET plan_hash='corrupt' WHERE closure_source_id=?").run(targetSourceId).changes).toBe(1);
    expect(historical(f)).toBe(first); expect(f.archiveBytes()).toBe(before);
  });
  expect(f.counts().closureAuthentications).toBe(1);
  expect(() => scoped(f, () => historical(f))).toThrow('actual role workload frozen plan differs');
  expect(f.counts().historicalCompleted).toBe(2);
}));

it('rejects an ordinary write before a completed value can be reused', () => withFixture(fixture(), f => {
  const before = f.archiveBytes();
  expect(() => scoped(f, () => { historical(f); f.db.exec('UPDATE activation_read_pair_probe SET value=1'); })).toThrow(/read.?only/i);
  expect(f.archiveBytes()).toBe(before);
  scoped(f, () => historical(f)); expect(f.counts().closureAuthentications).toBe(2);
}));

it('rejects two writes that restore bytes using the total_changes stamp', () => withFixture(fixture(), f => {
  const before = f.archiveBytes();
  expect(() => scoped(f, () => {
    historical(f); f.db.exec('PRAGMA query_only=OFF');
    try { f.db.exec('UPDATE activation_read_pair_probe SET value=1; UPDATE activation_read_pair_probe SET value=0'); }
    finally { f.db.exec('PRAGMA query_only=ON'); }
    historical(f);
  })).toThrow('readiness scope snapshot changed');
  expect(f.archiveBytes()).toBe(before);
}));

it('rejects prepared TEMP DDL while retaining the original archives', () => withFixture(fixture(), f => {
  const before = f.archiveBytes(), statement = f.db.prepare('CREATE TEMP VIEW readiness_scope_temp AS SELECT value FROM main.activation_read_pair_probe');
  expect(() => scoped(f, () => { historical(f); statement.run(); })).toThrow(/read.?only/i);
  expect(f.db.prepare("SELECT name FROM temp.sqlite_master WHERE name='readiness_scope_temp'").get()).toBeUndefined();
  expect(f.archiveBytes()).toBe(before);
}));

it('rejects attached authority and preexisting temp shadows', () => withFixture(fixture(), f => {
  f.db.exec("ATTACH DATABASE ':memory:' AS readiness_scope_other");
  expect(() => scoped(f, () => historical(f))).toThrow('readiness scope requires main-only query-only authority');
  f.db.exec('DETACH DATABASE readiness_scope_other; CREATE TEMP VIEW readiness_scope_temp AS SELECT 1');
  expect(() => scoped(f, () => historical(f))).toThrow('readiness scope requires main-only query-only authority');
  f.db.exec('DROP VIEW temp.readiness_scope_temp');
  expect(f.counts().closureAuthentications).toBe(0);
}));

it('rejects an attachment added after the first completed read', () => withFixture(fixture(), f => {
  try {
    expect(() => scoped(f, () => {
      historical(f); f.db.exec("ATTACH DATABASE ':memory:' AS readiness_scope_other"); historical(f);
    })).toThrow('readiness scope snapshot changed');
  } finally { f.db.exec('DETACH DATABASE readiness_scope_other'); }
}));

it('never returns a scope result after rollback and rebegin', () => withFixture(fixture(), f => {
  let escaped = false, nestedRejected = false;
  expect(() => scoped(f, () => {
    historical(f);
    f.peer.prepare("UPDATE actual_role_workload_settlements SET plan_hash='corrupt' WHERE closure_source_id=?").run(targetSourceId);
    f.db.exec('ROLLBACK; BEGIN');
    try { withActualLiveReadinessReadScope(f.db, () => historical(f)); }
    catch (error) { expect((error as Error).message).toContain('actual role workload frozen plan differs'); nestedRejected = true; }
    return 'must not escape';
  })).toThrow(/savepoint|cleanup|transaction/i);
  expect(nestedRejected).toBe(true);
  expect(escaped).toBe(false);
  expect(() => scoped(f, () => { historical(f); escaped = true; })).toThrow('actual role workload frozen plan differs');
  expect(escaped).toBe(false);
}));

it('does not seed when the readiness traversal cleanup fails after release', () => withFixture(fixture(), f => {
  const primary = new Error('readiness traversal cleanup sentinel');
  scoped(f, () => {
    let target: string | undefined;
    const realExec = f.db.exec.bind(f.db);
    const spy = vi.spyOn(f.db, 'exec').mockImplementation(sql => {
      const value = realExec(sql);
      if (!target && /^SAVEPOINT physical_field_read_/.test(sql)) target = sql.slice('SAVEPOINT '.length);
      else if (sql === `RELEASE ${target}`) { spy.mockRestore(); throw primary; }
      return value;
    });
    f.restore(() => spy.mockRestore());
    expect(() => historical(f)).toThrow(/cleanup/i);
    expect(historical(f).kind).toBe('ready');
  });
  expect(f.counts().closureAuthentications).toBe(2);
  expect(f.counts().historicalCompleted).toBe(1);
}));

it('discards a failed nested scope and preserves the exact primary error', () => withFixture(fixture(), f => {
  const primary = new Error('readiness scope primary sentinel');
  scoped(f, () => {
    let caught: unknown;
    try { withActualLiveReadinessReadScope(f.db, () => { historical(f); throw primary; }); }
    catch (error) { caught = error; }
    expect(caught).toBe(primary);
    expect(historical(f).kind).toBe('ready');
  });
  expect(f.counts().closureAuthentications).toBe(2);
}));

it('retains fresh pending and game-final readiness behavior', () => {
  for (const options of [{ settled: false }, { finalGame: true }]) withFixture(fixture(options), f => {
    scoped(f, () => {
      const a = historical(f), b = historical(f);
      expect(a.kind).toBe(options.finalGame ? 'game_final' : 'pending');
      expect(json(a)).toBe(json(b));
    });
    expect(f.counts().closureAuthentications).toBe(2);
  });
});

it('binding reads own separate scopes and preserve caller transaction settings', () => withFixture(fixture(), f => {
  const original = readinessModule.withActualLiveReadinessReadScope, entries: boolean[] = [];
  const spy = vi.spyOn(readinessModule, 'withActualLiveReadinessReadScope').mockImplementation((db, work) => {
    expect(db).toBe(f.db); expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    entries.push(f.db.isTransaction); return original(db, work);
  });
  f.restore(() => spy.mockRestore());
  const owner = battedEpisodeFieldBindingEvidenceFromSqlite(f.db);
  expect(owner.read('missing')).toBeNull(); expect(f.db.isTransaction).toBe(false);
  for (const setting of [0, 1]) {
    f.db.exec(`BEGIN; PRAGMA query_only=${setting}`);
    try {
      expect(owner.read('missing')).toBeNull(); expect(owner.read('missing')).toBeNull();
      expect(f.db.isTransaction).toBe(true); expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(setting);
    } finally { f.db.exec('ROLLBACK; PRAGMA query_only=OFF'); }
  }
  expect(entries).toEqual([true, true, true, true, true]);
}));

it('requires an actual query-only Native snapshot for explicit reuse', () => withFixture(fixture(), f => {
  expect(() => withActualLiveReadinessReadScope(f.db, () => historical(f))).toThrow('readiness scope requires a Native read snapshot');
  f.transaction(() => {
    expect(() => withActualLiveReadinessReadScope(f.db, () => historical(f))).toThrow('readiness scope requires main-only query-only authority');
    expect(() => withActualLiveReadinessReadScope({ prepare: f.db.prepare.bind(f.db) }, () => historical(f))).toThrow('readiness scope requires a Native read snapshot');
  });
}));

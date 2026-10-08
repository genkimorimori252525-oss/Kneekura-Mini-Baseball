import { expect, it, vi } from 'vitest';
import type { SQLOutputValue } from 'node:sqlite';
import { fixture, withFixture } from './ActualLivePhysicalActivationReadPairFixtures.test-support';
import { assertPriorActualLiveClosureCompleted } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';

// Held contract sources: release only after the isolated existing-API RED and
// the reviewed production repair. The shared fixture keeps prior admission,
// owner discovery, readiness, closure authentication and ten role effects real.
// Its explicit synthetic physical boundary cannot certify a physical artifact.
type Fixture = ReturnType<typeof fixture>;
type Row = Record<string, SQLOutputValue>;

const expectCounts = (x: Fixture, historical: number, closures = historical) => {
  expect(x.counts()).toEqual({ historicalEntries: historical, historicalCompleted: historical,
    closureAuthentications: closures });
};
const expectReference = (x: Fixture, value: ReturnType<Fixture['activate']>) => {
  expect(value !== null && x.reference !== null).toBe(true);
  expect(json(value) === json(x.reference)).toBe(true);
  expect(Object.isFrozen(value)).toBe(true);
  expect(value!.readinessReference.applicationId).toBe(x.applicationId);
  expect(value!.readinessReference.closureSourceId).toBe(x.targetSourceId);
};
const expectUnchanged = (x: Fixture, archives: string, synthetic: string) => {
  expect(x.archiveBytes() === archives).toBe(true);
  expect(x.syntheticBytes() === synthetic).toBe(true);
};

// Decorate real native statements. These hooks retain their actual row objects
// and never replace owner discovery, historical readiness or its result.
const observeOwnerRows = (x: Fixture, onRows: (rows: Row[]) => void, onMetadata?: () => void) => {
  const prepare = x.db.prepare.bind(x.db);
  const spy = vi.spyOn(x.db, 'prepare').mockImplementation((...args) => {
    const [sql] = args, statement = prepare(...args);
    const ownerQuery = sql.startsWith('SELECT * FROM actual_live_play_closures WHERE application_id=$id OR ');
    const metadataQuery = sql === 'SELECT * FROM applications WHERE application_id=?';
    if (ownerQuery || metadataQuery && onMetadata) {
      const all = statement.all.bind(statement);
      const rowsSpy = vi.spyOn(statement, 'all').mockImplementation((...parameters) => {
        const rows = all(...parameters);
        if (ownerQuery) onRows(rows);
        else onMetadata!();
        return rows;
      });
      x.restore(() => rowsSpy.mockRestore());
    }
    return statement;
  });
  x.restore(() => spy.mockRestore());
};

it('reuses the target already checked through a retained fence with identical activation bytes', () => withFixture(fixture({ retainedTargetFence: true }), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  const value = x.transaction(() => x.activate());
  expectReference(x, value); expectCounts(x, 1);
  expectUnchanged(x, archives, synthetic);
}));

it('checks a later-enumerated retained prior play after authenticating the target', () => withFixture(fixture({ retainedTargetFence: true }), x => {
  x.db.prepare('INSERT INTO actual_live_play_fences(game_id,play_id) VALUES(?,?)')
    .run(x.gameId, x.proposal.playId - 1);
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expect(() => x.transaction(() => x.activate())).toThrow(/staged owner.*missing/);
  // The target fence was inserted first. A completed target cannot terminate
  // the remaining retained-scope checks, even when no target result escapes.
  expectCounts(x, 1); expectUnchanged(x, archives, synthetic);
}));

it('authenticates independent activation calls freshly in the same and a new transaction', () => withFixture(fixture(), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  x.transaction(() => {
    expectReference(x, x.activate()); expectCounts(x, 1);
    expectReference(x, x.activate()); expectCounts(x, 2);
    expect(x.db.isTransaction).toBe(true);
  });
  expectReference(x, x.transaction(() => x.activate())); expectCounts(x, 3);
  expect(x.db.isTransaction).toBe(false); expectUnchanged(x, archives, synthetic);
}));

it('authenticates independent activation calls freshly inside one parent traversal', () => withFixture(fixture(), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  x.transaction(() => x.owned(() => {
    const parent = activeBattedWorldFieldReadFrame(x.db); expect(parent).not.toBeNull();
    expectReference(x, x.activate()); expectCounts(x, 1);
    expect(activeBattedWorldFieldReadFrame(x.db)).toBe(parent);
    expectReference(x, x.activate()); expectCounts(x, 2);
    expect(activeBattedWorldFieldReadFrame(x.db)).toBe(parent);
  }));
  expectReference(x, x.transaction(() => x.owned(() => x.activate()))); expectCounts(x, 3);
  expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull();
  expectUnchanged(x, archives, synthetic);
}));

it('keeps two historical reads and four closure authentications in native autocommit', () => withFixture(fixture(), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expectReference(x, x.activate()); expectCounts(x, 2, 4);
  expect(x.db.isTransaction).toBe(false);
  expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull();
  expectUnchanged(x, archives, synthetic);
}));

const checkPrepareOnlyAdapter = (claimsTransaction: boolean) => withFixture(fixture(), x => {
  const adapter = claimsTransaction ? { prepare: x.db.prepare.bind(x.db), isTransaction: true }
    : { prepare: x.db.prepare.bind(x.db) };
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  x.resetCounts(adapter);
  x.transaction(() => {
    expect(x.db.isTransaction).toBe(true);
    expectReference(x, x.activate(adapter)); expectCounts(x, 2, 4);
    expect(x.db.isTransaction).toBe(true);
    expect(activeBattedWorldFieldReadFrame(x.db)).toBeNull();
  });
  expect(x.db.isTransaction).toBe(false);
  expect(activeBattedWorldFieldReadFrame(adapter)).toBeNull();
  expectUnchanged(x, archives, synthetic);
});

it('keeps two historical reads and four closure authentications for the existing prepare-only adapter', () => {
  checkPrepareOnlyAdapter(false);
});

it('keeps legacy authentication for the existing prepare-only adapter claiming isTransaction true', () => {
  checkPrepareOnlyAdapter(true);
});

it('preserves the public prior assertion successful undefined result', () => withFixture(fixture({ retainedTargetFence: true }), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expect(x.transaction(() => assertPriorActualLiveClosureCompleted(x.db, x.applicationId, true))).toBeUndefined();
  expectCounts(x, 1);
  expect(assertPriorActualLiveClosureCompleted(x.db, null)).toBeUndefined();
  expectUnchanged(x, archives, synthetic);
}));

it('returns null for a clean missing target owner after checking the available prior scope', () => withFixture(fixture(), x => {
  x.db.prepare('DELETE FROM actual_live_play_closures WHERE source_id=?').run(x.targetSourceId);
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expect(x.transaction(() => x.activate())).toBeNull(); expectCounts(x, 0);
  expectUnchanged(x, archives, synthetic);
}));

it('rejects a missing target owner when its real retained fence remains', () => withFixture(fixture({ retainedTargetFence: true }), x => {
  x.db.prepare('DELETE FROM actual_live_play_closures WHERE source_id=?').run(x.targetSourceId);
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expect(() => x.transaction(() => x.activate())).toThrow(/staged owner.*missing/);
  expectCounts(x, 0); expectUnchanged(x, archives, synthetic);
}));

it('rejects committed closure archive corruption on the next activation', () => withFixture(fixture(), x => {
  expectReference(x, x.transaction(() => x.activate())); expectCounts(x, 1);
  x.db.prepare("UPDATE actual_live_play_closures SET source_hash='corrupt-closure' WHERE source_id=?").run(x.targetSourceId);
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expect(() => x.transaction(() => x.activate())).toThrow(/archive/);
  expect(x.counts().historicalEntries).toBe(2); expect(x.counts().historicalCompleted).toBe(1);
  expectUnchanged(x, archives, synthetic);
}));

it('rejects committed settlement archive corruption on the next activation', () => withFixture(fixture(), x => {
  expectReference(x, x.transaction(() => x.activate())); expectCounts(x, 1);
  x.db.prepare("UPDATE actual_role_workload_settlements SET plan_hash='corrupt-settlement' WHERE closure_source_id=?")
    .run(x.targetSourceId);
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expect(() => x.transaction(() => x.activate())).toThrow(/plan/);
  expect(x.counts().historicalEntries).toBe(2); expect(x.counts().historicalCompleted).toBe(1);
  expectUnchanged(x, archives, synthetic);
}));

it('discovers a committed conflicting owner through its hidden raw application mirror on the next activation', () => withFixture(fixture(), x => {
  expectReference(x, x.transaction(() => x.activate())); expectCounts(x, 1);
  // The relational application and source mirror no longer name the target;
  // proposal.source.applicationId still does, so raw discovery must find it.
  x.db.prepare("UPDATE actual_live_play_closures SET application_id='other-application', source_json=json_set(source_json,'$.applicationId','other-application') WHERE source_id=?")
    .run(x.targetSourceId);
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expect(() => x.transaction(() => x.activate())).toThrow(/ownership/);
  expectCounts(x, 1); expectUnchanged(x, archives, synthetic);
}));

it('rejects a requested game that differs after authenticating real target readiness', () => withFixture(fixture({ retainedTargetFence: true }), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expect(() => x.transaction(() => x.activate(x.db, 'other-game'))).toThrow(/scope/);
  expectCounts(x, 1); expectUnchanged(x, archives, synthetic);
}));

it('rejects pending real role effects before another physical activation', () => withFixture(fixture({ settled: false }), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expect(() => x.transaction(() => x.activate())).toThrow(/actual_role_workload_pending/);
  expectCounts(x, 1); expectUnchanged(x, archives, synthetic);
}));

it('rejects a final game after all ten real role effects complete', () => withFixture(fixture({ finalGame: true }), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  expect(x.roleEffects()).toBe(10);
  expect(() => x.transaction(() => x.activate())).toThrow(/game_final/);
  expectCounts(x, 1); expectUnchanged(x, archives, synthetic);
}));

it('selects the captured target while a discarded initial owner alias is mutated and then restored', () => withFixture(fixture(), x => {
  // An installed empty scope table supplies real metadata work between owner
  // discovery and the final target route without adding a checked target.
  x.db.exec('CREATE TABLE IF NOT EXISTS actual_live_play_fences(game_id TEXT,play_id INTEGER,closure_source_id TEXT)');
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  let captured: Row | undefined, original: Row | undefined, ownerQueries = 0, mutated = false, restored = false;
  observeOwnerRows(x, rows => {
    ownerQueries++;
    if (ownerQueries === 1) { expect(rows.length).toBe(1); captured = rows[0]; original = { ...rows[0] }; }
  }, () => {
    if (mutated) return;
    expect(captured !== undefined).toBe(true);
    captured!.source_id = 'discarded-alias-source'; captured!.application_id = 'discarded-alias-application';
    mutated = true;
  });
  x.hooks.beforeHistorical = (_db, sourceId) => {
    expect(sourceId).toBe(x.targetSourceId); expect(mutated).toBe(true);
    expect(captured!.source_id).toBe('discarded-alias-source');
    Object.assign(captured!, original!); restored = true;
  };
  expectReference(x, x.transaction(() => x.activate())); expectCounts(x, 1);
  expect(ownerQueries).toBe(2); expect(restored).toBe(true);
  expect(json(captured) === json(original)).toBe(true);
  expectUnchanged(x, archives, synthetic);
}));

it('rejects changed raw owner identity returned by the final owner audit', () => withFixture(fixture(), x => {
  const archives = x.archiveBytes(), synthetic = x.syntheticBytes();
  let ownerQueries = 0, auditChanged = false;
  observeOwnerRows(x, rows => {
    if (++ownerQueries !== 2) return;
    expect(rows.length).toBe(1);
    const source = JSON.parse(String(rows[0].source_json));
    source.applicationId = 'changed-final-audit-application';
    // Change the row that the fresh final audit actually receives. Changing
    // only the discarded initial alias would not exercise this comparison.
    rows[0].source_json = json(source); auditChanged = true;
  });
  expect(() => x.transaction(() => x.activate())).toThrow(/owner|identity|differ|changed/);
  expect(ownerQueries).toBe(2); expect(auditChanged).toBe(true); expectCounts(x, 1);
  expectUnchanged(x, archives, synthetic);
}));

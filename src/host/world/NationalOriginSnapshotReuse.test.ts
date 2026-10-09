import { expect, it, vi } from 'vitest';
import { nationalPhysicalPregameFixture } from './NationalPhysicalMatchFixtures.test-support';
import { readNationalMatchOrigin } from './NationalMatchOriginFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';

const fixture = () => {
  const f = nationalPhysicalPregameFixture(), origin = f.origins.capture(f.source);
  let derivations = 0, archiveReads = 0;
  const prepare = f.db.prepare.bind(f.db), spy = vi.spyOn(f.db, 'prepare').mockImplementation(sql => {
    if (/SELECT revision, event_id, effective_day, entry_json FROM world_national_callups/.test(sql)) derivations++;
    if (/SELECT \* FROM (main\.)?world_national_match_origins WHERE game_id=/.test(sql)) archiveReads++;
    return prepare(sql);
  });
  return { f, origin, read: () => readNationalMatchOrigin(f.db, f.source.gameId),
    counts: () => ({ derivations, archiveReads }), close: () => { spy.mockRestore(); if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.close(); } };
};

it('shares a positive original only within one unchanged snapshot across fresh child frames', () => {
  const x = fixture(); try {
    withBattedVenueLegalReadSnapshot(x.f.db, () => {
      const first = x.read(); expect(first).toEqual(x.origin);
      expect(withBattedWorldPhysicalReadTraversal(x.f.db, x.read)).toBe(first);
      expect(withBattedWorldPhysicalReadTraversal(x.f.db, x.read)).toBe(first);
      expect(x.counts()).toEqual({ derivations: 1, archiveReads: 3 });
    });
    expect(x.read()).toEqual(x.origin); expect(x.counts().derivations).toBe(2);
  } finally { x.close(); }
});

it('checks fresh original rows on reuse and poisons the snapshot after a caught validation error', () => {
  const x = fixture(); let corrupt = false;
  const prepare = x.f.db.prepare.bind(x.f.db), spy = vi.spyOn(x.f.db, 'prepare').mockImplementation(sql => {
    const statement = prepare(sql);
    if (/SELECT \* FROM (main\.)?world_national_match_origins WHERE game_id=/.test(sql)) {
      const all = statement.all.bind(statement);
      statement.all = (...args) => {
        const rows = Reflect.apply(all, statement, args) as ReturnType<typeof all>;
        if (corrupt && rows[0]) rows[0].snapshot_hash = 'changed-read-alias'; return rows;
      };
    }
    return statement;
  });
  try {
    withBattedVenueLegalReadSnapshot(x.f.db, () => {
      x.read(); corrupt = true; expect(x.read).toThrow(); corrupt = false;
      expect(x.read).toThrow(/failed|snapshot|expired/);
    });
    expect(x.read()).toEqual(x.origin);
  } finally { spy.mockRestore(); x.close(); }
});

it('does not reuse proof after a caught descendant failure and authenticates an independent retry', () => {
  const x = fixture(); try {
    withBattedVenueLegalReadSnapshot(x.f.db, () => {
      x.read();
      expect(() => withBattedWorldPhysicalReadTraversal(x.f.db, () => { throw new Error('descendant failure'); })).toThrow('descendant failure');
      expect(x.read).toThrow(/failed|snapshot|expired/);
    });
    expect(x.read()).toEqual(x.origin); expect(x.counts().derivations).toBe(2);
  } finally { x.close(); }
});

it('cannot install a completed original when its child cleanup fails', () => {
  const x = fixture(), exec = x.f.db.exec.bind(x.f.db); let armed = true;
  const spy = vi.spyOn(x.f.db, 'exec').mockImplementation(sql => {
    const value = exec(sql);
    if (armed && /^RELEASE physical_field_read_/.test(sql)) { armed = false; throw new Error('released child cleanup sentinel'); }
    return value;
  });
  try {
    withBattedVenueLegalReadSnapshot(x.f.db, () => {
      expect(x.read).toThrow(); expect(armed).toBe(false);
      expect(x.read).toThrow(/failed|snapshot|expired/);
    });
    expect(x.read()).toEqual(x.origin); expect(x.counts().derivations).toBe(2);
  } finally { spy.mockRestore(); x.close(); }
});

it('expires all original proof when the outer snapshot cleanup fails', () => {
  const x = fixture(), exec = x.f.db.exec.bind(x.f.db); let root: string | null = null, armed = true;
  const spy = vi.spyOn(x.f.db, 'exec').mockImplementation(sql => {
    if (!root && /^SAVEPOINT physical_field_read_/.test(sql)) root = sql.slice('SAVEPOINT '.length);
    const value = exec(sql);
    if (armed && root && sql === `RELEASE ${root}`) { armed = false; throw new Error('outer cleanup sentinel'); }
    return value;
  });
  try {
    expect(() => withBattedVenueLegalReadSnapshot(x.f.db, () => {
      const first = x.read(); expect(withBattedWorldPhysicalReadTraversal(x.f.db, x.read)).toBe(first);
    })).toThrow();
    expect(armed).toBe(false); expect(x.counts().derivations).toBe(1);
    expect(x.read()).toEqual(x.origin); expect(x.counts().derivations).toBe(2);
  } finally { spy.mockRestore(); x.close(); }
});

it('rejects dependency write-and-restore and transaction replacement before proof can escape', () => {
  const x = fixture(); try {
    x.f.db.exec('CREATE TABLE national_snapshot_probe(value INTEGER); INSERT INTO national_snapshot_probe VALUES(0)');
    expect(() => withBattedVenueLegalReadSnapshot(x.f.db, () => {
      x.read(); x.f.db.exec('PRAGMA query_only=OFF; UPDATE national_snapshot_probe SET value=1; UPDATE national_snapshot_probe SET value=0; PRAGMA query_only=ON');
      expect(x.read).toThrow();
    })).toThrow(/changed|transaction|cleanup/);
    expect(() => withBattedVenueLegalReadSnapshot(x.f.db, () => {
      x.read(); x.f.db.exec('ROLLBACK; BEGIN'); x.read();
    })).toThrow(/savepoint|transaction|cleanup/);
    expect(x.read()).toEqual(x.origin);
  } finally { x.close(); }
});

it('does not retain missing origins and rejects a namespace added after a positive read', () => {
  const x = fixture(); try {
    withBattedVenueLegalReadSnapshot(x.f.db, () => {
      expect(readNationalMatchOrigin(x.f.db, 'missing-game')).toBeNull();
      expect(readNationalMatchOrigin(x.f.db, 'missing-game')).toBeNull();
      expect(x.counts().archiveReads).toBe(2);
      x.read(); x.f.db.exec("ATTACH ':memory:' AS national_snapshot_extra");
      expect(x.read).toThrow(/main-only/);
    });
    x.f.db.exec('DETACH national_snapshot_extra'); expect(x.read()).toEqual(x.origin);
  } finally { x.close(); }
});

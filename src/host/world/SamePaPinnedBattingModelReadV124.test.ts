import type { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { battingModelStanceFixture } from './NativeBattingModelStanceFixtures.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPinnedBattingModelV124 as read } from './SamePaPinnedBattingModelReadV124';

const phase = <T>(db: DatabaseSync, body: () => T): T => {
  db.exec('PRAGMA query_only=1; BEGIN');
  try { return withSamePaContinuationReadPhase(db, body); }
  finally { if (db.isTransaction) db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
};

it('PBM124-01 genuine complete batting proof shares one real identity SELECT across distinct child phases/readers', () => {
  const f = battingModelStanceFixture(), db = f.x.f.db, prepare = db.prepare;
  try {
    const original = f.modelStore.accept(f.source.sourceId), pin = reference('world_player_batting_models', original);
    let identityReads = 0;
    // Observe only executed identity SELECTs. No global spy/statement history
    // and no compiled statement reuse; each actual prepare remains fresh.
    db.prepare = function(sql, ...options) {
      const statement = prepare.call(this, sql, ...options);
      if (sql.startsWith('SELECT * FROM main.world_player_batting_models WHERE source_id=? OR')) {
        const all = statement.all;
        statement.all = (...args) => { identityReads++; return Reflect.apply(all, statement, args); };
      }
      return statement;
    };
    const started = performance.now();
    const completed = phase(db, () => {
      const firstReader = () => read(db, pin), secondReader = () => read(db, { ...pin });
      const first = withSamePaLifecycleReadPhase(db, firstReader), second = withSamePaLifecycleReadPhase(db, secondReader);
      console.info('PBM124_NATIVE_SQL', JSON.stringify({ calls: 2, identityReads, elapsedMs: performance.now() - started }));
      expect(identityReads).toBe(1); expect(second).toBe(first); expect(first).toEqual(original);
      expect(Object.isFrozen(first)).toBe(true); expect(Object.isFrozen(first.repertoire.values.profiles)).toBe(true);
      return first;
    });
    const next = phase(db, () => read(db, pin));
    expect(identityReads).toBe(2); expect(next).toEqual(completed); expect(next).not.toBe(completed);
  } finally { db.prepare = prepare; if (db.isTransaction) db.exec('ROLLBACK'); f.close(); }
});

it('PBM124-02 complete pin differences cannot hit and a caught failure poisons the enclosing proof', () => {
  const f = battingModelStanceFixture(), db = f.x.f.db;
  try {
    const original = f.modelStore.accept(f.source.sourceId), pin = reference('world_player_batting_models', original);
    for (const wrong of [{ ...pin, sourceHash: hash('wrong-source') }, { ...pin, snapshotHash: hash('wrong-snapshot') },
      { ...pin, sourceId: 'missing-model' }, { ...pin, owner: 'other-owner' }]) {
      expect(() => phase(db, () => {
        read(db, pin); expect(() => read(db, wrong as typeof pin)).toThrow();
        expect(() => read(db, pin)).toThrow(/expired/);
      })).toThrow(/expired/);
    }
    expect(phase(db, () => read(db, pin))).toEqual(original);
  } finally { f.close(); }
});

it('PBM124-03 restored query-only or main-only settings cannot revive proof after caught boundary failure', () => {
  const f = battingModelStanceFixture(), db = f.x.f.db;
  try {
    const original = f.modelStore.accept(f.source.sourceId), pin = reference('world_player_batting_models', original);
    expect(() => phase(db, () => {
      read(db, pin); db.exec('PRAGMA query_only=0');
      expect(() => read(db, pin)).toThrow(/query-only/); db.exec('PRAGMA query_only=1');
      expect(() => read(db, pin)).toThrow(/expired/);
    })).toThrow(/expired/);
    expect(() => phase(db, () => {
      read(db, pin); db.exec("ATTACH DATABASE ':memory:' AS peer");
      expect(() => read(db, pin)).toThrow(/main owners/); db.exec('DETACH DATABASE peer');
      expect(() => read(db, pin)).toThrow(/expired/);
    })).toThrow(/expired/);
    expect(phase(db, () => read(db, pin))).toEqual(original);
  } finally { f.close(); }
});

it('PBM124-04 original evidence writes cannot use a completed hit and remain corrupt in the next phase', () => {
  const f = battingModelStanceFixture(), db = f.x.f.db;
  try {
    const original = f.modelStore.accept(f.source.sourceId), pin = reference('world_player_batting_models', original);
    expect(() => phase(db, () => {
      read(db, pin); db.exec('PRAGMA query_only=0');
      db.prepare('UPDATE world_player_batting_models SET snapshot_hash=? WHERE source_id=?').run('changed', pin.sourceId);
      db.exec('PRAGMA query_only=1'); expect(() => read(db, pin)).toThrow(); expect(() => read(db, pin)).toThrow(/expired/);
    })).toThrow(/expired/);
    // The first mutation was rolled back with its test snapshot. A committed
    // original corruption must still be reread and rejected in a fresh phase.
    expect(phase(db, () => read(db, pin))).toEqual(original);
    db.prepare('UPDATE world_player_batting_models SET snapshot_hash=? WHERE source_id=?').run('changed', pin.sourceId);
    expect(() => phase(db, () => read(db, pin))).toThrow(/corrupt/);
  } finally { f.close(); }
});

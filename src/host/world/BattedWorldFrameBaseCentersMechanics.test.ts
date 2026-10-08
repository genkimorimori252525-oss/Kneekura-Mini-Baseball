import { expect, it } from 'vitest';
import { legacyBattedSetupGeometryFixture } from './BattedWorldFrameBaseCentersLegacy.test-support';
import { battedWorldFrameBaseCenters } from './SqliteBattedWorldBaseGeometryStore';

it.each(['acquired BEGIN throws', 'COMMIT reopens a transaction', 'COMMIT changes query_only'] as const)(
  'GEO-B01 cleans up when %s without closing the caller connection', kind => {
    const { f, flight } = legacyBattedSetupGeometryFixture(), original = f.db.exec;
    let reached = false;
    Object.defineProperty(f.db, 'exec', { configurable: true, value: function (sql: string) {
      const result = Reflect.apply(original, f.db, [sql]);
      if (!reached && kind === 'acquired BEGIN throws' && sql === 'BEGIN') { reached = true; throw new Error('injected acquired BEGIN fault'); }
      if (!reached && sql === 'COMMIT' && kind !== 'acquired BEGIN throws') {
        reached = true; Reflect.apply(original, f.db, [kind === 'COMMIT reopens a transaction' ? 'BEGIN' : 'PRAGMA query_only=ON']);
      }
      return result;
    } });
    try {
      expect(() => battedWorldFrameBaseCenters(f.db, flight)).toThrow(); expect(reached).toBe(true);
      expect(f.db.isTransaction, 'owned transaction must end even when Native BEGIN acquires and throws').toBe(false);
      expect(f.db.prepare('PRAGMA query_only').get()!.query_only, 'caller query_only setting must be restored').toBe(0);
      expect(f.db.isOpen).toBe(true);
    } finally {
      Reflect.deleteProperty(f.db, 'exec'); if (f.db.isTransaction) f.db.exec('ROLLBACK');
      f.db.exec('PRAGMA query_only=OFF'); f.close();
    }
  });
it('GEO-B02 preserves a caller-owned Native transaction', () => {
  const { f, flight } = legacyBattedSetupGeometryFixture();
  try {
    f.db.exec('BEGIN');
    expect(battedWorldFrameBaseCenters(f.db, flight)).toEqual(f.firstInput.worldSetup.baseCenters);
    expect(f.db.isTransaction).toBe(true); expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(f.db.isOpen).toBe(true);
  } finally { if (f.db.isTransaction) f.db.exec('ROLLBACK'); f.close(); }
});

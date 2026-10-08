import { expect, it } from 'vitest';
import { legacyBattedSetupGeometryFixture } from './BattedWorldFrameBaseCentersLegacy.test-support';
import { battedWorldFrameBaseCenters } from './SqliteBattedWorldBaseGeometryStore';
it('preserves legacy scoring setup routing through a genuine accepted activated batter, SWING and flight', () => {
  const { f, flight } = legacyBattedSetupGeometryFixture();
  try {
    const before = f.db.prepare('SELECT total_changes() AS n').get()!.n;
    expect(battedWorldFrameBaseCenters(f.db, flight)).toEqual(f.firstInput.worldSetup.baseCenters);
    expect(f.db.prepare('SELECT total_changes() AS n').get()!.n).toBe(before); expect(f.db.isTransaction).toBe(false);
  } finally { f.close(); }
});

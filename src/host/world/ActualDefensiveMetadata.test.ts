import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { assertDefensiveMetadataUnambiguous as guard } from './ActualDefensiveMetadata';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('requires typed single metadata containers without interpreting string-encoded history records', () => {
  const db = new DatabaseSync(':memory:');
  const snapshot = { source: {}, history: [{ sourceId: 'one' }], revision: 1,
    receipt: { self: { playerId: 'p' }, originDecisionSourceId: 'one', originObservationSourceId: 'observation' } };
  try {
    for (const value of [{ ...snapshot, source: [] }, { ...snapshot, history: { 0: { sourceId: 'one' } } },
      { ...snapshot, history: ['{"sourceId":"one"}'] }, { ...snapshot, receipt: [] },
      { ...snapshot, receipt: { ...snapshot.receipt, self: [] } }]) {
      expect.soft(() => guard(db, 'decision', '{}', JSON.stringify(value))).toThrow();
    }
    expect(() => guard(db, 'decision', '{}', JSON.stringify(snapshot))).not.toThrow();
    expect(() => guard(db, 'decision', 'opaque future Source', 'opaque future snapshot')).not.toThrow();
    const payload = JSON.stringify(snapshot).replace('"revision":1', '"revision":1,"view":{"x":1,"x":2}');
    expect(() => guard(db, 'decision', '{}', payload)).not.toThrow();
  } finally { db.close(); }
});

import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { actualLiveAdjudicationIdentityRow } from './ActualLiveAdjudicationMetadata';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
for (const owner of ['actual_live_adjudications', 'actual_live_play_closures'] as const) {
  const column = owner === 'actual_live_adjudications' ? 'snapshot_json' : 'proposal_json';
  it(`${owner} refuses hidden duplicate Source aliases and escaped metadata keys`, () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec(`CREATE TABLE ${owner}(source_id TEXT PRIMARY KEY,source_json TEXT,${column} TEXT);`);
      db.prepare(`INSERT INTO ${owner} VALUES(?,?,?)`).run('source', '{"sourceId":"source"}', '{"source":{"sourceId":"source"}}');
      expect(actualLiveAdjudicationIdentityRow(db, owner, 'source')?.source_id).toBe('source');
      db.prepare(`INSERT INTO ${owner} VALUES(?,?,?)`).run('hidden', '{"sourceId":"hidden","sourceId":"source"}', '{"source":{"sourceId":"hidden"}}');
      expect(() => actualLiveAdjudicationIdentityRow(db, owner, 'source')).toThrow(/ownership/);
      db.prepare(`DELETE FROM ${owner} WHERE source_id='hidden'`).run();
      db.prepare(`UPDATE ${owner} SET ${column}=?`).run('{"source":{"sourceId":"source","source\\u0049d":"source"}}');
      expect(() => actualLiveAdjudicationIdentityRow(db, owner, 'source')).toThrow(/mirror/);
    } finally { db.close(); }
  });
}

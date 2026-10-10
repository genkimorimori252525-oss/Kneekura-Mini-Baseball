import { createRequire } from 'node:module';
import { actualLiveAdjudicationInput as input, type AcceptedActualLiveAdjudication } from './ActualLiveAdjudicationSource';
import { actualLiveAdjudicationEvidenceFromSqlite } from './ActualLiveAdjudicationFromSqlite';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
export { openSqliteActualPostPlayReviewStore } from './SqliteActualPostPlayReviewStore';
export const openSqliteActualLiveAdjudicationStore = (path: string,
  authority?: Readonly<{ readAcceptedAdjudication(sourceId: string): AcceptedActualLiveAdjudication | null }>) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS actual_live_adjudications(source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,
      physical_end_source_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(game_id,play_id));`);
  const owner = actualLiveAdjudicationEvidenceFromSqlite(db); let closed = false;
  const check = () => { if (closed) throw new Error('closed actual live adjudication store'); };
  const transaction = <T>(mode: string, body: () => T): T => { db.exec(mode); try { const result = body(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; } };
  const proof = <T>(body: () => T): T => withBattedWorldPhysicalReadTraversal(db, body);
  return Object.freeze({ read(sourceId: string) { check(); return transaction('BEGIN', () => proof(() => owner.read(sourceId))); },
    accept(sourceId: string) {
      check(); const raw = authority?.readAcceptedAdjudication(sourceId) ?? null;
      const requested = raw === null ? null : input(raw, sourceId);
      return transaction('BEGIN IMMEDIATE', () => {
        const prior = proof(() => owner.read(sourceId));
        if (prior) { if (requested && json(prior.source) !== json(requested)) throw new Error('actual adjudication Source frozen differently'); return prior; }
        if (!requested) throw new Error('accepted actual adjudication Source missing');
        const value = proof(() => owner.derive(requested));
        db.prepare('INSERT INTO actual_live_adjudications VALUES(?,?,?,?,?,?,?,?)').run(sourceId, value.gameId, value.playId,
          requested.physicalEndSourceId, json(requested), hash(requested), json(value), hash(value));
        // INSERT and its triggers cannot share the earlier immutable proof.
        return proof(() => {
          const saved = owner.read(sourceId);
          if (!saved || json(saved) !== json(value)) throw new Error('actual adjudication changed during acceptance');
          return saved;
        });
      });
    }, close() { if (!closed) { db.close(); closed = true; } } });
};

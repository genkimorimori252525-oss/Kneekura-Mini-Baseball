import { assertNoReceivedDefenderClaims, assertNoReceivedDefenderReferenceClaims } from './ActualReceivedUmpireDefenderClaims';
import { actualFoulEndIdentityRows, actualFoulTerminalClaims, actualFoulOtherTerminalClaims } from './ActualFoulPlayEndOwnership';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { actualLivePlayId } from './ActualLivePlayScope';
import { createRequire } from 'node:module';
import { actualFoulPlayEndInput as input, type FoulEndSource, type FoulEndedEvidence, type FoulEndEvaluation } from './ActualFoulPlayEnd';
import { actualFoulPlayEndEvidenceFromSqlite } from './ActualFoulPlayEndEvidenceFromSqlite';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
/** Each original history record is authenticated separately by its physical owner.
 * The new envelope persists a bounded source manifest, never a mutated old timeline. */
const projection = (value: FoulEndedEvidence) => {
  const { wholeHistory: _original, ...receipt } = value;
  return receipt;
};
const assertTerminalClaims = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>,
  value: FoulEndedEvidence, inserted: boolean) => {
  const rows = actualFoulTerminalClaims(db, { gameId: value.gameId, playId: value.playId,
    physicalPitchSourceId: value.physicalPitchSourceId, runtimeSourceId: value.preCorePhysicalProof.runtimeReference.sourceId,
    physicalObligationKey: value.dispositionObligations.physical.obligationKey, originalSuccessorKey: value.dispositionObligations.original.successorKey });
  if (actualFoulOtherTerminalClaims(db, { gameId: value.gameId, playId: value.playId,
    physicalPitchSourceId: value.physicalPitchSourceId, runtimeSourceId: value.preCorePhysicalProof.runtimeReference.sourceId }).length
    || rows.length !== (inserted ? 1 : 0) || inserted && rows[0].source_id !== value.source.sourceId) {
    throw new Error('actual foul terminal closure ownership claims differ');
  }
};
export const actualFoulEndArchiveEncoding = (value: FoulEndedEvidence) => {
  const receipt = projection(value);
  return { json: json(receipt), hash: hash(receipt) };
};
type Db = import('node:sqlite').DatabaseSync;
// Private to this module: callers cannot substitute their own proof. Every use
// freshly authenticates the raw source, original archive, terminal census/seal.
const readClosedEvidence = (db: Db, sourceId: string,
  derive: (source: FoulEndSource) => FoulEndEvaluation): FoulEndedEvidence | null => {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='actual_foul_play_ends'").get()) return null;
  const rows = actualFoulEndIdentityRows(db, sourceId);
  if (!rows.length) return null;
  if (rows.length !== 1 || rows[0].source_id !== sourceId) throw new Error('actual foul terminal ownership identity differs');
  const row = rows[0];
  const s = input(JSON.parse(String(row.source_json)), sourceId), value = derive(s);
  if (value.kind !== 'ended') throw new Error('stored actual foul PlayEnd proof is pending');
  if (json(value.source) !== json(s)) throw new Error('actual foul PlayEnd proof Source differs');
  assertTerminalClaims(db, value, true);
  if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='actual_live_play_fences'").get()) {
    throw new Error('actual foul archive seal is missing');
  }
  const expected = projection(value), fences = db.prepare('SELECT * FROM actual_live_play_fences WHERE (game_id=? AND play_id=?) OR physical_pitch_source_id=? OR closure_source_id=?')
    .all(value.gameId, value.playId, value.physicalPitchSourceId, sourceId);
  if (fences.length !== 1 || fences[0].game_id !== value.gameId || fences[0].play_id !== value.playId
    || fences[0].physical_pitch_source_id !== value.physicalPitchSourceId || fences[0].closure_source_id !== sourceId
    || row.game_id !== value.gameId || row.play_id !== value.playId || row.physical_pitch_source_id !== value.physicalPitchSourceId
    || row.source_json !== json(s) || row.source_hash !== hash(s) || row.snapshot_json !== json(expected) || row.snapshot_hash !== hash(expected)) {
    throw new Error('actual foul PlayEnd archive or fence differs');
  }
  return value;
};
/** Authenticated historical closed receipt on the caller's transaction/snapshot.
 * Unlike a proposal derivation, this requires the durable end AND its exact seal. */
export const actualFoulClosedEvidenceFromSqlite = (db: Db) => {
  const own = actualFoulPlayEndEvidenceFromSqlite(db);
  const read = (sourceId: string) => withBattedVenueLegalReadSnapshot(db, () => {
    if (!actualLivePlayId(sourceId)) throw new Error('invalid actual foul end identity');
    return readClosedEvidence(db, sourceId, own.derive);
  });
  return { read, reference(sourceId: string) {
    const value = read(sourceId);
    return value && { owner: 'actual_foul_play_ends' as const, sourceId, sourceVersion: value.source.sourceVersion,
      sourceHash: hash(value.source), snapshotHash: actualFoulEndArchiveEncoding(value).hash };
  } };
};
export const openSqliteActualFoulPlayEndStore = (path: string,
  authority?: Readonly<{ readAcceptedEnd(sourceId: string): FoulEndSource | null }>) => {
  if (!actualLivePlayId(path) || authority !== undefined && typeof authority.readAcceptedEnd !== 'function') throw new Error('invalid actual foul end authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=wal; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS actual_foul_play_ends(source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,
      physical_pitch_source_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(game_id,play_id));
    CREATE TABLE IF NOT EXISTS actual_live_play_fences(game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL UNIQUE,
      closure_source_id TEXT NOT NULL UNIQUE,PRIMARY KEY(game_id,play_id));`);
  const own = actualFoulPlayEndEvidenceFromSqlite(db); let closed = false, failed = false;
  const check = () => { if (closed || failed) throw new Error('closed actual foul PlayEnd store'); };
  const source = (sourceId: string) => {
    const raw = authority?.readAcceptedEnd(sourceId) ?? null;
    if (!raw) throw new Error('accepted actual foul PlayEnd Source missing');
    return input(raw, sourceId);
  };
  const { read } = actualFoulClosedEvidenceFromSqlite(db);
  const snapshot = <T>(body: () => T) => withBattedVenueLegalReadSnapshot(db, body);
  return Object.freeze({ read(sourceId: string) { check(); return snapshot(() => read(sourceId)); },
    evaluate(sourceId: string) { check(); const requested = source(sourceId); return snapshot(() => {
      const prior = read(sourceId);
      if (prior) { if (json(prior.source) !== json(requested)) throw new Error('actual foul end Source frozen differently'); return prior; }
      const proposed = own.derive(requested, true);
      if (proposed.kind === 'ended') assertTerminalClaims(db, proposed, false);
      return proposed;
    }); },
    accept(sourceId: string): FoulEndedEvidence {
      check(); const prior = snapshot(() => read(sourceId)), raw = authority?.readAcceptedEnd(sourceId) ?? null;
      const requested = raw === null ? null : input(raw, sourceId);
      if (prior) {
        if (requested && json(prior.source) !== json(requested)) throw new Error('actual PlayEnd Source frozen differently');
        return snapshot(() => {
          const saved = read(sourceId);
          if (!saved || actualFoulEndArchiveEncoding(saved).json !== actualFoulEndArchiveEncoding(prior).json) {
            throw new Error('actual PlayEnd owner changed during retry');
          }
          return saved;
        });
      }
      if (!requested) throw new Error('accepted actual foul PlayEnd Source missing');
      snapshot(() => assertNoReceivedDefenderReferenceClaims(db, [{ owner: 'batted_world_field_executions', sourceId: requested.executionSourceId }]));
      const proposed = snapshot(() => own.derive(requested, true));
      if (proposed.kind !== 'ended') throw new Error(`actual foul PlayEnd pending: ${proposed.pendingReasons.join(', ')}`);
      snapshot(() => assertTerminalClaims(db, proposed, false));
      const encoded = json(projection(proposed)), proofCleanupErrors: unknown[] = []; db.exec('BEGIN IMMEDIATE');
      try {
        const beforeChanges = db.prepare('SELECT total_changes() AS n').get()!.n;
        if (typeof beforeChanges !== 'number' || !Number.isSafeInteger(beforeChanges + 2)) throw new Error('actual foul terminal write accounting unavailable');
        assertNoReceivedDefenderClaims(db, proposed);
        assertTerminalClaims(db, proposed, false);
        const current = own.derive(requested, true);
        if (current.kind !== 'ended' || json(projection(current)) !== encoded) throw new Error('actual PlayEnd complete proof changed before write');
        db.prepare('INSERT INTO actual_foul_play_ends VALUES(?,?,?,?,?,?,?,?)').run(sourceId, proposed.gameId, proposed.playId,
          proposed.physicalPitchSourceId, json(requested), hash(requested), encoded, hash(projection(proposed)));
        assertNoReceivedDefenderClaims(db, proposed);
        assertTerminalClaims(db, proposed, true);
        db.prepare('INSERT INTO actual_live_play_fences VALUES(?,?,?,?)').run(proposed.gameId, proposed.playId, proposed.physicalPitchSourceId, sourceId);
        assertNoReceivedDefenderClaims(db, proposed);
        assertTerminalClaims(db, proposed, true);
        // current=true adds head/dependency assertions to the same immutable
        // historical result. Reuse only this post-trigger proof, before commit.
        // A savepoint detects a replaced transaction; total_changes alone does
        // not detect rollback/rebegin or schema-only (including TEMP) changes.
        if (!db.isTransaction) throw new Error('actual PlayEnd proof transaction is missing');
        db.exec('SAVEPOINT actual_end_closed_proof');
        const priorQueryOnly = db.prepare('PRAGMA query_only').get()!.query_only;
        if (priorQueryOnly !== 0 && priorQueryOnly !== 1) throw new Error('actual PlayEnd query_only setting is invalid');
        // Endpoint counters cannot see transient schema changes undone by a child
        // rollback. Prevent writes during this owned proof/authentication phase.
        // This is not a sandbox against deliberate flag toggles or private API replacement.
        const saved = (() => {
          let proofFailed = false;
          try {
            db.exec('PRAGMA query_only=ON');
            if (db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('actual PlayEnd query_only guard is unavailable');
            const proofState = () => [db.prepare('SELECT total_changes() AS changes').get()!.changes,
              db.prepare('PRAGMA main.schema_version').get()!.schema_version,
              db.prepare('PRAGMA temp.schema_version').get()!.schema_version] as const;
            const originalState = proofState();
            const unchanged = () => {
              const state = proofState();
              if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1
                || state.some((value, index) => value !== originalState[index])) {
                throw new Error('actual PlayEnd proof transaction or dependencies changed during read');
              }
            };
            const after = own.derive(requested, true);
            unchanged();
            if (after.kind !== 'ended' || json(projection(after)) !== encoded) {
              throw new Error('actual PlayEnd complete proof changed during write');
            }
            const saved = readClosedEvidence(db, sourceId, () => after);
            if (!saved || json(projection(saved)) !== encoded) throw new Error('actual PlayEnd complete proof changed during write');
            unchanged();
            return saved;
          } catch (error) { proofFailed = true; throw error; }
          finally {
            try {
              db.exec(`PRAGMA query_only=${priorQueryOnly ? 'ON' : 'OFF'}`);
              if (db.prepare('PRAGMA query_only').get()!.query_only !== priorQueryOnly) throw new Error('actual PlayEnd query_only restoration differs');
            } catch (restoreError) {
              failed = true;
              if (proofFailed) proofCleanupErrors.push(restoreError); else throw restoreError;
            }
          }
        })();
        db.exec('RELEASE actual_end_closed_proof');
        if (!db.isTransaction) throw new Error('actual PlayEnd proof transaction ended during read');
        if (db.prepare('SELECT total_changes() AS n').get()!.n !== beforeChanges + 2) throw new Error('actual foul terminal write changed unrelated ownership');
        assertNoReceivedDefenderClaims(db, proposed);
        db.exec('COMMIT'); return saved;
      } catch (error) {
        // A failing proof/read may already have rolled back. Preserve that
        // original error and clean up the entire writer, including its savepoint.
        const errors = [error, ...proofCleanupErrors];
        try { if (db.isTransaction) db.exec('ROLLBACK'); } catch (rollbackError) { failed = true; errors.push(rollbackError); }
        if (failed) {
          try { db.close(); closed = true; } catch (closeError) { errors.push(closeError); }
          throw new AggregateError(errors, 'actual PlayEnd writer cleanup failed; store is retired', { cause: error });
        }
        throw error;
      }
    }, close() { if (!closed) { db.close(); closed = true; } },
  });
};

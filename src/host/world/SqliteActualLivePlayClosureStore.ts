import { actualLivePlayReadinessFromSqlite } from './ActualLivePlayReadinessFromSqlite';
import { createRequire } from 'node:module';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { actualLivePlayClosureInput as input, type AcceptedActualLivePlayClosure } from './ActualLivePlayClosureSource';
import { actualLivePlayClosureEvidenceFromSqlite, deriveActualLivePlayClosureProposal,
  assertActualLiveClosureStage, assertActualLiveClosureOpenMatch } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export const openSqliteActualLivePlayClosureStore = (path: string,
  authority?: Readonly<{ readAcceptedClosure(sourceId: string): AcceptedActualLivePlayClosure | null }>) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS actual_live_play_closures(source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,
      application_id TEXT NOT NULL UNIQUE,status TEXT NOT NULL CHECK(status IN ('QUEUED','OFFICIAL_APPLIED')),
      source_json TEXT NOT NULL,source_hash TEXT NOT NULL,proposal_json TEXT NOT NULL,proposal_hash TEXT NOT NULL,result_json TEXT,
      UNIQUE(game_id,play_id),CHECK((status='QUEUED' AND result_json IS NULL) OR (status='OFFICIAL_APPLIED' AND result_json IS NOT NULL)));`);
  const owner = actualLivePlayClosureEvidenceFromSqlite(db); let closed = false;
  const check = () => { if (closed) throw new Error('closed actual live closure store'); };
  const transaction = <T>(mode: string, body: () => T): T => { db.exec(mode); try { const result = body(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; } };
  const official = new SqliteOfficialStateStore(path, (connection, application, phase) => {
    const row = connection.prepare('SELECT source_id FROM actual_live_play_closures WHERE application_id=?').get(application.applicationId);
    const original = row && actualLivePlayClosureEvidenceFromSqlite(connection).read(String(row.source_id));
    if (!original || json(original.proposal.application) !== json(application)) throw new Error('actual live official application Source differs');
    if (phase === 'write') assertActualLiveClosureOpenMatch(connection, original.proposal);
    else assertActualLiveClosureStage(connection, original.proposal, true, phase === 'written');
  });
  const read = (sourceId: string) => { check(); return transaction('BEGIN', () => owner.read(sourceId)); };
  const enqueue = (sourceId: string) => {
    check(); const raw = authority?.readAcceptedClosure(sourceId) ?? null, requested = raw === null ? null : input(raw, sourceId);
    return transaction('BEGIN IMMEDIATE', () => {
      const prior = owner.read(sourceId);
      if (prior) { if (requested && json(prior.source) !== json(requested)) throw new Error('actual live closure Source frozen differently'); return prior; }
      if (!requested) throw new Error('accepted actual live closure Source missing');
      const p = deriveActualLivePlayClosureProposal(db, requested); assertActualLiveClosureOpenMatch(db, p);
      db.prepare("INSERT INTO actual_live_play_closures VALUES(?,?,?,?,'QUEUED',?,?,?,?,NULL)").run(sourceId, p.gameId, p.playId,
        requested.applicationId, json(requested), hash(requested), json(p), hash(p));
      const saved = owner.read(sourceId);
      if (!saved || json(saved.proposal) !== json(p)) throw new Error('actual live closure changed during enqueue');
      assertActualLiveClosureOpenMatch(db, p); return saved;
    });
  };
  const resume = (sourceId: string) => {
    check(); const queued = read(sourceId); if (!queued) throw new Error('accepted actual live closure missing');
    const raw = authority?.readAcceptedClosure(sourceId) ?? null;
    if (raw !== null && json(input(raw, sourceId)) !== json(queued.source)) throw new Error('actual live closure Source frozen differently');
    if (queued.result) return queued.result;
    const p = queued.proposal; official.applyAndActivate(p.application);
    return transaction('BEGIN IMMEDIATE', () => {
      const current = owner.read(sourceId);
      if (!current || json(current.proposal) !== json(p)) throw new Error('actual live closure changed during application');
      if (current.result) return current.result;
      assertActualLiveClosureStage(db, p, true, true);
      const result = freeze({ sourceId, official: p.expectedOfficial, scoring: p.scoring, workload: p.workload,
        nextPhysicalPlay: { kind: 'blocked' as const, reason: 'actual_role_workload_pending' as const }, controllerReset: p.controllerReset });
      const updated = db.prepare("UPDATE actual_live_play_closures SET status='OFFICIAL_APPLIED',result_json=? WHERE source_id=? AND status='QUEUED' AND proposal_hash=? AND source_hash=?")
        .run(json(result), sourceId, hash(p), hash(queued.source));
      if (updated.changes !== 1) throw new Error('actual live closure application receipt CAS failed');
      const saved = owner.read(sourceId);
      if (!saved?.result || json(saved.result) !== json(result)) throw new Error('actual live closure stage receipt changed');
      assertActualLiveClosureStage(db, p, true, true);
      return saved.result;
    });
  };
  return Object.freeze({ read, enqueue, resume,
    readReadiness(sourceId: string) { check(); return transaction('BEGIN', () => actualLivePlayReadinessFromSqlite(db).read(sourceId)); },
    submit(sourceId: string) { enqueue(sourceId); return resume(sourceId); },
    close() { if (!closed) { official.close(); db.close(); closed = true; } } });
};

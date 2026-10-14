import { createRequire } from 'node:module';
import { openSqliteOfficialScoringStore } from '../SqliteOfficialScoringStore';
import { actualLiveScoringInput as input, type ActualLiveScoringAuthority, type AcceptedActualLiveScoringSource } from './ActualLiveScoringSource';
import { actualLiveScoringEvidenceFromSqlite, deriveActualLiveScoringProposal, assertActualLiveScoringStage,
  actualLiveScoringRequest, actualLiveAcceptedScoringEvidence, type ActualLiveScoringArchive } from './ActualLiveScoringEvidenceFromSqlite';
import { assertActualScoringOwnership } from './ActualLiveScoringMetadata';
import { actualLivePlayId as id } from './ActualLivePlayScope';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Independent post-closure scorer admission. Source reservation, the existing
 * scoring writer, and completion checkpoint each have their own transaction. */
export const openSqliteActualLiveScoringStore = (path: string, authority?: ActualLiveScoringAuthority) => {
  if (!id(path) || authority !== undefined && typeof authority.readAcceptedScoringSource !== 'function') throw new Error('invalid actual scoring store');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS actual_live_scoring_sources(
      source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,closure_id TEXT NOT NULL UNIQUE,
      scoring_application_id TEXT NOT NULL UNIQUE,official_application_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('QUEUED','SCORED')),source_json TEXT NOT NULL,source_hash TEXT NOT NULL,
      proposal_json TEXT NOT NULL,proposal_hash TEXT NOT NULL,result_json TEXT,UNIQUE(game_id,play_id),
      CHECK((status='QUEUED' AND result_json IS NULL) OR (status='SCORED' AND result_json IS NOT NULL)));`);
  const owner = actualLiveScoringEvidenceFromSqlite(db); let closed = false;
  const check = (sourceId: string) => { if (closed) throw new Error('actual scoring store is closed'); if (!id(sourceId)) throw new Error('invalid actual scoring Source identity'); };
  const transaction = <T>(begin: 'BEGIN' | 'BEGIN IMMEDIATE', body: () => T): T => {
    db.exec(begin); try { const result = body(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const accepted = (sourceId: string) => {
    const raw = authority?.readAcceptedScoringSource(sourceId) ?? null;
    return raw === null ? null : input(raw, sourceId);
  };
  const assertAccepted = (source: AcceptedActualLiveScoringSource, required = false) => {
    const current = accepted(source.sourceId);
    if (current ? json(current) !== json(source) : required) throw new Error('actual scoring accepted Source frozen differently or changed');
  };
  const same = (current: ActualLiveScoringArchive | null, expected: ActualLiveScoringArchive) => {
    if (!current || json(current.source) !== json(expected.source) || json(current.proposal) !== json(expected.proposal)) {
      throw new Error('actual scoring queued Source/proposal changed');
    }
    return current;
  };
  const read = (sourceId: string) => {
    check(sourceId); return transaction('BEGIN', () => {
      const value = owner.readSource(sourceId);
      if (value) assertActualLiveScoringStage(db, value.proposal, value.status === 'SCORED');
      return value;
    });
  };
  // The accepted evidence callback below reads only our persisted Source. The
  // guard separately reauthenticates that Source on the scorer's own connection.
  const scoring = openSqliteOfficialScoringStore(path, { readAcceptedOfficialScoringEvidence(sourceId) {
    const original = read(sourceId);
    return original ? actualLiveAcceptedScoringEvidence(original.proposal) : null;
  } }, (connection, application, phase) => {
    if (!active) throw new Error('actual scoring writer has no active queued Source');
    const value = same(actualLiveScoringEvidenceFromSqlite(connection).readSource(active.source.sourceId), active);
    if (phase === 'written' && value.status !== active.status) throw new Error('actual scoring stage changed during scoring INSERT');
    if (json(application) !== json(value.proposal.application)) throw new Error('actual scoring official application differs');
    assertActualLiveScoringStage(connection, value.proposal, phase === 'written' || value.status === 'SCORED');
  });
  let active: ActualLiveScoringArchive | null = null;
  const enqueue = (sourceId: string) => {
    check(sourceId); const requested = accepted(sourceId); let existed = false;
    const preflight = transaction('BEGIN', () => {
      const prior = owner.readSource(sourceId);
      if (prior) {
        existed = true;
        if (requested && json(requested) !== json(prior.source)) throw new Error('actual scoring Source frozen differently');
        assertActualLiveScoringStage(db, prior.proposal, prior.status === 'SCORED'); return prior;
      }
      if (!requested) throw new Error('accepted actual live scoring Source missing');
      const proposal = deriveActualLiveScoringProposal(db, requested);
      assertActualScoringOwnership(db, proposal, false); assertActualLiveScoringStage(db, proposal);
      return { source: requested, proposal, status: 'QUEUED' as const, result: null };
    });
    return transaction('BEGIN IMMEDIATE', () => {
      assertAccepted(preflight.source, requested !== null);
      const prior = owner.readSource(sourceId);
      if (prior) {
        const value = same(prior, preflight); assertActualLiveScoringStage(db, value.proposal, value.status === 'SCORED'); return value;
      }
      if (existed || !requested) throw new Error('accepted actual scoring Source was removed');
      const proposal = deriveActualLiveScoringProposal(db, requested);
      if (json(proposal) !== json(preflight.proposal)) throw new Error('actual scoring dependencies changed after preflight');
      assertActualScoringOwnership(db, proposal, false); assertActualLiveScoringStage(db, proposal);
      db.prepare(`INSERT INTO actual_live_scoring_sources(source_id,game_id,play_id,closure_id,scoring_application_id,
        official_application_id,status,source_json,source_hash,proposal_json,proposal_hash,result_json)
        VALUES(?,?,?,?,?,?,'QUEUED',?,?,?,?,NULL)`).run(sourceId, proposal.gameId, proposal.playId, requested.closureReference.sourceId,
        requested.scoringApplicationId, proposal.application.applicationId, json(requested), hash(requested), json(proposal), hash(proposal));
      assertAccepted(requested, true);
      const saved = same(owner.readSource(sourceId), preflight);
      assertActualLiveScoringStage(db, saved.proposal, saved.status === 'SCORED');
      if (saved.status !== 'QUEUED') throw new Error('actual scoring Source stage changed during enqueue');
      return saved;
    });
  };
  const resume = (sourceId: string) => {
    check(sourceId); if (active) throw new Error('actual scoring resume is already active');
    const queued = read(sourceId); if (!queued) throw new Error('accepted actual scoring Source missing');
    assertAccepted(queued.source);
    // Reauthenticate after the optional external callback, even on a retry.
    const current = same(read(sourceId), queued); if (current.result) return current.result;
    active = queued;
    try { scoring.apply(actualLiveScoringRequest(queued.proposal)); } finally { active = null; }
    return transaction('BEGIN IMMEDIATE', () => {
      const before = same(owner.readSource(sourceId), queued), p = before.proposal;
      const result = assertActualLiveScoringStage(db, p, true)!;
      if (before.result) return before.result;
      const changed = db.prepare("UPDATE actual_live_scoring_sources SET status='SCORED',result_json=? WHERE source_id=? AND status='QUEUED' AND source_hash=? AND proposal_hash=?")
        .run(json(result), sourceId, hash(queued.source), hash(queued.proposal));
      if (changed.changes !== 1) throw new Error('actual scoring completion checkpoint CAS failed');
      const saved = same(owner.readSource(sourceId), queued); assertActualLiveScoringStage(db, p, true);
      if (!saved.result || json(saved.result) !== json(result)) throw new Error('actual scoring completion receipt changed');
      return saved.result;
    });
  };
  return Object.freeze({ read, enqueue, resume, submit(sourceId: string) { enqueue(sourceId); return resume(sourceId); },
    close() { if (!closed) { scoring.close(); db.close(); closed = true; } } });
};

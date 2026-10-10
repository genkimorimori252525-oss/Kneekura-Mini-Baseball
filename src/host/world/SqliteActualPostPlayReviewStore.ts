import { createRequire } from 'node:module';
export { openSqliteActualFoulOfficialStore, deriveFoulOfficialOpeningClock } from './SqliteActualFoulOfficialStore';
import { actualPostPlayReviewSessionInput, actualPostPlayReviewEventInput, actualPostPlayReviewIntentInput,
  type AcceptedActualPostPlayReviewEvent } from './ActualPostPlayReviewSource';
import { actualPostPlayReviewEvidenceFromSqlite, type NativePostPlaySessionArchive } from './ActualPostPlayReviewFromSqlite';
import { postPlayReviewSessionClaims, postPlayReviewEventRows, postPlayReviewHeadRows } from './ActualPostPlayReviewNativeMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type ActualPostPlayReviewAuthority = Readonly<{
  readAcceptedSession(sourceId: string): unknown;
  readAcceptedEvent(sourceId: string): unknown;
  readAcceptedIntent(sourceId: string): unknown;
}>;
/** The accepted Source callbacks are the control/event owner boundary. Caller
 * timestamps and caller-only control snapshots cannot advance this journal. */
export const openSqliteActualPostPlayReviewStore = (path: string, authority?: ActualPostPlayReviewAuthority) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS actual_post_play_review_sessions(source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,
        physical_pitch_source_id TEXT NOT NULL UNIQUE,adjudication_source_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,
        source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(game_id,play_id));
      CREATE TABLE IF NOT EXISTS actual_post_play_review_events(source_id TEXT PRIMARY KEY,session_source_id TEXT NOT NULL,
        revision INTEGER NOT NULL,parent_source_id TEXT NOT NULL,parent_snapshot_hash TEXT NOT NULL,source_json TEXT NOT NULL,
        source_hash TEXT NOT NULL,intent_json TEXT,admission_json TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
        UNIQUE(session_source_id,revision));
      CREATE TABLE IF NOT EXISTS actual_post_play_review_heads(session_source_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,
        head_source_id TEXT NOT NULL,head_hash TEXT NOT NULL);`);
  } catch (error) { db.close(); throw error; }
  const owner = actualPostPlayReviewEvidenceFromSqlite(db); let closed = false;
  const check = () => { if (closed) throw new Error('closed actual post-play review store'); };
  const transaction = <T>(mode: 'BEGIN' | 'BEGIN IMMEDIATE', body: () => T): T => {
    db.exec(mode);
    try { const result = body(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const sessionInput = (id: string) => {
    const raw = authority?.readAcceptedSession(id) ?? null;
    return raw === null ? null : actualPostPlayReviewSessionInput(raw, id);
  };
  const eventInput = (id: string) => {
    const raw = authority?.readAcceptedEvent(id) ?? null;
    return raw === null ? null : actualPostPlayReviewEventInput(raw, id);
  };
  const intentInput = (source: AcceptedActualPostPlayReviewEvent) => {
    const action = source.action;
    if (action.kind !== 'request' && action.kind !== 'decline' && action.kind !== 'official_request'
      && action.kind !== 'accept_live_appeal_result') return null;
    const raw = authority?.readAcceptedIntent(action.intentSourceId) ?? null;
    return raw === null ? null : actualPostPlayReviewIntentInput(raw, action.intentSourceId);
  };
  const pin = (root: NativePostPlaySessionArchive) => ({
    sessions: postPlayReviewSessionClaims(db, root.value.source.adjudicationSourceId, root.scope),
    events: postPlayReviewEventRows(db, root.value.source.sourceId),
    heads: postPlayReviewHeadRows(db, root.value.source.sourceId),
  });
  const same = (actual: unknown, expected: unknown, message: string) => {
    if (json(actual) !== json(expected)) throw new Error(message);
  };
  return Object.freeze({
    readSession(sourceId: string) { check(); return transaction('BEGIN', () => owner.readSession(sourceId)); },
    readCurrent(sourceId: string) { check(); return transaction('BEGIN', () => owner.readCurrent(sourceId)); },
    readAt(sourceId: string, revision: number) { check(); return transaction('BEGIN', () => owner.readAt(sourceId, revision)); },
    readEvent(sourceId: string) { check(); return transaction('BEGIN', () => owner.readEvent(sourceId)); },
    acceptSession(sourceId: string) {
      check(); const source = sessionInput(sourceId);
      const preflight = transaction('BEGIN', () => {
        const prior = owner.session(sourceId);
        if (prior) {
          if (source) same(source, prior.value.source, 'post-play session Source is frozen differently');
          return { kind: 'prior' as const, value: prior.value };
        }
        if (!source) throw new Error('accepted post-play session Source is missing');
        const root = owner.deriveSession(source);
        return { kind: 'new' as const, root, pinned: pin(root) };
      });
      if (preflight.kind === 'prior') return freeze({ kind: 'accepted' as const, value: preflight.value });
      if (preflight.root.intakeReasons.length) return freeze({ kind: 'intake_pending' as const, sourceId, pendingReasons: preflight.root.intakeReasons });
      return transaction('BEGIN IMMEDIATE', () => {
        same(sessionInput(sourceId), source, 'accepted post-play session Source changed after preflight');
        // Another connection may have completed the same accepted Source.
        const prior = owner.session(sourceId);
        if (prior) {
          same(prior, preflight.root, 'post-play session Source is frozen differently');
          return freeze({ kind: 'accepted' as const, value: prior.value });
        }
        const root = owner.deriveSession(preflight.root.value.source);
        same(root, preflight.root, 'post-play session inputs changed after preflight');
        same(pin(root), preflight.pinned, 'post-play session ownership changed after preflight');
        const s = root.value.source;
        db.prepare('INSERT INTO actual_post_play_review_sessions VALUES(?,?,?,?,?,?,?,?,?)').run(sourceId, root.scope.gameId,
          root.scope.playId, root.scope.physicalPitchSourceId, s.adjudicationSourceId, json(s), hash(s), json(root), hash(root));
        db.prepare('INSERT INTO actual_post_play_review_heads VALUES(?,?,?,?)').run(sourceId, 0, root.value.headSourceId, root.value.headHash);
        same(sessionInput(sourceId), source, 'accepted post-play session Source changed during write');
        const saved = owner.session(sourceId);
        same(saved, root, 'post-play session changed during acceptance');
        owner.writable(root);
        same(owner.readCurrent(sourceId), root.value, 'post-play initial head changed during acceptance');
        return freeze({ kind: 'accepted' as const, value: root.value });
      });
    },
    acceptEvent(sourceId: string) {
      check(); const source = eventInput(sourceId);
      const preflight = transaction('BEGIN', () => {
        const prior = owner.eventDetails(sourceId);
        if (prior) {
          if (source) same(source, prior.source, 'post-play event Source is frozen differently');
          const intent = intentInput(prior.source);
          if (intent) same(intent, prior.intent, 'post-play accepted intent is frozen differently');
          return { kind: 'prior' as const, value: prior.value };
        }
        if (!source) throw new Error('accepted post-play event Source is missing');
        const intent = intentInput(source), result = owner.deriveEvent(source, intent);
        if (result.kind === 'intent_pending') return result;
        return { kind: 'new' as const, source, intent, result, pinned: pin(result.root) };
      });
      if (preflight.kind === 'prior') return freeze({ kind: 'accepted' as const, value: preflight.value });
      if (preflight.kind === 'intent_pending') return freeze({ ...preflight, sourceId });
      return transaction('BEGIN IMMEDIATE', () => {
        const acceptedSource = eventInput(sourceId), acceptedIntent = intentInput(preflight.source);
        same(acceptedSource, preflight.source, 'accepted post-play event Source changed after preflight');
        same(acceptedIntent, preflight.intent, 'accepted post-play intent Source changed after preflight');
        const prior = owner.eventDetails(sourceId);
        if (prior) {
          same(prior.source, preflight.source, 'post-play event Source is frozen differently');
          same(prior.intent, preflight.intent, 'post-play intent Source is frozen differently');
          same(prior.value, preflight.result.value, 'post-play event receipt changed after preflight');
          return freeze({ kind: 'accepted' as const, value: prior.value });
        }
        const result = owner.deriveEvent(preflight.source, preflight.intent);
        same(result, preflight.result, 'post-play event authority or inputs changed after preflight');
        if (result.kind !== 'admitted') throw new Error('post-play admission changed after preflight');
        same(pin(result.root), preflight.pinned, 'post-play journal ownership changed after preflight');
        const { value, previous } = result, s = preflight.source;
        db.prepare('INSERT INTO actual_post_play_review_events VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(sourceId, s.sessionSourceId,
          value.revision, s.parent.sourceId, s.parent.snapshotHash, json(s), hash(s),
          preflight.intent === null ? null : json(preflight.intent), json(result.admissionEvidence), json(value), hash(value));
        const updated = db.prepare(`UPDATE actual_post_play_review_heads SET revision=?,head_source_id=?,head_hash=?
          WHERE session_source_id=? AND revision=? AND head_source_id=? AND head_hash=?`).run(value.revision, sourceId,
          value.headHash, s.sessionSourceId, previous.revision, previous.headSourceId, previous.headHash);
        if (updated.changes !== 1) throw new Error('post-play head revision changed during acceptance');
        same(eventInput(sourceId), s, 'accepted post-play event Source changed during write');
        same(intentInput(s), preflight.intent, 'accepted post-play intent Source changed during write');
        const saved = owner.eventDetails(sourceId);
        if (!saved) throw new Error('post-play journal event disappeared during acceptance');
        same(saved.value, value, 'post-play journal event changed during acceptance');
        owner.assertCurrentAdmission(saved);
        const after = pin(result.root);
        same(after.sessions, preflight.pinned.sessions, 'post-play session bytes changed during acceptance');
        same(after.events.filter(row => row.source_id !== sourceId), preflight.pinned.events, 'post-play earlier event bytes changed during acceptance');
        same(owner.readCurrent(s.sessionSourceId), value, 'post-play current head changed during acceptance');
        return freeze({ kind: 'accepted' as const, value });
      });
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};

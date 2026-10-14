import { createRequire } from 'node:module';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { foulOfficialEvidenceFromSqlite } from './ActualFoulOfficialEvidenceFromSqlite';
import { foulOfficialSessionInput, foulOfficialEventInput, foulOfficialIntentInput } from './ActualFoulOfficialSource';
import { foulOfficialRows, foulOfficialTables } from './ActualFoulOfficialOwnership';
import { actualLivePlayId as id } from './ActualLivePlayScope';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedFoulOfficialEvent, FoulOfficialAuthority, FoulOfficialStore } from './ActualFoulOfficial';
export { deriveFoulOfficialOpeningClock } from './ActualFoulOfficialSource';

/** Dedicated post-play owner. No live ingress, Match application, workload,
 * reset or successor-pitch write is performed by this journal. */
export const openSqliteActualFoulOfficialStore = (path: string, authority?: FoulOfficialAuthority): FoulOfficialStore => {
  if (!id(path) || authority !== undefined && ['readAcceptedSession','readAcceptedEvent','readAcceptedIntent']
    .some(k => typeof authority[k as keyof FoulOfficialAuthority] !== 'function')) throw new Error('invalid foul official authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path); let closed = false, failed = false;
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS main.actual_foul_official_sessions(source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,
        physical_pitch_source_id TEXT NOT NULL UNIQUE,physical_end_source_id TEXT NOT NULL UNIQUE,official_obligation_key TEXT NOT NULL UNIQUE,
        source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS main.actual_foul_official_events(source_id TEXT PRIMARY KEY,session_source_id TEXT NOT NULL,
        game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,official_obligation_key TEXT NOT NULL,
        revision INTEGER NOT NULL,parent_source_id TEXT NOT NULL,parent_snapshot_hash TEXT NOT NULL,source_json TEXT NOT NULL,
        source_hash TEXT NOT NULL,intent_json TEXT,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(session_source_id,revision));
      CREATE TABLE IF NOT EXISTS main.actual_foul_official_heads(session_source_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,
        head_source_id TEXT NOT NULL,head_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS main.actual_foul_official_handoffs(source_id TEXT PRIMARY KEY,session_source_id TEXT NOT NULL,
        game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL UNIQUE,official_obligation_key TEXT NOT NULL UNIQUE,
        revision INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL);`);
    for (const table of foulOfficialTables) foulOfficialRows(db,table);
    db.exec('COMMIT');
  } catch (error) {
    try { if (db.isTransaction) db.exec('ROLLBACK'); } finally { db.close(); }
    throw error;
  }
  const owner = foulOfficialEvidenceFromSqlite(db);
  const check = () => { if (closed || failed) throw new Error('closed foul official store'); };
  const read = <T>(body: () => T): T => withBattedVenueLegalReadSnapshot(db,body);
  const same = (a: unknown,b: unknown,message: string) => { if (json(a) !== json(b)) throw new Error(message); };
  const sessionSource = (sourceId: string) => {
    const raw = authority?.readAcceptedSession(sourceId) ?? null;
    return raw === null ? null : foulOfficialSessionInput(raw,sourceId);
  };
  const eventSource = (sourceId: string) => {
    const raw = authority?.readAcceptedEvent(sourceId) ?? null;
    return raw === null ? null : foulOfficialEventInput(raw,sourceId);
  };
  const eventIntent = (source: AcceptedFoulOfficialEvent) => {
    if (source.action.kind !== 'record_call') return null;
    const raw = authority?.readAcceptedIntent(source.action.intentSourceId) ?? null;
    return raw === null ? null : foulOfficialIntentInput(raw,source.action.intentSourceId);
  };
  const counters = () => [db.prepare('SELECT total_changes() AS n').get()!.n,
    db.prepare('PRAGMA main.schema_version').get()!.schema_version,db.prepare('PRAGMA temp.schema_version').get()!.schema_version];
  const proof = <T>(body: () => T): T => {
    if (!db.isTransaction) throw new Error('foul official proof transaction is missing');
    db.exec('SAVEPOINT foul_official_read_proof');
    const queryOnly = db.prepare('PRAGMA query_only').get()!.query_only;
    if (queryOnly !== 0 && queryOnly !== 1) throw new Error('foul official query_only setting differs');
    db.exec('PRAGMA query_only=1'); const before = counters();
    try {
      const value = read(body);
      if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1 || json(counters()) !== json(before)) {
        throw new Error('foul official proof transaction changed');
      }
      db.exec('RELEASE foul_official_read_proof'); return value;
    } finally { db.exec('PRAGMA query_only='+queryOnly); }
  };
  const write = <T>(body: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const value = body();
      if (!db.isTransaction) throw new Error('foul official write transaction disappeared');
      db.exec('COMMIT'); return value;
    } catch (error) {
      try { if (db.isTransaction) db.exec('ROLLBACK'); else failed = true; }
      catch (cleanup) { failed = true; throw new AggregateError([error,cleanup],'foul official rollback failed',{ cause:error }); }
      throw error;
    }
  };
  const assertChanges = (before: ReturnType<typeof counters>, n: number) => {
    const after = counters();
    if (typeof before[0] !== 'number' || !Number.isSafeInteger(before[0]+n) || after[0] !== before[0]+n
      || after[1] !== before[1] || after[2] !== before[2]) throw new Error('foul official write accounting or schema changed');
  };
  return Object.freeze({
    readCurrent(sourceId: string) { check(); return read(() => owner.current(sourceId)?.value ?? null); },
    readAt(sourceId: string,revision: number) { check(); return read(() => owner.at(sourceId,revision)?.value ?? null); },
    acceptSession(sourceId: string) {
      check(); const source = sessionSource(sourceId);
      const preflight = read(() => {
        const prior = owner.session(sourceId);
        if (prior) {
          if (source) same(source,prior.facts.source,'foul official session Source is frozen differently');
          return { kind:'prior' as const,value:prior.value! };
        }
        if (!source) throw new Error('accepted foul official session Source is missing');
        const root = owner.derive(source); owner.assertCurrentMatch(root);
        const pinned = owner.pin(root);
        if (Object.values(pinned).some(rows => rows.length)) throw new Error('foul official episode or obligation already has an ownership claim');
        return { kind:'new' as const,root,pinned };
      });
      if (preflight.kind === 'prior') return preflight.value;
      const expected = preflight.root;
      if (expected.intakeReasons.length) return freeze({ kind:'intake_pending' as const,sourceId,pendingReasons:expected.intakeReasons });
      // External authority callbacks execute outside the prior read snapshot;
      // the write then authenticates all physical and journal inputs afresh.
      same(sessionSource(sourceId),source,'accepted foul official session Source changed after preflight');
      return write(() => {
        const before = counters();
        const prior = read(() => owner.session(sourceId));
        if (prior) { same(prior.value,expected.value,'foul official session frozen differently'); return prior.value!; }
        const current = read(() => { const value = owner.derive(source!); owner.assertCurrentMatch(value); return value; });
        same(current.value,expected.value,'foul official physical inputs changed before session acceptance');
        same(owner.pin(current),preflight.pinned,'foul official session ownership changed before write');
        if (!current.value || current.intakeReasons.length) throw new Error('foul official intake changed before write');
        const s = current.scope, value = current.value;
        db.prepare('INSERT INTO main.actual_foul_official_sessions VALUES(?,?,?,?,?,?,?,?,?,?)').run(sourceId,s.gameId,s.playId,
          s.physicalPitchSourceId,s.physicalEndSourceId,s.officialObligationKey,json(source),hash(source),json(value),hash(value));
        db.prepare('INSERT INTO main.actual_foul_official_heads VALUES(?,?,?,?)').run(sourceId,0,value.headSourceId,value.headHash);
        same(sessionSource(sourceId),source,'accepted foul official session Source changed during write');
        const saved = proof(() => {
          const root = owner.session(sourceId); if (!root) throw new Error('foul official session disappeared');
          owner.assertCurrentMatch(root);
          const result = owner.currentFromRoot(root).value;
          same(result,value,'foul official session proof changed during write'); return result;
        });
        assertChanges(before,2); return saved;
      });
    },
    acceptEvent(sourceId: string) {
      check(); const source = eventSource(sourceId), intent = source === null ? null : eventIntent(source);
      const preflight = read(() => {
        const prior = owner.event(sourceId);
        if (prior) {
          if (source) same(source,prior.source,'foul official event Source is frozen differently');
          if (intent) same(intent,prior.intent,'foul official intent Source is frozen differently');
          return { kind:'prior' as const,value:prior.value };
        }
        if (!source) throw new Error('accepted foul official event Source is missing');
        const result = owner.deriveEvent(source,intent);
        return { kind:'new' as const,result,pinned:owner.pin(result.root) };
      });
      if (preflight.kind === 'prior') return preflight.value;
      same(eventSource(sourceId),source,'accepted foul official event Source changed after preflight');
      same(eventIntent(source!),intent,'accepted foul official intent Source changed after preflight');
      return write(() => {
        const before = counters(), prior = read(() => owner.event(sourceId));
        if (prior) {
          same(prior.source,source,'foul official event Source is frozen differently');
          same(prior.intent,intent,'foul official intent Source is frozen differently');
          same(prior.value,preflight.result.value,'foul official event receipt changed'); return prior.value;
        }
        const current = read(() => owner.deriveEvent(source!,intent));
        same(current.value,preflight.result.value,'foul official physical or journal inputs changed before write');
        same(owner.pin(current.root),preflight.pinned,'foul official journal ownership changed before write');
        const s = source!, scope = current.root.scope, value = current.value, previous = current.previous;
        db.prepare('INSERT INTO main.actual_foul_official_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId,s.sessionSourceId,
          scope.gameId,scope.playId,scope.physicalPitchSourceId,scope.officialObligationKey,value.revision,s.parent.sourceId,s.parent.snapshotHash,
          json(s),hash(s),intent === null ? null : json(intent),json(value),hash(value));
        const updated = db.prepare(`UPDATE main.actual_foul_official_heads SET revision=?,head_source_id=?,head_hash=?
          WHERE session_source_id=? AND revision=? AND head_source_id=? AND head_hash=?`).run(value.revision,sourceId,value.headHash,
            s.sessionSourceId,previous.revision,previous.headSourceId,previous.headHash);
        if (updated.changes !== 1) throw new Error('foul official head revision changed during write');
        if (value.handoff !== null) db.prepare('INSERT INTO main.actual_foul_official_handoffs VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(sourceId,
          s.sessionSourceId,scope.gameId,scope.playId,scope.physicalPitchSourceId,scope.officialObligationKey,value.revision,
          json(s),hash(s),json(value.handoff),hash(value.handoff));
        same(eventSource(sourceId),source,'accepted foul official event Source changed during write');
        same(eventIntent(s),intent,'accepted foul official intent Source changed during write');
        const saved = proof(() => {
          const receipt = owner.event(sourceId); if (!receipt) throw new Error('foul official event disappeared');
          owner.assertCurrentMatch(receipt.root);
          same(receipt.value,value,'foul official event proof changed during write');
          same(owner.currentFromRoot(receipt.root).value,value,'foul official current head changed during write');
          const after = owner.pin(receipt.root);
          same(after.sessions,preflight.pinned.sessions,'foul official session changed during write');
          same(after.events.filter(row => row.source_id !== sourceId),preflight.pinned.events,'foul official prior events changed during write');
          same(after.handoffs.filter(row => row.source_id !== sourceId),preflight.pinned.handoffs,'foul official prior handoffs changed during write');
          return receipt.value;
        });
        assertChanges(before,value.handoff === null ? 2 : 3); return saved;
      });
    },
    close() { if (!closed) { db.close(); closed = true; } },
  });
};

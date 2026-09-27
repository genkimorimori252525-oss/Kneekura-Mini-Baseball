import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { applyPlayerRelationshipEvidence,
  createPlayerRelationshipNetwork,
  type PlayerRelationshipEvidence,
  type PlayerRelationshipNetwork,
  type RelationshipPolicy } from
  '../../core/world/team/PlayerRelationships';

export type AcceptedRelationshipPolicy = Readonly<{
  sourceId: string; careerId: string; policy: RelationshipPolicy;
}>;
export type AcceptedRelationshipEvidence = Readonly<{
  sourceId: string; careerId: string;
  evidence: PlayerRelationshipEvidence;
}>;
export type AcceptedRelationshipAuthority = Readonly<{
  readAcceptedPolicy(sourceId: string):
    AcceptedRelationshipPolicy | null;
  readAcceptedEvidence(sourceId: string):
    AcceptedRelationshipEvidence | null;
}>;
export type SqlitePlayerRelationshipStore = Readonly<{
  initialize(sourceId: string): PlayerRelationshipNetwork;
  apply(careerId: string, sourceId: string,
    expectedRevision: number): PlayerRelationshipNetwork;
  read(careerId: string): PlayerRelationshipNetwork | null;
  readAtDay(careerId: string,
    atDay: number): PlayerRelationshipNetwork | null;
  close(): void;
}>;

type PolicyRow = { career_id: string; source_id: string;
  source_json: string; initial_json: string };
type HeadRow = { revision: number; state_json: string };
type EvidenceRow = { source_id: string; career_id: string;
  before_revision: number; after_revision: number;
  source_json: string; state_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);

/** Sparse directional relationship history, with no direct ability modifier. */
export const openSqlitePlayerRelationshipStore = (
  databasePath: string,
  authority?: AcceptedRelationshipAuthority | null,
): SqlitePlayerRelationshipStore => {
  if (!id(databasePath) || (authority != null
    && (typeof authority.readAcceptedPolicy !== 'function'
      || typeof authority.readAcceptedEvidence !== 'function'))) {
    throw new Error('invalid Player relationship sources');
  }
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_relationship_policies (
    career_id TEXT PRIMARY KEY, source_id TEXT NOT NULL UNIQUE,
    source_json TEXT NOT NULL, initial_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS world_relationship_heads (
    career_id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL CHECK(revision >= 0),
    state_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS world_relationship_evidence (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    before_revision INTEGER NOT NULL CHECK(before_revision >= 0),
    after_revision INTEGER NOT NULL CHECK(after_revision > before_revision),
    source_json TEXT NOT NULL, state_json TEXT NOT NULL,
    UNIQUE(career_id, after_revision)
  );`);
  const getPolicy = db.prepare(`SELECT * FROM
    world_relationship_policies WHERE career_id=?`);
  const getPolicySource = db.prepare(`SELECT * FROM
    world_relationship_policies WHERE source_id=?`);
  const getHead = db.prepare(`SELECT * FROM
    world_relationship_heads WHERE career_id=?`);
  const getEvidence = db.prepare(`SELECT * FROM
    world_relationship_evidence WHERE source_id=?`);
  const getHistory = db.prepare(`SELECT * FROM
    world_relationship_evidence WHERE career_id=?
    ORDER BY after_revision`);
  const replay = (careerId: string,
    atDay: number | null): PlayerRelationshipNetwork | null => {
    if (!id(careerId) || (atDay !== null && !day(atDay))) {
      throw new Error('invalid Player relationship read scope');
    }
    const genesis = getPolicy.get(careerId) as
      PolicyRow | undefined;
    if (!genesis) return null;
    const pinned = JSON.parse(genesis.source_json) as
      AcceptedRelationshipPolicy;
    if (genesis.career_id !== careerId
      || pinned.careerId !== careerId
      || pinned.sourceId !== genesis.source_id
      || canonicalJson(pinned) !== genesis.source_json) {
      throw new Error('corrupt relationship policy source');
    }
    const initial = createPlayerRelationshipNetwork(careerId,
      pinned.policy);
    if (canonicalJson(initial) !== genesis.initial_json) {
      throw new Error('corrupt relationship initial state');
    }
    let current = initial;
    let historical = atDay === null || initial.effectiveDay <= atDay
      ? initial : null;
    for (const row of getHistory.all(careerId) as EvidenceRow[]) {
      const source = JSON.parse(row.source_json) as
        AcceptedRelationshipEvidence;
      if (row.career_id !== careerId
        || row.source_id !== source.sourceId
        || source.careerId !== careerId
        || row.before_revision !== current.revision
        || row.after_revision !== current.revision + 1
        || canonicalJson(source) !== row.source_json) {
        throw new Error('corrupt relationship evidence source');
      }
      current = applyPlayerRelationshipEvidence(current,
        current.revision, source.evidence).state;
      if (canonicalJson(current) !== row.state_json) {
        throw new Error('relationship replay diverged');
      }
      if (atDay === null || current.effectiveDay <= atDay) {
        historical = current;
      }
    }
    const head = getHead.get(careerId) as HeadRow | undefined;
    if (!head || head.revision !== current.revision
      || canonicalJson(current) !== head.state_json) {
      throw new Error('relationship head diverged');
    }
    return historical;
  };
  const transaction = <T>(work: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  let closed = false;
  return Object.freeze({
    initialize(sourceId: string): PlayerRelationshipNetwork {
      if (!id(sourceId)) {
        throw new Error('invalid relationship policy sourceId');
      }
      return transaction(() => {
        const prior = getPolicySource.get(sourceId) as
          PolicyRow | undefined;
        if (prior) return replay(prior.career_id, null)!;
        if (!authority) {
          throw new Error('accepted relationship policy authority is required');
        }
        const raw = authority.readAcceptedPolicy(sourceId);
        const accepted = raw === null ? null : cloneInert(raw);
        if (!accepted || accepted.sourceId !== sourceId
          || !id(accepted.careerId)) {
          throw new Error('accepted relationship policy is missing');
        }
        const initial = createPlayerRelationshipNetwork(
          accepted.careerId, accepted.policy);
        db.prepare(`INSERT INTO world_relationship_policies
          (career_id, source_id, source_json, initial_json)
          VALUES (?, ?, ?, ?)`).run(accepted.careerId,
            sourceId, canonicalJson(accepted),
            canonicalJson(initial));
        db.prepare(`INSERT INTO world_relationship_heads
          (career_id, revision, state_json) VALUES (?, 0, ?)`).run(
            accepted.careerId, canonicalJson(initial));
        return replay(accepted.careerId, null)!;
      });
    },
    apply(careerId: string, sourceId: string,
      expectedRevision: number): PlayerRelationshipNetwork {
      if (!id(careerId) || !id(sourceId) || !day(expectedRevision)) {
        throw new Error('invalid relationship application scope');
      }
      return transaction(() => {
        const prior = getEvidence.get(sourceId) as
          EvidenceRow | undefined;
        if (prior) {
          if (prior.career_id !== careerId
            || prior.before_revision !== expectedRevision) {
            throw new Error('relationship evidence retry differs');
          }
          replay(careerId, null);
          return JSON.parse(prior.state_json) as
            PlayerRelationshipNetwork;
        }
        const before = replay(careerId, null);
        if (!before) throw new Error('relationship Career is missing');
        if (!authority) {
          throw new Error('accepted relationship evidence authority is required');
        }
        const raw = authority.readAcceptedEvidence(sourceId);
        const accepted = raw === null ? null : cloneInert(raw);
        if (!accepted || accepted.sourceId !== sourceId
          || accepted.careerId !== careerId) {
          throw new Error('accepted relationship evidence is missing');
        }
        const after = applyPlayerRelationshipEvidence(before,
          expectedRevision, accepted.evidence).state;
        db.prepare(`INSERT INTO world_relationship_evidence
          (source_id, career_id, before_revision,
           after_revision, source_json, state_json)
          VALUES (?, ?, ?, ?, ?, ?)`).run(sourceId, careerId,
            before.revision, after.revision,
            canonicalJson(accepted), canonicalJson(after));
        const updated = db.prepare(`UPDATE world_relationship_heads
          SET revision=?, state_json=? WHERE career_id=?
          AND revision=? AND state_json=?`).run(after.revision,
            canonicalJson(after), careerId, before.revision,
            canonicalJson(before));
        if (updated.changes !== 1) {
          throw new Error('relationship head CAS failed');
        }
        return replay(careerId, null)!;
      });
    },
    read(careerId: string): PlayerRelationshipNetwork | null {
      return replay(careerId, null);
    },
    readAtDay(careerId: string,
      atDay: number): PlayerRelationshipNetwork | null {
      return replay(careerId, atDay);
    },
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
};

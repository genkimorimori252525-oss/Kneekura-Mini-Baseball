import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { UINT32_RANGE } from
  '../../core/world/development/DevelopmentRandom';
import { generatePlayerPersonPriors, PLAYER_PERSON_SEED_VERSION,
  type PlayerPersonPriorPolicies, type PlayerPersonPriors } from
  '../../core/world/development/PlayerPersonPriors';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterState } from '../../core/world/roster/RosterTypes';
import { canonicalRosterEvidenceJson as rosterJson } from './RosterEvidenceJson';
import { ensurePlayerPersonLinkSchema,
  isAcceptedPlayerIntakeSource,
  type AcceptedPlayerIntakeSource } from
  './SqlitePlayerPersonLinkStore';

export type CareerPersonGenesis = Readonly<{
  careerId: string;
  initializedAtDay: number;
  careerSeed: number;
  policies: PlayerPersonPriorPolicies;
}>;
export type DurablePersonPriors = Readonly<{
  careerId: string;
  playerId: string;
  personId: string;
  sourceId: string;
  priors: PlayerPersonPriors;
}>;
export type SqlitePersonGenesisStore = Readonly<{
  initializeCareer(input: CareerPersonGenesis): void;
  materialize(sourceId: string): DurablePersonPriors;
  materializeBatch(sourceIds: readonly string[]): readonly DurablePersonPriors[];
  read(sourceId: string): DurablePersonPriors | null;
  readDevelopmentSeed(careerId: string): number | null;
  close(): void;
}>;

type CareerRow = { initialized_at_day: number;
  career_seed: number; seed_derivation_version: string;
  policies_json: string };
type LinkRow = { career_id: string; player_id: string;
  person_id: string; roster_revision: number;
  accepted_at_day: number; source_json: string };
type PriorRow = { career_id: string; player_id: string;
  person_id: string; priors_json: string };
type RosterRow = { revision: number; roster_json: string };
type IndexedRoster = Readonly<{ state: RosterState; playerIds: ReadonlySet<string>; evidence: RosterRow }>;
type PinnedCareer = Readonly<{ row: CareerRow; policies: PlayerPersonPriorPolicies }>;
type BatchContext = Readonly<{
  rosters: Map<string, IndexedRoster | null>;
  careers: Map<string, PinnedCareer>;
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);

/** Hidden genesis data stays in World storage; Match and public projections do not read it. */
export const openSqlitePersonGenesisStore = (
  databasePath: string | DatabaseSync,
): SqlitePersonGenesisStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) throw new Error('invalid Person genesis path');
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const ownsConnection = typeof databasePath === 'string';
  const db = typeof databasePath === 'string' ? new Database(databasePath) : databasePath;
  if (!(db instanceof Database)) throw new Error('Person genesis requires a Native connection');
  if (ownsConnection) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  ensurePlayerPersonLinkSchema(db);
  db.exec(`CREATE TABLE IF NOT EXISTS world_person_genesis_careers (
    career_id TEXT PRIMARY KEY,
    initialized_at_day INTEGER NOT NULL CHECK(initialized_at_day >= 0),
    career_seed INTEGER NOT NULL CHECK(career_seed > 0),
    seed_derivation_version TEXT NOT NULL,
    policies_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS world_person_priors (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    player_id TEXT NOT NULL, person_id TEXT NOT NULL,
    priors_json TEXT NOT NULL,
    UNIQUE(career_id, player_id), UNIQUE(career_id, person_id)
  );`);
  }
  const careerQuery = db.prepare(`SELECT initialized_at_day,
    career_seed, seed_derivation_version, policies_json
    FROM world_person_genesis_careers
    WHERE career_id=?`);
  const linkQuery = db.prepare(`SELECT career_id, player_id,
    person_id, roster_revision, accepted_at_day, source_json
    FROM world_player_person_links WHERE source_id=?`);
  const priorQuery = db.prepare(`SELECT career_id, player_id,
    person_id, priors_json FROM world_person_priors WHERE source_id=?`);
  const rosterQuery = db.prepare(`SELECT revision, roster_json
    FROM world_roster_heads WHERE career_id=?`);
  const worldCareerQuery = db.prepare(`SELECT 1 FROM world_club_heads
    WHERE career_id=? LIMIT 1`);
  const career = (careerId: string): CareerRow | null =>
    (careerQuery.get(careerId) as CareerRow | undefined) ?? null;
  const rosterHead = (careerId: string, context?: BatchContext): IndexedRoster | null => {
    if (context?.rosters.has(careerId)) return context.rosters.get(careerId)!;
    const row = rosterQuery.get(careerId) as RosterRow | undefined;
    if (!row) { context?.rosters.set(careerId, null); return null; }
    const roster = createRosterState(JSON.parse(row.roster_json));
    if (roster.careerId !== careerId || roster.revision !== row.revision
      || rosterJson(roster) !== row.roster_json) {
      throw new Error('corrupt accepted Player Person genesis source');
    }
    const indexed = { state: roster, playerIds: new Set(roster.players.map((player) => player.playerId)), evidence: row };
    context?.rosters.set(careerId, indexed);
    return indexed;
  };
  const link = (sourceId: string, context?: BatchContext): Readonly<{
    source: AcceptedPlayerIntakeSource;
    row: LinkRow;
  }> | null => {
    const row = linkQuery.get(sourceId) as LinkRow | undefined;
    if (!row) return null;
    const source = JSON.parse(row.source_json) as
      AcceptedPlayerIntakeSource;
    const roster = rosterHead(row.career_id, context);
    if (!isAcceptedPlayerIntakeSource(source, sourceId)
      || source.careerId !== row.career_id
      || source.playerId !== row.player_id
      || source.personId !== row.person_id
      || source.rosterRevision !== row.roster_revision
      || source.acceptedAtDay !== row.accepted_at_day
      || canonicalJson(source) !== row.source_json
      || !roster || roster.state.revision < source.rosterRevision
      || roster.state.effectiveDay < source.acceptedAtDay
      || !roster.playerIds.has(source.playerId)) {
      throw new Error('corrupt accepted Player Person genesis source');
    }
    return { source, row };
  };
  const generated = (source: AcceptedPlayerIntakeSource, context?: BatchContext):
  PlayerPersonPriors => {
    const cached = context?.careers.get(source.careerId);
    const pinned = cached?.row ?? career(source.careerId);
    if (!pinned || !day(pinned.initialized_at_day)
      || !Number.isSafeInteger(pinned.career_seed)
      || pinned.career_seed <= 0
      || pinned.career_seed >= UINT32_RANGE
      || pinned.seed_derivation_version !== PLAYER_PERSON_SEED_VERSION
      || source.acceptedAtDay < pinned.initialized_at_day) {
      throw new Error('Person genesis Career seed is missing or future');
    }
    const policies = cached?.policies ?? JSON.parse(pinned.policies_json) as PlayerPersonPriorPolicies;
    if (!cached && canonicalJson(policies) !== pinned.policies_json) {
      throw new Error('corrupt Person genesis policy');
    }
    context?.careers.set(source.careerId, { row: pinned, policies });
    return generatePlayerPersonPriors({
      careerId: source.careerId, playerId: source.playerId,
      createdAtDay: source.acceptedAtDay,
      careerSeed: pinned.career_seed, policies,
    });
  };
  const readStored = (sourceId: string, context?: BatchContext): DurablePersonPriors | null => {
    if (!id(sourceId)) throw new Error('invalid Person genesis sourceId');
    const stored = priorQuery.get(sourceId) as PriorRow | undefined;
    if (!stored) return null;
    const accepted = link(sourceId, context);
    if (!accepted) throw new Error('Person priors lack accepted link');
    const expected = generated(accepted.source, context);
    const priors = JSON.parse(stored.priors_json) as PlayerPersonPriors;
    if (stored.career_id !== accepted.source.careerId
      || stored.player_id !== accepted.source.playerId
      || stored.person_id !== accepted.source.personId
      || canonicalJson(expected) !== stored.priors_json
      || canonicalJson(priors) !== stored.priors_json) {
      throw new Error('corrupt durable Person priors');
    }
    return Object.freeze({ careerId: stored.career_id,
      playerId: stored.player_id, personId: stored.person_id,
      sourceId, priors: expected });
  };
  const read = (sourceId: string): DurablePersonPriors | null => readStored(sourceId);
  const insertQuery = db.prepare(`INSERT INTO world_person_priors
    (source_id, career_id, player_id, person_id, priors_json) VALUES (?, ?, ?, ?, ?)`);
  const materializeBatch = (input: readonly string[]): readonly DurablePersonPriors[] => {
    const sourceIds = cloneInert(input);
    if (!Array.isArray(sourceIds) || sourceIds.length === 0
      || !sourceIds.every(id) || new Set(sourceIds).size !== sourceIds.length) {
      throw new Error('invalid Person genesis batch sourceIds');
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      // Actual durable evidence is shared only within this transaction, never with later reads.
      const context: BatchContext = { rosters: new Map(), careers: new Map() };
      const acceptedSources = new Map(sourceIds.map((sourceId) => {
        const accepted = link(sourceId, context);
        if (!accepted) throw new Error('accepted Player Person link is missing');
        return [sourceId, canonicalJson(accepted.source)];
      }));
      const result = sourceIds.map((sourceId) => {
        const prior = readStored(sourceId, context);
        if (prior) return prior;
        const accepted = link(sourceId, context);
        if (!accepted) throw new Error('accepted Player Person link is missing');
        const priors = generated(accepted.source, context);
        insertQuery.run(sourceId, accepted.source.careerId, accepted.source.playerId,
          accepted.source.personId, canonicalJson(priors));
        return readStored(sourceId, context)!;
      });
      for (const person of result) {
        if (canonicalJson(link(person.sourceId, context)?.source) !== acceptedSources.get(person.sourceId)
          || canonicalJson(readStored(person.sourceId, context)) !== canonicalJson(person)) {
          throw new Error('Person genesis evidence changed during batch');
        }
      }
      for (const [careerId, indexed] of context.rosters) {
        const row = rosterQuery.get(careerId) as RosterRow | undefined;
        if (!indexed || !row || row.revision !== indexed.evidence.revision
          || row.roster_json !== indexed.evidence.roster_json) {
          throw new Error('roster evidence changed during Person genesis batch');
        }
      }
      for (const [careerId, pinned] of context.careers) {
        if (canonicalJson(career(careerId)) !== canonicalJson(pinned.row)) {
          throw new Error('Career genesis evidence changed during batch');
        }
      }
      db.exec('COMMIT');
      return Object.freeze(result);
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  let closed = false;
  return Object.freeze({
    initializeCareer(input: CareerPersonGenesis): void {
      if (!input || Object.keys(input).sort().join('|')
          !== ['careerId', 'careerSeed', 'initializedAtDay',
            'policies'].join('|')
        || !id(input.careerId) || !day(input.initializedAtDay)
        || !Number.isSafeInteger(input.careerSeed)
        || input.careerSeed <= 0 || input.careerSeed >= UINT32_RANGE) {
        throw new Error('invalid Career Person genesis initialization');
      }
      const policies = cloneInert(input.policies);
      generatePlayerPersonPriors({ careerId: input.careerId,
        playerId: 'genesis-policy-validation',
        createdAtDay: input.initializedAtDay,
        careerSeed: input.careerSeed, policies });
      const json = canonicalJson(policies);
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!worldCareerQuery.get(input.careerId)) {
          throw new Error('Person genesis requires an initialized World Career');
        }
        const prior = career(input.careerId);
        if (prior) {
          if (prior.initialized_at_day !== input.initializedAtDay
            || prior.career_seed !== input.careerSeed
            || prior.seed_derivation_version !== PLAYER_PERSON_SEED_VERSION
            || prior.policies_json !== json) {
            throw new Error('Career Person genesis is already pinned differently');
          }
        } else {
          db.prepare(`INSERT INTO world_person_genesis_careers
            (career_id, initialized_at_day, career_seed,
             seed_derivation_version, policies_json)
            VALUES (?, ?, ?, ?, ?)`).run(input.careerId,
              input.initializedAtDay, input.careerSeed,
              PLAYER_PERSON_SEED_VERSION, json);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    materialize(sourceId: string): DurablePersonPriors {
      if (!id(sourceId)) throw new Error('invalid Person genesis sourceId');
      return materializeBatch([sourceId])[0];
    },
    materializeBatch,
    read,
    readDevelopmentSeed(careerId: string): number | null {
      if (!id(careerId)) throw new Error('invalid Career development seed scope');
      const pinned = career(careerId);
      if (!pinned) return null;
      if (!day(pinned.initialized_at_day)
        || !Number.isSafeInteger(pinned.career_seed)
        || pinned.career_seed <= 0
        || pinned.career_seed >= UINT32_RANGE
        || pinned.seed_derivation_version !== PLAYER_PERSON_SEED_VERSION
        || canonicalJson(JSON.parse(pinned.policies_json))
          !== pinned.policies_json) {
        throw new Error('corrupt Career development seed');
      }
      return pinned.career_seed;
    },
    close(): void { if (!closed) { if (ownsConnection) db.close(); closed = true; } },
  });
};

/** Reuses the genesis owner's replay on the consumer connection without DDL or writes. */
export const personGenesisEvidenceFromSqlite = (db: DatabaseSync): Pick<SqlitePersonGenesisStore, 'read' | 'readDevelopmentSeed'> => {
  const owner = openSqlitePersonGenesisStore(db);
  return Object.freeze({ read: owner.read, readDevelopmentSeed: owner.readDevelopmentSeed });
};

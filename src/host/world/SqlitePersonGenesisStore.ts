import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { UINT32_RANGE } from
  '../../core/world/development/DevelopmentRandom';
import { generatePlayerPersonPriors, PLAYER_PERSON_SEED_VERSION,
  type PlayerPersonPriorPolicies, type PlayerPersonPriors } from
  '../../core/world/development/PlayerPersonPriors';
import { createRosterState } from '../../core/world/roster/RosterState';
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
  read(sourceId: string): DurablePersonPriors | null;
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
  databasePath: string,
): SqlitePersonGenesisStore => {
  if (!id(databasePath)) throw new Error('invalid Person genesis path');
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
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
  const link = (sourceId: string): Readonly<{
    source: AcceptedPlayerIntakeSource;
    row: LinkRow;
  }> | null => {
    const row = linkQuery.get(sourceId) as LinkRow | undefined;
    if (!row) return null;
    const source = JSON.parse(row.source_json) as
      AcceptedPlayerIntakeSource;
    const rosterRow = rosterQuery.get(row.career_id) as
      RosterRow | undefined;
    const roster = rosterRow
      ? createRosterState(JSON.parse(rosterRow.roster_json)) : null;
    if (!isAcceptedPlayerIntakeSource(source, sourceId)
      || source.careerId !== row.career_id
      || source.playerId !== row.player_id
      || source.personId !== row.person_id
      || source.rosterRevision !== row.roster_revision
      || source.acceptedAtDay !== row.accepted_at_day
      || canonicalJson(source) !== row.source_json
      || !roster || roster.careerId !== source.careerId
      || roster.revision !== rosterRow?.revision
      || canonicalJson(roster) !== rosterRow.roster_json
      || roster.revision < source.rosterRevision
      || roster.effectiveDay < source.acceptedAtDay
      || !roster.players.some((player) =>
        player.playerId === source.playerId)) {
      throw new Error('corrupt accepted Player Person genesis source');
    }
    return { source, row };
  };
  const generated = (source: AcceptedPlayerIntakeSource):
  PlayerPersonPriors => {
    const pinned = career(source.careerId);
    if (!pinned || !day(pinned.initialized_at_day)
      || !Number.isSafeInteger(pinned.career_seed)
      || pinned.career_seed <= 0
      || pinned.career_seed >= UINT32_RANGE
      || pinned.seed_derivation_version !== PLAYER_PERSON_SEED_VERSION
      || source.acceptedAtDay < pinned.initialized_at_day) {
      throw new Error('Person genesis Career seed is missing or future');
    }
    const policies = JSON.parse(pinned.policies_json) as
      PlayerPersonPriorPolicies;
    if (canonicalJson(policies) !== pinned.policies_json) {
      throw new Error('corrupt Person genesis policy');
    }
    return generatePlayerPersonPriors({
      careerId: source.careerId, playerId: source.playerId,
      createdAtDay: source.acceptedAtDay,
      careerSeed: pinned.career_seed, policies,
    });
  };
  const read = (sourceId: string): DurablePersonPriors | null => {
    if (!id(sourceId)) throw new Error('invalid Person genesis sourceId');
    const stored = priorQuery.get(sourceId) as PriorRow | undefined;
    if (!stored) return null;
    const accepted = link(sourceId);
    if (!accepted) throw new Error('Person priors lack accepted link');
    const expected = generated(accepted.source);
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
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = read(sourceId);
        if (prior) {
          db.exec('COMMIT');
          return prior;
        }
        const accepted = link(sourceId);
        if (!accepted) throw new Error('accepted Player Person link is missing');
        const priors = generated(accepted.source);
        db.prepare(`INSERT INTO world_person_priors
          (source_id, career_id, player_id, person_id, priors_json)
          VALUES (?, ?, ?, ?, ?)`).run(sourceId,
            accepted.source.careerId, accepted.source.playerId,
            accepted.source.personId, canonicalJson(priors));
        const result = read(sourceId)!;
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    read,
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
};

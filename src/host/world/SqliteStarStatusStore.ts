import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { projectStarStatus,
  type HighStageEventEvidence, type StarSeasonEvidence,
  type StarStatusPolicy, type StarStatusProjection } from
  '../../core/world/star/StarStatus';

export type AcceptedStarPolicySource = Readonly<{
  sourceId: string; careerId: string; policy: StarStatusPolicy;
}>;
export type AcceptedStarSeasonSource = Readonly<{
  sourceId: string; careerId: string; playerId: string;
  evidence: StarSeasonEvidence;
}>;
export type AcceptedHighStageSource = Readonly<{
  sourceId: string; careerId: string; playerId: string;
  evidence: HighStageEventEvidence;
}>;
export type AcceptedStarStatusAuthority = Readonly<{
  readAcceptedPolicy(sourceId: string): AcceptedStarPolicySource | null;
  readAcceptedSeason(sourceId: string): AcceptedStarSeasonSource | null;
  readAcceptedHighStage(sourceId: string): AcceptedHighStageSource | null;
}>;
export type SqliteStarStatusStore = Readonly<{
  pinPolicy(sourceId: string): AcceptedStarPolicySource;
  acceptSeason(sourceId: string): AcceptedStarSeasonSource;
  acceptHighStage(sourceId: string): AcceptedHighStageSource;
  project(careerId: string, playerId: string,
    asOfDay: number): StarStatusProjection;
  close(): void;
}>;

type PolicyRow = { source_id: string; career_id: string;
  source_json: string };
type EvidenceRow = { source_id: string; career_id: string;
  player_id: string; season_id?: string; event_id?: string;
  at_day: number; source_json: string };
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

/** Career projection from accepted seasonal and major-stage evidence only. */
export const openSqliteStarStatusStore = (
  databasePath: string,
  authority?: AcceptedStarStatusAuthority | null,
): SqliteStarStatusStore => {
  if (!id(databasePath) || (authority != null
    && (typeof authority.readAcceptedPolicy !== 'function'
      || typeof authority.readAcceptedSeason !== 'function'
      || typeof authority.readAcceptedHighStage !== 'function'))) {
    throw new Error('invalid Star status sources');
  }
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_star_status_policies (
    career_id TEXT PRIMARY KEY, source_id TEXT NOT NULL UNIQUE,
    source_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS world_star_seasons (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    player_id TEXT NOT NULL, season_id TEXT NOT NULL,
    at_day INTEGER NOT NULL CHECK(at_day >= 0),
    source_json TEXT NOT NULL,
    UNIQUE(career_id, player_id, season_id)
  );
  CREATE TABLE IF NOT EXISTS world_star_high_stage_events (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL,
    player_id TEXT NOT NULL, event_id TEXT NOT NULL,
    at_day INTEGER NOT NULL CHECK(at_day >= 0),
    source_json TEXT NOT NULL,
    UNIQUE(career_id, player_id, event_id)
  );`);
  const getPolicySource = db.prepare(`SELECT * FROM
    world_star_status_policies WHERE source_id=?`);
  const getPolicyCareer = db.prepare(`SELECT * FROM
    world_star_status_policies WHERE career_id=?`);
  const getSeasonSource = db.prepare(`SELECT * FROM
    world_star_seasons WHERE source_id=?`);
  const getStageSource = db.prepare(`SELECT * FROM
    world_star_high_stage_events WHERE source_id=?`);
  const getSeasons = db.prepare(`SELECT * FROM world_star_seasons
    WHERE career_id=? AND player_id=? AND at_day<=?
    ORDER BY at_day, season_id`);
  const getStages = db.prepare(`SELECT * FROM
    world_star_high_stage_events
    WHERE career_id=? AND player_id=? AND at_day<=?
    ORDER BY at_day, event_id`);
  const readPolicy = (row: PolicyRow): AcceptedStarPolicySource => {
    const source = JSON.parse(row.source_json) as
      AcceptedStarPolicySource;
    if (!id(source.sourceId) || !id(source.careerId)
      || source.sourceId !== row.source_id
      || source.careerId !== row.career_id
      || canonicalJson(source) !== row.source_json) {
      throw new Error('corrupt Star status policy source');
    }
    return source;
  };
  const readSeason = (row: EvidenceRow): AcceptedStarSeasonSource => {
    const source = JSON.parse(row.source_json) as
      AcceptedStarSeasonSource;
    if (!id(source.sourceId) || !id(source.careerId)
      || !id(source.playerId)
      || source.sourceId !== row.source_id
      || source.careerId !== row.career_id
      || source.playerId !== row.player_id
      || source.evidence?.seasonId !== row.season_id
      || source.evidence?.atDay !== row.at_day
      || canonicalJson(source) !== row.source_json) {
      throw new Error('corrupt Star season source');
    }
    return source;
  };
  const readStage = (row: EvidenceRow): AcceptedHighStageSource => {
    const source = JSON.parse(row.source_json) as
      AcceptedHighStageSource;
    if (!id(source.sourceId) || !id(source.careerId)
      || !id(source.playerId)
      || source.sourceId !== row.source_id
      || source.careerId !== row.career_id
      || source.playerId !== row.player_id
      || source.evidence?.eventId !== row.event_id
      || source.evidence?.atDay !== row.at_day
      || canonicalJson(source) !== row.source_json) {
      throw new Error('corrupt high-stage source');
    }
    return source;
  };
  const projection = (careerId: string, playerId: string,
    asOfDay: number): StarStatusProjection => {
    if (!id(careerId) || !id(playerId) || !day(asOfDay)) {
      throw new Error('invalid Star status scope');
    }
    const policyRow = getPolicyCareer.get(careerId) as
      PolicyRow | undefined;
    if (!policyRow) throw new Error('Star status policy is missing');
    const pinned = readPolicy(policyRow);
    const seasons = (getSeasons.all(careerId, playerId,
      asOfDay) as EvidenceRow[]).map(row =>
      readSeason(row).evidence);
    const highStageEvents = (getStages.all(careerId, playerId,
      asOfDay) as EvidenceRow[]).map(row =>
      readStage(row).evidence);
    return projectStarStatus({ careerId, playerId, asOfDay,
      policy: pinned.policy, seasons, highStageEvents });
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
    pinPolicy(sourceId: string): AcceptedStarPolicySource {
      if (!id(sourceId)) throw new Error('invalid Star policy sourceId');
      return transaction(() => {
        const prior = getPolicySource.get(sourceId) as
          PolicyRow | undefined;
        if (prior) return readPolicy(prior);
        if (!authority) throw new Error('accepted Star policy authority is required');
        const raw = authority.readAcceptedPolicy(sourceId);
        const accepted = raw === null ? null : cloneInert(raw);
        if (!accepted || accepted.sourceId !== sourceId
          || !id(accepted.careerId) || !accepted.policy) {
          throw new Error('accepted Star policy is missing or invalid');
        }
        // Validate the pinned policy through the core projection.
        projectStarStatus({ careerId: accepted.careerId,
          playerId: 'policy-validation',
          asOfDay: accepted.policy.effectiveDay,
          policy: accepted.policy, seasons: [], highStageEvents: [] });
        db.prepare(`INSERT INTO world_star_status_policies
          (career_id, source_id, source_json) VALUES (?, ?, ?)`).run(
            accepted.careerId, sourceId, canonicalJson(accepted));
        return readPolicy(getPolicySource.get(sourceId) as PolicyRow);
      });
    },
    acceptSeason(sourceId: string): AcceptedStarSeasonSource {
      if (!id(sourceId)) throw new Error('invalid Star season sourceId');
      return transaction(() => {
        const prior = getSeasonSource.get(sourceId) as
          EvidenceRow | undefined;
        if (prior) {
          readPolicy(getPolicyCareer.get(prior.career_id) as PolicyRow);
          return readSeason(prior);
        }
        if (!authority) throw new Error('accepted Star season authority is required');
        const raw = authority.readAcceptedSeason(sourceId);
        const accepted = raw === null ? null : cloneInert(raw);
        if (!accepted || accepted.sourceId !== sourceId
          || !id(accepted.careerId) || !id(accepted.playerId)
          || !id(accepted.evidence?.seasonId)
          || !day(accepted.evidence.atDay)) {
          throw new Error('accepted Star season is missing or invalid');
        }
        const pinned = getPolicyCareer.get(accepted.careerId) as
          PolicyRow | undefined;
        if (!pinned) throw new Error('Star policy is missing');
        const policy = readPolicy(pinned).policy;
        projectStarStatus({ careerId: accepted.careerId,
          playerId: accepted.playerId,
          asOfDay: accepted.evidence.atDay,
          policy, seasons: [accepted.evidence],
          highStageEvents: [] });
        db.prepare(`INSERT INTO world_star_seasons
          (source_id, career_id, player_id, season_id,
           at_day, source_json) VALUES (?, ?, ?, ?, ?, ?)`).run(
            sourceId, accepted.careerId, accepted.playerId,
            accepted.evidence.seasonId, accepted.evidence.atDay,
            canonicalJson(accepted));
        return readSeason(getSeasonSource.get(sourceId) as EvidenceRow);
      });
    },
    acceptHighStage(sourceId: string): AcceptedHighStageSource {
      if (!id(sourceId)) throw new Error('invalid high-stage sourceId');
      return transaction(() => {
        const prior = getStageSource.get(sourceId) as
          EvidenceRow | undefined;
        if (prior) {
          projection(prior.career_id, prior.player_id,
            prior.at_day);
          return readStage(prior);
        }
        if (!authority) throw new Error('accepted high-stage authority is required');
        const raw = authority.readAcceptedHighStage(sourceId);
        const accepted = raw === null ? null : cloneInert(raw);
        if (!accepted || accepted.sourceId !== sourceId
          || !id(accepted.careerId) || !id(accepted.playerId)
          || !id(accepted.evidence?.eventId)
          || !day(accepted.evidence.atDay)) {
          throw new Error('accepted high-stage event is missing or invalid');
        }
        const policyRow = getPolicyCareer.get(accepted.careerId) as
          PolicyRow | undefined;
        if (!policyRow) throw new Error('Star policy is missing');
        const seasons = (getSeasons.all(accepted.careerId,
          accepted.playerId, accepted.evidence.atDay) as
          EvidenceRow[]).map(row => readSeason(row).evidence);
        projectStarStatus({ careerId: accepted.careerId,
          playerId: accepted.playerId,
          asOfDay: accepted.evidence.atDay,
          policy: readPolicy(policyRow).policy, seasons,
          highStageEvents: [accepted.evidence] });
        db.prepare(`INSERT INTO world_star_high_stage_events
          (source_id, career_id, player_id, event_id,
           at_day, source_json) VALUES (?, ?, ?, ?, ?, ?)`).run(
            sourceId, accepted.careerId, accepted.playerId,
            accepted.evidence.eventId, accepted.evidence.atDay,
            canonicalJson(accepted));
        return readStage(getStageSource.get(sourceId) as EvidenceRow);
      });
    },
    project: projection,
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
};

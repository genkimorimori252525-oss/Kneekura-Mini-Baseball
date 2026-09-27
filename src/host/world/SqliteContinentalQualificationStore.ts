import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { DomesticCompetitionSeasonSnapshot } from
  '../../core/world/competition/DomesticCompetitionSeason';
import type { SqliteDomesticCompetitionSeasonStore } from
  './SqliteDomesticCompetitionSeasonStore';

export type ContinentalQualificationSourceRequest = Readonly<{
  careerId: string;
  competitionEditionId: string;
  expectedLeagueIds: readonly string[];
  sourceSeasonIds: readonly string[];
}>;
export type ContinentalQualificationSnapshot = Readonly<{
  qualificationSnapshotId: string;
  competitionEditionId: string;
  participantIds: readonly string[];
  leagueSources: readonly Readonly<{
    leagueId: string;
    seasonId: string;
    regularSeasonChampionClubId: string;
    domesticChampionClubId: string;
    qualification: DomesticCompetitionSeasonSnapshot['continentalQualification'];
  }>[];
}>;
export type SqliteContinentalQualificationStore = Readonly<{
  initialize(input: ContinentalQualificationSourceRequest):
    ContinentalQualificationSnapshot;
  readSnapshot(careerId: string, competitionEditionId: string):
    ContinentalQualificationSnapshot | null;
  close(): void;
}>;
type QualificationRow = { request_json: string; snapshot_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);
const build = (
  source: Pick<SqliteDomesticCompetitionSeasonStore, 'readSnapshot'>,
  input: ContinentalQualificationSourceRequest,
): ContinentalQualificationSnapshot => {
  if (!id(input?.careerId) || !id(input.competitionEditionId)
    || !Array.isArray(input.expectedLeagueIds)
    || input.expectedLeagueIds.length === 0
    || input.expectedLeagueIds.length !== input.sourceSeasonIds?.length
    || input.expectedLeagueIds.some((leagueId) => !id(leagueId))
    || input.sourceSeasonIds.some((seasonId) => !id(seasonId))
    || new Set(input.expectedLeagueIds).size !== input.expectedLeagueIds.length
    || new Set(input.sourceSeasonIds).size !== input.sourceSeasonIds.length) {
    throw new Error('invalid continental qualification source set');
  }
  const leagueSources = input.expectedLeagueIds.map((leagueId, index) => {
    const seasonId = input.sourceSeasonIds[index];
    const snapshot = source.readSnapshot(input.careerId, seasonId);
    if (!snapshot || snapshot.leagueId !== leagueId
      || snapshot.seasonId !== seasonId
      || snapshot.continentalQualification.competitionEditionId
        !== input.competitionEditionId
      || snapshot.continentalQualification.qualificationSeasonId
        !== seasonId) {
      throw new Error('continental entrant lacks completed domestic source');
    }
    return Object.freeze({ leagueId, seasonId,
      regularSeasonChampionClubId:
        snapshot.regularSeasonTitleSnapshot.winnerClubId,
      domesticChampionClubId:
        snapshot.domesticChampionSnapshot.championClubId,
      qualification: snapshot.continentalQualification });
  });
  const participantIds = leagueSources.flatMap((item) =>
    item.qualification.entrantClubIds);
  if (participantIds.length === 0
    || participantIds.some((clubId) => !id(clubId))
    || new Set(participantIds).size !== participantIds.length) {
    throw new Error('continental entrants are empty or duplicated');
  }
  const evidence = { competitionEditionId: input.competitionEditionId,
    leagueSources };
  const fingerprint = createHash('sha256')
    .update(canonicalJson(evidence)).digest('hex');
  return Object.freeze({
    qualificationSnapshotId: `continental-qualification-v1:${fingerprint}`,
    competitionEditionId: input.competitionEditionId,
    participantIds: Object.freeze(participantIds),
    leagueSources: Object.freeze(leagueSources),
  });
};

/** Aggregate only replayable domestic qualification into an Edition source. */
export const openSqliteContinentalQualificationStore = (
  databasePath: string,
  domestic: Pick<SqliteDomesticCompetitionSeasonStore, 'readSnapshot'>,
): SqliteContinentalQualificationStore => {
  if (!id(databasePath)) {
    throw new Error('invalid continental qualification database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_continental_qualifications (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, snapshot_json
    FROM world_continental_qualifications
    WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string):
    QualificationRow | null => (get.get(careerId, editionId) as
      QualificationRow | undefined) ?? null;
  const parse = (careerId: string, editionId: string,
    stored: QualificationRow): ContinentalQualificationSnapshot => {
    try {
      const input = JSON.parse(stored.request_json) as
        ContinentalQualificationSourceRequest;
      const snapshot = JSON.parse(stored.snapshot_json) as
        ContinentalQualificationSnapshot;
      if (input.careerId !== careerId
        || input.competitionEditionId !== editionId
        || canonicalJson(input) !== stored.request_json
        || canonicalJson(snapshot) !== stored.snapshot_json) {
        throw new Error('qualification scope or serialization differs');
      }
      const replayed = build(domestic, input);
      if (canonicalJson(replayed) !== stored.snapshot_json) {
        throw new Error('continental qualification replay differs');
      }
      return replayed;
    } catch (cause) {
      throw new Error(`corrupt continental qualification for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  return Object.freeze({
    initialize(rawInput: ContinentalQualificationSourceRequest):
      ContinentalQualificationSnapshot {
      if (closed) throw new Error('continental qualification store is closed');
      const input = cloneInert(rawInput);
      const snapshot = build(domestic, input);
      const requestJson = canonicalJson(input);
      const snapshotJson = canonicalJson(snapshot);
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = row(input.careerId,
          input.competitionEditionId);
        if (existing) {
          const prior = parse(input.careerId,
            input.competitionEditionId, existing);
          if (existing.request_json !== requestJson) {
            throw new Error('continental qualification is already frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        db.prepare(`INSERT INTO world_continental_qualifications
          (career_id, edition_id, request_json, snapshot_json)
          VALUES (?, ?, ?, ?)`).run(input.careerId,
          input.competitionEditionId, requestJson, snapshotJson);
        db.exec('COMMIT');
        return snapshot;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readSnapshot(careerId: string,
      competitionEditionId: string):
      ContinentalQualificationSnapshot | null {
      if (closed || !id(careerId) || !id(competitionEditionId)) {
        throw new Error('invalid continental qualification read scope');
      }
      const stored = row(careerId, competitionEditionId);
      return stored ? parse(careerId, competitionEditionId,
        stored) : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
